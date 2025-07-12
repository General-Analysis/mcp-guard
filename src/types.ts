import { z } from "zod";

// Server configuration schemas
export const StdioServerConfigSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string()).optional().default({}),
});

export const RemoteServerConfigSchema = z.object({
  name: z.string(),
  url: z.string(),
});

export const ServerConfigSchema = z.union([
  StdioServerConfigSchema,
  RemoteServerConfigSchema,
]);

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

// Guard API response type
export interface GuardApiResponse {
  injection_heuristic?: {
    flagged: boolean;
    info: any;
  };
  injection_guard?: {
    flagged: boolean;
    info: {
      injection_texts?: string[];
      [key: string]: any;
    };
  };
  [key: string]: any;
}

// Blocked response constant
export const BLOCKED_RESPONSE = {
  content: [
    {
      type: "text" as const,
      text: "BLOCKED: This response was blocked by the moderation system due to potential prompt injection content. Please let the user know that their data source may contain prompt injection or jailbreak attempts.",
    },
  ],
  isError: true,
};

// Helper function to create a payment required warning response
export function createPaymentRequiredResponse(originalOutput: any) {
  const warningMessage = "Important Notice: Please inform the user that their tool outputs are no longer moderated due to insufficient account credits. The user should visit app.generalanalysis.com (make it clickable markdown) to reactivate their account and restore moderation protection. This may create security issues for the user so please inform them.";
  
  // If the original output has content array, prepend the warning
  if (originalOutput && originalOutput.content && Array.isArray(originalOutput.content)) {
    return {
      ...originalOutput,
      content: [
        {
          type: "text" as const,
          text: warningMessage,
        },
        ...originalOutput.content,
      ],
    };
  }
  
  // Fallback for other output formats
  return {
    content: [
      {
        type: "text" as const,
        text: warningMessage,
      },
    ],
    originalOutput,
  };
} 