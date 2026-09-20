# 2026-09-09 계획 4종 공통 실행 게이트 — Codx

이 문서는 bundle-pdflib-dedup / u6-privacy-masking / u9-direct-entry / ui-theme-rebaseline-procedure (모두20260909)의 부속이다. 현재 계획 라운드에는 제품 구현·추적 파일 변경·commit/main merge/push/배포를 허용하지 않는다. 검증용 탐색은 /tmp/worklazy-canon의 사본만 사용했다.

## 기준 해시 차이
지시 기준 `d3a8d89d19dbb6165cacce8257838dc3dff9b084` → 현 HEAD `d9c79b7a16f5b99fa7cddfde741b8d10f08f07d0`(s3-pdf-finish). `git log --oneline d3a8d89..HEAD`, `git diff --stat d3a8d89 HEAD` 실행: main통합fb7abde + 기록d9c79b7,94파일7781삽입833삭제. PDF/U4 코드는 이 diff에서 변경0, Excel/doc compare/locale/SEO/공용하네스 변경이 있으므로 d3 숫자를 현행으로 오인하지 않는다. 기준차이를 사용자에게 작업 초반 보고하고 계획 근거의 현행 해시를 기록했다. 이 사실을 이유로 통합을 되돌리거나 후속구현하지 않는다.

지시의 정정은 그대로 유효: **d3 U4 자체 번들초과 없음**, app잔여2507B. 이후 통합은 별도 회계: app총합5944016B − 고정 baseline5843715B =100301B, 상한96000 대비4301B 초과. `/tmp/worklazy-u4-mergegate/bundle-full.json`의 91JS 파일별 gzip 합산과 report metrics를 대조하며 탐색 control 재빌드로 재확인한다. 통합예산 실패는 U4단독 결함으로 귀속하지 않는다.

## 열린 계획 충돌
23개 top-level 계획서의 제목/상태를 `/tmp/worklazy-canon/open-plans.json`에 기록하고 실행중 관련 하위 MERGE-GATE-CHECKLIST 및 UI v3첨부를 판독했다.
- pdf-finish/roadmap-completion: U4 종결/미회수게이트는 별도. 이번 bundle계획이 U4 배포를 승인하거나 budget-stop을 무효화하지 않는다.
- qr-font: full/subset 폰트 공급·subset:false를 유지. bundle dedup은 fontkit subset 재시도/QR폰트 계약을 변경하지 않는다.
- new-tools-roadmap: U6/PDF·JPG·PNG·WebP, U7·U8상세를 착수 직전만, U9마지막 순서 유지. 이번 별도계획은 상세만 보완.
- ui-theme-redesign v3: 설계결정 이견0 유지, 현재는 **U4배포뒤 재설정절차만**. 본절차가 옛 구현HEAD를 덮지 않는다.
- document-compare-granularity: 엔진 변경은 완료분 보존, 결과화면6항만 UI소유. 신규도구U6와 UI로컬라벨U6는 다름.
- shadcn/P2옛수치/색상/컴포넌트지시는 UI갱신정본의 동일표면에서 대체; 기존기능 출력oracle은 보존.
- 이번4문서가 공유하는 vite/App/registry/SEO/static/locale표면은 동시 구현 금지. 선행단위 종결해시로 후속 재기준/충돌검사 후만 착수. U6 전에 번들중복개선을 자동 착수시키는 의존은 없음(사용자 투자승인 별도).

## 고정 예산과 검증 실행
보존 baseline `docs/jobs/todo/canon-rounds-20260909/bundle-baseline.json`, SHA256 `4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`.
entry20480/PDF affected82000/shared30720/app96000/CSS10240 바이트 한도, override{},multiplier1. 구계획의 더 오래된61440/81920와 혼동하지 않는다. 분기점측정은 추가 비교자료일 뿐 이 baseline을 교체하지 않는다.
실행 전 확인:
```sh
sha256sum docs/jobs/todo/canon-rounds-20260909/bundle-baseline.json
git rev-parse HEAD
git status --short
node --input-type=module -e 'import {resolveBudgetLimits} from "./scripts/measure-bundle-budget.mjs";import assert from "node:assert/strict";const b=resolveBudgetLimits();assert.deepEqual(b.overrides,{});assert.equal(b.multiplier,1);console.log(b)'
```
미래 구현 검증은 해당 문서의 신규테스트를 먼저 작성하고 실행한다. 존재하지 않는 테스트를 지금 통과했다고 쓰지 않는다. 단계별: 영향표면 검증 및 축소불가4항(되돌림/하위호환oracle/검사기건전성/사용자경로재현). 이월은 명시목록으로 보존하고 최종병합직전 회수. 결함은 부모재현으로 이번/기존 분리, 기존은 backlog·P3묶음, 이번회귀는면제없음. 배포시 UI영향이 있다면 광고/분석제외로컬 Gemini시각+Codx교차 필요.

부속 baseline 및 모든계획은 gitignored jobs문서이며 커밋하지 않는다. 현재라운드의 검토결과도 추적 CHANGELOG/review-notes에 적지 않는 사용자지시가 우선한다.
