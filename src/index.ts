#!/usr/bin/env node

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import dotenv from "dotenv";

import { ServerConfigSchema, ServerConfig } from "./types.js";
import { connectToAllServers } from "./client.js";

dotenv.config();

const server = new McpServer(
  {
    name: "GA-MCP-GUARDRAIL",
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

// Always register a dummy prompt to ensure prompts endpoint exists
server.registerPrompt(
  "_guardrail_info",
  {
    title: "Guardrail Information",
    description: "Information about this MCP guardrail system",
    argsSchema: {},
  },
  async () => ({
    messages: [
      {
        role: "assistant",
        content: {
          type: "text",
          text: "This is the GA MCP Guardrail. It aggregates multiple MCP servers and provides AI-powered moderation for tool outputs to prevent prompt injection attacks.",
        },
      },
    ],
  })
);

// Always register a dummy resource to ensure resources endpoint exists
server.registerResource(
  "_guardrail_status",
  "guardrail://status",
  {
    title: "Guardrail Status",
    description: "Status information about connected servers and moderation",
  },
  async () => ({
    contents: [
      {
        uri: "guardrail://status",
        text: `GA MCP Guardrail Status\nConnected servers: ${
          clients.size
        }\nModeration: ${
          ENABLE_GUARD_API ? "Enabled" : "Disabled"
        }\nPurpose: AI-powered security for MCP tool outputs`,
      },
    ],
  })
);

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

async function startWrapperServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function main() {

  if (ENABLE_GUARD_API && !API_KEY) {
    throw new Error(
      "ENABLE_GUARD_API is true but API_KEY environment variable is not set"
    );
  }

  const serverConfigs = getServerConfigs();
  await connectToAllServers(serverConfigs, clients, server, API_KEY, ENABLE_GUARD_API);

  await startWrapperServer();
}

main().catch((error) => {
  process.exit(1);
});
