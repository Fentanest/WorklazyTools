# WU-D 구현 보고 — adsense-followup2-20260920

- 작업: WU-D 오피스 편집기 화면 안내 표시
- 작업 공간: `/home/better0101/projects/wt-followup2-d`
- 브랜치: `work/followup2-d-20260920`
- 기준 커밋: `2fe293d412e667fe916e25258a39c73a0db2786c`
- 최종 제출 SHA: `8dd220c3af7b1c20181f87048ac1dd802f06857c`
- 구현자 서명: Codx

## 커밋

1. `653b80f8683f51d3636663c122e7499aa280fe14` — `feat(office-editor): show guide outside focus mode`
2. `8dd220c3af7b1c20181f87048ac1dd802f06857c` — `fix(guides): align office editor app guidance`

## 변경 파일

- `src/features/office-editor/OfficeEditorAppPage.tsx`
  - canvas shell 다음, drag overlay 앞에 `!focusMode` 조건의 `ToolGuideWrapper slug="officeEditor"`를 형제로 추가했다.
  - 기존 `focusMode = state === "editing" || state === "saving"`를 그대로 사용하므로 idle·downloading·preparing·ready·opening·error에서 렌더되고 editing·saving에서는 DOM에 렌더되지 않는다.
  - 상태 전이, canvas 부모 구조, ResizeObserver, COI/SW, 드롭 처리는 변경하지 않았다.
- `src/locales/ko/guides.json`의 `officeEditor`만 수정했다.
  - `pathBlocks` 키를 `/tools/office-editor/app/`에서 `/tools/office-editor/app`으로 정규화했다.
  - 앱 경로 `pathFaqs`에 랜딩과 같은 `faq_0`~`faq_4` 5개를 추가했다.
- `src/locales/en/guides.json`의 `officeEditor`만 수정했다.
  - KO와 같은 pathBlocks/pathFaqs 변경을 적용했다.
  - 존재하지 않는 Close 동작 문장 1건만 현재 저장 흐름에 맞게 고쳤다.

## Close 문장 대조

- EN 원문: `Pressing the 'Close' button destroys the editing view and the virtual filesystem instance safely, returning you to this menu.`
- EN 변경: `Pressing 'Save and download' downloads the current document and keeps the editor open so you can continue editing.`
- KO 대응 문장: `작업을 마치면 저장 및 다운로드로 결과 파일을 받아 주세요.`
- KO 변경: 없음. 한국어 공통 안내에는 Close 버튼 또는 편집기 종료 주장이 없고 현재 저장 동작과 일치한다.

## 실행 결과

| 검사 | 환경·대상 | 결과 | 로그·증거 |
|---|---|---|---|
| `npm run test:guides` | 최종 소스, 49 App 도구 경로 | exit 0, 통과 | `/tmp/wl-followup2/d/logs/test-guides.log` |
| `env -u VITE_LOCAL_QA npm run build` | production build, 최종 소스 | exit 0, 2,914 modules·정적 101페이지 | `/tmp/wl-followup2/d/logs/build.log` |
| `TEST_BASE_URL=http://127.0.0.1:4292 node tests/office-editor-smoke.mjs` | production preview, Chrome `/usr/bin/google-chrome` | exit 0, 기존 단언 유지. 다운로드 상태 14·캐시 상태 7·Korean Calc 편집·저장 DOCX 5,088 bytes | `/tmp/wl-followup2/d/logs/office-editor-smoke.log` |
| 임시 Playwright DOM/상태 확인 | production preview port 4292, `tests/helpers/ad-stub.mjs` fail-closed 라우팅 재사용, `XDG_CACHE_HOME=/tmp/wl-followup2/d/playwright` | exit 0 | `/tmp/wl-followup2/d/logs/office-guide-check.log`, `/tmp/wl-followup2/d/office-guide-check.json` |
| `git diff --check 2fe293d..HEAD` | 제출 diff | exit 0 | 터미널 확인 |

재사용한 검사 결과는 없다. 위 결과는 모두 최종 제출 소스 또는 그 소스에서 생성한 production build를 대상으로 새로 실행했다.

## Preview DOM·상태 확인

KO와 EN의 `/tools/office-editor/app/`에서 각각 다음을 확인했다.

- ready: `data-focus-mode="false"`, `section[data-ui-component="tool-guide"]` 1개, 언어별 앱 전용 block 존재, `.ui-tool-faq details` 5개, file picker 활성.
- 가이드 영역에 합성 `/tmp/wl-followup2/d/office-guide-check.docx`를 드롭하면 기존 루트 드롭 처리로 문서 `office-guide-check.docx`가 열린다.
- opening의 disabled 상태에서 가이드 영역 dragover는 `dropEffect="none"`, drop overlay 미표시였다.
- editing: `data-focus-mode="true"`, 활성 canvas shell과 문서 이름 확인, 가이드 section 0개.
- KO 저장: saving에서 가이드 0개, 저장 과정 전체에서 가이드 재렌더 0회, 저장 후 editing 복귀에서도 가이드 0개.
- 두 언어 모두 page error 0, 외부 HTTP(S) 허용 0, 광고·분석 요청 0이었다.

## 캡처 및 직접 열람

- `/tmp/wl-followup2/d/shots/ko-ready.png`
- `/tmp/wl-followup2/d/shots/ko-editing.png`
- `/tmp/wl-followup2/d/shots/en-ready.png`
- `/tmp/wl-followup2/d/shots/en-editing.png`

4장을 직접 열람했다. ready에서는 가이드·앱 전용 블록·FAQ 5개가 기존 편집기 아래에 잘림 없이 표시되고, editing에서는 가이드 없이 편집 canvas가 표시된다. 차단할 배치·겹침·잘림은 발견하지 못했다.

## 미완료·제외

- WU-D 범위의 미완료 항목과 차단 결함은 없다.
- 전역 CSS, 정적 생성기, `OfficeEditorPage.tsx`, 다른 가이드 키, 광고 정책은 변경하지 않았다.
- 통합 후보 검사·Astra 검수·Claude 감사·push·배포는 WU-D 소유 범위가 아니므로 수행하지 않았다.
