export type RuntimeLocation = "LOCAL" | "REFERENCE" | "REMOTE";
export type MaintenanceClass = "E" | "D" | "R" | "H" | "S";

export interface ProfileFieldDeclaration {
  key: string;
  defaultValue?: unknown;
  sensitive?: boolean;
}

export interface ToolManifest {
  id: string;
  route: string;
  name: string;
  summary: string;
  aliases: readonly string[];
  jobs: readonly string[];
  category: string;
  inputTypes: readonly string[];
  implementation: string;
  engine: string;
  runtime: {
    location: RuntimeLocation;
    network: "forbidden" | "reference-only" | "required";
  };
  profileFields: readonly ProfileFieldDeclaration[];
  gold: {
    maintenanceClass: MaintenanceClass;
    oracleEntryId: string;
    fixtureFamilies: readonly string[];
  };
}

export type ToolSummary = Omit<ToolManifest, "implementation">;
