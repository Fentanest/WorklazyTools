# 작업지시서 — Word 비교 후속 2건 (2026-09-02)

**상태: 정본 (2026-09-02 정본화 — 8차 왕복에서 Codex "[정본화 가능] 이견 0" 판정.)**
기준 해시: `4920453` (2차 왕복 검증: 546cf9e..4920453 사이 Word 관련 파일 변경 0건)
**명시 제외**: 동시 작업 중인 `src/features/image-studio/**`와 그 테스트 · 전역 locale(`features.json`)·전역 CSS(§1 문구는 word-compare 컴포넌트의 기존 `L(ko,en)` 방식으로 처리해 전역 파일 불요 — Codex 확인).
재현 파일: `dummyfortest/` 계약서 2개(수동 재현 전용 — CI fixture로 복사 금지). 추출 XML 무결성은 SHA-256으로 원본 DOCX 내부와 일치 확인됨.

## 1. 변경 내용 작성자 통일 옵션

### 사양 (사용자 결정 + 1차 왕복 정밀화)
- 세션 상태 `rewriteRevisionAuthor=false` 신설. 추적 DOCX 옵션 영역(`WordComparePage.tsx:204` 부근, `trackedOutput` ON일 때만 렌더) 안에 토글 배치.
- **ON**: 좌우 문서의 기존 변경 추적을 선행 수락한 사본으로 비교·생성 → 리비전 작성자가 지정 이름으로 통일. 작성자 입력 활성.
- **OFF(기본)**: 현행 동작(기존 리비전 원저자 보존, 신규 차이는 내부 기본값). 작성자 입력은 **렌더 유지 + `disabled`**.
- 토글 변경 시 기존 비교 결과 초기화. 추적 DOCX 출력 OFF면 현행처럼 영역 전체 숨김.
- **메모(comment) 처리(사용자 사양 확정 2026-09-02)**: 메모는 수락 대상이 아니며 **메모 객체·앵커·참조를 보존**한다(comments.xml 전체 불변이라는 뜻이 아님 — 허용 변경 2가지 예외: ① 신규 메모의 author·initials 재작성(아래) ② 메모 본문 내부 리비전의 수락(아래 정밀 의미론)). 단 **ON일 때 '후' 문서에만 새로 추가된 메모의 작성자(w:author·initials)는 지정 이름으로 재작성**하고, 양쪽에 공통 존재하는 기존 메모는 원저자 보존(실측: doc1 메모 8·doc2 메모 6, 작성자 4인 — SML의 신규 메모 2건이 재작성 대상 예시).
  - **신규/기존 판정(3차 왕복 확정 — 실제 DOCX 식별자 실측 기반)**: `w:id`는 문서 간 변동하나 공통 메모의 `w16cid:durableId`·`w14:paraId`는 유지됨(실측: 공통 4건 durableId 일치, 신규 SML 2건만 새 durableId). 판정 순서 — ① 양쪽 `commentsIds.xml`의 **durableId 일치** ② 없으면 메모 첫 문단 **w14:paraId 일치** ③ 최후에만 **one-to-one 소비 fallback**: 수락 후 본문(**메모 본문에 수락 행렬 적용 후 텍스트 기준**) + 답글 부모 identity(`commentsExtended`의 `paraIdParent`를 durable/para로 해석) + 앵커 위치/주변 텍스트, 작성자는 tie-breaker. 동일 후보는 한 번만 소비(집합 판정 금지 — 중복 메모 반례 실증됨).
  - **파트별 변경 표면(3차 왕복 확정, 5차 왕복 한정 보완)**: **작성자 재작성 단계에 한해** 변경은 `comments.xml`의 대상 메모 `w:author`·`w:initials` + `people.xml`(지정 작성자 entry 재사용/신설 — **기존 w15:person 전역 rename 금지, 원 작성자 presenceInfo 미복사**)만. (메모 본문 리비전 수락에 따른 comments.xml 본문 변경은 별도 수락 단계의 허용 변경 — 15행 예외 ②.) `commentsExtended`(paraId/paraIdParent/done)·`commentsIds`·`commentsExtensible`(durableId/dateUtc)는 **identity 보존 대상 — 불변**.
  - **API 형태(3차 왕복 확정)**: 좌우를 단일 입력 `accept_tracked_document()`로 독립 수락한 뒤, **별도 `rewrite_new_comment_authors(accepted_before, accepted_after, author)`** 를 pair 단위로 호출(신규 판정은 양쪽 동시 참조 필요 — 단일 입력 함수만으로 불가).
- **데스크톱판 선례(../word-compare 실측)**: MS Word COM으로 `Revisions.AcceptAll()`+`TrackRevisions=False` 후 `CompareDocuments(RevisedAuthor=지정이름)` — 본 §1 ON의 "선행 수락+단일 귀속"과 동일 의미론(`word_compare_service.py:72-86`). 웹판은 이를 OOXML 직접 구현으로 재현하는 것.

### 전처리 구현 (Codex 실측 기반 확정)
- **삽입점**: `word.worker.ts` pair 루프에서 `extract_document_model()` 호출(`:83`) **직전**에 좌우 DOCX 각 1회 수락 → accepted 버퍼를 **모델 추출(웹·Excel 공용 comparisonResults)과 `generate_tracked_document()`(`:94`) 양쪽에 재사용**. Python 측은 기존 FS 전달 구조에 맞춘 `accept_tracked_document(input_path, output_path)` 형태. pair별 FS 임시 경로는 try/finally 정리.
- `tracked_docx.py:191`의 `_accepted_copy()`는 재사용 가능한 부분 로직일 뿐 "모두 수락"으로 불충분(실측: 문단 끝 `pPr/rPr/w:del` 수락 시 다음 문단과 병합돼야 하나 표식만 제거되어 1097문단 불변 / 표 행·셀 합성에서 삭제분 `old`가 남는 오결과 / moveRange 표식 4종 잔존).
- **OOXML 수락 행렬(전부 구현)**: `w:ins` 언랩 / `w:del` 제거 / `moveFrom` 제거·`moveTo` 언랩 / `moveFromRange*`·`moveToRange*` 표식 제거 / `rPrChange`·`pPrChange`·`tblPrChange`·`tblPrExChange`·`tblGridChange`·`trPrChange`·`tcPrChange`·`sectPrChange`는 현행 속성 유지·과거 기록 제거 / 문단 끝 `pPr/rPr/w:del`은 다음 문단과 구조 병합(`tracked_docx.py:624` 의미론), `w:ins` 문단 끝은 경계 유지·표식 제거 / `trPr/w:del` 행 제거·`trPr/w:ins` 행 유지 / `cellDel` 셀 제거·`cellIns` 셀 유지 / **`cellMerge`**: 병합된 현행 상태 유지·`tcPr`의 cellMerge 기록 제거 / **`numberingChange`**: 현행 번호 매김 유지·기록 제거 / **custom XML 표식**(`customXmlInsRangeStart/End`·`customXmlDelRangeStart/End`): 표식 4종 제거·내용 불변.
- **처리 파트**: document.xml · header/footer · footnotes/endnotes · comments · styles · settings — 텍스트 박스 등 파트 내 중첩 내용 포함. `settings.xml`의 `trackRevisions`는 **수락 후 제거**(doc1 실측 trackRevisions=True).
- **메모 정밀 의미론(2차 왕복 반영)**: `w:comment/@w:author`는 보존 원칙(신규 메모 재작성 예외는 위 사양)이되, **comments.xml 본문 내부의 리비전은 동일 수락 행렬로 수락**(메모 본문도 최종 텍스트로). **삭제 리비전(w:del) 범위 안의 메모 앵커**(commentRangeStart/End·commentReference)는 삭제에서 제외하고 인접 위치에 보존 — 메모 고아화 방지.
- **구현 위치**: 수락 로직은 신규 `accept_revisions.py`(워커의 Python 스크립트 로드 목록에 추가)에 두고 `tracked_docx.py:191`의 `_accepted_copy()` 로직은 참고·이관. §2의 "tracked_docx.py 무수정"은 **런 병합 건에 한정**(§1의 스크립트 목록 추가·로드는 word.worker.ts 측 변경).

## 2. 서식 변경 대량 표시(위양성) 수정

### 기전 (왕복 후 확정)
- 웹/Excel: `_paragraph_record`가 `paragraph.iter(w:r)` 런 경계를 `||` 시그니처에 포함(`compare.py:239-253`) → proofErr·rsid 런 분절이 위양성 생성. **기본 UI 실측 기준값 133건**(1차 왕복 정정 — 이전 124~127은 방법론 차이).
- **변경 추적 DOCX는 해당 결함 없음(1차 반박으로 §2 초안 기각)**: `_styled_tokens`는 문자 단위 토큰이라 런 경계 무관. 실측상 추적 DOCX의 서식 리비전은 **진양성 highlight `rPrChange` 4건뿐** — 이 4건은 유지 대상(0건 기대에서 제외).

### 수정 내용
- **인접 동일 서식 런 병합을 `_paragraph_record()` 한 곳에만** 적용(표 셀은 `:337`에서 동일 함수 경유 — 별도 구현 금지). 병합 순회는 **컨테이너(hyperlink·w:ins/w:del wrapper)·필드·비텍스트 자식(tab/br/각주 참조) 경계 인식** — 리비전 경계·컨테이너 경계를 넘는 병합 금지.
- `tracked_docx.py`는 **수정하지 않는다**. 기존 문자 토큰·이벤트·wrapper 로직(S1~S14 수리 포함)을 회귀 대상으로 고정.

## 3. 검증·완료 기준

- 스모크: **`TEST_SCOPE=word npm run test:browser`**(`browser-smoke.mjs:55,736`). 기존 fixture의 w:ins(`:1180`)·OFF 보존 검사(`:1247`)에 **ON 경로 추가**. **ON 경로의 accept/reject 오라클은 원본이 아니라 "수락된 before/after"**로 정의하고, 현행 helper의 원본 비교(`:1347`)·고정 작성자(`:1360`)를 이에 맞게 갱신.
- **highlight 웹 지원 결정(2차 왕복 반영)**: `_run_style`(`compare.py:223`)에 highlight 추출을 **추가**한다 — 위양성 133건 제거 후 웹/Excel에도 진양성 highlight 4건이 정직하게 표시되도록. 웹 진양성 fixture에 highlight 단언 포함.
- 합성 fixture 확장: proofErr/rsid 분절(웹 format 0 기대) + 진양성 분리 단언(굵게·색상·highlight 각각) + 크기·글꼴 + A-B-A 서식 경계 + 표 셀 + 리비전 wrapper·hyperlink·필드·tab/br·비텍스트 경계 + §1용 통합 DOCX(inline ins/del·move·문단 끝 삭제/삽입·행/셀 리비전·속성 리비전·**cellMerge·numberingChange·custom XML 표식·trackRevisions**·메모 보존·신규 메모 재작성·**메모 본문 내 리비전(수락 후 매칭 검증용)·답글(paraIdParent)·동일 본문 중복 메모**).
- **기존 안내 문구 갱신(2차 왕복 발견 모순)**: `WordComparePage.tsx:283`의 "기존 작성자 기록은 유지" ko/en 안내를 OFF 기본(보존)/ON(통일) 의미로 갱신 — 컴포넌트 `L(ko,en)` 방식.
- dummyfortest 수동 재현: 웹 서식 변경 총계 133→**4** — 내역: **런 분절 위양성 133건 전부 제거**(현행 133건은 모두 위양성 — highlight는 현행 미검출이라 그 안에 포함될 수 없음) + **`_run_style` highlight 확장 신설로 진양성 4건 신규 표시**. 텍스트 변경·기존 리비전 표시는 불변. 추적 DOCX 서식 리비전은 highlight 진양성 4건만, §1 ON 시 리비전 작성자 지정 이름 단일화 + **공통 기존 메모 작성자 보존 + 후 문서 신규 메모(SML 2건)의 author·initials 지정 이름 재작성** 확인.
- **생성된 추적 DOCX의 LibreOffice 열기 검증** 포함.
- **변경 금지 표면 단언(4차 왕복 반영)**: ON 처리 후 `commentsExtended`(paraId·paraIdParent·done)·`commentsIds`·`commentsExtensible` 바이트/구조 불변, 기존 `w15:person` entry 미변경(전역 rename 없음), 신규 작성자 entry에 `presenceInfo` 미복사를 테스트로 단언.
- `npm run build` · `npm run test:unit` · 위 word 스모크 · `npm run test:static`. 신규 문구는 컴포넌트 `L(ko,en)`. CHANGELOG Codx → 커밋 → push(배포).

## 4. 반박 기록

### Codex 1차 (2026-09-02, 완료 — 수정 목록 11건 전원 수용, 판정 "재왕복 필요" → v2 반영)
- 구조 정정: 전처리 삽입점을 word.worker.ts pair 루프로 확정(Python 내부 각자 전처리안 기각 — 3출력 불일치 위험) / OOXML 수락 행렬·파트 목록·trackRevisions 처리 신설(_accepted_copy 불충분 실측) / 메모 보존 의미론 명시 / compare.py 병합 1개소 한정·경계 인식 / **tracked_docx 병합 지시 기각·삭제**(문자 토큰 실측 — Claude 초안 §2의 해당 판정 오류 정정) / 기준값 133건·진양성 highlight 4건 정정 / 스모크 명령·fixture·LibreOffice 검증 확정.

### Codex 2차 (2026-09-02, 완료 — 판정 "재왕복 필요": 해소 6·부분 4·재개방 1 + 새 모순 1 → v4 반영)
- 반영: 기준 해시 4920453 갱신(①) / cellMerge·numberingChange·custom XML 표식 동작 확정(④) / comments.xml 내부 리비전 수락·삭제 범위 내 앵커 보존(⑤) / `accept_revisions.py` 신설·"무수정" 범위 한정(⑦) / fixture에 4종 추가·highlight 웹 지원 결정(⑨) / ON 오라클=수락본·helper 갱신(⑩) / `:283` 안내 문구 모순 갱신(추가 발견).

### Codex 3차 (2026-09-02, 완료 — 2차 잔여 3건 충족 확인, 신규 메모 사양 이견 4건 → v5 반영)
- 반영: (작성자,본문) 집합 매칭 기각(중복 반례 실증) → **durableId→paraId→one-to-one fallback** 판정 순서 채택 / 수락 후 본문 기준·paraIdParent 답글 관계 명시 / w15/w16 파트는 identity 보존 대상으로 구분(변경 표면 = comments.xml author·initials + people.xml entry, 전역 rename·presenceInfo 복사 금지) / pair 단위 `rewrite_new_comment_authors()` 분리 / fixture에 메모 리비전·답글·중복 본문 케이스 추가.

### Codex 4차 (2026-09-02, 완료 — 3차 이견 4건 해소 확인, 표현 충돌·검증 누락 3건 → v6 반영)
- 반영: "comments.xml 보존"을 메모 객체·앵커·참조 보존으로 한정(허용 변경 2예외 명시) / 수동 재현 오라클을 신규 메모 재작성 계약과 정합 / 변경 금지 표면(identity 파트·people entry) 단언 추가.

### Codex 5차 (2026-09-02, 완료 — 4차 잔여 3건 해소 확인, 신규 1건(17행 배타 표현 vs 본문 수락 충돌) → v7 반영)
- 반영: 17행의 변경 표면 배타 규정을 "작성자 재작성 단계 한정"으로 좁히고 본문 수락 변경은 15행 예외 ②로 귀속.

### Codex 6차 (2026-09-02, 완료 — 5차 잔여 해소 확인, 신규 1건(웹 기대값 133→0 vs highlight 4건 표시 모순) → v8 반영)
- 반영: 수동 재현 기대값을 총계 133→4(위양성 129 제거·진양성 4 잔존)로 정합.

### Codex 7차 (2026-09-02, 완료 — 총계 133→4는 정합 확인, 제거 내역 의미론 불일치(129 제거·4 잔존 vs 133 전부 위양성) 1건 → v9 반영)
- 반영: 내역을 "위양성 133건 전부 제거 + highlight 신설로 진양성 4건 신규 표시"로 통일(32·42-43행과 정합).

### Codex 8차 (2026-09-02, 완료 — 7차 잔여 해소 확인·새 모순 없음, **"[정본화 가능] 이견 0" 선언** → 정본 확정)
- 착수: 비디오 A2 완료 후 최우선(코드 단일 작성자 직렬화). 착수 시 기준 해시 재대조(§ 상단)·게이트 기록.

## 실행 게이트 기록 (2026-09-02, Codx)

- 기준 해시 게이트: 현행 `HEAD`는 `732e654`이며 기준 `4920453` 이후 커밋은 `732e654 Retain safe video encoding thread cap` 1개다. `git diff --name-only 4920453..HEAD -- src/features/word-compare tests` 결과는 `tests/unit/video-encoding.test.ts` 1개뿐이고 Word 비교 코드·fixture·브라우저 스모크 변경은 0건이어서 본 작업의 전제는 유지된다.
- 열린 계획서 충돌 검사: `docs/jobs/todo`의 다른 열린 문서는 이미지 스튜디오 Phase 3와 비디오 성능 계획이다. `rg`로 Word 비교 코드 표면(`word-compare`, `WordCompare`, `word.worker`, `compare.py`, `tracked_docx`, `accept_revisions`, `browser-smoke`)을 대조한 결과 두 문서에서 상반 지시는 0건이다. 공용 `CHANGELOG.md`만 겹치므로 기존 비디오 기록을 보존하고 Codx 항목을 추가한다.
- 착수 전 워킹트리: 사용자 소유 미추적 `dummyfortest/` 성격의 `before.docx`·`after.docx`와 MP4 3개가 존재한다. 수정·삭제·스테이징하지 않는다.

## 구현·검증 기록 (2026-09-02, Codx)

- §2: `compare.py`의 `_paragraph_record()` 한 지점에서 proofErr·rsid 분절을 흡수하되 hyperlink·리비전 wrapper·필드·tab/br·비텍스트 자식 경계를 넘지 않는 동일 서식 런 병합을 구현하고 `_run_style()`에 highlight를 추가했다. 텍스트가 함께 바뀐 문단의 동일 문자 구간 서식 차이는 `formatRuns`로 분리 집계한다. `tracked_docx.py`는 diff 0으로 유지했다.
- §1: ON/OFF 기본값·disabled 작성자 입력·결과 초기화 UI를 ko/en으로 추가했다. 신규 `accept_revisions.py`에 정본 OOXML 수락 행렬과 처리 파트·`trackRevisions` 제거를 구현하고, worker pair 루프에서 좌우 수락본을 모델 추출과 추적 DOCX 생성에 함께 재사용하며 모든 임시 경로를 finally에서 정리한다. 신규 메모 판정은 durableId→paraId→identity-free one-to-one 소비 fallback 순서이며 작성자 단계는 대상 `comments.xml` author/initials와 `people.xml` 신규 entry만 변경한다. 불충분한 기존 `_accepted_copy()` 재사용, 작성자 집합 매칭·people 전역 rename, 런 경계 결함이 없는 `tracked_docx.py` 변경은 정본 기각 사유대로 채택하지 않았다.
- 합성 fixture: proofErr/rsid·컨테이너·필드·tab/br·각주 참조·A-B-A·표 경계는 서식 변경 0건, 굵게·색·highlight·크기·글꼴·표 highlight는 6건을 각각 단언했다. 통합 수락 fixture는 inline/move/문단 끝/행·셀/속성/cellMerge/numberingChange/custom XML/settings/메모 본문·답글·중복 메모와 identity/people 불변을 ON 브라우저 경로에서 검증했다.
- `dummyfortest` 수동 재현: 웹 서식 변경 133→4. OFF 추적 DOCX의 독립 `rPrChange`는 cyan highlight 4건만이며(텍스트 ins/del 내부 조각 제외), ON 산출물의 신규 리비전 10건 작성자 집합은 `{Unified Reviewer}`다. 공통 기존 메모 6건의 작성자·initials는 보존되고 후 문서 SML 신규 메모 2건만 `Unified Reviewer`/`UR`로 변경됐다. `commentsExtended.xml`·`commentsIds.xml`·`commentsExtensible.xml`은 바이트 동일하며 LibreOffice headless PDF 변환 결과 `/tmp/worklazy-dummy-manual/pdf/unified.pdf`(1,012,213 bytes)를 확인했다.
- 완료 기준: `npm run build` 통과(2,346 modules, 55 localized pages), `npm run test:unit` 통과(65/65), `TEST_SCOPE=word npm run test:browser` 통과(Word comparison 포함 전체 메시지), `npm run test:static` 통과. 사용자 문구는 컴포넌트 ko/en을 함께 반영했고 URL·SEO 메타·정적 페이지 구조·광고 배치·격리 경로는 바뀌지 않아 추가 변경하지 않았다.
- 배포: 명시 허용목록 12개 경로를 `509c61a Fix Word formatting diffs and unify revision authors`로 커밋해 `origin/main`에 push했다. 로컬 HEAD·`origin/main`·`git ls-remote`가 모두 `509c61ab1a2e190fdc232506a46a48508db8c8d0`으로 일치했고 GitHub Pages run `33607258611`의 build·deploy가 success로 완료됐다.
