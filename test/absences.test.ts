import { afterEach, describe, expect, it } from "vitest";
import { allAbsences } from "./fixtures/absences.js";
import { connect, textOf, type TestHarness } from "./helpers/mcp.js";

let h: TestHarness;
afterEach(async () => {
  await h?.close();
});

async function getAbsences(args: Record<string, unknown> = {}) {
  return h.client.callTool({ name: "get_absences", arguments: args });
}

describe("get_absences: lista geral", () => {
  it("busca GET /absenteismos e troca o employee completo por {id, name}", async () => {
    h = await connect({ "GET /absenteismos": allAbsences });

    const result = await getAbsences();

    expect(result.isError).toBeFalsy();
    const body = JSON.parse(textOf(result));
    expect(body.total).toBe(3);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
    expect(body.items[0]).toEqual({
      id: 1,
      dateTimeAbsenteeism: "11/07/2017 08:30:00",
      type: "Chegada",
      location: "Belo Horizonte",
      tangerinoId: 100,
      note: "Observação do Absenteísmo",
      employee: { id: 1, name: "Maria de Fátima Souza" },
    });
    expect(textOf(result)).not.toContain("11223344556");
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({
      method: "GET",
      host: "app.solides.com",
      path: "/absenteismos",
      query: {},
    });
  });
});
