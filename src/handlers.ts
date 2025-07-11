import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { z } from "zod";
import { moderateToolOutput } from "./moderation.js";

/**
 * Creates a tool handler that wraps the original tool with moderation
 */
export async function createToolHandler(
  client: Client,
  originalToolName: string,
  apiKey?: string,
  enableGuardApi: boolean = false
) {
  return async (args: any) => {
    try {
      const result = await client.callTool({
        name: originalToolName,
        arguments: args,
      });

      return await moderateToolOutput(result, apiKey, enableGuardApi);
    } catch (error) {
      const errorResponse = {
        content: [
          {
            type: "text" as const,
            text: `Error executing tool: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };

      return await moderateToolOutput(errorResponse, apiKey, enableGuardApi);
    }
  };
}

/**
 * Creates a prompt handler (no moderation for prompts)
 */
export async function createPromptHandler(
  client: Client,
  originalPromptName: string,
  serverName: string
) {
  return async (args: any) => {
    try {
      const result = await client.getPrompt({
        name: originalPromptName,
        arguments: args,
      });

      // No moderation for prompts - pass through directly
      return result;
    } catch (error) {
      throw new Error(
        `Error executing prompt: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };
}

/**
 * Creates a resource handler (no moderation for resources)
 */
export async function createResourceHandler(
  client: Client,
  originalResourceUri: string,
  serverName: string
) {
  return async (uri: string) => {
    try {
      const result = await client.readResource({
        uri: originalResourceUri,
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
}

/**
 * Converts JSON Schema to Zod schema for MCP tool validation
 */
export function convertJsonSchemaToZod(jsonSchema: any): z.ZodRawShape {
  if (!jsonSchema || typeof jsonSchema !== "object") {
    return {};
  }

  const zodShape: z.ZodRawShape = {};

  // Handle object type with properties
  if (jsonSchema.type === "object" && jsonSchema.properties) {
    for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
      const prop = propSchema as any;

      // Convert property based on its type
      if (prop.type === "string") {
        zodShape[key] = z.string();
      } else if (prop.type === "number") {
        zodShape[key] = z.number();
      } else if (prop.type === "integer") {
        zodShape[key] = z.number().int();
      } else if (prop.type === "boolean") {
        zodShape[key] = z.boolean();
      } else if (prop.type === "array") {
        zodShape[key] = z.array(z.any());
      } else if (prop.type === "object") {
        zodShape[key] = z.object(convertJsonSchemaToZod(prop));
      } else {
        zodShape[key] = z.any();
      }

      // Handle optional properties
      if (!jsonSchema.required || !jsonSchema.required.includes(key)) {
        zodShape[key] = zodShape[key].optional();
      }
    }
  }

  // If no properties or not an object, return empty shape (accepts any input)
  return zodShape;
} 