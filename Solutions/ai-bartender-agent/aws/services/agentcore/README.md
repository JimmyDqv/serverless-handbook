# AI Bartender - AgentCore

AgentCore Gateway (MCP tools), Memory (conversation persistence), and MCP tool Lambda functions. This stack provides the AI agent's ability to query the drink menu and remember user preferences.

## Components

### AgentCore Gateway

Hosts MCP (Model Context Protocol) tools that the chat agent can call. Uses `GATEWAY_IAM_ROLE` authentication - the chat Lambda assumes a role to invoke tools through the gateway.

**Available tools:**

| Tool | Description |
| ---- | ----------- |
| `getDrinks` | Fetch drinks from menu, optionally filtered by section |

Tool responses are optimized for LLM token efficiency - just drink names and ingredients, no images, IDs, or pagination metadata.

### AgentCore Memory

Stores conversation state across Lambda invocations:

- **Short-term** - Raw conversation events (messages, tool calls, responses). Configurable TTL.
- **Long-term** - `UserPreferenceMemoryStrategy` automatically extracts patterns like "user prefers gin" from conversations, stored per user in the `preferences/{actorId}` namespace.

### MCP Tools Lambda

Dedicated Lambda function that handles tool invocations from the gateway. Connects to Aurora DSQL with the reader role for database queries.

Example response from `getDrinks`:

```json
{
  "drinks": [
    {"name": "Negroni", "ingredients": "gin, Campari, sweet vermouth"},
    {"name": "Gin & Tonic", "ingredients": "gin, tonic water, lime"}
  ],
  "count": 2
}
```

## Why Separate MCP Tools?

The REST API returns full drink objects with images, pagination, and metadata - optimized for the frontend. MCP tools return minimal data - optimized for LLM token consumption. Keeping them separate avoids wasting tokens on data the LLM doesn't need.

## Deployment

```bash
sam build && sam deploy
```

Requires the `datastore` stack to be deployed first. Exports Gateway URL and Memory ID for the `chat-api` stack.
