# MCP Guardrail

An MCP (Model Context Protocol) guardrail with built-in AI-powered moderation that aggregates multiple MCP servers into one secure interface.

## Overview

The MCP Guardrail acts as a security layer that sits between your AI applications and MCP servers, providing:

- **AI-powered moderation** to prevent prompt injection attacks
- **Server aggregation** - connect to multiple MCP servers through a single interface
- **Dual connectivity** - supports both local and remote MCP servers
- **Transparent proxying** - tools, prompts, and resources are automatically prefixed and made available

## Usage

### Direct Usage with npx

No installation required! Use directly in your Cursor or Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "guardrail": {
      "command": "npx",
      "args": [
        "-y",
        "@general-analysis/mcp-guard",
        "[{\"name\":\"server1\",\"command\":\"path/to/server\",\"args\":[\"arg1\"]}]"
      ]
    }
  }
}
```

### Standalone Usage

```bash
npx -y @general-analysis/mcp-guard '[{"name":"server1","command":"path/to/server","args":["arg1"]}]'
```

### Configuration

#### Local Servers (Stdio)

For local MCP servers that communicate via stdio:

```json
{
  "name": "my-local-server",
  "command": "node",
  "args": ["path/to/server.js"],
  "env": {
    "API_KEY": "your-general-analysis-api-key"
  }
}
```

#### Remote Servers (HTTP/SSE)

For remote MCP servers accessible via HTTP or Server-Sent Events:

```json
{
  "name": "my-remote-server",
  "url": "https://api.example.com/mcp"
}
```

### Environment Variables

- `API_KEY` - Your General Analysis API key for the moderation service
- `ENABLE_GUARD_API` - Set to `"true"` to enable AI-powered moderation (requires API_KEY)

### Complete Example for Cursor/Claude Desktop

Add this to your MCP configuration file:

```json
{
  "mcpServers": {
    "guardrail": {
      "command": "npx",
      "args": [
        "-y",
        "@general-analysis/mcp-guard",
        "[{\"name\":\"local-filesystem\",\"command\":\"npx\",\"args\":[\"@modelcontextprotocol/server-filesystem\",\"/path/to/files\"]},{\"name\":\"remote-api\",\"url\":\"https://api.example.com/mcp\"}]"
      ],
      "env": {
        "API_KEY": "your-general-analysis-api-key",
        "ENABLE_GUARD_API": "true"
      }
    }
  }
}
```

### Standalone Command Line Example

```bash
# Set environment variables
export API_KEY="your-general-analysis-api-key"
export ENABLE_GUARD_API="true"

# Run with mixed local and remote servers
npx -y @general-analysis/mcp-guard '[
  {
    "name": "local-filesystem",
    "command": "npx",
    "args": ["@modelcontextprotocol/server-filesystem", "/path/to/files"]
  },
  {
    "name": "remote-api",
    "url": "https://api.example.com/mcp"
  }
]'
```

## How It Works

1. **Server Aggregation**: The guardrail connects to all configured MCP servers (both local and remote)
2. **Tool Prefixing**: Each tool is prefixed with the server name (e.g., `server1_tool_name`)
3. **Moderation**: When enabled, tool outputs are analyzed for potential prompt injection attempts
4. **Security**: Suspicious responses are blocked and replaced with a safety message

## Features

- **Local Server Support**: Connect to MCP servers running as local processes
- **Remote Server Support**: Connect to MCP servers via HTTP or SSE endpoints
- **AI Moderation**: Optional AI-powered content filtering to prevent prompt injection
- **Transparent Proxying**: All MCP capabilities (tools, prompts, resources) are preserved
- **Error Handling**: Graceful handling of connection failures and server errors

## Security

The guardrail provides multiple layers of security:

- **Input validation** using Zod schemas
- **Output moderation** to detect and block prompt injection attempts
- **Isolation** between different MCP servers
- **Safe defaults** when moderation is enabled

## Requirements

- Node.js >= 18.0.0
- Valid General Analysis API key (when moderation is enabled)

## License

MIT
