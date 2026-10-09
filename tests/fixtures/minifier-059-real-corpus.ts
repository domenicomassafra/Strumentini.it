/**
 * #059 compact, deterministic application-shaped inputs, not generator snapshots.
 * These deliberately combine XML mixed text, SSR comments, escaped CSS values,
 * and JSON keys that have security or interoperability significance.
 */
export const html059 = [
  {
    name: "SSR suspense + email preview (text and comments are observable)",
    source: '<main><!--$--><div><p>Buongiorno <strong>Caffè ☕</strong>!</p><p>Vedi&nbsp;<a href="/offerte?c=1&amp;v=2">offerte</a>.</p></div><!--/$--><pre> €  25\n  consegna</pre></main>',
  },
  {
    name: "hydration markers and sensitive form/script data",
    source: '<form><!--ko if: enabled--><label for="x">Sì <em>grazie</em></label><!--/ko--><textarea id="x">  A\n B  </textarea><script type="application/ld+json">{"review":"A  B","ok":true}</script></form>',
  },
  {
    name: "whole HTML document with template and inline SVG",
    source: '<!doctype html><html lang="it"><head><title>Novità &amp; offerte</title></head><body><template id="row"><!-- framework controlled --><b>A  B</b></template><svg xmlns="http://www.w3.org/2000/svg"><text><tspan>R</tspan> <tspan>€</tspan></text></svg></body></html>',
  },
] as const;

export const css059 = [
  {
    name: "cascade layers with nested media and opaque custom tokens",
    source: '@layer reset, components; @layer components { @media (width >= 48rem) { .card:is(:hover,.active) { --font: "A  B"  "C D"; content: "a  b {x} <> ☕"; color: rebeccapurple; } } }',
    requiredTokens: ['"a  b {x} <> ☕"', 'rebeccapurple'],
  },
  {
    name: "data URI, escapes and nested keyframes",
    source: '@keyframes pulse { 0% { opacity: 0; } 100% { opacity: 1; } } .icon::before { content: "a\\A b"; background: url("data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%201%201%22%3E%3C/svg%3E"); }',
    // css-tree canonicalizes hexadecimal CSS escapes to lowercase: same codepoint.
    requiredTokens: ['"a\\a b"', 'data:image/svg+xml'],
  },
  {
    name: "font face and print rules",
    source: '@font-face { font-family: "Scrittura Italiana"; src: url("data:font/woff2;base64,d09GMg==") format("woff2"); font-display: swap; } @media print { .sheet { page-break-before: always; content: "A;B:C"; } }',
    requiredTokens: ['"A;B:C"', 'd09GMg=='],
  },
] as const;

export const xml059 = [
  {
    name: "SVG textPath mixed text, spaces and emoji",
    source: '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><defs><path id="line" d="M0 0L50 0"/></defs><text><textPath href="#line"><tspan>Caffè</tspan>  <tspan>☕</tspan> &amp; tè</textPath></text></svg>',
  },
  {
    name: "XHTML mail text with nested bold and CDATA",
    source: '<message xmlns="urn:example:mail"><p>Gentile <b>Marta</b>, hai <em>2</em> messaggi.</p><preview><![CDATA[<b> A  B </b>]]></preview></message>',
  },
  {
    name: "xml:space preserve inherited and explicit reset on meaningful text",
    source: '<doc xml:space="preserve"><para>  <em>Uno</em> <em>Due</em>  </para><para xml:space="default">A <b>B</b> C</para></doc>',
  },
  {
    name: "SVG whitespace-only text and safe external URL as inert markup",
    source: '<svg xmlns="http://www.w3.org/2000/svg"><text><tspan/>  <tspan/></text><image href="https://outside.invalid/remote.svg"/><script>window.__MUST_NOT_RUN__=true</script></svg>',
  },
] as const;

export const json059 = [
  { name: "JSON-LD with non-BMP Unicode and punctuation", source: '{ "@context":"https://schema.org", "headline":"Caffè ☕ – città", "offers": [ { "price": 12.5, "priceCurrency":"EUR" } ] }' },
  { name: "prototype and constructor keys must stay ordinary data", source: '{ "__proto__": { "isAdmin": true }, "constructor": "ordinary", "prototype": [false, null], "emoji": "🍋" }' },
  { name: "escaped control characters and literal markup", source: '{"html":"<script>not executed</script>","quote":"\\\"ok\\\"","lines":"a\\nb\\tc"}' },
] as const;

export const unknownDirective059 = '<article><!-- wp:paragraph --><p>Contenuto</p><!-- /wp:paragraph --><!--svelte-h0--><span>Testo</span><!--/svelte-h0--></article>';
