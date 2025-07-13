import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ServerConfig } from "./types.js";
import { createToolHandler, createPromptHandler, createResourceHandler, convertJsonSchemaToZod } from "./handlers.js";

// TODO: Add support for outputSchema

/**
 * Creates a client connection based on server configuration
 */
export async function createClientConnection(config: ServerConfig): Promise<Client> {
  const client = new Client({
    name: `wrapper-client-${config.name}`,
    version: "1.0.0",
  });

  // Check if this is a remote server configuration
  if ('url' in config) {

    // Remote server - try StreamableHTTP first, then fall back to SSE
    const baseUrl = new URL(config.url);
    
    try {
      const transport = new StreamableHTTPClientTransport(baseUrl);
      await client.connect(transport);
      return client;
    } catch (error) {
      try {
        const sseTransport = new SSEClientTransport(baseUrl);
        await client.connect(sseTransport);
        return client;
      } catch (sseError) {
        throw new Error(
          `Failed to connect to remote server ${config.url}: StreamableHTTP error: ${
            error instanceof Error ? error.message : String(error)
          }, SSE error: ${
            sseError instanceof Error ? sseError.message : String(sseError)
          }`
        );
      }
    }
  } else {
    // Stdio server configuration
    const serverEnv = {
      ...process.env,
      ...config.env,
    } as Record<string, string>;

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: serverEnv,
    });

    await client.connect(transport);
    return client;
  }
}

/**
 * Registers tools from a client to the main server
 */
export async function registerToolsForServer(
  client: Client, 
  serverName: string, 
  server: McpServer,
  apiKey?: string,
  enableGuardApi: boolean = false
) {
  const tools = await client.listTools();

  // Sanitize server name to replace spaces with underscores
  const sanitizedServerName = serverName.replace(/\s+/g, '_').toLowerCase();

  for (const tool of tools.tools) {
    const wrappedToolName = `${sanitizedServerName}_${tool.name}`;
    const toolHandler = await createToolHandler(client, tool.name, apiKey, enableGuardApi);

    server.registerTool(
      wrappedToolName,
      {
        title: wrappedToolName,
        description: tool.description || `Tool from ${serverName}`,
        inputSchema: convertJsonSchemaToZod(tool.inputSchema),
      } as any,
      toolHandler
    );
  }
}

/**
 * Registers prompts from a client to the main server
 */
export async function registerPromptsForServer(
  client: Client, 
  serverName: string, 
  server: McpServer
) {
  try {
    const prompts = await client.listPrompts();

    // Sanitize server name to replace spaces with underscores
    const sanitizedServerName = serverName.replace(/\s+/g, '_');

    for (const prompt of prompts.prompts) {
      const wrappedPromptName = `${sanitizedServerName}_${prompt.name}`;
      const promptHandler = await createPromptHandler(
        client,
        prompt.name,
        serverName
      );

      // Convert prompt arguments to Zod schema
      const argsSchema: z.ZodRawShape = {};
      if (prompt.arguments && Array.isArray(prompt.arguments)) {
        for (const arg of prompt.arguments) {
          if (arg.name) {
            argsSchema[arg.name] = z.string(); // Default to string, could be enhanced
            if (!arg.required) {
              argsSchema[arg.name] = argsSchema[arg.name].optional();
            }
          }
        }
      }

      server.registerPrompt(
        wrappedPromptName,
        {
          title: wrappedPromptName,
          description: prompt.description || `Prompt from ${serverName}`,
          argsSchema: argsSchema,
        } as any,
        promptHandler
      );
    }
  } catch (error) {
    // Silently handle errors - server may not support prompts
  }
}

/**
 * Registers resources from a client to the main server
 */
export async function registerResourcesForServer(
  client: Client, 
  serverName: string, 
  server: McpServer
) {
  try {
    const resources = await client.listResources();

    // Sanitize server name to replace spaces with underscores
    const sanitizedServerName = serverName.replace(/\s+/g, '_');

    for (const resource of resources.resources) {
      const wrappedResourceName = `${sanitizedServerName}_${
        resource.name || resource.uri
      }`;

      // Handle both static URIs and template URIs
      if (resource.uri.includes("{") && resource.uri.includes("}")) {
        // This is a resource template
        const resourceHandler = async (uri: any, params: any) => {
          try {
            const result = await client.readResource({
              uri: uri.href,
            });

            // No moderation for resources - pass through directly
            return result;
          } catch (error) {
            throw new Error(
              `Error reading resource: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        };

        server.registerResource(
          wrappedResourceName,
          new ResourceTemplate(resource.uri, { list: undefined }),
          {
            title: wrappedResourceName,
            description: resource.description || `Resource from ${serverName}`,
            mimeType: resource.mimeType,
          },
          resourceHandler
        );
      } else {
        // This is a static resource
        const resourceHandler = async (uri: any) => {
          try {
            const result = await client.readResource({
              uri: resource.uri,
            });

            // No moderation for resources - pass through directly
            return result;
          } catch (error) {
            throw new Error(
              `Error reading resource: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        };

        server.registerResource(
          wrappedResourceName,
          resource.uri,
          {
            title: wrappedResourceName,
            description: resource.description || `Resource from ${serverName}`,
            mimeType: resource.mimeType,
          },
          resourceHandler
        );
      }
    }
  } catch (error) {
    // Silently handle errors - server may not support resources
  }
}

/**
 * Connects to a server and registers all its capabilities
 */
export async function connectToServer(
  config: ServerConfig, 
  clients: Map<string, Client>, 
  server: McpServer,
  apiKey?: string,
  enableGuardApi: boolean = false
) {
  try {
    const client = await createClientConnection(config);
    clients.set(config.name, client);

    // Register all types of MCP capabilities
    await registerToolsForServer(client, config.name, server, apiKey, enableGuardApi);
    await registerPromptsForServer(client, config.name, server);
    await registerResourcesForServer(client, config.name, server);
  } catch (error) {
    // Log connection errors for debugging while still handling them gracefully
    console.error(`Failed to connect to server ${config.name}:`, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Connects to all configured servers
 */
export async function connectToAllServers(
  serverConfigs: ServerConfig[], 
  clients: Map<string, Client>, 
  server: McpServer,
  apiKey?: string,
  enableGuardApi: boolean = false
) {
  for (const config of serverConfigs) {
    await connectToServer(config, clients, server, apiKey, enableGuardApi);
  }
} 