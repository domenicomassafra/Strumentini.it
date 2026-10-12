# Strumentini.it agent contract

**Owner-global instruction priority:** before changing this project, load the shared DStack coding-agent contract from `~/.dstack/contracts/shared-root/AGENTS.md`. It controls delivery across Codex/Pi/OMP and overrides any weaker local shipping convention. This project file adds Strumentini-specific domain and verification constraints; it cannot downgrade `PUSH_VERIFIED` to a local commit or a green test.

## Canonical context

- The only canonical code repository is this checkout; use `main` with `origin/main`. Before mutation, verify `git status`, ongoing file ownership, and the original ticket in `.scratch/strumentini-expansion-20261005/` plus current project state (`PROJECT-STATUS.md`, relevant docs).
- The live dashboard `npm run tickets:check` is the ticket authority. Do not infer an original ticket DONE from an isolated worker regression or from a tool-specific Gold fixture. New work must close existing ticket acceptance or explain the exact outstanding gate.
- Browser, PDF, file, mobile-device, authenticity and release claims require the relevant native real-consumer evidence; a synthetic engine fixture cannot replace physical iOS/Android, true PDF reparse or current deployed source fingerprint. Never silently promote experimental/noncatalog routes into Gold or production.

## Worker → integrator → main

- Delegated workers own disjoint explicit files and report proof. Only one integrator reviews/absorbs into canonical `main`, runs proportionate validation, commits a coherent owned-file change, pushes `origin main`, and checks the remote SHA. Before sending another wave, integrate or explicitly classify the previous worker result. Never `git add -A`, force-push, delete dirty branches, reset unrelated work or claim success from an unpublished test.
- Use `python3 ~/.dstack/scripts/verify_main_delivery.py --repo . --check` to distinguish `PUSHED_CLEAN` from dirty WIP, local ahead or divergence. If blocked, give the exact files/owner and next step as `BLOCKED_UNPUSHED`, not a misleading `DONE`.
- Pushing source and releasing Cloudflare assets are distinct. The public deployment must match a separately certified source commit; never bypass stale Gold receipts, physical-device evidence, security/source provenance or rollback requirements just to make a deploy green.
