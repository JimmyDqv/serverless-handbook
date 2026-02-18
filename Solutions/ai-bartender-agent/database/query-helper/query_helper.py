#!/usr/bin/env python3
"""
AI Bartender - Database Query Helper

A CLI tool for direct Aurora DSQL database access with IAM authentication.
Supports interactive SQL, common queries, and JSON export.

Usage:
    python query_helper.py --interactive
    python query_helper.py --query "SELECT * FROM cocktails.drinks LIMIT 5"
    python query_helper.py --list-drinks
    python query_helper.py --list-orders --status pending
    python query_helper.py --list-sections
    python query_helper.py --profile my-profile --list-drinks
"""

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import boto3
import psycopg2
from psycopg2.extras import RealDictCursor

try:
    from tabulate import tabulate
    HAS_TABULATE = True
except ImportError:
    HAS_TABULATE = False

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


class QueryHelper:
    """CLI query helper for Aurora DSQL with IAM authentication"""

    def __init__(self, config: Dict, aws_profile: str = None):
        self.cluster_endpoint = config["cluster_endpoint"]
        self.region = config["aws_region"]
        self.database = config.get("database", "postgres")

        if aws_profile:
            self.session = boto3.Session(profile_name=aws_profile)
        else:
            self.session = boto3.Session()

        self.dsql_client = self.session.client("dsql", region_name=self.region)

    def get_auth_token(self) -> str:
        """Generate AWS IAM authentication token for DSQL"""
        response = self.dsql_client.generate_db_connect_admin_auth_token(
            Hostname=self.cluster_endpoint, Region=self.region
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

    def execute_query(self, sql_query: str, params: Optional[List] = None) -> List[Dict[str, Any]]:
        """Execute SQL query and return results"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql_query, params)

                if cur.description:
                    return cur.fetchall()
                else:
                    return [{"affected_rows": cur.rowcount}]

    def format_table(self, data: List[Dict[str, Any]]) -> str:
        """Format query results as a table"""
        if not data:
            return "No results found."

        if HAS_TABULATE:
            return tabulate(data, headers="keys", tablefmt="grid")

        # Basic fallback formatting
        headers = list(data[0].keys())
        col_widths = {
            h: max(len(str(h)), *(len(str(row.get(h, ""))) for row in data))
            for h in headers
        }

        lines = [
            " | ".join(str(h).ljust(col_widths[h]) for h in headers),
            "-+-".join("-" * col_widths[h] for h in headers),
        ]
        for row in data:
            lines.append(" | ".join(str(row.get(h, "")).ljust(col_widths[h]) for h in headers))

        return "\n".join(lines)

    # -------------------------------------------------------------------------
    # Common queries
    # -------------------------------------------------------------------------

    def list_drinks(self, section: Optional[str] = None, active_only: bool = True) -> None:
        """Display drinks in formatted table"""
        query = """
            SELECT d.id, d.name, s.name as section_name,
                   d.description, d.ingredients, d.is_active, d.created_at
            FROM cocktails.drinks d
            JOIN cocktails.sections s ON d.section_id = s.id
        """

        params = []
        conditions = []

        if active_only:
            conditions.append("d.is_active = %s")
            params.append(True)

        if section:
            conditions.append("s.name ILIKE %s")
            params.append(f"%{section}%")

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY s.display_order, d.name"

        results = self.execute_query(query, params)

        for row in results:
            if isinstance(row["ingredients"], str):
                try:
                    row["ingredients"] = ", ".join(json.loads(row["ingredients"]))
                except (json.JSONDecodeError, TypeError):
                    pass
            if row["description"] and len(row["description"]) > 50:
                row["description"] = row["description"][:47] + "..."

        print(f"\n=== DRINKS ({len(results)} found) ===")
        print(self.format_table(results))

    def list_orders(self, status: Optional[str] = None, limit: int = 50) -> None:
        """Display orders with drink details"""
        query = """
            SELECT o.id, d.name as drink_name, o.user_session_id,
                   o.status, o.created_at, o.updated_at, o.completed_at
            FROM cocktails.orders o
            JOIN cocktails.drinks d ON o.drink_id = d.id
        """

        params = []

        if status:
            query += " WHERE o.status = %s"
            params.append(status)

        query += " ORDER BY o.created_at DESC LIMIT %s"
        params.append(limit)

        results = self.execute_query(query, params)

        for row in results:
            sid = row["user_session_id"]
            if sid and len(sid) > 12:
                row["user_session_id"] = sid[:8] + "..."

        print(f"\n=== ORDERS ({len(results)} found) ===")
        print(self.format_table(results))

    def list_sections(self) -> None:
        """Display all sections"""
        query = """
            SELECT id, name, display_order, created_at,
                   (SELECT COUNT(*) FROM cocktails.drinks
                    WHERE section_id = s.id AND is_active = true) as active_drinks
            FROM cocktails.sections s
            ORDER BY display_order, name
        """

        results = self.execute_query(query)
        print(f"\n=== SECTIONS ({len(results)} found) ===")
        print(self.format_table(results))

    # -------------------------------------------------------------------------
    # Interactive mode
    # -------------------------------------------------------------------------

    def interactive_mode(self) -> None:
        """Start interactive SQL prompt"""
        print("\n=== AI Bartender - Interactive Query Mode ===")
        print("Enter SQL queries (type 'exit' or 'quit' to leave)")
        print("Commands: \\d (list tables), \\d <table> (describe), \\q (quit)")
        print()

        while True:
            try:
                query = input("dsql> ").strip()

                if query.lower() in ["exit", "quit", "\\q"]:
                    print("Goodbye!")
                    break

                if not query:
                    continue

                if query == "\\d":
                    query = """
                        SELECT table_name, table_type
                        FROM information_schema.tables
                        WHERE table_schema IN ('public', 'cocktails')
                        ORDER BY table_schema, table_name
                    """
                elif query.startswith("\\d "):
                    table_name = query[3:].strip()
                    results = self.execute_query(
                        "SELECT column_name, data_type, is_nullable, column_default "
                        "FROM information_schema.columns "
                        "WHERE table_name = %s AND table_schema IN ('public', 'cocktails') "
                        "ORDER BY ordinal_position",
                        [table_name],
                    )
                    if results:
                        print(f"\nTable: {table_name}")
                        print(self.format_table(results))
                    else:
                        print(f"Table '{table_name}' not found.")
                    continue

                start_time = datetime.now()
                results = self.execute_query(query)
                elapsed = (datetime.now() - start_time).total_seconds()

                if results:
                    print(self.format_table(results))
                    print(f"\n({len(results)} rows, {elapsed:.3f}s)")
                else:
                    print(f"Query executed successfully ({elapsed:.3f}s)")

            except KeyboardInterrupt:
                print("\nUse 'exit' or 'quit' to leave.")
            except Exception as e:
                print(f"Error: {e}")

    # -------------------------------------------------------------------------
    # JSON export
    # -------------------------------------------------------------------------

    def export_json(self, query: str, output_file: str, params: Optional[List] = None) -> None:
        """Execute query and export results to JSON file"""
        results = self.execute_query(query, params)

        with open(output_file, "w") as f:
            json.dump(results, f, indent=2, default=str)

        print(f"Results exported to {output_file} ({len(results)} rows)")


def main():
    parser = argparse.ArgumentParser(
        description="AI Bartender - Database Query Helper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --interactive
  %(prog)s --query "SELECT * FROM cocktails.drinks LIMIT 5"
  %(prog)s --list-drinks --section cocktails
  %(prog)s --list-orders --status pending
  %(prog)s --list-sections
  %(prog)s --profile production --list-drinks
        """,
    )

    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument("--interactive", action="store_true", help="Start interactive SQL prompt")
    mode_group.add_argument("--query", type=str, help="Execute specific SQL query")
    mode_group.add_argument("--list-drinks", action="store_true", help="List all drinks")
    mode_group.add_argument("--list-orders", action="store_true", help="List orders")
    mode_group.add_argument("--list-sections", action="store_true", help="List all sections")

    parser.add_argument("--section", type=str, help="Filter drinks by section")
    parser.add_argument("--status", type=str, help="Filter orders by status")
    parser.add_argument("--limit", type=int, default=50, help="Limit results (default: 50)")
    parser.add_argument("--include-inactive", action="store_true", help="Include inactive drinks")
    parser.add_argument("--profile", type=str, help="AWS profile to use")
    parser.add_argument("--export-json", type=str, help="Export query results to JSON file")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    config = load_config()
    helper = QueryHelper(config, aws_profile=args.profile)

    try:
        if args.interactive:
            helper.interactive_mode()
        elif args.query:
            if args.export_json:
                helper.export_json(args.query, args.export_json)
            else:
                results = helper.execute_query(args.query)
                print(helper.format_table(results))
        elif args.list_drinks:
            helper.list_drinks(section=args.section, active_only=not args.include_inactive)
        elif args.list_orders:
            helper.list_orders(status=args.status, limit=args.limit)
        elif args.list_sections:
            helper.list_sections()

    except KeyboardInterrupt:
        print("\nOperation cancelled.")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
