/** Fixtures na forma da spec docs/api/openapi.json (Avaliações V1 e V3). */

export interface V3Pagination {
  current: number;
  previous: number | null;
  next: number | null;
  per_page: number;
  pages: number;
  total_count: number;
}

export function v3Page<T>(data: T[], pagination: Partial<V3Pagination> = {}) {
  return {
    data,
    included: [],
    meta: {
      pagination: {
        current: 1,
        previous: null,
        next: null,
        per_page: 20,
        pages: 1,
        total_count: data.length,
        ...pagination,
      },
    },
  };
}

/** Páginas V3 de `total` itens (ids 1..total), 20 por página, resolvidas pelo parâmetro `page`. */
export function v3Pages<T>(total: number, make: (id: number) => T, pageSize = 20) {
  const pages = Math.ceil(total / pageSize);
  return (request: { query: Record<string, string> }) => {
    const page = Number(request.query["page"] ?? "1");
    const first = (page - 1) * pageSize;
    const count = Math.max(0, Math.min(pageSize, total - first));
    const ids = Array.from({ length: count }, (_, i) => first + i + 1);
    return v3Page(ids.map(make), {
      current: page,
      previous: page > 1 ? page - 1 : null,
      next: page < pages ? page + 1 : null,
      pages,
      total_count: total,
    });
  };
}

export function cycle(id: number) {
  return {
    id,
    type: "solicitations",
    attributes: {
      name: `Avaliação de Desempenho - ${id}`,
      description: "Teste",
      started_at: "2029-01-22",
      finished_at: "2029-02-07",
      tatus: "active",
    },
  };
}

export function cyclePages(total: number) {
  return v3Pages(total, cycle);
}

/** Avaliação V3 como a API real devolve: só `attributes`, sem `id` nem `type`, e o CPF em número. */
export function v3Evaluation(ratedId: number, ratedName: string, ratedDocument: string | number) {
  return {
    attributes: {
      evaluatorId: 1,
      evaluatorName: "Avaliadora",
      ratedId,
      ratedName,
      ratedDocument,
      ratedPosition: "ASSISTENTE DE COBRANÇA",
      ratedDepartament: "FINANCEIRO",
      ratedDate: "2029-01-25",
      criterions: [
        {
          criterionId: 1,
          criterionType: "Entrega",
          criterionDescription: "Entrega no prazo",
          criterionGrade: 3,
          criterionWeight: 1,
          criterionComments: "Bom",
        },
      ],
    },
  };
}

export const v1PerformanceEvaluations = [
  {
    evaluationId: 9319,
    evaluatorId: 74909,
    evaluatorName: "João da Silva Pires",
    ratedId: 190281,
    ratedName: "José de Souza Pires",
    ratedDocument: "12345678912",
    ratedPosition: "Assistente Administrativo",
    ratedDepartament: "Compras",
    comments: "Ótimo",
    criterions: [{ relacionamento: 3, engajamento: 1 }],
  },
];

export const v1AdvancedEvaluations = [
  {
    evaluatorId: 74909,
    evaluatorName: "João da Silva Pires",
    ratedId: 190281,
    ratedName: "José de Souza Pires",
    ratedDocument: "12345678912",
    ratedPosition: "Assistente Administrativo",
    ratedDepartament: "Compras",
    criterions: [{ criterionId: 27862, criterionType: "Agilidade", criterionGrade: 3 }],
  },
];
