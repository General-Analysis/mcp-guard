# MCP Guardrail

An MCP (Model Context Protocol) guardrail with built-in AI-powered moderation that aggregates multiple MCP servers into one secure interface.

## Overview

The MCP Guardrail provides AI-powered security and easy configuration for your MCP (Model Context Protocol) setup. It automatically detects your existing MCP configuration files and adds a protective layer with intelligent moderation capabilities.

Key features:

- **AI-powered moderation** to prevent prompt injection attacks
- **Automatic configuration** - CLI tool detects and updates MCP config files for Cursor, Claude Desktop, and Claude Code
- **Dual connectivity** - supports both local and remote MCP servers
- **Transparent proxying** - tools, prompts, and resources are automatically prefixed and made available

## Quick Start

The easiest way to get started is using the General Analysis CLI tool:

```bash
# Install the CLI tool
pip3 install generalanalysis

# Login to your account
ga login

# Configure MCP settings for Cursor, Claude Desktop, and Claude Code
ga configure
```

This will automatically update your MCP configuration files with the guardrail setup.

## Usage

### Direct Usage with npx

No installation required! Use directly in your Cursor or Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "protected_server": {
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
  "mcpServers": {
    "protected_server": {
      "command": "npx",
      "args": [
        "-y",
        "@general-analysis/mcp-guard",
        "[{\"name\":\"my-local-server\",\"command\":\"node\",\"args\":[\"path/to/server.js\"]}]"
      ],
      "env": {
        "API_KEY": "your-general-analysis-api-key",
        "ENABLE_GUARD_API": "true"
      }
    }
  }
}
```

#### Remote Servers (HTTP/SSE)

For remote MCP servers accessible via HTTP or Server-Sent Events:

```json
{
  "mcpServers": {
    "protected_server": {
      "command": "npx",
      "args": [
        "-y",
        "@general-analysis/mcp-guard",
        "[{\"name\":\"my-remote-server\",\"url\":\"https://api.example.com/mcp\"}]"
      ],
      "env": {
        "API_KEY": "your-general-analysis-api-key",
        "ENABLE_GUARD_API": "true"
      }
    }
  }
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


## Requirements

- Node.js >= 18.0.0
- Valid General Analysis API key (when moderation is enabled)

## License

MIT
