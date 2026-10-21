import { z } from "zod";

/**
 * Tabela fixa dos tipos de Ocorrência (segundo a spec da API): número -> nome que a API devolve em
 * `typeIncident`. Na leitura o tipo é filtrado pelo nome; na escrita (`typeIncidentId`) vale o número.
 * Leitura (`get_occurrences`) e escrita (`create_occurrence`) devem usar esta mesma tabela.
 */
export const OCCURRENCE_TYPES = {
  1: "Falta/Ausência",
  2: "Atraso",
  3: "Promoção",
  4: "Falha/Erro",
  5: "Ideia / Contribuição",
  6: "Recontratação",
  7: "Outros",
  8: "Advertência",
  9: "Suspensão",
  10: "Feedback",
  11: "Subperformance",
  12: "Folga",
} as const;

export type OccurrenceTypeId = keyof typeof OCCURRENCE_TYPES;

/** Parâmetro de tipo das tools (inteiro de 1 a 12). Sem `.describe`: cada tool descreve o seu uso. */
export const occurrenceTypeIdInput = z
  .number()
  .int()
  .min(1)
  .max(12)
  .transform((id) => id as OccurrenceTypeId);

/** Classificação das Ocorrências nas tools e o nome que a API usa. A escrita aceita só `positive` e `negative`. */
export const OCCURRENCE_CLASSIFICATIONS = {
  positive: "Positivo",
  negative: "Negativo",
  neutral: "Neutro",
  needs_improvement: "Para melhorar",
} as const;

export type OccurrenceClassification = keyof typeof OCCURRENCE_CLASSIFICATIONS;

/** Parâmetro de classificação da escrita (só `positive` e `negative`). Sem `.describe`: cada tool descreve o seu uso. */
export const occurrenceClassificationWriteInput = z.enum(["positive", "negative"]);

/** Parâmetro de classificação da leitura: todas as classificações que a API devolve. */
export const occurrenceClassificationFilterInput = z.enum(
  Object.keys(OCCURRENCE_CLASSIFICATIONS) as [OccurrenceClassification, ...OccurrenceClassification[]],
);

/** Classificações em texto para as descrições: "`positive` (Positivo), `negative` (Negativo), ...". */
export const OCCURRENCE_CLASSIFICATIONS_TEXT = Object.entries(OCCURRENCE_CLASSIFICATIONS)
  .map(([key, name]) => `\`${key}\` (${name})`)
  .join(", ");

/** Nome do tipo como a API o devolve (ex.: 10 -> "Feedback"). */
export function occurrenceTypeName(id: OccurrenceTypeId): string {
  return OCCURRENCE_TYPES[id];
}

/** Tabela em texto para as descrições das tools: "1 Falta/Ausência, 2 Atraso, ...". */
export const OCCURRENCE_TYPES_TEXT = Object.entries(OCCURRENCE_TYPES)
  .map(([id, name]) => `${id} ${name}`)
  .join(", ");
