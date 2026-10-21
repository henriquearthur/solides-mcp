/**
 * Teste de fumaça MANUAL contra a API real da Sólides. Não roda no CI.
 *
 *   SOLIDES_API_TOKEN=... npm run smoke
 *
 * Faz SOMENTE requisições GET: o cliente é criado com `allowWrites: false` (a guarda
 * recusa qualquer outro método) e o `fetch` abaixo também aborta se o método não for GET.
 *
 * Para cobrir mais um recurso, adicione um item em `checks`.
 */
import { SolidesClient } from "../src/core/index.js";

const token = process.env.SOLIDES_API_TOKEN?.trim();
if (!token) {
  console.error("Defina SOLIDES_API_TOKEN com o Token de API da Sólides Gestão.");
  process.exit(1);
}

const getOnlyFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    throw new Error(`Teste de fumaça só faz GET; recusado: ${method}`);
  }
  return fetch(input, init);
};

const client = new SolidesClient({ token, allowWrites: false, fetch: getOnlyFetch });

type Check = { name: string; run: () => Promise<string> };

const checks: Check[] = [
  {
    name: "GET /departamentos e GET /departamentos/{id}",
    run: async () => {
      const list = await client.get<unknown>("/departamentos");
      if (!Array.isArray(list)) throw new Error("esperava um array de Departamentos");
      const first = list[0] as { id?: unknown; name?: unknown } | undefined;
      if (!first) return "lista vazia (nada a detalhar)";
      if (typeof first.id !== "number" || typeof first.name !== "string") {
        throw new Error(`Departamento fora do formato {id:number, name:string}: ${JSON.stringify(first)}`);
      }
      const detail = (await client.get<{ id?: unknown }>(`/departamentos/${first.id}`));
      if (detail.id !== first.id) throw new Error("detalhe com id diferente do pedido");
      return `${list.length} Departamento(s); detalhe do id ${first.id} confere`;
    },
  },
  {
    // UNCONFIRMED: a paginação e o formato de GET /curriculos ainda não foram vistos na API real.
    name: "GET /curriculos (page 1 e 2, ocultar_foto=SIM) — confirma paginação e formato (#9)",
    run: async () => {
      const dateFinal = new Date();
      const dateStart = new Date(dateFinal.getTime() - 90 * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) =>
        `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
      const query = { data_inicial: fmt(dateStart), data_final: fmt(dateFinal), ocultar_foto: "SIM" };
      const counts: string[] = [];
      let first: unknown;
      const ids: unknown[][] = [];
      for (const page of ["1", "2"]) {
        const body = await client.get<unknown>("/curriculos", { query: { ...query, page } });
        if (!Array.isArray(body)) throw new Error(`página ${page}: esperava array, veio ${typeof body}`);
        counts.push(`página ${page}: ${body.length} item(ns)`);
        ids.push(body.map((r) => (r as { id?: unknown }).id));
        first ??= body[0];
      }
      const samePage = ids[0]?.length && JSON.stringify(ids[0]) === JSON.stringify(ids[1]);
      const keys = first && typeof first === "object" ? Object.keys(first).join(", ") : "(sem itens)";
      return `${counts.join("; ")}; ${samePage ? "página 2 IGUAL à 1 (a API parece ignorar `page`)" : "páginas diferentes"}; chaves do 1º item: ${keys}`;
    },
  },
];

let failed = false;
for (const check of checks) {
  try {
    console.log(`OK    ${check.name}: ${await check.run()}`);
  } catch (error) {
    failed = true;
    console.error(`FALHA ${check.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
process.exit(failed ? 1 : 0);
