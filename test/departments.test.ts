import { afterEach, describe, expect, it } from "vitest";
import { departments } from "./fixtures/departments.js";
import { connect, textOf, type TestHarness } from "./helpers/mcp.js";

let h: TestHarness;
afterEach(async () => {
  await h?.close();
});

describe("get_departments", () => {
  it("lista os Departamentos com GET /departamentos", async () => {
    h = await connect({ "GET /departamentos": departments });

    const result = await h.client.callTool({ name: "get_departments", arguments: {} });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({
      total: 2,
      limit: 50,
      offset: 0,
      items: departments,
    });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({
      method: "GET",
      host: "app.solides.com",
      path: "/departamentos",
    });
  });

  it("pagina a lista com limit e offset e informa o total", async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, name: `Departamento ${i + 1}` }));
    h = await connect({ "GET /departamentos": many });

    const result = await h.client.callTool({
      name: "get_departments",
      arguments: { limit: 3, offset: 2 },
    });

    expect(JSON.parse(textOf(result))).toEqual({
      total: 7,
      limit: 3,
      offset: 2,
      items: many.slice(2, 5),
    });
  });

  it("detalha um Departamento pelo id com GET /departamentos/{id}", async () => {
    h = await connect({ "GET /departamentos/2": departments[1] });

    const result = await h.client.callTool({ name: "get_departments", arguments: { id: 2 } });

    expect(JSON.parse(textOf(result))).toEqual(departments[1]);
    expect(h.requests[0]?.path).toBe("/departamentos/2");
  });

  it("é anotada como somente leitura e cita 'Departamento' na descrição", async () => {
    h = await connect({});

    const { tools } = await h.client.listTools();
    const tool = tools.find((t) => t.name === "get_departments");

    expect(tool?.annotations?.readOnlyHint).toBe(true);
    expect(tool?.description).toContain("Departamento");
  });
});

describe("erros da API nas tools", () => {
  it("404 volta como erro de tool com 'não encontrado'", async () => {
    h = await connect({ "GET /departamentos/99": { status: 404 } });

    const result = await h.client.callTool({ name: "get_departments", arguments: { id: 99 } });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("não encontrado");
  });

  it("401 usa a mensagem de token inválido configurada pela entrada", async () => {
    h = await connect(
      { "GET /departamentos": { status: 401 } },
      { unauthorizedMessage: "Token inválido. Verifique SOLIDES_API_TOKEN." },
    );

    const result = await h.client.callTool({ name: "get_departments", arguments: {} });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("Token inválido. Verifique SOLIDES_API_TOKEN.");
  });

  it("5xx volta como indisponibilidade", async () => {
    h = await connect({ "GET /departamentos": { status: 503, body: "<html/>" } });

    const result = await h.client.callTool({ name: "get_departments", arguments: {} });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("indisponível");
  });

  it("resposta sem corpo não quebra a tool", async () => {
    h = await connect({ "GET /departamentos": { status: 200 } });

    const result = await h.client.callTool({ name: "get_departments", arguments: {} });

    expect(result.isError).toBeFalsy();
  });
});
