import { createDeveloperWebModule } from "../../engines/developer-web";
import type { HttpStatusReferenceInput, HttpStatusReferenceOutput } from "./types";

const module = createDeveloperWebModule("http-status-reference");
export default module;
export type { HttpStatusReferenceInput, HttpStatusReferenceOutput };
