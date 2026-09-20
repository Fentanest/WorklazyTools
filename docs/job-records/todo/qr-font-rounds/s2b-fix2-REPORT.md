# S2b F1-R 반영 구현 보고

작성: **Codx**, 2026-09-07 KST. 브랜치 `s2b-qr-font`, 기준 HEAD `249e1727b44fa84ca8635741e1214cc1a9902591`, 결과 HEAD `71a6200aaefed34a8fbf4524faf4e4068370decc`, main `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`.

## 변경

- `tests/unit/qr-label-font.test.ts:202`: 실제 `QrBulkPanel` PDF handler 추출 harness에서 PDF helper가 완성 Blob을 반환하면서 `setTimeout(() => panel.cancel(), 0)`을 큐에 넣는다. 제품의 다운로드 직전 task 양보가 이 취소를 처리한 뒤 토큰을 재검사하는지 다운로드 0, 메시지 0, `active`/`exporting` 해제, font loader dispose 1로 단언한다.
- `docs/review-notes.md:99`: F1-R unit 수와 mutation 결과를 Codx 서명 한 줄로 기록했다.
- `docs/review-notes.md:101`: 디스패치가 지정한 Claude의 Gemini 로컬 검수 소견 판정 문단을 내용 변경 없이 S2b 절 끝에 추가했다. 디스패치 원문과 비교 결과 exit 0이다.
- 제품 코드 변경은 0이다. `git diff --name-only 249e172..HEAD -- src` 출력도 비어 있다.

## 양보 제거 음성 대조

`python3 /tmp/worklazy-s2b-review2/final-task-mutation.py`가 `QrBulkPanel.tsx`의 마지막 `await new Promise<void>((resolve) => setTimeout(resolve, 0));` 한 줄만 제거한 사본으로 새 unit을 실행했다. 기존 스크립트의 옛 기대값(15/15 통과) assertion 때문에 명령 자체는 기대대로 exit 1이 됐고, 생성된 unit 원문은 **15 pass / 1 fail**이다.

```text
# Subtest: QR panel final task yield lets queued cancellation block a completed PDF Blob
not ok 13 - QR panel final task yield lets queued cancellation block a completed PDF Blob
Expected values to be strictly equal:

1 !== 0

# pass 15
# fail 1
```

원문: `logs/mutation-final-task-unit.log`. 현재 제품 focused QR unit은 16/16 통과했다(`logs/qr-unit-focused.log`).

## 검증

| 명령 | 결과 |
|---|---|
| `npm run test:unit` | exit 0, **247/247** |
| `npm run test:qr-bulk` | exit 0, subset/full/corrupt/font404, export stale download 0, chunk404 reload 1, 외부 요청 0 |
| `npx tsc -b` | exit 0, 진단 0 |
| `npm run test:static` | exit 0, 동일 제품 HEAD의 보존 production 산출물에서 startup 104문서 통과 |
| `git diff --check` | exit 0 |

첫 static 실행은 현 QA `dist`가 의도적으로 analytics를 제외해 exit 1(`Google or Naver Analytics configuration is missing`)이었다. 제품·생성물을 수정하거나 재빌드하지 않고 `/tmp/worklazy-s2b-review/production`을 `dist`로 둔 별도 `/tmp` 실행 디렉터리에서 같은 `npm run test:static`을 재실행해 통과했다. 최초 실패는 `logs/static.log`, 최종 통과는 `logs/static-production.log`에 보존했다.

## 종료 상태

커밋은 `71a6200 test: cover final QR download cancellation task` 한 개다. main 병합·push는 하지 않았다. `git status --porcelain`에는 작업 전부터 있던 사용자 untracked 파일 세 개만 남는다.

```text
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```

`git log --oneline main..s2b-qr-font`와 최종 상태 원문은 `logs/final-state.log`에 보존했다.
