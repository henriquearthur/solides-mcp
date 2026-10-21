import { registerDepartmentTools } from "./departments.js";
import { registerEmployeeTools } from "./employees.js";
import { registerPositionTools } from "./positions.js";
import type { RegisterTools } from "./context.js";

/** Para adicionar tools: crie um módulo em src/core/tools e registre-o aqui. */
export const toolModules: RegisterTools[] = [registerDepartmentTools, registerEmployeeTools, registerPositionTools];
