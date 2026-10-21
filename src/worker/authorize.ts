import { AuthorizationError } from "@cloudflare/workers-oauth-provider";
import { SolidesApiError, SolidesClient } from "../core/index.js";
import { escapeHtml, renderAuthorizePage } from "./authorize-page.js";
import { installationAllowsWrites, workerFetch, type Env, type SolidesGrantProps } from "./shared.js";

const HTML = { "Content-Type": "text/html; charset=utf-8" };
const TEXT = { "Content-Type": "text/plain; charset=utf-8" };

/**
 * Valida o Token de API com um GET leve (somente leitura). Devolve o erro em pt-BR
 * para a tela, ou `undefined` se o token vale.
 */
async function checkToken(token: string): Promise<string | undefined> {
  if (!token) return "Informe o Token de API.";
  const client = new SolidesClient({ token, allowWrites: false, fetch: workerFetch });
  try {
    await client.get("/departamentos");
    return undefined;
  } catch (error) {
    if (error instanceof SolidesApiError) {
      if (error.kind === "unauthorized") {
        return "Token inválido. Confira o Token de API da sua Empresa e tente de novo.";
      }
      return `Não foi possível validar o token agora. ${error.message}`;
    }
    throw error;
  }
}

/**
 * Props da Autorização a partir do formulário. A escrita só liga se a instalação permite
 * (teto, ADR 0002) E a caixa veio marcada: com a flag desligada o campo é ignorado,
 * então uma requisição forjada não ativa a escrita.
 */
function readGrantOptions(form: FormData, env: Env): Pick<SolidesGrantProps, "allowWrites"> {
  return { allowWrites: installationAllowsWrites(env) && form.get("allowWrites") === "on" };
}

async function showScreen(env: Env, request: Request, error?: string): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;
  const authRequest = await oauth.parseAuthRequest(request);
  const details = await oauth.describeConsent(authRequest);
  const consent = await oauth.beginConsent(authRequest);
  const headers = new Headers(consent.headers);
  for (const [name, value] of Object.entries(HTML)) headers.set(name, value);
  return new Response(renderAuthorizePage({
      details,
      handle: consent.handle,
      error,
      offerWrites: installationAllowsWrites(env),
    }), {
    status: 200,
    headers,
  });
}

async function submit(env: Env, request: Request): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;
  const form = await request.formData();
  const handle = String(form.get("handle") ?? "");

  if (form.get("decision") !== "approve") {
    const denied = await oauth.denyConsent(request, handle);
    return new Response(null, { status: 302, headers: denied.headers });
  }

  const token = String(form.get("token") ?? "").trim();
  const error = await checkToken(token);
  // Só consome o handle (approveConsent) com token válido; com erro, reabre a tela com handle novo.
  if (error) return showScreen(env, request, error);

  const approved = await oauth.approveConsent(request, handle);
  const props: SolidesGrantProps = { token, ...readGrantOptions(form, env) };
  const { redirectTo } = await oauth.completeAuthorization({
    request: approved.request,
    // A Autorização não é ligada a uma conta nossa: id aleatório (sem ":").
    userId: crypto.randomUUID(),
    metadata: {},
    scope: approved.request.scope,
    props,
  });
  const headers = new Headers(approved.headers);
  headers.set("Location", redirectTo);
  return new Response(null, { status: 302, headers });
}

export const authorizeHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/") {
      return new Response("solides-mcp: conector MCP para a Sólides Gestão. Adicione a URL /mcp como conector.", {
        headers: TEXT,
      });
    }
    if (pathname !== "/authorize" || (request.method !== "GET" && request.method !== "POST")) {
      return new Response("Não encontrado.", { status: 404, headers: TEXT });
    }

    try {
      return request.method === "GET"
        ? await showScreen(env, request)
        : await submit(env, request);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        // Só redireciona ao cliente quando o provider já validou o cliente e o redirect_uri.
        if (error.redirectTo) return Response.redirect(error.redirectTo, 302);
        return new Response(escapeHtml(error.description), { status: 400, headers: TEXT });
      }
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
