import { corePack, defineErrorsWith } from "@gainratio/errors";
import es from "@gainratio/errors/locales/es.json" with { type: "json" };
import pt from "@gainratio/errors/locales/pt.json" with { type: "json" };
import i18next from "i18next";

const errors = defineErrorsWith({}, corePack);

// Load the Spanish and Portuguese files that ship with the package into your
// own i18next. English needs no file: it comes from the list of codes.
await i18next.init({
  fallbackLng: "en",
  // describe() returns plain text, like its English. Escape it where you
  // render it, not here, or "/" comes back as "&#x2F;".
  interpolation: { escapeValue: false },
  resources: { es: { translation: es }, pt: { translation: pt } },
});

const code = errors.classify({ status: 429 }); // always "http.rate_limited"

for (const language of ["en", "es", "pt-BR", "fr"]) {
  const t = i18next.getFixedT(language);
  console.log(language.padEnd(6), errors.describe(code, {}, t));
}

// Values fill in the same way in every language.
const t = i18next.getFixedT("es");
console.log(
  errors.describe("config.missing", { field: "Settings / AI key" }, t),
);

// On the wire, only the title changes. The code and type never do.
const body = errors.toProblemDetails(
  code,
  {},
  { title: errors.describe(code, {}, t) },
);
console.log(JSON.stringify(body));
