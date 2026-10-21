import { z } from "zod";
import type { ToolContext } from "./context.js";
import { jsonResult } from "./result.js";
import { isoDateInput, isoToApiDate } from "../dates.js";
import {
  OCCURRENCE_CLASSIFICATIONS,
  OCCURRENCE_TYPES_TEXT,
  occurrenceClassificationWriteInput,
  occurrenceTypeIdInput,
} from "../occurrence-types.js";
import { cpfInput } from "../text.js";

/** Tools de escrita de Ocorrências. Só são registradas quando a escrita está permitida (ADR 0002). */
export function registerOccurrenceWriteTools({ server, client, allowWrites }: ToolContext): void {
  if (!allowWrites) return;

  server.registerTool(
    "create_occurrence",
    {
      description: [
        "Registra uma Ocorrência na Sólides para um Colaborador (por exemplo Atraso, Advertência ou Feedback). Altera dados reais da empresa.",
        "Antes de chamar, confirme com o usuário o Colaborador, o tipo, a data, a classificação e o comentário; só registre depois que ele confirmar.",
        "A Ocorrência é identificada pelo CPF do Colaborador: obtenha o CPF pelo `list_employees` (o `get_occurrences` não traz o CPF).",
        `Feedback é a Ocorrência do tipo 10. Tipos (número do \`type\`): ${OCCURRENCE_TYPES_TEXT}.`,
        "Devolve a Ocorrência criada.",
      ].join(" "),
      inputSchema: {
        cpf: cpfInput.describe("CPF do Colaborador, com ou sem formatação (campo `idNumber` do `list_employees`)."),
        date: isoDateInput.describe("Data da Ocorrência (AAAA-MM-DD)."),
        classification: occurrenceClassificationWriteInput.describe("Classificação: `positive` (Positivo) ou `negative` (Negativo)."),
        type: occurrenceTypeIdInput.describe(`Tipo da Ocorrência, de 1 a 12: ${OCCURRENCE_TYPES_TEXT}.`),
        comment: z.string().optional().describe("Comentário da Ocorrência."),
        value: z.number().optional().describe("Valor da Ocorrência, quando o tipo tiver um (por exemplo, desconto)."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ cpf, date, classification, type, comment, value }) =>
      jsonResult(
        await client.request("POST", "/ocorrencias", {
          body: {
            idNumber: cpf,
            incidentDate: isoToApiDate(date),
            classification: OCCURRENCE_CLASSIFICATIONS[classification],
            typeIncidentId: type,
            ...(comment !== undefined ? { comment } : {}),
            ...(value !== undefined ? { value } : {}),
          },
        }),
      ),
  );

  server.registerTool(
    "delete_occurrence",
    {
      description: [
        "Exclui uma Ocorrência da Sólides pelo id. A exclusão é definitiva e não pode ser desfeita.",
        "Antes de chamar, confirme com o usuário qual Ocorrência será excluída (use `get_occurrences` para mostrar o registro) e só exclua depois que ele confirmar.",
      ].join(" "),
      inputSchema: {
        id: z.number().int().positive().describe("Id da Ocorrência (campo `id` do `get_occurrences`)."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ id }) => {
      await client.request("DELETE", `/ocorrencias/${id}`);
      return jsonResult({ deleted: true, id });
    },
  );
}
