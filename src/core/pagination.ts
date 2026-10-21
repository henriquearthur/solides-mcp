import { z } from "zod";

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

/** Parâmetros `limit` e `offset` das tools de lista. Espalhe no `inputSchema`. */
export const paginationInput = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .optional()
    .describe(`Quantidade máxima de registros na página (padrão ${DEFAULT_LIMIT}, máximo ${MAX_LIMIT}).`),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Quantos registros pular, para pedir a página seguinte (padrão 0)."),
};

export interface Page<T> {
  /** Total de registros depois dos filtros, não só os da página. */
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

/** Fatia `items` (já filtrados) na página pedida; `total` é o tamanho de `items`. */
export function paginate<T>(
  items: readonly T[],
  { limit, offset }: { limit?: number | undefined; offset?: number | undefined } = {},
): Page<T> {
  const pageLimit = limit ?? DEFAULT_LIMIT;
  const pageOffset = offset ?? 0;
  return {
    total: items.length,
    limit: pageLimit,
    offset: pageOffset,
    items: items.slice(pageOffset, pageOffset + pageLimit),
  };
}
