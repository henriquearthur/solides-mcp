import { registerDepartmentTools } from "./departments.js";
import { registerAbsenceTools } from "./absences.js";
import { registerEmployeeTools } from "./employees.js";
import { registerOccurrenceTools } from "./occurrences.js";
import { registerOccurrenceWriteTools } from "./occurrence-writes.js";
import { registerPositionTools } from "./positions.js";
import { registerProfilerTools } from "./profiler.js";
import { registerResumeTools } from "./resumes.js";
import type { RegisterTools } from "./context.js";

/** Para adicionar tools: crie um módulo em src/core/tools e registre-o aqui. */
export const toolModules: RegisterTools[] = [
  registerDepartmentTools,
  registerEmployeeTools,
  registerPositionTools,
  registerProfilerTools,
  registerResumeTools,
  registerAbsenceTools,
  registerOccurrenceTools,
  registerOccurrenceWriteTools,
];
