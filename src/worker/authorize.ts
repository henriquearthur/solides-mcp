import type { Env } from "./shared.js";

export const authorizeHandler = {
  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response("Não encontrado.", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
