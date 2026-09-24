import { createDeveloperWebModule } from "../../engines/developer-web";
import type { CronExplainerInput, CronExplainerOutput } from "./types";

const module = createDeveloperWebModule("cron-explainer");
export default module;
export type { CronExplainerInput, CronExplainerOutput };
