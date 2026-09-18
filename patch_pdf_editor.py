import json

with open("src/locales/ko/guides.json", "r", encoding="utf-8") as f:
    ko = json.load(f)

# 1. Integrate pdfEditor blocks to standard and convert
if "pdfEditor" in ko:
    pdf_blocks_ko = ko["pdfEditor"].get("blocks", [])
    pdf_faqs_ko = ko["pdfEditor"].get("faq", {})
    
    ko["pdfEditor.standard"]["blocks"].extend(pdf_blocks_ko)
    ko["pdfEditor.convert"]["blocks"].extend(pdf_blocks_ko)
    
    ko["pdfEditor.standard"]["faq"].update(pdf_faqs_ko)
    ko["pdfEditor.convert"]["faq"].update(pdf_faqs_ko)

    # Add these faqs to pathFaqs for /tools/pdf-editor (standard) and /tools/pdf-editor/convert (convert)
    # Actually standard doesn't have /tools/pdf-editor in pathFaqs? Let's check
    if "/tools/pdf-editor" not in ko["pdfEditor.standard"].get("pathFaqs", {}):
        if "pathFaqs" not in ko["pdfEditor.standard"]: ko["pdfEditor.standard"]["pathFaqs"] = {}
        ko["pdfEditor.standard"]["pathFaqs"]["/tools/pdf-editor"] = list(ko["pdfEditor.standard"]["faq"].keys())

    # Delete the standalone pdfEditor
    del ko["pdfEditor"]

# 2. Add documentCompare new faqs to pathFaqs
dc_ko = ko.get("documentCompare", {})
if "pathFaqs" in dc_ko:
    if "/tools/document-compare" in dc_ko["pathFaqs"]:
        # faq_1, faq_2, faq_3 are there. Add new_faq_4 and 5?
        # Actually new_faq_4 and 5 are about "reading the changes". Better for results page!
        if "/tools/document-compare/results/:pairNumber" not in dc_ko["pathFaqs"]:
            dc_ko["pathFaqs"]["/tools/document-compare/results/:pairNumber"] = []
        dc_ko["pathFaqs"]["/tools/document-compare/results/:pairNumber"].extend(["new_faq_4", "new_faq_5"])

with open("src/locales/ko/guides.json", "w", encoding="utf-8") as f:
    json.dump(ko, f, ensure_ascii=False, indent=2)


with open("src/locales/en/guides.json", "r", encoding="utf-8") as f:
    en = json.load(f)

if "pdfEditor" in en:
    pdf_blocks_en = en["pdfEditor"].get("blocks", [])
    pdf_faqs_en = en["pdfEditor"].get("faq", {})
    
    en["pdfEditor.standard"]["blocks"].extend(pdf_blocks_en)
    en["pdfEditor.convert"]["blocks"].extend(pdf_blocks_en)
    
    en["pdfEditor.standard"]["faq"].update(pdf_faqs_en)
    en["pdfEditor.convert"]["faq"].update(pdf_faqs_en)

    if "/tools/pdf-editor" not in en["pdfEditor.standard"].get("pathFaqs", {}):
        if "pathFaqs" not in en["pdfEditor.standard"]: en["pdfEditor.standard"]["pathFaqs"] = {}
        en["pdfEditor.standard"]["pathFaqs"]["/tools/pdf-editor"] = list(en["pdfEditor.standard"]["faq"].keys())

    del en["pdfEditor"]

dc_en = en.get("documentCompare", {})
if "pathFaqs" in dc_en:
    if "/tools/document-compare/results/:pairNumber" not in dc_en["pathFaqs"]:
        dc_en["pathFaqs"]["/tools/document-compare/results/:pairNumber"] = []
    dc_en["pathFaqs"]["/tools/document-compare/results/:pairNumber"].extend(["new_faq_4", "new_faq_5"])

with open("src/locales/en/guides.json", "w", encoding="utf-8") as f:
    json.dump(en, f, ensure_ascii=False, indent=2)

print("pdfEditor and documentCompare patched")
