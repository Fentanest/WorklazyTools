import { getGuideData } from "../src/i18n/guideData.ts";
const page = { language: "en", route: "about", title: "About", description: "About page" };
const data = getGuideData(page.language);
console.log(data.pages.about);
