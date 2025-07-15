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

  if (ENABLE_GUARD_API && !API_KEY) {
    throw new Error(
      "ENABLE_GUARD_API is true but API_KEY environment variable is not set"
    );
  }

  const serverConfigs = getServerConfigs();
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
