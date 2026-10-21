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
import { SolidesClient, V3_PAGE_PARAM, type V3Envelope } from "../src/core/index.js";

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
];

/** Pede uma página dos ciclos V3 (GET) e devolve o `meta.pagination` e a quantidade de itens. */
async function v3CyclesPage(page: number) {
  const body = await client.get<V3Envelope<unknown>>(
    "/evaluation/external_api/solicitations",
    { api: "v3", query: { [V3_PAGE_PARAM]: page } },
  );
  return { count: body.data?.length ?? 0, pagination: body.meta?.pagination };
}

// Confirma o nome do parâmetro de página da V3 (`V3_PAGE_PARAM` em src/core/v3.ts), que a spec não documenta.
// Se a página 2 vier com `current` diferente de 2 (ou igual à 1ª), o nome está errado.
checks.push({
  name: `GET V3 /evaluation/external_api/solicitations (${V3_PAGE_PARAM}=1 e ${V3_PAGE_PARAM}=2)`,
  run: async () => {
    const first = await v3CyclesPage(1);
    const second = await v3CyclesPage(2);
    const confirmed = second.pagination?.current === 2 || (second.count === 0 && first.pagination?.next == null);
    return [
      `página 1: ${first.count} item(ns), meta.pagination=${JSON.stringify(first.pagination)}`,
      `página 2: ${second.count} item(ns), meta.pagination=${JSON.stringify(second.pagination)}`,
      confirmed
        ? `parâmetro "${V3_PAGE_PARAM}" parece correto (com um único ciclo/página a página 2 pode vir vazia: confira o meta)`
        : `ATENÇÃO: a página 2 não veio com current=2; o parâmetro "${V3_PAGE_PARAM}" provavelmente está errado`,
    ].join("\n      ");
  },
});

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
