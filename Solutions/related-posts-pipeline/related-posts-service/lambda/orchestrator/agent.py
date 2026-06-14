"""Strands Agent that picks 3 related posts via AgentCore Gateway MCP tools.

The agent's tools (`vector_search`, `read_post_excerpt`) are served by the
AgentCore Gateway, addressed by a SigV4-signed MCP endpoint. The agent
returns structured JSON ({"picks": [...]}) which this module parses into
an AgentPicks dataclass.

Verified against Strands Agents 1.40.0:
    - `Agent` constructor takes `model`, `tools`, `system_prompt`, ...
      It does NOT take `max_iterations` (no such parameter in 1.x).
    - `MCPClient` wraps a transport factory callable, not a URL string.
      It is used as a context manager; tools are discovered via
      `list_tools_sync()`.
    - The SigV4 transport for AgentCore Gateway comes from
      `mcp_proxy_for_aws.client.aws_iam_streamablehttp_client`.
    - The agent return value is `AgentResult`; the final assistant message
      lives at `result.message` and is a Message dict of the form
      `{"role": "assistant", "content": [{"text": "..."}]}`.
"""
import json
import logging
import os
import re
from dataclasses import dataclass

from botocore.config import Config as BotoConfig
from mcp_proxy_for_aws.client import aws_iam_streamablehttp_client
from strands import Agent
from strands.models import BedrockModel
from strands.tools.mcp.mcp_client import MCPClient

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are the editor for a technical blog about AWS, serverless, and AI.
Your job is to pick exactly 3 related posts a reader would value most after finishing the current post.
Prefer thematic depth over surface-level keyword overlap.
Each pick needs a one-sentence rationale that names the specific connection.

Workflow:
1. Call vector_search with source_slug=<source_slug>, language=<language>, k=20,
   exclude_slugs=[<source_slug>]. The tool will resolve the embedding from Atlas
   internally — do NOT attempt to construct an embedding yourself.
2. If two candidates feel interchangeable, optionally call read_post_excerpt on one
   to break the tie.
3. Return STRICTLY this JSON shape and nothing else:
   {"picks": [{"slug": "...", "rationale": "..."}, ... exactly 3 items ...]}
"""

# Cross-region inference profile id for Claude Sonnet (eu-west-1 routes via the EU profile).
_MODEL_ID = "eu.anthropic.claude-sonnet-4-6"

# AgentCore Gateway exposes itself as a service named "bedrock-agentcore" for
# SigV4 signing purposes.
_GATEWAY_SERVICE = "bedrock-agentcore"


@dataclass
class Pick:
    slug: str
    rationale: str


@dataclass
class AgentPicks:
    picks: list[Pick]


def _build_mcp_client() -> MCPClient:
    gateway_url = os.environ["AGENTCORE_GATEWAY_URL"]
    return MCPClient(
        lambda: aws_iam_streamablehttp_client(
            endpoint=gateway_url,
            aws_service=_GATEWAY_SERVICE,
        )
    )


def _build_model() -> BedrockModel:
    # Cap Bedrock streaming reads so a stuck Sonnet response surfaces as a
    # botocore ReadTimeoutError after 60 s instead of holding the orchestrator's
    # Lambda invocation open until the 900 s ceiling.
    bedrock_cfg = BotoConfig(
        read_timeout=60,
        connect_timeout=10,
        retries={"max_attempts": 2, "mode": "standard"},
    )
    return BedrockModel(
        model_id=_MODEL_ID,
        temperature=0.0,
        streaming=False,
        boto_client_config=bedrock_cfg,
    )


class _MaxToolCallsExceeded(RuntimeError):
    """Raised inside the agent callback to abort an out-of-control tool loop."""


class _BoundedToolCallHandler:
    """Strands callback that counts tool invocations and aborts past a budget.

    Strands 1.40.0 has no max_iterations / max_tool_calls on the Agent
    constructor. Its callback handler receives every event the agent emits;
    tool-use events arrive as a `contentBlockStart` with a `toolUse` dict
    (verified against `strands/handlers/callback_handler.py` line 32).
    Raising from inside the handler aborts the agent.
    """

    def __init__(self, max_calls: int = 8):
        self._max = max_calls
        self._count = 0

    def __call__(self, **kwargs):
        tool_use = (
            kwargs.get("event", {})
            .get("contentBlockStart", {})
            .get("start", {})
            .get("toolUse")
        )
        if tool_use is None:
            return
        self._count += 1
        logger.info(
            "agent tool call",
            extra={"count": self._count, "tool": tool_use.get("name"), "max": self._max},
        )
        if self._count > self._max:
            raise _MaxToolCallsExceeded(
                f"agent exceeded {self._max} tool calls; aborting to avoid runaway loop"
            )


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)


def _strip_fences(raw: str) -> str:
    """Strip ```json …``` or ``` …``` markdown fences if present."""
    m = _JSON_FENCE_RE.search(raw)
    return m.group(1) if m else raw


def _extract_text(message) -> str:
    """Extract a JSON-text string from a Strands AgentResult.message.

    Strands 1.40+ shape: {"role": "assistant", "content": [{"text": "..."}, ...]}
    Raises ValueError if the message has no extractable text (e.g., only tool-use blocks).
    """
    if isinstance(message, str):
        return message
    if isinstance(message, dict):
        content = message.get("content")
        if isinstance(content, list):
            parts = [
                block["text"]
                for block in content
                if isinstance(block, dict) and "text" in block
            ]
            if parts:
                return "".join(parts)
            other_types = [
                block.get("type", "unknown") if isinstance(block, dict) else type(block).__name__
                for block in content
            ]
            raise ValueError(
                f"Agent message had no text content blocks; saw: {other_types}"
            )
    raise ValueError(f"Unsupported AgentResult.message shape: {type(message).__name__}")


def pick_related(
    source_slug: str,
    source_title: str,
    source_summary: str,
    language: str,
) -> AgentPicks:
    """Run the agent and parse its `{"picks": [...]}` JSON response."""
    mcp_client = _build_mcp_client()
    model = _build_model()
    user_msg = (
        f"source_slug: {source_slug}\n"
        f"source_title: {source_title}\n"
        f"source_summary: {source_summary}\n"
        f"language: {language}\n\n"
        "Pick 3 related posts."
    )

    with mcp_client:
        tools = mcp_client.list_tools_sync()
        agent = Agent(
            model=model,
            tools=tools,
            system_prompt=_SYSTEM_PROMPT,
            callback_handler=_BoundedToolCallHandler(max_calls=8),
        )
        try:
            result = agent(user_msg)
        except _MaxToolCallsExceeded as e:
            raise ValueError(f"agent exceeded tool-call budget: {e}") from e

    raw = _extract_text(getattr(result, "message", result))
    parsed = json.loads(_strip_fences(raw))
    picks_raw = parsed.get("picks", [])
    if len(picks_raw) != 3:
        raise ValueError(f"Agent must return exactly 3 picks, got {len(picks_raw)}")
    picks = [Pick(slug=p["slug"], rationale=p["rationale"]) for p in picks_raw]
    return AgentPicks(picks=picks)
