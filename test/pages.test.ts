import { describe, expect, it } from "vitest";
import { incompleteWarning, MAX_API_PAGES, walkPages } from "../src/core/index.js";

/** API de mentira com `total` itens e `size` por página; o chamador decide como pedir a página. */
function fakeApi(total: number, size: number) {
  const calls: number[] = [];
  const fetchPage = async (page: number) => {
    calls.push(page);
    const first = (page - 1) * size;
    const count = Math.max(0, Math.min(size, total - first));
    return { rows: Array.from({ length: count }, (_, i) => first + i), more: first + size < total };
  };
  return { calls, fetchPage };
}

describe("walkPages", () => {
  it("o teto padrão fica abaixo das 50 subrequisições do Workers gratuito", () => {
    expect(MAX_API_PAGES).toBeLessThan(50);
  });

  it("percorre até a regra injetada de próxima página dizer que acabou", async () => {
    const api = fakeApi(25, 10);

    const result = await walkPages({
      fetchPage: api.fetchPage,
      getItems: (p) => p.rows,
      hasNext: (p) => p.more,
    });

    expect(result.items).toHaveLength(25);
    expect(result.pages).toBe(3);
    expect(result.incomplete).toBe(false);
    expect(api.calls).toEqual([1, 2, 3]);
  });

  it("para no teto informado e marca incompleto", async () => {
    const api = fakeApi(1000, 10);

    const result = await walkPages({
      fetchPage: api.fetchPage,
      getItems: (p) => p.rows,
      hasNext: (p) => p.more,
      maxPages: 5,
    });

    expect(api.calls).toHaveLength(5);
    expect(result.items).toHaveLength(50);
    expect(result.incomplete).toBe(true);
  });

  it("o aviso cita o teto", () => {
    expect(incompleteWarning(7)).toMatch(/incompleto.*7 páginas/);
  });
});
