# 1차 검수 하네스의 재검수 조정 — Codx

원본 `/tmp/worklazy-u4-1-review/`는 수정하지 않았다. 새 하네스는 `/tmp/worklazy-u4-1-review2/head`의 현행 HEAD 사본을 읽는다.

- `defects.mjs`: 옛 결함이 4개 발생해야 성공하던 단언을 수정 후 정상 결과 단언으로 바꿨다. F1의 옛 input `maximumTiles:1000`은 JavaScript 반례로 유지하고 읽기 getter가 호출되지 않는 것도 확인. F2에는 긴 줄을 추가. F3은 변경된 공개 ledger 타입에 맞춰 동시 자원 목록을 시점별로 넣고 1200B/2, 800B/2, 200B/1을 리터럴 단언했다. 문서 누적량을 크게 바꾸어도 peak 불변임을 추가 확인.
- `loader-check.mjs`: native flag가 새 계약이므로 plain Node 성공 요구는 제거. 동일 export identity/함수 body SHA/87분류를 1차 결과와 비교하며, 실제 helper를 복사한 fixture의 새 `dependency.ts` import가7을 반환하는지 native flag로 실행했다.
- `source-audit.mjs`: 경로만 현행 사본으로 교체. 13개 unit, 요구 문자열 존재, 실제 PDF.js import 및 DPR 사용을 수집.
- `goldens.mjs`/`mixed.mjs`: 경로 교체. `canvas-B-warning-memory-4-rows`의 `Object.keys` 기대 목록에 공개 API로 추가된 `rawRgbaLedger`/`peakRawResourceCount`를 반영했다. **기존 수치·성공/오류·좌표 기대값은 변경하지 않았다.** 14그룹 모두 통과.
- `run-probes.py`: 첫 실행 결과를 보존한 상태에서 각 명령별 cwd/환경/exit를 별도 기록하려고 한 번 재실행했다. 결과는 `probe-checks.json`과 `*-repro.log`에 있다.
- mutation fixture는 별도 `mutants/`에만 생성한다. 전체13개 finish unit을 그대로 복사하고 제품 하나의 식만 바꾼다. 동일한 독립 계약 probe를 정상 `head/`와 mutant에 각각 실행하여 probe 자체의 정상 통과를 확인한다.
