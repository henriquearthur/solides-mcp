import { afterEach, describe, expect, it } from "vitest";
import { incompleteWarning } from "../src/core/pages.js";
import { resume, resumeJoao, resumeMaria, resumes } from "./fixtures/resumes.js";
import type { RecordedRequest } from "./helpers/fake-fetch.js";
import { connect, textOf, type TestHarness } from "./helpers/mcp.js";

let h: TestHarness;
afterEach(async () => {
  await h?.close();
});

async function getResumes(args: Record<string, unknown> = {}) {
  return h.client.callTool({ name: "get_resumes", arguments: args });
}

/** Rota que devolve `pages[page - 1]` e `[]` depois da última página. */
function paged(pages: unknown[][]) {
  return (req: RecordedRequest) => pages[Number(req.query.page ?? "1") - 1] ?? [];
}

describe("get_resumes: lista", () => {
  it("busca GET /curriculos com datas em dd/mm/aaaa, ocultar_foto=SIM e page=1", async () => {
    h = await connect({ "GET /curriculos": [resumeMaria] });

    const result = await getResumes({ from: "2026-01-05", until: "2026-10-20" });

    expect(result.isError).toBeFalsy();
    expect(h.requests[0]).toMatchObject({
      method: "GET",
      host: "app.solides.com",
      path: "/curriculos",
      query: { data_inicial: "05/01/2026", data_final: "20/10/2026", ocultar_foto: "SIM", page: "1" },
    });
  });

  it("não envia data_inicial nem data_final quando não há intervalo", async () => {
    h = await connect({ "GET /curriculos": [] });

    await getResumes();

    expect(h.requests[0]?.query).toEqual({ ocultar_foto: "SIM", page: "1" });
  });

  it("resume cada item (identificação e contato principal) e mantém os nomes de campo da API", async () => {
    h = await connect({ "GET /curriculos": paged([[resumeMaria, resumeJoao]]) });

    const page = JSON.parse(textOf(await getResumes()));

    expect(page).toEqual({
      total: 2,
      limit: 50,
      offset: 0,
      items: [
        {
          id: 1,
          fullName: "Maria de Fátima Souza",
          idNumber: "01234567890",
          mainEmail: "maria@example.com.br",
          mobile: "(31) 999999999",
          phone: "(31) 33333333",
          seniority: "Trainee",
          origin: "Banco de talentos",
        },
        {
          id: 2,
          fullName: "João Pereira",
          idNumber: "98765432100",
          mainEmail: "joao@example.com.br",
          mobile: "(11) 988887777",
          phone: "(31) 33333333",
          seniority: "Trainee",
          origin: "Banco de talentos",
        },
      ],
    });
  });

  it("campos ausentes viram null", async () => {
    h = await connect({ "GET /curriculos": paged([[{ id: 7 }]]) });

    const page = JSON.parse(textOf(await getResumes()));

    expect(page.items[0]).toEqual({
      id: 7,
      fullName: null,
      idNumber: null,
      mainEmail: null,
      mobile: null,
      phone: null,
      seniority: null,
      origin: null,
    });
  });

  it("o resumo é menor que o Currículo completo", async () => {
    h = await connect({ "GET /curriculos": paged([[resumeMaria]]) });

    const text = textOf(await getResumes());

    expect(text.length).toBeLessThan(JSON.stringify(resumeMaria, null, 2).length);
    expect(text).not.toContain("professionalExperiences");
  });

  it("percorre as páginas até uma página vazia", async () => {
    h = await connect({ "GET /curriculos": paged([resumes(1, 3), resumes(4, 3), resumes(7, 1)]) });

    const page = JSON.parse(textOf(await getResumes({ limit: 200 })));

    expect(page.total).toBe(7);
    expect(page).not.toHaveProperty("incomplete");
    expect(page).not.toHaveProperty("warning");
    expect(page.items.map((r: { id: number }) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(h.requests.map((r) => r.query.page)).toEqual(["1", "2", "3", "4"]);
  });

  it("para quando a API ignora `page` e repete a mesma página, sem duplicar itens", async () => {
    h = await connect({ "GET /curriculos": [resumeMaria, resumeJoao] });

    const page = JSON.parse(textOf(await getResumes()));

    expect(page.total).toBe(2);
    expect(page).not.toHaveProperty("incomplete");
    expect(h.requests.map((r) => r.query.page)).toEqual(["1", "2"]);
  });

  it("aplica limit e offset sobre os Currículos já reunidos", async () => {
    h = await connect({ "GET /curriculos": paged([resumes(1, 5), resumes(6, 5)]) });

    const page = JSON.parse(textOf(await getResumes({ limit: 3, offset: 4 })));

    expect(page).toMatchObject({ total: 10, limit: 3, offset: 4 });
    expect(page.items.map((r: { id: number }) => r.id)).toEqual([5, 6, 7]);
  });

  it("no teto de 40 páginas para e avisa que o resultado está incompleto", async () => {
    h = await connect({ "GET /curriculos": (req: RecordedRequest) => resumes((Number(req.query.page) - 1) * 2 + 1, 2) });

    const page = JSON.parse(textOf(await getResumes()));

    expect(h.requests).toHaveLength(40);
    expect(page.total).toBe(80);
    expect(page.incomplete).toBe(true);
    expect(page.warning).toBe(incompleteWarning());
  });

  it("não avisa quando a última página permitida é a última da API", async () => {
    const pages = Array.from({ length: 39 }, (_, i) => resumes(i * 2 + 1, 2));
    h = await connect({ "GET /curriculos": paged(pages) });

    const page = JSON.parse(textOf(await getResumes()));

    expect(page).not.toHaveProperty("incomplete");
    expect(page).not.toHaveProperty("warning");
    expect(page.total).toBe(78);
  });

  it("devolve o corpo vazio da API sem paginar", async () => {
    h = await connect({ "GET /curriculos": { status: 200 } });

    const result = await getResumes();

    expect(textOf(result)).toBe("A Sólides respondeu sem conteúdo.");
    expect(h.requests).toHaveLength(1);
  });

  it("propaga erro da API no meio do percurso como erro de tool", async () => {
    h = await connect({
      "GET /curriculos": (req: RecordedRequest) => (req.query.page === "1" ? resumes(1, 2) : { status: 503 }),
    });

    const result = await getResumes();

    expect(result.isError).toBe(true);
  });

  it("rejeita data fora do formato ISO sem chamar a API", async () => {
    h = await connect({});

    const result = await getResumes({ from: "05/01/2026" });

    expect(result.isError).toBe(true);
    expect(h.requests).toHaveLength(0);
  });
});

describe("get_resumes: detalhe", () => {
  it("com id busca GET /curriculos/{id} e devolve o Currículo completo", async () => {
    const full = resume({ id: 5 });
    h = await connect({ "GET /curriculos/5": full });

    const result = await getResumes({ id: 5 });

    expect(JSON.parse(textOf(result))).toEqual(full);
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ method: "GET", path: "/curriculos/5" });
  });

  it("devolve 404 como erro de tool em pt-BR", async () => {
    h = await connect({ "GET /curriculos/99": { status: 404 } });

    const result = await getResumes({ id: 99 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("Registro não encontrado na Sólides.");
  });
});

describe("get_resumes: tool", () => {
  it("é readOnlyHint", async () => {
    h = await connect({});

    const { tools } = await h.client.listTools();

    expect(tools.find((t) => t.name === "get_resumes")?.annotations?.readOnlyHint).toBe(true);
  });
});
