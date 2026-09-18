import json

parsed_seo_file = '/home/better0101/projects/worklazytools/scratch/parsed_seo.json'
with open(parsed_seo_file, 'r', encoding='utf-8') as f:
    parsed_data = json.load(f)

mapping = {
  "excel-merger": {
    "menu": "엑셀 병합",
    "h1": "엑셀 파일·시트 합치기",
    "description": "여러 엑셀 파일의 시트나 자료를 하나의 XLSX로 합치기(병합)하세요. 수식·서식을 보존하고 암호 입출력을 지원합니다."
  },
  "excel-compare": {
    "menu": "엑셀 비교",
    "h1": "엑셀 파일·데이터 비교",
    "description": "Excel·CSV 파일 쌍을 위치나 키 기준으로 비교하세요. 값·수식·서식 차이를 XLSX 보고서로 확인할 수 있습니다."
  },
  "excel-cleaner": {
    "menu": "엑셀 정리",
    "h1": "엑셀 데이터 일괄 정리",
    "description": "Excel·CSV 파일에 공백 제거, 빈 행 삭제, 중복 정리 등 28종 규칙을 순서대로 적용하여 데이터를 깔끔하게 정리하세요."
  },
  "document-generator": {
    "menu": "워드 메일머지",
    "h1": "워드 문서 일괄 생성",
    "description": "워드 템플릿의 변수를 엑셀 데이터로 치환하여 한 번에 수많은 개별 문서를 자동으로 완성하세요."
  },
  "document-compare": {
    "menu": "문서 비교",
    "h1": "워드·한글 문서 비교",
    "description": "DOCX·DOC 또는 HWP·HWPX 문서의 문단·표·서식 차이를 비교하고 변경된 내용을 쉽게 확인하세요."
  },
  "pdf-compare": {
    "menu": "PDF 비교",
    "h1": "PDF 파일 차이 비교",
    "description": "여러 수정 전후 PDF 쌍을 비교하여 페이지별 렌더 픽셀 및 추출 텍스트 차이를 파악하세요."
  },
  "pdf-editor": {
    "menu": "PDF 편집",
    "h1": "PDF 파일 편집·변환",
    "description": "PDF 페이지를 병합, 추출, 변환하거나 한국어·영어 OCR을 통해 다양한 문서 형식으로 만드세요."
  },
  "hwp-editor": {
    "menu": "한글 편집",
    "h1": "온라인 한글 문서 편집",
    "description": "HWP와 HWPX 문서를 브라우저에서 바로 열어 본문과 서식을 편집하고 저장하세요."
  },
  "office-editor": {
    "menu": "오피스 편집",
    "h1": "온라인 오피스 문서 편집",
    "description": "Word, Excel, PowerPoint 문서를 브라우저에서 간편하게 편집하고 저장할 수 있습니다."
  },
  "video-studio": {
    "menu": "동영상 편집",
    "h1": "온라인 동영상 편집",
    "description": "영상 자르기, 이어붙이기, 음원 추출을 지원합니다. 브라우저에서 빠르고 간편하게 영상을 편집하세요."
  },
  "audio-studio": {
    "menu": "오디오 편집",
    "h1": "온라인 오디오 편집",
    "description": "오디오 파형에서 구간을 자르고 음소거, 복사, 붙여넣기를 하거나 피치 조절 효과를 적용하세요."
  },
  "image-studio": {
    "menu": "사진 편집",
    "h1": "온라인 사진 편집",
    "description": "사진 크기 조절, 자르기, 모자이크, 필터 적용 및 자유 그리기 기능을 제공하는 다목적 사진 편집기입니다."
  },
  "text-merger": {
    "menu": "텍스트 병합",
    "h1": "텍스트 파일 일괄 합치기",
    "description": "여러 TXT 파일을 원하는 순서대로 정렬하고 줄바꿈이나 쉼표 등의 구분자로 하나로 합치세요."
  },
  "text-tools": {
    "menu": "텍스트 정돈",
    "h1": "텍스트 줄바꿈·공백 제거",
    "description": "불필요한 공백과 줄바꿈, 중복 줄을 제거하고 대소문자 변환 및 한국어 문장 검사를 실행하세요."
  },
  "text-formatter": {
    "menu": "코드 포맷터",
    "h1": "JSON·SQL·XML 포맷터",
    "description": "JSON, SQL, XML 텍스트의 문법 오류를 확인하고 읽기 좋게 들여쓰기하여 깔끔하게 정돈하세요."
  },
  "work-calculator": {
    "menu": "영업일 계산",
    "h1": "영업일 및 연차 계산기",
    "description": "주말과 대한민국 법정 공휴일을 제외한 정확한 영업일과 입사일 기준 예상 연차를 계산하세요."
  },
  "timezone-calculator": {
    "menu": "시차 계산",
    "h1": "세계지도 시차 계산기",
    "description": "세계지도에서 도시를 선택해 국제 표준 시간대와 서머타임을 반영한 현지 시각 및 회의 시간을 비교하세요."
  },
  "payroll-calculator": {
    "menu": "급여 계산",
    "h1": "실수령액·퇴직금 계산기",
    "description": "최신 사회보험 기준으로 주휴수당, 월급 실수령액과 법정 퇴직금을 간편하게 계산하세요."
  },
  "document-redactor": {
    "menu": "개인정보 가리기",
    "h1": "PDF·이미지 개인정보 가리기",
    "description": "PDF와 이미지 파일에서 민감한 개인정보 영역을 검정색으로 가리고 안전하게 사본을 저장하세요."
  },
  "image-privacy": {
    "menu": "위치정보 삭제",
    "h1": "사진 메타데이터·위치정보 삭제",
    "description": "사진에 숨겨진 GPS 위치 및 촬영 기기 정보(EXIF)를 확인하고 완전히 삭제하세요."
  },
  "security-tools": {
    "menu": "비밀번호 생성",
    "h1": "안전한 비밀번호 생성기",
    "description": "보안 난수를 기반으로 무작위 비밀번호를 생성하고, 예상 해독 시간과 패턴으로 안전성을 측정하세요."
  },
  "qr-studio": {
    "menu": "QR 스튜디오",
    "h1": "QR 코드 만들기 및 스캔",
    "description": "URL, 텍스트 등으로 QR 코드를 만들거나 카메라 및 사진 업로드로 기존 QR 코드를 스캔하세요."
  },
  "data-converter": {
    "menu": "데이터 변환",
    "h1": "CSV·JSON·HTML 데이터 변환기",
    "description": "CSV 파일, JSON 배열, HTML 표 데이터를 브라우저 환경에서 자유롭게 변환하고 저장하세요."
  },
  "pdf-editor/merge": {
    "menu": "PDF 합치기",
    "h1": "여러 PDF 파일 합치기",
    "description": "여러 개의 PDF 문서를 원하는 순서대로 합쳐 하나의 PDF 파일로 간편하게 저장하세요."
  },
  "pdf-editor/split": {
    "menu": "PDF 분할",
    "h1": "PDF 페이지 범위 분할",
    "description": "PDF 파일에서 원하는 범위를 선택하여 자르고, 필요한 구간만 따로 저장하세요."
  },
  "pdf-editor/delete": {
    "menu": "PDF 페이지 삭제",
    "h1": "PDF 특정 페이지 삭제",
    "description": "PDF에서 불필요한 페이지를 직접 선택해 삭제한 뒤, 나머지 페이지를 하나의 문서로 저장하세요."
  },
  "pdf-editor/rotate": {
    "menu": "PDF 회전",
    "h1": "PDF 페이지 방향 회전",
    "description": "방향이 잘못된 PDF 페이지를 선택하여 올바른 방향으로 회전시키고 저장하세요."
  },
  "pdf-editor/image-to-pdf": {
    "menu": "사진을 PDF로",
    "h1": "사진(JPG·PNG)을 PDF로 변환",
    "description": "여러 장의 JPG, PNG 이미지를 나열하고 하나의 깔끔한 PDF 파일로 묶어 변환하세요."
  },
  "pdf-editor/pdf-to-image": {
    "menu": "PDF를 이미지로",
    "h1": "PDF 페이지를 이미지(JPG·PNG)로 변환",
    "description": "PDF의 모든 페이지를 고해상도 PNG 또는 JPG 이미지로 변환하여 ZIP 파일로 한 번에 다운로드하세요."
  },
  "pdf-editor/convert": {
    "menu": "PDF 파일 변환",
    "h1": "PDF를 워드·엑셀·텍스트로 변환",
    "description": "원하는 PDF 페이지를 OCR 기술을 이용해 DOCX, XLSX, TXT 파일로 변환하세요."
  },
  "pdf-editor/ocr": {
    "menu": "PDF OCR",
    "h1": "검색 가능한 PDF (OCR) 만들기",
    "description": "스캔된 PDF 문서를 한국어 및 영어 OCR로 분석하여 텍스트 검색이 가능한 PDF로 변환하세요."
  },
  "pdf-editor/finish": {
    "menu": "PDF 워터마크·번호",
    "h1": "PDF 페이지 번호 및 워터마크 추가",
    "description": "여러 PDF에 페이지 번호, 머리글, 바닥글, 워터마크 및 도장 이미지를 일괄 적용하세요."
  },
  "pdf-editor/page-numbers": {
    "menu": "PDF 번호 매기기",
    "h1": "PDF 페이지 번호 넣기",
    "description": "표지를 제외하거나 시작 번호를 지정하여 PDF에 원하는 형식의 페이지 번호를 삽입하세요."
  },
  "pdf-editor/header-footer": {
    "menu": "PDF 머리글/바닥글",
    "h1": "PDF 머리글·바닥글 삽입",
    "description": "PDF 파일명, 날짜, 페이지 번호 등의 문구를 원하는 위치에 머리글이나 바닥글로 추가하세요."
  },
  "pdf-editor/watermark": {
    "menu": "PDF 워터마크",
    "h1": "PDF 텍스트·이미지 워터마크 넣기",
    "description": "PDF 문서의 배경이나 전면에 텍스트 또는 이미지 워터마크를 반복 배치하고 투명도를 조절하세요."
  },
  "pdf-editor/stamp": {
    "menu": "PDF 도장 삽입",
    "h1": "PDF에 서명 및 도장 이미지 넣기",
    "description": "서명이나 도장 이미지를 PDF에 자유롭게 배치하고 크기를 조절하여 여러 페이지에 한 번에 적용하세요."
  },
  "image-studio/resize": {
    "menu": "사진 크기 조절",
    "h1": "사진 픽셀 크기 조절",
    "description": "이미지 비율을 유지하면서 원하는 정확한 픽셀 크기로 사진 크기를 조절하고 저장하세요."
  },
  "image-studio/mosaic": {
    "menu": "사진 모자이크",
    "h1": "사진 특정 영역 모자이크 처리",
    "description": "사진에서 가리고 싶은 개인정보나 민감한 영역을 선택해 모자이크 효과를 적용하세요."
  },
  "image-studio/watermark": {
    "menu": "사진 워터마크",
    "h1": "사진 텍스트 워터마크 넣기",
    "description": "사진에 텍스트 워터마크를 입력하여 저작권 표시나 출처 문구를 쉽게 추가하세요."
  },
  "video-studio/trim": {
    "menu": "동영상 자르기",
    "h1": "동영상 구간 자르기",
    "description": "영상 파일에서 필요한 특정 구간만 선택하여 불필요한 부분을 잘라내고 MP4로 저장하세요."
  },
  "video-studio/merge": {
    "menu": "동영상 합치기",
    "h1": "여러 동영상 하나로 합치기",
    "description": "여러 개의 영상 파일을 순서대로 배열하여 하나의 MP4 동영상 파일로 합치세요."
  },
  "video-studio/extract-audio": {
    "menu": "음원 추출",
    "h1": "동영상에서 오디오(MP3) 추출",
    "description": "영상 파일에서 소리만 따로 추출하여 고음질 MP3 형식의 오디오 파일로 저장하세요."
  },
  "audio-studio/trim": {
    "menu": "오디오 자르기",
    "h1": "오디오·MP3 구간 자르기",
    "description": "오디오나 녹음 파일에서 필요한 구간을 선택하여 원하는 부분만 잘라 저장하세요."
  },
  "qr-studio/bulk": {
    "menu": "QR 일괄 생성",
    "h1": "엑셀·CSV로 QR 코드 대량 생성",
    "description": "엑셀(Excel)이나 CSV 데이터 목록을 이용하여 한 번에 수많은 QR 코드를 일괄 생성하세요."
  }
}

result = {}
for key, original in parsed_data.items():
    if key in mapping:
        result[key] = {
            "menu": mapping[key]["menu"],
            "title": original["title"],
            "h1": mapping[key]["h1"],
            "description": mapping[key]["description"],
            "h2": original["h2"]
        }
    else:
        result[key] = original

with open('/home/better0101/projects/worklazytools/scratch/full_seo_ko.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print("Successfully generated full_seo_ko.json")
