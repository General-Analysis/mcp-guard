#!/usr/bin/env node

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import dotenv from "dotenv";
import { z } from "zod";

import { ServerConfigSchema, ServerConfig } from "./types.js";
import { connectToAllServers } from "./client.js";

dotenv.config();

// Define the configuration schema for Smithery
const configSchema = z.object({
  servers: z.array(ServerConfigSchema)
    .default([])
    .describe(
      "Array of MCP server configurations to aggregate. Each server can be either a local server (with command and args) or a remote server (with URL)."
    ),
  apiKey: z.string()
    .optional()
    .describe(
      "API key for General Analysis moderation service. Required when enableGuardApi is true. Can also be set via API_KEY environment variable."
    ),
  enableGuardApi: z.boolean()
    .default(false)
    .describe(
      "Enable AI-powered moderation for tool outputs to prevent prompt injection attacks. Requires a valid apiKey."
    ),
})
  .describe(
    "Configuration for MCP Guard - a security layer that aggregates multiple MCP servers with optional AI-powered moderation"
  );

// Export the config schema for Smithery validation
export { configSchema };

// Export default function for Smithery
export default function ({ config }: { config: z.infer<typeof configSchema> }) {
  const server = new McpServer(
    {
      name: "General-Analysis-MCP-Guard",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    }
  );

  const clients = new Map<string, Client>();

  const API_KEY = config.apiKey || process.env.API_KEY;
  const ENABLE_GUARD_API = config.enableGuardApi || process.env.ENABLE_GUARD_API === "true";

  // Sanitize server configs
  const serverConfigs = config.servers.map((serverConfig) => {
    // Handle command parsing for configurations that have the entire command in the command field
    if ('command' in serverConfig && serverConfig.command && (!serverConfig.args || serverConfig.args.length === 0)) {
      // Split the command into command and args
      const commandParts = serverConfig.command.split(/\s+/);
      if (commandParts.length > 1) {
        serverConfig.command = commandParts[0];
        serverConfig.args = commandParts.slice(1);
      }
    }
    
    // Sanitize server name to remove spaces and make lowercase
    return {
      ...serverConfig,
      name: serverConfig.name.replace(/\s+/g, '').toLowerCase()
    };
  });

  // Validate configuration before connecting
  if (ENABLE_GUARD_API && !API_KEY) {
    throw new Error(
      "ENABLE_GUARD_API is true but API_KEY environment variable is not set"
    );
  }

  // Register a status tool that's always available
  // This ensures the server always has at least one tool and provides useful information
  server.registerTool(
    "mcp_guard_status",
    {
      title: "MCP Guard Status",
      description: "Get the current status of the MCP Guard, including connected servers and moderation state",
      inputSchema: {},
    },
    async () => {
      const connectedServers = Array.from(clients.keys());
      const status = {
        guard: "General Analysis MCP Guard",
        version: "1.0.0",
        moderation: {
          enabled: ENABLE_GUARD_API,
          hasApiKey: !!API_KEY
        },
        servers: {
          configured: serverConfigs.length,
          connected: connectedServers.length,
          names: connectedServers
        }
      };
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(status, null, 2)
        }]
      };
    }
  );

  // Register a guard info prompt that's always available
  // This ensures the server always has at least one prompt
  server.registerPrompt(
    "mcp_guard_info",
    {
      title: "MCP Guard Information",
      description: "Get information about the MCP Guard and how to use it effectively",
      argsSchema: {
        topic: z.enum(["overview", "moderation", "configuration", "troubleshooting"])
          .optional()
          .describe("Specific topic to get information about")
      },
    },
    ({ topic }) => {
      const topics = {
        overview: "The MCP Guard acts as a security layer that aggregates multiple MCP servers and provides AI-powered moderation for tool outputs to prevent prompt injection attacks.",
        moderation: ENABLE_GUARD_API 
          ? "Moderation is ENABLED. Tool outputs are being checked for prompt injection attempts using the General Analysis API."
          : "Moderation is DISABLED. Enable it by setting enableGuardApi to true and providing an API key.",
        configuration: `Current configuration:
- Configured servers: ${serverConfigs.map(s => s.name).join(", ") || "none"}
- Connected servers: ${Array.from(clients.keys()).join(", ") || "none"}
- Moderation enabled: ${ENABLE_GUARD_API}
- API key configured: ${!!API_KEY}`,
        troubleshooting: `Common issues:
1. "Method not found" - The guard is still connecting to servers. Use mcp_guard_status tool to check connection status.
2. Moderation not working - Ensure you have a valid API key and enableGuardApi is set to true.`
      };
      
      const content = topic ? topics[topic] : Object.entries(topics).map(([key, value]) => `${key.toUpperCase()}:\n${value}`).join("\n\n");
      
      return {
        messages: [{
          role: "assistant",
          content: {
            type: "text",
            text: content
          }
        }]
      };
    }
  );

  // Register a guard documentation resource that's always available
  // This ensures the server always has at least one resource
  server.registerResource(
    "mcp_guard_readme",
    "mcp-guard://readme",
    {
      title: "MCP Guard Documentation",
      description: "Documentation about the MCP Guard and its features",
      mimeType: "text/markdown"
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: "text/markdown",
        text: `# MCP Guard Documentation

## Overview
The MCP Guard is a security layer that aggregates multiple MCP servers and provides AI-powered moderation for tool outputs.

## Features
- **Server Aggregation**: Connect to multiple MCP servers simultaneously
- **AI Moderation**: Detect and block prompt injection attempts in tool outputs
- **Dynamic Registration**: Servers and their capabilities are added as they connect
- **Transparent Proxying**: All tools, prompts, and resources are prefixed with server names

## Current Status
- Moderation: ${ENABLE_GUARD_API ? "ENABLED" : "DISABLED"}
- Configured Servers: ${serverConfigs.length}
- Connected Servers: ${clients.size}

## Usage
1. Use the \`mcp_guard_status\` tool to check connection status
2. Use the \`mcp_guard_info\` prompt to get detailed information
3. Access this resource for documentation

## Troubleshooting
If you're seeing "Method not found" errors, the guard may still be connecting to servers. Check the status tool for current connections.
`
      }]
    })
  );

  // Connect to all servers asynchronously
  // Servers will be added dynamically as they connect
  connectToAllServers(serverConfigs, clients, server, API_KEY, ENABLE_GUARD_API)
    .catch(error => {
      console.error("Failed to connect to servers:", error);
    });

  return server;
}

// Legacy CLI support - only run if this file is executed directly
function getServerConfigs(): ServerConfig[] {
  if (process.argv.length < 3) {
    throw new Error("No server configs provided");
  }

  const serverConfigsList = JSON.parse(process.argv[2]);

  if (!Array.isArray(serverConfigsList)) {
    throw new Error("Server configs must be an array");
  }

  const serverConfigs = serverConfigsList.map((config: any) => {
    // Handle command parsing for configurations that have the entire command in the command field
    if (config.command && (!config.args || config.args.length === 0)) {
      // Split the command into command and args
      const commandParts = config.command.split(/\s+/);
      if (commandParts.length > 1) {
        config.command = commandParts[0];
        config.args = commandParts.slice(1);
      }
    }
    
    const parsedConfig = ServerConfigSchema.parse(config);
    // Sanitize server name to remove spaces and make lowercase
    return {
      ...parsedConfig,
      name: parsedConfig.name.replace(/\s+/g, '').toLowerCase()
    };
  });
  return serverConfigs;
}

async function startWrapperServer(server: McpServer) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function main() {
  // Create server instance for CLI mode
  const server = new McpServer(
    {
      name: "General-Analysis-MCP-Guard",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    }
  );

  const clients = new Map<string, Client>();
  const API_KEY = process.env.API_KEY;
  const ENABLE_GUARD_API = process.env.ENABLE_GUARD_API === "true";

  if (ENABLE_GUARD_API && !API_KEY) {
    throw new Error(
      "ENABLE_GUARD_API is true but API_KEY environment variable is not set"
    );
  }

  const serverConfigs = getServerConfigs();

  // Register status tool for CLI mode
  server.registerTool(
    "mcp_guard_status",
    {
      title: "MCP Guard Status",
      description: "Get the current status of the MCP Guard, including connected servers and moderation state",
      inputSchema: {},
    },
    async () => {
      const connectedServers = Array.from(clients.keys());
      const status = {
        guard: "General Analysis MCP Guard",
        version: "1.0.0",
        moderation: {
          enabled: ENABLE_GUARD_API,
          hasApiKey: !!API_KEY
        },
        servers: {
          connected: connectedServers.length,
          names: connectedServers
        }
      };
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(status, null, 2)
        }]
      };
    }
  );

  // Register guard info prompt for CLI mode
  server.registerPrompt(
    "mcp_guard_info",
    {
      title: "MCP Guard Information",
      description: "Get information about the MCP Guard and how to use it effectively",
      argsSchema: {
        topic: z.enum(["overview", "moderation", "configuration", "troubleshooting"])
          .optional()
          .describe("Specific topic to get information about")
      },
    },
    ({ topic }) => {
      const topics = {
        overview: "The MCP Guard acts as a security layer that aggregates multiple MCP servers and provides AI-powered moderation for tool outputs to prevent prompt injection attacks.",
        moderation: ENABLE_GUARD_API 
          ? "Moderation is ENABLED. Tool outputs are being checked for prompt injection attempts using the General Analysis API."
          : "Moderation is DISABLED. Enable it by setting ENABLE_GUARD_API=true and providing an API_KEY.",
        configuration: `Current configuration:
- Configured servers: ${serverConfigs.map(s => s.name).join(", ") || "none"}
- Connected servers: ${Array.from(clients.keys()).join(", ") || "none"}
- Moderation enabled: ${ENABLE_GUARD_API}
- API key configured: ${!!API_KEY}`,
        troubleshooting: `Common issues:
1. "Method not found" - The guard is still connecting to servers. Use mcp_guard_status tool to check connection status.
2. No tools showing - Check if your server configurations are correct and the servers are accessible.
3. Moderation not working - Ensure you have a valid API_KEY environment variable and ENABLE_GUARD_API is set to true.`
      };
      
      const content = topic ? topics[topic] : Object.entries(topics).map(([key, value]) => `${key.toUpperCase()}:\n${value}`).join("\n\n");
      
      return {
        messages: [{
          role: "assistant",
          content: {
            type: "text",
            text: content
          }
        }]
      };
    }
  );

  // Register guard documentation resource for CLI mode
  server.registerResource(
    "mcp_guard_readme",
    "mcp-guard://readme",
    {
      title: "MCP Guard Documentation",
      description: "Documentation about the MCP Guard and its features",
      mimeType: "text/markdown"
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: "text/markdown",
        text: `# MCP Guard Documentation

## Overview
The MCP Guard is a security layer that aggregates multiple MCP servers and provides AI-powered moderation for tool outputs.

## Features
- **Server Aggregation**: Connect to multiple MCP servers simultaneously
- **AI Moderation**: Detect and block prompt injection attempts in tool outputs
- **Dynamic Registration**: Servers and their capabilities are added as they connect
- **Transparent Proxying**: All tools, prompts, and resources are prefixed with server names

## Current Status
- Moderation: ${ENABLE_GUARD_API ? "ENABLED" : "DISABLED"}
- Configured Servers: ${serverConfigs.length}
- Connected Servers: ${clients.size}

## Usage
1. Use the \`mcp_guard_status\` tool to check connection status
2. Use the \`mcp_guard_info\` prompt to get detailed information
3. Access this resource for documentation

## Troubleshooting
If you're seeing "Method not found" errors, the guard may still be connecting to servers. Check the status tool for current connections.
`
      }]
    })
  );

  await connectToAllServers(serverConfigs, clients, server, API_KEY, ENABLE_GUARD_API);

  await startWrapperServer(server);
}

// Only run main if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
