import { createDeveloperWebModule } from "../../engines/developer-web";
import type { UrlCodecInput, UrlCodecOutput } from "./types";

const module = createDeveloperWebModule("url-codec");
export default module;
export type { UrlCodecInput, UrlCodecOutput };
