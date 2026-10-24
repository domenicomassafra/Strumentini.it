import { TableRelations390 } from "../table-relations-390/TableRelations390";
import { DataPipeline391 } from "../table/DataPipeline391";
import { csvJoinManifest } from "../../../tools/csv-join/manifest";

export function CsvJoinTool() {
  return <>
    <TableRelations390 kind="join" manifest={csvJoinManifest} />
    <DataPipeline391 />
  </>;
}
