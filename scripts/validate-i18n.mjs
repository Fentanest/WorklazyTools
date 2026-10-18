import fs from "fs";
import path from "path";
import { hasPublicationTextMapping } from '../src/features/market-calendar/calendarDisplay.ts';

const langs = ["ko", "en"];
let hasError = false;
const publicationCopy = JSON.parse(fs.readFileSync('src/features/market-calendar/publicationCopy.json', 'utf8'));
const publicationKeys = [...Object.values(publicationCopy.exact), ...Object.values(publicationCopy.prefix), ...publicationCopy.patterns.map(p => p.key), 'specialPublicationDetail', 'reasonPublicationDetail', 'notePublicationDetail', 'scopePublicationDetail', 'otherSession'];
for (const code of ['special_expected', 'forced_unknown', 'early_close', 'year_open']) {
  if (!publicationCopy.exact[code]) {
    console.error(`Market calendar publication code '${code}' has no display mapping`);
    hasError = true;
  }
}
const internalTokens = /special_expected|forced_unknown|early_close|opening_auction|closing_auction|\bexpected\b|special 불일치/;

for (const lang of langs) {
  const calendar = JSON.parse(fs.readFileSync(`src/locales/${lang}/features.json`, 'utf8')).marketCalendar;
  for (const key of publicationKeys) {
    const value = calendar[key];
    if (typeof value !== 'string' || !value.trim() || internalTokens.test(value) || lang === 'en' && /[가-힣]/.test(value)) {
      console.error(`[${lang}] Invalid market calendar publication translation '${key}'`);
      hasError = true;
    }
  }
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

// Optional real publication coverage, including dynamic reasons and scope codes.
// No network or data-branch mutation is needed for this check.
if (process.env.WORKLAZY_MCAL_DATA_DIR) {
  const directory = process.env.WORKLAZY_MCAL_DATA_DIR;
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  const values = manifest.scopes.map(scope => scope.reason).filter(Boolean);
  for (const file of manifest.files) {
    const rows = JSON.parse(fs.readFileSync(path.join(directory, file.path), 'utf8'));
    for (const row of rows) values.push(...[row.special, row.reason, ...row.notes].filter(Boolean));
  }
  for (const value of new Set(values)) {
    if (!hasPublicationTextMapping(value)) {
      console.error(`Market calendar publication text has no translation mapping: ${value}`);
      hasError = true;
    }
  }
  console.log(`Checked ${new Set(values).size} distinct published calendar texts.`);
}

if (hasError) {
  process.exit(1);
}
console.log(`i18n validation passed; ${publicationKeys.length} calendar mappings checked in each language.`);
