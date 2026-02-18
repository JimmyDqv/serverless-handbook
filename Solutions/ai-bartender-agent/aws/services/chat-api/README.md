# AI Bartender - Chat API

Streaming chat endpoint for the AI bartender agent. Delivers token-by-token responses via Server-Sent Events (SSE) for a ChatGPT-like typing experience.

![Chat Architecture](../../../docs/images/architecture-chat.png)

## How Streaming Works

Lambda response streaming is natively only available for Node.js. This stack uses [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter) to bridge Python/FastAPI with Lambda's streaming API:

1. API Gateway receives POST `/chat` with `responseTransferMode: "STREAM"`
2. Lambda Web Adapter starts FastAPI on port 8080
3. FastAPI returns a `StreamingResponse` (SSE chunks)
4. Adapter pipes chunks back through Lambda's streaming API
5. API Gateway streams to the client in real-time

Key environment variables that enable this:

```yaml
AWS_LAMBDA_EXEC_WRAPPER: /opt/bootstrap    # Use adapter as entry point
PORT: 8080                                  # FastAPI listens here
AWS_LWA_INVOKE_MODE: RESPONSE_STREAM       # Enable chunked transfer
```

## Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/chat` | Streaming SSE response (primary) |
| POST | `/chat/sync` | Non-streaming fallback |

### Request

```json
{
  "message": "Recommend a gin cocktail",
  "session_id": "optional-session-id"
}
```

### Response (SSE stream)

```text
data: {"chunk": "I", "sessionId": "abc-123"}
data: {"chunk": "'d", "sessionId": "abc-123"}
data: {"chunk": " recommend", "sessionId": "abc-123"}
...
data: {"done": true, "sessionId": "abc-123"}
```

## Agent Stack

The streaming Lambda uses:

- **Strands Agents** - Agentic loop (prompt -> LLM -> tool call -> result -> repeat)
- **Amazon Bedrock Nova 2 Lite** - Fast, cost-effective LLM for drink recommendations
- **AgentCore Memory** - Persistent conversation history and user preference extraction
- **AgentCore Gateway** - MCP tools for querying the drink database

## Deployment

```bash
sam build && sam deploy
```

Requires the `agentcore` stack to be deployed first.
