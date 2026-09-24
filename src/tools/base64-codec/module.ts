import { createDeveloperWebModule } from "../../engines/developer-web";
import type { Base64CodecInput, Base64CodecOutput } from "./types";

const module = createDeveloperWebModule("base64-codec");
export default module;
export type { Base64CodecInput, Base64CodecOutput };
