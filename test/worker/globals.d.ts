// Declara o módulo principal do Worker para `exports.default` ter tipo nos testes.
declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("../../src/worker/index.js");
  }
}
