import { describe, expect, it } from "vitest";
import { defineErrors } from "../src/index.js";

const errors = defineErrors({
  "api.multi": {
    category: "request",
    en: "The request was rejected.",
    httpStatus: [400, 422],
  },
  "api.one": {
    category: "request",
    en: "The request was rejected once.",
    httpStatus: [409],
  },
  "internal.unknown": {
    category: "internal",
    en: "Something went wrong.",
  },
});

describe("problemFor preserves the observed status", () => {
  it("uses the status that matched, not the first status the code registers", () => {
    expect(errors.problemFor({ status: 422 }, { field: "email" }).status).toBe(
      422,
    );
    expect(errors.problemFor({ status: 400 }).status).toBe(400);
  });

  it("still uses the single registered status for a one-status code", () => {
    expect(errors.problemFor({ status: 409 }).status).toBe(409);
  });

  it("omits status when the raw failure has none", () => {
    expect(errors.problemFor({ message: "boom" }).status).toBeUndefined();
  });

  it("lets the caller override the observed status", () => {
    expect(errors.problemFor({ status: 422 }, {}, { status: 502 }).status).toBe(
      502,
    );
  });

  it("keeps the classified code and its params", () => {
    const body = errors.problemFor({ status: 422 }, { field: "email" });
    expect(body.type).toBe("api.multi");
    expect(body.field).toBe("email");
  });
});
