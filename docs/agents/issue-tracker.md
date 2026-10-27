# Issue tracker and workspace setup

## State authority

Use native authenticated `gh` with explicit `--repo domenicomassafra/Strumentini.it`
for approved work. Verify the account and repository before writing; search
existing issues and PRs and update existing issues. GitHub Projects is an optional
view, not a prerequisite. Do not enable automatic or paid agent reviews.

GitHub Issues is the live ticket authority. Historical expansion ticket IDs are
represented as `legacy-expansion:<id>` in the functional audit and renderer
ownership declarations. They are distinct from GitHub issue numbers. Original
historical ticket text remains in Git commit
`7fe2dfd729cfbc3450de3080324a9a1757f0ea28`; do not reinstate a local
ticket queue or treat an old dashboard as current status.

Use `Refs` for partial delivery. Close and read back an original only after all
its acceptance, required install and real consumer proof pass. A branch, PR,
source CI or merged main alone does not prove deployment or runtime acceptance.
An assignee is not an integration lease: keep one actual Git/ref writer and
preserve concurrent work. Follow `AGENTS.md` for the public PR/review/CI path and
the installed DStack `docs/operations/github-issues.md` guide for ticket work.
Never put credentials, tokens or private consumer data in tickets or Git.

## Fresh Orca workspace

Use Node.js 26, npm and Python 3, matching the checked-in CI. The versioned
`orca.yaml` setup installs the root and both standalone spike modules with
their committed npm lockfiles and installs the existing public-PR Git hook.
It neither copies credentials nor links dependency trees from another checkout.
Agent startup waits for successful setup; a failed install or conflicting hook
stops setup. This does not run app acceptance, provision Cloudflare, or deploy.

The repository's Orca setup policy must allow setup and select the shared YAML
command. To run the same setup manually from the repository root:

```sh
npm ci
npm ci --prefix spikes/heavy-local-feasibility
npm ci --prefix spikes/heavy-browser
bash scripts/install-public-git-hooks.sh
```

Some independent consumer tests additionally require ffmpeg and Python packages
installed by `.github/workflows/ci.yml`; dependency setup does not certify those
external runtimes or the original tickets that depend on them.
