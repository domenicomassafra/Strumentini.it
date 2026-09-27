# Core engine spike seams

These seams are the lane-approved public behavior surface. Tests exercise only
these exports.

| Family           | Public seam                                                                                                          | Deterministic policy                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Text             | `inspectText`, `normalizeWhitespace`, `findInvisibleCharacters`                                                      | counts use Unicode code points; line endings normalize to LF; no locale-dependent tokenization                     |
| Lists            | `sortLines`, `dedupeLines`, `compareLists`, `diffText`                                                               | UTF-16 lexical sort; first-seen order for set outputs; line LCS diff                                               |
| URL              | `parseUrl`, `normalizeUrl`, `cleanTrackingUrl`                                                                       | WHATWG URL; query key sort for normalization; conservative known-tracker removal                                   |
| UTM              | `buildUtmUrl`, `parseUtmUrl`                                                                                         | overwrite only UTM fields; required source/medium/campaign                                                         |
| Dates            | `addCalendarDays`, `differenceInCalendarDays`, `addBusinessDays`, `durationToDecimalHours`, `decimalHoursToDuration` | ISO calendar dates in UTC; business days are Mon-Fri only                                                          |
| Business math    | `convertRate`, `marginMarkup`, `projectProfitability`, `grossUpForFee`                                               | explicit work-basis assumptions and explicit rounding                                                              |
| Encoding/hash    | `base64EncodeBytes`, `base64DecodeBytes`, UTF-8 wrappers, `digestHex`, `verifyDigestHex`                             | browser-native Base64/TextEncoder/Web Crypto                                                                       |
| Filenames        | `sanitizeFilename`, `planSanitizedRenames`                                                                           | cross-platform-safe conservative filename policy; case-insensitive collision avoidance                             |
| JSON             | `validateJson`, `formatJson`                                                                                         | native JSON grammar; stable error code; formatting only, no schema semantics                                       |
| Profile defaults | `resolveDefaults`                                                                                                    | requested fields only; explicit > profile > tool-default > system-derived; sensitive fields require explicit input |

No UI, network, server, plugin system, CSV/YAML/PDF/image codec, or framework
seam belongs in this spike.
