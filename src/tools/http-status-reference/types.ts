import type { DeveloperWebResult } from "../../engines/developer-web";

export interface HttpStatusReferenceInput { status: number | string }
export interface HttpStatusReferenceOutput extends DeveloperWebResult { status: number; class: string; reason: string }
