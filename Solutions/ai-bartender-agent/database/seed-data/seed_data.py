#!/usr/bin/env python3
"""
AI Bartender - Seed database with menu data from drinks.json

Usage:
    python seed_data.py
    python seed_data.py --profile my-aws-profile
    python seed_data.py --skip-images
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Dict, List

import boto3
import psycopg2
from psycopg2.extras import RealDictCursor

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def load_menu_data() -> Dict:
    """Load menu data from drinks.json"""
    drinks_path = Path(__file__).parent / "drinks.json"

    if not drinks_path.exists():
        logger.error(f"drinks.json not found at {drinks_path}")
        sys.exit(1)

    with open(drinks_path, "r") as f:
        return json.load(f)


def load_config() -> Dict:
    """Load database configuration from config.json"""
    config_path = Path(__file__).parent.parent / "config" / "config.json"

    if not config_path.exists():
        logger.error(f"config.json not found at {config_path}")
        print("\nUpdate config.json with your cluster endpoint and region.")
        sys.exit(1)

    with open(config_path, "r") as f:
        config = json.load(f)

    if not config.get("cluster_endpoint"):
        logger.error("cluster_endpoint is required in config.json")
        sys.exit(1)

    config.setdefault("database", "postgres")
    return config


class DatabaseSeeder:
    """Seeds the Aurora DSQL database with menu data"""

    def __init__(self, config: Dict, aws_profile: str = None):
        self.cluster_endpoint = config["cluster_endpoint"]
        self.aws_region = config["aws_region"]
        self.database = config.get("database", "postgres")
        self.images_bucket = config.get("images_bucket")

        if aws_profile:
            self.session = boto3.Session(profile_name=aws_profile)
        else:
            self.session = boto3.Session()

        self.dsql_client = self.session.client("dsql", region_name=self.aws_region)
        self.s3_client = self.session.client("s3", region_name=self.aws_region)

    def get_auth_token(self) -> str:
        """Generate AWS IAM authentication token for DSQL"""
        response = self.dsql_client.generate_db_connect_admin_auth_token(
            Hostname=self.cluster_endpoint, Region=self.aws_region
        )

        if isinstance(response, str):
            return response
        elif isinstance(response, dict) and "authToken" in response:
            return response["authToken"]
        else:
            raise ValueError(f"Unexpected auth token response format: {response}")

    def get_connection(self) -> psycopg2.extensions.connection:
        """Create authenticated connection to DSQL cluster"""
        auth_token = self.get_auth_token()
        return psycopg2.connect(
            host=self.cluster_endpoint,
            port=5432,
            database=self.database,
            user="admin",
            password=auth_token,
            sslmode="require",
            cursor_factory=RealDictCursor,
        )

    def clear_existing_data(self) -> None:
        """Clear existing drinks and sections after user confirmation"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) as count FROM cocktails.drinks")
                drinks_count = cur.fetchone()["count"]

                cur.execute("SELECT COUNT(*) as count FROM cocktails.sections")
                sections_count = cur.fetchone()["count"]

                if drinks_count == 0 and sections_count == 0:
                    logger.info("No existing data found")
                    return

                logger.info(f"Found {drinks_count} drinks and {sections_count} sections")
                response = input(
                    f"Clear {drinks_count} drinks and {sections_count} sections? (yes/no): "
                )
                if response.lower() != "yes":
                    logger.info("Keeping existing data")
                    return

                cur.execute("DELETE FROM cocktails.drinks")
                cur.execute("DELETE FROM cocktails.sections")
                conn.commit()
                logger.info("Existing data cleared")

    def format_ingredients_json(self, ingredients: List[Dict]) -> str:
        """Extract ingredient names as a JSON array string"""
        return json.dumps([ing["item"] for ing in ingredients])

    def format_recipe_json(self, ingredients: List[Dict], method: str) -> str:
        """Build recipe JSON from ingredients and method"""
        recipe = {
            "ingredients": [
                {
                    "name": ing["item"],
                    "amount": (
                        f"{ing['amount_cl']} cl"
                        if isinstance(ing["amount_cl"], (int, float))
                        else str(ing["amount_cl"])
                    ),
                }
                for ing in ingredients
            ],
            "steps": [{"order": 1, "instruction": method}],
        }
        return json.dumps(recipe, ensure_ascii=False)

    def upload_image(self, drink_id: str, image_filename: str) -> None:
        """Upload a drink image to S3"""
        images_dir = Path(__file__).parent / "images"
        image_path = images_dir / image_filename

        if not image_path.exists():
            logger.warning(f"Image not found: {image_path}")
            return

        s3_key = f"original/{drink_id}/image.png"
        self.s3_client.upload_file(
            str(image_path),
            self.images_bucket,
            s3_key,
            ExtraArgs={"ContentType": "image/png"},
        )
        logger.info(f"Uploaded image: {image_filename} -> s3://{self.images_bucket}/{s3_key}")

    def seed(self, menu_data: Dict, skip_images: bool = False) -> None:
        """Seed sections and drinks from menu data"""
        self.clear_existing_data()

        if not skip_images and not self.images_bucket:
            logger.warning("No images_bucket in config.json - skipping image uploads")
            skip_images = True

        sections = menu_data["menu"]["sections"]

        # Create sections
        section_ids = {}
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                for idx, section in enumerate(sections, 1):
                    cur.execute(
                        """
                        INSERT INTO cocktails.sections (name, display_order)
                        VALUES (%(name)s, %(display_order)s)
                        RETURNING id
                        """,
                        {"name": section["name"], "display_order": idx},
                    )
                    section_ids[section["name"]] = cur.fetchone()["id"]
                    logger.info(f"Created section: {section['name']}")

                conn.commit()

        # Create drinks and upload images
        total = 0
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                for section in sections:
                    section_id = section_ids[section["name"]]

                    for drink in section["drinks"]:
                        is_active = drink.get("is_active", True)
                        cur.execute(
                            """
                            INSERT INTO cocktails.drinks
                            (section_id, name, description, ingredients, recipe, is_active)
                            VALUES (%(section_id)s, %(name)s, %(description)s, %(ingredients)s, %(recipe)s, %(is_active)s)
                            RETURNING id
                            """,
                            {
                                "section_id": section_id,
                                "name": drink["name"],
                                "description": drink["description"],
                                "ingredients": self.format_ingredients_json(drink["ingredients"]),
                                "recipe": self.format_recipe_json(drink["ingredients"], drink["method"]),
                                "is_active": is_active,
                            },
                        )
                        drink_id = str(cur.fetchone()["id"])
                        total += 1
                        logger.info(f"Created drink: {drink['name']} (id: {drink_id})")

                        # Upload image if available
                        if not skip_images and drink.get("image"):
                            self.upload_image(drink_id, drink["image"])

                conn.commit()

        logger.info(f"Seeding complete: {len(section_ids)} sections, {total} drinks")


def main():
    parser = argparse.ArgumentParser(description="AI Bartender - Database Seeder")
    parser.add_argument("--profile", help="AWS profile to use")
    parser.add_argument("--skip-images", action="store_true", help="Skip uploading images to S3")
    args = parser.parse_args()

    config = load_config()
    menu_data = load_menu_data()

    seeder = DatabaseSeeder(config, aws_profile=args.profile)
    seeder.seed(menu_data, skip_images=args.skip_images)


if __name__ == "__main__":
    main()
