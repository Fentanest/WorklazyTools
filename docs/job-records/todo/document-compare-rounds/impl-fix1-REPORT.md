# 문서 비교 엔진 fix-1 구현 보고 — Codx

## 제출 상태

- 대상: `/tmp/worklazy-dc-impl`
- 브랜치: `document-compare-engine-20260907`
- 기준: `64b5264a5aab0535a95c9ac4ba9e2c2177354120`
- 제출 커밋: `a418a3f26345caf70bf82d10e91f1453460f0417` (`Strengthen document diff equivalence oracle`)
- 종료 상태: clean
- `main` 병합·push 없음. 제품 `diffText`, 문단/표 정렬, UI, 사용자 문구는 변경하지 않음.

## F1~F3 수리

| 결함 | 수리 | 실행 보장 |
|---|---|---|
| F1 구조 키 무검사 | `equivalence-sidecars.json`에 62개의 독립 기대 키·결과(`match`/`E1`)와 키별 결과 SHA-256을 고정했다. 실제 observation은 `pairId`, `storyPart`, 양쪽 index/path, 선택적 `sourceSlice`를 포함한 키로만 대응하며 누락·중복·예상 밖 키와 다른 키의 정상 결과를 거부한다. | 기존 5쌍 55건 + exact 4건 + E4/E6 pair 3건 = 키 62/62, 결과 지문 62/62. E1 9건도 구조 키와 E1 사유로만 허용하고 호출 순번 문자열은 제거했다. |
| F2 최종 ZIP 거부 미검사 | 생성이 끝난 5쌍 ZIP을 재개봉해 `Worklazy Oracle` 작성자의 삽입 text/행/셀만 제거하고 삭제 text/행/셀을 복원한 story text를 before와 비교한다. 다른 작성자의 기존 after revision은 보존하며 E1 예외는 pair/story별 명시 치환한다. | 5쌍, 13 story part, 구조 revision 5건. 삭제 텍스트 저장 직전 훼손 반례가 최종 package reject에서 실패한다. `comments.xml`은 거부 대상이 아니라 E4 계약대로 after bytes 보존을 별도 검사한다. |
| F3 E4/E6 미등록 pair | 실제 DOCX bytes를 base64 fixture 두 개로 고정하고 실행 시 decode해 생성기와 웹 모델 모두에 넣는다. before/after 메모 작성자·본문이 달라 after `comments.xml` bytes 보존도 실제로 검사한다. | 실제 셀 `['Alpha ', 'Beta']→['Alpha', 'Beta']`. 웹은 `del ' \n' (5,5), ins '\n' (7,5)`, 생성기는 `del ' ' (5,5)`이고 둘째 문단은 무변경임을 단언한다. 이 pair의 ID만 E6이다. |

## oracle 실제 검사 범위

| 범위 | 값 |
|---|---:|
| 기존 core fixture pair / sidecar | 5 / 55 |
| 전체 독립 구조 키 | 62 |
| 구조 키별 독립 결과 지문 | 62 |
| exact 실제 package key | 4 |
| E1 구조 키 허용 | 9 |
| 최종 package reject pair / story part / 구조 revision | 5 / 13 / 5 |
| 실제 다문단 셀 fixture | 1 |
| comments 보존 원본 | after bytes |
| 기존 edge case | 8 |

## 음성 대조 원출력

전체 원문은 `logs/negative-*.log`, exit은 대응하는 `logs/negative-*.exit`에 보존했다.

### 구조 키 오염 — exit 1

```text
AssertionError [ERR_ASSERTION]: Unexpected sidecar key: ["wrong-pair","wrong/story.xml",[-999],[-999],"WRONG/PATH","WRONG/PATH",[-999,-998]]
    at file:///tmp/worklazy-dc-impl/tests/document-diff-equivalence.mjs:124:5 {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: undefined,
  expected: true,
  operator: '=='
}
```

### 최종 ZIP 삭제 텍스트 훼손 — exit 1

```text
AssertionError [ERR_ASSERTION]: base rejected package text differs: [{"storyPart":"word/document.xml","actual":"업무 파일을 CORRUPTED_DELETED_TEXT 처리합니다.메모가 연결된 문단입니다.변경 없는 문단입니다.항목금액비고A10유지B20유지C30유지","expected":"업무 파일을 빠르게 처리합니다.메모가 연결된 문단입니다.변경 없는 문단입니다.항목금액비고A10유지B20유지C30유지","match":false,"exceptionReasonId":"E1","targetStructuralRevisions":5}]

false !== true
```

### E6 실행 fixture 제거 — exit 1

```text
AssertionError [ERR_ASSERTION]: comments-multipara:joined-cell-input pair is not registered
    at file:///tmp/worklazy-dc-impl/tests/document-diff-equivalence.mjs:46:1
```

## 완료 검증

모든 빌드·브라우저 명령은 직렬, `NODE_OPTIONS=--max-old-space-size=4096`, 전용 `TMPDIR=/tmp/worklazy-dc-fix1/tmp`, 전용 npm cache를 사용했다. production preview는 `127.0.0.1:4290 --strictPort`였다.

| 검증 | 결과 |
|---|---|
| `npx --no-install tsc -b --pretty false` | exit 0, 진단 없음 |
| `npm run test:unit` | exit 0, 345 pass / 0 fail |
| `npm run test:document-diff` (최종 커밋 tree 재실행) | exit 0, Pyodide 0.29.4, 위 oracle 범위 전부 통과 |
| 음성 대조 3종 | 각각 exit 1, 위 원출력 |
| `npm run build` | exit 0, 2,834 modules, 정적 61페이지 |
| `npm run test:static` | exit 0, locale/hreflang/runtime/ads/robots/sitemap, startup 104 |
| `TEST_SCOPE=word npm run test:browser` | exit 0 |
| `TEST_ONLY_HWP=1 npm run test:new-tools` | exit 0, 3,584B/1페이지 저장·재파싱·Studio 재개방 |
| `npm run test:office` | exit 0, download 96/cache 7, DOCX 5,088B |
| `npm run test:excel-cleaner` | exit 0 |
| `npm run test:excel-compare` | exit 0 |
| `npm run bundle:measure` | exit 0; entry 299,294B, route 2,450,893B, shared 2,711,698B, app 5,461,885B, CSS 37,687B gzip |
| `npm run css:orphans` | exit 0, zero-reference selector arm 0 |
| `node tests/tool-registry-routes.mjs` | exit 0, 20개·누락/예상 외/중복 0 |
| `git diff --check` | exit 0 |
| 4290~4299 종료 검사 | listening socket 0 |

시각 회귀는 oracle·fixture·기록만 바뀌고 제품/UI/HWP 안내 문구가 변하지 않아 지시서의 테스트 전용 생략 조건을 적용했다.

## 원 워킹트리 불변 범위

`/home/better0101/projects/worklazytools`는 시작과 종료 모두 `s3-pdf-finish`, HEAD `c8bff1fd1ab64f89afb7240778e0a373c953d1a3`였다. 이번 커밋의 8개 대상 경로에 대한 원 워킹트리 status는 종료 시 출력 0이다. 전체 status에는 병행 U4-3 작업이 추가한 PDF 시각 baseline 변경이 실행 중 늘었으므로 저장소 전체 byte 불변이라고 주장하지 않는다. 시작/종료 원문은 `original-state-start.txt`, `original-state-final.txt`에 보존했다.

— Codx
