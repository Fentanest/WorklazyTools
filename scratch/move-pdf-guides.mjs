import fs from "fs";

function process(lang) {
  const featPath = `src/locales/${lang}/features.json`;
  const guidePath = `src/locales/${lang}/guides.json`;
  
  const feat = JSON.parse(fs.readFileSync(featPath, "utf-8"));
  const guides = JSON.parse(fs.readFileSync(guidePath, "utf-8"));
  
  if (feat.pdf && feat.pdf.page && feat.pdf.page.guides) {
    guides["pdfEditor.standard"] = feat.pdf.page.guides.standard;
    guides["pdfEditor.convert"] = feat.pdf.page.guides.convert;
    delete feat.pdf.page.guides;
  }
  
  // also merge seo faqs for pdfEditor
  // wait, seo faqs were already added to pdfEditor in guides.json?
  // Let's check guides["pdfEditor"]
  if (guides["pdfEditor"]) {
    // move its faqs and pathFaqs to pdfEditor.standard
    if (!guides["pdfEditor.standard"].faq) guides["pdfEditor.standard"].faq = {};
    if (!guides["pdfEditor.standard"].pathFaqs) guides["pdfEditor.standard"].pathFaqs = {};
    
    guides["pdfEditor.standard"].faq = { ...guides["pdfEditor.standard"].faq, ...guides["pdfEditor"].faq };
    guides["pdfEditor.standard"].pathFaqs = { ...guides["pdfEditor.standard"].pathFaqs, ...guides["pdfEditor"].pathFaqs };
    
    delete guides["pdfEditor"];
  }

  fs.writeFileSync(featPath, JSON.stringify(feat, null, 2));
  fs.writeFileSync(guidePath, JSON.stringify(guides, null, 2));
}

process("ko");
process("en");
