import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Resultado de tool com o dado em JSON. Corpo vazio da API vira texto explícito.
 * Erros não precisam de tratamento nas tools: o cliente lança `SolidesApiError`
 * com mensagem em pt-BR e o SDK devolve isso como erro de tool (`isError`).
 */
export function jsonResult(data: unknown): CallToolResult {
  const text = data === undefined ? "A Sólides respondeu sem conteúdo." : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}
