import fs from "fs";

function processLang(lang) {
  const feat = JSON.parse(fs.readFileSync(`src/locales/${lang}/features.json`, "utf-8"));
  const guides = JSON.parse(fs.readFileSync(`src/locales/${lang}/guides.json`, "utf-8"));
  
  if (guides.documentRedactor && guides.documentRedactor.fallbackNotice) {
     feat.documentRedactor.fallbackNotice = guides.documentRedactor.fallbackNotice;
     delete guides.documentRedactor.fallbackNotice;
  }
  
  fs.writeFileSync(`src/locales/${lang}/features.json`, JSON.stringify(feat, null, 2));
  fs.writeFileSync(`src/locales/${lang}/guides.json`, JSON.stringify(guides, null, 2));
}

processLang("ko");
processLang("en");

// Now fix the TSX
function fixTSX(file) {
  let content = fs.readFileSync(file, "utf-8");
  
  // Remove `c.guide && ` and change `c.guide.fallbackNotice` to `c.fallbackNotice`
  content = content.replace(/\{c\.guide\s*&&\s*(<ToolGuideWrapper[\s\S]*?)<\/ToolGuideWrapper>\}/g, '{$1</ToolGuideWrapper>}');
  
  // What if it's self closing?
  content = content.replace(/\{c\.guide\s*&&\s*(<ToolGuideWrapper[^>]*\/>)\}/g, '$1');
  
  content = content.replace(/c\.guide\.fallbackNotice/g, 'c.fallbackNotice');
  
  fs.writeFileSync(file, content);
}

fixTSX("src/features/document-redactor/DocumentRedactorPage.tsx");
fixTSX("src/features/document-redactor/DocumentRedactorFallback.tsx");

