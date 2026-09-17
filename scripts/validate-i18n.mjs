import fs from "fs";
import path from "path";

const langs = ["ko", "en"];
let hasError = false;

for (const lang of langs) {
  const guidePath = path.join("src/locales", lang, "guides.json");
  const guides = JSON.parse(fs.readFileSync(guidePath, "utf-8"));
  
  for (const [slug, guide] of Object.entries(guides)) {
    if (!guide.title || typeof guide.title !== "string" || !guide.title.trim()) {
      console.error(`[${lang}] Guide '${slug}' is missing a valid 'title'`);
      hasError = true;
    }
    if (!guide.description || typeof guide.description !== "string" || !guide.description.trim()) {
      console.error(`[${lang}] Guide '${slug}' is missing a valid 'description'`);
      hasError = true;
    }
    if (!Array.isArray(guide.blocks)) {
      console.error(`[${lang}] Guide '${slug}' is missing a valid 'blocks' array`);
      hasError = true;
    } else {
      guide.blocks.forEach((block, i) => {
        if (!block.title || typeof block.title !== "string" || !block.title.trim()) {
          console.error(`[${lang}] Guide '${slug}' blocks[${i}] is missing a valid 'title'`);
          hasError = true;
        }
      });
    }
    
    if (guide.faq) {
      for (const [k, v] of Object.entries(guide.faq)) {
        if (!v.q || !v.a) {
           console.error(`[${lang}] Guide '${slug}' faq '${k}' is missing q or a`);
           hasError = true;
        }
      }
    }
  }
}

if (hasError) {
  process.exit(1);
}
console.log("i18n validation passed.");
