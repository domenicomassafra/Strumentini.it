import { IMAGE_FAMILY_CAPABILITIES_028, IMAGE_FAMILY_NOTES_028 } from "../../../engines/image/family-capabilities-028";

export function ImageFamilyCapabilities028() {
  return <details data-image-family-matrix-028>
    <summary>Formati e limiti della famiglia immagini</summary>
    <table><thead><tr><th scope="col">Ingresso</th><th scope="col">Compressione</th><th scope="col">Conversione</th></tr></thead>
      <tbody>{IMAGE_FAMILY_CAPABILITIES_028.map((row) => <tr key={row.input} data-evidence={row.evidence}>
        <th scope="row">{row.input}</th><td>{row.compression}</td><td>{row.conversion}</td>
      </tr>)}</tbody>
    </table>
    <ul>{IMAGE_FAMILY_NOTES_028.map((note) => <li key={note}>{note}</li>)}</ul>
  </details>;
}
