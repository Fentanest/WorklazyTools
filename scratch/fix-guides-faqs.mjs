import fs from "fs";

function fixFaqs(lang) {
  const p = `src/locales/${lang}/guides.json`;
  const data = JSON.parse(fs.readFileSync(p, "utf-8"));
  
  for (const slug of Object.keys(data)) {
    const guide = data[slug];
    if (guide.faq && Array.isArray(guide.faq)) {
      const obj = {};
      guide.faq.forEach((item, i) => {
         obj[`faq_${i}`] = { q: item.q || item.question, a: item.a || item.answer };
      });
      guide.faq = obj;
    } else if (guide.faq && typeof guide.faq === "object") {
      for (const k of Object.keys(guide.faq)) {
        if (!guide.faq[k].q && guide.faq[k].question) {
          guide.faq[k].q = guide.faq[k].question;
        }
        if (!guide.faq[k].a && guide.faq[k].answer) {
          guide.faq[k].a = guide.faq[k].answer;
        }
      }
    }
  }
  
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

fixFaqs("ko");
fixFaqs("en");
