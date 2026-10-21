import { afterEach, describe, expect, it } from "vitest";
import { cbos, contractTypes, dismissalReasons, positions } from "./fixtures/positions.js";
import { connect, textOf, type TestHarness } from "./helpers/mcp.js";

let h: TestHarness;
afterEach(async () => {
  await h?.close();
});

async function call(name: string, args: Record<string, unknown> = {}) {
  return h.client.callTool({ name, arguments: args });
}

describe("get_positions", () => {
  it("lista os Cargos com GET /cargos, paginados e com total", async () => {
    h = await connect({ "GET /cargos": positions });

    const result = await call("get_positions");

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({ total: 2, limit: 50, offset: 0, items: positions });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ method: "GET", host: "app.solides.com", path: "/cargos" });
  });

  it("pagina a lista com limit e offset", async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, name: `Cargo ${i + 1}` }));
    h = await connect({ "GET /cargos": many });

    const result = await call("get_positions", { limit: 3, offset: 2 });

    expect(JSON.parse(textOf(result))).toEqual({ total: 7, limit: 3, offset: 2, items: many.slice(2, 5) });
  });

  it("detalha um Cargo pelo id com GET /cargos/{id}", async () => {
    h = await connect({ "GET /cargos/2": positions[1] });

    const result = await call("get_positions", { id: 2 });

    expect(JSON.parse(textOf(result))).toEqual(positions[1]);
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]?.path).toBe("/cargos/2");
  });

  it("resposta sem corpo não quebra a tool", async () => {
    h = await connect({ "GET /cargos": { status: 200 } });

    expect((await call("get_positions")).isError).toBeFalsy();
  });

  it("404 no detalhe volta como erro de tool com 'não encontrado'", async () => {
    h = await connect({ "GET /cargos/99": { status: 404 } });

    const result = await call("get_positions", { id: 99 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("não encontrado");
  });

  it("é anotada como somente leitura e cita 'Cargo' na descrição", async () => {
    h = await connect({});

    const { tools } = await h.client.listTools();
    const tool = tools.find((t) => t.name === "get_positions");

    expect(tool?.annotations?.readOnlyHint).toBe(true);
    expect(tool?.description).toContain("Cargo");
  });
});

describe("get_reference_data", () => {
  it("kind=cbo lista com GET /cbos", async () => {
    h = await connect({ "GET /cbos": cbos });

    const result = await call("get_reference_data", { kind: "cbo" });

    expect(JSON.parse(textOf(result))).toEqual({ total: 3, limit: 50, offset: 0, items: cbos });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ method: "GET", path: "/cbos" });
  });

  it("kind=contract_types lista com GET /tipo_contratos", async () => {
    h = await connect({ "GET /tipo_contratos": contractTypes });

    const result = await call("get_reference_data", { kind: "contract_types" });

    expect(JSON.parse(textOf(result))).toEqual({ total: 3, limit: 50, offset: 0, items: contractTypes });
    expect(h.requests[0]?.path).toBe("/tipo_contratos");
  });

  it("kind=dismissal_reasons lista com GET /motivo_demissoes", async () => {
    h = await connect({ "GET /motivo_demissoes": dismissalReasons });

    const result = await call("get_reference_data", { kind: "dismissal_reasons" });

    expect(JSON.parse(textOf(result))).toEqual({ total: 2, limit: 50, offset: 0, items: dismissalReasons });
    expect(h.requests[0]?.path).toBe("/motivo_demissoes");
  });

  it("kind=dismissal_reasons com id detalha com GET /motivo_demissoes/{id}", async () => {
    h = await connect({ "GET /motivo_demissoes/2": dismissalReasons[1] });

    const result = await call("get_reference_data", { kind: "dismissal_reasons", id: 2 });

    expect(JSON.parse(textOf(result))).toEqual(dismissalReasons[1]);
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]?.path).toBe("/motivo_demissoes/2");
  });

  it("id em kind sem detalhe devolve erro claro sem chamar a API", async () => {
    h = await connect({ "GET /cbos": cbos });

    const result = await call("get_reference_data", { kind: "cbo", id: 1 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("motivos de demissão");
    expect(h.requests).toHaveLength(0);
  });

  it("pagina a lista com limit e offset", async () => {
    h = await connect({ "GET /cbos": cbos });

    const result = await call("get_reference_data", { kind: "cbo", limit: 1, offset: 1 });

    expect(JSON.parse(textOf(result))).toEqual({ total: 3, limit: 1, offset: 1, items: [cbos[1]] });
  });

  it("search filtra por trecho, sem acento nem caixa, antes de paginar", async () => {
    h = await connect({ "GET /tipo_contratos": contractTypes });

    const result = await call("get_reference_data", { kind: "contract_types", search: "ESTAGIO" });

    expect(JSON.parse(textOf(result))).toEqual({
      total: 1,
      limit: 50,
      offset: 0,
      items: [{ tipoContrato: "Estágio" }],
    });
  });

  it("search em CBO casa o código e a descrição", async () => {
    h = await connect({ "GET /cbos": cbos });

    const byCode = JSON.parse(textOf(await call("get_reference_data", { kind: "cbo", search: "2124" })));
    const byText = JSON.parse(textOf(await call("get_reference_data", { kind: "cbo", search: "calcados" })));

    expect(byCode.items).toEqual([cbos[0]]);
    expect(byText.items).toEqual([cbos[2]]);
  });

  it("rejeita kind desconhecido", async () => {
    h = await connect({});

    const result = await call("get_reference_data", { kind: "outro" });

    expect(result.isError).toBe(true);
    expect(h.requests).toHaveLength(0);
  });

  it("erro da API volta como erro de tool", async () => {
    h = await connect({ "GET /cbos": { status: 503, body: "<html/>" } });

    const result = await call("get_reference_data", { kind: "cbo" });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("indisponível");
  });

  it("é anotada como somente leitura", async () => {
    h = await connect({});

    const { tools } = await h.client.listTools();
    const tool = tools.find((t) => t.name === "get_reference_data");

    expect(tool?.annotations?.readOnlyHint).toBe(true);
    expect(tool?.description).toContain("CBO");
  });
});
