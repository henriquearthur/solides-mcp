import { afterEach, describe, expect, it } from "vitest";
import { v1AdvancedEvaluations, v1PerformanceEvaluations } from "./fixtures/evaluations.js";
import { connect, textOf, type TestHarness } from "./helpers/mcp.js";

let h: TestHarness;
afterEach(async () => {
  await h?.close();
});

async function call(name: string, args: Record<string, unknown> = {}) {
  return h.client.callTool({ name, arguments: args });
}

describe("get_evaluations", () => {
  it("consulta as Avaliações de desempenho com as datas ISO convertidas para dd/mm/aaaa", async () => {
    h = await connect({ "GET /avaliacao_desempenhos": v1PerformanceEvaluations });

    const result = await call("get_evaluations", { type: "performance", from: "2024-03-09", to: "2024-12-31" });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({
      total: 1,
      limit: 50,
      offset: 0,
      items: v1PerformanceEvaluations,
    });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({
      method: "GET",
      host: "app.solides.com",
      path: "/avaliacao_desempenhos",
      query: { data_inicial: "09/03/2024", data_final: "31/12/2024" },
      headers: { authorization: "Token token=token-de-teste" },
    });
  });

  it("consulta as Avaliações avançadas em /avaliacao_avancadas", async () => {
    h = await connect({ "GET /avaliacao_avancadas": v1AdvancedEvaluations });

    const result = await call("get_evaluations", { type: "advanced", from: "2024-01-01", to: "2024-01-31" });

    expect(JSON.parse(textOf(result)).items).toEqual(v1AdvancedEvaluations);
    expect(h.requests[0]).toMatchObject({
      path: "/avaliacao_avancadas",
      query: { data_inicial: "01/01/2024", data_final: "31/01/2024" },
    });
  });

  it("pagina a lista com limit e offset", async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ evaluationId: i + 1 }));
    h = await connect({ "GET /avaliacao_desempenhos": many });

    const result = await call("get_evaluations", {
      type: "performance",
      from: "2024-01-01",
      to: "2024-01-31",
      limit: 3,
      offset: 2,
    });

    expect(JSON.parse(textOf(result))).toEqual({ total: 7, limit: 3, offset: 2, items: many.slice(2, 5) });
  });

  it("exige o intervalo de datas e rejeita datas fora de AAAA-MM-DD sem chamar a API", async () => {
    h = await connect({ "GET /avaliacao_desempenhos": v1PerformanceEvaluations });

    const missing = await call("get_evaluations", { type: "performance" });
    const invalid = await call("get_evaluations", { type: "performance", from: "01/01/2024", to: "2024-01-31" });

    expect(missing.isError).toBe(true);
    expect(invalid.isError).toBe(true);
    expect(h.requests).toHaveLength(0);
  });

  it("resposta sem corpo não quebra a tool", async () => {
    h = await connect({ "GET /avaliacao_desempenhos": { status: 200 } });

    const result = await call("get_evaluations", { type: "performance", from: "2024-01-01", to: "2024-01-31" });

    expect(result.isError).toBeFalsy();
  });

  it("é só leitura", async () => {
    h = await connect({});

    const { tools } = await h.client.listTools();

    expect(tools.find((t) => t.name === "get_evaluations")?.annotations?.readOnlyHint).toBe(true);
  });
});
