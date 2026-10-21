import { registerDepartmentTools } from "./departments.js";
import type { RegisterTools } from "./context.js";

/** Para adicionar tools: crie um módulo em src/core/tools e registre-o aqui. */
export const toolModules: RegisterTools[] = [registerDepartmentTools];
