# 작업지시서 — 신규 도구 로드맵 (2026-09-03)

**상태: 정본 (2026-09-03 정본화 — 2차 왕복 이견 0 + 기준 해시 실기입. "v2 확정 사항"이 우선 계약.)**
기준 해시: **`9c4459b9e563e8bffdbe3fbb18cc5a1830367a5b`**(video-followup 구현·배포 완료 직후 `HEAD=origin/main` 실측 — Claude, `git rev-parse`). "착수 시 재확인"은 보조 게이트.
근거: 사용자 제공 신규 기능 프롬프트(2026-09-03, 대화 원문) — 8개 신규 도구 + 직접 진입 경로 + 공통 동작.

## 정본화 범위 — 이 문서가 확정하는 것

단위 분할·구현 순서·공통 모듈 계약(경계·위치 포함)·단위 공통 완료 기준·기술 리스크 판정만 정본화한다. **각 단위 상세는 착수 직전 별도 작업지시서로 왕복·정본화한다.** U1 지시서(`excel-compare-20260903.md`)는 본 로드맵과 병행 왕복 중.

## 구현 순서 (U0 신설 외 사용자 지정 순서 유지 — 변경 시 사용자 결정)

0. **U0 공통 기반** — C1~C4 모듈 구축(아래 계약). 공개 화면 없음 — U1의 선행 마일스톤이며 U1 지시서에 통합 기술하되 커밋·검증은 분리 가능.
1. **U1 Excel 비교·대사** — `/tools/excel-compare`
2. **U2 Excel 데이터 정리** — `/tools/excel-cleaner` — **완료 (`dac13bb`, 2026-09-03)**
3. **U3 QR 일괄 생성** — `/tools/qr-studio/bulk` — **route·정적 페이지까지 U3에서 완성**(현행 QrStudioPage `QrMode` 초기 상태 prop화)
4. **U4 PDF 마무리** — 기존 pdf-editor의 `PdfRoute mode` 패턴으로 모드·직접 진입 경로를 **U4에서 등록**
5. ~~**U5 파일 정리** — `/tools/file-organizer`~~ — **드랍 (2026-09-06 사용자 결정: "u5는 전체 로드맵에서 완전히 드랍")**
   - 로드맵 상세는 착수 직전 지시서로 정본화하는 체계라 U5 는 **정본 지시서가 만들어진 적이 없다**(로드맵 한 줄 + 위험 항목 R3·R8 + 선조사가 전부).
   - **번호는 재배열하지 않는다** — U6~U9 를 당기면 기존 커밋·문서·CHANGELOG 의 라벨 참조가 전부 어긋난다. U5 는 빈 번호로 남긴다.
   - 의존 확인(2026-09-06 Claude 실측): 다른 문서의 U5 참조 **0건**, U6~U9 의 U5 의존 **없음**, 공통 모듈 C1~C4 는 U3~U7 공용이라 영향 없음 → **깨끗하게 분리된다.**
   - **함께 폐기**: 위험 항목 R3(증분 SHA-256 라이브러리 선정)·R8(FSA API 매트릭스), 명시 제외의 U5 2항목.
   - **살려서 `docs/backlog.md` 로 이관**(U5 와 무관하게 성립하는 저장소 결함 후보 2건): ① ZIP 라이브러리 이중 의존 ② `zipArchive.ts` 유니코드 파일명 옵션 미명시.
   - 브라우저 rename 실측(2026-09-06)은 **기록으로 보존**한다 — 아래 선조사 절 참조. 폐기가 아니라 "지금 쓸 곳이 없어진 확인된 사실"이다.
6. **U6 문서 개인정보 마스킹** — `/tools/document-redactor` (1차 PDF·JPG·PNG·WebP)
7. **U7 문서 일괄 생성** — `/tools/document-generator` (1차 DOCX 양식 + XLSX/CSV 데이터)
8. **U8 PDF 비교** — `/tools/pdf-compare`
9. **U9 직접 진입 경로 (재정의)** — ① **기존 도구**(PDF 합치기/나누기/삭제/회전/OCR/변환·이미지 리사이즈/모자이크/워터마크·비디오 자르기/합치기/음원 추출·오디오 자르기·Excel 병합)의 직접 진입 preset을 각 feature의 **typed preset prop** 패턴으로 구현 ② 신규·기존 전체 경로의 canonical·정적 페이지·사이트맵·소셜 이미지·redirect **최종 누락 감사**. 전역 generic preset router는 만들지 않는다. 신규 도구의 경로는 각 소유 단위에서 완성한다(U3·U4 참조).

각 단위는 독립 완성·독립 배포 가능해야 한다. 단위 간 의존은 공통 모듈 계약으로만 허용.

> **선행 의존 추가 (2026-09-03 사용자 결정 — `shadcn-migration-20260903.md` 확정 10항)**: U3부터의 신규 도구는 **shadcn 마이그레이션 P-V·P0·P1 완료 후 shadcn 기반으로 구현**한다. 기존 도구 전면 마이그레이션(P2)은 U 단위 사이에 인터리브. U1·U2는 현행 UI로 배포 완료(P2 대상).

## v2 확정 사항 (1차 왕복 — 우선 계약)

1. **R1·R2 확정 지원표**(실측 — SheetJS 0.20.3 합성 BIFF8/XLSB probe·ExcelJS OOXML probe):
   - XLS(BIFF8)·XLSB: **수식(`cellFormula`)·캐시 계산값·표시값(`w`)·숫자서식(`z`) 지원**. 셀 서식은 BIFF8 부분(채움 등)·**XLSB 불가**(`cellStyles:true`에도 `s` 미취득) → **XLS·XLSB 셀 서식 diff는 명시 제외**(부분 지원을 전체 지원으로 승격 금지).
   - OOXML(XLSX·XLSM): ExcelJS 단일 파싱으로 값·수식·캐시값·numFmt·font·fill·border·alignment 취득. **XLSM은 실제 VBA 포함 fixture 통과 시 서식 비교 대상 포함**, 실패 시 제외 사유 기록.
   - **R2 해소**: `XLSX.SSF.format`(ESM 접근 실측 확인)을 표시값 정규화 엔진으로 확정. 제품 문구는 "Excel 화면과 동일"이 아니라 "표시 형식 기준 정규화 문자열"로.
2. **C1 스프레드시트 입력 어댑터(경계 재정의)**: 재사용은 `hasOleCompoundSignatureBytes`·`hasSpreadsheetMlSignature`·SpreadsheetML CDATA 보정으로 한정(`requiresLegacySpreadsheetConversion`은 보존 변환 판정기 — 범용 분류기 아님). 신규: ZIP 내부 `workbook.xml`/`workbook.bin`·content type 확인의 실제 형식 분류. 파서 표면: **OOXML→ExcelJS 단일 / BIFF8·XLSB·SpreadsheetML→SheetJS / CSV→PapaParse**(OOXML 이중 파싱 금지). excel-merger의 파일 선버퍼링(`inspectExcelFiles`의 일괄 `arrayBuffer()`)은 재사용 계약이 아님.
3. **C2+C3 결합**: C3 재사용은 `writeVideoZipArchive`의 순차 ZIP64 kernel만 — 중립 이름 공용 writer로 추출(비디오 worker/client·OPFS 어댑터는 비디오 영역 잔류, 추출 시 `video-zip-streaming` 회귀 검증 필수). C3은 **C2가 검증·정규화한 entry name만 수용**(현행 `uniqueVideoZipEntryName`은 공용 검증기가 아님 — 정확 일치 중복만 처리).
4. **C5 해체 — 3 소유권 분리**: ① UI 진행률 = 기존 `useOperationProgress` 재사용(이미 도메인 중립·단조 가드) ② worker lifecycle = `AbortSignal`·terminal guard·terminate 계약의 공용 추출 ③ Object URL·OPFS·부분 결과 정리 = 각 feature의 `finally`/unmount 소유. 비디오의 단계명·가중치는 공용화 금지. weighted progress는 U1·U2에서 실제 중복 확인 후에만 주입형 순수 함수로 추출.
5. **U0 분리·위치 확정**: C1~C4는 U0 마일스톤(U1 지시서 내 선행 단계)로 구현. 위치 — 스프레드시트 코드는 `src/features/spreadsheet-core/`(신설), 파일명·ZIP 순수 코드는 `src/utils/`, UI 진행률은 `src/hooks/`(현 구조 실측 정합). "개별+ZIP 다운로드"는 **결과 2개 이상일 때만 ZIP**으로 공통 완료 기준 정정.
6. **U9 재정의**: 위 순서 9항 — 소유 단위 동시 구현 원칙 + 최종 감사 단위.
7. **기준 해시**: 정본화 시점 실기입(상단).

## 공통 모듈 계약 (U0 — 중복 구현 금지)

- **C1 스프레드시트 입력 어댑터**: 확정 2항 표면 + 시트·헤더 행 선택 모델.
- **C2 파일명 안전 검증기**: 빈 이름·중복·`../`·구분자·제어 문자·Windows 예약 이름·Unicode 정규화 후 충돌·ZIP 내부 경로 충돌 차단. U3~U7 출력 공용.
- **C3 결과 ZIP 빌더**: 확정 3항 kernel 추출 — C2 통과 이름만 수용.
- **C4 XLSX 보고서 빌더**: 시트 구성·파라미터 기록 + **주입 방어 경계 `writeUntrustedText`**(사용자 유래 값은 `String(value)` primitive 강제 — CellValue 객체 수용 금지, `=`·`+`·`-`·`@`·탭·CR/LF·공백 선행 포함 문자열 타입 기록). CSV 출력은 이 계약으로 보호되지 않음 — CSV 산출 단위는 별도 방어 명시.

## 단위 공통 완료 기준 (모든 단위 지시서에 포함 — 「현지화·SEO·AdSense 동시 검토」)

- ko/en 번역 전 문구 · toolRegistry 등록 · SEO 정적 페이지·사이트맵·FAQ·소셜 이미지 생성 반영 · AdSense 배치·격리 경로 영향 검토 기록.
- 원본 파일 불변 · 다중 파일 · 진행률 · 취소·재실행 · 손상/미지원 구분 · 대용량 사전 안내 · 개별 다운로드(+결과 2개 이상 시 ZIP) · 임시 URL 정리 · 모바일 동작 · 텍스트 상태 구분 · 드래그의 버튼 대안.
- 내부 구현 명칭·원시 예외 비노출.
- 검증: `npm run build` · `npm run test:unit` · 해당 스모크 · `npm run test:static` + 단위별 골든 케이스.
- 기능 요구를 임의 생략하거나 UI 목업으로 대체하지 않는다. 정확 구현이 어려운 항목은 **검증 결과·제한을 기록하고 지원 표시에서 제외**한다(사용자 프롬프트 계약).

## 기술 리스크 플래그 (잔여 — 해당 단위 착수 전 실측 확정)

- ~~R1·R2~~ → **확정 1항으로 해소.**
- ~~**R3 (U5)** 증분 SHA-256 라이브러리 선정~~ — **폐기 (2026-09-06 U5 드랍)**. 이 저장소에 증분 해시 소비자가 없어진다.
- **R4 (U3에서 선결·U4 재사용)** 저장소 WOFF2는 fontkit 저장 뒤 Poppler invalid/빈 렌더로 기각. 고정 Noto CJK Sans 2.004 OTF와 OFL을 해시 고정 벤더링하고, `subset:true` 한글 tofu/누락을 재현해 `subset:false` 전체 임베드를 채택했다. 상세 수치와 해시는 `docs/review-notes.md`·`docs/OFFICE_EDITOR_ASSETS.md` 참조.
- **R5 (U7)** docxtemplater Core(MIT) run 분할 fixture 실측 — 유료 모듈 사용 금지 경계 명시.
- **R6 (U6)** 래스터화 PDF 해상도·용량 정책, 결과 리오픈 검증 패스 실행 계약.
- **R7 (U8)** 페이지 스트리밍 렌더·pdfjs 자원 해제 계약.
- ~~**R8 (U5)** File System Access API + `webkitdirectory` 폴백 매트릭스~~ — **폐기 (2026-09-06 U5 드랍)**. 단, 2026-09-06 실측 결과는 선조사 절에 사실로 보존한다.

## 명시 제외 (전 단위 공통 — 검증 통과 전 지원 표시 금지)

- DOCX·HWP·HWPX 마스킹(U6) / PDF·HWP 생성 출력(U7) / 공인 전자서명·암호학적 서명(U4 — 이미지 삽입임을 화면 명시) / ~~파일 생성일 추정(U5)~~·~~원본 파일 실변경·삭제 표현(U5)~~(**2026-09-06 U5 드랍으로 무효**) / XLS·XLSB 셀 서식 diff(확정 1항).

## 부속 — Gemini 조사 결과 (2026-09-03, 「Gemini 산출물은 단서다」 — 해당 단위 착수 시 실측 검증 후 편입)

- **R3**: `crypto.subtle.digest` 스트리밍 미지원(MDN) → 증분 해시 필요. 후보: `hash-wasm`(MIT·WASM·SHA-256 모듈 ~50KB·증분 API) vs `@noble/hashes`(MIT·순수 JS·~3KB gz). Gemini 권고는 속도 우선 hash-wasm. **버전 실측(Claude, npm info): hash-wasm 4.12.0 · @noble/hashes 2.4.0.** U5 착수 시 수 GB 처리 속도 비교 실측으로 확정.
- **R4**: **U3 실측 확정** — pdf-lib/fontkit의 `{subset:true}`에서 한글 tofu/누락을 재현했다. Noto CJK Sans 2.004 OTF를 `subset:false`로 전체 임베드하며 U4도 같은 생성 스크립트·해시 스냅샷을 재사용한다.
- **R5**: run 분할 병합은 `docxtemplater`만 완전 지원(자체 lexer heal), docx-templates·easy-template-x 취약/미지원, easy-template-x는 머리말·꼬리말 미지원. **실측(Claude, npm info): docxtemplater 3.69.3·license MIT**(이미지 등 유료 모듈 사용 금지). U7 실측으로 확정.

### U5 선조사 (2026-09-05, Gemini 조사 + Claude 검증) — **U5 드랍(2026-09-06)으로 계획 효력 없음 · 실측 사실은 기록으로 보존**

> 아래는 **더 이상 착수 대상이 아니다.** 남겨두는 이유는 두 가지다: ① 브라우저 rename 가능 여부는 **실행으로 확정한 사실**이라 나중에 같은 질문이 나오면 다시 실험하지 않아도 된다 ② 여기서 나온 저장소 결함 후보 2건은 U5 와 무관하게 살아 있어 `docs/backlog.md` 로 옮겼다.

**R8 해소 방향 — File System Access API 는 Chromium 전용으로 취급한다.** Firefox·Safari 는 표준 입장 문서에서 구현을 거부(negative)했다(근거: `mozilla.github.io/standards-positions/#fs-api` · `webkit.org/standards-positions/#position-164`).

> **정정 (2026-09-06, Claude — Codex(astra) 조사로 오류 2건 확인. 「Gemini 산출물은 단서다」 규칙이 걸러내지 못하고 통과된 건이다)**
> ① **"모바일은 전 브라우저 미지원"은 틀렸다** — `showDirectoryPicker()` 는 **Android Chrome 132부터 지원**된다(MDN browser-compat-data `api/Window.json`). 다만 안드로이드에서 **원본 rename 이 실제로 동작하는지는 미확인**이다.
> ② **"권한은 새로고침마다 초기화"는 틀렸다** — **Chrome 122부터 사용자가 지속 허용을 선택**할 수 있다(`developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api`). 일회 허용은 세션 종료·백그라운드 만료로 재승인이 필요하고, `queryPermission()` 확인 후 사용자 제스처 안에서 `requestPermission()` 을 호출하는 설계는 여전히 필요하다. Edge 의 동일 UI·유지 조건은 미확인이다.
> ③ **원본 rename 자체의 상태(착수 시 재확인 필수)**: `FileSystemHandle.move()` 는 **표준 본문이 아니라 별도 제안**(`whatwg/fs` `proposals/MovingNonOpfsFiles.md`)이고 MDN 호환성 데이터는 `standard_track: false` 다. Chrome 문서는 **OPFS 파일은 출시 · 외부 로컬 파일은 플래그 필요 · 디렉터리 이동은 미지원**으로 적고 있으며 출시 논의가 진행 중이다. **"Chrome 기본 지원"으로 단정하지 않는다.**

> **실측 확정 (2026-09-06, Claude 지시 → Codex(astra) 실행 — 문서 조사를 뒤집은 건이다. 보고서 `/tmp/u5-rename-4gl6kmf_/REPORT.md`)**
> 위 ③ 의 "플래그 필요" 는 **이 호스트 Chrome `152.0.7977.64` 에서 사실이 아니었다.** 실제 `showDirectoryPicker()` 로 취득한 로컬 디렉터리에서:
> - **파일 이름 변경 = 플래그 없이 성공.** `before.txt.move('after.txt')` 후 셸 `ls -lai` 로 **inode `1591298 → 1591298` 동일**·크기·mtime 보존 확인 — 복사가 아니라 **진짜 rename** 이다. 확장자 유지·확장자 없음·`.txt→.md` 모두 성공.
> - **폴더 이름 변경 = 기본 설정에서 불가.** `FileSystemDirectoryHandle.prototype` 에 `move` 가 **아예 없다**(`TypeError: h.move is not a function`). `--enable-blink-features=FileSystemAccessAPIExperimental` 를 켜면 OPFS 폴더는 되고, 로컬은 `before.folder → after.folder`(확장자 모양 접미사 유지·비어 있지 않음)만 성공했으며 **일반 폴더·빈 폴더는 Safe Browsing 계열 `AbortError` 로 실패**했다.
> - **대체 연산 비용 실측(3회 중앙값)**: 1MiB — move **1.3ms** vs 복사+삭제 **126.7ms**. 200MiB — move **0.6ms** vs **2,226.5ms**(약 3,700배). 복사 중 `du -B1` 로 원본·복사본이 **각각 209,719,296B 동시 존재**함을 확인했고 복사본은 inode·mode(`0664→0600`)·mtime 이 달라진다. **"대체는 성질이 다르다"가 수치로 확정됐다.**
> - **자동화 가능성**: CDP `Page.setInterceptFileChooserDialog` 와 Playwright filechooser 로는 `showDirectoryPicker()` 를 **처리하지 못했다**(headless 는 플래그 조합 3종 모두 `AbortError`). GTK/X11 네이티브 창과 Chrome 권한 UI 를 직접 조작해야 성공했다 → **일반 회귀 테스트로 만들기 어렵다.** 착수 시 이 제약을 검증 계약에 반영할 것.
> - **여전히 미확인**: 다른 OS·브라우저(Firefox·Safari 는 `showDirectoryPicker()` 자체 미지원이라 무관), 이름 충돌, 중간 실패 시 원자성, 다중 파일 undo. 착수 시 실측 대상이다.
> ④ 대체 연산(**복사 → 완료 확인 → 원본 삭제**)은 진짜 rename 과 다르다 — 전체 파일 I/O·추가 공간이 들고 **부분 실패 시 절반만 변경된 상태**가 남으며, 다중 파일 트랜잭션·자동 undo 는 확인되지 않았다. 이름 충돌은 대상 쓰기 권한이 있으면 **덮어쓰기**로 이어질 수 있다. **판정: 이 API 를 전제로 설계하지 않는다.** `<input webkitdirectory>` 폴백으로 ① 디렉터리 일괄 선택 ② `File.webkitRelativePath` 로 상대 폴더 구조 취득은 가능하나 ③ 원본 디렉터리 쓰기 ④ 절대 경로 취득은 불가. 이는 로드맵 명시 제외("원본 파일 실변경·삭제 표현 금지 — 복사본 ZIP+매핑 보고서만", 68줄)와 **정합한다** — 폴백만으로 요구 기능이 성립하므로 FSA API 는 선택적 향상으로만 둔다.
- 권한 모델: 디렉터리 핸들을 IndexedDB 에 저장해도 **권한은 새로고침마다 초기화**되어 `queryPermission` 이 `prompt` 를 반환하며, 재요청은 사용자 제스처 안에서만 가능. FSA 경로를 쓴다면 이 UX 를 설계에 포함해야 한다.

**R3 — 단계적 중복 판정 전략을 채택하고, 라이브러리 선정은 실측으로 확정한다.** 조사가 제시한 3단계(① `File.size` 로 1차 배제 — I/O 0 ② 크기 동일 그룹만 앞부분 4KB~64KB 부분 해시 ③ 부분 해시까지 같은 소수만 전체 증분 해시)는 근거(jdupes 등)가 있고 우리 제약에 맞다. **단 라이브러리 수치(hash-wasm ~300MB/s 대 @noble/hashes ~110MB/s, 번들 ~50KB 대 ~3KB gzip)는 「Gemini 산출물은 단서다」에 따라 미채택** — 로드맵 R3 계약대로 **수 GB 실측 비교로 확정**한다. 청크 크기 권고 4~8MB 와 Worker 전송 시 Transferable 사용은 실측 설계의 출발점으로만 쓴다.

**메타데이터 한계 — '파일 생성일 추정' 명시 제외의 근거가 보강됐다.** `File` 은 `name`·`size`·`type`·`lastModified` 만 주고 OS 의 생성일(birthtime)은 노출하지 않는다. `lastModified` 도 복사·클라우드 동기화·다운로드를 거치면 현재 시각으로 덮이고, anti-fingerprinting 으로 반올림될 수 있다. → **정리 기준으로 날짜를 쓸 때 이 불확실성을 화면에 명시**한다.

**ZIP 한글 파일명 — Claude 실측으로 조사보다 넓은 문제를 확인했다.**
- 조사 지적(타당): `src/utils/zipArchive.ts:49-56` 의 `zipWriter.add(...)` 는 `bufferedWrite`·`dataDescriptor`·`level`·`signal`·`zip64`·`onprogress` 만 넘기고 **`useUnicodeFileNames` 를 명시하지 않아 라이브러리 기본값에 의존**한다. 방어적으로 명시할 것을 권고.
- **조사가 놓친 것(Claude 실측 — `grep -n "zip.js\|jszip" package.json`)**: 이 저장소는 **ZIP 라이브러리 두 개를 함께 의존**한다 — `@zip.js/zip.js` 2.9.0(공용 C3 경로)과 **`jszip` ^3.10.1**(PDF `pdf-to-image` 경로가 소비 — `PdfImagePanel.tsx:149-164`). **두 경로의 한글 파일명·zip64 동작이 갈릴 수 있으므로 U5 착수 시 두 구현 모두 실측**하고, 가능하면 C3 로 단일화할지 판정한다.
- 레거시 압축 해제 도구(구형 Windows·CP949 강제 유틸)에서 깨질 여지는 남으므로 FAQ 안내를 검토한다.

## 반박 기록

### Codex 1차 (2026-09-03, 완료 — 로드맵 7건 전원 수용 → v2 확정 사항. 실측 기여: BIFF8/XLSB 수식·서식 취득 범위, SSF ESM 접근, xlsPreserve·excelWorkerClient·videoZipArchive·useOperationProgress 재사용 경계, 라우팅 분산 목록. 판정 "재왕복 필요")
### Codex 2차 (2026-09-03, 완료 — 7건 전건 [반영됨] 대조·HEAD 교차검사(xlsPreserve·excelThemeColors·useOperationProgress·writeVideoZipArchive·documentAlignment·video-zip-streaming 테스트 실재 확인)·신규 모순 없음, **"[정본화 가능] 이견 0" 선언**. 정본 확정은 기준 해시 실기입과 동시).

## 실행 기록

### 실행 게이트 (Codx, 2026-09-03)

- 기준 해시: `HEAD=origin/main=9c4459b9e563e8bffdbe3fbb18cc5a1830367a5b`로 정본 기준과 정확히 일치.
- 열린 계획서: 본 로드맵과 U1 정본 외 `excel-format-fidelity-20260903.md`(`162207a`)·`video-followup-20260903.md`(`9c4459b`)는 모두 구현 완료 상태. 전자는 기존 Excel 병합, 후자는 비디오 라우팅·오디오 표면이며 U0·U1 지시와 상반된 열린 지시 없음.
- 기존 워킹트리: MP4 3개·DOCX 2개 미추적 파일은 사용자/선행 작업 소유로 보존하고 모든 스테이징에서 제외.
- 판정: 기준 해시 게이트와 열린 계획서 충돌 검사 통과. U0 → U1 순차 착수 가능.

### U0·U1 구현 완료 (Codx, 2026-09-03)

- 기준·순서: `9c4459b9e563e8bffdbe3fbb18cc5a1830367a5b`에서 U0를 먼저 구현·검증해 `6b49dc9`로, 그 공통 경계 위의 U1을 `da8aa188ccf62e436b7b6a6a02e42f9b8312f926`로 분리 커밋했다.
- U0: 실제 형식 분류와 형식별 단일 파서, 시트/헤더 모델, 안전 파일명·충돌 처리, 순차 ZIP64 kernel, 주입 방어 XLSX 보고서 경계를 추가하고 기존 테마색·legacy 서명·비디오 ZIP을 공용 표면으로 이관했다. 표적 9/9, 당시 전체 unit 110/110, 비디오 ZIP 1/1을 통과했다.
- U1: `/tools/excel-compare`의 위치·키·거래 대사 3방식, 형식별 수식/표시값/캐시값/서식 지원표, 정규화·중복 정책·1:N/N:1 예산, 현재 쌍 전용 worker 수명주기, 실패 격리와 9시트 개별 XLSX·2개 이상 ZIP을 구현했다. ko/en·tool registry·SEO·정적 페이지·사이트맵·FAQ·소셜 이미지·일반 AdSense 경로를 함께 반영했다.
- 최종 검증: `npm run build` exit 0(2,416 modules, 정적 57페이지), `npm run test:unit` 119/119, `npm run test:excel-compare` exit 0, `npm run test:static` exit 0, `video-zip-streaming` 1/1, `git diff --check` exit 0. 모바일 정렬 벤치의 9,000,000 cell product 중앙값은 683.4ms·peak heap 20,603,501B였고 12,006,225는 결정적 위치 폴백을 기록했다.
- 배포 동기화: `git push origin main` 성공. local `HEAD`, local `origin/main`, `git ls-remote origin refs/heads/main`이 모두 `da8aa188ccf62e436b7b6a6a02e42f9b8312f926`으로 일치한다. MP4 3개·DOCX 2개는 스테이징하지 않고 그대로 보존했다.

### U0.1·U2 구현 완료 (Codx, 2026-09-03)

- U0.1 `5619869`, 엔진·규칙 `000db09`, UI·출력 `dac13bb`로 분리 구현했다.
- `/tools/excel-cleaner`의 28종 규칙, 수식·병합 안전 경계, 다중 파일·시트, worker watchdog, XLSX·CSV·ZIP 출력, ko/en·SEO·정적 페이지·소셜 이미지와 100k×10 heap 게이트를 완료했다.
- 완료 검증은 build, unit 158/158, U2/U1 브라우저 스모크, utilities, static, Chrome heap 및 diff 검사를 모두 통과했다.
- `main` push와 GitHub Pages run `33738388547`의 build·deploy가 성공했으며 local·tracking·remote 해시는 모두 `dac13bb55e4d727c02b604d7a326d35d3edd838d`로 일치한다.

### U3 구현 완료 (Codx, 2026-09-04)

- `ui-migration`의 `4a8405c7458ca72e454326e798592330478c67e4`를 기준으로 `/tools/qr-studio/bulk`의 표 입력·7종 페이로드·검증된 PNG·증분 ZIP·manifest·한글 라벨 PDF와 공용 QR/C2/C3 경계를 구현했다. `main`에는 push하지 않는다.
- R4는 WOFF2 invalid 렌더와 OTF subset 한글 파손을 실제로 재현해 해시 고정 Noto CJK Sans 2.004 OTF의 full embed로 확정했다. U4는 같은 폰트 공급 경계를 재사용한다.
- 일반 build·182 unit·QR 브라우저 스모크·96 visual·static·utilities·U1/U2 스모크·추적 제외 QA 16장을 모두 통과했다. 병합·배포는 3자 시각 검수 뒤 별도 결정한다.

> **2026-09-06 — 잔여 단위 U4·U6·U7·U8·U9 의 실행 순서·게이트·공통 계약·착수 조건은 `roadmap-completion-20260906.md`(정본)가 우선한다.** 본 로드맵의 단위 정의·공통 모듈 계약·명시 제외는 그대로 유효하며, 각 단위 상세 지시서는 여전히 착수 직전 왕복·정본화한다.

## 2026-09-09 계획 라운드 범위 — Codx
사용자 최신 지시는 계획서 정본화까지다. 이번 상세 대상은 U6만이며 U7·U8 상세 작성/구현을 하지 않는다. U7 상세 왕복은 U6 종결(배포·사후확인 포함) 뒤 드러난 C1/C2/C3·privacy·번들 사실을 대조한 시점에 시작한다. U8 상세는 U6 종료 사실을 반영하고 U7 종결 뒤 착수 직전에 왕복한다. U9 잔여 계획은 별도 문서로 지금 반박하되 실제 실행은 U8 종결 후 전체 route inventory 재대조가 선행이다. UI는 U4 main 통합·배포 종료 후 기준 재설정 절차만 이번 확정 대상. 번들 중복제거 구현은 비용/투자 사용자 승인 조건. 이 항목은 구현 착수 지시가 아니다.


## 2026-09-09 U4/S3 실행 종결 — Codx

최초U4+BL04와후속사용자신고수리의배포·live사후확인까지완료. 최종release83f210406fbedae41632ed77edffe2db058cae63,Pages34321552862 SUCCESS. U4원문은../archive/u4-and-bl04-20260909/pdf-finish-20260905.md,종결증거는동디렉터리closure-evidence/CLOSURE.json. 기존미달목표·UI부채는backlog/review-notes보존. 다음S4/U6 P0착수,후속U7/U8/U9/UI/용량정리순서불변.

## 2026-09-13 실행 갱신 — Codx

U6(S4)는 `5ac8b647` / Pages `34706393538` 성공과 한영 라이브 출력·자산 검증까지 종결했다. 정본과 종결근거는 `../archive/u6-privacy-masking-20260913/`에 보관. 다음 U7(S5)-0 후보 실증 진행. U4·BL04 종결 및 기존 부채는 유지하며 이후 U8→U9→UI 재기준화→UI v3→용량 정리 순서를 지킨다.

## 실행 갱신 — U7 종결 (2026-09-13 Codx)

U7(S5)는 `1df3c2e50edeb010272d82f15f279c1355f9f8ab` / Pages `34713794908` 성공과 라이브 산출물 대조·DOCX 생성/재개방까지 종결했다. 정본/증거는 `../archive/u7-bulk-generation-20260913/`. 다음 U8(S6)-0 정확도 실증, 이후 U9→UI 재기준화→UI v3→용량 정리 순서 유지. U6 기준선7장 부재와 PDF 파일명 축약 숫자 요청은 backlog에서 추적한다.


## U8 종결·U9 실행 게이트 — 2026-09-13 Codx

U8(S6)는 `9fa435ae6be5c92b05f9032479d1f7298899b76b` / Pages `34719374659` 성공과 live9자산일치·합성PDF비교/XLSX재개방까지 종결했다. 정본/종결증거는 `../archive/u8-pdf-compare-20260913/`. 다음 U9(S7)는 최신release·도구목록·열린계획 gate 후 착수. 이후 UI재기준화→UIv3→용량정리맨마지막 유지. 기존U6누락7 기준선과 PDF파일명 숫자요청은 별도후속으로 추적한다.
