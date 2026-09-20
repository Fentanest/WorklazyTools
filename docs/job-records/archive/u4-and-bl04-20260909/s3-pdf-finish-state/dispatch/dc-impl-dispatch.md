# 착수 지시서 — 문서 비교 diff 코어 통일(엔진) (2026-09-07, Claude → Codex **gpt-5.6-sol**)

## 0. 선독(순서대로)
1. `PROJECT_RULES.md` → `AGENTS.md`(sol 코딩: 정본 미정의는 「범위 밖 발견」으로 보고, 임의 결정 금지).
2. **정본** `docs/jobs/todo/document-compare-granularity-20260907.md` 의 **「정본화 (2026-09-07 11:55, v3)」 절 전체**(우선순위: v3 > v2 > v1, 충돌 시 v3). 확정 1·1-a·1-b · 2·2-a · 3·3-a · 4·4-a · 이관 · 기준 해시 · 완료 기준 · 명시 제외.
3. **필수 계약 원문**: `docs/jobs/todo/document-compare-rounds/round-2-AMENDMENTS.md` A~C·E 절(D·E 의 UI 부분은 이관 — 구현 금지), `round-3-AMENDMENTS.md` R3-1~R3-3, `round-4-REPORT.md`(반영 확인·pruning 실측).
4. 산출 자료: `document-compare-rounds/probes-r1/`(98쌍 세그먼트 `algorithm-results.json`·`SEGMENTS.md`), `probes-r2/pruning.json`(SHA `d2c74bea63190073d951e57818bec11d1e072a9580282577fdccf58b53997894`, removed 31/keep 17).

## 1. 성격·기준·격리
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 커밋은 완료 기준이며 커밋 금지 제약 없음. **main 병합·push 금지**(push 전 Claude 가 사용자에게 보고).
- **분리 체크아웃 필수**: 현재 워킹트리 `s3-pdf-finish` 는 U4 구현·검수가 병행 중이다. **절대 전환·수정하지 말 것.** 착수 절차: ① `git rev-parse main` 으로 최신 main 확인 — `5bc6854175331bdd73b267784d9633cdccda8446` 와 다르면 `git diff 5bc6854..main --name-only` 로 영향 기록 후 **보고하고 정지**(기준 해시 게이트). ② 같으면 `git worktree add -b document-compare-engine-20260907 /tmp/worklazy-dc-impl 5bc6854175331bdd73b267784d9633cdccda8446` ③ 이후 모든 작업은 그 worktree 에서. 원 저장소에서 checkout/switch/reset/stash/clean 금지, `dist/`·캐시 정리 금지.
- 의존성: 사본 설치 대신 항목별 링크 또는 사본 설치 중 택일하되 **공유 `.tmp/.vite/.vite-temp` 캐시에 쓰지 않도록** 사본 전용 캐시(`TMPDIR`·`npm_config_cache`)를 쓴다. 새 npm 의존 추가 금지.
- **병행 잡 주의**: 다른 Codex 잡이 preview 서버를 띄운다. 포트는 **4210~4219** 범위에서만 쓰고 `--strictPort`. 빌드·브라우저는 **직렬**, `NODE_OPTIONS=--max-old-space-size=4096`.
- 사용자 문서 `dummyfortest/*.docx` 는 **읽기·메모리 처리만**(fixture 커밋 금지).

## 2. 구현(논리 단위별 커밋 권장)
1. **골든 고정(코어 변경 0)**: `tests/fixtures/document-compare/word-diff-golden.json` + `tests/unit/document-diff-golden.test.ts`. probes-r1 98쌍 중 사용자 문단 1쌍을 뺀 **97쌍**(합성 27·Word fixture 68·HWP 2)을 **정적 기대값**으로. 실행 시 현행 함수로 자기 생성 금지. 확정 1 의 토큰·LCS·역추적·병합 규칙과 확정 1-a 가드(토큰 수 기준·빈 항목 보존)를 문서 주석으로 고정.
2. **pyodide 역호출 + 생성기 교체**: `word.worker.ts` 에 동기 JS 전역 `worklazyDiffJson(before, after) => JSON.stringify(diffText(before, after))` 등록 후 Python 로드. `tracked_docx.py` 의 `_paragraph_revision` 문장 diff 를 `from js import worklazyDiffJson` + `json.loads` 로 교체(값만 수신, PyProxy 방치 금지, **Python 단독 fallback 없음**). 세그먼트 → **code point cursor** 변환(equal 양쪽·deleted before·added after, `len(segment.text)`; JS `.length` 사용 금지), 마지막 cursor == 입력 길이 검증, `w:tab=\t`·`w:br|w:cr=\n`, run 경계·빈 run 길이 0, surrogate pair 1 code point. 기존 이벤트·서식·revision 보존 분기 유지. 문단·표 정렬 `SequenceMatcher` 는 **광역 제거 금지**. bridge 실패·타입 오류·재구성 불일치는 기존 현지화 오류 경계로(내부 명칭 비노출).
3. **동치 oracle**: 확정 3·3-a 대로 sidecar 키(`pairId, storyPart, beforeIndexes[], afterIndexes[], beforePath, afterPath`)로 묶어 문자열·**offset·순서** 정확 일치 검사 + **offset 1 이동 음성 대조 실패** 단언. 예외는 fixture ID·이유로 E1~E6 고정(**E2·E6 은 이름 붙은 회귀 fixture 로 명시 제외**). 2차 oracle 4키는 실제 생성 DOCX 로 검사, 5쌍 fixture 는 `_paragraph_revision` sidecar 검사와 패키지 구조/수락/거부 검사를 구분.
4. **죽은 코드 제거**: `probes-r2/pruning.json` 의 `removed` 31개 정의만 제거(SHA 대조 필수), `keep` 17 + 추출 의존 폐쇄 보존. 목록이 현행 코드와 다르면 **임의 산출 금지 → 보고**. 검증: 추출 ko/en × tables on/off × metadata on/off × 10파일 **80건 동일 출력**. `compare.py?raw` import·`runPython(compareScript)` 보존.
5. **HWP**: 실제 텍스트 변경이 있는 **합성 HWP fixture 추가**(기존 빈 fixture 유지) → `TEST_ONLY_HWP=1 npm run test:new-tools` 에 변경 문자열·수정 후 본문 복원 단언 + **ko/en 안내 문구 단언**. 안내 문구는 확정 4 문안으로 교체(worker inline `L(ko,en)`, 내부 명칭 제거).
6. **기록**: CHANGELOG 간결 + `docs/review-notes.md` 문서 비교 절(코어 계약·bridge·oracle 범위와 E1~E6 예외·죽은 코드 31/17·HWP 문구·측정값) Codx 서명.

## 3. 검증(전부 실행·원출력 보존)
production `npm run build` → `npx tsc -b` → `npm run test:unit`(골든 97 포함) → `npm run test:static` → `VITE_LOCAL_QA=1 npm run build` 로 QA 산출물(여기에 production 분석 코드 검사 미적용) → 확정 4-a 화면 확인(**ko/en 데스크톱 + 320px 모바일**에서 HWP 안내 줄바꿈·잘림·가로 초과, 정상 DOCX 웹 결과 표본; 스크린샷 `/tmp/worklazy-dc-impl-out/shots/`) → `TEST_SCOPE=word npm run test:browser` · `TEST_ONLY_HWP=1 npm run test:new-tools` · `npm run test:browser` 전체 · `npm run test:office` · `npm run test:excel-cleaner`·`test:excel-compare` → **동치 oracle 실행** → `VISUAL_ONLY=document-compare VISUAL_CONCURRENCY=1 npm run test:visual`(기존 `interaction-hwp-result` 차이가 실제 나면 검토·기록 후 **그 상태 기준선만** 갱신, 전체 cleanup 금지) → `npm run bundle:measure` · `npm run css:orphans` · `node tests/tool-registry-routes.mjs` · `git diff --check`. **사용자 문서 수동 재현 1회**: 제14조 ④ 에서 웹 세그먼트와 추적 docx ins/del 의 문자열·offset 일치(메모리 처리, 산출물에 문장만 인용).

## 4. 금지
main 병합·push · 원 워킹트리 전환·수정 · 문단 정렬 알고리즘 변경 · 글자 단위 정제 도입 · 메모 본문 diff 의 docx 반영 · `diffCharacters`(서식) 변경 · UI 변경(폭·rail·모바일·ARIA — 이관됨) · 장문 시각 fixture·결과 a11y/rendering 신규 등록 · 사용자 문서 fixture 커밋 · 새 npm 의존 · 정본 미정의 임의 결정 · 계획서 편집.

## 5. 정지점·보고
커밋 후 브랜치 `document-compare-engine-20260907` 상태로 정지 → astra 검수. 보고: 커밋별 요지·bridge 계약·oracle 통과/예외 표·80건 동치·HWP 단언·검증표·스크린샷 경로·범위 밖 발견·git 상태(원 워킹트리 불변 증명 포함). 산출물 `/tmp/worklazy-dc-impl-out/`.
