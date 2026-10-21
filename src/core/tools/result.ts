import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { paginate } from "../pagination.js";
import { incompleteWarning } from "../pages.js";

/**
 * Resultado de tool com o dado em JSON. Corpo vazio da API vira texto explícito.
 * Erros não precisam de tratamento nas tools: o cliente lança `SolidesApiError`
 * com mensagem em pt-BR e o SDK devolve isso como erro de tool (`isError`).
 */
export function jsonResult(data: unknown): CallToolResult {
  const text = data === undefined ? "A Sólides respondeu sem conteúdo." : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

/**
 * Página `{ total, limit, offset, items }` de uma lista que veio de uma API paginada. Quando o teto de
 * páginas foi atingido, acrescenta `incomplete: true` e `warning`; fora isso os dois campos não existem.
 */
export function pagedResult<T>(
  items: T[],
  incomplete: boolean,
  page: { limit?: number | undefined; offset?: number | undefined },
): CallToolResult {
  const paged = paginate(items, page);
  return jsonResult(incomplete ? { ...paged, incomplete: true, warning: incompleteWarning() } : paged);
}
