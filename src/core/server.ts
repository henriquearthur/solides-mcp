import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SolidesClient } from "./client.js";
import { toolModules } from "./tools/index.js";

export interface SolidesServerConfig {
  /** Token de API da Empresa. */
  token: string;
  /** Escrita permitida (registrar/excluir Ocorrências). */
  allowWrites: boolean;
  /** `fetch` injetável; nos testes é falso. Padrão: o `fetch` global. */
  fetch?: typeof fetch;
  /** Mensagem do 401, que muda por entrada (stdio cita SOLIDES_API_TOKEN). */
  unauthorizedMessage?: string;
}

export function createSolidesServer(config: SolidesServerConfig): McpServer {
  const server = new McpServer({ name: "solides-mcp", version: "0.1.0" });
  const client = new SolidesClient({
    token: config.token,
    allowWrites: config.allowWrites,
    fetch: config.fetch ?? globalThis.fetch,
    unauthorizedMessage: config.unauthorizedMessage,
  });
  for (const register of toolModules) {
    register({ server, client, allowWrites: config.allowWrites });
  }
  return server;
}
