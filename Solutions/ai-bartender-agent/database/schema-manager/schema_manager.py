#!/usr/bin/env python3
"""
AI Bartender - Schema Manager

Manages incremental database schema changes for Aurora DSQL with version tracking.
Place numbered SQL files in the schema-changes/ directory and run
this tool to apply them in order.

SQL files use the format: NNN_description.sql
Each file can contain an "up" section and an optional "down" section
separated by "-- Schema Change: Down".

Usage:
    python schema_manager.py --action upgrade
    python schema_manager.py --action status
    python schema_manager.py --action rollback --version 1
    python schema_manager.py --action validate
    python schema_manager.py --action upgrade --profile my-aws-profile
"""

import argparse
import hashlib
import json
import logging
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import boto3
import psycopg2
from psycopg2.extras import RealDictCursor

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


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


class SchemaManager:
    """Manages incremental schema changes for Aurora DSQL"""

    def __init__(self, config: Dict, aws_profile: str = None):
        self.cluster_endpoint = config["cluster_endpoint"]
        self.aws_region = config["aws_region"]
        self.database = config.get("database", "postgres")

        if aws_profile:
            self.session = boto3.Session(profile_name=aws_profile)
        else:
            self.session = boto3.Session()

        self.dsql_client = self.session.client("dsql", region_name=self.aws_region)
        self.schema_changes_dir = Path(__file__).parent / "schema-changes"

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

    # -------------------------------------------------------------------------
    # Schema tracking
    # -------------------------------------------------------------------------

    def ensure_tracking_table(self) -> None:
        """Create the schema_versions tracking table if it doesn't exist"""
        conn = self.get_connection()
        try:
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS schema_versions (
                        version INTEGER PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        checksum VARCHAR(64) NOT NULL,
                        execution_time_ms INTEGER,
                        rollback_sql TEXT
                    )
                """)
                cur.execute("""
                    CREATE INDEX ASYNC IF NOT EXISTS idx_schema_versions_version
                    ON schema_versions (version)
                """)
        finally:
            conn.close()

    def get_applied_versions(self) -> List[Dict]:
        """Get list of already-applied schema versions"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT version, name, applied_at, checksum "
                    "FROM schema_versions ORDER BY version"
                )
                return cur.fetchall()

    # -------------------------------------------------------------------------
    # Schema change files
    # -------------------------------------------------------------------------

    def get_pending_changes(self) -> List[Tuple[int, str, str]]:
        """Get schema change files that haven't been applied yet"""
        applied = {row["version"] for row in self.get_applied_versions()}
        pending = []

        for sql_file in sorted(self.schema_changes_dir.glob("*.sql")):
            try:
                version = int(sql_file.stem.split("_")[0])
                if version not in applied:
                    pending.append((version, sql_file.name, sql_file.read_text()))
            except (ValueError, IndexError):
                logger.warning(f"Skipping invalid file: {sql_file.name}")

        return sorted(pending, key=lambda x: x[0])

    @staticmethod
    def parse_change(content: str) -> Tuple[str, Optional[str]]:
        """Split a schema change file into up and down SQL"""
        up_lines = []
        down_lines = []
        section = "up"

        for line in content.split("\n"):
            stripped = line.strip()
            if stripped.lower().startswith("-- schema change: down"):
                section = "down"
                continue
            if stripped.lower().startswith("-- schema change: up"):
                section = "up"
                continue
            if stripped.startswith("--") or not stripped:
                continue

            if section == "up":
                up_lines.append(stripped)
            else:
                down_lines.append(stripped)

        up_sql = "\n".join(up_lines).strip()
        down_sql = "\n".join(down_lines).strip() or None
        return up_sql, down_sql

    # -------------------------------------------------------------------------
    # Actions
    # -------------------------------------------------------------------------

    def apply_change(self, version: int, name: str, content: str) -> None:
        """Apply a single schema change and record it"""
        up_sql, down_sql = self.parse_change(content)
        checksum = hashlib.sha256(content.encode()).hexdigest()
        start_time = datetime.now()

        # Execute DDL with autocommit
        conn = self.get_connection()
        try:
            conn.autocommit = True
            with conn.cursor() as cur:
                logger.info(f"Applying schema change {version}: {name}")
                for stmt in [s.strip() for s in up_sql.split(";") if s.strip()]:
                    cur.execute(stmt)
        finally:
            conn.close()

        # Record in tracking table
        conn = self.get_connection()
        try:
            conn.autocommit = False
            with conn.cursor() as cur:
                execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
                cur.execute(
                    "INSERT INTO schema_versions "
                    "(version, name, checksum, execution_time_ms, rollback_sql) "
                    "VALUES (%s, %s, %s, %s, %s)",
                    (version, name, checksum, execution_time, down_sql),
                )
                conn.commit()
                logger.info(f"Applied schema change {version} in {execution_time}ms")
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def upgrade(self) -> None:
        """Apply all pending schema changes"""
        self.ensure_tracking_table()
        pending = self.get_pending_changes()

        if not pending:
            logger.info("No pending schema changes")
            return

        logger.info(f"Found {len(pending)} pending schema changes")
        for version, name, content in pending:
            self.apply_change(version, name, content)
        logger.info(f"Successfully applied {len(pending)} schema changes")

    def rollback(self, version: int) -> None:
        """Rollback a specific schema change by version number"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT name, rollback_sql FROM schema_versions WHERE version = %s",
                    (version,),
                )
                result = cur.fetchone()
                if not result:
                    raise ValueError(f"Schema version {version} not found")
                if not result["rollback_sql"]:
                    raise ValueError(f"No rollback SQL for schema version {version}")

                logger.info(f"Rolling back schema change {version}: {result['name']}")
                cur.execute(result["rollback_sql"])
                cur.execute("DELETE FROM schema_versions WHERE version = %s", (version,))
                conn.commit()
                logger.info(f"Rolled back schema change {version}")

    def status(self) -> None:
        """Print current schema version status"""
        self.ensure_tracking_table()
        applied = self.get_applied_versions()
        pending = self.get_pending_changes()

        print(f"\nSchema Status:")
        print(f"  Applied: {len(applied)}")
        print(f"  Pending: {len(pending)}")
        print(f"  Current Version: {applied[-1]['version'] if applied else 'none'}")

        if applied:
            print(f"\nApplied:")
            for v in applied:
                print(f"  {v['version']:3d}: {v['name']} (applied: {v['applied_at']})")

        if pending:
            print(f"\nPending:")
            for version, name, _ in pending:
                print(f"  {version:3d}: {name}")

    def validate(self) -> bool:
        """Validate schema change files for correctness"""
        change_files = sorted(self.schema_changes_dir.glob("*.sql"))

        if not change_files:
            logger.info("No schema change files found")
            return True

        valid = True
        for change_file in change_files:
            try:
                # Check naming convention
                if not re.match(r"^\d+_[a-z0-9_]+\.sql$", change_file.name):
                    logger.warning(f"{change_file.name}: doesn't follow naming convention (NNN_description.sql)")

                # Check content
                content = change_file.read_text()
                up_sql, _ = self.parse_change(content)

                if not up_sql:
                    logger.error(f"{change_file.name}: no SQL in up section")
                    valid = False

            except Exception as e:
                logger.error(f"{change_file.name}: validation failed - {e}")
                valid = False

        return valid


def main():
    parser = argparse.ArgumentParser(description="Aurora DSQL Schema Manager")
    parser.add_argument(
        "--action",
        choices=["upgrade", "status", "rollback", "validate"],
        required=True,
    )
    parser.add_argument("--version", type=int, help="Schema version (for rollback)")
    parser.add_argument("--profile", help="AWS profile to use")
    args = parser.parse_args()

    config = load_config()

    if args.profile:
        config["aws_profile"] = args.profile

    manager = SchemaManager(config, aws_profile=args.profile)

    if args.action == "upgrade":
        manager.upgrade()
    elif args.action == "status":
        manager.status()
    elif args.action == "rollback":
        if not args.version:
            print("Error: --version required for rollback")
            sys.exit(1)
        manager.rollback(args.version)
    elif args.action == "validate":
        if manager.validate():
            print("All schema changes are valid")
        else:
            print("Validation failed")
            sys.exit(1)


if __name__ == "__main__":
    main()
