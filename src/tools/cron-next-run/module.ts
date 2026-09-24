import { createDeveloperWebModule } from "../../engines/developer-web";
import type { CronNextRunInput, CronNextRunOutput } from "./types";

const module = createDeveloperWebModule("cron-next-run");
export default module;
export type { CronNextRunInput, CronNextRunOutput };
