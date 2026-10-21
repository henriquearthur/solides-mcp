import { afterEach, describe, expect, it } from "vitest";
import { manyProfilers, passportAna, passportBruno, profilerJose, profilerMaria } from "./fixtures/profiler.js";
import { connect, textOf, type TestHarness } from "./helpers/mcp.js";

let h: TestHarness;
afterEach(async () => {
  await h?.close();
});

async function call(name: string, args: Record<string, unknown> = {}) {
  return h.client.callTool({ name, arguments: args });
}

describe("get_profiler", () => {
  it("lista os Profilers de todos os Colaboradores, paginados no MCP", async () => {
    h = await connect({ "GET /profiler": [profilerMaria, profilerJose] });

    const result = await call("get_profiler");

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({
      total: 2,
      limit: 50,
      offset: 0,
      items: [profilerMaria, profilerJose],
    });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ method: "GET", host: "app.solides.com", path: "/profiler" });
  });

  it("respeita limit e offset e informa o total", async () => {
    h = await connect({ "GET /profiler": manyProfilers(120) });

    const page = JSON.parse(textOf(await call("get_profiler", { limit: 10, offset: 115 })));

    expect(page).toMatchObject({ total: 120, limit: 10, offset: 115 });
    expect(page.items.map((p: { id: number }) => p.id)).toEqual([116, 117, 118, 119, 120]);
  });

  it("com id busca GET /profiler/{id} do Colaborador e devolve o registro", async () => {
    h = await connect({ "GET /profiler/2": profilerJose });

    const result = await call("get_profiler", { id: 2 });

    expect(JSON.parse(textOf(result))).toEqual(profilerJose);
    expect(h.requests[0]).toMatchObject({ method: "GET", path: "/profiler/2" });
  });

  it("devolve o corpo vazio da API sem tentar paginar", async () => {
    h = await connect({ "GET /profiler": { status: 200 } });

    const result = await call("get_profiler");

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toBe("A Sólides respondeu sem conteúdo.");
  });

  it("devolve 404 como erro de tool em pt-BR", async () => {
    h = await connect({ "GET /profiler/99": { status: 404 } });

    const result = await call("get_profiler", { id: 99 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("Registro não encontrado na Sólides.");
  });
});

describe("get_passports", () => {
  it("lista os Passaportes (GET /candidatos), paginados", async () => {
    h = await connect({ "GET /candidatos": [passportAna, passportBruno] });

    const page = JSON.parse(textOf(await call("get_passports", { limit: 1 })));

    expect(page).toEqual({ total: 2, limit: 1, offset: 0, items: [passportAna] });
    expect(h.requests[0]).toMatchObject({ method: "GET", path: "/candidatos" });
  });

  it("com id detalha o Passaporte (GET /candidatos/{id})", async () => {
    h = await connect({ "GET /candidatos/10": passportAna });

    const result = await call("get_passports", { id: 10 });

    expect(JSON.parse(textOf(result))).toEqual(passportAna);
    expect(h.requests[0]).toMatchObject({ method: "GET", path: "/candidatos/10" });
  });

  it("com id e report_option obtém o relatório Profiler (GET /candidatos/{id}/relatorio/{option})", async () => {
    const report = { url: "https://system.solides.com/pt-BR/candidatos/relatorio/3781782783782743" };
    h = await connect({ "GET /candidatos/10/relatorio/3": report });

    const result = await call("get_passports", { id: 10, report_option: 3 });

    expect(JSON.parse(textOf(result))).toEqual(report);
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ method: "GET", path: "/candidatos/10/relatorio/3" });
  });

  it("recusa report_option sem id, antes de chamar a API", async () => {
    h = await connect({});

    const result = await call("get_passports", { report_option: 2 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("id");
    expect(h.requests).toHaveLength(0);
  });

  it("recusa report_option fora de 1 a 5", async () => {
    h = await connect({});

    const result = await call("get_passports", { id: 10, report_option: 6 });

    expect(result.isError).toBe(true);
    expect(h.requests).toHaveLength(0);
  });

  it("lista as opções de relatório na descrição", async () => {
    h = await connect({});

    const { tools } = await h.client.listTools();
    const description = tools.find((t) => t.name === "get_passports")?.description ?? "";

    for (const option of ["Simples 1", "Regular 2", "Estendido 3", "Coaching 4", "Feedback 5"]) {
      expect(description).toContain(option);
    }
  });
});

describe("anotações", () => {
  it("get_profiler e get_passports são readOnlyHint", async () => {
    h = await connect({});

    const { tools } = await h.client.listTools();

    for (const name of ["get_profiler", "get_passports"]) {
      expect(tools.find((t) => t.name === name)?.annotations?.readOnlyHint).toBe(true);
    }
  });
});
