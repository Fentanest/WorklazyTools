export default {
  ko: {
    "/tools/document-redactor": [{"question": "개인정보를 자동으로 찾아 주나요?", "answer": "아니요. 가릴 영역을 직접 선택해야 합니다. 선택하지 않은 위치의 개인정보는 남을 수 있으므로 결과를 다시 확인하세요."}, {"question": "PDF의 텍스트와 서명은 유지되나요?", "answer": "모든 페이지를 이미지로 재생성하므로 검색·복사 가능한 텍스트, 전자서명, 양식과 링크는 유지되지 않습니다. 원본 파일은 변경하지 않습니다."}, {"question": "해상도와 파일 크기는 어떻게 되나요?", "answer": "PDF는 선택한 해상도로 저장하며 원본보다 파일이 커질 수 있습니다. 메모리 한도를 넘으면 처리를 중단합니다. 이미지 결과는 PNG입니다."}],
    "/tools/excel-merger": [
      { question: "XLSX 수식과 서식을 따로 보존할 수 있나요?", answer: "가능합니다. XLSX 수식 보존과 서식 보존을 현재 화면에서 각각 선택할 수 있으며 추가 파일을 준비하지 않습니다." },
      { question: "XLS 수식과 서식을 따로 보존할 수 있나요?", answer: "가능합니다. XLS 수식 보존과 XLS 서식 보존을 각각 선택할 수 있으며, 둘 중 하나만 켜도 정밀 변환 화면으로 이동합니다." },
      { question: "보존 옵션을 켜면 모든 XLS 기능이 완전히 유지되나요?", answer: "수식과 일반 셀 서식을 우선 보존하지만 차트, 외부 연결, 매크로와 일부 고급 개체는 달라질 수 있으므로 중요한 결과는 Excel에서 확인하세요." },
    ],
    "/tools/excel-compare": [
      { question: "어떤 Excel 형식을 비교할 수 있나요?", answer: "XLSX, XLSM, XLS, XLSB, SpreadsheetML 형식의 XLS와 CSV를 비교할 수 있습니다. XLS와 XLSB는 값과 수식 비교를 지원하지만 서식 차이는 비교하지 않습니다." },
      { question: "선택된 머리글 후보가 실제 열 이름 행과 다르면 어떻게 하나요?", answer: "각 파일의 머리글 행 입력에서 실제 열 이름이 있는 행을 선택하세요. 선택한 행 다음부터 비교하며, 머리글이 없는 표는 맨 위에 열 이름 행을 추가해야 합니다." },
      { question: "비교한 파일이 서버로 전송되나요?", answer: "아니요. 파일 읽기, 비교와 보고서 생성은 현재 브라우저에서 처리되며 파일 내용을 서버로 보내지 않습니다." },
      { question: "여러 파일 쌍을 한 번에 비교할 수 있나요?", answer: "가능합니다. 각 쌍의 시트와 비교 기준을 따로 정할 수 있고, 성공한 쌍마다 9개 시트의 XLSX 보고서를 받습니다. 성공한 쌍이 둘 이상이면 ZIP도 제공합니다." },
      { question: "같은 키가 여러 행에 있으면 어떻게 표시하나요?", answer: "중복 키 하나를 결과 한 행으로 세고 왼쪽과 오른쪽 원본 행을 독립된 목록으로 보여 줍니다. 두 목록의 같은 줄을 자동으로 연결한 것은 아닙니다." },
    ],
    "/tools/excel-cleaner": [
      { question: "수식이 있는 Excel 파일도 정리할 수 있나요?", answer: "XLSX·XLSM의 같은 시트 일반 A1 참조는 행 삭제와 열 삭제·삽입·재배치에 맞춰 갱신합니다. 그 밖의 수식은 저장 계산값이 모두 있을 때 확인 후 값으로 출력합니다." },
      { question: "CSV 원문 보존과 안전 모드는 무엇이 다른가요?", answer: "원문 보존은 값을 바꾸지 않고 위험 선행 문자를 경고하며 안전하다고 표현하지 않습니다. 안전 모드는 해당 값 앞에 작은따옴표를 붙입니다." },
      { question: "파일과 결과가 서버로 전송되나요?", answer: "아니요. 파일 읽기, 규칙 적용과 XLSX·CSV·ZIP 생성은 현재 브라우저에서 처리되며 원본 파일은 변경하지 않습니다." },
    ],
    "/tools/document-generator": [
      { question: "어떤 양식을 사용할 수 있나요?", answer: "반복·조건 없이 {이름} 형태의 단순 변수를 넣은 일반 DOCX 양식을 사용할 수 있습니다. DOCM, 암호 문서와 이미지 삽입 태그는 지원하지 않습니다." },
      { question: "수식 셀도 문서에 넣을 수 있나요?", answer: "스프레드시트에 저장된 계산 결과만 사용합니다. 계산 결과가 없거나 실제 오류인 셀의 행은 실패로 기록합니다." },
      { question: "파일과 결과가 서버로 전송되나요?", answer: "아니요. 양식 확인, 표 데이터 읽기와 DOCX·ZIP·보고서 생성은 현재 브라우저에서 처리합니다." },
    ],
    "/tools/pdf-editor": [
      { question: "여러 페이지 범위는 어떻게 선택하나요?", answer: "편집할 결과 범위를 고르고 페이지 체크박스를 누르세요. 연속 문서는 페이지 뒤의 나누기 위치를 정해 범위를 한 번에 만들 수 있고, 숫자 입력으로 비연속 페이지와 사용자 지정 순서도 선택할 수 있습니다." },
      { question: "완성된 PDF나 ZIP은 어디에서 받나요?", answer: "오른쪽 출력 작업 영역에서 진행 상황을 확인하고 완료된 파일을 바로 내려받을 수 있습니다. 모바일에서는 화면 아래의 출력 작업 버튼을 누르세요." },
    ],
    "/tools/pdf-editor/finish": [
      { question: "페이지 번호를 원하는 페이지에만 넣을 수 있나요?", answer: "네. 페이지 범위와 홀짝 필터를 사용하거나 썸네일 체크박스로 적용할 실제 페이지를 정확히 고를 수 있습니다." },
      { question: "한국어 머리글과 날짜도 넣을 수 있나요?", answer: "네. 한국어를 포함한 문구와 파일명·날짜 토큰을 사용할 수 있으며 필요한 경우 전체 Noto 글꼴을 PDF에 포함합니다." },
    ],
    "/tools/pdf-editor/page-numbers": [
      { question: "페이지 번호를 원하는 페이지에만 넣을 수 있나요?", answer: "네. 페이지 범위와 홀짝 필터를 사용하거나 썸네일 체크박스로 적용할 실제 페이지를 정확히 고를 수 있습니다." },
      { question: "표지를 제외하고 2페이지부터 1로 시작할 수 있나요?", answer: "네. 표지 제외를 켜고 시작 페이지와 시작 번호를 지정하면 건너뛴 페이지를 포함한 실제 페이지 순서대로 번호를 계산합니다." },
    ],
    "/tools/pdf-editor/header-footer": [
      { question: "머리글과 바닥글에 어떤 정보를 넣을 수 있나요?", answer: "페이지 번호, 전체 페이지 수, 파일명, 작업 시작 날짜 토큰과 직접 입력한 문구를 함께 사용할 수 있습니다." },
      { question: "한국어 머리글도 표시되나요?", answer: "네. 한국어가 있으면 전체 Noto 글꼴을 PDF에 포함하며, 결과 파일 크기가 늘어날 수 있음을 작업 결과에서 안내합니다." },
    ],
    "/tools/pdf-editor/watermark": [
      { question: "PDF에 텍스트와 이미지 워터마크를 모두 넣을 수 있나요?", answer: "네. 텍스트 또는 PNG·JPEG 이미지를 골라 한 번 배치하거나 페이지 전체에 반복할 수 있습니다." },
      { question: "워터마크를 문서 내용 뒤에 넣을 수 있나요?", answer: "네. 내용 뒤 또는 앞을 선택할 수 있습니다. 복잡한 레이어·태그·그래픽 상태가 감지되면 먼저 위험을 알리고 확인 후 진행합니다." },
    ],
    "/tools/pdf-editor/stamp": [
      { question: "도장이나 서명 이미지를 여러 페이지의 같은 위치에 넣을 수 있나요?", answer: "네. PNG 또는 JPEG 이미지를 미리보기에서 옮기고 크기를 조절한 뒤, 선택한 모든 페이지의 같은 상대 위치에 넣을 수 있습니다." },
      { question: "이 기능으로 전자서명이나 디지털 서명을 만들 수 있나요?", answer: "아니요. 이 기능은 PDF에 도장 또는 서명 이미지만 넣으며, 인증서 기반 전자서명이나 암호학적 디지털 서명을 만들지 않습니다." },
    ],
    "/tools/pdf-editor/merge": [
      { question: "여러 PDF를 순서대로 합칠 수 있나요?", answer: "네. 파일을 순서대로 놓고 하나의 PDF로 합친 뒤 출력 영역에서 내려받으세요." },
      { question: "합친 파일이 서버로 전송되나요?", answer: "아니요. 합치기와 저장은 현재 브라우저에서 처리됩니다." },
    ],
    "/tools/pdf-editor/split": [
      { question: "PDF를 원하는 구간으로 나눌 수 있나요?", answer: "네. 나누기 위치를 정해 범위별로 자르고 필요한 구간만 저장하세요." },
      { question: "처음 열면 범위가 비어 있나요?", answer: "아니요. 전체 페이지가 들어오는 최초 범위 하나가 먼저 들어 있습니다." },
    ],
    "/tools/pdf-editor/delete": [
      { question: "삭제할 페이지만 골라 뺄 수 있나요?", answer: "네. 삭제할 페이지를 선택하고 나머지를 하나의 PDF로 저장하세요." },
      { question: "열자마자 자동으로 삭제되나요?", answer: "아니요. 첫 페이지 삭제 안내부터 시작하며 자동으로 지우지 않습니다." },
    ],
    "/tools/pdf-editor/rotate": [
      { question: "일부 페이지만 회전할 수 있나요?", answer: "네. 회전할 페이지를 골라 방향을 바로잡은 뒤 저장하세요." },
      { question: "열자마자 자동으로 회전되나요?", answer: "아니요. 첫 페이지 회전 안내부터 시작하며 자동으로 돌리지 않습니다." },
    ],
    "/tools/pdf-editor/ocr": [
      { question: "PDF 전체를 검색 가능한 파일로 만들 수 있나요?", answer: "네. 전체 페이지를 한국어·영어 OCR로 읽어 검색 가능한 PDF를 만듭니다." },
      { question: "페이지를 따로 지정해야 하나요?", answer: "아니요. 별도 설정 없이 전체 범위를 처리합니다." },
    ],
    "/tools/image-studio/resize": [
      { question: "원하는 픽셀 크기로 저장할 수 있나요?", answer: "네. 크기 패널에서 픽셀 크기를 지정한 뒤 저장하세요." },
      { question: "이 화면은 크기 패널이 바로 열리나요?", answer: "네. 크기 조절 목적의 시작 상태로 열립니다." },
    ],
    "/tools/image-studio/mosaic": [
      { question: "선택한 부분만 모자이크할 수 있나요?", answer: "네. 가릴 영역을 선택해 모자이크를 적용하세요." },
      { question: "이 화면은 효과 패널이 바로 열리나요?", answer: "네. 모자이크 목적의 시작 상태로 열립니다." },
    ],
    "/tools/image-studio/watermark": [
      { question: "글자를 그림에 바로 넣을 수 있나요?", answer: "네. 텍스트 패널에서 글자를 넣고 저장하세요." },
      { question: "열자마자 그림이 자동으로 들어가나요?", answer: "아니요. 자동으로 삽입하지 않습니다." },
    ],
    "/tools/video-studio/trim": [
      { question: "영상 구간을 골라 MP4로 저장할 수 있나요?", answer: "네. 구간을 선택한 뒤 MP4 출력을 확인하세요." },
      { question: "합치기와 설정이 섞이나요?", answer: "아니요. 자르기 목적의 시작 상태로 열립니다." },
    ],
    "/tools/video-studio/merge": [
      { question: "여러 영상을 하나로 합칠 수 있나요?", answer: "네. 그룹 순서대로 합쳐 하나의 MP4로 저장하세요." },
      { question: "자르기 설정이 그대로 오나요?", answer: "아니요. 합치기 목적의 시작 상태로 열립니다." },
    ],
    "/tools/video-studio/extract-audio": [
      { question: "영상에서 소리만 MP3로 저장할 수 있나요?", answer: "네. 음원 추출 목적의 시작 상태로 열리며 구간 안내부터 시작합니다." },
      { question: "영상 화면도 함께 저장되나요?", answer: "아니요. 소리만 MP3로 저장합니다." },
    ],
    "/tools/audio-studio/trim": [
      { question: "오디오 구간을 골라 저장할 수 있나요?", answer: "네. 파일을 연 뒤 구간을 선택하고 필요한 부분만 저장하세요." },
      { question: "열자마자 자동으로 처리되나요?", answer: "아니요. 자동으로 처리하지 않습니다." },
    ],
    "/tools/text-merger": [
      { question: "직접 입력을 TXT 파일 사이에 놓을 수 있나요?", answer: "가능합니다. 직접 입력과 TXT 파일은 같은 카드 목록에 추가되며 드래그하거나 위·아래 버튼으로 자유롭게 순서를 바꿀 수 있습니다." },
      { question: "붙여넣은 글이나 TXT 파일이 서버로 전송되나요?", answer: "아니요. 내용은 현재 브라우저에서만 읽고 병합하며 서버나 브라우저 저장소에 보관하지 않습니다." },
      { question: "불러온 TXT 내용을 수정하면 원본 파일도 바뀌나요?", answer: "아니요. 카드와 병합 결과만 달라지고 원본 TXT 파일은 그대로 유지됩니다." },
    ],
    "/tools/document-compare": [
      { question: "DOC와 DOCX를 서로 비교할 수 있나요?", answer: "가능합니다. 둘 다 Word 계열이므로 어느 쪽 순서든 비교할 수 있습니다." },
      { question: "DOCX와 HWP를 비교할 수 있나요?", answer: "불가능합니다. 분석 전에 해당 쌍을 차단하므로 Word 문서끼리, HWP 문서끼리 짝지어 주세요." },
      { question: "DOC도 Word 변경 추적 파일을 만들 수 있나요?", answer: "아닙니다. 두 파일이 모두 DOCX인 문서 쌍에만 적용됩니다." },
    ],
    "/tools/pdf-compare": [
      { question: "PDF의 모든 차이를 찾을 수 있나요?", answer: "화면은 같은 PDF 렌더 설정의 픽셀 차이를 비교하고, 텍스트는 PDF에 저장된 추출 순서를 따릅니다. 두 결과를 함께 확인해야 하며 문서 내용의 동일성을 판정하지 않습니다." },
      { question: "페이지가 추가되거나 순서가 바뀌면 어떻게 되나요?", answer: "처음에는 물리 쪽 번호로 대응합니다. 추가·삭제 페이지를 확인하고 필요한 경우 각 페이지를 한 번만 쓰도록 수동 대응한 뒤 다시 비교할 수 있습니다." },
      { question: "PDF 파일이 서버로 전송되나요?", answer: "아니요. PDF 열기, 페이지 렌더링, 텍스트 추출과 보고서 생성은 현재 브라우저에서 처리하며 원본 파일은 변경하지 않습니다." },
    ],
    "/tools/office-editor": [
      { question: "처음 실행 용량이 큰 이유는 무엇인가요?", answer: "오피스 프로그램과 글꼴·리소스를 브라우저에 저장해야 하기 때문입니다. 다음 실행부터는 저장된 파일을 재사용할 수 있습니다." },
      { question: "파일을 놓으면 바로 열리나요?", answer: "지원 파일 한 개를 놓으면 집중 편집 화면 이동, 편집기 준비와 문서 열기가 자동으로 이어집니다." },
      { question: "한글 글꼴도 표시되나요?", answer: "한글 대체 글꼴을 함께 제공하지만 상용 전용 글꼴을 사용한 문서는 줄바꿈과 간격이 달라질 수 있습니다." },
      { question: "Microsoft의 공식 웹 오피스인가요?", answer: "아닙니다. LibreOffice 기반 브라우저 편집기이며 Microsoft Office와 호환성 차이가 있을 수 있습니다." },
      { question: "HWP도 여기서 편집할 수 있나요?", answer: "HWP/HWPX는 전용 HWP 편집기를 이용하세요. 이 편집기는 Writer·Calc·Impress 형식에 초점을 둡니다." },
    ],
    "/tools/video-studio": [
      { question: "한 그룹의 영상 구간을 다른 그룹에도 적용할 수 있나요?", answer: "가능합니다. 대상 그룹을 고르면 카드 순서가 같은 영상끼리 시작·종료 시간을 복사합니다. 대상 영상이 복사한 종료 시각보다 짧으면 종료 지점을 영상 끝으로 맞추고, 시작 시각보다도 짧으면 해당 영상은 변경하지 않습니다." },
    ],
    "/tools/qr-studio/bulk": [
      { question: "어떤 표 파일에서 QR을 일괄 생성할 수 있나요?", answer: "XLSX, XLSM, XLS, XLSB, SpreadsheetML 형식의 XLS와 CSV를 읽고 선택한 시트의 각 데이터 행을 QR로 만듭니다." },
      { question: "만든 QR이 실제로 읽히는지 확인하나요?", answer: "네. 로고와 투명 배경까지 적용한 최종 PNG를 다시 읽고 원래 데이터와 정확히 일치한 결과만 성공으로 처리합니다." },
      { question: "표와 QR 결과가 서버로 전송되나요?", answer: "아니요. 표 읽기, QR 생성, ZIP·라벨 PDF·보고서 작성은 현재 브라우저에서 처리되며 원본 파일은 변경하지 않습니다." },
    ],
  },
  en: {
    "/tools/document-redactor": [{"question": "Are private details detected automatically?", "answer": "No. Select every area yourself. Private details outside those areas may remain, so review the output."}, {"question": "Does the PDF keep text and signatures?", "answer": "Every page is rasterized. Searchable and selectable text, digital signatures, forms and links are not preserved. The original file is unchanged."}, {"question": "How do resolution and file size change?", "answer": "PDF output uses the selected resolution and may be larger than the original. Processing stops at memory limits. Image output is PNG."}],
    "/tools/excel-merger": [
      { question: "Can XLSX formulas and formatting be preserved independently?", answer: "Yes. Formula and formatting preservation are separate XLSX switches on the current screen and require no additional files." },
      { question: "Can XLS formulas and formatting be preserved independently?", answer: "Yes. Formula and formatting preservation are separate switches, and either one opens the higher-fidelity conversion workspace." },
      { question: "Does preservation retain every XLS feature perfectly?", answer: "It prioritizes formulas and common cell formatting, but charts, external links, macros and some advanced objects can differ. Verify important output in Excel." },
    ],
    "/tools/excel-compare": [
      { question: "Which Excel formats can I compare?", answer: "You can compare XLSX, XLSM, XLS, XLSB, SpreadsheetML XLS and CSV files. XLS and XLSB support values and formulas, but formatting differences are excluded." },
      { question: "What if the selected header suggestion is not the actual column-name row?", answer: "Choose the actual column-name row in each file's header-row field. Comparison starts after that row. A table without headers needs a column-name row added at the top." },
      { question: "Are comparison files uploaded to a server?", answer: "No. Reading, comparison and report generation happen in the current browser, and file contents are not sent to a server." },
      { question: "Can I compare multiple file pairs at once?", answer: "Yes. Each pair can use its own sheets and matching rules. Every successful pair gets a nine-sheet XLSX report, and two or more successful pairs also get a ZIP." },
      { question: "How are multiple rows with the same key shown?", answer: "Each duplicate key counts as one result row with independent lists of its left and right source rows. Items on the same line are not matched automatically." },
    ],
    "/tools/excel-cleaner": [
      { question: "Can I clean an Excel file that contains formulas?", answer: "Same-sheet ordinary A1 references in XLSX and XLSM are updated for row deletion and column deletion, insertion, and reordering. Other formulas require complete stored results and confirmation before becoming values." },
      { question: "How do original-text and safe CSV modes differ?", answer: "Original-text mode preserves values and warns about risky leading characters; it is not represented as safe. Safe mode prefixes affected values with an apostrophe." },
      { question: "Are files or results sent to a server?", answer: "No. Reading files, applying rules, and creating XLSX, CSV, and ZIP results happen in the current browser without modifying originals." },
    ],
    "/tools/document-generator": [
      { question: "Which templates can I use?", answer: "Use a standard DOCX with simple {name} variables and no loops or conditions. DOCM, encrypted documents and image insertion tags are unsupported." },
      { question: "Can formula cells be inserted?", answer: "Only calculation results saved in the spreadsheet are used. Rows with missing cached results or real cell errors fail." },
      { question: "Are files or results sent to a server?", answer: "No. Template inspection, table reading and DOCX, ZIP and report generation happen in the current browser." },
    ],
    "/tools/pdf-editor": [
      { question: "How do I select multiple page ranges?", answer: "Choose the output range to edit and use the page checkboxes. For a continuous document, mark split positions after pages to build the ranges at once. Number entry remains available for non-contiguous pages and custom ordering." },
      { question: "Where do I download the finished PDF or ZIP?", answer: "Follow progress and download the completed file in the output workspace on the right. On mobile, open it from the output button at the bottom of the screen." },
    ],
    "/tools/pdf-editor/finish": [
      { question: "Can page numbers be added only to selected pages?", answer: "Yes. Use a page range and parity filter, or choose the exact physical pages with the thumbnail checkboxes." },
      { question: "Can I add Korean headers and dates?", answer: "Yes. Text can include Korean plus filename and date tokens. The full Noto font is embedded when the content requires it." },
    ],
    "/tools/pdf-editor/page-numbers": [
      { question: "Can page numbers be added only to selected pages?", answer: "Yes. Use a page range and parity filter, or choose the exact physical pages with the thumbnail checkboxes." },
      { question: "Can numbering start at 1 on page 2 after a cover?", answer: "Yes. Enable cover exclusion and set the starting page and number. Numbering still follows the physical page order across skipped pages." },
    ],
    "/tools/pdf-editor/header-footer": [
      { question: "What can I put in a header or footer?", answer: "Combine custom text with tokens for the page number, total pages, filename, and the date captured when the batch starts." },
      { question: "Can headers contain Korean text?", answer: "Yes. The full Noto font is embedded when Korean is present, and the result warns that this can increase the file size." },
    ],
    "/tools/pdf-editor/watermark": [
      { question: "Can I add both text and image watermarks to a PDF?", answer: "Yes. Choose text or a PNG or JPEG image, then place it once or repeat it across each selected page." },
      { question: "Can a watermark appear behind the document content?", answer: "Yes. Choose a background or foreground layer. Complex layers, tags, or graphics state trigger a warning and require confirmation before continuing." },
    ],
    "/tools/pdf-editor/stamp": [
      { question: "Can I place a stamp or signature image in the same position on multiple pages?", answer: "Yes. Move and resize a PNG or JPEG image in the preview, then place it at the same relative position on every selected page." },
      { question: "Does this create an electronic or cryptographic digital signature?", answer: "No. This feature only inserts a stamp or signature image into the PDF. It does not create a certificate-based electronic or cryptographic digital signature." },
    ],
    "/tools/pdf-editor/merge": [
      { question: "Can I combine multiple PDFs in order?", answer: "Yes. Arrange the files in order, merge them into one PDF, then download it from the output area." },
      { question: "Are merged files uploaded to a server?", answer: "No. Merging and saving happen in the current browser." },
    ],
    "/tools/pdf-editor/split": [
      { question: "Can I cut a PDF into the sections I want?", answer: "Yes. Mark split positions, cut the file by ranges, and save only the sections you need." },
      { question: "Is the range empty when I first open it?", answer: "No. One initial range covering every page is already present." },
    ],
    "/tools/pdf-editor/delete": [
      { question: "Can I remove only the pages I choose?", answer: "Yes. Select the pages to delete and save the rest as one PDF." },
      { question: "Does anything get deleted automatically on open?", answer: "No. It starts with first-page delete guidance and deletes nothing automatically." },
    ],
    "/tools/pdf-editor/rotate": [
      { question: "Can I rotate only some pages?", answer: "Yes. Choose the pages to rotate, correct their orientation, then save." },
      { question: "Does anything rotate automatically on open?", answer: "No. It starts with first-page rotate guidance and rotates nothing automatically." },
    ],
    "/tools/pdf-editor/ocr": [
      { question: "Can I make the whole PDF searchable?", answer: "Yes. Every page is read with Korean and English OCR to create a searchable PDF." },
      { question: "Do I need to specify pages?", answer: "No. The full range is processed without extra settings." },
    ],
    "/tools/image-studio/resize": [
      { question: "Can I save at an exact pixel size?", answer: "Yes. Set the pixel size in the size panel, then save." },
      { question: "Does this screen open the size panel directly?", answer: "Yes. It opens in the resize starting state." },
    ],
    "/tools/image-studio/mosaic": [
      { question: "Can I mosaic only a selected area?", answer: "Yes. Select the area to cover and apply the mosaic effect." },
      { question: "Does this screen open the effect panel directly?", answer: "Yes. It opens in the mosaic starting state." },
    ],
    "/tools/image-studio/watermark": [
      { question: "Can I place text directly on the picture?", answer: "Yes. Add the text in the text panel and save." },
      { question: "Is anything inserted automatically on open?", answer: "No. Nothing is inserted automatically." },
    ],
    "/tools/video-studio/trim": [
      { question: "Can I save a video section as MP4?", answer: "Yes. Select the section, then check the MP4 output." },
      { question: "Are merge settings mixed in?", answer: "No. It opens in the trim starting state." },
    ],
    "/tools/video-studio/merge": [
      { question: "Can I join several videos into one?", answer: "Yes. Join them in group order and save one MP4." },
      { question: "Do trim settings carry over?", answer: "No. It opens in the merge starting state." },
    ],
    "/tools/video-studio/extract-audio": [
      { question: "Can I save only the sound as MP3?", answer: "Yes. It opens in the audio-extraction starting state with section guidance." },
      { question: "Is the video picture saved together?", answer: "No. Only the sound is saved as MP3." },
    ],
    "/tools/audio-studio/trim": [
      { question: "Can I pick an audio section and save it?", answer: "Yes. Open the file, select the section, and save only that part." },
      { question: "Does anything process automatically on open?", answer: "No. Nothing is processed automatically." },
    ],
    "/tools/text-merger": [
      { question: "Can pasted text be placed between TXT files?", answer: "Yes. Pasted text and TXT files share one card list and can be reordered freely by dragging or with the up and down buttons." },
      { question: "Are pasted text or TXT files sent to a server?", answer: "No. Content is read and merged only in the current browser and is not kept on a server or in browser storage." },
      { question: "Does editing loaded TXT content change the original file?", answer: "No. Only the card and merged result change. The original TXT file remains untouched." },
    ],
    "/tools/document-compare": [
      { question: "Can I compare DOC with DOCX?", answer: "Yes. Both belong to the Word family, so either order is supported." },
      { question: "Can I compare DOCX with HWP?", answer: "No. The pair is rejected before analysis. Pair Word files together and HWP files together." },
      { question: "Does tracked Word output work for DOC?", answer: "No. It is limited to pairs where both files are DOCX." },
    ],
    "/tools/pdf-compare": [
      { question: "Can this find every difference in a PDF?", answer: "Visual results compare pixels under the same PDF render settings, while text results follow the PDF's stored extraction order. Review both; the tool does not determine document equivalence." },
      { question: "What happens when pages are inserted or reordered?", answer: "Pages initially match by physical page number. Review added or deleted pages, then optionally assign each page at most once in manual mapping and compare again." },
      { question: "Are PDF files uploaded to a server?", answer: "No. Opening PDFs, rendering pages, extracting text, and creating reports happen in the current browser without modifying the source files." },
    ],
    "/tools/office-editor": [
      { question: "Why is the first start large?", answer: "A browser build of the office suite and its fonts and resources must be stored locally. Later starts can reuse the cache." },
      { question: "Does dropping a file open it automatically?", answer: "Yes. Dropping one supported file moves to the focused workspace, prepares the editor and opens the document in one flow." },
      { question: "Does it include a Korean font?", answer: "A Korean fallback font is included, though documents requiring proprietary fonts can have different spacing or line breaks." },
      { question: "Is this an official Microsoft Office web app?", answer: "No. It is a LibreOffice-based browser editor and compatibility can differ from Microsoft Office." },
      { question: "Are HWP files supported here?", answer: "Use the dedicated HWP editor for HWP/HWPX files. This editor focuses on Writer, Calc, and Impress formats." },
    ],
    "/tools/video-studio": [
      { question: "Can I apply one group's video ranges to other groups?", answer: "Yes. Choose the target groups to copy start and end times between videos in the same card positions. If a target ends before the copied end time, its end point is set to the end of that video; if it also ends before the copied start time, it is left unchanged." },
    ],
    "/tools/qr-studio/bulk": [
      { question: "Which table files can create QR codes in bulk?", answer: "It reads XLSX, XLSM, XLS, XLSB, SpreadsheetML XLS and CSV files, then creates one QR code for every data row in the selected sheet." },
      { question: "Are generated QR codes checked for readability?", answer: "Yes. The final PNG, including a logo or transparent background, is decoded again and accepted only when it exactly matches the original payload." },
      { question: "Are tables or QR results uploaded to a server?", answer: "No. Table reading, QR creation, ZIP, label PDF and report generation happen in the current browser without modifying the source file." },
    ],
  },
};