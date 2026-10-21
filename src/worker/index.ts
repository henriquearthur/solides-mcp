import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { authorizeHandler } from "./authorize.js";
import { mcpHandler } from "./mcp.js";
import type { Env } from "./shared.js";

const DAY = 24 * 60 * 60;

/**
 * O provider exige que `resourceMetadata.resource` seja uma URL https canônica e o repositório
 * não fixa domínio; por isso o provider é montado com a origem de cada requisição.
 */
function createProvider(origin: string) {
  return new OAuthProvider<Env>({
    apiRoute: "/mcp",
    apiHandler: mcpHandler,
    defaultHandler: authorizeHandler,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/oauth/token",
    clientRegistrationEndpoint: "/oauth/register",
    resourceMetadata: { resource: `${origin}/mcp` },
    accessTokenTTL: 60 * 60,
    // Janela deslizante: cada renovação estende a Autorização por mais 30 dias.
    refreshTokenTTL: 30 * DAY,
    refreshTokenIdleTTL: 30 * DAY,
  });
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return createProvider(new URL(request.url).origin).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
