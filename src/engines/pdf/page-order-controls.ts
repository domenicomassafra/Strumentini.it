/** UI-only ordering helpers: the existing PDF mutation engine remains authoritative. */
export function movePdfPageId(order: readonly number[], source: number, target: number): number[] {
  if (order.some((page) => !Number.isInteger(page) || page < 1) || new Set(order).size !== order.length) {
    throw new Error("INVALID_INPUT: Ordine pagine non valido o duplicato");
  }
  const start = order.indexOf(source);
  const end = order.indexOf(target);
  if (start < 0 || end < 0) throw new Error("INVALID_INPUT: La pagina non è presente nella selezione");
  if (start === end) return [...order];
  const result = [...order];
  const [page] = result.splice(start, 1);
  result.splice(end, 0, page!);
  return result;
}

export function adjacentPdfPageId(order: readonly number[], source: number, step: -1 | 1): number[] {
  const start = order.indexOf(source);
  if (start < 0) throw new Error("INVALID_INPUT: Pagina non presente");
  const next = start + step;
  if (next < 0 || next >= order.length) return [...order];
  return movePdfPageId(order, source, order[next]!);
}
