# adsense-followup-20260920 배포 보고

## 상태

**운영 반영 완료**

- 배포 대상: `integration/adsense-followup-20260920`의 `10186dfeaec33466c5e3198ded866e45eb391f56`
- main 반영: `290a11f94025b040d935e8a9f104241a9ca72fe7` → `10186dfeaec33466c5e3198ded866e45eb391f56` fast-forward
- 운영 주소: `https://worklazy.net/`
- 실행일: 2026-09-20 (Asia/Seoul)

## push 전 확인과 main 반영

| 항목 | 결과 |
|---|---|
| 현재 브랜치 | `integration/adsense-followup-20260920` |
| `git rev-parse HEAD` | `10186dfeaec33466c5e3198ded866e45eb391f56` — 일치 |
| `git status --short` | 빈 출력 |
| fetch 후 `origin/main` | `290a11f94025b040d935e8a9f104241a9ca72fe7` |
| `git merge-base --is-ancestor origin/main HEAD` | exit 0 |

push 명령은 force 옵션 없이 `git push origin HEAD:refs/heads/main`으로 실행했고 exit 0이었다.

```text
To github.com:Fentanest/WorklazyTools.git
   290a11f..10186df  HEAD -> main
```

원시 증거: `/tmp/wl-followup/integration/deploy/preflight-before-fetch.log`, `preflight-after-fetch.log`, `fetch-origin.log`, `push-main.log`, `push-main.exit`.

## GitHub Pages

| 항목 | 결과 |
|---|---|
| workflow | `Deploy GitHub Pages` |
| run ID | `35483710375` |
| head SHA | `10186dfeaec33466c5e3198ded866e45eb391f56` |
| 상태·결론 | `completed` / `success` |
| 전체 소요 | 5분 36초 (`2026-09-20T02:20:00Z`–`02:25:36Z`) |
| 감시 | `gh run watch 35483710375 --exit-status`, exit 0, 318초 |
| build job | success, 5분 2초 |
| deploy job | success, 20초 |

run: <https://github.com/Fentanest/WorklazyTools/actions/runs/35483710375>

원시 증거: `/tmp/wl-followup/integration/deploy/gh-run-selected.json`, `gh-run-watch.log`, `gh-run-watch.exit`, `gh-run-final-list.json`, `gh-run-final-view.json`.

비차단 주의: workflow annotation에 Node.js 20 대상 액션이 Node.js 24에서 강제 실행된다는 향후 폐기 경고가 1건 있었다. 이번 build·deploy 결론에는 영향을 주지 않았다.

## 운영 확인

운영 캐시 확인은 첫 시도에서 모두 통과해 2분 간격 재시도는 사용하지 않았다(1/5회). 정적 요청과 브라우저 요청은 `worklazy.net`만 대상으로 했다.

| 확인 항목 | 방법·환경 | 결과 |
|---|---|---|
| index CSS 전역 규칙 | 운영 index가 참조한 `https://worklazy.net/assets/index-lfJicohn.css`를 curl로 읽고 공백 무시 정규식으로 검사 | 통과 — `.bottom-tabs { display: none }` 존재 |
| PDF 비교 정적 HTML | `https://worklazy.net/ko/tools/pdf-compare/` curl 응답 | 통과 — `seo-static-fallback`과 한국어 가이드 본문 존재 |
| 데스크톱 하단 탭 | Playwright 1.63.0 + `/usr/bin/google-chrome` 153.0.8010.36, headless 1365×900 | 통과 — `.bottom-tabs` computed `display: none` |
| 모바일 하단 탭 | 같은 브라우저 세션에서 412×839 | 통과 — computed `display: grid`, 링크 3개 |
| PDF 비교 가이드·FAQ | 같은 브라우저 세션, `section[data-ui-component="tool-guide"]` | 통과 — 섹션 1개, 내부 `details` 3개 |
| 네트워크·광고 제약 | service worker 차단, 브라우저 요청 route 제한, 동의 미설정, 클릭 없음 | 통과 — 허용 요청 37건 모두 `worklazy.net`, 외부 요청 0건, 4xx/5xx 0건, 광고 클릭 0회 |
| 화면 직접 확인 | 생성 캡처 3장 열람 | 통과 — 데스크톱 탭 숨김, 모바일 3탭 표시, PDF 가이드·FAQ 표시 |

브라우저 캐시는 `XDG_CACHE_HOME=/tmp/wl-followup/integration/deploy/playwright`를 사용했다. 동의 버튼은 누르지 않았고 광고 미로드 상태를 유지했다.

증거:

- `/tmp/wl-followup/integration/deploy/operating-attempt-1/html-check.json`
- `/tmp/wl-followup/integration/deploy/operating-attempt-1/css-check.json`
- `/tmp/wl-followup/integration/deploy/operating-browser-results.json`
- `/tmp/wl-followup/integration/deploy/operating-browser-check.log`
- `/tmp/wl-followup/integration/deploy/text-merger-desktop-operating.png`
- `/tmp/wl-followup/integration/deploy/text-merger-mobile-operating.png`
- `/tmp/wl-followup/integration/deploy/pdf-compare-guide-operating.png`

## 미확인·제외

- 요청된 배포·운영 확인 항목의 미확인은 없다.
- workflow 재실행, force push, 다른 브랜치 push, 코드·설정 수정, 광고 클릭은 수행하지 않았다.
- 로컬 git-ignored `PLAN.md` 사본은 v0.2.2까지만 포함한다. 이번 배포 권한과 Claude v0.2.8 최종 판정 완료는 최신 사용자 지시를 정본으로 적용했다.

— Codx
