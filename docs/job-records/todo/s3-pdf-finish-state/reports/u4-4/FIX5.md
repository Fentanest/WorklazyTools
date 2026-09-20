# U4-4 fix-5 구현 보고

- 작성자: Codx / gpt-5.6-sol
- 일자: 2026-09-08 KST
- 저장소: `/home/better0101/projects/worklazytools`
- 브랜치: `s3-pdf-finish`
- 기준 HEAD: `c3288856b10953e663a0910a9ca125c7bfe667eb`
- 결과 커밋: `89873f7b1e0c4a32e41b0acb8120e5e289c60fcb` (`fix(pdf): raise reload button contrast`)
- main 병합·push·배포: 수행하지 않음

## 실행 게이트와 범위

`PROJECT_RULES.md` 전문을 첫 행동으로 읽은 뒤 `AGENTS.md`, fix-5/fix-4 dispatch, `/tmp/worklazy-u4-4-review5/REPORT.md`, PDF finish 정본과 열린 계획서를 대조했다. 브랜치와 기준 HEAD는 지시와 일치했고 동일 코드 표면의 상반된 열린 지시는 없었다. 사용자 미추적 `after.docx`, `before.docx`, 네이버 확인 HTML, `newui/`는 열거나 stage하지 않았다. 지정된 금지 worktree에 접근하지 않았고 모든 Vite 서버는 4280~4285 `--strictPort`만 사용한 뒤 종료했다.

## 구현

`src/features/pdf-editor/pdfUi.tsx`의 `pdf-display-reload` 버튼에 정상·hover·focus-visible `text-foreground`를 버튼 범위로만 명시했다. 오류 컨테이너의 `text-destructive` 상속을 끊었고 공용 palette와 Button primitive는 바꾸지 않았다. 버튼 기능, 한/영 문구, Tab 접근, 36px 높이와 너비, reload 동작은 유지했다.

기본 `tests/accessibility-audit.mjs`에는 표시 자산 최초 요청을 중단하는 ko/en × light/dark 네 상태를 등록했다. 각 상태에서 normal·hover·focus-visible을 실제로 적용한 뒤 버튼 전경만 투명하게 만들고 테두리·모서리를 제외한 내부 렌더 배경 픽셀 전수와 계산 전경색의 최저 대비를 측정한다. 세 상태 중 하나라도 4.5:1 미만이거나 상태가 빠지면 실패한다. dark gradient로 Axe가 판단하지 못한 정확한 버튼 노드 2개는 `measured-pixel`로 별도 보존하며 shared 부채 수치에 섞지 않는다. marker·소유 분류·한도는 변경하지 않았다.

## 대비 수정 전·후

Chrome 152.0.7977.64, 1280×800, DPR 1, reduced motion. 아래 값은 실제 배경 픽셀 기준 최저 대비다.

| 언어·테마 | 수정 전 normal | 수정 전 hover | 수정 전 focus | 수정 후 normal | 수정 후 hover | 수정 후 focus |
|---|---:|---:|---:|---:|---:|---:|
| ko light | 4.2746 | 12.0215 | 4.2746 | 15.8771 | 12.0215 | 15.8771 |
| en light | 4.2746 | 12.0491 | 4.2746 | 15.8771 | 12.0491 | 15.8771 |
| ko dark | 6.5720 | 15.8803 | 6.5720 | 17.4330 | 15.8803 | 17.4330 |
| en dark | 6.6017 | 15.8803 | 6.6017 | 17.5118 | 15.8803 | 17.5118 |

기준 커밋 보존 빌드에 최종 하네스를 실행한 음성 대조는 light normal/focus 4.2746:1과 Axe serious 2건으로 exit 1이었다. 수정 뒤 12개 조합은 모두 4.5:1 이상이며 접근성 범위 실행의 위반은 0이다.

fix-4 오류 두 요소의 대비도 유지됐다.

| 언어 | 테마 | invalid textarea | empty-text notice |
|---|---|---:|---:|
| ko | light | 7.6428 | 6.9595 |
| en | light | 7.6428 | 6.9595 |
| ko | dark | 8.9891 | 8.3795 |
| en | dark | 8.9891 | 8.3795 |

## 표시 실패 복구 유지

독립 Playwright probe에서 양 언어 모두 확인했다.

- 최초 표시 자산 요청 중단 뒤 1.2초 동안 자동 재시도 0, 자동 reload 0
- 현지화 안내·버튼 표시, 원시 예외·`/assets/`·runtime·Worker 노출 0
- 버튼 문구 `페이지 새로고침` / `Refresh page`, `tabIndex=0`
- 버튼 크기 ko `142.09375×36`, en `132.0625×36`
- 명시적 reload 뒤 선택 파일 0, 재선택 후 preview 성공
- 저장 결과 header `%PDF-`, route error 0, 표시 URL 1개

## 실행한 검증

| 명령·범위 | 결과 |
|---|---|
| `node --check tests/accessibility-audit.mjs` | exit 0 |
| `node --test --experimental-strip-types tests/unit/accessibility-audit.test.ts` | 9/9, fail·skip 0 |
| `NODE_OPTIONS=--max-old-space-size=4096 npx tsc -b` | exit 0, 진단 0 |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build` | exit 0, 2,847 modules, 정적 69페이지 |
| 지정 watermark 정상 1 + 기존 오류 4 + 표시 실패 4 접근성 | 9상태, violations 0, F2 incomplete 0, pixel-resolved 2, external request 0 |
| 기준 커밋 표시 실패 4상태 음성 대조 | 예상 exit 1, light serious 2·normal/focus 4.2746 |
| `/tmp/worklazy-u4-4-fix5/probes/display-recovery.mjs` | ko/en 복구·preview·save 통과 |
| `VISUAL_ONLY=pdf-finish-watermark--interaction ... npm run test:visual` | Chrome 152, 8/8, 기준선 변경 0 |
| `git diff --check` / `git diff --cached --check` / `git show --check` | 모두 통과 |

지시대로 full `test:unit`, full `test:browser`, `test:pdf-finish`, 성능 재측정, `bundle:measure`, full a11y와 기타 전 스코프는 실행하지 않았고 병합 직전 1회로 이월한다.

## 변경 파일

- `src/features/pdf-editor/pdfUi.tsx`
- `tests/accessibility-audit.mjs`
- `tests/unit/accessibility-audit.test.ts`
- `CHANGELOG.md`
- `docs/review-notes.md`

번역·SEO·정적 페이지·AdSense 격리·의존성·시각 기준선 파일 변경은 없다.

## 증거 파일

| 파일 | SHA-256 |
|---|---|
| `evidence/a11y-before.json` | `c4e145bb94a17f228866aaf8e3a2c75f91cefbd830b867f10128ec5dffccbbf4` |
| `evidence/a11y.json` | `369868370e331f4736405c3617fee89dc4d6aebf7d2e17e220604599694605f6` |
| `evidence/display-recovery.json` | `2ea0d145d6a87d0f9dfead814e224a43743f15ef1be87f1efdc2250bcc9e1c8f` |

## 종료 상태

결과 커밋 뒤 추적 워킹트리는 깨끗하다. 남은 항목은 시작 전부터 있던 사용자 미추적 파일 4개뿐이다. 4280~4289 listener는 0개다.
