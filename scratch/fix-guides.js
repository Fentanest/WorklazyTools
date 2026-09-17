import fs from "fs";

function fixGuides(file) {
  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  
  // merge excelMerger -> excel, pdfEditor -> pdf (wait, pdf.guide?), officeEditor -> office, etc.
  const mergePairs = {
    "excelMerger": "excel",
    "pdfEditor": "pdfEditor", // was it pdfEditor in features.json? Let me check.
    "videoStudio": "video.page", // wait
  };
  
  // Wait, let's just use the `title` to find the real one, or just manually merge.
  // Actually, I can just write a script to look for empty title, and merge it with the one that has title.
  // Let's print empty titles.
  const empty = Object.keys(data).filter(k => !data[k].title);
  console.log("Empty in", file, ":", empty);
}

fixGuides("src/locales/ko/guides.json");
fixGuides("src/locales/en/guides.json");
