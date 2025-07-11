import { GuardApiResponse, BLOCKED_RESPONSE } from "./types.js";

// API Configuration
const API_URL = "https://api.generalanalysis.com";

/**
 * Moderates tool output using the Guard API to detect prompt injection attacks
 * @param output - The tool output to moderate
 * @param apiKey - The API key for the Guard API
 * @param enableGuardApi - Whether the Guard API is enabled
 * @returns The original output or a blocked response if harmful content is detected
 */
export async function moderateToolOutput(
  output: any,
  apiKey?: string,
  enableGuardApi: boolean = false
): Promise<any> {
  if (!output || !output.content || !Array.isArray(output.content)) {
    return output;
  }

  // Extract text content for moderation
  for (const contentItem of output.content) {
    if (contentItem.type === "text" && typeof contentItem.text === "string") {
      const text = contentItem.text;

      // Call guard API only if enabled and API key is provided
      if (enableGuardApi && apiKey) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

          const response = await fetch(API_URL + "/guard", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: text,
              policy_name: "@ga/mcp-injection",
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(
              `Guard API returned error: ${response.status} ${response.statusText}`
            );
          }

          const guardResult = (await response.json()) as GuardApiResponse;

          // Check if either heuristic or injection guard flagged the content
          const heuristicFlagged = guardResult.injection_heuristic?.flagged || false;
          const injectionGuardFlagged = guardResult.injection_guard?.flagged || false;

          if (heuristicFlagged || injectionGuardFlagged) {
            return BLOCKED_RESPONSE;
          }
        } catch (error) {
          throw new Error(
            `Guard API call failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }
  }

  return output;
} 