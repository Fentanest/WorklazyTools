# 문서 비교 v3 — 3차 최소 보완 문안 (Codx)

저장소 원문은 수정하지 않았다. Q1~Q3의 판정과 엔진/UI 분리 결정은 유지한다. 아래 3건을 정본에 반영하면 이번 라운드에서 확인한 잔여가 해소된다. 반영 전에는 이견 0으로 취급하지 않는다.

## R3-1 — 확정 1-a: 가드의 단위 복원

> `beforeTokenCount = tokenize(before).length`, `afterTokenCount = tokenize(after).length`로 정의한다. `(beforeTokenCount+1)*(afterTokenCount+1) > 1_500_000`이면 DP 없이 현행대로 `deleted(before)`·`added(after)` 두 항목을 반환한다. 문자열 길이·UTF-16 길이·code point 길이로 가드 크기를 계산하지 않는다. 동일 문자열 조기 반환은 이 가드보다 먼저 실행한다. 빈 항목 보존과 XML 어댑터의 길이 0 건너뛰기는 현행 확정 1-a 그대로다.

## R3-2 — 확정 2: 삭제 목록 출처 수정

> 제거 대상 정본은 **2차** 산출 `docs/jobs/todo/document-compare-rounds/probes-r2/pruning.json`의 `removed` 31개 정의이다. `keep` 17개 정의와 추출 의존 폐쇄를 보존한다. 이 파일의 SHA-256은 `d2c74bea63190073d951e57818bec11d1e072a9580282577fdccf58b53997894`이다. 착수 기준 코드에서 목록의 각 정의 존재와 의존 폐쇄를 확인하고, 달라졌으면 새로운 삭제 대상을 임의 산출하지 말고 기준 변경 영향으로 보고한다. 추출 80건 동일 출력·`compare.py?raw`·`runPython(compareScript)` 보존 계약은 그대로다.

위 SHA는 보고서 작성 때 `pruning-source-check.json`의 실측 값과 대조하여 사용한다.

## R3-3 — 확정 4·이관·배포·완료 기준: 화면 문구 영향과 검증

> 이번 범위에서 HWP **diff 알고리즘 변경은 0**이다. HWP worker의 기존 안내 문구는 확정 4의 ko/en 문안으로 교체하므로 **사용자 화면 문구 변경은 있다**. 폭·rail·모바일 구조·ARIA 수리·신규 결과 a11y/rendering 등록·장문 시각 fixture는 UI 개편 §6-B로 이관한 상태를 유지한다.
>
> production `npm run build` → `npx tsc -b` → `npm run test:unit` → `npm run test:static` 검증 후, `VITE_LOCAL_QA=1 NODE_OPTIONS=--max-old-space-size=4096 npm run build`로 추적 없는 QA 산출물을 만든다. 이 QA 산출물에 production 분석 코드 존재 검사를 적용하지 않는다. 브라우저 작업과 빌드는 직렬로 실행한다.
>
> `TEST_ONLY_HWP=1 npm run test:new-tools`에 신규 실텍스트 fixture의 변경 문자열·수정 후 본문 복원 단언과 ko/en 안내 문구 단언을 추가한다. HWP 안내가 보이는 결과 화면을 ko/en 데스크톱과 320px 모바일에서 직접 확인해 줄바꿈·잘림·페이지 가로 초과를 확인한다. 정상 DOCX 웹 결과 표본도 확인한다. 새 bridge 실패는 기존 현지화 오류 경계로 전달되며 내부 이름/원시 예외 대신 기존 사용자 문구가 보임을 검증한다.
>
> 기존 문서 비교 시각 시나리오는 `VISUAL_ONLY=document-compare VISUAL_CONCURRENCY=1 npm run test:visual`로 실행한다. 안내 문구 변경으로 기존 `interaction-hwp-result` 기준선 차이가 실제 발생하면 그 차이를 검토·기록하고 해당 상태의 기준선만 갱신한다. 장문 시각 fixture와 a11y/rendering 신규 등록은 이번에 추가하지 않는다. baseline 전체 cleanup은 하지 않는다. 최종 배포 전 육안 검수의 담당·판정은 PROJECT_RULES.md 「배포 전 로컬 시각 검수」를 따른다.
>
> HWP 안내는 worker의 inline `L(ko,en)`이며 locale JSON이나 SEO 정적 본문에서 생성되지 않는다. ko/en을 함께 교체한다. 현행 SEO·FAQ·route·sitemap 의미와 광고/격리 경로는 이 변경으로 달라지지 않음을 기록하고 기존 production 정적 검증을 유지한다. worker bundle/hash 변경을 정적 본문 변경과 혼동하지 않는다.

## 이견 수에 추가하지 않은 편집 보강

- 우선순위 문장은 `정본화 v3 > v2 > v1이며, 충돌 시 v3가 우선한다`로 단순화한다. 현행 “뒤가 앞을 정정”은 나열 방향과 반대지만 뒤의 “충돌 시 이 절이 정본”으로 현재 우선순위는 판독 가능하다.
- 확정 3에 2차 C 첫 문장군을 직접 복원하면 sol 디스패치가 v3만 인용해도 검증 표본을 잃지 않는다: “첫 라운드 oracle 4개 키는 실제 생성 DOCX에서 검사한다. 5쌍 fixture는 `_paragraph_revision` 호출 sidecar 검사와 전체 패키지 구조/수락/거부 검사를 구분한다.” 4키+5쌍 자체는 현행 v2 R4에 남아 있어 별도 정책 이견으로 세지 않았다.
- UI §6-B 첫 문장을 “`round-2-AMENDMENTS.md` D·E의 UI 관련 원문 전체를 필수 계약으로 채택하며, 아래 U1~U6는 요약”으로 명시하면 원문 참조의 효력이 더 분명하다. v3 123행이 이미 “그대로 채택”하므로 현재 손실로 판정하지 않았다.

— Codx
