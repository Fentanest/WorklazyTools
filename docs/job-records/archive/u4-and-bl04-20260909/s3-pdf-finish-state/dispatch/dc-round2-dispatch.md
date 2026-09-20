# 반박 2차 지시서 — 문서 비교 diff 통일·결과 화면 UI 계획 v2 (2026-09-07, Claude → Codex **gpt-6-astra**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(반박: 예외 상황·구성 흠결까지 sol 이 감당할 수 있게, 증거 없는 반박 무게 0) → 계획서 **`docs/jobs/todo/document-compare-granularity-20260907.md` 「v2 반영」 절**(R1~R8 판정·설계 D·「2차 반박 요청」 (i)~(vi)) → 자신의 1차 보고 `docs/jobs/todo/document-compare-rounds/round-1-REPORT.md` + `probes-r1/`(`/tmp/worklazy-dc-r1/` 원본이 남아 있으면 재사용).

## 1. 성격·기준
- **실험 작업(쓰기 모드 필요) — 저장소 불변.** 추적 파일 수정·커밋·push·브랜치 전환 금지. 워킹트리는 `s3-pdf-finish`(다른 구현 잡 병행 — 건드리지 말 것). 실험은 `git archive 5bc6854175331bdd73b267784d9633cdccda8446`(main) 사본 `/tmp/worklazy-dc-r2/main/`(1차 사본 재사용 가능). 산출물 `/tmp/worklazy-dc-r2/`. 사용자 문서 `dummyfortest/*.docx` 는 읽기·메모리 처리만. 빌드·브라우저 직렬 `NODE_OPTIONS=--max-old-space-size=4096`.
- v2 의 판정은 사용자 결정(단어 단위 공용·웹 관찰)을 반영한 것이다. 사실·실행 가능성에 대해 반박하되, 사용자 결정 자체를 되돌리는 제안은 "★사용자 확인" 항으로만 표시.

## 2. 반박 항목 = v2 「2차 반박 요청」 (i)~(vi) 전부
(i) 설계 D 프로토타입: 사본 `word.worker.ts` 경로 밖에서 pyodide(Node `pyodide` 패키지 또는 사본 vendor) 를 띄워 `diffText` 를 JS 전역으로 주입 → `tracked_docx.py` `_paragraph_revision` 의 SequenceMatcher 를 세그먼트→글자 offset opcode 변환으로 대체한 실험판 실행. 1차 fixture 5쌍 + 사용자 문단(메모리) 에서 (가) 웹 세그먼트 == docx ins/del 문자열·offset 정확 일치 (나) 성능(문단 수 1,000 합성, 역호출 총 시간) (다) 반례: 탭·`w:br`·`w:cr`·빈 run·surrogate·기존 after revision 보존 문단·표 셀·메모. 현행 tracked docx 테스트가 어디서 실행되는지(`rg` tests) 와 파이썬 단독 실행 의존 여부. 죽은 `compare_documents`·`_segments`·`_align_*` 제거 시 `compare.py?raw` 로드·`extract_document_model` 정상 여부(제거 후 사본에서 추출 재실행).
(ii) R2 골든 98쌍의 커밋 형태(JSON fixture + unit 파일 위치·크기) 와 tie-break 문안이 구현을 유일하게 결정하는지(`diffUnits` 역추적 규칙을 문장으로 옮겨 다른 구현이 같은 세그먼트를 내는지 1회 대조).
(iii) R4 sidecar 키·offset 검사 프로토타입을 (i) 결과에 재실행 → 예외 목록 확정(ID·이유).
(iv) R6/R7: 1차 CSS 프로토타입을 React 구조 초안(컴포넌트 트리·상태) 으로 옮겨 tab·전체내용 토글·문서 쌍 전환·resize(1599/1600·820/821) 반례와 CLS 재측정; 결과 ARIA 수리 DOM 초안(헤더 row 묶기·유효 `role=cell`·초과 스크롤 영역 이름/키보드 진입) 적용 후 실제 결과 상태 axe **0** 실측(1920 KO·320 EN·다크 1종).
(v) R8 결과 상태 진입 하네스: `accessibility-audit.mjs`·`rendering-baseline.mjs` 가 업로드→비교→결과 진입을 어떻게 등록할지(fixture·세션·타임아웃) 초안 + 1회 실행; 현재 `s3-pdf-finish` HEAD 기준 S3 와의 공통 파일 목록 재산출(`git diff main..s3-pdf-finish --name-only` ∩ 이 계획의 변경 예정 파일).
(vi) sol 재해석 지점 잔여 + 정본 반영 문안. **잔여 0 이면 "Claude–Codex 간 이견 0 · [정본화 가능]" 선언.**

## 3. 판정 형식
항목별 `[동의] / [반박: 증거] / [보완 제안]` + 재현 명령·출력 + 정본 반영 문안 + 잔여 이견 수. 산출물 `/tmp/worklazy-dc-r2/REPORT.md`.
