import { afterEach, expect, it, vi } from "vitest";
import { departments } from "../fixtures/departments.js";
import {
  REDIRECT_URI,
  openAuthorizeScreen,
  readScreen,
  registerClient,
  stubSolides,
  submitAuthorizeScreen,
  worker,
} from "./helpers/oauth.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("a tela de autorização pede o Token de API em pt-BR", async () => {
  stubSolides({});
  const screen = await openAuthorizeScreen(await registerClient());

  expect(screen.response.status).toBe(200);
  expect(screen.response.headers.get("content-type")).toContain("text/html");
  expect(screen.html).toContain('lang="pt-BR"');
  expect(screen.html).toContain("Token de API");
  expect(screen.handle).not.toBe("");
});

it("token inválido: mostra o erro e não conclui a Autorização", async () => {
  const solides = stubSolides({ "GET /departamentos": { status: 401 } });
  const screen = await openAuthorizeScreen(await registerClient());

  const response = await submitAuthorizeScreen(screen, { token: "token-ruim" });
  const html = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
  expect(html).toContain("Token inválido");
  // O token digitado não volta na página.
  expect(html).not.toContain("token-ruim");
  // A validação é um GET leve com o token informado.
  expect(solides.requests).toHaveLength(1);
  expect(solides.requests[0]).toMatchObject({
    method: "GET",
    host: "app.solides.com",
    path: "/departamentos",
    headers: { authorization: "Token token=token-ruim" },
  });
});

it("token inválido: a tela reaberta ainda aceita um token válido", async () => {
  let valid = false;
  stubSolides({ "GET /departamentos": () => (valid ? departments : { status: 401 }) });
  const client = await registerClient();
  const screen = await openAuthorizeScreen(client);

  const rejected = await submitAuthorizeScreen(screen, { token: "ruim" });
  const retry = await readScreen(rejected, screen.url, screen.verifier);
  valid = true;
  const accepted = await submitAuthorizeScreen(retry, { token: "bom" });

  expect(accepted.status).toBe(302);
  expect(accepted.headers.get("location")).toContain("code=");
});

it("token válido: conclui a Autorização e redireciona ao cliente com o code", async () => {
  stubSolides({ "GET /departamentos": departments });
  const screen = await openAuthorizeScreen(await registerClient());

  const response = await submitAuthorizeScreen(screen, { token: "token-bom" });

  expect(response.status).toBe(302);
  const location = new URL(response.headers.get("location") ?? "");
  expect(location.origin + location.pathname).toBe("https://cliente.test/callback");
  expect(location.searchParams.get("code")).toBeTruthy();
  expect(location.searchParams.get("state")).toBe("estado-1");
});

it("negar redireciona ao cliente com access_denied e não consulta a Sólides", async () => {
  const solides = stubSolides({});
  const screen = await openAuthorizeScreen(await registerClient());

  const response = await submitAuthorizeScreen(screen, { token: "", decision: "deny" });

  expect(response.status).toBe(302);
  expect(new URL(response.headers.get("location") ?? "").searchParams.get("error")).toBe(
    "access_denied",
  );
  expect(solides.requests).toHaveLength(0);
});

it("Sólides indisponível ao validar: mostra erro e não conclui", async () => {
  stubSolides({ "GET /departamentos": { status: 503 } });
  const screen = await openAuthorizeScreen(await registerClient());

  const response = await submitAuthorizeScreen(screen, { token: "qualquer" });

  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
  expect(await response.text()).toContain("Não foi possível validar o token");
});

it("token em branco: pede o token sem chamar a Sólides", async () => {
  const solides = stubSolides({});
  const screen = await openAuthorizeScreen(await registerClient());

  const response = await submitAuthorizeScreen(screen, { token: "   " });

  expect(response.status).toBe(200);
  expect(await response.text()).toContain("Informe o Token de API");
  expect(solides.requests).toHaveLength(0);
});

it("escapa o nome do cliente vindo do registro dinâmico", async () => {
  stubSolides({});
  const registered = await worker("/oauth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "<script>alert(1)</script>",
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: "none",
    }),
  });
  const { client_id } = (await registered.json()) as { client_id: string };

  const screen = await openAuthorizeScreen(client_id);

  expect(screen.html).not.toContain("<script>alert(1)");
  expect(screen.html).toContain("&lt;script&gt;");
});
