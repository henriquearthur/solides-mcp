import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createSolidesServer } from "../core/index.js";
import {
  UNAUTHORIZED_MESSAGE,
  installationAllowsWrites,
  workerFetch,
  type Env,
  type SolidesGrantProps,
} from "./shared.js";

/**
 * Endpoint MCP HTTP streamable sem estado. O provider só chama este handler com um
 * access token válido e entrega as props da Autorização em `ctx.props`. A cada
 * requisição monta servidor e transporte novos (o transporte sem estado não é reutilizável).
 */
export const mcpHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Sem estado não há sessão para retomar nem stream standalone: só POST.
    if (request.method !== "POST") {
      return new Response("Método não permitido.", { status: 405, headers: { Allow: "POST" } });
    }
    // Props gravadas em `completeAuthorization` (ver authorize.ts).
    const { token, allowWrites } = ctx.props as SolidesGrantProps;
    const server = createSolidesServer({
      token,
      // A flag da instalação é o teto: vale a cada requisição, também para Autorizações antigas.
      allowWrites: allowWrites === true && installationAllowsWrites(env),
      fetch: workerFetch,
      unauthorizedMessage: UNAUTHORIZED_MESSAGE,
    });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return transport.handleRequest(request);
  },
};
