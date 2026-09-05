# P-QA 커밋·시각 하네스 시계 결정성 증거 — Codx, 2026-09-06

판정·원인·실측은 [review-notes](../../../docs/review-notes.md)의 같은 제목에 기록한다.

## 과제 A

`380764486ebffdbcc5cc065c6cad0278146f503c` (`fix: resolve P-QA Excel labels and HWP toolbar collisions`), 109파일.

- 포함: Excel/HWP 제품 2파일, scenario/단위 테스트 2파일, CHANGELOG/review-notes, 기준선 4장(수정 1+신규 3), 기존 QA 증거 4디렉터리 99파일(PNG 68장).
- [포함 경로 전문](task-a-included.txt). `git show --stat 3807644`로 재확인 가능.
- 제외: `before.docx`, `after.docx`, `naver05161fb06bc9701a23cfc09ad5773578.html`, `docs/jobs/**`; 원본 `p2-final/` 604장은 변경 없음. 모든 push 금지.

## 시계 조사

수정 전 repo-wide 직접 검색 77행(앱 42·테스트/스크립트 35): [직접 호출](clock-direct-audit.txt), [간접 호출·provider](clock-indirect-audit.txt).

```sh
rg -n --glob '*.{js,mjs,cjs,ts,tsx,jsx,html,py}' --glob '!package-lock.json' --glob '!public/vendor/**' --glob '!public/tools/video-studio/runtime/**' --glob '!tests/visual-artifacts/**' '\bDate\s*\(|\bDate\s*\.\s*now\s*\(|\bDateTime\s*\.\s*(now|local|utc)\s*\(|\bTemporal\s*\.\s*Now\b' .
rg -n '^(import|from).*date|DateTime|Temporal|startOfToday|endOfToday|formatDistanceToNow|localIsoDate' src --glob '*.{js,mjs,cjs,ts,tsx,jsx}'
```

직접 호출 검색은 특정 src 하위 폴더에 한정하지 않는다. JS/MJS/CJS/TS/TSX/JSX/HTML/Python을 포함한다. vendor·generated·fixture 예외와 판정 소유자는 다음처럼 분리한다.

| 범위 | 목적·소유자·조치 |
|---|---|
| `src/**`, 자체 `public` HTML/JS, `scripts/**`, `tests/**` | Codx 소유 실행 코드: 재귀 검색. 명시 날짜 파싱·복제는 현재 시각과 구별. |
| `node_modules/`, `dist/`, `.cache/` | gitignore의 설치·생성 결과: package/vendor 스크립트 소유; 원본 `src`/`scripts`를 검사. |
| `public/vendor/**`, `public/tools/video-studio/runtime/**` | 고정 외부 런타임: vendor 스크립트 소유. 엔진 코드 수정 제외, 사용자 시각 공급은 자체 소비 코드에서 판정. |
| `tests/visual-artifacts/**` | 과거 QA 캡처·재현 사본: QA 기록 소유. 하네스 정본은 `tests/visual-regression*.mjs`. |
| 문서·바이너리 fixture | 설명·고정 입력: 문서/fixture 생성 스크립트 소유. 실행 확장자의 생성기는 검색에 포함. |

발견: 캘린더 상태를 현재 시각에서 초기화하는 **3도구/9시나리오/일반 21캡처/QA 72캡처**. 시차 계산기(초기+현재 시각 버튼), 근무 계산기(시작·종료·연차 기준·입사연도), 급여 계산기(퇴직 기준, 현재 캡처 모드에는 숨김)에 같은 고정 Date를 적용한다. 공용 footer 연도는 기존 단일 mask를 보존한다. 이미지 붙여넣기의 날짜 파일명은 현행 scenario/QA에서 paste 동작이 없어 미실행이고, Office 경과시간은 현행 idle workspace 캡처에서 미실행이다. 나머지는 ID·파일 메타데이터·TTL·runner timeout/측정으로 캘린더 픽셀과 무관하므로 native 시계를 보존한다.

## 날짜·연도 변경 재현

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4296 --strictPort
# 별도 터미널
TEST_BASE_URL=http://127.0.0.1:4296 node tests/visual-artifacts/clock-fix-evidence/probe.mjs
```

[probe](probe.mjs)는 실제 browser의 원래 Date를 3개 host 시각으로 교체한 뒤 동일한 하네스 설치 함수를 navigation 전에 실행한다. 날짜·KST 자정·연도 경계가 바뀌어도 ISO `2026-09-05T03:00:00.000Z`(서울 12:00)로 동일하다. 3도구×2언어×3host×2상태=36상태, 반복 24비교의 픽셀 차이는 0. 제품 Date 값뿐 아니라 현재 시각 버튼·연차/퇴직일도 단언한다. `setTimeout`·RAF·`performance.now()` 진행을 실브라우저에서 확인한다. [결과 JSON](rollover-results.json), [출력](rollover.log), 최초 host의 대표 화면 12장을 함께 보존한다.

최초 probe는 segmented-control에 없는 `role=radio`를 가정해 실패했다([원출력](rollover-first-attempt.log)). 본 하네스에서 사용하는 실제 adapter button selector로 probe만 교정했다. 제품·본 회귀의 실패가 아니다.

## 기준선

시계 고정 후 기존 기준선 비교는 21/21로 0.1% 이내였지만 원본 날짜는 2026-09-04 등 서로 다른 채집 시각이었다. 고정 입력과 기준선을 일치시키기 위해 두 도구 14장을 하네스로 재생성했다. 실제 byte 변경은 **9장(시차 5·근무 4)**, 나머지 5장은 byte-identical. 최대 939px/0.076435%, 실패했던 EN mobile은 291px/0.088407%; [장별 실측](baseline-diffs.json). 임계값·mask는 변경하지 않았다.

## 검증 로그

- [일반 production build](build.log), [A unit 193](unit-a.log), [최종 unit 195](unit.log), [static](static.log)
- [Excel smoke](excel-smoke.log), [HWP round-trip](hwp-smoke.log), [utilities](utilities.log)
- [갱신 전 21장 비교](visual-before-update.log), [14장 기준선 생성](visual-update.log)
- [KO 전체 175/175](visual-full-ko.log) **113.34초**, [EN 전체 175/175](visual-full-en.log) **134.10초**, 둘 다 exit 0. 최초 KO 동시 실행은 98/175 진행 뒤 exit 143으로 중단됐다([원출력](visual-full-ko-interrupted.log)); 최종 KO는 단독 전체 재실행 결과다.
- [보존 검사](preservation.json): 원본 QA 604장·사용자 3파일 SHA-256 동일, B 제품 diff 0B, 원격 refs 불변·push 없음.
