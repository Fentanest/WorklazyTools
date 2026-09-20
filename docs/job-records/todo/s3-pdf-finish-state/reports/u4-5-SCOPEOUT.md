# U4-5 PDF 도장·서명 탐색 빌드 중단 보고

날짜: 2026-09-08  
브랜치/기준: `s3-pdf-finish` / `89873f7b1e0c4a32e41b0acb8120e5e289c60fcb`  
판정: **SCOPE-OUT — 구현 착수 전 중단**

## 결론

고정 번들 상한, `override {}`, multiplier `1`을 유지하면서 완성된 F3 도장·서명 기능을 수용할 설계가 확인되지 않았다. 별도 동적 청크와 기존 패널 정적 통합 두 설계를 깨끗한 HEAD 스냅샷에서 실제 빌드했다.

- 동적 분리 하한은 PDF route 누적 `62,997B`로 `61,440B` 상한을 `1,557B` 초과해 공식 schema-v3 게이트가 거부했다.
- 정적 통합 하한은 `61,414B`로 형식상 통과하지만 잔여가 **26B**뿐이다. 이 프로토타입은 핵심 패널 329줄에 불과하며 완성 구현에 필요한 좌표 픽셀 골든, 견고한 오류·취소·재개방 검증, 전체 ko/en 제품 문구와 비공인 전자서명 고지, 접근성/시각 시나리오, `/stamp` SEO·정적·FAQ·소셜 표면이 빠져 있다.

따라서 “맞지 않으면 scope-out하고 억지 구현하지 말라”는 디스패치 정지 조건을 적용했다. 저장소 소스·테스트·문서·CHANGELOG를 수정하지 않았고 커밋도 만들지 않았다. 다른 route 감량으로 PDF 초과분을 상쇄하지 않았으며 상한·배율·override도 변경하지 않았다.

## 실행 게이트

- `PROJECT_RULES.md`, `AGENTS.md`, 정본 계획 `docs/jobs/todo/pdf-finish-20260905.md`, U4-5 디스패치를 구현 판단 전에 전문 확인했다.
- 기준 브랜치와 HEAD가 지시값과 일치했다.
- 열린 구현 계획 충돌은 없었다.
- 금지된 다른 worktree에는 접근하지 않았다.
- 보호 대상 미추적 파일 4항목에는 접근하거나 stage하지 않았다. 필수 정본 로드 대상인 dirty `PROJECT_RULES.md`는 읽기만 했고, `CLAUDE.md`와 함께 수정·stage하지 않았다. 시작과 종료 `git status`가 동일하다.

## 번들 탐색 결과

사용한 유효 baseline은 `/tmp/worklazy-u4-4-review5/evidence/bundle-baseline.json`이다. SHA-256은 `4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`, schema `3`, attribution schema는 `independent-rendered-gzip-largest-remainder-v1-main-opaque-workers`다. 디스패치 주변의 `/tmp/s3-bundle-baseline.json`은 실제 schema `2`였으며 계측기가 `unsupported bundle measurement schema`로 fail-closed 거부했다.

| 설계/상태 | entry | PDF route | shared net | app net | CSS | PDF 잔여 |
|---|---:|---:|---:|---:|---:|---:|
| 현재 HEAD | 7,281 | 58,432 | 2,125 | 68,572 | 309 | 3,008 |
| 동적 청크 프로토타입 | 7,360 | **62,997 실패** | 2,317 | 73,414 | 361 | -1,557 |
| 정적 통합 프로토타입 | 7,349 | 61,414 | 2,334 | 71,846 | 361 | **26** |
| 고정 상한 | 20,480 | 61,440 | 30,720 | 81,920 | 10,240 | — |

수치는 baseline 대비 gzip 바이트 누적 delta다. 현재 실측 잔여는 디스패치 스냅샷의 PDF `3,017B`/app `13,391B`보다 각각 9B/43B 더 엄격한 PDF `3,008B`/app `13,348B`였으므로 이번 실측값을 사용했다.

동적 프로토타입은 현재 HEAD보다 PDF route `+4,565B`, app `+4,842B`였다. 정적 프로토타입은 PDF route `+2,982B`, app `+3,274B`였다. 번들 계측기는 route의 정적 import와 재귀적 dynamic import를 모두 route 소유로 계산하므로 중첩 lazy만으로 PDF route 예산을 피할 수 없다.

전체 route 계측은 현재 HEAD에서 affected-route aggregate `-450,630B`, entry `+7,281B`, shared net `+2,125B`, app net `+68,572B`, CSS `+309B`로 통과했다. 이 음수 aggregate를 scoped PDF route 초과 상쇄에 사용하지 않았다.

### 재현 증거

- 현재 scoped: `/tmp/worklazy-u4-5/bundle-current-scoped.json` (`211668d993e8b05d0410eb9e07ceb0cd5ec20129c0d58d293906ff0f763225e9`)
- 현재 full: `/tmp/worklazy-u4-5/bundle-current-full.json` (`41b986fe202e7e8a88af8699d47e2a2e9211f580af83eaa64f67058b9d501c14`)
- 동적 하한: `/tmp/worklazy-u4-5/bundle-prototype-scoped.json` (`eba9acccb6de8d81e52e293c29f194b3b66bde731340f3ce3a53f99a24770db1`)
- 정적 하한: `/tmp/worklazy-u4-5/bundle-prototype-static-scoped.json` (`a1dea96528e63af90f2f952dcae34cdda8c620af2c89929ce3df7b0e6ced5d70`)
- write:false 탐색기: `/tmp/worklazy-u4-5-explore-build.mjs` (`2bc8d67c52c1354232f292d3e87303efdefc33981617d22a466ac56c2e2b057d`)
- 요약 JSON: `/tmp/worklazy-u4-5/evidence-summary.json`

프로토타입은 `git archive`로 만든 `/tmp/worklazy-u4-5-explore.SNittc` 깨끗한 HEAD 사본에서만 작성·빌드했다. 사용자 dirty/untracked 파일은 사본에 포함되지 않았다.

## 축소 불가 회귀 및 게이트 건전성

| 명령 | 결과 |
|---|---|
| `npm run test:unit` | PASS — 322/322, 실패 0 |
| `node --test --experimental-strip-types tests/unit/pdfjs-dependency-patch.test.ts` | PASS — pinned PDF.js 6.2.108 전체/축소 browser build 해시 검증 1/1 |
| 격리 사본에서 PDF.js package version을 `6.2.109`로 둔 patch negative | EXPECTED FAIL, exit 1 — `expected pdfjs-dist@6.2.108, received 6.2.109` |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build` | PASS — prebuild 의존 패치 검증, 2,847 modules, 정적 페이지 69개 |
| `npx tsc -b` | PASS |
| `npm run test:static` | PASS — localized/SEO/runtime/광고·sitemap, startup recovery 116 documents |
| `PDF_FINISH_TEST_PORT=4280 ... npm run test:pdf-finish` | PASS — `--strictPort`; 16 direct entries, one-reload recovery, 단일 PDF 표시 runtime+JS/MJS 전수, 48 preview placements, 4회전 CropBox 픽셀, cancel/retry |
| `npm run fixtures:pdf-legacy-oracle` | PASS — client 3 + structure 4 + render 32 + output 4 + input 1, total diff 0 |
| 4281 `vite preview --strictPort` + `TEST_SCOPE=pdf ... npm run test:browser` | PASS — PDF edit/range split/conversion |
| 현재 scoped/full schema-v3 bundle compare | PASS — 5종 고정 상한, `override {}`, multiplier 1 |
| 동적 프로토타입 schema-v3 compare | EXPECTED FAIL — PDF route 62,997 > 61,440 |
| 구형 schema-2 baseline compare | EXPECTED FAIL — unsupported schema fail-closed |
| `git diff --check` | PASS |

`test:pdf-finish`와 워터마크 골든 실행 중 `standardFontDataUrl` 안내 경고가 있었지만 종료 코드는 0이었다. 워터마크 골든은 `/Contents` fixture 4개, image 128개, lowercase/multiline/Noto descender 32개를 PDF.js와 Poppler에서 통과했다.

축소 불가 4항 판정:

1. 되돌림 사냥: 응답성/직접 진입, one-reload, 단일 표시 URL/runtime, 의존 패치의 positive 해시 검증과 격리 version-mismatch fail-closed를 위 실행으로 통과했다.
2. 하위 호환 oracle: 총 44개 비교 대상 diff 0이다.
3. 게이트 건전성: unit에서 a11y incomplete 소유권/미해결 상태와 bundle 범위·구형 schema 거부를 통과했고, scoped와 full을 따로 측정했다.
4. 사용자 신고 경로: 신규 기능 단계이므로 해당 없음.

## 중단 때문에 실행하지 않은 F3 전용 항목

- 도장 좌표 골든 ⑤(DPR 1/2 × CSS scale 1/0.5 × 회전 4종, 혼합 페이지/CropBox)와 저장 후 재개방 검증
- 직접 이동·크기 조절, 선택 페이지, 같은 위치 복제, 비율 고정, undo/redo의 완성 기능 테스트
- stamp 시각 scenario, 영어 모바일 320/390px, ko/en × light/dark × desktop/mobile
- `VITE_LOCAL_QA=1` stamp/finish a11y 및 `/stamp` rendering/CLS 등록 검증
- `/stamp` ko/en·SEO·사이트맵·정적·FAQ·소셜·canonical 검증

기능을 넣지 않았으므로 위 항목은 “미구현 기능을 통과한 것처럼” 실행하거나 기록하지 않았다.

## 병합 직전 1회 이월 목록

정본 checklist에 따라 다음은 이번 scope-out 라운드에서 실행하지 않았다: `test:browser` 전체, `test:new-tools`, `test:utilities`, `test:office`, `test:qr-bulk`, `test:qr-font-render`, `test:recovery`, `test:excel-*`, a11y 전체, 시각 전량, `test:rendering`, `css:orphans`, `legacy:manifest`, `tool-registry-routes`, 성능 12입력. PDF 한정 browser와 기존 PDF finish/a11y·bundle 단위 게이트는 위와 같이 별도 실행했다.

## 최종 저장소 상태

작업 시작과 종료 상태가 동일하다.

```text
## s3-pdf-finish
 M CLAUDE.md
 M PROJECT_RULES.md
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
?? newui/
```

- staged 파일: 없음
- 이 작업이 만든 repository 변경: 없음
- 커밋/push/deploy: 없음
- 4280~4289 잔존 listener: 없음
- 생성한 증거와 프로토타입은 `/tmp`에만 존재한다.
