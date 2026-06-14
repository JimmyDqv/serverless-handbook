"""Canonical DSQL connector — single source of truth for every Lambda that talks to DSQL.

This file lives ONCE in `shared/python/` and is copied into each consuming
Lambda's build artifacts by that Lambda's Makefile (`BuildMethod: makefile`
+ `build_in_source: true` in samconfig). Do not create per-Lambda copies.

Access model: the Lambda's execution role STS-assumes a dedicated DSQL
reader/writer role (`lambda_stats_reader` / `lambda_stats_writer`, exported
by the datastore stack), generates a short-lived auth token, and connects
with psycopg2 over TLS. Schema names (`blog_statistics`, `cms_content`) are
embedded in the queries, not in the connector.
"""
import os

import boto3
import psycopg2
from psycopg2.extras import RealDictCursor


def get_required_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise ValueError(f"Missing required environment variable: {key}")
    return value


class DSQLConnector:
    def __init__(self, cluster_endpoint: str, region: str, schema: str | None = None):
        self.cluster_endpoint = cluster_endpoint
        self.region = region
        # Optional default schema for callers that interpolate it into SQL
        # (e.g. f"SELECT ... FROM {connector.schema}.page_views_analytics").
        self.schema = schema

    def assume_role_and_get_token(self, role_arn: str, session_name: str = "dsql-access") -> str:
        sts = boto3.client("sts", region_name=self.region)
        creds = sts.assume_role(RoleArn=role_arn, RoleSessionName=session_name)["Credentials"]
        dsql = boto3.client(
            "dsql",
            region_name=self.region,
            aws_access_key_id=creds["AccessKeyId"],
            aws_secret_access_key=creds["SecretAccessKey"],
            aws_session_token=creds["SessionToken"],
        )
        token = dsql.generate_db_connect_auth_token(
            Hostname=self.cluster_endpoint, Region=self.region, ExpiresIn=900
        )
        if isinstance(token, dict):
            return token["authToken"]
        return token

    def get_connection(self, auth_token: str, db_user: str):
        return psycopg2.connect(
            host=self.cluster_endpoint,
            port=5432,
            database="postgres",
            user=db_user,
            password=auth_token,
            sslmode="require",
            cursor_factory=RealDictCursor,
        )

    def execute_query(self, auth_token: str, db_user: str, query: str, params=None):
        conn = None
        try:
            conn = self.get_connection(auth_token, db_user)
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                if cursor.description:
                    rows = cursor.fetchall()
                    conn.commit()
                    return rows
                conn.commit()
                return None
        finally:
            if conn:
                conn.close()
