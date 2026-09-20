# U4-2 fix-1 완료 보고

2026-09-07 · Codx

## 기준·커밋

- 브랜치: `s3-pdf-finish`
- 기준: `47c0f2286887111e3573d5efaec0af57165d7d0d`
- 결과: `446a1e35ba60ebc308a32a13f8b675a02b095365` (`fix: preserve PDF worker terminal errors`)
- main 병합·push·배포 없음

## 수정

`src/features/pdf-editor/pdfWorkerLifecycle.ts`의 PDF 소유 adapter가 `terminate()` 진입 시 자체 종료 상태를 먼저 잠그고 원 Worker의 message/error callback을 해제한다. 종료 뒤 callback은 envelope 상태 갱신과 공용 lifecycle 전달을 모두 거부한다. 최초 수락한 PDF error envelope는 message/code 값을 복사해 보관하므로 같은 턴의 늦은 error가 AbortError, 최초 worker error, error-event/post-throw 시작 오류의 name/message/code를 바꾸지 못한다.

공용 `src/utils/workerLifecycle.ts`, Excel cleaner/compare, 기존 4모드 UI·문구, astra probe는 수정하지 않았다. UI·번역·SEO·정적 페이지 내용·광고 격리 경로 영향은 없다.

## 추가 unit 반례

1. `PDF worker facade keeps the abort error when a late worker error arrives in the same turn`
2. `PDF worker facade keeps the first worker error when a late worker error arrives in the same turn`
3. `PDF worker facade keeps the start error after an error event and a late worker error`
4. `PDF worker facade keeps the start error after postMessage throws and a late worker error`

각 반례에서 최초 오류 name/message/code, raw Worker terminate 1회, abort listener 0을 단언한다. 다음-task abort 대조군을 추가했고 기존 result→late error 검사를 보존했다. 전용 unit은 22/22, 전체 unit은 294/294다.

## astra 원본 probe

원본 `/tmp/worklazy-u4-2-review/probes/lifecycle.mjs`는 수정하지 않았다. 스크립트가 고정 참조하는 `/tmp/worklazy-u4-2-review/current`에서 제품 source 한 파일만 현행 워킹트리와 동기화한 뒤 그대로 실행했다.

```text
PASS terminal-abort-then-late-error {"error":{"name":"AbortError","message":"The PDF operation was canceled.","code":20}}
PASS terminal-error-then-late-error {"error":{"name":"Error","message":"FIRST","code":"FIRST_CODE"}}
PASS terminal-error-event-then-late-error {"error":{"name":"Error","message":"Unable to start the PDF operation."}}
PASS terminal-post-throw-then-late-error {"error":{"name":"Error","message":"Unable to start the PDF operation."}}
PASS late-error-in-next-task-control {"error":{"name":"AbortError","message":"The PDF operation was canceled.","code":20}}
{"checks":49,"pass":49,"fail":0}
```

E3 11개 중 timeout 1개는 facade가 아니라 변경하지 않은 공용 `runModuleWorker`의 직접 검사다.

## 검증

모든 Node/build 명령은 `NODE_OPTIONS=--max-old-space-size=4096`로 직렬 실행했다.

| 명령 | 결과 |
|---|---|
| `npx tsc -b` | exit 0, 진단 0 |
| `npm run test:unit` | 294/294, fail·skip 0 |
| `node /tmp/worklazy-u4-2-review/probes/lifecycle.mjs` | 49 PASS/0 FAIL |
| `npm run build` | 2,837 modules, 정적 61페이지, exit 0 |
| `npm run test:static` | startup recovery 104, exit 0 |
| `TEST_SCOPE=pdf npm run test:browser` | 기존 PDF edit/range split/conversion 통과 |
| `npm run test:excel-cleaner` | cancellationAndRerun 통과, input unchanged |
| `npm run test:excel-compare` | cancellation 포함 통과 |
| `npm run fixtures:pdf-legacy-oracle` | client 3·structure 4·render 32·output 4·input 1, 총 diff 0 |
| `npm run bundle:measure` | main 기준 5종 모두 한도 내 |
| `git diff main..HEAD -- src/utils/workerLifecycle.ts src/features/excel-cleaner src/features/excel-compare` | 0바이트 |
| `git diff --check HEAD^ HEAD` | exit 0 |

47c0f22 대비 번들 5종 변화:

| 지표 | 47c0f22 | fix-1 | 변화 |
|---|---:|---:|---:|
| entry JS gzip | 299,305B | 299,287B | −18B |
| PDF route JS gzip | 172,622B | 172,668B | +46B |
| shared JS gzip | 2,716,510B | 2,716,493B | −17B |
| app JS gzip | 5,467,454B | 5,467,461B | +7B |
| CSS gzip | 37,687B | 37,687B | 0B |

main 기준 delta는 0B/+804B/+20B/+874B/0B이며 상한 +20,480B/+61,440B/+30,720B/+81,920B/+10,240B 안이다.

## 검증 중 재실행 기록

- 첫 전용 unit은 다음-task 대조군이 rejection 관찰을 타이머 뒤에 붙여 Node의 unhandled-rejection 감시에 1회 실패했다. 제품 코드는 바꾸지 않고 관찰을 즉시 등록하도록 테스트 순서만 고쳐 22/22를 얻었다. 실패·최종 로그를 모두 보존했다.
- 첫 PDF 브라우저 스모크는 preview 미기동으로 `ERR_CONNECTION_REFUSED`였다. production preview를 127.0.0.1:4273에 띄운 같은 명령은 통과했고 preview는 종료했다. 두 로그를 모두 보존했다.

## 기록 정정·최종 상태

U4-2 검수의 production 변경 158파일 중 156개는 entry의 PDF preload에 기존 `workerLifecycle` 청크가 추가되며 자산 참조명이 전파된 SHA 변경이고, 나머지는 PDF 본체와 entry preload다. 따라서 “PDF 청크 외 모든 SHA 동일”로 확대하지 않는다.

최종 워킹트리에는 착수 전부터 있던 사용자 미추적 파일 `after.docx`, `before.docx`, `naver05161fb06bc9701a23cfc09ad5773578.html`만 남았다. 작업은 fix-1 커밋에서 정지하며 astra 재검수 대상이다.
