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
