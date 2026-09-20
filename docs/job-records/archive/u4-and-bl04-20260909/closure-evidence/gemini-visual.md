# REPORT.md — Bounded Visual Review Report

**작성자**: Gemini  
**기준 일시**: 2026-09-09  
**지시서 정본**: `/tmp/worklazy-u4-user-bugs/integration/gemini-visual/DISPATCH.md`  
**규칙 정본 준수**: `PROJECT_RULES.md` 및 `GEMINI.md` 전문 선행 열람 완료.  
**원칙 준수**: 코드·추적 파일·기준선 수정/커밋/배포 일체 미수행, 본 디렉터리 내 보고서/coverage 산출물만 기록. 금지 경로(`dummyfortest`, `private-input`, `before.docx`, `after.docx`, `newui`, `untrackednaver`, `/tmp/worklazy-xr`, `/tmp/worklazy-xd*`) 접근·전송 차단 준수.

---

## 1. 핵심 요약 (Summary Table)

| 항목 | 수치 / 판정 | 비고 / 산출 근거 |
| :--- | :---: | :--- |
| **실제 열람 장수** | **10장** (전수) | `view_file` binary image viewer로 10개 파일 개별 시각 열람 완료 |
| **신규 P2 결함** | **0건** | 워터마크 잘림, 한글 네모(tofu), 체크박스 정렬 파손, 구 include 잔존 없음 |
| **기존 P3 결함** | **1건** | 320px KO 모바일에서 '머리글·바닥글' 탭의 마지막 글자 '글' 줄바꿈 (U4 기등록 P3) |
| **미확인 사항** | **1건** | 브라우저 직접 조작 도구 부재로 인한 동적 클릭/상호작용 검증 미수행 |
| **최종 판정** | **조건부 통과 (PASS)** | 본 10종 합성 표본에 한정한 시각 판정이며 전체 배포 승인이 아님 |

---

## 2. 브라우저 도구 상태 및 외부 접근 확인

- **브라우저 열기 도구 여부**: **도구 부재 (Unavailable)**
  - 현재 세션 에이전트 도구셋에 대화형 브라우저 조작 도구(`open_browser_url`, `read_browser_page` 등)가 제공되지 않음 (`DISPATCH.md` 지침에 따라 도구 부재 명시).
- **QA 로컬 서버 응답 확인**:
  - 산출 명령: `curl -sI http://127.0.0.1:4277/ko/tools/pdf-editor/finish/`
  - 응답 상태: `HTTP/1.1 200 OK` (정상 구동 중 확인)

---

## 3. 검수 대상 파일 및 실측 무결성 표 (Gemini 교훈 준수)

> **산출 명령**:  
> `sha256sum /tmp/worklazy-u4-user-bugs/stamp-watermark/synthetic-review/fixed-synthetic-bottom-center.png /tmp/worklazy-u4-user-bugs/stamp-watermark/synthetic-review/fixed-synthetic-bottom-left.png /tmp/worklazy-u4-user-bugs/stamp-watermark/synthetic-review/fixed-synthetic-bottom-right.png /tmp/worklazy-u4-user-bugs/stamp-watermark/synthetic-review/fixed-synthetic-top-center.png /tmp/worklazy-u4-user-bugs/stamp-watermark/synthetic-review/fixed-synthetic-top-left.png /tmp/worklazy-u4-user-bugs/stamp-watermark/synthetic-review/fixed-synthetic-top-right.png /tmp/worklazy-u4-user-bugs/korean-preview/synthetic/worker.png /tmp/worklazy-u4-user-bugs/korean-preview/synthetic/main.png /tmp/worklazy-u4-user-bugs/acceptance/output/synthetic-mobile-ko-four-checked.png /tmp/worklazy-u4-user-bugs/acceptance/output/synthetic-mobile-en-four-checked.png`

| 번호 | 파일 경로 | SHA-256 체크섬 | 파일 크기 (바이트) | 판정 |
| :---: | :--- | :--- | :---: | :---: |
| 1 | `stamp-watermark/synthetic-review/fixed-synthetic-bottom-center.png` | `d78aaba19f1d2856cd3e8da107f0355af29da06772626fa62e92e6b4fd6fa5ad` | 6,995 | PASS |
| 2 | `stamp-watermark/synthetic-review/fixed-synthetic-bottom-left.png` | `787e9defd47b2b07063e70b47501c276b4be50a7e7e21bd49cfec17cec7f872a` | 6,945 | PASS |
| 3 | `stamp-watermark/synthetic-review/fixed-synthetic-bottom-right.png` | `8585b1923cdd56aa46351daba64ab0e8de93dcb5b67c1f6e52f54e140adda511` | 7,038 | PASS |
| 4 | `stamp-watermark/synthetic-review/fixed-synthetic-top-center.png` | `7efb06acdc162c54a8c19a9d4d78380170e71adeb058c90fb61428d33467ca43` | 6,998 | PASS |
| 5 | `stamp-watermark/synthetic-review/fixed-synthetic-top-left.png` | `c3d991233609a2a5c4aed0d217966d6e9dd333430e128aad1f663e9d13a116bd` | 6,941 | PASS |
| 6 | `stamp-watermark/synthetic-review/fixed-synthetic-top-right.png` | `8122ef3ba62666366829cf98bc1f17aa095464a6c2d8838beb00a1c2eae0c6d4` | 7,039 | PASS |
| 7 | `korean-preview/synthetic/worker.png` | `d260605abba92bd57e5bad2266efcef7fb650aa3a8ee3b41978721e27a59d6ef` | 15,432 | PASS |
| 8 | `korean-preview/synthetic/main.png` | `d260605abba92bd57e5bad2266efcef7fb650aa3a8ee3b41978721e27a59d6ef` | 15,432 | PASS |
| 9 | `acceptance/output/synthetic-mobile-ko-four-checked.png` | `11af8132831a083463586e93cccd0e7639e4e17a08c4d29f8c442112d6da8a5e` | 365,851 | PASS (기존 P3 1건) |
| 10 | `acceptance/output/synthetic-mobile-en-four-checked.png` | `70088fc5057375ce2b38f57bfb8ae9afbc18f12740342328b7ee7ccbb5bad2ed` | 381,689 | PASS |

*(크기 산출 명령: `ls -la /tmp/worklazy-u4-user-bugs/...`)*

---

## 4. 세부 시각 검수 결과 (10개 표본 개별 분석)

### [A] 워터마크 위치 및 글자 완결성 검증 (6종)

모든 워터마크 표본(1번~6번)은 흰색 세로 문서 캔버스 위에 대각선 회전된 `CONFIDENTIAL` 텍스트를 포함하고 있습니다.

1. **하단 중앙 (`fixed-synthetic-bottom-center.png`)**:
   - 실제 시각 문자: `CONFIDENTIAL` (12자 완전 표시)
   - 관찰: 하단 여백 및 좌우 균형이 유지되며, 문서 하단 경계선 밖으로의 글자 침범이나 잘림이 일체 없음.
   - 판정: **PASS**

2. **하단 좌측 (`fixed-synthetic-bottom-left.png`)**:
   - 실제 시각 문자: `CONFIDENTIAL` (12자 완전 표시)
   - 관찰: 좌측 하단 모서리에서 'C'부터 'L'까지 페이지 내부 영역에 안정적으로 안착됨. 좌측/하단 절단 없음.
   - 판정: **PASS**

3. **하단 우측 (`fixed-synthetic-bottom-right.png`)**:
   - 실제 시각 문자: `CONFIDENTIAL` (12자 완전 표시)
   - 관찰: 우측 하단 여백이 보존되며, 오른쪽 캔버스 테두리 바깥으로 텍스트가 삐져나가지 않음.
   - 판정: **PASS**

4. **상단 중앙 (`fixed-synthetic-top-center.png`)**:
   - 실제 시각 문자: `CONFIDENTIAL` (12자 완전 표시)
   - 관찰: 상단 중앙 헤더 영역에서 위쪽 경계선과의 안전 패딩 유지. 12글자 선명함.
   - 판정: **PASS**

5. **상단 좌측 (`fixed-synthetic-top-left.png`)**:
   - 실제 시각 문자: `CONFIDENTIAL` (12자 완전 표시)
   - 관찰: 좌측 상단 모서리 영역 침범 없이 내부 마진 유지. 문자 클리핑 없음.
   - 판정: **PASS**

6. **상단 우측 (`fixed-synthetic-top-right.png`)**:
   - 실제 시각 문자: `CONFIDENTIAL` (12자 완전 표시)
   - 관찰: 우측 상단 모서리 내부에서 우상향 배치 유지. 우측 테두리 잘림 없음.
   - 판정: **PASS**

---

### [B] 한글 폰트 렌더링 및 깨짐(네모/tofu) 검증 (2종)

7. **Worker 렌더러 (`worker.png`)**:
   - 실제 시각 문자:
     - 1행: `한글미리보기검증가나다`
     - 2행: `Embedded Korean 123`
     - 3행: `Standard Latin 456`
   - 관찰: 한글 문자 11글자('한', '글', '미', '리', '보', '기', '검', '증', '가', '나', '다') 전 문자가 깨진 네모 상자(tofu / □)나 미지원 글리프 없이 완전하고 미려하게 렌더링됨. 영문 및 숫자도 정상.
   - 판정: **PASS**

8. **Main 렌더러 (`main.png`)**:
   - 실제 시각 문자: `worker.png`와 동일 (동일 SHA-256 바이트 일치)
   - 관찰: Main 스레드 및 Worker 스레드 간 렌더링 결과가 완벽히 동일하며, 한글 네모 현상 0건.
   - 판정: **PASS**

---

### [C] 모바일(320px) 4개 체크박스 정렬 및 UI 점검 (2종)

9. **한국어 모바일 320px (`synthetic-mobile-ko-four-checked.png`)**:
   - **4개 체크박스 정렬**: 상단 4개 서브옵션 탭 버튼(`# 페이지 번호`, `머리글·바닥글`, `워터마크`, `도장·서명`) 직하단에 4개의 `[✓] 포함` 체크박스가 1:1로 수직 축을 맞추어 1행으로 가로 정렬되어 있음. 체크박스 간격과 수평 정렬이 어긋나지 않음.
   - **old include 박스 제거 여부**: 탭 패널 내부 본문(Step 2 표시 내용과 위치 섹션 등)에 기존에 중복 존재하던 독립 include 박스 컨테이너가 완전히 제거되었음. 옵션 포함 제어는 상단 4개 체크박스로 완전 단일화됨.
   - **스위치 썸 및 기타 컴포넌트**: '표지 제외' 토글 스위치 썸이 트랙 내부 중앙에 정확히 안착되어 있으며, 이탈이나 수직 비틀림 없음.
   - **기존 P3 확인**: 320px 협소 뷰포트로 인해 두 번째 탭 버튼 내부 텍스트 `머리글·바닥` 다음 행으로 `글`이 줄바꿈되어 표시됨 (`DISPATCH.md`에 명시된 U4 기등록 P3 결함이며 신규 결함이 아님).
   - 판정: **PASS (기존 U4 P3 1건 확인)**

10. **영문 모바일 320px (`synthetic-mobile-en-four-checked.png`)**:
    - **4개 체크박스 정렬**: 상단 4개 옵션 버튼(`# Page numbers`, `Header & footer`, `Watermark`, `Stamp & signature`) 직하단에 4개의 `[✓] Include` 체크박스가 1:1 수직 정렬되어 1행으로 깔끔하게 배치됨.
    - **old include 박스 제거 여부**: 패널 본문 내 구 include 박스 제거 확인.
    - **텍스트 및 레이아웃**: 영문 문구 정상 래핑, 버튼·컨트롤 정렬 붕괴 없음.
    - 판정: **PASS**

---

## 5. 결함 귀속 및 한계 (Defect Attribution & Scope)

1. **신규 P2 결함 귀속**: **0건**
   - 텍스트 잘림, 글리프 파손, 심각한 레이아웃 붕괴, 스위치 썸 트랙 이탈 등 차단성 결함 없음.
2. **기존 P3 결함 귀속**: **1건 (기존 부채)**
   - `synthetic-mobile-ko-four-checked.png`: 320px 폭에서 '머리글·바닥글'의 마지막 글자 '글' 줄바꿈 (U4 기등록 P3).
3. **미확인 사항 (Unverified)**:
   - 본 검수는 제공된 10종 합성 캡처 이미지에 한정한 정적 시각 검수임.
   - 대화형 브라우저 도구가 부재하므로 실제 클릭/토글 시의 동적 상태 전이(탭 클릭 시 폼 필드 전환, 체크박스 해제 시 입력창 비활성화 등)는 검수하지 못함.
4. **검수 범위 제약**:
   - 본 판정은 제공된 10개 표본에 대한 시각적 건전성 판정이며, 전체 프로덕션 배포 승인이 아님.
   - 기본값 상태에서 페이지 번호만 enabled되고 나머지 옵션은 disabled인 정책, 탭 선택이 옵션을 강제 enable하지 않는 정책, 그리고 긴 워터마크에 대한 기존 말줄임·경고 정책 유지 전제임.

---

**서명**: Gemini
