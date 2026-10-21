import { z } from "zod";
import type { ToolContext } from "./context.js";
import { jsonResult } from "./result.js";
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

export function registerAbsenceTools({ server, client }: ToolContext): void {
  server.registerTool(
    "get_absences",
    {
      description:
        "Consulta Absenteísmos da Sólides (registros de ausência ou ponto de um Colaborador).",
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
          .describe("CPF do Colaborador, com ou sem pontos e traço. Lista só os Absenteísmos dele."),
        ...paginationInput,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, cpf, limit, offset }) => {
      if (id !== undefined) return jsonResult(await client.get(`/absenteismos/${id}`));
      const absences = await client.get<ApiAbsence[] | undefined>(
        cpf === undefined ? "/absenteismos" : `/absenteismos/colaborador/${digitsOnly(cpf)}`,
      );
      if (!Array.isArray(absences)) return jsonResult(absences);
      return jsonResult(paginate(absences.map(summarize), { limit, offset }));
    },
  );
}
