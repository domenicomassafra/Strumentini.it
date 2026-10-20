# QR generator — changes

## ISO mask scoring (#339, 2026-10-20)

- Apply the ISO/IEC 18004 N3 penalty for finder-like runs with four clear modules before or after the pattern, in rows and columns, alongside N1/N2/N4.
- The automatically selected mask can change for previously generated payloads. The payload, QR versions 1–4 / level L envelope, SVG reader contract, and explicit mask option are unchanged.
- The donor comparison from #278 observed seven differing automatic masks among 21 inputs before this correction. The current correspondence must be checked again against the independent donor before declaring equivalence.
