# Astra 계획 2차 기술 검토 — v0.2

검토 대상: `/home/better0101/projects/worklazytools/docs/jobs/todo/adsense-recheck-20260919/PLAN.md`.
SHA256: `d217b905c8144031b53bf926ee3ce97b4f6a058c4547273c9aa805765b56571c` — 요청한 앞 16자와 일치.
비교본 `PLAN.v0.1.md` SHA256: `92cf5045daeee7b8d1383a4311fdde6d11a252156258a6ff2927fb69a49ec7ce` — 1차 보고의 대상과 일치.
기준 HEAD 및 로컬 `origin/main`: `29fe72cb5a25c6d9643d69f66d713f1386a4ff4e`.

1차 보고 `/tmp/wl-adsense/review-plan/astra-round1.md`와 v0.1→v0.2 diff, 아래에 명시한 관련 소스만 대조했다. §0의 확정 사실과 §1의 사용자 조건은 재논의하지 않았다. F(`.agents/skills/worklazy-scoped-verification/SKILL.md`)를 적용했으며, 빌드·테스트·브라우저·외부 네트워크 실행은 하지 않았다. 아래의 해소는 **계획 계약의 해소**이며 구현·검증 성공을 뜻하지 않는다. Claude의 감사·최종 판정과 구현 허가를 대신하지 않는다.

## 시작 상태

명령: `git -C /home/better0101/projects/worklazytools status --short`

```text
 M patch_notes.py
?? patch_getfaqs.py
?? patch_guidekey.py
?? patch_pdf_faqs.py
?? patch_toolguide.py
?? scratch/fix_doc_compare_faq.py
?? scratch/fix_excel_compare.py
?? scratch/fix_guides.py
?? scratch/fix_guides2.py
?? scratch/patch_ad_eligibility.py
?? scratch/patch_appshell.py
?? scratch/patch_package.py
?? scratch/patch_validate_guides.py
?? scratch/patch_validate_guides2.py
?? scratch/refactor_guide_key.py
?? scratch/refactor_static_pages.py
?? scratch/remove_fallback.py
?? scratch/write_validate_guides.py
```

명령: `git -C /home/better0101/projects/worklazytools rev-parse HEAD`

```text
29fe72cb5a25c6d9643d69f66d713f1386a4ff4e
```

## 1차 차단 쟁점 판정

PLAN 행 번호는 검토한 v0.2 기준이다. 코드 경로는 저장소 루트 상대 경로다.

| # | 쟁점 | 판정 | 근거와 남은 사항 |
|---|---|---|---|
| 1 | 라우트 정본·정규화·실제 `(slug, route)` 연결쌍 | [해소] | PLAN:85–86은 App.tsx 선언을 정본으로 삼고 하위·동적 경로, 끝 슬래시, EN HWP 제외, 정확한 경로 일치와 실제 연결쌍 검사를 명시한다. `src/app/App.tsx:77`의 중첩 results 라우트와 `src/i18n/guideData.ts:98`의 path 우선 선택에 맞는다. AST 추출 경로로 소유 범위 안에서 구현 가능하다. 선택적인 공유 모듈 방안의 문구 문제는 추가 확인 A4에 한정한다. |
| 2 | 39건 확인 위치·상태 | [해소] | PLAN:78–79는 해당 가이드 문단 위치, 엔티티 디코딩, 수정/유지/제거/미연결 삭제/격리 미노출을 구별하고 dist 전체 문자열 0건 기준을 폐기했다. PLAN:174는 재현 불가·미확인·미배포 항목을 통과·운영 확인과 구별한다. 정상 제목에 같은 문자열이 남는 반례가 해소됐다. |
| 3 | 광고 스모크 외부 통신 fail-closed·계수 분리 | [해소] | PLAN:103–104,123은 로컬 origin 외 HTTP(S) 기본 abort, 정확한 스크립트만 CORS 가능한 fulfill, 분석 통신 차단, 시도/스텁/차단/실제 외부 허용 계수와 문서별·누적 loads, 역검증 중 차단 유지를 명시한다. `src/components/AdSenseLoader.tsx:25` 및 `:28–31`과 맞는다. SW도 적용 확인 대상으로 명시했다. 설치된 Playwright의 `node_modules/playwright-core/lib/coreBundle.js:38277`, `:38289`에는 SW 요청을 context interceptor로 전달하는 구현이 있으므로 SW 허용 자체를 새 차단 사유로 삼지 않는다. 실제 환경의 차단·계수 증명은 WU2 실행에서 확인할 사항이다. |
| 4 | S6 문서 교체·EN HWP·S8 격리/video·S3/S4/S5 조건 | [부분 해소] | S6의 새 문서/SPA/301 분리, HWP KO 한정, S8 video·최종 문서 상태, S3 새 context·실제 chunk, S4 지속 실패, S5 주입 방식·재현 불가 구분은 해소됐다. 서버 지연/오류/변환은 `tests/recovery-server.mjs:29–39`, reload는 `src/app/chunkRecovery.ts:10–24`로 뒷받침된다. **다만 새 §4-2 머리말(PLAN:109)이 S2까지 EN 표본을 PDF merge/document-compare로 한정한다. 둘 다 광고 제외 경로이므로 S2의 script 1·스텁 1과 충돌한다. 이 새 충돌은 차단이다.** |
| 5 | WU3 138개·격리 재생성·XLSX/PDF·untracked 보존 | [부분 해소] | PLAN:137–142,147에 138개 전수 목록, 원본 비삭제·빈 /tmp 출력, manifest와 PDF 확인, XLSX 전체 package, PDF 이미지·첨부 미확인 처리, evidence 참조 보존이 반영됐다. 생성기의 출력 인자는 `tests/helpers/pdf-compare-fixtures.mjs:3–9`, manifest 생성은 `:25`에서 확인된다. 원본 untracked를 별도 작업으로 남기는 것도 허용 가능하다. 다만 PLAN:137은 로컬 수정본까지 WU3 대상 밖·통합 후 Claude 사본 처리로 정한 반면, PLAN:54,143은 WU3에서 해당 수정본을 archive 보존한다고 남아 있다. **보존 담당·시점의 비차단 문구 충돌**만 정리하면 된다. |

## v0.2 추가분 확인

| ID | 추가분 | 판정 | 근거와 남은 사항 |
|---|---|---|---|
| A1 | §3-1 이관 ID 한정·root 보존·빈 선택 배열 | [부분 해소] | faq_19/20 및 OCR pathBlocks 한 블록, root의 new_faq_1 보존, 기존 root/merge/split 출력 비교, 빈 배열을 데이터 검사에서 실패시키고 소비자 fallback은 유지하는 정책은 해소됐다. 다만 v0.1에 있던 **standard의 OCR pathFaqs 키 제거 지시가 v0.2에서 빠졌다.** 남은 키는 `src/locales/ko/guides.json:1896`, `src/locales/en/guides.json:1899`에서 이관할 두 ID를 참조하며, FAQ만 제거하면 `scripts/validate-guides.mjs:82–86`이 실패시킨다. 기존 검사로 검출되는 국소 정리이므로 새 차단으로 올리지 않고 제거 지시 복원을 권고한다. root 정책은 다시 열지 않는다. |
| A2 | §3-2 convert 기대 질문·정적 검사기 자체 검증 | [부분 해소] | 공유 기대표 경로, convert 전용 질문 추가, FAQPage 파싱 및 세 오류별 mutation 자체 검증은 적절하다. 그러나 PLAN:68의 “현재 기본값이 convert에 적용”이라는 새 설명은 코드와 다르다. `scripts/validate-static-output.mjs:88`의 FAQ 검사 진입 목록에 convert가 없어서 `:137–138`의 기본값 분기까지 들어가지 않는다. **convert 검사를 새로 추가한다**고 바로잡으면 된다. 출력 계약·기존 기대 질문을 약화할 이유는 없으며 비차단 설명 수정이다. |
| A3 | §3-4(4)(6) 19건 fixture·주입 데이터 | [해소] | 19개 원문 각각 실패, 정상 주의/짧은 유효 문장의 negative control, 좁은 허용목록, 순수 함수·CLI guard, FAQ 선택까지 주입 데이터 적용, mutation 판정 확인이 명시됐다. `scripts/validate-guides.mjs:16`의 디스크 읽기와 `src/i18n/guideData.ts:102`의 원본 가이드 접근에 대한 1차 지적을 반영했다. 이미 해소된 패턴·모듈 형식 논점은 다시 열지 않는다. |
| A4 | §3-5/§4-4/§5 소유 파일·신규 전체 경로 | [부분 해소] | 기대표·두 단위 테스트·WU2 보고·WU3 분류표·.gitignore 단독 소유는 명시됐다. WU1 보고만 `WU1-REPORT.md`로 축약되어 §10의 전체 경로 요건이 남는다. 또한 “공유 모듈을 App.tsx가 import”와 “App.tsx는 import 한 줄만 수정”만으로는 문자열 리터럴 Route 선언(`src/app/App.tsx:58–108`)이 그 모듈을 소비하지 않는다. 이미 허용된 AST 방식을 선택하면 이 문제가 없으므로 비차단이다. 신규 경로 표기를 완성하고 선택지 문구를 정리하면 된다. |
| A5 | §6 시각 검토·공통 기록 소유 | [해소] | PLAN:80,153은 구체적인 대표 화면의 통합 dist 재캡처·실제 열람 담당·대체 담당을 정했고, PLAN:155는 공통 기록을 통합 Sol 1인에게 귀속했다. 전체 시각 회귀 확대 없이 1차 지적을 충족한다. |
| A6 | §11 변경 이력 | [해소] | v0.1·v0.2 이력과 주요 변경 요약이 실제 diff에 대응한다. “1차 반박 반영”을 2차 확인 통과나 정본화 완료로 읽지 않는다. 표지 역시 검토 중·2차 대기 상태다. |

## 부분 해소 항목의 수정 문구 제안

### R4 — 필수: EN S2 경로를 별도 지정

§4-2 머리말을 다음으로 교체한다.

> 모두 KO 기준으로 검사하고 S2·S6·S8은 EN 표본을 추가한다. S2의 EN 표본은 광고 허용 경로 `/en/tools/text-merger`이며 동의 있음·정상 로드에서 script 1·스텁 1·실제 외부 허용 0을 확인한다. S6은 이 EN 허용 경로에서 `/en/tools/pdf-editor/merge` 또는 `/en/tools/document-compare`로 이동하고, S8은 해당 EN 제외 경로로 직접 진입한다. HWP는 KO만 검사하며 `/en/tools/hwp-editor`의 `/en/tools` 리다이렉트는 정상 동작으로 기록한다.

새 차단의 코드 근거: `src/components/AppShell.tsx:45–50`은 PDF와 document-compare를 adFree로 분류하고 `:121`은 adFree일 때 AdSenseLoader를 렌더하지 않는다. `/tools/text-merger`는 `src/app/App.tsx:97`의 정상 Route이며 이 제외 조건에 해당하지 않는다. 광고 제외 정책을 바꾸거나 S2 기대값을 0으로 낮추는 해결은 요구하지 않는다.

### R5 — 비차단: 원본 로컬 파일 보존 담당 통일

§5 첫 문단의 새 방침을 기준으로 §2 마지막 설명(PLAN:54)과 §5 archive 문장(PLAN:143)을 맞춘다.

> WU3 Sol은 자기 worktree의 추적 대상 138개만 분류·처리한다. 원본 작업트리의 untracked와 `patch_notes.py` 로컬 수정본은 건드리지 않고 “원본 작업트리·WU3 미처리·보존”으로 구별해 기록한다. 통합 후 Claude가 원본을 그대로 둔 채 archive 사본을 만든다. 로컬 수정본 사본의 전체 경로는 `/home/better0101/projects/worklazytools/docs/jobs/todo/adsense-recheck-20260919/archive/patch_notes.local.py`이며 출처와 사본 확인 결과를 기록한다.

이 정리는 §0의 파일 수나 로컬 수정 사실을 변경하지 않는다. `patch_notes.py` 로컬 수정은 untracked 파일과 다른 종류임도 기록에 보존한다.

### A1 — 비차단: 남은 OCR 선택 참조 제거 명시

§3-1 첫 항목에 다음 한 문장을 추가한다.

> KO/EN `pdfEditor.standard.pathFaqs["/tools/pdf-editor/ocr"]`도 convert의 OCR 선택 목록으로 이관한 뒤 standard에서 제거하여, 이동한 faq_19/faq_20을 가리키는 참조를 남기지 않는다. root·merge·split 등 그 밖의 standard 선택은 유지한다.

### A2 — 비차단: convert 검사의 실제 시작 상태 정정

§3-2의 기본값 설명을 다음으로 교체한다.

> 현재 convert는 정적 FAQ 검사 대상 목록에 없으므로 이번에 검사 대상으로 추가한다. convert 선택 목록에 실제로 포함되는 전용 기대 질문을 공유 기대표에 등록하고, 기존 검사 대상과 기대 질문은 그대로 유지한다. PDF 공통 기본값인 페이지 번호 질문을 convert에 적용하지 않는다.

### A4 — 비차단: 소유 경로와 선택적 라우트 구현 방안 정리

소유 목록의 축약 표기를 다음으로 완성한다.

> WU1 기록: `docs/jobs/todo/adsense-recheck-20260919/WU1-ITEMS.md`, `docs/jobs/todo/adsense-recheck-20260919/WU1-REPORT.md`. WU3 archive: `docs/jobs/todo/adsense-recheck-20260919/archive/` 아래 분류표에 대응시킨 보존 경로. 원본 로컬 수정본 사본은 R5의 Claude 후속 처리다.

추가 제품 파일 변경 없이 해결하는 최소 라우트 문구는 다음과 같다.

> 라우트 목록은 `scripts/validate-guides.mjs`에서 App.tsx의 Route 선언을 AST로 읽어 추출한다. 이번 소유 범위에는 App.tsx 수정과 `src/app/toolRoutes.ts` 신설을 포함하지 않는다.

공유 모듈 방안을 유지한다면 import뿐 아니라 실제 Route가 목록을 사용하는 변경 범위를 별도로 명시해야 한다. AST라는 실행 가능한 기존 선택지가 있으므로 라우트 정본 계약 자체를 다시 차단하지 않는다.

## 확인 범위와 한계

- 새 실행: 문서 해시·v0.1 대비 diff·관련 코드 읽기·시작/종료 Git 상태 확인.
- 재사용: 고정 v0.1 대상 1차 반박의 논점과 분석. 제품 테스트 통과 결과를 재사용했다고 주장하지 않는다.
- 이번 대상 아님: 빌드·단위 테스트·브라우저·시각 열람·138파일 민감정보 전수 검사. 모두 계획된 구현/검증 단계의 작업이며 본 검토에서 성공으로 계수하지 않았다.
- 새 차단은 R4의 EN S2 기대 충돌 1건이다. R5 및 A1/A2/A4는 비차단 문구 정합 보완이다. 1차에서 해소된 사용자 정책·기존 비차단 설계는 새 근거 없이 재개하지 않았다.

## 종료 상태

명령: `git -C /home/better0101/projects/worklazytools status --short`

```text
 M patch_notes.py
?? patch_getfaqs.py
?? patch_guidekey.py
?? patch_pdf_faqs.py
?? patch_toolguide.py
?? scratch/fix_doc_compare_faq.py
?? scratch/fix_excel_compare.py
?? scratch/fix_guides.py
?? scratch/fix_guides2.py
?? scratch/patch_ad_eligibility.py
?? scratch/patch_appshell.py
?? scratch/patch_package.py
?? scratch/patch_validate_guides.py
?? scratch/patch_validate_guides2.py
?? scratch/refactor_guide_key.py
?? scratch/refactor_static_pages.py
?? scratch/remove_fallback.py
?? scratch/write_validate_guides.py
```

명령: `git -C /home/better0101/projects/worklazytools rev-parse HEAD`

```text
29fe72cb5a25c6d9643d69f66d713f1386a4ff4e
```

시작·종료의 status 출력과 HEAD가 각각 동일하며 검토 대상 PLAN 해시도 유지됐다. 이번 작업에서 저장소 파일 수정·커밋·push는 하지 않았고, 작성한 산출물은 이 보고서 한 파일뿐이다. Git 상태 비교는 관측된 변경 상태의 일치 확인이며, 모든 파일 내용의 전수 해시 비교를 수행했다는 뜻은 아니다.

정본화 가능 여부: **조건부 가능 — §4-2의 EN S2 표본을 광고 허용 경로로 분리 지정해야 한다(R4). 나머지 부분 해소 항목은 비차단 문구 보완 권고다.**
