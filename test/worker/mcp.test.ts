import { afterEach, expect, it, vi } from "vitest";
import { departments } from "../fixtures/departments.js";
import {
  MCP_URL,
  exchangeCode,
  openAuthorizeScreen,
  registerClient,
  stubSolides,
  submitAuthorizeScreen,
  worker,
  type Tokens,
} from "./helpers/oauth.js";
import type { FakeHandler } from "../helpers/fake-fetch.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** register -> authorize -> token, contra a Sólides falsa. */
async function authorizeClient(apiToken: string): Promise<{ clientId: string; tokens: Tokens }> {
  const clientId = await registerClient();
  const screen = await openAuthorizeScreen(clientId);
  const redirect = await submitAuthorizeScreen(screen, { token: apiToken });
  expect(redirect.status).toBe(302);
  const { response, tokens } = await exchangeCode(clientId, redirect, screen.verifier);
  expect(response.status).toBe(200);
  return { clientId, tokens };
}

function rpc(accessToken: string | undefined, message: object, method = "POST"): Promise<Response> {
  return worker("/mcp", {
    method,
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(message) } : {}),
  });
}

const callGetDepartments = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: { name: "get_departments", arguments: {} },
};

it("um access token de 1 hora; refresh token presente", async () => {
  stubSolides({ "GET /departamentos": departments });
  const { tokens } = await authorizeClient("token-bom");

  expect(tokens.expires_in).toBe(3600);
  expect(tokens.refresh_token).toBeTruthy();
});

it("fim a fim: registro, autorização, token e get_departments com o Token de API das props", async () => {
  const solides = stubSolides({ "GET /departamentos": departments });
  const { tokens } = await authorizeClient("token-da-empresa");
  solides.requests.length = 0;

  const response = await rpc(tokens.access_token, callGetDepartments);

  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    result: { isError?: boolean; content: Array<{ text: string }> };
  };
  expect(body.result.isError).toBeFalsy();
  expect(JSON.parse(body.result.content[0]?.text ?? "")).toEqual(departments);
  expect(solides.requests).toHaveLength(1);
  expect(solides.requests[0]).toMatchObject({
    method: "GET",
    host: "app.solides.com",
    path: "/departamentos",
    headers: { authorization: "Token token=token-da-empresa" },
  });
});

it("lista as tools sem tools de escrita (allowWrites desligado)", async () => {
  stubSolides({ "GET /departamentos": departments });
  const { tokens } = await authorizeClient("token-bom");

  const response = await rpc(tokens.access_token, { jsonrpc: "2.0", id: 2, method: "tools/list" });
  const body = (await response.json()) as { result: { tools: Array<{ name: string }> } };

  expect(body.result.tools.map((tool) => tool.name)).toEqual(["get_departments"]);
});

it("recusa /mcp com access token desconhecido", async () => {
  const response = await rpc("token-inventado", callGetDepartments);
  expect(response.status).toBe(401);
});

it("recusa /mcp usando o refresh token como access token", async () => {
  stubSolides({ "GET /departamentos": departments });
  const { tokens } = await authorizeClient("token-bom");
  const response = await rpc(tokens.refresh_token, callGetDepartments);
  expect(response.status).toBe(401);
});

it("GET em /mcp autorizado responde 405 (sem estado, sem stream standalone)", async () => {
  stubSolides({ "GET /departamentos": departments });
  const { tokens } = await authorizeClient("token-bom");
  const response = await rpc(tokens.access_token, {}, "GET");
  expect(response.status).toBe(405);
  expect(response.headers.get("allow")).toBe("POST");
});

it("401 da Sólides (token revogado depois) vira 'token inválido, reconecte o conector'", async () => {
  let revoked = false;
  const routes: Record<string, FakeHandler> = {
    "GET /departamentos": () => (revoked ? { status: 401 } : departments),
  };
  stubSolides(routes);
  const { tokens } = await authorizeClient("token-bom");
  revoked = true;

  const response = await rpc(tokens.access_token, callGetDepartments);
  const body = (await response.json()) as {
    result: { isError: boolean; content: Array<{ text: string }> };
  };

  expect(body.result.isError).toBe(true);
  expect(body.result.content[0]?.text).toBe("token inválido, reconecte o conector");
});

it("o refresh token gera novo par de tokens que acessa o /mcp", async () => {
  stubSolides({ "GET /departamentos": departments });
  const { clientId, tokens } = await authorizeClient("token-bom");

  const refreshed = await worker("/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: clientId,
      resource: MCP_URL,
    }),
  });
  expect(refreshed.status).toBe(200);
  const next = (await refreshed.json()) as Tokens;
  expect(next.refresh_token).not.toBe(tokens.refresh_token);

  const response = await rpc(next.access_token, callGetDepartments);
  expect(response.status).toBe(200);
});

it("não escreve em log corpo, resposta nem tokens", async () => {
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
    vi.spyOn(console, level),
  );
  stubSolides({ "GET /departamentos": departments });
  const { tokens } = await authorizeClient("token-secreto-da-empresa");
  await rpc(tokens.access_token, callGetDepartments);

  const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
  expect(logged).not.toContain("token-secreto-da-empresa");
  expect(logged).not.toContain(tokens.access_token);
  expect(logged).not.toContain("Tecnologia");
});
