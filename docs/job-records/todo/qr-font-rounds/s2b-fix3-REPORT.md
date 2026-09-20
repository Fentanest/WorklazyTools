# S2b 3차 검수 F2-R 반영 보고

- 브랜치: `s2b-qr-font`
- 기준: `71a6200aaefed34a8fbf4524faf4e4068370decc`
- 결과 HEAD: `2f59a44737e87019fd90ca84f23e75c7d297ef97`
- 커밋: `2f59a44 Stabilize QR export cancellation smoke test`
- 정지점: 브랜치 커밋 상태. main 병합·push 없음.

## 변경

- `tests/qr-bulk-smoke.mjs:213`: 결과 교체 뒤 성공 결과 1개 표시만 기다리던 흐름에 `waitForGenerateEnabled(page)`를 추가했다. 이 helper는 `page.waitForFunction`으로 생성 버튼이 enabled가 될 때까지 기다린다. 그 다음 기존 `releasedState` PDF 버튼 단언을 그대로 수행한다.
- `docs/review-notes.md:101`: F2-R 반영과 QR 스모크 연속 2회 통과를 Codx 서명 한 줄로 기록했다.
- 새 고정 sleep, 제품 코드, 자산, 패키지, 3 scenario, stale download/font request/reload 단언 변경은 없다.

## QR 스모크 연속 2회 원문

두 명령은 같은 워킹트리에서 중간 변경 없이 한 셸에서 순서대로 실행했고 모두 exit 0이다.

1. `npm run test:qr-bulk`
   - 원문: `/tmp/worklazy-s2b-fix3/logs/qr-bulk-1.log`
   - SHA-256: `c712e0d71b15ba5294cd962bd9bad36474f645b159dc07623ab0ef41865f0559`
   - 최종 결과: subset/full/corrupt 기존 3 scenario와 font404 통과, export cancel `staleDownloads:0`, `exportingReleased:true`, 취소 font 요청 subset 1회, chunk404 reload 1, external requests 0.
2. `npm run test:qr-bulk`
   - 원문: `/tmp/worklazy-s2b-fix3/logs/qr-bulk-2.log`
   - SHA-256: `711d793c3e90b4e6afb473a130a4f67888cd272a6e09f46983bed050fdc387ac`
   - 최종 결과: 1회차와 같은 계약 전부 통과. `full` PDF의 비결정적 metadata 바이트 차이만 1B(4,102,724B → 4,102,725B)이고 embedded full OTF size/SHA는 두 회 모두 고정값과 일치했다.

## 검증

| 명령 | 결과 | 원문 |
|---|---|---|
| `npm run test:qr-bulk` 1회차 | exit 0 | `logs/qr-bulk-1.log` |
| `npm run test:qr-bulk` 2회차 | exit 0 | `logs/qr-bulk-2.log` |
| `npm run test:unit` | exit 0, 247/247 pass | `logs/unit.log` |
| `npx tsc -b` | exit 0, 진단 0 | `logs/tsc.log` |
| `npm run test:static` | exit 0, startup recovery 104 documents | `logs/static.log` |
| `git diff --check` | exit 0, 출력 0 | `logs/diff-check.log` |
| `git diff --check HEAD^..HEAD` | exit 0, 출력 0 | 터미널 재확인 |

현재 저장소 `dist`는 analytics를 제외한 QA 산출물이므로 그 대상의 첫 static 실행은 기대대로 analytics 구성 누락으로 실패했고 원문을 `logs/static-current-qa.log`에 보존했다. 3차 검수 보고가 지정한 동일 HEAD production 산출물 `/tmp/worklazy-s2b-review/production`을 현재 브랜치의 validator/source/package에 연결해 재실행한 최종 static은 exit 0이다. 제거된 3차 검수 checkout을 가리키던 기존 `static-run` 재사용 실패도 `logs/static-review3-stale.log`에 보존했다. 저장소 `dist`는 수정·재빌드하지 않았다.

## 범위와 Git 상태

`git diff --name-only 71a6200..HEAD -- src package.json package-lock.json scripts vite.config.ts public dist` 출력은 비어 있어 제품 코드·빌드 입력·자산 변경이 없다. `71a6200..HEAD` 커밋 수는 1이다.

`git status --porcelain`:

```text
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```

세 파일은 기존 사용자 미추적 파일이며 조작하지 않았다.

`git log --oneline main..s2b-qr-font`:

```text
2f59a44 Stabilize QR export cancellation smoke test
71a6200 test: cover final QR download cancellation task
249e172 test: cover QR export and font recovery lifecycles
93a2318 docs: record S2b font reduction evidence
0198036 feat: reduce QR label PDF font transfers
ae1feea build: vendor pinned QR label font subset
c680030 docs: add Codex model role assignment to AGENTS.md
```
