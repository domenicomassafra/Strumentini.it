import { createDeveloperWebModule } from "../../engines/developer-web";
import type { QueryStringEditorInput, QueryStringEditorOutput } from "./types";

const module = createDeveloperWebModule("query-string-editor");
export default module;
export type { QueryStringEditorInput, QueryStringEditorOutput };
