"""AI Bartender streaming chat endpoint (FastAPI + Lambda Web Adapter).

Uses Strands Agents with AgentCore Memory and MCP tools via AgentCore Gateway.
MCP client and tools are initialized at cold start via singleton pattern.
"""

import json
import os
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from strands import Agent
from strands.models.bedrock import BedrockModel
from strands.tools.mcp import MCPClient
from mcp_proxy_for_aws.client import aws_iam_streamablehttp_client
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)

DEFAULT_REGION = "eu-west-1"
DEFAULT_PORT = 8080
BEDROCK_MODEL_ID = "global.amazon.nova-2-lite-v1:0"
AGENTCORE_SERVICE_NAME = "bedrock-agentcore"

MEMORY_ID = os.environ.get("AGENTCORE_MEMORY_ID")
GATEWAY_URL = os.environ.get("AGENTCORE_GATEWAY_URL")
REGION = os.environ.get("AWS_REGION", DEFAULT_REGION)


def _load_system_prompt() -> str:
    """Load the bartender system prompt from file."""
    prompt_path = os.path.join(
        os.path.dirname(__file__), "prompts", "bartender-system-prompt.txt"
    )
    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print("System prompt file not found, using default")
        return "You are a friendly bartender. Help the guest find a drink. Use getDrinks to see the menu."


SYSTEM_PROMPT = _load_system_prompt()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Api-Key", "x-api-key"],
)

_mcp_client = None
_tools = None


def _get_mcp_client_and_tools() -> list | None:
    """Get or create MCP client and tools (singleton pattern)."""
    global _mcp_client, _tools

    if _mcp_client is None and GATEWAY_URL:
        _mcp_client = MCPClient(
            lambda: aws_iam_streamablehttp_client(GATEWAY_URL, AGENTCORE_SERVICE_NAME)
        )
        _mcp_client.__enter__()
        _tools = _mcp_client.list_tools_sync()
        print(f"Cold start: MCP tools loaded, count={len(_tools)}")

    return _tools


def _create_model() -> BedrockModel:
    """Create Bedrock model configured for Nova 2 Lite with streaming."""
    return BedrockModel(
        model_id=BEDROCK_MODEL_ID,
        region_name=REGION,
    )


def _create_session_manager(session_id: str, actor_id: str) -> AgentCoreMemorySessionManager | None:
    """Create AgentCore Memory session manager."""
    if not MEMORY_ID:
        return None

    config = AgentCoreMemoryConfig(
        memory_id=MEMORY_ID,
        session_id=session_id,
        actor_id=actor_id,
    )

    return AgentCoreMemorySessionManager(
        agentcore_memory_config=config,
        region_name=REGION,
    )


@app.post("/chat")
async def chat(request: Request):
    """Streaming chat endpoint."""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid JSON body"},
        )

    message = body.get("message", "").strip()
    if not message:
        return JSONResponse(
            status_code=400,
            content={"error": "Message is required"},
        )

    session_id = body.get("session_id") or str(uuid.uuid4())
    actor_id = body.get("actor_id") or "anonymous"

    print(f"Processing message: session_id={session_id}, actor_id={actor_id}, message_length={len(message)}")

    async def stream_response():
        """Generator that yields SSE chunks."""
        try:
            tools = _get_mcp_client_and_tools()
            model = _create_model()
            session_manager = _create_session_manager(session_id, actor_id)

            agent_kwargs = {
                "model": model,
                "system_prompt": SYSTEM_PROMPT,
            }
            if tools:
                agent_kwargs["tools"] = tools
            if session_manager:
                agent_kwargs["session_manager"] = session_manager

            agent = Agent(**agent_kwargs)

            full_response = ""
            async for event in agent.stream_async(message):
                if isinstance(event, dict) and event.get("data"):
                    chunk = event["data"]
                    full_response += chunk
                    yield f"data: {json.dumps({'chunk': chunk, 'sessionId': session_id})}\n\n"

            yield f"data: {json.dumps({'done': True, 'sessionId': session_id, 'response': full_response})}\n\n"

            print(f"Chat response streamed: session_id={session_id}, response_length={len(full_response)}")

        except Exception as e:
            print(f"Error streaming response: {e}")
            yield f"data: {json.dumps({'error': str(e), 'sessionId': session_id})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-Id": session_id,
        },
    )


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", DEFAULT_PORT)))
