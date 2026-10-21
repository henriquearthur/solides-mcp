import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createSolidesServer, type SolidesServerConfig } from "../../src/core/index.js";
import { createFakeFetch, type FakeFetch, type FakeHandler } from "./fake-fetch.js";

export interface TestHarness extends FakeFetch {
  client: Client;
  close: () => Promise<void>;
}

/**
 * Liga um cliente MCP real ao servidor do núcleo por transporte em memória,
 * com `fetch` falso. Uso:
 *
 *   const h = await connect({ "GET /departamentos": fixture });
 *   const result = await h.client.callTool({ name: "get_departments", arguments: {} });
 */
export async function connect(
  routes: Record<string, FakeHandler>,
  config: Partial<Omit<SolidesServerConfig, "fetch">> = {},
): Promise<TestHarness> {
  const fake = createFakeFetch(routes);
  const server = createSolidesServer({
    token: "token-de-teste",
    allowWrites: false,
    ...config,
    fetch: fake.fetch,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "teste", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    ...fake,
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

/** Texto da primeira parte de conteúdo de um resultado de tool. */
export function textOf(result: unknown): string {
  const content = (result as { content: Array<{ type: string; text?: string }> }).content;
  const first = content[0];
  if (!first || first.type !== "text" || first.text === undefined) {
    throw new Error("resultado sem conteúdo de texto");
  }
  return first.text;
}
