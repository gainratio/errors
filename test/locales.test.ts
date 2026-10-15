// The shipped Spanish and Portuguese translations, enforced.
//
// `describe(code, params, t)` already looks every code up in YOUR i18next as
// `errors.<code>`. These tests prove the translation files the package ships
// for its built-in codes are complete, keep the same placeholders as the
// English, and actually work when loaded into a real i18next instance.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import i18next, { type i18n } from "i18next";
import { beforeAll, describe, expect, it } from "vitest";
import {
  aiPack,
  bundlePack,
  type Catalog,
  corePack,
  defineErrorsWith,
  starterPack,
  type TFunction,
} from "../src/index.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LOCALES = ["es", "pt"] as const;

interface Resource {
  readonly [key: string]: string | Resource;
}

function load(locale: string): Resource {
  return JSON.parse(
    readFileSync(join(ROOT, "locales", `${locale}.json`), "utf8"),
  ) as Resource;
}

/** Flatten nested i18next JSON into `a.b.c -> string`. */
function flatten(resource: Resource, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(resource)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const PACKS: readonly Catalog[] = [corePack, aiPack, bundlePack, starterPack];

/** Every built-in code, with every English template any pack gives it. */
function builtInEnglish(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const pack of PACKS) {
    for (const [code, entry] of Object.entries(pack)) {
      out.set(code, [...(out.get(code) ?? []), entry.en ?? ""]);
    }
  }
  return out;
}

/** Placeholder names in an English catalog template: `{name}`. */
const englishSlots = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();

/** Placeholder names in an i18next string: `{{name}}`. */
const i18nextSlots = (text: string): string[] =>
  [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1] as string).sort();

const ENGLISH = builtInEnglish();
const EXPECTED_KEYS = [...ENGLISH.keys()]
  .map((code) => `errors.${code}`)
  .sort();

describe.each(LOCALES)("locales/%s.json", (locale) => {
  const strings = flatten(load(locale));

  it("has a sentence for every built-in code, and nothing else", () => {
    expect(EXPECTED_KEYS).toHaveLength(24);
    expect([...strings.keys()].sort()).toEqual(EXPECTED_KEYS);
  });

  it("never leaves a sentence empty or in English", () => {
    for (const [key, text] of strings) {
      const code = key.slice("errors.".length);
      expect(text.trim(), key).not.toBe("");
      expect(ENGLISH.get(code), key).not.toContain(text);
    }
  });

  it("keeps exactly the placeholders the English uses", () => {
    for (const [key, text] of strings) {
      const code = key.slice("errors.".length);
      for (const english of ENGLISH.get(code) ?? []) {
        expect(i18nextSlots(text), key).toEqual(englishSlots(english));
      }
    }
  });

  it("uses i18next's {{name}} placeholders, never a bare {name}", () => {
    for (const [key, text] of strings) {
      expect(text.replace(/\{\{\s*\w+\s*\}\}/g, ""), key).not.toMatch(/[{}]/);
    }
  });
});

describe("the shipped translations in a real i18next", () => {
  const errors = defineErrorsWith({}, corePack, aiPack, bundlePack);
  let instance: i18n;
  // No cast: i18next's own `t` must be accepted as-is, even under
  // `exactOptionalPropertyTypes` (this repo's tsconfig). `pnpm typecheck` is the
  // test for that.
  const tFor = (lng: string) => instance.getFixedT(lng);

  beforeAll(async () => {
    instance = i18next.createInstance();
    await instance.init({
      fallbackLng: "en",
      resources: {
        es: { translation: load("es") },
        pt: { translation: load("pt") },
      },
    });
  });

  it("describes every registered code in Spanish and Portuguese", () => {
    const es = flatten(load("es"));
    const pt = flatten(load("pt"));
    for (const code of errors.codes) {
      const params = { field: "API_KEY" };
      const expectEs = es
        .get(`errors.${code}`)
        ?.replace("{{field}}", "API_KEY");
      const expectPt = pt
        .get(`errors.${code}`)
        ?.replace("{{field}}", "API_KEY");
      expect(errors.describe(code, params, tFor("es")), code).toBe(expectEs);
      expect(errors.describe(code, params, tFor("pt")), code).toBe(expectPt);
    }
  });

  it("accepts i18next's bound `t` and an old-style TFunction alike", () => {
    instance.changeLanguage("es");
    expect(errors.describe("request.cancelled", {}, instance.t)).toBe(
      "Se canceló la solicitud.",
    );
    const legacy: TFunction = (key) =>
      key === "errors.request.cancelled" ? "x" : key;
    expect(errors.describe("request.cancelled", {}, legacy)).toBe("x");
  });

  it("fills placeholders: config.missing names the setting", () => {
    expect(
      errors.describe("config.missing", { field: "API_KEY" }, tFor("es")),
    ).toBe("Falta un ajuste obligatorio: API_KEY.");
  });

  it("serves a regional locale from its base language: pt-BR -> pt", () => {
    expect(errors.describe("http.rate_limited", {}, tFor("pt-BR"))).toBe(
      "Muitas solicitações. Aguarde um momento e tente de novo.",
    );
  });

  it("falls back to the catalog's English for an unknown locale, never throws", () => {
    const english = errors.describe("http.rate_limited");
    expect(english).toBe("Too many requests. Wait a moment and try again.");
    expect(errors.describe("http.rate_limited", {}, tFor("fr"))).toBe(english);
    expect(errors.describe("http.rate_limited", {}, tFor("en"))).toBe(english);
  });

  it("keeps the starter pack's own English when only en is loaded", () => {
    // starterPack and aiPack word two codes differently. No en.json ships, so
    // the English a registry was built with always wins.
    const legacy = defineErrorsWith({}, starterPack);
    expect(legacy.describe("ai.config.no_key", {}, tFor("en"))).toBe(
      starterPack["ai.config.no_key"].en,
    );
  });

  it("puts the translation in a Problem Details title, code and type unchanged", () => {
    const params = { retryAfter: 30 };
    const english = errors.toProblemDetails("http.rate_limited", params);
    const spanish = errors.toProblemDetails("http.rate_limited", params, {
      title: errors.describe("http.rate_limited", params, tFor("es")),
    });
    expect(spanish).toEqual({
      ...english,
      title: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
    });
    expect(spanish.type).toBe("http.rate_limited");
  });
});

describe("the package ships the translation files", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    files: string[];
    exports: Record<string, unknown>;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  it("publishes the locales folder", () => {
    expect(pkg.files).toContain("locales");
    for (const locale of LOCALES) {
      expect(existsSync(join(ROOT, "locales", `${locale}.json`))).toBe(true);
    }
  });

  it("exports them as @gainratio/errors/locales/<lang>.json", () => {
    expect(pkg.exports["./locales/*.json"]).toBe("./locales/*.json");
  });

  it("still has no runtime or peer dependencies", () => {
    expect(pkg.dependencies ?? {}).toEqual({});
    expect(pkg.peerDependencies ?? {}).toEqual({});
  });
});
