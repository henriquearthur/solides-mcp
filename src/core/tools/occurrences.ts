import { z } from "zod";
import type { ToolContext } from "./context.js";
import { jsonResult } from "./result.js";
import { OCCURRENCE_TYPES_TEXT, occurrenceTypeIdInput, occurrenceTypeName } from "../occurrence-types.js";
import { isoDateInput, parseApiDate } from "../dates.js";
import { paginate, paginationInput } from "../pagination.js";
import { normalizeText } from "../text.js";

/** Forma relevante de `GET /ocorrencias` (apenas os campos documentados na spec). */
interface ApiOccurrence {
  id: number;
  incidentDate?: string;
  typeIncident?: string;
  classification?: string;
  comment?: string;
  value?: number;
  colaborador?: { id?: number; nome?: string } | null;
}

const CLASSIFICATIONS = { positive: "Positivo", negative: "Negativo" } as const;

function summarize(o: ApiOccurrence) {
  return {
    id: o.id,
    incidentDate: o.incidentDate ?? null,
    typeIncident: o.typeIncident ?? null,
    classification: o.classification ?? null,
    comment: o.comment ?? null,
    value: o.value ?? null,
    colaborador: o.colaborador ? { id: o.colaborador.id ?? null, nome: o.colaborador.nome ?? null } : null,
  };
}

export function registerOccurrenceTools({ server, client }: ToolContext): void {
  server.registerTool(
    "get_occurrences",
    {
      description: [
        "Consulta as Ocorrências da Sólides (registros datados sobre um Colaborador, como Atraso, Advertência e Feedback).",
        "Feedback é a Ocorrência do tipo 10: para os Feedbacks de uma pessoa, use `type` 10.",
        "Para filtrar por Colaborador, busque antes o id com `list_employees` e passe em `employee_id`.",
        `Tipos (número do \`type\` e nome que a API devolve): ${OCCURRENCE_TYPES_TEXT}.`,
        "A lista é paginada (informa o total depois dos filtros) e cada item traz id, data, tipo, classificação, comentário, valor e Colaborador (id e nome). Com `id`, devolve o registro completo daquela Ocorrência e ignora os filtros.",
      ].join(" "),
      inputSchema: {
        id: z.number().int().positive().optional().describe("Id de uma Ocorrência, para ver o registro completo."),
        employee_id: z.number().int().positive().optional().describe("Id do Colaborador (campo `id` do `list_employees`)."),
        type: occurrenceTypeIdInput
          .optional()
          .describe(`Tipo da Ocorrência, de 1 a 12: ${OCCURRENCE_TYPES_TEXT}.`),
        classification: z
          .enum(["positive", "negative"])
          .optional()
          .describe("Classificação: `positive` (Positivo) ou `negative` (Negativo)."),
        date_from: isoDateInput.optional().describe("Ocorrências a partir desta data, inclusive (AAAA-MM-DD)."),
        date_until: isoDateInput.optional().describe("Ocorrências até esta data, inclusive (AAAA-MM-DD)."),
        ...paginationInput,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, employee_id, type, classification, date_from, date_until, limit, offset }) => {
      if (id !== undefined) return jsonResult(await client.get(`/ocorrencias/${id}`));
      const occurrences = await client.get<ApiOccurrence[] | undefined>("/ocorrencias");
      if (!Array.isArray(occurrences)) return jsonResult(occurrences);
      const typeName = type === undefined ? undefined : occurrenceTypeName(type);
      const classificationName = classification === undefined ? undefined : CLASSIFICATIONS[classification];
      const from = date_from === undefined ? undefined : Date.parse(date_from);
      const until = date_until === undefined ? undefined : Date.parse(date_until);
      const matches = occurrences.filter((o) => {
        if (employee_id !== undefined && o.colaborador?.id !== employee_id) return false;
        if (typeName !== undefined && normalizeText(o.typeIncident ?? "") !== normalizeText(typeName)) return false;
        if (
          classificationName !== undefined &&
          normalizeText(o.classification ?? "") !== normalizeText(classificationName)
        ) {
          return false;
        }
        if (from !== undefined || until !== undefined) {
          const date = parseApiDate(o.incidentDate)?.getTime();
          if (date === undefined) return false;
          if (from !== undefined && date < from) return false;
          if (until !== undefined && date > until) return false;
        }
        return true;
      });
      return jsonResult(paginate(matches.map(summarize), { limit, offset }));
    },
  );
}
