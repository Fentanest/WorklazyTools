# 지시서 — S2b 브랜치 `--no-ff` 병합 · push(=배포) · 배포 후 확인 (Claude → Codex **gpt-5.6-sol** — 「모델 역할 분담」: 병합·push 는 코딩 단계)

## 0. 선독
`PROJECT_RULES.md` 전문(특히 「커밋·업로드·배포는 Codex」·「검증은 실행이다」·「배포 전 로컬 시각 검수」) → `AGENTS.md` → `docs/jobs/todo/roadmap-completion-20260906.md` §2 C-A·C-D ⑨ → `docs/PUBLISHING_CHECKLIST.md` 해당 항목.

## 1. 전제(Claude 실측 · 사용자 승인)
- 배포 승인은 **포괄**(2026-09-06 사용자 결정 §결정 7). S2b 는 astra 3차 검수 [검수 통과] + Claude 게이트 ①~⑧(Gemini 로컬 검수 포함) 통과로 배포 조건을 충족했다.
- **주의**: 로컬 `main`(`f29d249`) 은 `origin/main`(`1a04f25`) 보다 `CLAUDE.md` 문서 커밋 1개 앞서 있다(다른 세션 커밋). 이번 push 로 함께 올라간다 — 정상. `git pull --ff-only` 는 "Already up to date" 또는 fast-forward 여야 하며 충돌 시 중단·보고.
- 기준: `main` = `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`, `s2b-qr-font` = `2f59a44`(astra 4차 검수 [검수 통과] HEAD, 커밋 7개)(전체 해시는 착수 시 `git rev-parse s2b-qr-font` 로 기록). 착수 시 둘을 `git rev-parse` 로 대조하고 다르면 중단·보고.
- 이전 전달 과정의 "커밋·push 금지" 제약은 무효 — 이 지시서의 완료 기준은 병합·push·배포 확인이다.

## 2. 절차
1. `git checkout main && git pull --ff-only origin main` → HEAD 가 `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e` 인지 확인.
2. `git merge --no-ff s2b-qr-font -m "Merge S2b QR label PDF font reduction for live deployment"` (squash·rebase 금지).
3. **push 전 `main` 빌드**: 병합 커밋에서 `npm run build`(production, `VITE_SITE_URL=https://worklazy.net/ VITE_BASE_PATH=/` — prebuild 가 `vendor:qr-font` 를 실행해 서브셋 자산을 전개하는지 로그로 확인) · `npx tsc -b` · `npm run test:unit` · `npm run test:static` · `npm run test:qr-bulk` · `npm run test:utilities` · `node tests/tool-registry-routes.mjs` · `npm run css:orphans` · `git diff --check` · `VITE_LOCAL_QA=1 npm run build` 후 `A11Y_MAX_TOTAL=0 npm run test:a11y` · `npm run test:rendering` · 그 뒤 production 으로 다시 `npm run build`. `dist/vendor/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/NotoSansKR-Regular.ksx1001.otf` 가 931,704B·SHA `b84d27a5…` 인지 확인. 하나라도 실패하면 push 하지 말고 보고. 4188 preview 는 종료해도 된다.
4. `git push origin main`. `gh run list --limit 1` 로 run ID 확보 → `gh run watch <id> --exit-status`.
5. 배포 후 확인(C-D ⑨ · P2 배포 계약 계승): Actions 성공 후 라이브 `curl -s https://worklazy.net/ko/ | grep -o 'index-[A-Za-z0-9_-]*\.js'` 가 병합 커밋의 production 빌드 entry 해시와 일치(GitHub Pages CDN 전파는 수 분 걸릴 수 있다 — 최대 10분, 60초 간격 재시도) · `startup-help` 섹션 유지 · **라이브 서브셋 자산** `curl -sI https://worklazy.net/vendor/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/NotoSansKR-Regular.ksx1001.otf` 200·`content-length: 931704`(gzip 전송 시 실제 바이트 561,161 근처) · 전체 OTF 경로 불변 200 · **라이브 QR 일괄 라벨 PDF 흐름**(Playwright: `/ko/tools/qr-studio/bulk/` CSV 25행 업로드 → 제목 템플릿 `{{Label}}` → 생성 → 라벨 PDF 다운로드) 에서 폰트 요청이 **서브셋 1회**(응답 200·931,704B), `똠` 포함 CSV 에서는 **전체 OTF 1회** — 각 PDF `%PDF`·2p 확인 · 라이브 홈 CLS 1회 ≤0.1 · 5페이지(홈 ko/en · 도구 목록 ko · HWP 편집 ko · 오디오 스튜디오 ko/en) HTTP 200 · 라이브 URL 로 접근성 감사 위반 0(`A11Y_BASE_URL` 류 옵션이 있으면 사용, 없으면 Playwright+axe 로 같은 5페이지 직접 측정) · `/ko/404-없는경로/` 가 404 페이지 · 격리 문서(`/ko/tools/office-editor/app/` 류)에서 `googlesyndication|adsbygoogle` 요청 0 · 홈 ko 의 CLS 라이브 측정 1회(≤0.114199) · 20 도구 ko/en 직접 진입 빈 화면 0(`mainTextLength>0`) 표.
6. 배포 후 확인 결과를 `docs/review-notes.md` S2b 절 아래 **사후 기록 커밋**(C-A 예외)으로 남기고 push. 같은 커밋에 아래 Claude 문단을 S2b 절 끝(사후 기록 앞)에 **그대로** 추가한다(내용 수정 금지):

> **S2b 게이트 ①~⑧ 판정 (Claude, 2026-09-07 03:15) — 통과.** astra 검수 4회(1차 F1·F2 회귀 테스트 누락 → 2차 F1-R → 3차 F2-R 스모크 flake → 4차 [검수 통과]) 를 거쳐 브랜치 `2f59a44`(커밋 7개, 제품 코드는 `0198036` 이후 불변) 를 승인한다. ① 시각 회귀 350/350·기준선 갱신 0 ② 접근성 8페이지 위반 0 ③ 번들 5종 상한 내(coverage JSON 은 QR route 에 포함해 측정) ④ CLS 0 ⑤ 광고 격리 영향 0·새 외부 요청 0 ⑥ 사용자 문구 변화 0·정적/사이트맵 불변 ⑦ build·tsc·unit 247·QR 스모크 3 scenario+OTF 404 폴백+청크 404 대조+취소·utilities·office·browser·new-tools·recovery·static ⑧ Gemini 로컬 검수 9화면 정상(소견 2건은 검수 입력 결함으로 판정 — 위 문단) + Claude DOM/PDF 재현(서브셋 931,704B / `똠` 폴백 전체 OTF 4,644,748B) + astra DOM·mutation 교차. 배포 승인은 2026-09-06 사용자 포괄 결정(로드맵 §결정 7). — Claude

## 3. 보고
병합 커밋 해시 · push 출력 · Actions run ID/상태/소요 · 5항 각 확인 원문 · 사후 기록 커밋 해시 · 종료 시 `git status --porcelain`(untracked 사용자 파일 3개만).
