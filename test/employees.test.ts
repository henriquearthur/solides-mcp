import { afterEach, describe, expect, it } from "vitest";
import { activeEmployees, maria } from "./fixtures/employees.js";
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
});

function idOf(e: { id: number }) {
  return e.id;
}
