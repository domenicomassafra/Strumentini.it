export function JsonResult({ value }: { readonly value: unknown }) {
  return <pre class="json-result" tabIndex={0} aria-label="JSON result">{JSON.stringify(value, null, 2)}</pre>;
}
