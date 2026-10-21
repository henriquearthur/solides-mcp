import { afterEach, describe, expect, it } from "vitest";
import { allAbsences, manyAbsences, mariaArrival, mariaDeparture } from "./fixtures/absences.js";
import { connect, textOf, type TestHarness } from "./helpers/mcp.js";

let h: TestHarness;
afterEach(async () => {
  await h?.close();
});

async function getAbsences(args: Record<string, unknown> = {}) {
  return h.client.callTool({ name: "get_absences", arguments: args });
}

describe("get_absences: lista geral", () => {
  it("busca GET /absenteismos e troca o employee completo por {id, name}", async () => {
    h = await connect({ "GET /absenteismos": allAbsences });

    const result = await getAbsences();

    expect(result.isError).toBeFalsy();
    const body = JSON.parse(textOf(result));
    expect(body.total).toBe(3);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
    expect(body.items[0]).toEqual({
      id: 1,
      dateTimeAbsenteeism: "11/07/2017 08:30:00",
      type: "Chegada",
      location: "Belo Horizonte",
      tangerinoId: 100,
      note: "Observação do Absenteísmo",
      employee: { id: 1, name: "Maria de Fátima Souza" },
    });
    expect(textOf(result)).not.toContain("11223344556");
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({
      method: "GET",
      host: "app.solides.com",
      path: "/absenteismos",
      query: {},
    });
  });
});

function ids(result: Awaited<ReturnType<typeof getAbsences>>): number[] {
  return JSON.parse(textOf(result)).items.map((a: { id: number }) => a.id);
}

describe("get_absences: filtros no MCP", () => {
  it("filtra por Colaborador (id) na lista geral", async () => {
    h = await connect({ "GET /absenteismos": allAbsences });

    const result = await getAbsences({ employee_id: 2 });

    expect(ids(result)).toEqual([3]);
    expect(JSON.parse(textOf(result)).total).toBe(1);
    expect(h.requests[0]?.query).toEqual({});
  });

  it("filtra por intervalo de datas ISO comparado com dd/mm/aaaa HH:MM:SS, com os dois dias incluídos", async () => {
    h = await connect({ "GET /absenteismos": allAbsences });

    expect(ids(await getAbsences({ from: "2017-07-11", until: "2017-07-11" }))).toEqual([1, 2]);
    expect(ids(await getAbsences({ from: "2017-07-12" }))).toEqual([3]);
    expect(ids(await getAbsences({ until: "2017-07-10" }))).toEqual([]);
    expect(ids(await getAbsences({ from: "2017-07-11", until: "2017-07-12" }))).toEqual([1, 2, 3]);
  });

  it("combina Colaborador, datas e CPF", async () => {
    h = await connect({
      "GET /absenteismos/colaborador/11223344556": [mariaArrival, mariaDeparture],
    });

    const result = await getAbsences({ cpf: "11223344556", employee_id: 1, from: "2017-07-11", until: "2017-07-11" });

    expect(ids(result)).toEqual([1, 2]);
  });

  it("ignora o registro sem data válida quando há filtro de data", async () => {
    h = await connect({ "GET /absenteismos": [{ id: 7, dateTimeAbsenteeism: null }, mariaArrival] });

    expect(ids(await getAbsences({ from: "2017-01-01" }))).toEqual([1]);
    expect(ids(await getAbsences())).toEqual([7, 1]);
  });

  it("rejeita data fora do formato ISO, sem chamar a API", async () => {
    h = await connect({ "GET /absenteismos": allAbsences });

    const result = await getAbsences({ from: "11/07/2017" });

    expect(result.isError).toBe(true);
    expect(h.requests).toHaveLength(0);
  });
});

describe("get_absences: paginação", () => {
  it("pagina com limit e offset, e total depois dos filtros", async () => {
    h = await connect({ "GET /absenteismos": manyAbsences(120) });

    const body = JSON.parse(textOf(await getAbsences({ limit: 10, offset: 115 })));

    expect(body).toMatchObject({ total: 120, limit: 10, offset: 115 });
    expect(body.items.map((a: { id: number }) => a.id)).toEqual([116, 117, 118, 119, 120]);
  });
});

describe("get_absences: contrato da tool", () => {
  it("é anotada com readOnlyHint e descrita em pt-BR", async () => {
    h = await connect({});

    const { tools } = await h.client.listTools();
    const tool = tools.find((t) => t.name === "get_absences");

    expect(tool?.annotations?.readOnlyHint).toBe(true);
    expect(tool?.description).toContain("Absenteísmo");
  });

  it("devolve o corpo vazio da API sem tentar filtrar", async () => {
    h = await connect({ "GET /absenteismos": { status: 200 } });

    const result = await getAbsences({ employee_id: 1 });

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toBe("A Sólides respondeu sem conteúdo.");
  });
});

describe("get_absences: por CPF do Colaborador", () => {
  it("busca GET /absenteismos/colaborador/{cpf} com o CPF só em dígitos e devolve o resumo paginado", async () => {
    h = await connect({ "GET /absenteismos/colaborador/11223344556": [mariaArrival, mariaDeparture] });

    const result = await getAbsences({ cpf: "112.233.445-56" });

    expect(result.isError).toBeFalsy();
    const body = JSON.parse(textOf(result));
    expect(body.total).toBe(2);
    expect(body.items.map((a: { id: number }) => a.id)).toEqual([1, 2]);
    expect(body.items[0].employee).toEqual({ id: 1, name: "Maria de Fátima Souza" });
    expect(h.requests.map((r) => r.path)).toEqual(["/absenteismos/colaborador/11223344556"]);
  });

  it("rejeita CPF que não tem 11 dígitos, sem chamar a API", async () => {
    h = await connect({});

    const result = await getAbsences({ cpf: "123" });

    expect(result.isError).toBe(true);
    expect(h.requests).toHaveLength(0);
  });
});

describe("get_absences: detalhe por id", () => {
  it("busca GET /absenteismos/{id} e devolve o registro completo, com o employee inteiro", async () => {
    h = await connect({ "GET /absenteismos/1": mariaArrival });

    const result = await getAbsences({ id: 1 });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual(mariaArrival);
    expect(h.requests.map((r) => r.path)).toEqual(["/absenteismos/1"]);
  });

  it("devolve a mensagem em pt-BR quando o Absenteísmo não existe", async () => {
    h = await connect({});

    const result = await getAbsences({ id: 99 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("Registro não encontrado na Sólides.");
  });
});
