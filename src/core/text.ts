import { z } from "zod";

/** Minúsculas, sem acentos e sem espaços nas pontas. Base de toda comparação de texto livre. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** `haystack` contém `needle` como trecho, sem diferenciar acentos nem maiúsculas. */
export function includesText(haystack: string | null | undefined, needle: string): boolean {
  return normalizeText(haystack ?? "").includes(normalizeText(needle));
}

/** Só os dígitos de um valor (ex.: CPF "123.456.789-09" -> "12345678909"). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Mesmo CPF, ignorando a formatação. Completa com zeros à esquerda porque a V3 devolve o CPF em
 * número (`ratedDocument`), o que apaga os zeros iniciais.
 */
export function sameCpf(a: string, b: string): boolean {
  return digitsOnly(a).padStart(11, "0") === digitsOnly(b).padStart(11, "0");
}

/** CPF de entrada das tools: com ou sem formatação, exatamente 11 dígitos. Entrega só os dígitos. */
export const cpfInput = z
  .string()
  .transform(digitsOnly)
  .refine((cpf) => cpf.length === 11, "CPF inválido. Informe os 11 dígitos.");
