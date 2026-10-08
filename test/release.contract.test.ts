// Release contract: the version a tag publishes is the version the docs name.
//
// publish.yml refuses a tag that differs from package.json, but nothing checked
// that the CHANGELOG and the docs moved with it. A release that bumps only
// package.json ships an npm page whose changelog and API guide name the old
// version. String checks only, on purpose.
//
// Since release-please took over versioning, the release PR it opens is what
// moves all of these together. The second half of this file pins the config
// that makes it do so: a release PR that forgets a doc fails `gate` here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");
const VERSION = (JSON.parse(read("package.json")) as { version: string })
  .version;

/**
 * The exact owner this repository lives under. It moved from the hseshadr
 * account to the gainratio org. A literal list, never a pattern:
 * release-please writes compare links under the owner the repo has.
 */
const RELEASE_OWNERS = ["gainratio"] as const;
const REPO_URL = "https://github.com/gainratio/errors";

/**
 * A released CHANGELOG heading, in either shape this file holds:
 *   `## [0.2.0] - 2026-09-26`  (hand-written, Keep a Changelog, up to 0.2.1)
 *   `## [0.2.2](https://github.com/.../compare/v0.2.1...v0.2.2) (2026-10-03)`
 *   `### [0.2.2](...) (2026-10-03)`  (release-please writes H3 for patches)
 */
const RELEASED_HEADING = new RegExp(
  String.raw`^###? \[(\d+\.\d+\.\d+)\](?: - |\(https:\/\/github\.com\/(?:${RELEASE_OWNERS.join("|")})\/errors\/compare\/v\d+\.\d+\.\d+\.\.\.v\1\) \()(\d{4}-\d{2}-\d{2})\)?$`,
  "gm",
);

const newestRelease = (changelog: string): string | undefined =>
  [...changelog.matchAll(RELEASED_HEADING)][0]?.[1];

describe("release contract", () => {
  it("package.json holds a plain semver version", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("the newest CHANGELOG release is the package.json version", () => {
    expect(newestRelease(read("CHANGELOG.md"))).toBe(VERSION);
  });

  it.each(["docs/API.md", "docs/ARCHITECTURE.md"])(
    "%s names the package.json version",
    (path) => {
      const named = [...read(path).matchAll(/\bv(\d+\.\d+\.\d+)\b/g)].map(
        (m) => m[1],
      );
      expect(named.length).toBeGreaterThan(0);
      expect(new Set(named)).toEqual(new Set([VERSION]));
    },
  );
});

describe("npm provenance repository match", () => {
  // npm's OIDC trusted publishing refuses a tarball whose repository.url is
  // not the GitHub repo that ran publish.yml (ENEEDAUTH). The repo is
  // gainratio/errors, so the manifest has to say so, byte for byte.
  const manifest = JSON.parse(read("package.json")) as {
    homepage: string;
    repository: { type: string; url: string };
    bugs: { url: string };
  };

  it("points repository.url at gainratio/errors", () => {
    expect(manifest.repository).toEqual({
      type: "git",
      url: `git+${REPO_URL}.git`,
    });
  });

  it("points homepage and bugs at gainratio/errors", () => {
    expect(manifest.homepage).toBe(`${REPO_URL}#readme`);
    expect(manifest.bugs.url).toBe(`${REPO_URL}/issues`);
  });
});

describe("the CHANGELOG heading rule itself", () => {
  it.each([
    ["a Keep a Changelog heading", "## [0.2.0] - 2026-09-26", "0.2.0"],
    [
      "a release-please minor heading",
      "## [0.3.0](https://github.com/gainratio/errors/compare/v0.2.1...v0.3.0) (2026-10-03)",
      "0.3.0",
    ],
    [
      "a release-please patch heading",
      "### [0.2.2](https://github.com/gainratio/errors/compare/v0.2.1...v0.2.2) (2026-10-03)",
      "0.2.2",
    ],
    [
      "a release-please heading written after the move to the gainratio org",
      "## [0.3.1](https://github.com/gainratio/errors/compare/v0.3.0...v0.3.1) (2026-10-08)",
      "0.3.1",
    ],
  ])("reads %s", (_label, heading, version) => {
    expect(newestRelease(`# Changelog\n\n${heading}\n`)).toBe(version);
  });

  it.each([
    ["the Unreleased placeholder", "## [Unreleased]"],
    ["a heading with no date", "## [0.2.2]"],
    [
      "a compare link that ends at another version",
      "## [0.2.2](https://github.com/gainratio/errors/compare/v0.2.1...v0.2.3) (2026-10-03)",
    ],
    [
      "a compare link to another repository",
      "## [0.2.2](https://github.com/someone/else/compare/v0.2.1...v0.2.2) (2026-10-03)",
    ],
    [
      "a compare link under hseshadr, the owner this repository left",
      "## [0.3.1](https://github.com/hseshadr/errors/compare/v0.3.0...v0.3.1) (2026-10-08)",
    ],
    [
      "a compare link to errors under an owner outside the allow-list",
      "## [0.3.1](https://github.com/attacker/errors/compare/v0.3.0...v0.3.1) (2026-10-08)",
    ],
    [
      "a compare link to an owner that merely starts with an allowed one",
      "## [0.3.1](https://github.com/gainratio-evil/errors/compare/v0.3.0...v0.3.1) (2026-10-08)",
    ],
  ])("ignores %s", (_label, heading) => {
    expect(newestRelease(`# Changelog\n\n${heading}\n`)).toBeUndefined();
  });
});

// RELEASE-PLEASE — merging the release PR is the release. It bumps
// package.json, writes the CHANGELOG entry, and rewrites the version the docs
// name; merging it tags `v<version>` and dispatches publish.yml.
interface ExtraFile {
  readonly type: string;
  readonly path: string;
}
interface PackageConfig {
  readonly "release-type": string;
  readonly "package-name": string;
  readonly "include-component-in-tag": boolean;
  readonly "include-v-in-tag": boolean;
  readonly "changelog-path": string;
  readonly "extra-files": readonly ExtraFile[];
}
interface ReleasePleaseConfig {
  readonly packages: Readonly<Record<string, PackageConfig>>;
}

const MARKER = "x-release-please-version";
const DOCS_NAMING_VERSION = ["docs/API.md", "docs/ARCHITECTURE.md"];

/** release-please's own changelog insertion point (src/updaters/changelog.ts). */
const RELEASE_PLEASE_INSERTS_BEFORE = /\n###? v?[0-9[]/s;

describe("release-please", () => {
  const config = (): ReleasePleaseConfig =>
    JSON.parse(read("release-please-config.json")) as ReleasePleaseConfig;
  const root = (): PackageConfig | undefined => config().packages["."];

  it("tracks the released version in its manifest", () => {
    const manifest = JSON.parse(read(".release-please-manifest.json"));
    expect(manifest).toEqual({ ".": VERSION });
  });

  it("releases the root package as a node package", () => {
    expect(Object.keys(config().packages)).toEqual(["."]);
    expect(root()?.["release-type"]).toBe("node");
    expect(root()?.["package-name"]).toBe("@gainratio/errors");
    expect(root()?.["changelog-path"]).toBe("CHANGELOG.md");
  });

  it("tags `v<version>`, the shape publish.yml accepts", () => {
    // A component prefix (`errors-v0.2.2`) would fail publish.yml's
    // tag == "v" + package.json version check, and release-please could not
    // find the hand-made v0.2.1 tag to start from.
    expect(root()?.["include-component-in-tag"]).toBe(false);
    expect(root()?.["include-v-in-tag"]).toBe(true);
  });

  it.each(DOCS_NAMING_VERSION)(
    "rewrites the version %s names on every line that names it",
    (path) => {
      expect(root()?.["extra-files"]).toContainEqual({ type: "generic", path });
      const unmarked = read(path)
        .split("\n")
        .filter((line) => /\bv\d+\.\d+\.\d+\b/.test(line))
        .filter((line) => !line.includes(MARKER));
      expect(unmarked).toEqual([]);
    },
  );

  it("inserts the next entry below the intro, not above a placeholder", () => {
    // release-please puts the new entry before the first match of its header
    // regex. `## [Unreleased]` matches it, so the new release would land ABOVE
    // the placeholder. The placeholder is gone; the first match must be a
    // real release.
    const changelog = read("CHANGELOG.md");
    const at = changelog.search(RELEASE_PLEASE_INSERTS_BEFORE);
    expect(at).toBeGreaterThan(0);
    const firstHeading = changelog.slice(at + 1).split("\n")[0] ?? "";
    expect(newestRelease(firstHeading)).toBe(VERSION);
  });
});
