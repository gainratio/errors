# Contributing

Thanks for taking a look. This is a small library and the bar is simple: a
change ships with a test, and `pnpm gate` is green.

## Setup

New here? [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) walks you from a
fresh clone to a first change, with a map of the code.

You need Node >= 22.13 and pnpm. The exact Node version CI uses is 24.

```bash
git clone https://github.com/gainratio/errors.git
cd errors
pnpm install
pnpm gate
```

`pnpm gate` runs lint (biome), typecheck (tsc), tests with coverage (vitest),
and the build — the same command, in the same order, that CI runs. If it passes
locally it should pass in CI. If it doesn't, that gap is a bug worth reporting.

## Making a change

1. Branch off `main`.
2. **Write the failing test first.** Watch it fail for the right reason, then
   make it pass. Bug fixes start with a test that reproduces the bug.
3. Run `pnpm gate`. Coverage is enforced at 100% — statements, branches,
   functions and lines. The library is pure logic with no I/O, so there is no
   honest reason for a line to be unreachable from a unit test.
4. Title the commit (or the squash-merge) as a
   [conventional commit](https://www.conventionalcommits.org/): `feat: ...`
   for something new, `fix: ...` for a bug. That line becomes the CHANGELOG
   entry, so do not edit `CHANGELOG.md` by hand.
5. Open a pull request describing what changed and why.

`pnpm lint:fix` will fix formatting for you. `pnpm test:watch` is the fast loop.

## Things that will be pushed back on

- **Renaming a shipped error code.** A code is a public API contract. Deprecate
  it and add a new one; never rename in place.
- **Adding a runtime dependency.** Zero dependencies is a feature of this
  package, not an accident. If you genuinely need one, make the case in the
  issue before writing the code.
- **Widening the surface without a use case.** New exports need a caller.

## Reporting bugs

Open an issue with the version you're on, what you passed in, what you got back,
and what you expected. A failing test is the best possible bug report.

For anything security-related, see [SECURITY.md](./SECURITY.md) — do not open a
public issue.

## How to release

Releasing is merging one pull request. Nobody tags or publishes by hand.

1. Merge `feat:` and `fix:` changes to `main` as usual.
2. [release-please](https://github.com/googleapis/release-please) keeps one
   pull request open, titled `chore(main): release <version>`. It bumps
   `package.json`, writes the `CHANGELOG.md` entry from those commit messages,
   and updates the version that `docs/API.md` and `docs/ARCHITECTURE.md` name.
   `feat:` bumps the minor version, `fix:` the patch (while we are below 1.0,
   a breaking change bumps the minor). `docs:`, `chore:`, `ci:`, `test:`, and
   `refactor:` commits do not open a release on their own.
3. Read the release PR. Its CI (`gate` and the secret scan) is started for it
   automatically. When it is green, merge it.
4. That merge is the release. release-please tags `v<version>` on the merge
   commit and creates the GitHub release, then starts `publish.yml` at that
   tag. `publish.yml` re-runs the gate, packs the tarball, publishes it to npm
   with provenance over OIDC, and fails unless npm then serves that version.
5. Check it: `npm view @gainratio/errors version` prints the new version.

If a publish fails, fix forward with a new release. An npm version can never
be published twice. Pushing a `v*` tag by hand still runs `publish.yml` the
same way, but it is the fallback, not the routine.
