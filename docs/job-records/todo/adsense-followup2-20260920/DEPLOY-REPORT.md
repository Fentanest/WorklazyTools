# adsense-followup2-20260920 배포 보고

- 작업 ID: `adsense-followup2-20260920 / 배포`
- 통합·배포 담당/기록 서명: Codx (Sol)
- 작업 공간/브랜치: `/home/better0101/projects/wt-followup2-integration` / `integration/adsense-followup2-20260920`
- 배포 대상: `0523801eaed1790c77b344d988297bfd3473012e`
- 상태: **운영 반영 완료**
- 확인 시각: 2026-09-20 03:12 UTC (2026-09-20 12:12 KST)

## 사전 조건

| 항목 | 결과 |
|---|---|
| `git rev-parse HEAD` | `0523801eaed1790c77b344d988297bfd3473012e` — 지정 SHA 일치 |
| `git status --short` | 빈 출력 — clean |
| `git fetch origin` | 성공 |
| `origin/main` | `10186dfeaec33466c5e3198ded866e45eb391f56` |
| `git merge-base --is-ancestor origin/main HEAD` | exit 0 — fast-forward 가능, 후보가 8커밋 앞 |
| 배포 승인 근거 | Astra 최종 검수 적합(`/tmp/wl-followup2/review-final-astra.md`)과 Claude 최종 판정 확인 |

## main 반영

실행 명령: `git push origin HEAD:refs/heads/main`

```text
To github.com:Fentanest/WorklazyTools.git
   10186df..0523801  HEAD -> main
```

푸시 뒤 `git ls-remote origin refs/heads/main`은 `0523801eaed1790c77b344d988297bfd3473012e`를 반환했다. force 계열 옵션과 다른 브랜치 push는 사용하지 않았다.

## GitHub Pages

| 항목 | 결과 |
|---|---|
| workflow | `Deploy GitHub Pages` |
| run | `35485514033` — <https://github.com/Fentanest/WorklazyTools/actions/runs/35485514033> |
| head SHA | `0523801eaed1790c77b344d988297bfd3473012e` |
| 결론 | `success` |
| 전체 소요 | 2026-09-20 03:01:52–03:07:16 UTC, **5분 24초** (`gh run watch` 관찰 5분 15초) |
| build job | 성공, 4분 57초 |
| deploy job | 성공, 19초 |

워크플로 재실행은 하지 않았다. build job에는 Node.js 20 대상 Actions가 러너에서 Node.js 24로 강제 실행된다는 비차단 deprecation annotation 1건이 있었고, 모든 단계와 배포 결론은 성공이었다.

## 운영 확인

환경: Playwright `1.63.0`, `/usr/bin/google-chrome` (`153.0.8010.36`), headless `1365×900`, `XDG_CACHE_HOME=/tmp/wl-followup2/integration/deploy/playwright`. 새 브라우저 컨텍스트에서 `worklazy_privacy_consent`를 설정하지 않았고 네 화면 모두 저장값 `null`과 동의 배너 표시를 확인했다. 클릭 동작은 수행하지 않았다. HTTP(S)는 `worklazy.net`만 계속하고 다른 호스트는 전부 차단했으며, 외부 허용 요청은 0건이었다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 운영 번들 | **통과** | 운영 HTML 200, `last-modified: Sun, 20 Sep 2026 03:07:10 GMT`. 메인 `index-BBPR9s5L.js`가 `OfficeEditorAppPage-Df8JY-5b.js`를 가리키고, 앱 청크의 `G as oe`/`slug:"officeEditor"` 호출이 메인 번들의 `ov as G` 및 `data-ui-component:"tool-guide"` 구현으로 연결됨 |
| KO Office Editor app | **통과** | 200, 최대 60초 조건 안에 ready. `crossOriginIsolated=true`, SW controller 있음, 가이드 section 1, FAQ details 5, 앱 전용 문구 존재, page error 0 |
| EN Office Editor app | **통과** | 200, 최대 60초 조건 안에 ready. `crossOriginIsolated=true`, SW controller 있음, 가이드 section 1, FAQ details 5, 앱 전용 문구 존재, page error 0 |
| KO Excel Cleaner | **통과** | 200, `[data-testid="excel-cleaner-page"]`와 root 내용 존재, page/console error 0 |
| KO Text Merger desktop | **통과** | 200, 페이지 존재, `.bottom-tabs` 존재 및 computed `display: none` |

KO→EN 탐색 전환 중 이미 사용된 Office app 청크의 프리페치 1건이 `net::ERR_ABORTED`로 취소된 기록은 있으나, 최종 검사기는 이를 탐색 취소로 분리했고 유의미한 동일 출처 네트워크 실패는 0건이다. Office 격리 런타임은 준비 과정에서 Qt/WASM 진단 메시지를 console error 레벨로 출력했지만 두 언어 모두 ready·COI·DOM 조건을 충족했고 page error는 0건이었다.

## 증거와 미확인

- 운영 결과 JSON: `/tmp/wl-followup2/integration/deploy/operational-check.json` (SHA-256 `69e13d71ce55ea9cef8f69dee9837b501ebfabd1898d14f78ab973413747dc03`)
- 캡처: `/tmp/wl-followup2/integration/deploy/ko-office-production.png`, `en-office-production.png`, `ko-excel-cleaner-production.png`, `ko-text-merger-production.png`
- curl 응답·번들: `/tmp/wl-followup2/integration/deploy/office-ko.headers`, `office-ko.html`, `index-BBPR9s5L.js`, `OfficeEditorAppPage-Df8JY-5b.js`
- 합성 Excel 파일 업로드는 지시에서 허용한 대로 생략했다. 이번 배포 확인에서 요구된 필수 항목 중 미확인은 없다.
- 제품 코드·설정·기존 문서는 수정하지 않았고, 커밋 생성·force push·워크플로 재실행은 하지 않았다. 이 보고서만 요청에 따라 작성했다.

최종 상태: **운영 반영 완료**.
