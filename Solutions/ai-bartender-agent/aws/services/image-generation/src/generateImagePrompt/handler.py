"""Generate image prompts for new cocktails using Amazon Bedrock."""

import json
import os
from datetime import datetime

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

tracer = Tracer()
logger = Logger()

PROMPTS_BUCKET = os.environ.get("IMAGE_PROMPTS_BUCKET", "")
BEDROCK_MODEL_ID = "global.amazon.nova-2-lite-v1:0"

# Negative prompt to avoid common AI image issues
NEGATIVE_PROMPT = """cluttered background, busy bar, hands, people, labels, logos, text, menu cards, props, harsh flash, colored lighting, neon, excessive condensation, smoke, fire, fruit piles, herbs, modern garnish, over-styling, illustration, CGI, cartoon, painterly style, artificial textures, AI artifacts"""


def build_prompt_generation_request(drink: dict) -> str:
    """Build the Bedrock prompt to generate an image prompt for a drink."""
    name = drink.get("name", "Unknown Drink")
    description = drink.get("description", "")
    ingredients = drink.get("ingredients", [])

    ingredient_details = ", ".join(ingredients) if ingredients else "various spirits"

    prompt = f"""You are an expert photographer and creative director specializing in beverage photography for high-end cocktail bars and luxury magazines.

Your task is to create a detailed image generation prompt for a photorealistic studio photograph of the following cocktail:

**Drink Name:** {name}
**Description:** {description}
**Ingredients:** {ingredient_details}

Generate a single, detailed image prompt that will produce a photorealistic, high-end studio photograph. The prompt MUST follow these EXACT specifications:

**COCKTAIL:**
1. Describe the cocktail's appearance (color, clarity, carbonation, layers if any)
2. Specify the exact glassware based on the cocktail type
3. Describe appropriate garnish placement (minimal and elegant, only if typical for this drink)

**COMPOSITION (MANDATORY - follow exactly):**
4. The glass is centered BOTH horizontally AND vertically in the frame - positioned in the absolute center of the image
5. The glass should appear in the middle-depth of the scene, NOT close to the camera, NOT pushed back - truly centered in 3D space
6. The glass sits on a clean, light stone or concrete surface with subtle natural texture
7. There is NOTHING else on the surface except the glass/cocktail - no limes, no lemons, no extra props, no decorations
8. Background is a soft, neutral gray-beige wall, evenly lit, calm, and distraction-free
9. Clean Nordic design aesthetic - minimal, understated, elegant

**CAMERA & LIGHTING (MANDATORY - follow exactly):**
10. Eye-level angle - camera at the same height as the middle of the glass. NOT from above, NOT from below
11. Professional soft studio lighting, even and diffused, no harsh shadows
12. Wide medium shot framing - significant breathing room around the glass, the cocktail should occupy roughly 40-50% of the frame height, NOT cropped tight, NOT filling the frame

**QUALITY:**
13. Ultra high resolution, professional studio quality
14. Pure photorealism - no illustration, no CGI, no artistic filters
15. Timeless, calm, elegant, and understated aesthetic

Output ONLY the image prompt text, nothing else. Do not include any explanations, headers, or markdown formatting. Just the prompt text that would be used for image generation."""

    return prompt


@tracer.capture_method
def call_bedrock(prompt: str) -> str:
    """Call Bedrock Nova Pro to generate the image prompt."""
    bedrock_client = boto3.client("bedrock-runtime", region_name="eu-west-1")

    request_body = {
        "messages": [{"role": "user", "content": [{"text": prompt}]}],
        "inferenceConfig": {
            "temperature": 0.7,
            "topP": 0.9,
        },
    }

    response = bedrock_client.invoke_model(
        modelId=BEDROCK_MODEL_ID,
        body=json.dumps(request_body),
        contentType="application/json",
    )

    response_body = json.loads(response["body"].read())
    generated_prompt = response_body["output"]["message"]["content"][0]["text"]

    return generated_prompt.strip()


@tracer.capture_method
def save_prompt_to_s3(drink_id: str, drink_name: str, generated_prompt: str) -> str:
    """Save the generated prompt to S3 as JSON and plain text."""
    s3_client = boto3.client("s3")
    timestamp = datetime.utcnow().isoformat() + "Z"

    prompt_data = {
        "drink_id": drink_id,
        "drink_name": drink_name,
        "generated_at": timestamp,
        "model_id": BEDROCK_MODEL_ID,
        "prompt": generated_prompt,
        "negative_prompt": NEGATIVE_PROMPT,
    }

    json_key = f"prompts/{drink_id}/prompt.json"
    s3_client.put_object(
        Bucket=PROMPTS_BUCKET,
        Key=json_key,
        Body=json.dumps(prompt_data, indent=2),
        ContentType="application/json",
    )

    txt_key = f"prompts/{drink_id}/prompt.txt"
    txt_content = f"""Drink: {drink_name}
Generated: {timestamp}

=== IMAGE PROMPT ===
{generated_prompt}

=== NEGATIVE PROMPT ===
{NEGATIVE_PROMPT}
"""
    s3_client.put_object(
        Bucket=PROMPTS_BUCKET,
        Key=txt_key,
        Body=txt_content,
        ContentType="text/plain",
    )

    logger.info("Saved prompt to S3", extra={"drink_id": drink_id, "s3_key": json_key})
    return json_key


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    """Handle DrinkCreated events from EventBridge."""
    try:
        detail = event.get("detail", {})
        data = detail.get("data", {})
        drink_id = data.get("drink_id")
        drink_name = data.get("name")

        if not drink_id:
            logger.error("Missing drink_id in event", extra={"event": event})
            return {"statusCode": 400, "body": "Missing drink_id"}

        logger.info(
            "Processing DrinkCreated event",
            extra={"drink_id": drink_id, "drink_name": drink_name},
        )

        bedrock_prompt = build_prompt_generation_request(data)
        generated_prompt = call_bedrock(bedrock_prompt)

        logger.info(
            "Generated image prompt",
            extra={"drink_id": drink_id, "prompt_length": len(generated_prompt)},
        )

        s3_key = save_prompt_to_s3(drink_id, drink_name, generated_prompt)

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "drink_id": drink_id,
                    "s3_key": s3_key,
                    "prompt_length": len(generated_prompt),
                }
            ),
        }

    except Exception as e:
        logger.exception("Failed to generate image prompt")
        return {"statusCode": 500, "body": str(e)}
