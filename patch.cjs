const fs = require('fs');
let content = fs.readFileSync('scripts/validate-static-output.mjs', 'utf8');

content = content.replace(
  /const \[koreanFeatures, englishFeatures\] = await Promise.all\(\[\n\s+fs.readFile\("src\/locales\/ko\/guides.json", "utf8"\),\n\s+fs.readFile\("src\/locales\/en\/guides.json", "utf8"\),\n\]\);/,
  `const [koreanFeatures, englishFeatures, koreanGuides, englishGuides] = await Promise.all([
  fs.readFile("src/locales/ko/features.json", "utf8"),
  fs.readFile("src/locales/en/features.json", "utf8"),
  fs.readFile("src/locales/ko/guides.json", "utf8"),
  fs.readFile("src/locales/en/guides.json", "utf8"),
]);`
);

content = content.replace(
  'if (!koreanFeatures.includes("JPG·PNG·WebP를 지원하며 HEIC·HEIF는 지원하지 않습니다")',
  'if (!koreanGuides.includes("JPG·PNG·WebP를 지원하며 HEIC·HEIF는 지원하지 않습니다")'
);

content = content.replace(
  '|| !englishFeatures.includes("JPG, PNG and WebP are supported; HEIC and HEIF are not")) {',
  '|| !englishGuides.includes("JPG, PNG and WebP are supported; HEIC and HEIF are not")) {'
);

content = content.replace(
  /if \(koreanFeatures.includes\(forbidden\) \|\| englishFeatures.includes\(forbidden\)\) throw new Error/g,
  'if (koreanFeatures.includes(forbidden) || englishFeatures.includes(forbidden) || koreanGuides.includes(forbidden) || englishGuides.includes(forbidden)) throw new Error'
);

fs.writeFileSync('scripts/validate-static-output.mjs', content);
