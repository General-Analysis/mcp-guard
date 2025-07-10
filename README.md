# GA MCP Wrapper

An MCP server wrapper with built-in moderation that aggregates multiple MCP servers into one secure interface.

## Features

- **Multi-server aggregation**: Combine multiple MCP servers into a single interface
- **Full MCP support**: Tools, prompts, and resources from all connected servers
- **Built-in moderation**: Automatically filters potentially harmful content using AI-powered detection (tools only)
- **Zero setup**: Use directly with `npx` - no cloning or building required
- **MCP client compatible**: Works with Claude Desktop, Cline, and other MCP clients
- **Flexible configuration**: Support for various MCP server types and configurations
- **Environment-based settings**: Configurable API endpoints and security settings

## Quick Start

### Simple Usage (Like Supabase MCP)

Just use `npx` directly in your MCP client configuration:

```json
{
  "mcpServers": {
    "ga-mcp-wrapper": {
      "command": "npx",
      "args": [
        "-y",
        "ga-mcp-wrapper",
        "[{\"name\": \"supabase\", \"command\": \"npx\", \"args\": [\"-y\", \"@supabase/mcp-server-supabase@latest\", \"--access-token\", \"your-token\"]}]"
      ],
      "env": {
        "API_KEY": "your-ga-api-key",
        "ENABLE_GUARD_API": "true"
      }
    }
  }
}
```

### Command Line Usage

```bash
# Single server
npx ga-mcp-wrapper '[{"name": "supabase", "command": "npx", "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token", "your-token"]}]'

# Multiple servers
npx ga-mcp-wrapper '[
  {"name": "supabase", "command": "npx", "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token", "your-token"]},
  {"name": "filesystem", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem@latest", "/path/to/directory"]}
]'
```

## MCP Client Configuration Examples

### Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ga-mcp-wrapper": {
      "command": "npx",
      "args": [
        "-y",
        "ga-mcp-wrapper",
        "[{\"name\": \"supabase\", \"command\": \"npx\", \"args\": [\"-y\", \"@supabase/mcp-server-supabase@latest\", \"--access-token\", \"your-supabase-token\"]}]"
      ],
      "env": {
        "API_KEY": "your-ga-api-key",
        "ENABLE_GUARD_API": "true"
      }
    }
  }
}
```

### Cline VSCode Extension

```json
{
  "mcpServers": {
    "ga-mcp-wrapper": {
      "command": "npx",
      "args": [
        "-y",
        "ga-mcp-wrapper", 
        "[{\"name\": \"supabase\", \"command\": \"npx\", \"args\": [\"-y\", \"@supabase/mcp-server-supabase@latest\", \"--access-token\", \"your-supabase-token\"]}]"
      ],
      "env": {
        "API_KEY": "your-ga-api-key",
        "ENABLE_GUARD_API": "true"
      }
    }
  }
}
```

### Multiple Servers Example

```json
{
  "mcpServers": {
    "ga-mcp-wrapper-multi": {
      "command": "npx",
      "args": [
        "-y",
        "ga-mcp-wrapper",
        "[{\"name\": \"supabase\", \"command\": \"npx\", \"args\": [\"-y\", \"@supabase/mcp-server-supabase@latest\", \"--access-token\", \"your-supabase-token\"]}, {\"name\": \"filesystem\", \"command\": \"npx\", \"args\": [\"-y\", \"@modelcontextprotocol/server-filesystem@latest\", \"/Users/username/Documents\"]}]"
      ],
      "env": {
        "API_KEY": "your-ga-api-key",
        "ENABLE_GUARD_API": "true"
      }
    }
  }
}
```

## Configuration

### Environment Variables

**Required for moderation to work:**

```bash
# Required for moderation
API_KEY=your_ga_api_key_here
ENABLE_GUARD_API=true
```

⚠️ **Important**: If you set `ENABLE_GUARD_API=true` but don't provide an `API_KEY`, the wrapper will fail to start with an error.

Set these in your MCP client's `env` section:

### Server Configuration Format

The wrapper accepts a JSON array of server configurations:

```typescript
interface ServerConfig {
  name: string;           // Unique name for the server
  command: string;        // Command to run (usually "npx")
  args?: string[];        // Arguments for the command
  env?: Record<string, string>; // Environment variables
}
```

### Real-World Examples

#### Supabase with Read-Only Access
```json
{
  "name": "supabase",
  "command": "npx",
  "args": ["-y", "@supabase/mcp-server-supabase@latest", "--read-only", "--project-ref=your-project-ref"],
  "env": {
    "SUPABASE_ACCESS_TOKEN": "your-supabase-token"
  }
}
```

#### File System Server
```json
{
  "name": "filesystem",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem@latest", "/allowed/path"]
}
```

#### SQLite Server
```json
{
  "name": "sqlite",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-sqlite@latest", "/path/to/database.db"]
}
```

## How It Works

1. **Aggregation**: Connects to multiple MCP servers as configured
2. **Capability Discovery**: Discovers tools, prompts, and resources from all servers
3. **Prefixing**: Prefixes all capabilities with server name (e.g., `supabase_list_projects`)
4. **Moderation**: Analyzes tool outputs for potential security threats (prompts/resources pass through unmoderated)
5. **Blocking**: Automatically blocks tool responses containing prompt injection attempts
6. **Passthrough**: Safe content and all prompts/resources pass through unchanged

## Moderation System

The wrapper includes a built-in moderation system that:

- **Intercepts tool outputs only**: Analyzes tool responses before they reach the client (prompts and resources pass through unmoderated)
- **AI-powered detection**: Uses advanced heuristics and LLM analysis to detect prompt injection attempts
- **Blocks harmful content**: Returns a standardized blocked response for flagged tool outputs
- **Maintains protocol compatibility**: Ensures MCP protocol compliance even when blocking content
- **Configurable**: Can be enabled/disabled via environment variables

### Moderation Flow

1. Tool is called → 2. Response generated → 3. Content analyzed → 4. Safe content passed through OR harmful content blocked

## Supported MCP Servers

This wrapper works with any MCP-compatible server, including:

- `@supabase/mcp-server-supabase` - Supabase database operations
- `@modelcontextprotocol/server-filesystem` - File system operations
- `@modelcontextprotocol/server-fetch` - HTTP requests
- `@modelcontextprotocol/server-sqlite` - SQLite database operations
- Custom MCP servers

## Development

If you want to contribute or modify the wrapper:

```bash
git clone https://github.com/your-username/ga-mcp-wrapper.git
cd ga-mcp-wrapper
npm install
npm run build
npm test
```

## Security Considerations

- **API Key Protection**: Never commit API keys to version control
- **Environment Variables**: Use MCP client's `env` section for sensitive configuration
- **Access Tokens**: Rotate access tokens regularly
- **Network Security**: Ensure secure connections to all services

## API Reference

### Guard API

The moderation system uses the General Analysis Guard API:

- **Endpoint**: `https://api.generalanalysis.com/guard`
- **Method**: POST
- **Authentication**: Bearer token
- **Policy**: `@ga/mcp-injection` (prompt injection detection)

### Blocked Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "BLOCKED: This response was blocked by the moderation system due to potential prompt injection content."
    }
  ],
  "isError": true
}
```

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/your-username/ga-mcp-wrapper/issues)
- Documentation: [Wiki](https://github.com/your-username/ga-mcp-wrapper/wiki) 