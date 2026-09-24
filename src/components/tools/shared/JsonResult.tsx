export function JsonResult({ value }: { readonly value: unknown }) {
  return <pre class="json-result">{JSON.stringify(value, null, 2)}</pre>;
}
