import fs from "fs";
const seoContent = fs.readFileSync("src/app/seo.ts", "utf-8");

// Remove faqByLanguageAndPath
const newContent = seoContent.replace(/const faqByLanguageAndPath:[\s\S]*?(?=\n\nexport interface SocialImageDefinition)/, 
`import { getFaqsForPath } from "../i18n/guideData";`);

fs.writeFileSync("src/app/seo.ts", newContent);
