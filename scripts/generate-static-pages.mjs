import fs from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve("dist");
const sourceHtml = await fs.readFile(path.join(outputDirectory, "index.html"), "utf8");
const siteUrl = ensureTrailingSlash(process.env.VITE_SITE_URL || "https://worklazy.net/");
const socialImage = new URL("social/worklazy-tools-share.png", siteUrl).href;
const socialImageAlt = "Worklazy Tools - 파일 업로드 없이 브라우저에서 실행하는 업무 도구";

const pages = [
  {
    route: "",
    title: "무료 문서·PDF·비디오·이미지 업무 도구 | Worklazy Tools",
    description: "설치와 로그인 없이 문서·미디어 편집, 텍스트·데이터 변환, 일정·급여 계산과 보안 도구를 실행하세요. 입력은 브라우저에서 처리합니다.",
    heading: "귀찮은 파일 작업은 브라우저 도구에게 맡기세요.",
    intro: "Worklazy Tools는 문서·미디어 편집, 텍스트·표 변환, 일정·급여 계산과 개인정보·보안 도구를 설치 없이 실행하는 무료 업무 도구입니다.",
    sections: [
      ["Excel 파일 병합", "여러 스프레드시트를 시트별, 세로, 가로 방식으로 합칩니다. 수식 유지, 암호화 입력과 출력 XLSX 암호를 지원합니다."],
      ["Word 문서 비교", "여러 DOCX 문서 쌍의 본문과 표를 동시에 비교하고 웹·Excel 보고서와 변경 추적 DOCX로 제공합니다."],
      ["PDF 편집·변환·OCR", "PDF 페이지를 시각적으로 편집·분할하고 이미지, DOCX, XLSX, TXT로 변환하거나 한국어·영어 OCR로 검색 가능한 PDF를 만듭니다."],
      ["HWP 문서 편집", "공식 rhwp Studio에서 HWP와 HWPX의 본문·서식·표·개체를 편집하고 다시 HWP·HWPX로 저장합니다."],
      ["HWP 문서 비교", "여러 HWP·HWPX 문서 쌍의 본문, 개요 번호, 표와 기타 문서 영역을 비교하고 웹·Excel 결과를 제공합니다."],
      ["비디오와 이미지", "비디오 구간을 GIF·숏폼·음원으로 만들고 이미지를 개별 또는 일괄 편집해 콜라주와 GIF로 저장합니다."],
      ["텍스트와 데이터", "텍스트 정돈과 JSON·SQL·XML 포맷, CSV·JSON·HTML Table 변환을 로컬 Worker에서 실행합니다."],
      ["일정·급여·보안", "영업일·연차·글로벌 시차·급여를 계산하고 사진 EXIF, 비밀번호와 QR 코드를 안전하게 처리합니다."],
      ["로컬 우선 처리", "작업 파일과 암호를 별도 서버에 업로드하지 않습니다. 진행 상황은 단계별 로그로 바로 확인할 수 있습니다."],
    ],
  },
  {
    route: "tools",
    title: "무료 업무 파일 도구 모음 | Worklazy Tools",
    description: "Excel·Word·HWP·PDF·비디오·이미지 작업을 브라우저에서 바로 실행하는 무료 업무 도구 모음입니다.",
    heading: "무료 업무 파일 도구",
    intro: "반복되는 문서, PDF, 비디오와 이미지 작업을 브라우저에서 처리하세요. 로그인이나 프로그램 설치가 필요하지 않습니다.",
    sections: [["제공 도구", "문서·PDF·비디오·이미지 편집과 텍스트·표 데이터 변환, 영업일·시차·급여 계산, 사진 개인정보·비밀번호·QR 도구를 제공합니다."]],
  },
  {
    route: "tools/excel-merger",
    title: "Excel 파일 병합 - XLSX·XLS·XLSB·XLSM·CSV 합치기",
    description: "여러 XLSX, XLS, XLSB, XLSM, CSV 파일을 시트별·세로·가로로 병합하세요. XLSX 수식·서식 보존과 암호 입출력을 지원합니다.",
    heading: "Excel 파일을 무료로 병합하세요.",
    intro: "XLSX, XLS, XLSB, XLSM, CSV 파일을 함께 선택하고 호환성이 높은 XLSX 결과 파일로 만들 수 있습니다.",
    application: "Excel Merger",
    sections: [
      ["세 가지 병합 방식", "시트별 병합은 원본 시트를 각각 보관합니다. 세로 병합은 행을 아래로, 가로 병합은 열을 오른쪽으로 이어 붙입니다."],
      ["두 가지 빈 영역 정리", "끝 여백 정리는 내용 뒤쪽의 빈 범위를 제외합니다. SheetTrim은 결과 시트 중간을 포함해 사용자가 지정한 개수 이상 연속된 빈 행 또는 빈 열 묶음을 선택적으로 삭제합니다."],
      ["수식과 서식", "수식과 서식 보존은 XLSX 입력에서만 지원합니다. 값만 복사를 끄면 XLSX의 수식과 저장된 계산 결과를 유지합니다."],
      ["암호화 파일", "지원되는 암호화 XLSX와 XLS의 암호를 브라우저에서 해제하고 결과 XLSX에도 열기 암호를 설정할 수 있습니다."],
      ["알아둘 제한", "출력은 XLSX만 지원하며 XLSM 매크로는 보존되지 않습니다. 이미지, 외부 데이터 연결, 피벗과 일부 고급 표 개체도 제외되거나 단순화될 수 있습니다."],
    ],
  },
  {
    route: "tools/word-compare",
    title: "Word 문서 비교 - DOCX 텍스트 Diff·변경 추적",
    description: "수정 전후 Word 문서의 본문과 문장을 웹에서 Diff 비교하고 추가·삭제 내용을 확인하세요. 계약서·기획 문서·표·서식·메모·개요 번호와 변경 추적 DOCX도 지원합니다.",
    heading: "Word 문서의 변경을 웹에서 비교하세요.",
    intro: "기획 문서, 보고서, 계약서, 약관과 사내 규정 등 수정 전후 DOCX를 비교해 추가·삭제된 단어와 문장을 구분하고 문서 구조까지 함께 확인합니다.",
    application: "Word Compare",
    sections: [
      ["문단·문장 단위 텍스트 Diff", "수정 전후 문서의 본문을 나란히 보고 추가 내용은 빨간색, 삭제 내용은 파란색 취소선으로 확인할 수 있습니다. 기획자와 법무·총무 담당자의 기획 문서, 계약서, 약관과 규정 비교에도 활용할 수 있습니다."],
      ["단순 텍스트 비교를 넘는 문서 구조", "일반 텍스트 Diff와 달리 Word의 문단, 개요 목록 번호, 글자 서식, 메모 위치와 표의 행·열 구조를 함께 분석해 문서 맥락을 유지합니다."],
      ["비교 범위", "여러 문서를 같은 순번끼리 짝지어 본문과 표를 비교하며, 옵션에 따라 머리말, 꼬리말, 각주, 미주와 주석 텍스트도 확인합니다."],
      ["다중 동시 비교", "여러 문서 쌍을 한 번에 비교하고 각 문서 쌍은 독립된 웹 화면, Excel 보고서와 Word 변경 추적 DOCX로 확인할 수 있습니다."],
      ["Word 변경 추적", "Word 검토 탭에서 삽입·삭제 내용을 확인하고 변경을 수락하거나 거부할 수 있는 DOCX를 브라우저에서 생성합니다."],
      ["브라우저에서 처리", "처음 사용할 때 문서 분석에 필요한 실행 파일만 내려받으며 선택한 Word 문서는 외부 서버에 업로드하지 않습니다."],
      ["알아둘 제한", "목록 번호는 문서의 번호 정의를 해석해 표시합니다. 필드, 도형, 복잡한 병합 표의 변경 추적은 Microsoft Word 자체 비교 결과와 다를 수 있습니다."],
    ],
  },
  {
    route: "tools/pdf-editor",
    title: "PDF 편집·병합·분할·페이지 추출 - 무료 온라인 PDF 도구",
    description: "PDF 페이지를 미리 보며 순서 변경·회전·선택하고 하나의 PDF, 여러 범위별 PDF 또는 페이지별 PDF로 저장하세요.",
    heading: "PDF 페이지를 편집하고 원하는 단위로 추출하세요.",
    intro: "여러 PDF의 페이지를 한 화면에 펼쳐 순서 변경·회전·선택한 뒤 하나의 PDF나 여러 개의 PDF로 저장합니다.",
    application: "PDF 페이지 편집·병합·추출",
    sections: [
      ["즉시 확인하는 페이지 회전", "회전 버튼을 누르면 썸네일 방향이 즉시 바뀌며 새 PDF를 만들 때 해당 페이지의 실제 회전 속성에 반영됩니다."],
      ["여러 PDF 병합", "서로 다른 PDF의 페이지를 하나의 목록에 추가하고 파일 경계와 관계없이 원하는 순서로 배치할 수 있습니다."],
      ["선택 페이지 추출", "카드나 페이지 범위 입력으로 출력할 페이지만 선택해 현재 편집 순서대로 하나의 PDF를 만들 수 있습니다."],
      ["여러 범위별 PDF", "파일명과 페이지 범위를 여러 행에 입력해 각 범위를 별도 PDF로 만들고 ZIP 하나로 내려받습니다. 같은 페이지를 여러 결과에 중복 포함할 수 있습니다."],
      ["페이지별 PDF", "선택한 각 페이지를 독립된 PDF로 분리하고 여러 결과를 ZIP으로 묶어 저장합니다."],
      ["브라우저 로컬 처리", "선택한 PDF는 외부 변환 서버에 업로드하지 않습니다. 페이지 미리보기와 결과 생성은 현재 브라우저에서 진행합니다."],
      ["지원 범위", "암호가 설정된 PDF는 보호를 해제한 사본이 필요합니다. 기존 디지털 서명은 문서를 수정하면 유효하지 않으며 양식·책갈피 등 일부 고급 개체는 보존되지 않을 수 있습니다."],
    ],
  },
  {
    route: "tools/pdf-editor/image-to-pdf",
    title: "JPG·PNG 이미지를 PDF로 변환 - 무료 온라인 도구",
    description: "여러 JPG·PNG 이미지 순서를 바꾸고 A4 맞춤 또는 이미지 크기의 PDF로 변환하세요.",
    heading: "JPG와 PNG 이미지를 하나의 PDF로 만드세요.",
    intro: "여러 이미지를 끌어서 원하는 순서로 배치하고 A4에 잘림 없이 맞추거나 원본 이미지 크기를 페이지로 사용합니다.",
    application: "이미지를 PDF로 변환",
    sections: [["순서 변경", "추가한 이미지 카드를 끌어 PDF 페이지 순서를 자유롭게 바꿀 수 있습니다."], ["A4 자동 맞춤", "가로와 세로 이미지를 감지해 A4 방향을 정하고 여백 안에 비율을 유지해 배치합니다."], ["지원 이미지", "브라우저 호환성과 결과 안정성을 위해 JPG와 PNG를 지원합니다."]],
  },
  {
    route: "tools/pdf-editor/pdf-to-image",
    title: "PDF를 PNG·JPG 이미지로 변환 - ZIP 다운로드",
    description: "PDF의 모든 페이지를 원하는 해상도의 PNG 또는 JPG 이미지로 변환해 ZIP으로 내려받으세요.",
    heading: "PDF 페이지를 PNG 또는 JPG로 저장하세요.",
    intro: "페이지 미리보기를 확인하고 화면용부터 고해상도까지 해상도를 선택해 모든 이미지를 ZIP으로 받습니다.",
    application: "PDF를 이미지로 변환",
    sections: [["PNG와 JPG", "선명한 선과 글자는 PNG, 파일 크기를 줄이고 싶은 사진 중심 문서는 JPG가 적합합니다."], ["해상도 선택", "해상도가 높으면 더 선명하지만 작업 시간, 브라우저 메모리와 ZIP 파일 크기가 함께 증가합니다."], ["순차 처리", "긴 PDF도 한 페이지씩 렌더링하고 압축해 화면 반응과 메모리 사용을 관리합니다."]],
  },
  {
    route: "tools/pdf-editor/convert",
    title: "PDF를 DOCX·XLSX·TXT로 변환·한국어 OCR",
    description: "PDF 내장 텍스트와 브라우저 한국어·영어 OCR로 DOCX, XLSX, TXT와 검색 가능한 PDF를 만드세요.",
    heading: "PDF 텍스트를 문서와 스프레드시트로 변환하세요.",
    intro: "텍스트 PDF는 내장 글자를 추출하고 스캔 PDF는 한국어·영어 OCR을 실행해 편집 가능한 결과를 만듭니다.",
    application: "PDF 문서 변환·OCR",
    sections: [
      ["DOCX·XLSX·TXT", "DOCX는 줄과 읽기 순서를 문단으로, XLSX는 페이지별 시트와 좌표 기반 셀로, TXT는 페이지 구분이 있는 순수 텍스트로 저장합니다."],
      ["한국어·영어 OCR", "스캔 페이지를 이미지로 만든 뒤 브라우저 안에서 한국어와 영어를 인식합니다. 최초 실행에는 학습 모델 다운로드가 필요합니다."],
      ["검색 가능한 PDF", "모든 페이지를 OCR해 눈에 보이는 이미지와 선택·검색 가능한 텍스트 레이어가 함께 있는 PDF를 생성합니다."],
      ["변환 정확도", "PDF는 원래의 문단과 표 구조가 없는 경우가 많아 DOCX와 XLSX의 읽기 순서, 표와 셀 배치는 좌표를 바탕으로 추정합니다."],
      ["대용량 처리", "50페이지 이상 전체 OCR은 오래 걸리고 메모리를 많이 사용할 수 있습니다. 페이지별 진행률을 확인하고 데스크톱 브라우저 사용을 권장합니다."],
    ],
  },
  {
    route: "tools/hwp-editor",
    title: "HWP·HWPX 문서 편집기 - 무료 온라인 HWP 편집",
    description: "HWP와 HWPX 문서를 공식 rhwp Studio에서 열어 본문·서식·표·개체를 편집하고 다시 저장하세요.",
    heading: "HWP와 HWPX 문서를 브라우저에서 편집하세요.",
    intro: "공식 rhwp Studio의 메뉴와 도구 모음을 사용해 문서를 편집하고 HWP·HWPX·HML 결과를 내려받습니다.",
    application: "HWP Editor",
    sections: [
      ["전체 편집기", "본문 입력과 선택, 글자·문단 서식, 표·그림·도형·수식·각주, 찾기와 실행 취소 등 현재 rhwp Studio가 활성화한 기능을 제공합니다."],
      ["HWP·HWPX 저장", "편집한 문서를 HWP 또는 HWPX로 내려받고, HWP는 직렬화 후 다시 열리는지 검증합니다."],
      ["HML과 PDF", "문서 구조가 허용하면 HML로 저장할 수 있으며 PDF는 편집기 파일 메뉴의 브라우저 인쇄 기능을 이용합니다."],
      ["공식 upstream 사용", "rhwp 내부 코드는 수정하지 않고 @rhwp/editor SDK와 공식 Studio가 현재 제공하는 기능을 그대로 사용합니다."],
    ],
  },
  {
    route: "tools/hwp-compare",
    title: "HWP 문서 비교 - 한글 문서 텍스트 Diff·표 변경 확인",
    description: "수정 전후 HWP·HWPX 문서의 본문과 문장을 웹에서 Diff 비교하고 추가·삭제 내용을 확인하세요. 계약서·개요 번호·서식·표 구조 변경과 Excel 보고서도 지원합니다.",
    heading: "HWP·HWPX 문서의 변경을 웹에서 비교하세요.",
    intro: "보고서, 기획 문서, 법무·총무 문서, 계약서와 규정 등 수정 전후 HWP·HWPX를 나란히 비교해 추가·삭제된 내용을 시각적으로 확인합니다.",
    application: "HWP Compare",
    sections: [
      ["HWP 문단·문장 Diff", "수정 전후 한글 문서의 추가·삭제 내용을 색상과 취소선으로 구분하고 변경된 문단만 모아 볼 수도 있습니다. 계약서 조항, 약관과 사내 규정 비교에도 활용할 수 있습니다."],
      ["단순 텍스트 비교를 넘는 문서 구조", "문자열만 비교하는 도구와 달리 HWP·HWPX의 문단, 개요 번호, 글자 서식과 표의 행·열 구조를 함께 분석해 조항 번호와 표 맥락을 유지합니다."],
      ["다중 동시 비교", "수정 전과 수정 후 목록에 같은 개수의 HWP·HWPX를 넣고 순번별로 비교합니다. 문서는 드래그로 정렬하거나 반대 목록으로 옮길 수 있습니다."],
      ["본문·개요·서식", "본문 텍스트와 문단·글자 서식을 비교하며 문서의 개요 번호를 본문 앞에 함께 표시합니다."],
      ["스마트 표 비교", "표 중간에 행이나 열이 추가되면 내용 유사도로 대응되는 행·열을 찾아 뒤로 밀린 기존 셀 전체가 변경으로 잡히는 현상을 줄입니다."],
      ["웹·Excel 결과", "문서처럼 이어지는 좌우 웹 화면과 일반 변경 및 표별 시트가 포함된 Excel 보고서를 문서 쌍마다 제공합니다."],
      ["브라우저 로컬 처리", "HWP·HWPX 파일과 입력한 암호는 전용 Web Worker의 브라우저 메모리에서 처리하며 별도 변환 서버에 업로드하지 않습니다."],
      ["현재 지원 경계", "검토 메모와 변경 추적 기록, 일부 도형·중첩 표는 현재 브라우저 분석 범위에 포함되지 않아 제외되거나 단순화될 수 있습니다. 변경 추적 HWP 파일은 생성하지 않습니다."],
    ],
  },
  {
    route: "tools/video-studio",
    title: "온라인 비디오 편집·그룹별 이어붙이기 - GIF·MP3·AAC 변환",
    description: "최대 6개 영상을 6개 그룹으로 나누고 구간·순서·동기 재생·분할 전체화면을 확인한 뒤 개별 저장하거나 이어붙이세요.",
    heading: "영상 그룹마다 구간과 출력 방식을 한눈에 설정하세요.",
    intro: "별도 작업 프리셋 없이 영상을 그룹에 배치하고 각 영상의 구간과 순서를 정합니다. 출력 형식에서 MP4·MKV·WebM·GIF·MP3·AAC를 고르면 필요한 설정만 표시됩니다.",
    application: "Video Studio",
    sections: [
      ["6개 영상과 6개 그룹", "최대 6개 영상을 여섯 그룹에 자유롭게 배치하고, 드래그로 그룹 이동과 그룹 내부 출력 순서를 바꿉니다."],
      ["인코딩 없는 빠른 자르기", "원본 영상과 음원 스트림을 그대로 복사해 화질 손실 없이 빠르게 구간을 저장합니다. 시작점은 키프레임 경계에 맞춰질 수 있습니다."],
      ["그룹별 구간과 분할 화면", "그룹마다 모든 영상의 시작·종료 구간을 편집하고 동기 재생과 분할 전체화면으로 여러 화면을 함께 확인합니다."],
      ["출력 형식으로 기능 선택", "MP4·MKV·WebM은 영상, GIF는 움짤, MP3·AAC는 음원으로 출력합니다. 그룹마다 개별 출력과 이어붙이기를 독립적으로 정합니다."],
      ["원본 비율과 해상도", "원본 비율은 영상을 자르거나 늘리지 않고 유지합니다. 해상도 일괄 변경은 별도 옵션이며 적용 시 인코딩이 필요함을 명확히 안내합니다."],
      ["로컬 단일 스레드 처리", "광고와 기존 문서 도구의 호환성을 유지하기 위해 교차 출처 격리가 필요 없는 단일 스레드 실행 코어를 사용합니다."],
    ],
  },
  {
    route: "tools/image-studio",
    title: "온라인 이미지 편집 - 일괄 리사이즈·워터마크·콜라주·GIF",
    description: "클립보드 이미지 붙여넣기, 레이어 편집, 일괄 리사이즈·워터마크, 미리보기가 있는 이어붙이기·콜라주와 GIF 생성을 실행하세요.",
    heading: "이미지를 꾸미고 한꺼번에 정리하세요.",
    intro: "한 장의 이미지에는 텍스트와 도형을 올리고, 여러 이미지는 같은 설정으로 처리해 ZIP으로 저장합니다.",
    application: "Image Studio",
    sections: [
      ["단일 이미지 편집", "클립보드 이미지를 바로 붙여넣고 자르기, 회전, 반전, 필터와 텍스트·도형·이모지 레이어를 적용합니다."],
      ["일괄 리사이즈와 워터마크", "업로드나 클립보드로 여러 이미지를 추가하고 크기, 출력 형식과 워터마크를 적용해 ZIP으로 내려받습니다."],
      ["이어붙이기와 콜라주", "이미지를 세로·가로 또는 격자로 배치하고 간격과 배경색에 따른 결과를 미리 확인합니다."],
      ["GIF 애니메이션", "업로드 순서를 프레임 순서로 사용하고 크기와 재생 간격을 지정해 GIF를 만듭니다."],
      ["그림판·스케치북", "연필·붓·지우개로 자유롭게 그리고 선·도형·텍스트와 Undo·Redo를 사용해 PNG·JPG로 저장합니다."],
    ],
  },
  {
    route: "tools/text-tools",
    title: "텍스트 정돈·케이스 변환 - 공백·줄바꿈·중복 줄 제거",
    description: "불필요한 공백과 줄바꿈, 중복 줄을 제거하고 Camel·Snake·Kebab·Title Case 변환과 로컬 한국어 문장 검사를 실행하세요.",
    heading: "복잡한 텍스트를 빠르고 안전하게 정돈하세요.",
    intro: "원문을 서버로 보내지 않고 공백·줄 구조를 정리하거나 개발용 케이스로 바꾸고 한국어 문장의 자주 틀리는 표현을 점검합니다.",
    application: "Text Tools",
    sections: [["텍스트 정돈", "줄 앞뒤 공백, 다중 공백, 불필요한 줄바꿈과 중복 줄을 선택적으로 제거합니다."], ["케이스 변환", "Camel, Snake, Kebab, Title Case 결과를 원문과 나란히 확인하고 복사합니다."], ["한국어 가이드", "200개 이상의 로컬 정규식 패턴으로 의심 표현을 찾고 문맥 확인이 필요한 교정 제안을 표시합니다."]],
  },
  {
    route: "tools/text-formatter",
    title: "JSON·SQL·XML 포맷터 - 들여쓰기·Minify·문법 검사",
    description: "JSON, SQL, XML 텍스트의 문법 오류를 확인하고 읽기 좋은 들여쓰기 또는 한 줄 Minify 형식으로 정돈하세요.",
    heading: "JSON·SQL·XML을 읽기 좋게 정리하세요.",
    intro: "브라우저 Worker가 텍스트 문법을 분석하고 들여쓰기 또는 한 줄 형식으로 결과를 만듭니다.",
    application: "JSON SQL XML Formatter",
    sections: [["세 가지 형식", "JSON.parse, SQL Formatter와 XML Validator를 사용해 각 형식에 맞게 처리합니다."], ["문법 오류", "잘못된 JSON과 XML은 오류 위치와 메시지를 표시하며 원문을 임의로 복구하지 않습니다."], ["Minify", "문자열 내부 값을 유지하면서 구조에 불필요한 공백과 줄바꿈을 줄입니다."]],
  },
  {
    route: "tools/work-calculator",
    title: "영업일·연차 계산기 - 대한민국 공휴일·대체공휴일 반영",
    description: "주말과 대한민국 법정·대체공휴일을 제외한 영업일과 입사일·회계연도 기준 예상 연차를 계산하세요.",
    heading: "업무 일정과 예상 연차를 계산하세요.",
    intro: "양력·음력 공휴일과 대체공휴일을 계산하고 회사 휴무일을 직접 추가할 수 있습니다.",
    application: "영업일 연차 계산기",
    sections: [["대한민국 영업일", "주말, 설·추석·부처님오신날과 법정·대체공휴일을 기간에서 제외합니다."], ["추가 휴일", "임시공휴일, 선거일과 회사 휴무일을 날짜로 직접 추가할 수 있습니다."], ["연차", "입사일 기준과 회계연도 기준을 나누어 개근을 가정한 예상 발생 일수를 표시합니다."]],
  },
  {
    route: "tools/timezone-calculator",
    title: "세계지도 시차·글로벌 회의 시간 계산기 - 도시 시간 비교",
    description: "세계지도에서 도시 핀을 선택하고 IANA 타임존과 서머타임을 반영한 현지 시각과 글로벌 회의 가능 시간을 비교하세요.",
    heading: "세계지도에서 글로벌 팀의 시간을 비교하세요.",
    intro: "서울을 비롯한 44개 주요 도시를 지도 핀과 검색으로 선택하고 현지 시각과 모두가 업무 중인 구간을 확인합니다.",
    application: "World Time Planner",
    sections: [["로컬 세계지도", "Natural Earth 기반 세계지도와 도시 좌표를 정적 자산으로 제공하며 외부 지도 서버를 호출하지 않습니다."], ["정확한 시차", "IANA 타임존 데이터로 날짜별 일광절약시간제와 UTC 오프셋을 반영합니다."], ["도시 비교", "지도 핀 또는 검색으로 최대 6개 도시를 선택해 현지 시각과 날짜 차이를 비교합니다."], ["회의 시간", "모든 선택 도시가 현지 09시부터 18시 사이인 30분 단위 구간을 추천합니다."]],
  },
  {
    route: "tools/payroll-calculator",
    title: "주휴수당·월 실수령액·퇴직금 간이 계산기",
    description: "2026년 최신 사회보험 기준으로 주휴수당, 월급 실수령액과 법정 퇴직금을 서버 전송 없이 간이 계산하세요.",
    heading: "민감한 급여 정보를 내 브라우저에서 계산하세요.",
    intro: "주 소정근로시간과 급여·재직 정보를 저장하거나 전송하지 않고 주휴수당, 실수령액과 퇴직금을 추정합니다.",
    application: "급여 간이 계산기",
    sections: [["주휴수당", "주 15시간 이상일 때 주 소정근로시간 비율과 약정 시급으로 유급 주휴 시간을 계산합니다."], ["월 실수령액", "국민연금·건강보험·장기요양·고용보험과 부양가족 기준 예상 세액을 공제합니다."], ["퇴직금", "재직일수, 최근 3개월 임금과 연간 상여·연차수당 반영액으로 평균임금과 법정 퇴직금을 계산합니다."], ["참고용 결과", "실제 신고 기준소득, 비과세 급여와 회사 원천징수 방식에 따라 급여명세서와 차이가 날 수 있습니다."]],
  },
  {
    route: "tools/image-privacy",
    title: "사진 EXIF·GPS 개인정보 제거 - JPG·PNG 메타데이터 삭제",
    description: "사진 속 GPS 위치, 촬영 기기와 촬영 시각을 확인하고 EXIF 메타데이터가 제거된 깨끗한 JPG·PNG 사본을 만드세요.",
    heading: "사진을 공유하기 전에 개인정보를 제거하세요.",
    intro: "사진의 메타데이터를 확인하고 픽셀만 새 캔버스에 그려 GPS·기기·촬영 시각 태그가 없는 사본을 만듭니다.",
    application: "Image Privacy",
    sections: [["EXIF 확인", "GPS 좌표, 촬영 기기, 촬영 시각과 소프트웨어 정보를 브라우저에서 읽습니다."], ["재인코딩 제거", "원본 컨테이너를 복사하지 않고 OffscreenCanvas에 픽셀을 렌더링해 새 JPG 또는 PNG로 저장합니다."], ["로컬 처리", "원본과 결과는 전용 Worker와 브라우저 메모리 밖으로 전송되지 않습니다."]],
  },
  {
    route: "tools/security-tools",
    title: "안전한 비밀번호 생성기·강도 측정기",
    description: "crypto.getRandomValues 기반 무작위 비밀번호를 만들고 패턴·엔트로피·공격 예상 시간으로 비밀번호 강도를 확인하세요.",
    heading: "길고 고유한 비밀번호를 안전하게 만드세요.",
    intro: "운영체제의 암호학적 난수를 사용하고 입력한 비밀번호를 네트워크로 보내지 않은 채 강도를 분석합니다.",
    application: "Password Security",
    sections: [["안전한 난수", "crypto.getRandomValues와 편향을 줄인 거절 샘플링으로 문자 위치를 선택합니다."], ["사용자 설정", "8~64자 길이와 대문자·소문자·숫자·특수문자 포함 여부를 설정합니다."], ["강도 분석", "문자열 패턴, 엔트로피와 예상 추측 횟수로 공격에 견디는 시간을 추정합니다."]],
  },
  {
    route: "tools/qr-studio",
    title: "QR 코드 생성기·사진 QR 스캐너 - 로고 삽입",
    description: "URL과 텍스트를 중앙 로고가 포함된 QR 코드 PNG로 만들고 업로드한 사진 속 QR 데이터를 브라우저에서 읽으세요.",
    heading: "QR 코드를 만들고 사진에서 읽으세요.",
    intro: "텍스트·URL QR 코드를 원하는 크기와 색상으로 만들거나 업로드한 이미지의 QR 데이터를 분석합니다.",
    application: "QR Studio",
    sections: [["QR 생성", "높은 오류 복원 수준과 충분한 여백으로 QR 코드를 만들고 PNG로 저장합니다."], ["중앙 로고", "선택한 로고를 흰 여백과 함께 QR 중앙에 배치합니다."], ["사진 스캔", "Worker에서 이미지를 축소하고 명암 반전을 포함해 QR 데이터를 찾습니다."]],
  },
  {
    route: "tools/data-converter",
    title: "CSV·JSON·HTML Table 표 데이터 변환기",
    description: "CSV, JSON 객체 배열과 HTML Table 데이터를 브라우저 Worker에서 서로 변환하고 파일로 저장하세요.",
    heading: "표 데이터를 필요한 형식으로 바꾸세요.",
    intro: "CSV·JSON·HTML Table을 서로 변환하고 결과를 복사하거나 파일로 저장합니다.",
    application: "Table Data Converter",
    sections: [["CSV", "첫 행을 열 이름으로 사용하고 따옴표·쉼표·셀 줄바꿈을 Papa Parse로 해석합니다."], ["JSON", "객체 배열의 모든 키를 열 이름으로 모아 표 형태로 정규화합니다."], ["HTML Table", "셀 텍스트를 안전하게 이스케이프해 thead와 tbody가 포함된 HTML 표를 만듭니다."], ["Worker 처리", "파싱과 직렬화는 별도 Worker에서 실행하고 완료 즉시 종료합니다."]],
  },
  {
    route: "about",
    title: "서비스 소개 | Worklazy Tools",
    description: "Worklazy Tools의 브라우저 로컬 처리 방식과 지원 범위를 안내합니다.",
    heading: "안심하고 쓰는 작은 업무 도구",
    intro: "복잡한 파일 작업을 쉽고 투명하게 처리하는 것이 Worklazy Tools의 목표입니다.",
    sections: [["Local First", "선택한 문서, PDF, 비디오, 이미지 파일과 암호는 브라우저 안에서 처리합니다. 진행률과 단계별 로그로 현재 작업 상태를 확인할 수 있습니다."], ["명확한 지원 범위", "브라우저에서 만든 결과와 원본 프로그램 표시의 차이를 숨기지 않고 확인이 필요한 항목을 안내합니다."]],
  },
  {
    route: "privacy",
    title: "개인정보처리방침 | Worklazy Tools",
    description: "로컬 파일 처리, 외부 서비스, Google AdSense와 쿠키에 관한 개인정보처리방침입니다.",
    heading: "개인정보처리방침",
    intro: "시행일: 2026년 8월 13일. 작업 문서, 미디어, 입력 암호와 결과 파일은 Worklazy Tools 서버에 업로드하거나 저장하지 않습니다.",
    sections: [
      ["브라우저 로컬 처리", "Excel, Word, HWP, PDF, 비디오와 이미지 파일은 브라우저 안에서 읽고 처리합니다. 공식 rhwp 편집기는 미저장 복구를 위해 브라우저 IndexedDB에 로컬 초안을 저장할 수 있습니다."],
      ["새 로컬 도구", "텍스트·급여·재직·비밀번호 입력은 서버나 브라우저 영구 저장소에 보관하지 않습니다. EXIF 제거, QR 스캔과 표 변환 Worker는 작업이 끝나면 종료합니다."],
      ["HWP 편집기 자체 포함", "공식 rhwp Studio의 버전·커밋·파일 해시를 고정해 Worklazy Tools 정적 배포물에 포함합니다. HWP 편집 과정에서 외부 rhwp 사이트나 외부 웹폰트를 호출하지 않으며 작업 파일은 HTTP 업로드 요청에 포함하지 않습니다."],
      ["일반 네트워크 정보", "사이트, Word 비교 실행 파일과 OCR 언어 모델을 불러오는 과정에서 IP 주소, 브라우저 종류와 요청 시각 같은 일반 접속 정보가 처리될 수 있습니다. 작업 파일 내용은 해당 요청에 포함하지 않습니다."],
      ["Google AdSense", "광고가 활성화된 페이지에서는 Google과 광고 파트너가 쿠키, 웹 비콘, IP 주소와 기타 식별자를 광고 제공과 측정에 사용할 수 있습니다. 이 처리는 문서 기능의 파일 처리와 구분됩니다."],
      ["문의", "개인정보 문의 시 실제 업무 문서나 파일 암호를 첨부하지 마세요. 자세한 내용은 화면의 개인정보처리방침에서 확인할 수 있습니다."],
    ],
  },
  {
    route: "terms",
    title: "이용약관 | Worklazy Tools",
    description: "무료 브라우저 파일 도구의 이용 조건, 지원 범위와 사용자 책임을 안내합니다.",
    heading: "이용약관",
    intro: "시행일: 2026년 8월 13일. Worklazy Tools는 브라우저에서 문서와 미디어 작업을 수행하는 무료 도구입니다.",
    sections: [["안전한 이용", "처리할 권한이 있는 파일만 사용하고 중요한 원본은 별도로 보관해야 합니다."], ["결과 확인", "브라우저에서 만든 문서·미디어 결과와 텍스트·QR·표 변환 결과를 실제 사용 전에 직접 확인하세요."], ["계산기 결과", "영업일·연차·급여·퇴직금은 표시된 기준과 입력값에 따른 참고 결과이며 회사 규정, 근태, 비과세 급여와 실제 신고 기준에 따라 달라질 수 있습니다."], ["보안 도구", "비밀번호 강도와 공격 시간은 추정치이며 QR 스캔 결과의 URL 안전성을 보증하지 않습니다."], ["서비스 변경", "브라우저와 서비스 제공 환경의 변경에 따라 기능이 수정되거나 일시 중단될 수 있습니다."]],
  },
  {
    route: "contact",
    title: "문의하기 | Worklazy Tools",
    description: "Worklazy Tools 오류 제보, 기능 제안과 개인정보 문의 방법입니다.",
    heading: "오류와 개선 의견을 알려주세요.",
    intro: "Worklazy Tools GitHub Issues를 통해 오류를 제보하거나 기능을 건의할 수 있습니다. 실제 업무 문서, 개인 정보와 파일 암호는 문의 내용에 포함하지 마세요.",
    sections: [["오류 제보", "브라우저 이름과 버전, 파일 형식, 선택한 옵션, 진행 로그의 마지막 단계와 오류 문구를 알려주세요."], ["기능 제안", "반복하는 파일 작업과 원하는 입력·결과 형식을 민감하지 않은 예시와 함께 설명해 주세요."]],
  },
  {
    route: "licenses",
    title: "라이선스 및 제3자 고지 | Worklazy Tools",
    description: "Worklazy Tools 자체 저작물의 이용 조건과 주요 오픈소스 구성요소의 라이선스·원본 소스를 안내합니다.",
    heading: "라이선스 및 제3자 고지",
    intro: "Worklazy가 직접 작성한 부분과 제3자 구성요소의 서로 다른 권리 범위와 이용 조건을 확인하세요.",
    sections: [
      ["Worklazy Tools 자체 저작물", "직접 작성한 코드, UI와 문서는 All Rights Reserved입니다. 무단 복제·재배포·미러링·경쟁 서비스 제공과 복제본의 수익화를 허용하지 않습니다."],
      ["rhwp", "HWP·HWPX·HML 문서 해석과 편집에 @rhwp/core 및 @rhwp/editor 0.8.4(MIT)를 사용합니다."],
      ["ffmpeg.wasm", "비디오·오디오 처리에 @ffmpeg/core 0.12.10(GPL-2.0-or-later)과 @ffmpeg/ffmpeg 0.12.15(MIT)를 사용합니다."],
      ["Fabric.js와 gifenc", "이미지 레이어 편집에 Fabric.js 7.4.0(MIT), GIF 생성에 gifenc 1.0.3(MIT)을 사용합니다."],
      ["제3자 원본 소스", "오픈소스에는 각 원 라이선스가 우선합니다. 공식 저장소 링크와 배포된 라이선스 전문 묶음은 화면에서 확인할 수 있습니다."],
    ],
  },
];

for (const page of pages) {
  const canonical = new URL(page.route ? `${page.route}/` : "", siteUrl).href;
  const html = renderPage(sourceHtml, page, canonical);
  const directory = page.route ? path.join(outputDirectory, page.route) : outputDirectory;
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), html);
}

const notFound = renderPage(sourceHtml, pages[0], siteUrl)
  .replace("index, follow, max-image-preview:large", "noindex, nofollow");
await fs.writeFile(path.join(outputDirectory, "404.html"), notFound);

const sitemapUrls = pages.map((page) => new URL(page.route ? `${page.route}/` : "", siteUrl).href);
await fs.writeFile(path.join(outputDirectory, "sitemap.xml"), createSitemap(sitemapUrls));
await fs.writeFile(path.join(outputDirectory, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap.xml", siteUrl).href}\n`);

console.log(`Generated ${pages.length} crawlable pages for ${siteUrl}`);

function renderPage(template, page, canonical) {
  const structuredData = [{
    "@context": "https://schema.org",
    "@type": page.route === "" ? "WebSite" : "WebPage",
    name: page.title,
    description: page.description,
    url: canonical,
    inLanguage: "ko-KR",
    image: socialImage,
  }];

  if (page.application) {
    structuredData.push({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: page.application,
      description: page.description,
      url: canonical,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    });
  }

  const head = [
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:locale" content="ko_KR" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Worklazy Tools" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(socialImage)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtml(socialImage)}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(socialImageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(socialImage)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(socialImageAlt)}" />`,
    `<script id="worklazy-route-jsonld" type="application/ld+json">${JSON.stringify(structuredData)}</script>`,
  ].join("\n    ");

  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(page.title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(page.description)}" />`)
    .replace("</head>", `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${staticBody(page)}</div>`);
}

function staticBody(page) {
  const nav = pages.map((item) => {
    const href = new URL(item.route ? `${item.route}/` : "", siteUrl).href;
    const label = item.route === "" ? "홈" : item.route === "tools" ? "모든 도구" : item.route.endsWith("excel-merger") ? "Excel 병합" : item.route.endsWith("word-compare") ? "Word 비교" : item.heading;
    return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
  }).join("");
  const sections = page.sections.map(([heading, content]) => `<section><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(content)}</p></section>`).join("");
  return `<main class="seo-static-fallback"><nav aria-label="주요 페이지">${nav}</nav><p class="eyebrow">WORKLAZY TOOLS</p><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.intro)}</p>${sections}</main>`;
}

function createSitemap(urls) {
  const entries = urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", "&apos;");
}
