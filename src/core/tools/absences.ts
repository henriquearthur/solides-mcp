import { z } from "zod";
import type { ToolContext } from "./context.js";
import { jsonResult } from "./result.js";
import { isoDateInput, parseApiDate } from "../dates.js";
import { paginate, paginationInput } from "../pagination.js";
import { digitsOnly } from "../text.js";

/** Forma relevante de `GET /absenteismos` (schema `Absenteismo`); `employee` é o cadastro completo. */
interface ApiAbsence {
  id: number;
  dateTimeAbsenteeism?: string | null;
  type?: string | null;
  location?: string | null;
  tangerinoId?: number | null;
  note?: string | null;
  employee?: { id: number; name?: string | null } | null;
}

function summarize(a: ApiAbsence) {
  return {
    id: a.id,
    dateTimeAbsenteeism: a.dateTimeAbsenteeism ?? null,
    type: a.type ?? null,
    location: a.location ?? null,
    tangerinoId: a.tangerinoId ?? null,
    note: a.note ?? null,
    employee: a.employee ? { id: a.employee.id, name: a.employee.name ?? null } : null,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function registerAbsenceTools({ server, client }: ToolContext): void {
  server.registerTool(
    "get_absences",
    {
      description:
        "Consulta Absenteísmos da Sólides (registros de ausência ou ponto de um Colaborador, com data e hora, tipo, local e observação). Sem `id`, lista paginada com um resumo de cada Absenteísmo (o Colaborador vem só com id e nome) e o total depois dos filtros; com `id`, devolve o registro completo.",
      inputSchema: {
        id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Id do Absenteísmo. Devolve o registro completo, com o cadastro do Colaborador; ignora os demais filtros."),
        cpf: z
          .string()
          .refine((value) => digitsOnly(value).length === 11, { message: "CPF inválido. Informe os 11 dígitos." })
          .optional()
          .describe("CPF do Colaborador, com ou sem pontos e traço. Consulta só os Absenteísmos dele."),
        employee_id: z.number().int().positive().optional().describe("Id do Colaborador (campo `id` do `list_employees`)."),
        from: isoDateInput.optional().describe("Absenteísmos a partir desta data, inclusive (AAAA-MM-DD)."),
        until: isoDateInput.optional().describe("Absenteísmos até esta data, inclusive (AAAA-MM-DD)."),
        ...paginationInput,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, cpf, employee_id, from, until, limit, offset }) => {
      if (id !== undefined) return jsonResult(await client.get(`/absenteismos/${id}`));
      const absences = await client.get<ApiAbsence[] | undefined>(
        cpf === undefined ? "/absenteismos" : `/absenteismos/colaborador/${digitsOnly(cpf)}`,
      );
      if (!Array.isArray(absences)) return jsonResult(absences);
      const start = from === undefined ? undefined : Date.parse(from);
      const end = until === undefined ? undefined : Date.parse(until) + DAY_MS;
      const matches = absences.filter((a) => {
        if (employee_id !== undefined && a.employee?.id !== employee_id) return false;
        if (start === undefined && end === undefined) return true;
        const when = parseApiDate(a.dateTimeAbsenteeism)?.getTime();
        if (when === undefined) return false;
        return (start === undefined || when >= start) && (end === undefined || when < end);
      });
      return jsonResult(paginate(matches.map(summarize), { limit, offset }));
    },
  );
}
