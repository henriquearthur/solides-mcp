import { describe, expect, it } from "vitest";
import { SolidesApiError, SolidesClient } from "../src/core/index.js";
import { createFakeFetch, type FakeHandler } from "./helpers/fake-fetch.js";

function makeClient(
  routes: Record<string, FakeHandler>,
  options: { allowWrites?: boolean; unauthorizedMessage?: string } = {},
) {
  const fake = createFakeFetch(routes);
  const client = new SolidesClient({
    token: "meu-token",
    allowWrites: options.allowWrites ?? false,
    fetch: fake.fetch,
    unauthorizedMessage: options.unauthorizedMessage,
  });
  return { client, requests: fake.requests };
}

async function errorOf(promise: Promise<unknown>): Promise<SolidesApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(SolidesApiError);
    return error as SolidesApiError;
  }
  throw new Error("esperava uma falha, mas a chamada teve sucesso");
}

describe("requisições", () => {
  it("envia Authorization: Token token=<token> na base V1 em pt-BR", async () => {
    const { client, requests } = makeClient({ "GET /departamentos": [] });

    await client.get("/departamentos");

    expect(requests[0]?.url).toBe("https://app.solides.com/pt-BR/api/v1/departamentos");
    expect(requests[0]?.headers.authorization).toBe("Token token=meu-token");
  });

  it("serializa a query ignorando valores indefinidos", async () => {
    const { client, requests } = makeClient({ "GET /colaboradores": [] });

    await client.get("/colaboradores", { query: { status: "todos", page: undefined } });

    expect(requests[0]?.query).toEqual({ status: "todos" });
  });
});

describe("guarda de escrita", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "recusa %s sem fazer a requisição quando a escrita não está permitida",
    async (method) => {
      const { client, requests } = makeClient({ [`${method} /ocorrencias`]: {} });

      const error = await errorOf(client.request(method, "/ocorrencias", { body: {} }));

      expect(error.kind).toBe("write_not_allowed");
      expect(requests).toHaveLength(0);
    },
  );

  it("permite escrita quando liberada", async () => {
    const { client, requests } = makeClient(
      { "POST /ocorrencias": { id: 1 } },
      { allowWrites: true },
    );

    await client.request("POST", "/ocorrencias", { body: { comment: "ok" } });

    expect(requests[0]).toMatchObject({ method: "POST", body: { comment: "ok" } });
  });
});

describe("mapeamento de erros", () => {
  it("401 vira 'token inválido'", async () => {
    const { client } = makeClient({ "GET /x": { status: 401 } });

    const error = await errorOf(client.get("/x"));

    expect(error.kind).toBe("unauthorized");
    expect(error.status).toBe(401);
    expect(error.message).toMatch(/token inválido/i);
  });

  it("401 usa a mensagem configurada pela entrada", async () => {
    const { client } = makeClient(
      { "GET /x": { status: 401 } },
      { unauthorizedMessage: "Token inválido. Verifique SOLIDES_API_TOKEN." },
    );

    const error = await errorOf(client.get("/x"));

    expect(error.message).toBe("Token inválido. Verifique SOLIDES_API_TOKEN.");
  });

  it("404 vira 'não encontrado'", async () => {
    const { client } = makeClient({ "GET /x": { status: 404, body: "" } });

    const error = await errorOf(client.get("/x"));

    expect(error.kind).toBe("not_found");
    expect(error.message).toContain("não encontrado");
  });

  it.each([
    ["message", { message: "CPF inválido" }],
    ["error", { error: "CPF inválido" }],
    ["errors", { errors: ["CPF inválido"] }],
  ])("422 usa a mensagem da API (campo %s)", async (_campo, payload) => {
    const { client } = makeClient({
      "GET /x": { status: 422, body: JSON.stringify(payload) },
    });

    const error = await errorOf(client.get("/x"));

    expect(error.kind).toBe("validation");
    expect(error.message).toContain("CPF inválido");
  });

  it("422 com corpo fora de JSON ou vazio ainda dá mensagem clara", async () => {
    const html = makeClient({ "GET /x": { status: 422, body: "<html>erro</html>" } });
    const empty = makeClient({ "GET /x": { status: 422 } });

    const fromHtml = await errorOf(html.client.get("/x"));
    const fromEmpty = await errorOf(empty.client.get("/x"));

    expect(fromHtml.kind).toBe("validation");
    expect(fromHtml.message).toContain("422");
    expect(fromEmpty.kind).toBe("validation");
  });

  it("5xx vira indisponibilidade, mesmo com corpo fora de JSON", async () => {
    const { client } = makeClient({ "GET /x": { status: 502, body: "<html>Bad Gateway</html>" } });

    const error = await errorOf(client.get("/x"));

    expect(error.kind).toBe("unavailable");
    expect(error.message).toContain("indisponível");
  });

  it("falha de rede vira indisponibilidade", async () => {
    const client = new SolidesClient({
      token: "t",
      allowWrites: false,
      fetch: (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch,
    });

    const error = await errorOf(client.get("/x"));

    expect(error.kind).toBe("unavailable");
  });

  it("tolera sucesso com corpo vazio ou fora de JSON", async () => {
    const empty = makeClient({ "GET /vazio": { status: 200 }, "GET /texto": { status: 200, body: "ok" } });

    expect(await empty.client.get("/vazio")).toBeUndefined();
    expect(await empty.client.get("/texto")).toBe("ok");
  });
});
