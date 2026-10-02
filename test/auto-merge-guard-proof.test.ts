import { expect, it } from "vitest";

// Deliberately failing. This branch exists only to prove that GitHub
// auto-merge does not merge a PR whose required check is red. Never merge.
it("auto-merge guard proof: this assertion fails on purpose", () => {
  expect(1).toBe(2);
});
