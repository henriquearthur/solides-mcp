import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Dois projetos: o Node cobre núcleo e stdio; o Workers roda o Worker no runtime da Cloudflare.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: ["test/**/*.test.ts"],
          exclude: ["test/worker/**"],
        },
      },
      {
        plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.toml" } })],
        test: {
          name: "worker",
          include: ["test/worker/**/*.test.ts"],
        },
      },
    ],
  },
});
