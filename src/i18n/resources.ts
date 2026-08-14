import commonEn from "../locales/en/common.json";
import seoEn from "../locales/en/seo.json";
import toolsEn from "../locales/en/tools.json";
import pagesEn from "../locales/en/pages.json";
import featuresEn from "../locales/en/features.json";
import commonKo from "../locales/ko/common.json";
import seoKo from "../locales/ko/seo.json";
import toolsKo from "../locales/ko/tools.json";
import pagesKo from "../locales/ko/pages.json";
import featuresKo from "../locales/ko/features.json";

export const resources = {
  ko: { common: commonKo, tools: toolsKo, features: featuresKo, pages: pagesKo, seo: seoKo },
  en: { common: commonEn, tools: toolsEn, features: featuresEn, pages: pagesEn, seo: seoEn },
} as const;

export type TranslationResources = typeof resources.ko;
