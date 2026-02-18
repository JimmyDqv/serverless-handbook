"""AI Bartender chat endpoint (sync/buffered).

Uses Strands Agents with AgentCore Memory and MCP tools via AgentCore Gateway.
MCP client, tools, model, and system prompt are initialized at cold start.
"""

import json
import os
import uuid

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

from strands import Agent
from strands.models.bedrock import BedrockModel
from strands.tools.mcp import MCPClient
from mcp_proxy_for_aws.client import aws_iam_streamablehttp_client
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)

tracer = Tracer()
logger = Logger()

MEMORY_ID = os.environ.get("AGENTCORE_MEMORY_ID")
GATEWAY_URL = os.environ.get("AGENTCORE_GATEWAY_URL")
REGION = os.environ.get("AWS_REGION", "eu-west-1")


def _load_system_prompt() -> str:
    """Load the bartender system prompt from file."""
    prompt_path = os.path.join(
        os.path.dirname(__file__), "prompts", "bartender-system-prompt.txt"
    )
    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        logger.warning("System prompt file not found, using default")
        return """You are a friendly bartender. Help the guest find a drink.
        Use getDrinks to see the menu."""


def _create_bedrock_model() -> BedrockModel:
    """Create the Bedrock model configured for Nova 2 Lite."""
    return BedrockModel(
        model_id="global.amazon.nova-2-lite-v1:0",
        region_name=REGION,
        streaming=False,
    )


SYSTEM_PROMPT = _load_system_prompt()
BEDROCK_MODEL = _create_bedrock_model()

def _create_mcp_client() -> MCPClient:
    """Create MCP client for AgentCore Gateway tools."""
    if not GATEWAY_URL:
        raise ValueError("AGENTCORE_GATEWAY_URL environment variable not set")

    return MCPClient(
        lambda: aws_iam_streamablehttp_client(GATEWAY_URL, "bedrock-agentcore")
    )


MCP_CLIENT = _create_mcp_client()
MCP_CLIENT.__enter__()
TOOLS = MCP_CLIENT.list_tools_sync()
logger.info("Cold start: MCP tools loaded", extra={"tool_count": len(TOOLS)})


def response(status_code: int, body: dict) -> dict:
    """Build API Gateway response with CORS headers."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }


@tracer.capture_method
def create_session_manager(session_id: str, actor_id: str) -> AgentCoreMemorySessionManager:
    """Create AgentCore Memory session manager for this request."""
    if not MEMORY_ID:
        raise ValueError("AGENTCORE_MEMORY_ID environment variable not set")

    config = AgentCoreMemoryConfig(
        memory_id=MEMORY_ID,
        session_id=session_id,
        actor_id=actor_id,
    )

    return AgentCoreMemorySessionManager(
        agentcore_memory_config=config,
        region_name=REGION,
    )


@tracer.capture_method
def create_agent(session_manager: AgentCoreMemorySessionManager) -> Agent:
    """Create the Strands bartender agent with pre-initialized model/tools and per-request session."""
    return Agent(
        model=BEDROCK_MODEL,
        system_prompt=SYSTEM_PROMPT,
        session_manager=session_manager,
        tools=TOOLS,
    )


@tracer.capture_method
def process_message(agent: Agent, message: str) -> str:
    """Process a user message through the agent and return the response text."""
    result = agent(message)

    if hasattr(result, "message"):
        return str(result.message)
    return str(result)


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    """Lambda handler for POST /chat/message."""
    try:
        body = json.loads(event.get("body", "{}"))

        message = body.get("message", "").strip()
        if not message:
            return response(400, {"error": "Message is required"})

        session_id = body.get("session_id") or str(uuid.uuid4())
        actor_id = body.get("actor_id") or "anonymous"

        logger.info(
            "Processing chat message",
            extra={
                "session_id": session_id,
                "actor_id": actor_id,
                "message_length": len(message),
            },
        )

        session_manager = create_session_manager(session_id, actor_id)
        agent = create_agent(session_manager)
        agent_response = process_message(agent, message)

        logger.info(
            "Chat response generated",
            extra={
                "session_id": session_id,
                "response_length": len(agent_response),
            },
        )

        return response(
            200,
            {
                "response": agent_response,
                "session_id": session_id,
            },
        )

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        return response(500, {"error": "Service configuration error"})

    except Exception as e:
        logger.exception("Failed to process chat message")
        return response(500, {"error": "Failed to process message"})
