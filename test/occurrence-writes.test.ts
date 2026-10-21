import { afterEach, describe, expect, it } from "vitest";
import { connect, textOf, type TestHarness } from "./helpers/mcp.js";

let h: TestHarness;
afterEach(async () => {
  await h?.close();
});

async function toolNames(): Promise<string[]> {
  const { tools } = await h.client.listTools();
  return tools.map((t) => t.name);
}

/** Chamada que pode virar erro do protocolo (tool desconhecida) ou resultado `isError`. */
async function attempt(name: string, args: Record<string, unknown>): Promise<{ isError?: boolean | undefined }> {
  const result = await h.client.callTool({ name, arguments: args }).catch(() => undefined);
  return { isError: result === undefined ? true : (result.isError as boolean | undefined) };
}

const validCreate = { cpf: "12345678901", date: "2024-03-15", classification: "positive", type: 10 };

describe("registro das tools de escrita", () => {
  it("sem escrita permitida, create_occurrence e delete_occurrence não aparecem na lista", async () => {
    h = await connect({}, { allowWrites: false });

    const names = await toolNames();

    expect(names).toContain("get_occurrences");
    expect(names).not.toContain("create_occurrence");
    expect(names).not.toContain("delete_occurrence");
  });

  it("com escrita permitida, as duas tools aparecem", async () => {
    h = await connect({}, { allowWrites: true });

    const names = await toolNames();

    expect(names).toContain("create_occurrence");
    expect(names).toContain("delete_occurrence");
  });

  it("chamar uma tool de escrita sem permissão é recusado e não toca a API", async () => {
    h = await connect(
      { "POST /ocorrencias": { id: 1 }, "DELETE /ocorrencias/5": { status: 204 } },
      { allowWrites: false },
    );

    const create = await attempt("create_occurrence", validCreate);
    const remove = await attempt("delete_occurrence", { id: 5 });

    expect(create.isError).toBe(true);
    expect(remove.isError).toBe(true);
    expect(h.requests).toHaveLength(0);
  });
});

describe("anotações e descrições", () => {
  it("create_occurrence não é só leitura e delete_occurrence é destrutiva", async () => {
    h = await connect({}, { allowWrites: true });

    const { tools } = await h.client.listTools();
    const create = tools.find((t) => t.name === "create_occurrence");
    const remove = tools.find((t) => t.name === "delete_occurrence");

    expect(create?.annotations?.readOnlyHint).not.toBe(true);
    expect(remove?.annotations?.readOnlyHint).not.toBe(true);
    expect(remove?.annotations?.destructiveHint).toBe(true);
  });

  it("as descrições mandam confirmar com o usuário e obter o CPF pelo list_employees", async () => {
    h = await connect({}, { allowWrites: true });

    const { tools } = await h.client.listTools();
    const create = tools.find((t) => t.name === "create_occurrence")?.description ?? "";
    const remove = tools.find((t) => t.name === "delete_occurrence")?.description ?? "";

    expect(create).toContain("list_employees");
    expect(create).toMatch(/confirm/i);
    expect(create).toContain("10 Feedback");
    expect(remove).toMatch(/confirm/i);
  });
});

describe("create_occurrence", () => {
  it("envia POST /ocorrencias com CPF, data em dd/mm/aaaa, classificação, comentário, valor e typeIncidentId", async () => {
    const created = { id: 321, incidentDate: "15/03/2024", typeIncident: "Feedback", classification: "Positivo" };
    h = await connect({ "POST /ocorrencias": { status: 201, body: JSON.stringify(created) } }, { allowWrites: true });

    const result = await h.client.callTool({
      name: "create_occurrence",
      arguments: { ...validCreate, cpf: "123.456.789-01", comment: "Ótima condução da reunião.", value: 12.9 },
    });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual(created);
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({
      method: "POST",
      host: "app.solides.com",
      path: "/ocorrencias",
      body: {
        idNumber: "12345678901",
        incidentDate: "15/03/2024",
        classification: "Positivo",
        comment: "Ótima condução da reunião.",
        value: 12.9,
        typeIncidentId: 10,
      },
    });
  });

  it("classificação negativa vira Negativo e comentário e valor são opcionais", async () => {
    h = await connect({ "POST /ocorrencias": { status: 201, body: "{}" } }, { allowWrites: true });

    await h.client.callTool({
      name: "create_occurrence",
      arguments: { cpf: "12345678901", date: "2024-04-02", classification: "negative", type: 2 },
    });

    expect(h.requests[0]?.body).toEqual({
      idNumber: "12345678901",
      incidentDate: "02/04/2024",
      classification: "Negativo",
      typeIncidentId: 2,
    });
  });

  it.each([
    ["tipo fora de 1..12", { type: 13 }],
    ["data inexistente", { date: "2023-02-31" }],
    ["data fora do formato ISO", { date: "15/03/2024" }],
    ["classificação desconhecida", { classification: "neutro" }],
    ["CPF sem 11 dígitos", { cpf: "123" }],
  ])("rejeita %s sem chamar a API", async (_name, override) => {
    h = await connect({ "POST /ocorrencias": { status: 201, body: "{}" } }, { allowWrites: true });

    const result = await attempt("create_occurrence", { ...validCreate, ...override });

    expect(result.isError).toBe(true);
    expect(h.requests).toHaveLength(0);
  });

  it("devolve a mensagem da API quando ela recusa (422)", async () => {
    h = await connect(
      { "POST /ocorrencias": { status: 422, body: JSON.stringify({ message: "Colaborador não encontrado" }) } },
      { allowWrites: true },
    );

    const result = await h.client.callTool({ name: "create_occurrence", arguments: validCreate });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Colaborador não encontrado");
  });
});

describe("delete_occurrence", () => {
  it("envia DELETE /ocorrencias/{id} e confirma a exclusão", async () => {
    h = await connect({ "DELETE /ocorrencias/102": { status: 204 } }, { allowWrites: true });

    const result = await h.client.callTool({ name: "delete_occurrence", arguments: { id: 102 } });

    expect(result.isError).toBeFalsy();
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ method: "DELETE", host: "app.solides.com", path: "/ocorrencias/102" });
    expect(textOf(result)).toContain("102");
  });

  it("id inexistente (404) vira erro em pt-BR", async () => {
    h = await connect({ "DELETE /ocorrencias/9": { status: 404 } }, { allowWrites: true });

    const result = await h.client.callTool({ name: "delete_occurrence", arguments: { id: 9 } });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("não encontrado");
  });
});
