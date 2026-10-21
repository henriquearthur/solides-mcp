import { env } from "cloudflare:workers";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { departments } from "../fixtures/departments.js";
import {
  exchangeCode,
  openAuthorizeScreen,
  registerClient,
  stubSolides,
  submitAuthorizeScreen,
  worker,
} from "./helpers/oauth.js";
import type { FakeHandler } from "../helpers/fake-fetch.js";

const CHECKBOX_LABEL = "Permitir escrita (registrar e excluir Ocorrências)";
const WRITE_TOOLS = ["create_occurrence", "delete_occurrence"];

/** Teto da instalação: a var `SOLIDES_ALLOW_WRITES` do Worker. */
const vars = env as unknown as { SOLIDES_ALLOW_WRITES?: string };
const original = vars.SOLIDES_ALLOW_WRITES;

beforeEach(() => {
  vars.SOLIDES_ALLOW_WRITES = "true";
});

afterEach(() => {
  vars.SOLIDES_ALLOW_WRITES = original;
  vi.unstubAllGlobals();
});

const READ_ROUTES: Record<string, FakeHandler> = { "GET /departamentos": departments };

async function accessToken(fields: { allowWrites?: boolean }): Promise<string> {
  const clientId = await registerClient();
  const screen = await openAuthorizeScreen(clientId);
  const redirect = await submitAuthorizeScreen(screen, { token: "token-bom", ...fields });
  expect(redirect.status).toBe(302);
  const { tokens } = await exchangeCode(clientId, redirect, screen.verifier);
  return tokens.access_token;
}

function rpc(accessToken: string, message: object): Promise<Response> {
  return worker("/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(message),
  });
}

async function toolNames(token: string): Promise<string[]> {
  const response = await rpc(token, { jsonrpc: "2.0", id: 1, method: "tools/list" });
  const body = (await response.json()) as { result: { tools: Array<{ name: string }> } };
  return body.result.tools.map((tool) => tool.name);
}

it("flag ligada: a tela mostra a caixa de escrita, desmarcada por padrão", async () => {
  stubSolides({});
  const screen = await openAuthorizeScreen(await registerClient());

  expect(screen.html).toContain(CHECKBOX_LABEL);
  expect(screen.html).toMatch(/<input[^>]*type="checkbox"[^>]*name="allowWrites"[^>]*>/);
  expect(screen.html).not.toMatch(/<input[^>]*name="allowWrites"[^>]*checked/);
});

it("caixa marcada: as tools de escrita aparecem", async () => {
  stubSolides(READ_ROUTES);
  const names = await toolNames(await accessToken({ allowWrites: true }));

  expect(names).toEqual(expect.arrayContaining(["get_departments", ...WRITE_TOOLS]));
});

it("caixa desmarcada: as tools de escrita não aparecem", async () => {
  stubSolides(READ_ROUTES);
  const names = await toolNames(await accessToken({ allowWrites: false }));

  expect(names).toContain("get_departments");
  for (const tool of WRITE_TOOLS) expect(names).not.toContain(tool);
});

it("caixa marcada: create_occurrence escreve (na Sólides falsa) com o Token de API das props", async () => {
  const solides = stubSolides(
    { "POST /ocorrencias": { id: 77 }, ...READ_ROUTES },
    { fakeWrites: true },
  );
  const token = await accessToken({ allowWrites: true });
  solides.requests.length = 0;

  const response = await rpc(token, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "create_occurrence",
      arguments: { cpf: "12345678909", date: "2024-03-09", classification: "negative", type: 1 },
    },
  });
  const body = (await response.json()) as { result: { isError?: boolean } };

  expect(body.result.isError).toBeFalsy();
  expect(solides.requests).toHaveLength(1);
  expect(solides.requests[0]).toMatchObject({
    method: "POST",
    host: "app.solides.com",
    path: "/ocorrencias",
    headers: { authorization: "Token token=token-bom" },
  });
});

it("flag desligada: a tela não mostra a caixa", async () => {
  vars.SOLIDES_ALLOW_WRITES = "false";
  stubSolides({});
  const screen = await openAuthorizeScreen(await registerClient());

  expect(screen.html).not.toContain(CHECKBOX_LABEL);
  expect(screen.html).not.toContain("allowWrites");
});

it("flag ausente: equivale a desligada", async () => {
  delete vars.SOLIDES_ALLOW_WRITES;
  stubSolides({});
  const screen = await openAuthorizeScreen(await registerClient());

  expect(screen.html).not.toContain("allowWrites");
});

it("flag desligada: campo allowWrites forjado no formulário não liga a escrita", async () => {
  vars.SOLIDES_ALLOW_WRITES = "false";
  const solides = stubSolides(READ_ROUTES);
  const token = await accessToken({ allowWrites: true });

  const names = await toolNames(token);
  expect(names).toContain("get_departments");
  for (const tool of WRITE_TOOLS) expect(names).not.toContain(tool);

  // Nem chamando a tool pelo nome: ela não existe, e nada vai à Sólides.
  solides.requests.length = 0;
  const response = await rpc(token, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "create_occurrence", arguments: {} },
  });
  const body = (await response.json()) as { result?: { isError?: boolean }; error?: unknown };
  expect(body.result?.isError === true || body.error !== undefined).toBe(true);
  expect(solides.requests).toHaveLength(0);
});

it("flag desligada depois da Autorização: a escrita some mesmo com a caixa marcada antes", async () => {
  stubSolides(READ_ROUTES);
  const token = await accessToken({ allowWrites: true });
  expect(await toolNames(token)).toEqual(expect.arrayContaining(WRITE_TOOLS));

  vars.SOLIDES_ALLOW_WRITES = "false";

  const names = await toolNames(token);
  for (const tool of WRITE_TOOLS) expect(names).not.toContain(tool);
});
