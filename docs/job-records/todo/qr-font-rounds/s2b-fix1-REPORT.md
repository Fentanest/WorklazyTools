# S2b astra 검수 소견 F1·F2 반영 보고

작성: **Codx**, 2026-09-07 KST.

## 착수 게이트

```text
$ git branch --show-current
s2b-qr-font

$ git rev-parse HEAD
93a2318d445d78e5283b48be993578f7f061b96c

$ git rev-parse main
f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e

$ git status --short
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```

`PROJECT_RULES.md` 전문을 첫 도구 호출로 읽고 `AGENTS.md`, 정본 `docs/jobs/todo/qr-font-20260906.md` 전문, astra 검수 `/tmp/worklazy-s2b-review/REPORT.md` 전문, 기존 구현 보고 `/tmp/worklazy-s2b/REPORT.md`와 S2b review-notes를 확인했다. 열린 계획서 검색 결과 QR 표면의 정본과 상위 로드맵 외에 상반된 지시는 없었다. 로드맵 말미의 `3672fc7`/`5485fad`는 검수 보고가 이미 지적한 병행 문서의 불일치이며, 최신 사용자 dispatch가 지정한 위 해시를 기준으로 삼았다. 사용자 미추적 3파일은 읽거나 수정·스테이징하지 않았다.

## F1 — 실제 제품 handler 회귀

- `tests/unit/qr-label-font.test.ts:166-257`: 정적 regex 1건을 실제 `QrBulkPanel` handler 실행 6건으로 교체했다.
- `tests/unit/qr-label-font.test.ts:259-460`: 저장소의 `QrBulkPanel.tsx`에서 ZIP/PDF handler, cancel, cleanup, export helper와 run abort/error 본문을 직접 추출하고 TypeScript로 컴파일한다. 별도 상태기계를 다시 구현하지 않는다.
- 실제 실행 단언: 이전 ZIP finally가 새 PDF lease·`exporting=pdf`를 유지, 이전 오류 0, cancel 뒤 stale download/error 0, cleanup 및 run abort/error에서 export/font loader 무효화, `storageRef` 선행 분리와 새 storage 보존, busy 중 PDF 버튼 비활성.
- QR 전용 unit **15/15**, 전체 unit **246/246**.

소유권 가드 제거 음성 대조는 `/tmp/worklazy-s2b-fix1/mutant/`의 사본에만 적용했다. 같은 unit의 핵심 원문:

```text
# Subtest: QR panel product handlers keep an old ZIP finally from releasing a newer PDF lease
not ok 10 - QR panel product handlers keep an old ZIP finally from releasing a newer PDF lease
  error: |-
    Expected values to be strictly equal:

    '' !== 'pdf'

# Subtest: QR export lease regression detects removal of the product ownership guard
not ok 11 - QR export lease regression detects removal of the product ownership guard
1..15
# tests 15
# pass 13
# fail 2
EXPECTED_MUTATION_EXIT=1
```

즉 제품의 `finishExport`에서 `if (!owned) return`을 제거하면 지속 unit이 실제 상태 파손을 검출한다.

## F2 — HTTP font404·S0·export 취소 브라우저 회귀

- `tests/qr-font-scenarios.mjs:15-126`: 기존 metrics용 `subset|full|corrupt` 계약을 유지하면서 브라우저 전용 `font404`를 추가했다. same-origin scenario server는 정확한 subset OTF 경로만 404로 만들고, 지연 release와 정확한 실제 `qrLabelPdf` 빌드 청크 404 대조를 제공한다.
- `tests/qr-bulk-smoke.mjs:130-258`: 기존 3 PDF scenario와 구조/폰트 SHA 단언을 보존하고 font404, S0 retry key, export 결과 교체 취소, 실제 lazy chunk 404를 추가했다. `page.route`나 fetch mock은 쓰지 않았다.

최종 브라우저 원문 중 신규 단언:

```text
font404:
  fontRequests=[subset OTF, full OTF]
  embedded={size:4644748,sha256:69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68}
  reloads=0
  retryKeyCount=0

export cancel:
  staleDownloads=0
  exportingReleased=true
  fontRequests=[subset OTF]

chunk404 control:
  path=/assets/qrLabelPdf-BDBIICEl.js
  reloads=1

external requests 0
```

지연 font404 동안 새 CSV를 선택해 `cleanupResults`를 실행했고, full 폴백·stale PDF가 0인 상태에서 새 결과를 만든 뒤 PDF 버튼이 활성화되는 것까지 확인했다.

## 기록 보강

- `CHANGELOG.md:7`: 기존 S2b 항목 한 구절만 보강했다.
- `docs/review-notes.md:21,37,93-97`: 생성 입력 교체를 파일별 `os.replace`로 한정하고 “모든 font request”를 “QR 라벨 OTF 요청”으로 교정했으며 F1/F2와 실측·mutation 결과를 기록했다.
- 제품 코드·폰트 자산·정본 계획서·번역·SEO/정적 페이지 입력·광고 격리 경로는 변경하지 않았다. QA `dist`도 재빌드하지 않았다.

## 검증

| 명령 | 결과 |
|---|---|
| `npm run test:unit` | **exit 0 · 246/246**, QR font 15/15 |
| mutation 사본에서 `node --test --experimental-strip-types tests/unit/qr-label-font.test.ts` | **기대 exit 1 · 13 pass/2 fail · `'' !== 'pdf'`** |
| `npm run test:qr-bulk` | **exit 0** · 기존 3 scenario + font404, export cancel, chunk404 reload 대조, 외부 요청 0 |
| `npx --no-install tsc -b --pretty false` | **exit 0 · 진단 0** |
| 동일 HEAD의 보존 production 산출물에서 `npm run test:static` | **exit 0** · localized/static/runtime/ads/robots/sitemap, startup 104문서 |
| `TEST_BASE_URL=http://127.0.0.1:4174 npm run test:utilities` | **exit 0** · ko/en utilities |
| `git diff --check` / `git diff --cached --check` | **exit 0 / 0** |

숨기지 않은 초기 실패:

- 첫 수정 QR smoke는 export 취소 뒤 교체 CSV에 기존 `{{Label}}` 템플릿이 요구하는 `Label` 열을 빠뜨려 90초 timeout. fixture에 `Label` 열을 추가한 뒤 전체 재실행 통과.
- 첫 `npm run test:utilities`는 preview가 없는 `127.0.0.1:4173`에서 `ERR_CONNECTION_REFUSED`. 원 QA `dist`를 바꾸지 않고 보존 production 산출물을 4174에서 preview하여 같은 명령 재실행 통과.
- 최종 `dist`는 기존 `VITE_LOCAL_QA=1` 산출 그대로다. 정적 검사는 astra가 같은 HEAD에서 만든 `/tmp/worklazy-s2b-review/production`을 `/tmp/worklazy-s2b-fix1/static-check/dist`로 연결해 실행했다.

## 커밋·정지점

```text
$ git rev-parse HEAD main
249e1727b44fa84ca8635741e1214cc1a9902591
f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e

$ git status --porcelain
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html

$ git log --oneline main..s2b-qr-font
249e172 test: cover QR export and font recovery lifecycles
93a2318 docs: record S2b font reduction evidence
0198036 feat: reduce QR label PDF font transfers
ae1feea build: vendor pinned QR label font subset
c680030 docs: add Codex model role assignment to AGENTS.md
```

브랜치 `s2b-qr-font`에 커밋만 추가하고 정지했다. main 병합·push·배포는 하지 않았다.
