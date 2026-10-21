/**
 * Percorre as páginas de uma API até o fim, com um teto de páginas.
 *
 * O plano gratuito do Cloudflare Workers permite 50 subrequisições por chamada. O teto
 * fica abaixo disso para sobrar folga para outras chamadas da mesma requisição.
 * Genérico: o nome do parâmetro de página e a regra de "há próxima página" ficam por
 * conta de quem chama (V3 em `v3.ts`; Currículos usa `page` da V1).
 */

/** Máximo de páginas buscadas por chamada de tool (< 50 subrequisições do Workers gratuito). */
export const MAX_API_PAGES = 40;

export interface WalkPagesOptions<TPage, TItem> {
  /** Busca a página `page` (a primeira é 1). Aqui entra o nome do parâmetro de página. */
  fetchPage: (page: number) => Promise<TPage>;
  /** Itens de uma página. */
  getItems: (page: TPage) => readonly TItem[];
  /** Se há uma página depois de `page`. */
  hasNext: (page: TPage, pageNumber: number) => boolean;
  /** Padrão: `MAX_API_PAGES`. */
  maxPages?: number;
}

export interface WalkedPages<TItem> {
  items: TItem[];
  /** Quantas páginas foram buscadas. */
  pages: number;
  /** true quando o teto foi atingido e ainda havia mais páginas. */
  incomplete: boolean;
}

export async function walkPages<TPage, TItem>({
  fetchPage,
  getItems,
  hasNext,
  maxPages = MAX_API_PAGES,
}: WalkPagesOptions<TPage, TItem>): Promise<WalkedPages<TItem>> {
  const items: TItem[] = [];
  let pages = 0;
  let pageNumber = 1;
  for (;;) {
    const page = await fetchPage(pageNumber);
    pages += 1;
    items.push(...getItems(page));
    if (!hasNext(page, pageNumber)) return { items, pages, incomplete: false };
    if (pages >= maxPages) return { items, pages, incomplete: true };
    pageNumber += 1;
  }
}

/** Aviso em pt-BR que as tools anexam à resposta quando `incomplete` é true. */
export function incompleteWarning(maxPages: number = MAX_API_PAGES): string {
  return `Resultado incompleto: a Sólides tem mais registros do que o limite de ${maxPages} páginas por consulta. Restrinja a consulta com filtros para ver o restante.`;
}
