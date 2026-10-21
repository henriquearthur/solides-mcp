import { AuthorizationError, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { SolidesApiError, SolidesClient } from "../core/index.js";
import { escapeHtml, renderAuthorizePage } from "./authorize-page.js";
import { workerFetch, type Env, type SolidesGrantProps } from "./shared.js";

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
 * Props da Autorização a partir do formulário.
 * Ponto de extensão do ticket #11: ler aqui o campo "Permitir escrita" (e o escopo
 * correspondente) para definir `allowWrites`. Por ora a escrita fica sempre desligada.
 */
function readGrantOptions(_form: FormData): Pick<SolidesGrantProps, "allowWrites"> {
  return { allowWrites: false };
}

async function showScreen(
  oauth: OAuthHelpers,
  request: Request,
  error?: string,
): Promise<Response> {
  const authRequest = await oauth.parseAuthRequest(request);
  const details = await oauth.describeConsent(authRequest);
  const consent = await oauth.beginConsent(authRequest);
  const headers = new Headers(consent.headers);
  for (const [name, value] of Object.entries(HTML)) headers.set(name, value);
  return new Response(renderAuthorizePage({ details, handle: consent.handle, error }), {
    status: 200,
    headers,
  });
}

async function submit(oauth: OAuthHelpers, request: Request): Promise<Response> {
  const form = await request.formData();
  const handle = String(form.get("handle") ?? "");

  if (form.get("decision") !== "approve") {
    const denied = await oauth.denyConsent(request, handle);
    return new Response(null, { status: 302, headers: denied.headers });
  }

  const token = String(form.get("token") ?? "").trim();
  const error = await checkToken(token);
  // Só consome o handle (approveConsent) com token válido; com erro, reabre a tela com handle novo.
  if (error) return showScreen(oauth, request, error);

  const approved = await oauth.approveConsent(request, handle);
  const props: SolidesGrantProps = { token, ...readGrantOptions(form) };
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
        ? await showScreen(env.OAUTH_PROVIDER, request)
        : await submit(env.OAUTH_PROVIDER, request);
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
