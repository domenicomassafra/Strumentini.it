import { createDeveloperWebModule } from "../../engines/developer-web";
import type { HtmlEntityCodecInput, HtmlEntityCodecOutput } from "./types";

const module = createDeveloperWebModule("html-entity-codec");
export default module;
export type { HtmlEntityCodecInput, HtmlEntityCodecOutput };
