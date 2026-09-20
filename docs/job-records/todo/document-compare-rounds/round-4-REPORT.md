# 문서 비교 정본 v3 최종 확인 — 4차 (Codx)

**R3-1·R3-2·R3-3과 편집 보강 3건 모두 [반영 확인]. 잔여 이견 0건.**

대상은 `docs/jobs/todo/document-compare-granularity-20260907.md`의 「정본화」 절이다. 행 번호는 [검토 시점 사본](/tmp/worklazy-dc-r4/sources/document-compare-granularity-20260907.md:88) 기준이다. `PROJECT_RULES.md` 전문을 첫 행동으로 읽고 AGENTS, 4차 디스패치, 정본, 3차 AMENDMENTS/REPORT, UI §6-B, 2차 D·E 원문과 관련 기각 이력을 대조했다. 이번 판정은 문안 반영 확인이며 구현·배포 완료 판정이 아니다.

|항목|판정|문서 근거와 확인 내용|
|---|---|---|
|R3-1|[반영 확인]|104행: `tokenize(before/after).length`로 두 토큰 수를 정의하고 `(beforeTokenCount+1)*(afterTokenCount+1) > 1_500_000`으로 계산한다. 문자열·UTF-16·code point 길이 사용 금지와 동일 문자열 조기 반환 우선이 명시됐다. 빈 guard 항목 보존·XML 어댑터의 길이 0 건너뛰기도 유지된다.|
|R3-2|[반영 확인]|111행: **2차** `probes-r2/pruning.json` 전체 경로·지정 SHA·removed 31·keep 17·추출 의존 폐쇄·기준 변경 시 임의 삭제 목록 재산출 금지가 모두 명시됐다. 파일 실존과 SHA, 현재 main의 정의 분할·의존 폐쇄도 재확인했다.|
|R3-3|[반영 확인]|121·123·133행: HWP 안내의 ko/en 문안과 화면 문구 변경 사실, ko/en 안내·실텍스트 변경·수정 후 본문 복원 단언, QA 결과 화면 ko/en 데스크톱+320px 직접 확인, 정상 DOCX 표본, 문서 비교 시각 실행, 실제 차이가 난 `interaction-hwp-result` 상태만 기준선 갱신, 전체 cleanup 금지가 반영됐다. worker inline `L(ko,en)`·locale JSON/SEO 생성원 분리·SEO/FAQ/route/sitemap/광고·격리 불변 기록도 명시됐다. production 검증 후 QA 재빌드 및 빌드·브라우저 직렬 실행을 유지한다.|
|편집 1 — 우선순위|[반영 확인]|91행: `정본화 v3 > v2 반영 > v1 본문`, 충돌 시 v3 우선으로 방향이 명확하다.|
|편집 2 — oracle 4키/5쌍|[반영 확인]|115행: 4개 키는 실제 생성 DOCX에서 검사하고, 5쌍 fixture의 `_paragraph_revision` sidecar 검사와 전체 패키지 구조/수락/거부 검사를 구분하는 문장이 복원됐다.|
|편집 3 — §6-B 원문 채택|[반영 확인]|126행: `round-2-AMENDMENTS.md` D·E의 UI 관련 원문 **전체를 필수 계약으로 채택**하고 §6-B U1~U6 요약이 이를 대체하지 않는다고 명시했다. UI 문서 90행도 같은 원문을 W5에 포함한다. 명시 강화는 검토 대상인 v3에 들어 있으며 UI 문서 첫 문장이 같은 문구로 재작성됐다고 주장하지 않는다.|

**남은 sol 재해석 지점: 0건.** 127·130행에는 종전의 “UI 변경 0” 및 이관 범위 요약이 남아 있다. 그러나 123행이 그 표현을 폭·rail·모바일·ARIA·신규 등록으로 **직접 한정**하고, HWP 문구의 시각 실행·해당 상태 기준선 갱신을 별도로 요구한다. 133행도 QA 빌드를 확정 4-a의 화면 확인에 연결한다. 따라서 이관 절의 일반적인 시각 기준선 제외는 이관된 UI 작업 범위에 적용되며, 확정 4-a의 명시된 문구 검증을 폐기하는 근거가 되지 않는다. 이 판단은 새 예외를 만드는 것이 아니라 이미 추가된 한정 문장의 적용이다. 폭·rail·ARIA 수리·장문 fixture·신규 a11y/rendering 등록을 엔진 범위로 되돌릴 필요도 없다. v3 전체와 채택된 원문을 디스패치하는 기존 계약을 유지한다.

확정 2의 bridge 실패·타입/재구성 오류는 기존 현지화 오류 경계로 전달하고 내부 명칭을 노출하지 않는 계약(108행)도 유지된다. 이번 검토에서 새로운 실패 문구나 UI 등록을 추가하지 않는다.

**실제 실행과 출력**

재현 명령은 `python3 /tmp/worklazy-dc-r4/audit.py`이다. [최종 출력](/tmp/worklazy-dc-r4/audit-output.txt)·[종료 코드](/tmp/worklazy-dc-r4/audit-exit.json)·[문장별 위치](/tmp/worklazy-dc-r4/document-checks.json)를 보존했다. 문자열 포함 검사는 반영 위치의 증거이며 위 의미 판정은 3차 문안과 사람이 대조한 결과다.

```text
R3-1: PASS; clauses=6; lines=[104]; missing=[]
R3-2: PASS; clauses=8; lines=[111]; missing=[]
R3-3: PASS; clauses=18; lines=[123, 133]; missing=[]
EDIT-1: PASS; clauses=2; lines=[91]; missing=[]
EDIT-2: PASS; clauses=2; lines=[115]; missing=[]
EDIT-3: PASS; clauses=2; lines=[126]; missing=[]
pruning: PASS; removed=31; keep=17; definitions=48; closure_equals_keep=True
exit=0
```

[제거 목록 실측](/tmp/worklazy-dc-r4/pruning-check.json): SHA-256 **`d2c74bea63190073d951e57818bec11d1e072a9580282577fdccf58b53997894`**. 중복·교집합·누락 없이 31+17=48개 정의를 나누며, AST에서 `extract_document_model`로부터 도달하는 정의 17개가 keep과 정확히 일치한다. 추출 80건을 이번 라운드에서 실행한 것은 아니다.

[소스 근거](/tmp/worklazy-dc-r4/source-evidence.txt): 실제 `diffText`는 동일 입력을 토큰화보다 먼저 반환하고 `diffUnits`는 토큰 배열의 길이로 셀 수를 계산한다. HWP 안내는 worker `L(ko,en)`에서 생성되어 결과 `UtilityNotice`로 렌더되고, 기존 `interaction-hwp-result`가 실제 HWP 업로드와 결과 진입을 수행한다. raw Python import와 로드 경로도 존재한다. 이 사실은 계획 검증 범위의 근거이며 미래 문구 교체·bridge 연결의 실행 성공을 뜻하지 않는다.

첫 보조 검사는 main과 S3의 **시각 시나리오 파일 전체** 동일성을 과도하게 요구해 exit 1이었다. [실패 원출력](/tmp/worklazy-dc-r4/audit-attempt1.txt)·[스크립트](/tmp/worklazy-dc-r4/audit-attempt1.py)·[종료 코드](/tmp/worklazy-dc-r4/audit-attempt1-exit.json)를 보존했다. [diff](/tmp/worklazy-dc-r4/visual-main-s3.diff)는 기존 S3 PDF 프로필·selector·finish 등록 차이다. 문서 비교 제품 파일 5/5는 main과 같고, 문서 비교 시나리오 블록도 SHA **`332d9259102db03f6077d143b4a44d8279db6b3e0fa793a54edbda9106bbd715`**로 동일하다. 비교 범위를 해당 블록으로 바로잡아 최종 검사를 통과했다([시각 범위 확인](/tmp/worklazy-dc-r4/visual-scope-check.json)). 제품 파일은 수정하지 않았다.

**실행 게이트·저장소 불변**

정본의 현재 기준 SHA와 `main`은 **`5bc6854175331bdd73b267784d9633cdccda8446`**으로 일치한다. 시작·종료 `HEAD`는 **`c8bff1fd1ab64f89afb7240778e0a373c953d1a3`**, branch는 `s3-pdf-finish`다. HEAD와 main의 차이는 지시된 병행 S3 작업이며 문서 비교 제품 표면 5개는 동일하다. 구현 착수 직전 최신 main 재고정·변경 영향 확인·분리 체크아웃 계약은 유지한다. [게이트](/tmp/worklazy-dc-r4/gate.json)·[main 소스 대조](/tmp/worklazy-dc-r4/main-source-check.json).

열린 최상위 계획 문서 **18개**를 검색했다([명령·61개 검색 행](/tmp/worklazy-dc-r4/open-plan-scan.txt)). 현행 UI §6-B는 이관을 수용하고, roadmap은 그 결정을 기록한다. P2/shadcn/S1의 문서 비교 언급은 완료 이력이다. 이번 3차 보완에 상반되는 새로운 엔진 지시는 확인하지 않았다.

`python3 /tmp/worklazy-dc-r4/verify-state.py` → exit 0. [시작 상태](/tmp/worklazy-dc-r4/start-state.json)·[종료 상태](/tmp/worklazy-dc-r4/end-state.json)·[비교](/tmp/worklazy-dc-r4/state-comparison.json): 추적 파일 **2,587/2,587 SHA 동일**, 검토 문서·목록 **6/6 SHA 동일**, HEAD/main/branch/status/worktree 목록 동일. 기존 미추적 DOCX 2개·네이버 HTML·`newui/` 상태도 그대로다. 산출물은 `/tmp/worklazy-dc-r4/`에만 작성했다. 저장소 파일 수정·커밋·push·브랜치 전환·worktree 추가·빌드·브라우저·서브에이전트 실행은 하지 않았다.

— Codx

**잔여 이견 0건. Claude–Codex 간 이견 0 · [정본화 가능]**
