#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSolidesServer } from "../core/index.js";
import { StdioConfigError, readStdioConfig } from "./config.js";

try {
  const server = createSolidesServer(readStdioConfig(process.env));
  await server.connect(new StdioServerTransport());
} catch (error) {
  if (error instanceof StdioConfigError) {
    console.error(`solides-mcp: ${error.message}`);
  } else {
    console.error("solides-mcp: falha ao iniciar o servidor.", error);
  }
  process.exit(1);
}
