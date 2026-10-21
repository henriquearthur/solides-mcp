import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";

const BASE = "https://exemplo.test";

it("recusa /mcp sem access token", async () => {
  const response = await exports.default.fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  expect(response.status).toBe(401);
  expect(response.headers.get("www-authenticate")).toContain("Bearer");
});
