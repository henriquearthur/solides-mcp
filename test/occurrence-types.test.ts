import { describe, expect, it } from "vitest";
import { OCCURRENCE_TYPES, occurrenceTypeIdInput, occurrenceTypeName } from "../src/core/occurrence-types.js";

describe("tabela de tipos de Ocorrência", () => {
  it("traz os 12 tipos da spec da API, com o nome que a API devolve", () => {
    expect(OCCURRENCE_TYPES).toEqual({
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
    });
  });

  it("converte o número no nome", () => {
    expect(occurrenceTypeName(10)).toBe("Feedback");
  });

  it("valida o número do tipo (inteiro de 1 a 12)", () => {
    expect(occurrenceTypeIdInput.safeParse(12).success).toBe(true);
    expect(occurrenceTypeIdInput.safeParse(0).success).toBe(false);
    expect(occurrenceTypeIdInput.safeParse(13).success).toBe(false);
    expect(occurrenceTypeIdInput.safeParse(2.5).success).toBe(false);
  });
});
