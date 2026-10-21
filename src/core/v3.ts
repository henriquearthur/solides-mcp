import type { SolidesClient } from "./client.js";
import { SolidesApiError } from "./errors.js";
import { walkPages, type WalkedPages } from "./pages.js";

/**
 * Nome do parâmetro de página da V3. A spec não o documenta, só `meta.pagination`; o teste de
 * fumaça confirmou `page` na API real (20 itens por página).
 */
export const V3_PAGE_PARAM = "page";

export interface V3Pagination {
  current?: number | null;
  next?: number | null;
  pages?: number | null;
  total_count?: number | null;
}

/** Envelope das respostas V3. */
export interface V3Envelope<T> {
  data?: T[] | null;
  included?: unknown[];
  meta?: { pagination?: V3Pagination | null } | null;
}

/**
 * GET em todas as páginas de uma lista V3 (20 por página), juntando `data`.
 * Respeita o teto de páginas (`incomplete` quando atingido). Se a API devolver outra
 * página que a pedida (parâmetro de página ignorado), falha em vez de repetir a página 1.
 */
export function getAllV3Pages<T>(
  client: SolidesClient,
  path: string,
  options: { query?: Record<string, string | number | boolean | undefined>; maxPages?: number } = {},
): Promise<WalkedPages<T>> {
  return walkPages<V3Envelope<T>, T>({
    ...(options.maxPages === undefined ? {} : { maxPages: options.maxPages }),
    fetchPage: async (page) => {
      const envelope = await client.get<V3Envelope<T> | undefined>(path, {
        api: "v3",
        query: { ...options.query, [V3_PAGE_PARAM]: page },
      });
      const current = envelope?.meta?.pagination?.current;
      if (typeof current === "number" && current !== page) {
        throw new SolidesApiError(
          "unknown",
          "A Sólides não respeitou a página pedida na consulta V3. Tente novamente mais tarde.",
        );
      }
      return envelope ?? {};
    },
    getItems: (envelope) => (Array.isArray(envelope.data) ? envelope.data : []),
    hasNext: (envelope, page) => {
      const pagination = envelope.meta?.pagination;
      if (!pagination) return false;
      if (typeof pagination.next === "number") return true;
      return typeof pagination.pages === "number" && page < pagination.pages;
    },
  });
}
