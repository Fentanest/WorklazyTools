import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { defaultLanguage, languageFromPath } from "./languages";
import { resources } from "./resources";

const initialLanguage = typeof window === "undefined"
  ? defaultLanguage
  : languageFromPath(window.location.pathname) ?? defaultLanguage;

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: defaultLanguage,
  supportedLngs: ["ko", "en"],
  defaultNS: "common",
  ns: ["common", "tools", "features", "pages", "seo"],
  returnNull: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
