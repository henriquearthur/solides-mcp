import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SolidesClient } from "../client.js";

export interface ToolContext {
  server: McpServer;
  client: SolidesClient;
  /** Escrita permitida. Tools de escrita só são registradas quando true. */
  allowWrites: boolean;
}

/** Cada módulo de tools exporta uma função com esta assinatura. */
export type RegisterTools = (context: ToolContext) => void;
