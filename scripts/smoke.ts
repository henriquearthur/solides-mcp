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
import { OCCURRENCE_CLASSIFICATIONS, OCCURRENCE_TYPES } from "../src/core/occurrence-types.js";

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
    // Confirmado em 2026-10: com `page`, 25 Currículos por página e nenhum campo de data no item.
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

// Nomes de tipo e classificação que a API devolve precisam estar nas tabelas de src/core/occurrence-types.ts.
// Imprime só o total e os nomes desconhecidos, nenhum dado pessoal.
checks.push({
  name: "GET /ocorrencias — typeIncident e classification batem com as tabelas (#6)",
  run: async () => {
    const list = await client.get<{ typeIncident?: string; classification?: string }[]>("/ocorrencias");
    if (!Array.isArray(list)) throw new Error("esperava um array de Ocorrências");
    const known = (names: readonly string[], value: string | undefined) => value !== undefined && names.includes(value);
    const types = Object.values(OCCURRENCE_TYPES) as string[];
    const classifications = Object.values(OCCURRENCE_CLASSIFICATIONS) as string[];
    const unknownTypes = [...new Set(list.filter((o) => !known(types, o.typeIncident)).map((o) => String(o.typeIncident)))];
    const unknownClassifications = [
      ...new Set(list.filter((o) => !known(classifications, o.classification)).map((o) => String(o.classification))),
    ];
    if (unknownTypes.length || unknownClassifications.length) {
      throw new Error(`fora das tabelas: tipos ${JSON.stringify(unknownTypes)}, classificações ${JSON.stringify(unknownClassifications)}`);
    }
    return `${list.length} Ocorrência(s), todos os tipos e classificações conhecidos`;
  },
});

// O filtro por Colaborador de get_evaluation_cycles depende de `ratedName` e `ratedDocument` nas avaliações.
checks.push({
  name: "GET V3 avaliações de um ciclo — campos do avaliado (#8)",
  run: async () => {
    const cycles = await client.get<V3Envelope<{ id: number }>>("/evaluation/external_api/solicitations", { api: "v3" });
    for (const cycle of cycles.data ?? []) {
      const evaluations = await client.get<V3Envelope<{ attributes?: Record<string, unknown> }>>(
        `/evaluation/external_api/solicitations/${cycle.id}/evaluations`,
        { api: "v3" },
      );
      const first = evaluations.data?.[0]?.attributes;
      if (!first) continue;
      if (typeof first.ratedName !== "string" || first.ratedDocument === undefined) {
        throw new Error(`avaliação sem ratedName/ratedDocument; chaves: ${Object.keys(first).join(", ")}`);
      }
      return `ciclo ${cycle.id}: ratedName (string) e ratedDocument (${typeof first.ratedDocument}) presentes`;
    }
    return "nenhum ciclo da 1ª página tem avaliações (nada a conferir)";
  },
});

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
