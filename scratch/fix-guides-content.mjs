import fs from "fs";

function fix(lang) {
  const p = `src/locales/${lang}/guides.json`;
  const guides = JSON.parse(fs.readFileSync(p, "utf-8"));
  
  // Merge excelMerger -> excel
  if (guides.excelMerger && guides.excel) {
    guides.excel.faq = { ...guides.excel.faq, ...guides.excelMerger.faq };
    guides.excel.pathFaqs = { ...guides.excel.pathFaqs, ...guides.excelMerger.pathFaqs };
    delete guides.excelMerger;
  }
  
  // Merge videoStudio -> video.page
  if (guides.videoStudio && guides["video.page"]) {
    guides["video.page"].faq = { ...guides["video.page"].faq, ...guides.videoStudio.faq };
    guides["video.page"].pathFaqs = { ...guides["video.page"].pathFaqs, ...guides.videoStudio.pathFaqs };
    delete guides.videoStudio;
  }

  // Populate video.page titles
  if (lang === "ko") {
    guides["video.page"].title = "브라우저 비디오 처리 안내";
    guides["video.page"].description = "영상 파일은 외부 변환 서버에 업로드하지 않고 이 브라우저에서 처리합니다.";
    
    // officeEditor
    if (guides.officeEditor) {
      guides.officeEditor.title = "브라우저 오피스 편집기 안내";
      guides.officeEditor.description = "LibreOffice를 브라우저에서 실행하는 대용량 편집 기능입니다.";
      guides.officeEditor.blocks = [
        { title: "한 번에 열기", paragraphs: ["지원 파일 한 개를 놓거나 선택하면 집중 작업 화면 이동, 편집기 준비와 문서 열기를 자동으로 이어서 실행합니다."] },
        { title: "초기 다운로드", paragraphs: ["처음 실행할 때는 한글 지원 폰트를 포함해 약 33 MB의 파일을 내려받습니다. 이후로는 브라우저에 저장된 데이터를 사용합니다."] },
        { title: "편집기 닫기", paragraphs: ["'닫기' 버튼을 누르면 편집기와 가상 파일 시스템이 안전하게 소멸되고 이 메뉴로 돌아옵니다."] }
      ];
    }
    // pdfCompare
    if (guides.pdfCompare) {
      guides.pdfCompare.title = "PDF 파일 비교 안내";
      guides.pdfCompare.description = "수정 전후 PDF를 쌍으로 놓고 페이지별 화면과 추출 텍스트 차이를 확인합니다.";
      guides.pdfCompare.blocks = [{title:"안내", paragraphs:["브라우저 내에서 비교가 이루어집니다."]}];
    }
    // documentCompare (if missing)
    if (guides.documentCompare && !guides.documentCompare.title) {
        guides.documentCompare.title = "문서 비교 사용 안내";
        guides.documentCompare.description = "Word와 HWP 문서 계열을 한 화면에서 비교하되 서로 다른 계열의 잘못된 조합은 차단합니다.";
        guides.documentCompare.blocks = [
          { title: "지원 조합", paragraphs: ["DOCX와 DOC는 서로 비교할 수 있고, HWP와 HWPX도 서로 비교할 수 있습니다. Word 문서와 HWP 문서를 한 쌍으로 비교할 수는 없습니다."] },
          { title: "문단 대응 방식", paragraphs: ["모든 지원 형식에 같은 정렬 규칙을 적용해 빈 문단, 가까운 문구 수정, 문단 분할·병합과 문단 이동을 구분합니다."] }
        ];
    }
  } else {
    guides["video.page"].title = "Browser Video Processing Guide";
    guides["video.page"].description = "Video files are processed within this browser without being uploaded to an external conversion server.";
    
    if (guides.officeEditor) {
      guides.officeEditor.title = "Browser office editor guide";
      guides.officeEditor.description = "This large editor runs LibreOffice in your browser.";
      guides.officeEditor.blocks = [
        { title: "One-step opening", paragraphs: ["Drop or choose one supported file to move to the focused workspace, prepare the editor, and open the document automatically."] },
        { title: "First download", paragraphs: ["The first start downloads about 33 MB, including a Korean fallback font. A byte-based progress bar and current step are shown, and the files are cached for later visits."] },
        { title: "Closing editor", paragraphs: ["Pressing the 'Close' button destroys the editing view and the virtual filesystem instance safely, returning you to this menu."] }
      ];
    }
    if (guides.pdfCompare) {
      guides.pdfCompare.title = "PDF comparison guide";
      guides.pdfCompare.description = "Place before and after PDFs in pairs, then inspect visual and extracted-text differences page by page.";
      guides.pdfCompare.blocks = [{title:"Notice", paragraphs:["Comparison is performed within the browser."]}];
    }
    if (guides.documentCompare && !guides.documentCompare.title) {
        guides.documentCompare.title = "Document comparison guide";
        guides.documentCompare.description = "Compare Word and HWP document families in one tool while blocking invalid cross-family pairs.";
        guides.documentCompare.blocks = [
          { title: "Supported pairs", paragraphs: ["DOCX and DOC can be compared with each other. HWP and HWPX can be compared with each other. A Word file cannot be paired with an HWP file."] },
          { title: "How matching works", paragraphs: ["The same alignment rules handle empty paragraphs, nearby edits, paragraph splits or merges, and moved paragraphs for every supported format."] }
        ];
    }
  }
  
  fs.writeFileSync(p, JSON.stringify(guides, null, 2));
}

fix("ko");
fix("en");
