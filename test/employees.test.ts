import { afterEach, describe, expect, it } from "vitest";
import { activeEmployees, allEmployees, manyEmployees, maria } from "./fixtures/employees.js";
import type { RecordedRequest } from "./helpers/fake-fetch.js";
import { connect, textOf, type TestHarness } from "./helpers/mcp.js";

let h: TestHarness;
afterEach(async () => {
  await h?.close();
});

async function listEmployees(args: Record<string, unknown> = {}) {
  return h.client.callTool({ name: "list_employees", arguments: args });
}

describe("list_employees", () => {
  it("busca GET /colaboradores sem status e devolve o resumo com total, limit e offset", async () => {
    h = await connect({ "GET /colaboradores": activeEmployees });

    const result = await listEmployees();

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({
      total: 2,
      limit: 50,
      offset: 0,
      items: [
        {
          id: 1,
          name: "Maria de Fátima Souza",
          idNumber: "11223344556",
          registration: "381998",
          department: "Tecnologia",
          position: "Analista de Sistemas",
          unity: "Matriz",
          active: true,
          dateAdmission: "01/03/2018",
        },
        {
          id: 2,
          name: "José Álvares",
          idNumber: "99887766554",
          registration: "BR-0042",
          department: "Recursos Humanos",
          position: "Gerente de RH",
          unity: "Filial Sul",
          active: true,
          dateAdmission: "15/06/2020",
        },
      ],
    });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({
      method: "GET",
      host: "app.solides.com",
      path: "/colaboradores",
      query: {},
    });
  });

  it("o resumo é menor que o cadastro, mas não mascara o CPF", async () => {
    h = await connect({ "GET /colaboradores": [maria] });

    const text = textOf(await listEmployees());

    expect(text.length).toBeLessThan(JSON.stringify(maria, null, 2).length);
    expect(text).toContain("11223344556");
  });

  it("filtra o nome por trecho, sem diferenciar acentos nem maiúsculas", async () => {
    h = await connect({ "GET /colaboradores": activeEmployees });

    const byAccentless = JSON.parse(textOf(await listEmployees({ name: "fatima" })));
    const byUpperCase = JSON.parse(textOf(await listEmployees({ name: "ÁLVARES" })));

    expect(byAccentless.items.map((e: { id: number }) => e.id)).toEqual([1]);
    expect(byUpperCase.items.map((e: { id: number }) => e.id)).toEqual([2]);
    expect(byAccentless.total).toBe(1);
  });

  it("filtra por CPF com ou sem formatação", async () => {
    h = await connect({ "GET /colaboradores": activeEmployees });

    const formatted = JSON.parse(textOf(await listEmployees({ cpf: "998.877.665-54" })));
    const plain = JSON.parse(textOf(await listEmployees({ cpf: "99887766554" })));

    expect(formatted.items.map(idOf)).toEqual([2]);
    expect(plain.items.map(idOf)).toEqual([2]);
  });

  it("filtra por Matrícula, sem diferenciar maiúsculas", async () => {
    h = await connect({ "GET /colaboradores": activeEmployees });

    const result = JSON.parse(textOf(await listEmployees({ registration: "br-0042" })));

    expect(result.items.map(idOf)).toEqual([2]);
    expect(result.total).toBe(1);
  });

  it("filtra por Departamento, Cargo e Unidade por trecho, sem acentos nem maiúsculas", async () => {
    h = await connect({ "GET /colaboradores": activeEmployees });

    const byDepartment = JSON.parse(textOf(await listEmployees({ department: "recursos" })));
    const byPosition = JSON.parse(textOf(await listEmployees({ position: "ANALISTA" })));
    const byUnity = JSON.parse(textOf(await listEmployees({ unity: "filial" })));

    expect(byDepartment.items.map(idOf)).toEqual([2]);
    expect(byPosition.items.map(idOf)).toEqual([1]);
    expect(byUnity.items.map(idOf)).toEqual([2]);
  });

  it("combina filtros (todos precisam bater)", async () => {
    h = await connect({ "GET /colaboradores": activeEmployees });

    const result = JSON.parse(textOf(await listEmployees({ department: "tecnologia", unity: "filial" })));

    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it("com include_dismissed envia status=todos e traz também os demitidos", async () => {
    h = await connect({
      "GET /colaboradores": (req: RecordedRequest) => (req.query.status === "todos" ? allEmployees : activeEmployees),
    });

    const result = JSON.parse(textOf(await listEmployees({ include_dismissed: true })));

    expect(h.requests[0]?.query).toEqual({ status: "todos" });
    expect(result.items.map(idOf)).toEqual([1, 2, 3]);
    expect(result.items[2]).toMatchObject({ id: 3, active: false });
  });

  it("converte o intervalo de admissão de ISO para dd/mm/aaaa nos parâmetros da API", async () => {
    h = await connect({ "GET /colaboradores": activeEmployees });

    await listEmployees({ admitted_from: "2020-01-05", admitted_until: "2023-12-31" });

    expect(h.requests[0]?.query).toEqual({
      data_admissao: "05/01/2020",
      data_admissao_anterior: "31/12/2023",
    });
  });

  it("rejeita data de admissão que não seja ISO válida, sem chamar a API", async () => {
    h = await connect({ "GET /colaboradores": activeEmployees });

    const wrongFormat = await listEmployees({ admitted_from: "05/01/2020" });
    const impossible = await listEmployees({ admitted_until: "2023-02-31" });

    expect(wrongFormat.isError).toBe(true);
    expect(impossible.isError).toBe(true);
    expect(h.requests).toHaveLength(0);
  });

  it("pagina com limit padrão de 50 e informa o total", async () => {
    h = await connect({ "GET /colaboradores": manyEmployees(120) });

    const result = JSON.parse(textOf(await listEmployees()));

    expect(result.total).toBe(120);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
    expect(result.items).toHaveLength(50);
    expect(result.items[0].name).toBe("Colaborador 001");
  });

  it("respeita limit e offset e o total vale depois dos filtros", async () => {
    h = await connect({ "GET /colaboradores": manyEmployees(120) });

    const result = JSON.parse(
      textOf(await listEmployees({ name: "colaborador 1", limit: 5, offset: 10 })),
    );

    // "colaborador 1" casa de 100 a 120 (21 nomes); 001 a 099 começam com 0
    expect(result.total).toBe(21);
    expect(result.limit).toBe(5);
    expect(result.offset).toBe(10);
    expect(result.items.map((e: { name: string }) => e.name)).toEqual([
      "Colaborador 110",
      "Colaborador 111",
      "Colaborador 112",
      "Colaborador 113",
      "Colaborador 114",
    ]);
  });

  it("offset além do fim devolve página vazia mantendo o total", async () => {
    h = await connect({ "GET /colaboradores": activeEmployees });

    const result = JSON.parse(textOf(await listEmployees({ offset: 10 })));

    expect(result).toMatchObject({ total: 2, offset: 10, items: [] });
  });

  it("rejeita limit fora dos valores aceitos", async () => {
    h = await connect({ "GET /colaboradores": activeEmployees });

    expect((await listEmployees({ limit: 0 })).isError).toBe(true);
    expect((await listEmployees({ offset: -1 })).isError).toBe(true);
  });

  it("resposta sem corpo não quebra a tool", async () => {
    h = await connect({ "GET /colaboradores": { status: 200 } });

    const result = await listEmployees();

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toBe("A Sólides respondeu sem conteúdo.");
  });

  it("não usa GET /colaboradores/existe/{cpf}", async () => {
    h = await connect({ "GET /colaboradores": activeEmployees });

    await listEmployees({ cpf: "99887766554" });

    expect(h.requests.map((r) => r.path)).toEqual(["/colaboradores"]);
  });
});

describe("get_employee", () => {
  it("detalha o Colaborador por id com o cadastro completo, sem mascarar", async () => {
    h = await connect({ "GET /colaboradores/1": maria });

    const result = await h.client.callTool({ name: "get_employee", arguments: { id: 1 } });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual(maria);
    expect(h.requests[0]).toMatchObject({ method: "GET", path: "/colaboradores/1" });
  });

  it("orienta a buscar o id pelo list_employees e é somente leitura", async () => {
    h = await connect({});

    const { tools } = await h.client.listTools();
    const tool = tools.find((t) => t.name === "get_employee");

    expect(tool?.annotations?.readOnlyHint).toBe(true);
    expect(tool?.description).toContain("list_employees");
    expect(tool?.description).toContain("CPF");
    expect(tool?.description).toContain("Matrícula");
  });

  it("404 volta como erro de tool", async () => {
    h = await connect({ "GET /colaboradores/99": { status: 404 } });

    const result = await h.client.callTool({ name: "get_employee", arguments: { id: 99 } });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("não encontrado");
  });
});

function idOf(e: { id: number }) {
  return e.id;
}
