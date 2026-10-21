/**
 * Interpreta o valor de `SOLIDES_ALLOW_WRITES` (stdio e Worker): só o texto `true`, sem diferenciar
 * caixa nem espaços nas pontas, libera a escrita. Ausente ou qualquer outro valor: só leitura.
 */
export function parseAllowWrites(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}
