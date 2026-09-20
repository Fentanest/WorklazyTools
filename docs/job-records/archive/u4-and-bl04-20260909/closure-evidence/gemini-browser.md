# REPORT.md — Actual Local Browser Review Report (Playwright Chromium)

**작성자**: Gemini  
**기준 일시**: 2026-09-09  
**지시서 정본**: `/tmp/worklazy-u4-user-bugs/integration/gemini-browser/DISPATCH.md`  
**선행 필수 규칙 준수**: `PROJECT_RULES.md` 및 `GEMINI.md` 전문 선행 열람 완료.  
**원칙 준수**:
- 제품 코드, 테스트 스크립트, 깃 추적 파일 변경 일체 없음 (`git status -s` 무결성 유지)
- 패키지 추가 설치 없음
- 금지 경로(`dummyfortest`, `private-input`, `before.docx`, `after.docx`, `newui`, `untrackednaver`, `/tmp/worklazy-xr`, `/tmp/worklazy-xd*`) 접근 및 열람 차단 준수
- 출력물: 본 디렉터리 내 `REPORT.md`, `coverage.json` 및 스크립트가 생성한 산출물만 허용
- 이전 검수 완료된 보조 10개 이미지 재열람 없음
- 전체 배포 승인(whole deployment approval)을 주장하지 않으며, 본 8개 브라우저 컨텍스트 실측에 한정한 판정 보고임

---

## 1. 실행 및 검증 요약 (Execution Summary)

| 항목 | 수치 / 결과 | 산출 명령 및 비고 |
| :--- | :---: | :--- |
| **실행 스크립트** | `/tmp/worklazy-u4-user-bugs/integration/gemini-browser/open-qa.mjs` | Playwright Chromium 기반 실제 로컬 브라우저 구동 스크립트 |
| **실행 명령** | `node /tmp/worklazy-u4-user-bugs/integration/gemini-browser/open-qa.mjs` | `run_command`로 직접 실행 |
| **명령 종료 코드 (Exit Code)** | **0** (정상 완료) | `Actual browser contexts PASS 8` 표준 출력 기록 |
| **브라우저 컨텍스트 수** | **8개** (전수 통과) | ko/en × 320/1365 × light/dark 전 조합 |
| **외부 네트워크 요청 차단** | **0건 허용 / 0건 발생** | `external.length === 0` (추적 스크립트 전무, 로컬 4277 전용 검증) |
| **체크박스 기본값 검증** | `[true, false, false, false]` | 페이지 번호만 기본 활성화, 나머지 3종 비활성화 |
| **인터랙션 격리 검증** | **PASS** | 워터마크 체크박스 토글 시 활성 탭(`page-numbers`) 불변 유지 |
| **구 decoration toggle 부재** | **PASS** (`count === 0`) | 레거시 토글 엘리먼트 완전 제거 확인 |
| **실제 이미지 개별 열람 수** | **8장** (전수) | `view_file` 바이너리 이미지 뷰어로 8종 PNG 직접 시각 검수 |
| **신규 P2 결함** | **0건** | 레이아웃 붕괴, 컴포넌트 이탈, 신규 정렬 파손 없음 |
| **기존 P3 결함** | **1건** | 모바일 320px KO에서 "머리글·바닥글" 마지막 글자 "글" 줄바꿈 (U4 기등록 P3) |
| **최종 판정** | **조건부 통과 (PASS)** | 브라우저 8개 컨텍스트 실측 완료 (전체 배포 승인 청구 배제) |

---

## 2. 브라우저 컨텍스트별 실행 및 무결성 실측표 (Gemini 교훈 준수)

> **스크린샷 파일 크기 산출 명령**:  
> `ls -la /tmp/worklazy-u4-user-bugs/integration/gemini-browser/*.png`
>
> **SHA-256 체크섬 산출 명령**:  
> `sha256sum /tmp/worklazy-u4-user-bugs/integration/gemini-browser/ko-320-light.png /tmp/worklazy-u4-user-bugs/integration/gemini-browser/ko-320-dark.png /tmp/worklazy-u4-user-bugs/integration/gemini-browser/ko-1365-light.png /tmp/worklazy-u4-user-bugs/integration/gemini-browser/ko-1365-dark.png /tmp/worklazy-u4-user-bugs/integration/gemini-browser/en-320-light.png /tmp/worklazy-u4-user-bugs/integration/gemini-browser/en-320-dark.png /tmp/worklazy-u4-user-bugs/integration/gemini-browser/en-1365-light.png /tmp/worklazy-u4-user-bugs/integration/gemini-browser/en-1365-dark.png`

| 번호 | 파일명 / 식별자 | 뷰포트 / 테마 | SHA-256 체크섬 | 크기(Byte) | 판정 |
| :---: | :--- | :---: | :--- | :---: | :---: |
| 1 | `ko-320-light.png` | 320px / Light | `34a5113e26f275951224370acaaa15746f9c00c13159909bf6b9a86602fc41e9` | 95,385 | PASS (기존 P3 1건) |
| 2 | `ko-320-dark.png` | 320px / Dark | `2cde6e338c97e302daa45671faf42a1a165793accdc7dd678824b2250fbad657` | 100,692 | PASS (기존 P3 1건) |
| 3 | `ko-1365-light.png` | 1365px / Light | `d7782b5dd6190ab20f370394f637cad0a16efe19f96cc1349ba27eb92fbd9c01` | 259,181 | PASS |
| 4 | `ko-1365-dark.png` | 1365px / Dark | `954ac11dad3ff10105393dc859ca52a38bd8d4a893178d4eb993320d52fe86f5` | 238,808 | PASS |
| 5 | `en-320-light.png` | 320px / Light | `6052c1be21fbbba0a1686e38e920727f31f039e1903b21ee75989e445b93a8b0` | 99,120 | PASS |
| 6 | `en-320-dark.png` | 320px / Dark | `0d684a71096a4886598385b6c099ca3bdbae8955f7f2623df16c803db639bd52` | 106,842 | PASS |
| 7 | `en-1365-light.png` | 1365px / Light | `2ffd9ae35286faa3dfdf895d7be593164d20c4fc03cfa5fb8ce6fece70aed2c8` | 274,802 | PASS |
| 8 | `en-1365-dark.png` | 1365px / Dark | `e6a9527b03adc91caa3df8565722ccf7f6524e64eb2222a154b0b230caa3dbb2` | 260,689 | PASS |

---

## 3. 8개 브라우저 캡처 표본별 정밀 시각 검수 (DOM 추론 배제, 렌더링 실측)

본 검수는 DOM 구조 추론이 아닌, `view_file` 이미지 뷰어를 통해 실제 렌더링된 픽셀 상태를 직접 관찰하여 작성되었습니다.

### 1. `ko-320-light.png` (한국어 모바일 320px, 라이트 테마)
- **탭(Tabs)**:
  - 4개 서브옵션 탭 버튼이 상단에 배치됨 (`# 페이지 번호`, `머리글·바닥글`, `워터마크`, `도장·서명`).
  - `# 페이지 번호` 버튼이 연보라 배경과 보라색 테두리로 활성(active) 상태를 명확히 표시함.
  - 협소한 320px 폭으로 인해 2번째 탭 텍스트가 `머리글·바닥` / `글`로 줄바꿈됨 (기존 U4 P3 결함, 신규 결함 아님).
- **체크박스(Checkboxes) 및 기본값(Defaults)**:
  - 4개 탭 버튼 직하단에 1:1 수직 축을 맞춘 4개의 체크박스가 수평 1행으로 정렬됨.
  - 1번 `[✓] 포함`만 체크되어 있고, 2·3·4번은 `[ ] 포함`으로 언체크 상태임 (기본값 `[true, false, false, false]` 시각 확인).
  - 체크박스와 텍스트 레이블 간 간격이 안정적이며 줄바꿈이나 잘림 없음.
- **잔여 설정 영역 (Remaining Settings Content)**:
  - 파일이 아직 업로드되지 않은 합성 무파일(no-file) 초기 상태로, 하단에 "1 PDF 선택" 카드와 "파일을 여기에 놓으세요" 드롭존이 표시됨.
  - 패널 본문 내 구(old) 독립 include 컨테이너 및 구 `decoration-toggle` 스위치는 완전히 제거되어 노출되지 않음.
- **판정**: **PASS (기존 P3 1건 관찰)**

---

### 2. `ko-320-dark.png` (한국어 모바일 320px, 다크 테마)
- **탭(Tabs)**:
  - 짙은 다크 배경 상에서 4개 탭 버튼이 선명히 렌더링됨.
  - 활성 탭(`# 페이지 번호`)의 보라색 아이콘과 테두리가 높은 대비를 이룸.
  - 2번째 탭 마지막 글자 줄바꿈(`글`) 현상 동일 관찰 (기존 U4 P3).
- **체크박스(Checkboxes) 및 기본값(Defaults)**:
  - 다크 테마 체크박스 테두리와 체크 인디케이터(`[✓]`)가 높은 명암비로 뚜렷하게 식별됨.
  - 1번만 체크, 2·3·4번 언체크 상태 명확. 수평 1행 정렬 양호.
- **잔여 설정 영역 (Remaining Settings Content)**:
  - "1 PDF 선택" 영역 및 드롭존이 다크 테마 카드 형태로 일관되게 렌더링됨.
  - 구 decoration toggle 및 중복 체크박스 없음.
- **판정**: **PASS (기존 P3 1건 관찰)**

---

### 3. `ko-1365-light.png` (한국어 데스크톱 1365px, 라이트 테마)
- **탭(Tabs)**:
  - 1365px의 넉넉한 뷰포트 폭에서 4개 탭 버튼이 충분한 여백을 두고 단일 행으로 배치됨.
  - 모바일과 달리 `머리글·바닥글` 텍스트가 줄바꿈 없이 한 줄로 깔끔하게 렌더링됨.
  - `# 페이지 번호` 활성 탭 아웃라인 정상.
- **체크박스(Checkboxes) 및 기본값(Defaults)**:
  - 4개 체크박스(`[✓] 포함`, `[ ] 포함`, `[ ] 포함`, `[ ] 포함`)가 각 탭 버튼의 하단 정중앙에 정확하게 정렬됨.
  - 기본값 일치 (`[true, false, false, false]`).
- **잔여 설정 영역 (Remaining Settings Content)**:
  - 좌측 내비게이션 사이드바(홈, 모든 도구, PDF 도구 등), 헤더 타이틀, 보안 안내 배지("파일과 암호는 이 브라우저 안에서만 처리됩니다"), 탭 바, "1 PDF 선택" 드롭존 카드, 하단 브라우저 PDF 도구 이용 안내 카드까지 전체 레이아웃이 조화롭게 표시됨.
  - 구 decoration toggle 미존재.
- **판정**: **PASS**

---

### 4. `ko-1365-dark.png` (한국어 데스크톱 1365px, 다크 테마)
- **탭(Tabs)**:
  - 데스크톱 다크 테마에서 4개 탭의 다크 카드 배경, 아이콘, 폰트 색상이 완벽한 가독성을 제공함.
  - `# 페이지 번호` 활성 탭 하이라이트 유지.
- **체크박스(Checkboxes) 및 기본값(Defaults)**:
  - 4개 체크박스 수평 정렬 및 기본값 (`[true, false, false, false]`) 이상 없음.
  - 다크 테마 체크박스 시인성 우수.
- **잔여 설정 영역 (Remaining Settings Content)**:
  - 사이드바, 본문 헤더, 드롭존, 하단 안내 카드가 일관된 다크 톤으로 렌더링됨.
  - 구 decoration toggle 미존재.
- **판정**: **PASS**

---

### 5. `en-320-light.png` (영문 모바일 320px, 라이트 테마)
- **탭(Tabs)**:
  - 4개 탭: `# Page numbers`, `Header & footer`, `Watermark`, `Stamp & signature`.
  - 각 버튼 내부에서 영문 레이블이 2행 구조로 안정적으로 줄바꿈되어 버튼 경계를 벗어나지 않음.
  - `# Page numbers` 활성 탭 테두리 및 아이콘 강조 정상.
- **체크박스(Checkboxes) 및 기본값(Defaults)**:
  - 4개의 `[✓] Include`, `[ ] Include`, `[ ] Include`, `[ ] Include` 체크박스가 버튼 하단에 1행으로 나란히 배치됨.
  - 영문 레이블 "Include"가 잘림 없이 모두 온전히 표시됨.
- **잔여 설정 영역 (Remaining Settings Content)**:
  - 영문 no-file 뷰: "1 Choose PDFs", 파일 드롭존("Drop files here") 정상 표시.
  - 구 decoration toggle 미존재.
- **판정**: **PASS**

---

### 6. `en-320-dark.png` (영문 모바일 320px, 다크 테마)
- **탭(Tabs)**:
  - 320px 다크 뷰포트에서 영문 탭 4종의 텍스트 대비 및 아이콘 렌더링 안정적.
  - 활성 탭 하이라이트 정상.
- **체크박스(Checkboxes) 및 기본값(Defaults)**:
  - 다크 모드 `Include` 체크박스 4개 정렬 및 기본값 `[true, false, false, false]` 정상.
- **잔여 설정 영역 (Remaining Settings Content)**:
  - 다크 테마 영문 no-file 초기 화면 정상 노출. 구 decoration toggle 미존재.
- **판정**: **PASS**

---

### 7. `en-1365-light.png` (영문 데스크톱 1365px, 라이트 테마)
- **탭(Tabs)**:
  - 1365px 데스크톱에서 4개 탭이 한 줄로 시원하게 배열됨.
  - 영문 텍스트(`Page numbers`, `Header & footer`, `Watermark`, `Stamp & signature`)가 줄바꿈 없이 1행으로 표시됨.
- **체크박스(Checkboxes) 및 기본값(Defaults)**:
  - 각 탭 버튼 하단 중앙에 `Include` 체크박스 4개가 균등 배치됨.
  - 기본값 (`[true, false, false, false]`) 시각 확인.
- **잔여 설정 영역 (Remaining Settings Content)**:
  - 영문 사이드바(EXPLORE, TOOLS, About 등), 상단 헤더, 드롭존, 하단 가이드("Guide / Using the browser PDF tools") 전반이 규격대로 배치됨.
  - 구 decoration toggle 미존재.
- **판정**: **PASS**

---

### 8. `en-1365-dark.png` (영문 데스크톱 1365px, 다크 테마)
- **탭(Tabs)**:
  - 데스크톱 다크 모드에서 4개 영문 탭이 높은 시인성을 유지함.
- **체크박스(Checkboxes) 및 기본값(Defaults)**:
  - `Include` 체크박스 4개 정렬 및 기본값 정상.
- **잔여 설정 영역 (Remaining Settings Content)**:
  - 전체 다크 테마 컴포넌트 간 오정렬이나 잘림 없이 완벽한 시각 상태 유지.
  - 구 decoration toggle 미존재.
- **판정**: **PASS**

---

## 4. Playwright 브라우저 인터랙션 검증 상세 (DOM 및 동작성 실측)

스크립트 실행 중 각 8개 컨텍스트에서 수행된 실제 브라우저 자동화 검증 결과:

1. **체크박스 엘리먼트 수**: `page.locator('[data-testid^="pdf-finish-include-"]').count() === 4` (전 컨텍스트 통과)
2. **초기 체크 상태**: `before === [true, false, false, false]` (전 컨텍스트 통과)
   - 1번(페이지 번호)만 기본 활성화, 2번(머리글/바닥글), 3번(워터마크), 4번(도장/서명)은 기본 비활성화 확인.
3. **체크박스 조작 시 탭 전환 억제 (Tab Switch Invariant)**:
   - `page.locator('[data-testid="pdf-finish-include-watermark"]').check()` 실행 후,
   - 활성 탭 속성 확인: `getAttribute("data-pdf-finish-tab") === "page-numbers"` 유지 (전 컨텍스트 통과).
   - 즉, 체크박스를 클릭하여 특정 옵션을 포함시키더라도 사용자가 보고 있던 활성 탭이 강제로 전환되지 않음.
4. **구 토글 컴포넌트 완전 소멸 확인**:
   - `page.locator('[data-testid="pdf-finish-decoration-toggle"]').count() === 0` (전 컨텍스트 통과).
   - 레거시 단일 decoration toggle이 UI 및 DOM 어디에도 잔존하지 않음.
5. **체크박스 원복 및 무파일 상태 스냅샷**:
   - `uncheck()` 후 캡처 수행하여 깨끗한 초기 no-file 상태의 8종 스크린샷 획득.
6. **추적 스크립트 및 외부 유출 차단**:
   - `external.length === 0` 확인: 4277 포트 외 외부 리소스 호출 전면 차단 및 비발생 확인.

---

## 5. 결함 귀속 및 한계 (Defect Attribution & Scope Limits)

1. **신규 결함 (이번 변경분 귀속)**: **0건**
   - 4개 체크박스 배치에 따른 탭 컨테이너 파손, 스위치 썸 이탈, 다크 테마 색상 뭉개짐, 텍스트 클리핑 등 신규 결함 일체 없음.
2. **기존 결함 (기존 부채 귀속)**: **1건 (P3)**
   - 320px 모바일 폭에서 한국어 `머리글·바닥글` 탭 버튼의 마지막 글자 `글` 줄바꿈 (DISPATCH에 명시된 U4 기등록 P3 결함이며 신규 결함이 아님).
3. **검수 한계 명시 (Scope Limits)**:
   - 본 보고서는 `open-qa.mjs`가 실행한 8종 브라우저 컨텍스트 및 그에 따른 8장의 스크린샷 실측에 기반한 검수 결과입니다.
   - **전체 프로덕션 배포에 대한 포괄적 승인(whole deployment approval)을 의미하지 않습니다.**
   - 실제 파일(PDF) 드래그앤드롭 후의 복합 렌더링/다운로드 파이프라인 검증은 별도의 오피스/PDF 스모크 테스트의 영역입니다.

---

**서명**: Gemini
