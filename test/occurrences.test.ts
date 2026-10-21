import { afterEach, describe, expect, it } from "vitest";
import { allOccurrences, atrasoMaria, feedbackMaria, manyOccurrences } from "./fixtures/occurrences.js";
import { connect, textOf, type TestHarness } from "./helpers/mcp.js";

let h: TestHarness;
afterEach(async () => {
  await h?.close();
});

async function getOccurrences(args: Record<string, unknown> = {}) {
  return h.client.callTool({ name: "get_occurrences", arguments: args });
}

describe("get_occurrences (lista)", () => {
  it("busca GET /ocorrencias e devolve só os campos documentados, com total, limit e offset", async () => {
    h = await connect({ "GET /ocorrencias": [feedbackMaria, atrasoMaria] });

    const result = await getOccurrences();

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({
      total: 2,
      limit: 50,
      offset: 0,
      items: [
        {
          id: 101,
          incidentDate: "15/03/2024",
          typeIncident: "Feedback",
          classification: "Positivo",
          comment: "Ótima condução da reunião.",
          value: null,
          colaborador: { id: 1, nome: "Maria de Fátima Souza" },
        },
        {
          id: 102,
          incidentDate: "02/04/2024",
          typeIncident: "Atraso",
          classification: "Negativo",
          comment: "Chegou 20 minutos atrasada.",
          value: 12.9,
          colaborador: { id: 1, nome: "Maria de Fátima Souza" },
        },
      ],
    });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({
      method: "GET",
      host: "app.solides.com",
      path: "/ocorrencias",
      query: {},
    });
  });

  it("filtra pelo id do Colaborador", async () => {
    h = await connect({ "GET /ocorrencias": allOccurrences });

    const result = JSON.parse(textOf(await getOccurrences({ employee_id: 2 })));

    expect(result.items.map((o: { id: number }) => o.id)).toEqual([103, 104]);
    expect(result.total).toBe(2);
  });

  it("filtra por tipo (1 a 12) convertido para o nome que a API devolve", async () => {
    h = await connect({ "GET /ocorrencias": allOccurrences });

    const feedbacks = JSON.parse(textOf(await getOccurrences({ type: 10 })));
    const promotions = JSON.parse(textOf(await getOccurrences({ type: 3 })));

    expect(feedbacks.items.map((o: { id: number }) => o.id)).toEqual([101, 103]);
    expect(promotions.items.map((o: { id: number }) => o.id)).toEqual([104]);
  });

  it("compara o tipo sem diferenciar acentos nem maiúsculas", async () => {
    h = await connect({
      "GET /ocorrencias": [
        { ...atrasoMaria, id: 1, typeIncident: "FALTA/AUSENCIA" },
        { ...atrasoMaria, id: 2, typeIncident: "ideia / contribuicao" },
        { ...atrasoMaria, id: 3, typeIncident: "Atraso" },
      ],
    });

    const absences = JSON.parse(textOf(await getOccurrences({ type: 1 })));
    const ideas = JSON.parse(textOf(await getOccurrences({ type: 5 })));

    expect(absences.items.map((o: { id: number }) => o.id)).toEqual([1]);
    expect(ideas.items.map((o: { id: number }) => o.id)).toEqual([2]);
  });

  it("rejeita tipo fora de 1 a 12", async () => {
    h = await connect({ "GET /ocorrencias": allOccurrences });

    const result = await getOccurrences({ type: 13 });

    expect(result.isError).toBe(true);
    expect(h.requests).toHaveLength(0);
  });

  it("filtra por classificação positiva ou negativa, sem diferenciar acentos nem maiúsculas", async () => {
    h = await connect({
      "GET /ocorrencias": [...allOccurrences, { ...atrasoMaria, id: 105, classification: "NEGATIVO" }],
    });

    const positive = JSON.parse(textOf(await getOccurrences({ classification: "positive" })));
    const negative = JSON.parse(textOf(await getOccurrences({ classification: "negative" })));

    expect(positive.items.map((o: { id: number }) => o.id)).toEqual([101, 104]);
    expect(negative.items.map((o: { id: number }) => o.id)).toEqual([102, 103, 105]);
  });

  it("rejeita classificação desconhecida", async () => {
    h = await connect({ "GET /ocorrencias": allOccurrences });

    const result = await getOccurrences({ classification: "neutra" });

    expect(result.isError).toBe(true);
  });

  it("filtra por intervalo de datas ISO, comparando com dd/mm/aaaa e incluindo os extremos", async () => {
    h = await connect({ "GET /ocorrencias": allOccurrences });

    const ids = async (args: Record<string, unknown>) =>
      JSON.parse(textOf(await getOccurrences(args))).items.map((o: { id: number }) => o.id);

    expect(await ids({ date_from: "2024-03-15", date_until: "2024-09-10" })).toEqual([101, 102, 103]);
    expect(await ids({ date_from: "2024-03-16", date_until: "2024-09-09" })).toEqual([102]);
    expect(await ids({ date_from: "2024-04-03" })).toEqual([103]);
    expect(await ids({ date_until: "2023-12-31" })).toEqual([104]);
  });

  it("rejeita data inválida sem chamar a API", async () => {
    h = await connect({ "GET /ocorrencias": allOccurrences });

    const result = await getOccurrences({ date_from: "2024-02-31" });

    expect(result.isError).toBe(true);
    expect(h.requests).toHaveLength(0);
  });

  it("ignora (no filtro de data) Ocorrência sem data válida", async () => {
    h = await connect({
      "GET /ocorrencias": [{ ...atrasoMaria, id: 7, incidentDate: "" }, feedbackMaria],
    });

    const result = JSON.parse(textOf(await getOccurrences({ date_from: "2024-01-01" })));

    expect(result.items.map((o: { id: number }) => o.id)).toEqual([101]);
  });

  it("combina os filtros (Feedbacks de um Colaborador no semestre)", async () => {
    h = await connect({ "GET /ocorrencias": allOccurrences });

    const result = JSON.parse(
      textOf(await getOccurrences({ employee_id: 1, type: 10, date_from: "2024-01-01", date_until: "2024-06-30" })),
    );

    expect(result.items.map((o: { id: number }) => o.id)).toEqual([101]);
  });
});

describe("get_occurrences (paginação)", () => {
  it("pagina com limit e offset e informa o total depois dos filtros", async () => {
    h = await connect({ "GET /ocorrencias": manyOccurrences(120) });

    const first = JSON.parse(textOf(await getOccurrences()));
    const second = JSON.parse(textOf(await getOccurrences({ limit: 30, offset: 100 })));

    expect(first).toMatchObject({ total: 120, limit: 50, offset: 0 });
    expect(first.items).toHaveLength(50);
    expect(second).toMatchObject({ total: 120, limit: 30, offset: 100 });
    expect(second.items.map((o: { id: number }) => o.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => 101 + i),
    );
  });

  it("rejeita limit acima do máximo", async () => {
    h = await connect({ "GET /ocorrencias": manyOccurrences(3) });

    expect((await getOccurrences({ limit: 201 })).isError).toBe(true);
  });

  it("repassa a resposta sem conteúdo da API", async () => {
    h = await connect({ "GET /ocorrencias": { status: 200 } });

    const result = await getOccurrences();

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toBe("A Sólides respondeu sem conteúdo.");
  });
});

describe("get_occurrences (detalhe)", () => {
  it("com id busca GET /ocorrencias/{id} e devolve a Ocorrência completa", async () => {
    h = await connect({ "GET /ocorrencias/102": atrasoMaria });

    const result = await getOccurrences({ id: 102 });

    expect(JSON.parse(textOf(result))).toEqual(atrasoMaria);
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ method: "GET", path: "/ocorrencias/102" });
  });

  it("devolve a mensagem em pt-BR quando a Ocorrência não existe", async () => {
    h = await connect({ "GET /ocorrencias/999": { status: 404 } });

    const result = await getOccurrences({ id: 999 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("Registro não encontrado na Sólides.");
  });
});

describe("get_occurrences (descrição)", () => {
  it("é só leitura e explica Feedback, o id do list_employees e a tabela de tipos", async () => {
    h = await connect({});

    const { tools } = await h.client.listTools();
    const tool = tools.find((t) => t.name === "get_occurrences");

    expect(tool?.annotations?.readOnlyHint).toBe(true);
    const text = JSON.stringify(tool);
    expect(text).toContain("Feedback");
    expect(text).toContain("tipo 10");
    expect(text).toContain("list_employees");
    expect(text).toContain("1 Falta/Ausência, 2 Atraso, 3 Promoção, 4 Falha/Erro");
    expect(text).toContain("10 Feedback, 11 Subperformance, 12 Folga");
  });
});
