# 작업지시서 — 네이버 서치어드바이저 권고 반영 (루트 랜딩 메타) (2026-09-04)

**상태: 정본 (2026-09-04 정본화 — 1차 왕복에서 Codex "요구 반영 조건부 이견 0"·[정본화 가능], 요구 6건 전원 반영. "확정 사항"이 우선 계약.)**
기준 해시: **`8d91b62`**(main — 네이버 소유확인 파일 커밋). 근거: 사용자 제공 네이버 서치어드바이저 진단(2026-09-04).

## 배경 — 진단 결과

**정상**: 301 이전 인식 · robots.txt 수집 가능 · 로봇 메타 · 사이트 제목.
**수정 대상 3건**: ① 사이트 설명 80자 초과 ② Open Graph 제목 없음 ③ Open Graph 설명 없음. **대상은 루트 랜딩(`/`) 한 페이지** — 언어 페이지(`/ko/`·`/en/`)는 정상.

## 확정 사항 (1차 왕복 6건 — 실측 반영)

1. **description 확정 문구(2026-09-04 사용자 결정으로 2차 변경 — 아래 "후속 개선" 절이 최신)**: ~~`Choose English or Korean. 무료 업무 도구의 언어를 선택하세요.`~~ — 실측 46자(code point)·UTF-8 76바이트. 현행은 85자·123바이트(초안의 "100자 이상"은 부정확 — 정정). **검증 기준은 `Array.from(description).length ≤ 80`**(네이버 표현이 "80자"이므로 바이트 아님 — 다만 네이버 내부 계산법은 독립 확인 안 됨, 위 문구는 두 기준 모두 만족).
2. **생성 함수·태그 구성 정정**: 언어 페이지 생성 함수는 `renderPage()`(`scripts/generate-static-pages.mjs:121-150`)이며 이미지 절대 URL은 `new URL(page.socialImage.path, siteUrl).href`(`:124`). **루트에 이식할 순서를 그대로 따른다**: `canonical → hreflang(ko/en/x-default) → og:locale → og:locale:alternate → og:type → og:site_name → og:title → og:description → og:url → og:image → og:image:secure_url → og:image:type → og:image:width → og:image:height → og:image:alt → Twitter 5종`. **초안 누락분 `og:image:secure_url`·`og:image:type`·`og:image:alt` 포함**(OG 12종). **`worklazy-route-jsonld` 복제는 명시 제외**(권고 범위 밖).
3. **Twitter 카드 5종 추가 확정**(실측 후 결정 아님): `twitter:card`·`twitter:title`·`twitter:description`·`twitter:image`·`twitter:image:alt` — 언어 페이지가 모두 생성하고 정적 검증기도 요구(`validate-static-output.mjs:43-44`).
4. **중복 위험 없음(실측)**: 템플릿 `index.html:6-20`에는 title·description만 있고 canonical/OG/Twitter 없음. 현행 `renderLanding()`은 canonical·hreflang만 추가(변환 후 실측: `landing={title:1,description:1,canonical:1,og:0,twitter:0}`). **`RouteSeo`는 `AppShell` 안에서만 렌더되고 루트 언어 선택 라우트는 AppShell 밖**(`App.tsx:45-48`)이라 런타임 OG 주입 없음. **`src/app/seo.ts` 수정·루트 `RouteSeo` 마운트는 명시 제외**(seo.ts의 `/` 정의는 `/ko/`·`/en/` 홈용 — 루트 재사용 금지).
5. **루트 소셜 이미지 = 기본 영문 이미지**: 루트는 `lang="en"`·x-default가 `/en/`이므로 `getSocialImageDefinition("en","/")`가 반환하는 기본 `social/worklazy-tools-share.png`(1200×630·199,195B 실재)를 쓰고, URL은 언어 페이지와 동일하게 `new URL(path, siteUrl).href` = `https://worklazy.net/social/worklazy-tools-share.png`. **이미지 생성 명령·자산 수정 불필요**(기본 2종은 `generate-social-images.mjs` 산출 대상 아님 — 그 스크립트는 `social/tools/*`만 생성).
6. **정적 검증기 보강 위치·단언**: 기존 SEO 반복 검사는 `dist/${language}/...`만 읽으므로 루트 미포함(`validate-static-output.mjs:8-32`) → **반복문 직후(`:89` 앞)에 루트 전용 블록 신설**. 단언: description **정확히 1개**·확정 문구 일치·code point ≤80 / **OG 12종·Twitter 5종 각각 정확히 1개**(존재만 검사 시 중복 회귀를 놓침) / `og:url` = `https://worklazy.net/` / `og:image`·`twitter:image` = 기본 이미지 절대 URL / `og:locale=en_US`·alternate `ko_KR`.

## 검증

`npm run build` → `dist/index.html` 실측(태그 개수·문구·길이) · `npm run test:static`(보강 블록 포함) · `npm run test:unit` · `git diff --check`. **메타 전용 변경이므로 브라우저 시각 검수 불요**. 배포 후 실 URL(`https://worklazy.net/`) curl로 메타 재확인.

## 명시 제외

언어 페이지·도구 페이지 메타 · 사이트 제목 · robots/sitemap · 신규 소셜 이미지 제작 · `worklazy-route-jsonld` 복제 · `src/app/seo.ts` 수정 · 루트 `RouteSeo` 마운트.

## 배포

`ui-migration`과 무관 — **별도 worktree에서 main 직접 반영**(네이버 소유확인 파일과 동일 방식). 기록 이원 체계(CHANGELOG 한 줄 + review-notes에 진단·실측 근거).

## 후속 개선 — 루트 문구 가치 전달 (2026-09-04 사용자 결정)

**배경**: 1차 반영 후 사용자 지적 — 루트 설명이 "언어 선택 안내"에 그쳐 **사이트가 무엇을 해주는지 전달하지 못함**. 언어 페이지(`/ko/`·`/en/`)는 키워드가 풍부한데 루트만 빈약(실측 확인).
**제약(실측·답변)**: 정적 호스팅이라 방문자 언어별로 다른 메타를 줄 수 없음(콘텐츠 협상 불가·서버 런타임 금지) → **한 문장 한/영 병기**로 결정.

**확정(사용자 선택 — 한/영 병기·제목 변경·이미지 유지)**:
- **title**: `무료 브라우저 업무 도구 · Free Work Tools | Worklazy Tools`(48자)
- **description / og:description / twitter:description**: `설치 없이 엑셀·PDF·문서·이미지 작업하는 무료 도구. Free browser tools for everyday work.`(**69자** — 80자 이내 충족, UTF-8 110바이트)
- **og:title / twitter:title**: 위 title과 동일
- **이미지**: 기본 `worklazy-tools-share.png` **유지**(현행 자산은 영문 전용이고 한/영 병기 이미지가 없음 — 신규 제작은 이번 범위 밖. 사용자 지시 "병기되면 병기, 아니면 냅둬" 반영)
- **정적 검증기 동반 갱신 필수**: 확정 6항이 "description 확정 문구 일치"를 단언하므로 **새 문구로 갱신**하지 않으면 `test:static` 실패. title 단언이 있으면 함께 갱신.

## 반박 기록

### Codex 1차 (2026-09-04, 완료 — 요구 6건 제시·전원 반영 조건으로 **"이견 0"·[정본화 가능]**. 실측 기여: 현행 85자/123바이트·권장 문구 46자/76바이트, `renderPage()` 실명과 태그 17종 순서, Twitter 5종 확정, 템플릿·RouteSeo 중복 없음 증명, 기본 이미지 선택 근거, 검증기 삽입 위치·개수 단언 필요성)
