# 175 — chmod Unix permission helper

**What to build:** Add symbolic↔octal Unix mode conversion and permission explanation without filesystem mutation.

**Traces to:** US-EXP-05

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** None — dependency 91 is completed.

**Status:** completed

**Suggested skills:** code-typescript → code-tdd → inclusive-design

- [x] rwx/octal mappings are bidirectional and exact.
- [x] Special bits are either supported explicitly or refused clearly.
- [x] Result labels owner/group/other permissions accessibly.

**Verification:** Known permission literals and invalid modes.

**Evidence:** `chmodPermissionOperation` converts three/four-digit octal modes and nine-character symbolic modes bidirectionally without filesystem access. setuid, setgid and sticky bits preserve `s/S/t/T` execute semantics; invalid octal/symbolic positions fail explicitly. The structured result labels `owner`, `group`, and `other`, and the shared Result v2 renderer adds an accessible `Permessi per classe` breakdown with `Proprietario`, `Gruppo`, and `Altri`. Focused tests cover ordinary and special-bit round trips plus invalid modes. Focused developer tests pass 39/39; `npx tsc --noEmit --pretty false`, `npm run catalog:check`, direct Astro build (223 pages), and `git diff --check` pass.
