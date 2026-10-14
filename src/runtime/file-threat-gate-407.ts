/**
 * #407: Conservative, bounded checks performed before a file is offered to a
 * converter. Passing these checks never certifies a document as safe: e.g. a
 * PDF can contain uninspected objects and a ZIP can contain nested archives.
 * The caller is responsible for limiting input/reads, and for downstream
 * parser-specific quotas and isolation.
 */
export type FileThreatFinding407 = Readonly<{
  reason: "MALFORMED" | "POLYGLOT" | "TOO_LARGE" | "UNSUPPORTED";
  message: string;
}>;

export const FILE_THREAT_LIMITS_407 = {
  maxPdfWindowBytes: 128 * 1024,
  maxTextPartBytes: 128 * 1024,
  maxTotalTextBytes: 256 * 1024,
  maxTextParts: 32,
  maxZipPathDepth: 32,
  maxZipPathCharacters: 1024,
} as const;

const reject = (reason: FileThreatFinding407["reason"], message: string): FileThreatFinding407 => ({reason, message});

/** No extraction occurs here; refuse names that become dangerous on common file systems. */
export function checkZipPath407(path: string): FileThreatFinding407 | null {
  const normalized = path.normalize("NFKC");
  // Query/fragment suffixes can conceal the true SVG/XML extension in a URL;
  // Windows-forbidden characters and encoded separators are ambiguous too.
  const specialSyntax = /[?*"<>|#]|%(?:00|2e|2f|3a|3f|23|5c)/iu;
  if (!path || path.length > FILE_THREAT_LIMITS_407.maxZipPathCharacters ||
    path.startsWith("/") || path.includes("\\") || path.includes(":") ||
    /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(path) ||
    /^[A-Za-z]:/u.test(path) || normalized.startsWith("/") || normalized.includes("\\") || normalized.includes(":") ||
    normalized.includes("//") || specialSyntax.test(path) || specialSyntax.test(normalized)) {
    return reject("MALFORMED", "ZIP has a dangerous or excessively long member path.");
  }
  const segments = path.endsWith("/") ? path.slice(0, -1).split("/") : path.split("/");
  const normalizedSegments = normalized.endsWith("/") ? normalized.slice(0,-1).split("/") : normalized.split("/");
  if (segments.length > FILE_THREAT_LIMITS_407.maxZipPathDepth ||
    normalizedSegments.length !== segments.length ||
    normalizedSegments.length > FILE_THREAT_LIMITS_407.maxZipPathDepth ||
    normalizedSegments.some((part) => !part || part === "." || part === ".." || /[. ]$/u.test(part) ||
      // CONIN$ and CONOUT$ refer to Windows console devices even below an
      // ordinary-looking directory. Reject extension variants conservatively
      // because behavior depends on the target filesystem/Windows version.
      /^(?:con|conin\$|conout\$|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part))) {
    return reject("MALFORMED", "ZIP contains path traversal or ambiguous member paths.");
  }
  return null;
}

/** The central directory's platform/type hints must not describe links/devices. */
export function checkZipEntryType407(
  madeBy: number,
  externalAttributes: number,
  name: string,
): FileThreatFinding407 | null {
  const host = madeBy >>> 8;
  if (host === 3 || host === 19) { // UNIX or macOS
    const mode = (externalAttributes >>> 16) & 0xffff;
    const kind = mode & 0xf000;
    if (kind !== 0 && kind !== (name.endsWith("/") ? 0x4000 : 0x8000)) {
      return reject("UNSUPPORTED", "ZIP members cannot be links, devices or mismatched directories.");
    }
  }
  // DOS reparse points / directory attributes cannot be trusted as ordinary files.
  const dosAttributes = externalAttributes & 0xff;
  if ((dosAttributes & 0x10) !== 0 && !name.endsWith("/")) {
    return reject("UNSUPPORTED", "ZIP directory attributes conflict with its member name.");
  }
  return null;
}

export function textPartKind407(name: string): "xml" | "svg" | "html" | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".svg") || lower.endsWith(".svgz")) return "svg";
  if (lower.endsWith(".xml") || lower.endsWith(".rels") || lower === "[content_types].xml") return "xml";
  if (lower.endsWith(".html") || lower.endsWith(".htm") || lower.endsWith(".xhtml")) return "html";
  return null;
}

/** Mask well-terminated HTML5 comments and HTML-context RCDATA bodies before
 * navigation/CSS/markup inspection. Quotes inside tag attributes cannot open
 * comments. Text inside <textarea>/<title> cannot create actual DOM elements.
 * Preserve length and refuse malformed/ambiguous or unclosed structures.
 */
function withoutInertHtmlMarkup407(source: string): string | null {
  // Preserve previous HTML5 acceptance byte-for-byte when there is no
  // comment/RCDATA syntax to resolve at all.
  if (!source.includes("<!-") && !/<(?:textarea|title)(?=[\s/>])/iu.test(source)) return source;
  const pieces: string[] = [];
  let cursor = 0;
  let retainedStart = 0;
  let foreignDepth = 0;
  while (cursor < source.length) {
    const opening = source.indexOf("<", cursor);
    if (opening < 0) break;
    if (source.startsWith("<!--", opening)) {
      const close = source.indexOf("-->", opening + 4);
      // A nested opener or alternate HTML5 error-recovery terminator is
      // ambiguous; refuse instead of assuming the same recovered DOM.
      const body = close < 0 ? "" : source.slice(opening + 4, close);
      if (close < 0 || body.startsWith(">") || body.startsWith("->") ||
          body.includes("--!>") || body.includes("<!--")) return null;
      pieces.push(source.slice(retainedStart, opening), " ".repeat(close + 3 - opening));
      cursor = close + 3;
      retainedStart = cursor;
      continue;
    }
    if (source.startsWith("<!-", opening)) return null;
    // Skip a complete ordinary tag, respecting quotes. This ensures a
    // literal `<!--` in an attribute is not mistaken for an inert comment.
    let at = opening + 1;
    if (source[at] === "/" || source[at] === "!" || source[at] === "?") at++;
    if (!/[a-z]/iu.test(source[at] ?? "")) { cursor = opening + 1; continue; }
    while (at < source.length) {
      const char = source[at]!;
      if (char === ">") break;
      if (char === "=") {
        // HTML5 quotes are only delimiters *at the start* of an attribute
        // value. A quote inside an unquoted value is literal, not an opener.
        at++;
        while (at < source.length && /[ \t\r\n\f]/u.test(source[at]!)) at++;
        if (source[at] === '"' || source[at] === "'") {
          const quote = source[at++]!;
          while (at < source.length && source[at] !== quote) at++;
          if (at === source.length) return null;
          at++;
        } else {
          while (at < source.length && !/[ \t\r\n\f>]/u.test(source[at]!)) at++;
        }
        continue;
      }
      at++;
    }
    if (at === source.length) return null;
    const foreignTag = /^<(\/)?(?:svg|math)(?=[\s/>])/iu.exec(source.slice(opening, opening + 12));
    if (foreignTag) {
      if (foreignTag[1] === "/") foreignDepth = Math.max(0, foreignDepth - 1);
      else if (source[at - 1] !== "/") foreignDepth++;
    }
    const rcdataTag = /^<(textarea|title)(?=[\s/>])/iu.exec(source.slice(opening, opening + 12));
    if (rcdataTag && foreignDepth === 0) {
      const bodyStart = at + 1;
      // HTML5 appropriate end tags close RCDATA even with discarded end-tag
      // attributes (e.g. </textarea class="note"> or </title id="ref">).
      // Requiring only whitespace followed immediately by > falsely denies
      // valid parse5-recovered documents. First match the name boundary,
      // then consume the bounded end-tag attributes while respecting quotes.
      const closePattern = rcdataTag[1]!.toLowerCase() === "textarea"
        ? /<\/textarea(?=[ \t\r\n\f/>])/giu : /<\/title(?=[ \t\r\n\f/>])/giu;
      closePattern.lastIndex = bodyStart;
      const close = closePattern.exec(source);
      if (!close) return null;
      let closeEnd = closePattern.lastIndex;
      let closingQuote: string | null = null;
      while (closeEnd < source.length) {
        const char = source[closeEnd]!;
        if (closingQuote !== null) {
          if (char === closingQuote) closingQuote = null;
        } else if (char === '"' || char === "'") {
          closingQuote = char;
        } else if (char === ">") {
          closeEnd++;
          break;
        } else if (char === "<") {
          // Recovery from an incomplete end-tag token is ambiguous.
          return null;
        }
        closeEnd++;
      }
      if (closingQuote !== null || source[closeEnd - 1] !== ">") return null;
      pieces.push(source.slice(retainedStart, bodyStart), " ".repeat(close.index - bodyStart));
      retainedStart = close.index;
      cursor = closeEnd;
      continue;
    }
    cursor = at + 1;
  }
  if (!pieces.length) return source;
  pieces.push(source.slice(retainedStart));
  return pieces.join("");
}

/** Bounded HTML5 start-tag inspection: quotes in unquoted values are literal. */
function hasUnsafeHtmlNavigation407(source: string): boolean {
  const space = (character: string | undefined): boolean =>
    character !== undefined && /[ \t\r\n\f]/u.test(character);
  const starts = /<\s*(meta|img|image|source|link|video|audio|track|input|a|area|form|button)(?=[\s/>])/giu;
  let start: RegExpExecArray | null;
  while ((start = starts.exec(source)) !== null) {
    const tag = start[1]?.toLowerCase();
    let at = starts.lastIndex;
    let terminated = false;
    while (at < source.length) {
      while (space(source[at])) at++;
      if (source[at] === ">") { at++; terminated = true; break; }
      if (source[at] === "/" && source[at + 1] === ">") { at += 2; terminated = true; break; }
      if (source[at] === "/") { at++; continue; }

      const nameStart = at;
      while (at < source.length && !space(source[at]) &&
        source[at] !== "=" && source[at] !== ">" && source[at] !== "/") at++;
      if (at === nameStart) return true; // Ambiguous malformed start tag: refuse.
      const name = source.slice(nameStart, at).toLowerCase();
      while (space(source[at])) at++;
      if (source[at] !== "=") continue;
      at++;
      while (space(source[at])) at++;

      let value: string;
      if (source[at] === '"' || source[at] === "'") {
        const quote = source[at++];
        const valueStart = at;
        while (at < source.length && source[at] !== quote) at++;
        if (at === source.length) return true; // Unclosed quote: do not guess.
        value = source.slice(valueStart, at++);
      } else {
        const valueStart = at;
        // HTML5 unquoted values may contain ' or ": neither opens a quote.
        while (at < source.length && !space(source[at]) && source[at] !== ">") at++;
        value = source.slice(valueStart, at);
      }
      if (tag === "meta" && name === "http-equiv" && (value.includes("&") || value.trim().toLowerCase() === "refresh")) {
        return true;
      }
      // HTML5 loads responsive-image URLs from srcset on img/source (even when
      // src= is absent), and from imagesrcset on image-preload links. Relative
      // URLs also resolve against an eventual browser URL outside this ZIP.
      // Allow only genuinely empty values: HTML5 srcset whitespace is ASCII;
      // Unicode spaces such as NBSP are part of a URL, not separators.
      if (((tag === "img" || tag === "image" || tag === "source") && name === "srcset") ||
        (tag === "link" && name === "imagesrcset")) {
        if (/[^ \t\r\n\f]/u.test(value)) return true;
      }
      // Ordinary HTML5 media URLs can also be unquoted (or recovered after
      // malformed quotes and slash-delimited attributes). Checking raw quoted
      // src=/href= substrings does not cover the browser's actual URL values.
      // Conservatively refuse nonempty URLs, including relative and entity-
      // encoded forms whose destination depends on the eventual document URL.
      const mediaSource = name === "src" &&
        (tag === "img" || tag === "image" || tag === "source" || tag === "video" ||
         tag === "audio" || tag === "track" || tag === "input");
      const videoPoster = tag === "video" && name === "poster";
      // HTML5 parses unquoted xlink:href on an SVG <a> into a real
      // namespaced navigation link, even though it is not valid standalone
      // XML and therefore escapes the XML quoted-attribute scan below.
      const navigationLink = (name === "href" || name === "xlink:href") &&
        (tag === "a" || tag === "area" || tag === "link");
      const formNavigation = (tag === "form" && name === "action") ||
        ((tag === "button" || tag === "input") && name === "formaction");
      if (value.length > 0 && (mediaSource || videoPoster || navigationLink || formNavigation)) {
        // Same-document anchors never resolve outside this HTML document.
        if (!navigationLink || !/^#[a-z_][\w.:-]*$/iu.test(value)) return true;
      }
    }
    if (!terminated) return true; // Truncated meta tag is ambiguous.
    starts.lastIndex = at; // Each inspected byte is visited at most once.
  }
  return false;
}

/** Decode only for conservative CSS resource checks, never for rendering. */
function decodedCssEscapes407(source: string): string {
  return source.replace(/\\([0-9a-f]{1,6})(?:\r\n|[ \t\r\n\f])?|\\([^\r\n\f0-9a-f])/giu,
    (_whole, hex: string | undefined, escaped: string | undefined) => {
      if (!hex) return escaped ?? "";
      const codePoint = Number.parseInt(hex, 16);
      return String.fromCodePoint(codePoint > 0 && codePoint <= 0x10ffff ? codePoint : 0xfffd);
    });
}

/** XML/HTML character references are decoded before CSS is parsed. A raw
 * style="fill:url&#40;...&#41;" therefore becomes an active CSS url() even
 * though neither the original url() check nor CSS backslash decoding sees it.
 * Keep this scan linear and inside the detector's bounded text-part budget.
 */
function hasUnsafeCssAttribute407(source: string, html5: boolean): boolean {
  // CSS Images permits remote resources as quoted strings inside image-set(),
  // without a url() token; CSS-escaped function names work in browsers too.
  // Inspect only CSS-bearing attributes, not inert text or data-* metadata.
  if (!source.includes("&") && !/image-set|\\/iu.test(source)) return false;
  const imageSet = /(?:^|[^\w-])(?:-webkit-)?image-set\s*\(/iu;
  // HTML5 treats a slash in the before-attribute-name state as a separator,
  // even without preceding whitespace (<div/style=...>). XML does not.
  const attributes = /(?:^|[ \t\r\n\f</])(?:style|fill|stroke|filter|clip-path|mask|marker-(?:start|mid|end)|cursor)[ \t\r\n\f]*=/giu;
  const space = (character: string | undefined): boolean =>
    character !== undefined && /[ \t\r\n\f]/u.test(character);
  let match: RegExpExecArray | null;
  while ((match = attributes.exec(source)) !== null) {
    if (!html5 && match[0].startsWith("/")) continue;
    let at = attributes.lastIndex;
    while (space(source[at])) at++;
    const start = at;
    if (source[at] === "'" || source[at] === '"') {
      const quote = source[at++];
      while (at < source.length && source[at] !== quote) at++;
      // Refuse ambiguous CSS-bearing attributes with an unclosed quote.
      if (at === source.length) return true;
      at++;
    } else {
      // HTML5 treats a quote *inside* an unquoted value as an ordinary
      // character. XML requires the quoted branch above.
      while (at < source.length && !space(source[at]) && source[at] !== ">") at++;
    }
    const rawValue = source.slice(start, at);
    if (rawValue.includes("&") || imageSet.test(rawValue) ||
        (rawValue.includes("\\") && imageSet.test(decodedCssEscapes407(rawValue)))) return true;
    attributes.lastIndex = at;
  }
  // SVG <style> elements are already forbidden by the existing active-element
  // gate below; HTML <style> raw text does not decode character references.
  return false;
}

/** Never parse XML with a DOM here: refuse entity resolution and active markup. */
export function checkTextPart407(source: string, kind: "xml" | "svg" | "html"): FileThreatFinding407 | null {
  if (kind === "html") {
    const visibleMarkup = withoutInertHtmlMarkup407(source);
    if (visibleMarkup === null) {
      return reject("UNSUPPORTED", "Malformed or unterminated HTML comment/RCDATA cannot be safely inspected.");
    }
    source = visibleMarkup;
  }
  // XML namespace prefixes can use Unicode characters; ASCII \w is not
  // sufficient to recognize active names in a well-formed SVG/XML ZIP part.
  // Match through XML name delimiters; never let the HTML meta guard below
  // regress the existing Unicode-prefix refusal.
  if (/<!\s*(?:DOCTYPE|ENTITY)\b|<\?\s*xml-stylesheet\b|<\s*(?:xi:include|xinclude:include)\b|http:\/\/www\.w3\.org\/2001\/XInclude/iu.test(source) ||
    /\bxmlns(?::[^\t\r\n <>/:=]+)?\s*=\s*["'][^"']*&/iu.test(source)) {
    return reject("UNSUPPORTED", "Embedded XML document type, entities, stylesheets or includes are not supported.");
  }
  if (kind === "html") {
    // Meta refresh and responsive image srcset/imagesrcset load URLs without
    // src=, href= or CSS url(). HTML5 also recovers malformed attribute quotes.
    // Entity-bearing http-equiv values remain conservatively unsupported.
    if (hasUnsafeHtmlNavigation407(source)) {
      return reject("UNSUPPORTED", "HTML navigation or responsive image sources are outside the local inspection profile.");
    }
  }
  // XML entity references are decoded by downstream parsers: an attribute such
  // as TargetMode="Ex&#x74;ernal" must not evade an external-link refusal.
  if (/\b(?:TargetMode|Target|schemaLocation|noNamespaceSchemaLocation|href|src)\s*=\s*["'][^"']*&/iu.test(source) ||
    /\b(?:TargetMode|schemaLocation|noNamespaceSchemaLocation)\s*=\s*["'][^"']*(?:external|https?:\/\/|file:\/\/)/iu.test(source) ||
    /\b(?:Target|href|src|schemaLocation|noNamespaceSchemaLocation)\s*=\s*["']\s*(?:https?:|ftp:|file:|data:|javascript:|vbscript:|\/\/|\\\\)/iu.test(source)) {
    return reject("UNSUPPORTED", "External XML package references are outside the local inspection profile.");
  }
  // XML namespace aliases can give <s:script> exactly the same active meaning
  // as <script>; inspection cannot assume the element has no prefix.
  if (/<\s*(?:[^\t\r\n <>/:]+:)?(?:script|iframe|object|embed)\b|\bon(?:load|error|click|mouseover|focus|begin|end)\s*=/iu.test(source)) {
    return reject("UNSUPPORTED", "Executable XML markup or event handlers are not supported.");
  }
  // A ZIP can store a genuine SVG document under an .xml member name.
  if (kind === "svg" || kind === "html" || /<\s*(?:[^\t\r\n <>/:]+:)?svg\b/iu.test(source)) {
    if (hasUnsafeCssAttribute407(source, kind === "html")) {
      return reject("UNSUPPORTED", "CSS attributes with entities or image-set resources cannot be trusted before XML/HTML/CSS decoding.");
    }
    if (/<\s*(?:[^\t\r\n <>/:]+:)?(?:foreignObject|base|link|use|image|feImage|style|animate(?:Motion|Transform|Color)?|set|discard|handler)\b|\bon[a-z]{3,}\s*=|\b(?:href|src|xlink:href)\s*=\s*["'][^"']*&|\b(?:href|src|xlink:href)\s*=\s*["']\s*(?:https?:|file:|data:|javascript:|vbscript:|\/\/)|\burl\s*\(|@import/iu.test(source)) {
      return reject("UNSUPPORTED", "Executable or external SVG/HTML content is outside the inspection profile.");
    }
    // An SVG <a href="relative.svg"> is not contained by its ZIP parent:
    // resolving it against the eventual browser/document URL can navigate or
    // fetch outside the archive. xml:base redirects *even otherwise relative*
    // references. Keep only same-document #fragment hrefs in this conservative
    // preflight; ordinary OOXML Relationship Target="media/x.png" is separate.
    if (/\bxml:base\s*=/iu.test(source)) {
      return reject("UNSUPPORTED", "SVG/XML base URI can redirect relative links outside the local document.");
    }
    for (const link of source.matchAll(/\b(?:href|src)\s*=\s*(["'])([^"']*)\1/giu)) {
      if (!/^#[a-z_][\w.:-]*$/iu.test(link[2] ?? "")) {
        return reject("UNSUPPORTED", "SVG/HTML references must remain in the same document, not resolve external resources.");
      }
    }
    // A CSS declaration such as fill:u\72 l(https://host/x.svg) is parsed
    // by Chromium's CSSOM as fill:url("https://host/x.svg"), while raw
    // regexes looking only for 'url(' miss it. Decode *bounded* CSS escapes
    // for the rejection check (not rendering/reconstructing the SVG). A
    // literal url(#local) remains disallowed, matching the existing policy.
    if (source.includes("\\")) {
      const cssDecoded = decodedCssEscapes407(source);
      if (/\burl\s*\(|@import/iu.test(cssDecoded)) {
        return reject("UNSUPPORTED", "CSS-escaped external SVG resources are outside the local inspection profile.");
      }
    }
  }
  if (/\b(?:javascript|vbscript)\s*:/iu.test(source)) {
    return reject("UNSUPPORTED", "Active script references in an XML package are not supported.");
  }
  return null;
}

/** Bounded PDF lexical pass for additional action subtypes. PDF literal and
 * hexadecimal strings are *data*, even if their text spells `/S /Named`.
 * Comments are insignificant between two genuine PDF name tokens. This is
 * not an object-graph parser and does not certify compressed/unseen streams.
 */
function hasUnsafePdfActionSubtype407(source: string): boolean {
  const active = new Set(["named", "hide", "resetform", "setocgstate", "sound", "movie"]);
  const blockedNames = new Set([
    "javascript", "js", "launch", "embeddedfile", "richmedia", "xfa", "openaction", "aa",
    "submitform", "importdata", "gotor", "gotoe", "uri", "rendition",
  ]);
  const delimiter = (char: string): boolean => /[\s\u0000()<>\[\]{}\/%]/u.test(char);
  let precedingSubtypeKey = false;
  let at = 0;
  while (at < source.length) {
    const current = source[at]!;
    if (current === "%") {
      // A PDF comment ends at CR or LF, and is lexical whitespace.
      while (at < source.length && source[at] !== "\r" && source[at] !== "\n") at++;
      continue;
    }
    if (/\s|\u0000/u.test(current)) { at++; continue; }
    if (current === "(") {
      let depth = 1;
      at++;
      while (at < source.length && depth > 0) {
        if (source[at] === "\\") {
          at += 2; // Escaped parentheses/backslashes are not delimiters.
        } else if (source[at] === "(") {
          depth++; at++;
        } else if (source[at] === ")") {
          depth--; at++;
        } else at++;
      }
      precedingSubtypeKey = false;
      continue;
    }
    if (current === "<" && source[at + 1] === "<") {
      // `<<` is a dictionary delimiter, not a hexadecimal string.
      at += 2;
      precedingSubtypeKey = false;
      continue;
    }
    if (current === "<") {
      // The raw bytes of a PDF hexadecimal string aren't name tokens.
      at++;
      while (at < source.length && source[at] !== ">") at++;
      at++;
      precedingSubtypeKey = false;
      continue;
    }
    if (current === "/") {
      const start = ++at;
      while (at < source.length && !delimiter(source[at]!)) at++;
      // PDF name escapes are *data inside the current NAME token*. Only
      // unescape after consuming its raw syntax: /a#25b means name /a%b,
      // not a '%' comment that swallows every subsequent action on the line.
      const token = source.slice(start, at)
        .replace(/#([0-9a-f]{2})/giu, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
        .toLowerCase();
      if (blockedNames.has(token) || (precedingSubtypeKey && active.has(token))) return true;
      precedingSubtypeKey = token === "s";
      continue;
    }
    precedingSubtypeKey = false;
    at++;
  }
  return false;
}

/** Searches observed PDF bytes only. Hidden compressed PDF objects remain unverified. */
export function checkPdfBytes407(bytes: Uint8Array): FileThreatFinding407 | null {
  // Latin-1 maps each byte to a code point and does not replace invalid
  // UTF-8. Crucially, do NOT decode PDF #xx escapes globally: a name's #25
  // must never become a raw '%' comment delimiter for the surrounding PDF.
  const observed = new TextDecoder("iso-8859-1").decode(bytes);
  // PDF annotation actions may live in indirect /A or /Next dictionaries,
  // without /OpenAction or /AA. Named/Print can invoke a viewer command,
  // Hide changes annotation state and ResetForm/SetOCGState mutate viewer
  // state without a network URL. Preserve internal-only GoTo actions. Do not
  // treat arbitrary /Named or /Hide mentions in literal text as actions.
  if (hasUnsafePdfActionSubtype407(observed)) {
    return reject("UNSUPPORTED", "Observed PDF contains an active action or embedded content reference.");
  }
  return null;
}
