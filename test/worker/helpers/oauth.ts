import { exports } from "cloudflare:workers";
import { vi } from "vitest";
import { createFakeFetch, type FakeFetch, type FakeHandler } from "../../helpers/fake-fetch.js";

export const BASE = "https://exemplo.test";
export const REDIRECT_URI = "https://cliente.test/callback";
export const MCP_URL = `${BASE}/mcp`;

/** Chamadas ao Worker: sempre pelo ponto de entrada, nunca pela rede. */
export function worker(path: string, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(new Request(`${BASE}${path}`, { redirect: "manual", ...init }));
}

/**
 * Sólides falsa. O Worker chama o `fetch` global (no mesmo isolate do teste), então
 * troca-se o global por um fetch falso. Qualquer método diferente de GET é erro de teste
 * (salvo `fakeWrites`, que continua em memória, só nas rotas declaradas): este projeto
 * nunca escreve na Sólides.
 */
export function stubSolides(
  routes: Record<string, FakeHandler>,
  options: { fakeWrites?: boolean } = {},
): FakeFetch {
  const fake = createFakeFetch(routes);
  const guarded = (async (input: string | URL | Request, init?: RequestInit) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method !== "GET" && !options.fakeWrites) throw new Error(`teste tentou ${method} fora de GET na Sólides falsa`);
    return fake.fetch(input, init);
  }) as typeof fetch;
  vi.stubGlobal("fetch", guarded);
  return fake;
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function pkcePair() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

/** Registro dinâmico de cliente (RFC 7591). */
export async function registerClient(): Promise<string> {
  const response = await worker("/oauth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "Cliente de teste",
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  if (response.status !== 201) throw new Error(`registro falhou: ${response.status}`);
  return ((await response.json()) as { client_id: string }).client_id;
}

export interface AuthorizeScreen {
  response: Response;
  html: string;
  /** URL de /authorize (o formulário posta nela, com a query). */
  url: string;
  handle: string;
  /** Cookie que prende a tela ao navegador. */
  cookie: string;
  verifier: string;
}

/** Abre a tela de autorização como o navegador do usuário faria. */
export async function openAuthorizeScreen(clientId: string): Promise<AuthorizeScreen> {
  const { verifier, challenge } = await pkcePair();
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    state: "estado-1",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: MCP_URL,
  });
  const url = `/authorize?${query}`;
  return readScreen(await worker(url), url, verifier);
}

/** Lê uma tela de autorização (primeira ou reexibida com erro): handle e cookie novos. */
export async function readScreen(
  response: Response,
  url: string,
  verifier: string,
): Promise<AuthorizeScreen> {
  const html = await response.text();
  return {
    response,
    html,
    url,
    handle: /name="handle" value="([^"]+)"/.exec(html)?.[1] ?? "",
    cookie: cookieOf(response),
    verifier,
  };
}

/** Cookies de Set-Cookie no formato do header Cookie. */
export function cookieOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
}

/** Envia o formulário da tela de autorização. */
export function submitAuthorizeScreen(
  screen: Pick<AuthorizeScreen, "url" | "handle" | "cookie">,
  fields: { token: string; decision?: "approve" | "deny"; allowWrites?: boolean },
): Promise<Response> {
  return worker(screen.url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: screen.cookie },
    body: new URLSearchParams({
      handle: screen.handle,
      token: fields.token,
      decision: fields.decision ?? "approve",
      // Caixa marcada de um formulário HTML: o campo existe (valor "on"); desmarcada: ausente.
      ...(fields.allowWrites ? { allowWrites: "on" } : {}),
    }),
  });
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** Troca o `code` do redirecionamento por tokens. */
export async function exchangeCode(
  clientId: string,
  redirect: Response,
  verifier: string,
): Promise<{ response: Response; tokens: Tokens }> {
  const code = new URL(redirect.headers.get("location") ?? "").searchParams.get("code") ?? "";
  const response = await worker("/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier,
      resource: MCP_URL,
    }),
  });
  return { response, tokens: (await response.clone().json()) as Tokens };
}
