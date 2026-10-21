import { afterEach, describe, expect, it } from "vitest";
import { cyclePages, v3Evaluation, v3Page, v3Pages } from "./fixtures/evaluations.js";
import { connect, textOf, type TestHarness } from "./helpers/mcp.js";

let h: TestHarness;
afterEach(async () => {
  await h?.close();
});

async function call(name: string, args: Record<string, unknown> = {}) {
  return h.client.callTool({ name, arguments: args });
}

describe("get_evaluation_cycles: ciclos V3", () => {
  it("lista os ciclos no host V3 com o mesmo header de autenticação", async () => {
    h = await connect({ "GET /evaluation/external_api/solicitations": cyclePages(2) });

    const result = await call("get_evaluation_cycles");

    expect(result.isError).toBeFalsy();
    const body = JSON.parse(textOf(result));
    expect(body.total).toBe(2);
    expect(body.items.map((c: { id: number }) => c.id)).toEqual([1, 2]);
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({
      method: "GET",
      host: "apigw.solides.com.br",
      path: "/evaluation/external_api/solicitations",
      headers: { authorization: "Token token=token-de-teste" },
    });
  });

  it("percorre as páginas V3 (20 por vez) até o fim", async () => {
    h = await connect({ "GET /evaluation/external_api/solicitations": cyclePages(45) });

    const result = await call("get_evaluation_cycles", { limit: 100 });

    const body = JSON.parse(textOf(result));
    expect(body.total).toBe(45);
    expect(body.items).toHaveLength(45);
    expect(body.incomplete).toBeUndefined();
    expect(body.warning).toBeUndefined();
    expect(h.requests.map((r) => r.query["page"])).toEqual(["1", "2", "3"]);
    expect(h.requests.every((r) => r.host === "apigw.solides.com.br")).toBe(true);
  });

  it("para no teto de páginas e avisa que o resultado ficou incompleto", async () => {
    h = await connect({ "GET /evaluation/external_api/solicitations": cyclePages(2000) });

    const result = await call("get_evaluation_cycles");

    const body = JSON.parse(textOf(result));
    expect(h.requests).toHaveLength(40);
    expect(body.total).toBe(40 * 20);
    expect(body.incomplete).toBe(true);
    expect(body.warning).toMatch(/incompleto/);
    expect(body.warning).toMatch(/40/);
  });

  it("não marca incompleto quando a última página cai exatamente no teto", async () => {
    h = await connect({ "GET /evaluation/external_api/solicitations": cyclePages(40 * 20) });

    const body = JSON.parse(textOf(await call("get_evaluation_cycles")));

    expect(h.requests).toHaveLength(40);
    expect(body.total).toBe(800);
    expect(body.incomplete).toBeUndefined();
  });

  it("falha em vez de repetir a página 1 se a API ignora o parâmetro de página", async () => {
    h = await connect({
      "GET /evaluation/external_api/solicitations": () =>
        v3Page([{ id: 1 }], { current: 1, next: 2, pages: 3, total_count: 60 }),
    });

    const result = await call("get_evaluation_cycles");

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/página/);
    expect(h.requests).toHaveLength(2);
  });

  it("resposta V3 sem corpo devolve lista vazia", async () => {
    h = await connect({ "GET /evaluation/external_api/solicitations": { status: 200 } });

    const result = await call("get_evaluation_cycles");

    expect(JSON.parse(textOf(result))).toEqual({ total: 0, limit: 50, offset: 0, items: [] });
  });

  it("mapeia 401 da V3 para a mensagem de token inválido", async () => {
    h = await connect({ "GET /evaluation/external_api/solicitations": { status: 401 } });

    const result = await call("get_evaluation_cycles");

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Token inválido/);
  });
});

describe("get_evaluation_cycles: avaliações de um ciclo", () => {
  const route = "GET /evaluation/external_api/solicitations/111/evaluations";
  const people = [
    v3Evaluation(1, "Maria da Conceição", "123.456.789-09"),
    v3Evaluation(2, "José Ávila", "98765432100"),
    v3Evaluation(3, "Maria Souza", "11122233344"),
  ];

  it("lista as avaliações do ciclo no host V3 com os critérios", async () => {
    h = await connect({ [route]: v3Pages(3, (id) => people[id - 1]) });

    const body = JSON.parse(textOf(await call("get_evaluation_cycles", { cycle_id: 111 })));

    expect(body.total).toBe(3);
    expect(body.items[0]).toMatchObject({ id: 10, ratedName: "Maria da Conceição" });
    expect(body.items[0].criterions[0]).toMatchObject({ criterionGrade: 3, criterionComments: "Bom" });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ host: "apigw.solides.com.br", path: "/evaluation/external_api/solicitations/111/evaluations" });
  });

  it("filtra por nome do Colaborador, sem acento nem caixa, no MCP", async () => {
    h = await connect({ [route]: v3Pages(3, (id) => people[id - 1]) });

    const body = JSON.parse(textOf(await call("get_evaluation_cycles", { cycle_id: 111, name: "maria" })));

    expect(body.items.map((e: { ratedId: number }) => e.ratedId)).toEqual([1, 3]);
    expect(body.total).toBe(2);
  });

  it("filtra por CPF com ou sem formatação", async () => {
    h = await connect({ [route]: v3Pages(3, (id) => people[id - 1]) });

    const body = JSON.parse(textOf(await call("get_evaluation_cycles", { cycle_id: 111, cpf: "123.456.789-09" })));

    expect(body.items.map((e: { ratedId: number }) => e.ratedId)).toEqual([1]);
  });

  it("consulta só o ciclo pedido, nunca vários", async () => {
    h = await connect({ [route]: v3Pages(3, (id) => people[id - 1]) });

    await call("get_evaluation_cycles", { cycle_id: 111 });

    expect(h.requests.every((r) => r.path.includes("/solicitations/111/"))).toBe(true);
  });

  it("pagina a V3 do ciclo até o fim e avisa no teto, filtrando depois de juntar tudo", async () => {
    h = await connect({ [route]: v3Pages(2000, (id) => v3Evaluation(id, `Pessoa ${id}`, String(id))) });

    const body = JSON.parse(textOf(await call("get_evaluation_cycles", { cycle_id: 111, name: "pessoa 1" })));

    expect(h.requests).toHaveLength(40);
    expect(body.incomplete).toBe(true);
    expect(body.warning).toMatch(/incompleto/);
  });

  it("recusa filtro por Colaborador sem o ciclo", async () => {
    h = await connect({});

    const result = await call("get_evaluation_cycles", { name: "maria" });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/cycle_id/);
    expect(h.requests).toHaveLength(0);
  });
});

describe("get_evaluation_cycles: descrição", () => {
  it("é só leitura e orienta a listar os ciclos primeiro", async () => {
    h = await connect({});

    const { tools } = await h.client.listTools();
    const tool = tools.find((t) => t.name === "get_evaluation_cycles");

    expect(tool?.annotations?.readOnlyHint).toBe(true);
    expect(tool?.description).toMatch(/comece sempre por aqui/);
    expect(tool?.description).toMatch(/um ciclo por vez/i);
  });
});
