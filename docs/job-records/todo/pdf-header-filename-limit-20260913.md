# PDF 머리글·바닥글 파일명 길이 설정 — v1 정본

상태: **Claude 초안·Astra 2회 검토의 확정 문구 반영 완료, U9 종결 뒤 착수 대기.** ID `PDF-FILENAME-TRUNC-01`. 기준 소스 U8 `9fa435ae6be5c92b05f9032479d1f7298899b76b`. 편성은 U9 배포·라이브 확인 뒤, UI 재기준화 전이다. 시작할 때 최신 SHA·미커밋 변경·열린 계획 교집합을 재확인한다. U4 아카이브는 재개하지 않는다.

사용자 2026-09-09 요청: 머리글·바닥글 파일명을 숫자로 설정해 그 숫자 **이상**일 때 줄이는 기능을 진행 중 작업 사이에 반영. 폭이 부족한 짧은 이름은 글자를 작게 표시해 보존한다는 root 작업 가정을 사용자에게 설명했다. 해당 선호 질문은 미응답이며 추가 허락 대기가 아니다. 구현 전 다른 선호가 수신되면 그 지시를 우선한다.

## 출력·입력 계약

머리글·바닥글 옵션에 현행 UI를 사용한 한영 숫자 입력과 설명을 추가한다. 기본 빈 값은 문자 수 제한 없음이다. 파일명 베이스는 기존처럼 대소문자 구분 없이 끝의 `.pdf`만 제거하며 원문을 normalize하지 않는다. 숫자 N은 1..1000 정수, 길이 >=N이면 앞 N−1 그래핌 클러스터+`…`, 길이<N이면 원문, N1이면 `…`다. 파일명 토큰 표시만 바꾸며 입력/출력 파일명과 보고서 이름은 그대로다.

공유 parser는 입력을 먼저 trim한다. trim 결과가 빈 문자열이면 valid null, 비빈 값은 `/^\d+$/` 전체 일치→Number→safe integer/1..1000 검사다. 앞자리 0 허용(`007`→7). 소수·지수·suffix·범위 밖은 무효이며 반올림/클램핑하지 않는다. 무효는 null과 구분한다. 문자열을 보존하는 입력 또는 `validity.badInput` 처리로 브라우저 숫자 입력의 무효 상태가 빈 값으로 통과하지 않게 한다. 엔진도 null 또는 1..1000 safe integer를 검증한다.

인라인 오류는 머리글·바닥글에서 표시하고 생성 차단은 `enabled['header-footer']`에만 연동한다. 다른 탭이 활성이어도 포함된 머리글·바닥글의 무효 값은 차단하며, 포함 해제 시에는 다른 옵션의 생성을 막지 않는다.

문자 분리는 `Intl.Segmenter`의 grapheme만 사용하고 scalar fallback은 없다. 미지원 환경에서는 숫자 제한이 포함된 해당 옵션만 현지화된 안내로 차단한다. 빈 제한/제외 옵션은 정상 동작한다. 글꼴의 emoji 지원과 그래핌 분할 보장은 별개다.

## 정책 소유·전달

header-footer decoration에만 `filenamePolicy?: {limit:number|null}` 같은 표지를 둔다. **표지 없음=legacy 폭 말줄임, 표지+null=문자 축약 없이 파일명 셀 폭 맞춤, 표지+정수=숫자 축약 후 폭 맞춤**이다. 이름은 구현 재량이며 삼상태 의미는 고정이다.

폼 원문→공유 parser→포함된 header decoration→`textDecorations`→`finishOptions`→preflight/실제 실행→엔진 validate/preparePages와, 폼→파싱된 `FinishPreview` props→`expandTokens`의 실제 두 경로를 연결한다. 둘 다 같은 파일명 helper를 사용한다. limit null은 helper를 호출하지 않고 base를 그대로 확장한다. 무효 값을 valid null로 위장하지 않는다.

`FinishPreviewFormState`는 원문 `FinishFormState`의 fontSize/margin/filenameLimit을 Omit한 뒤 숫자 fontSize/margin과 파싱 filenamePolicy를 선언한다. raw filenameLimit을 별도 결정 원천으로 남기지 않는다. 최상위 `PdfFinishDecorationOptions`의 공유 상속에서는 filenamePolicy를 제외하고, `baseTextOptions` 및 기존 fallback/watermark 복사 경로에는 정책을 복사하지 않는다. header decoration 자체와 preview의 header 소유 표지만 정책을 전달해 page-number/watermark의 filename 토큰은 바꾸지 않는다. Infinity 전달은 없다.

## 폭 맞춤 경계

정책 표지가 있고 원 template에서 인식되는 `{filename}`을 포함한 머리글·바닥글 셀만 대상이다. 같은 셀의 prefix/date/suffix도 한 크기로 줄인다. 파일명 토큰 없는 셀·페이지 번호·워터마크·도장은 기존 동작을 유지한다.

`createPageDecorationPlan`에서 actual font/region과 변환 후 **원래 prepared.lines**의 폭을 측정한다. 파일명 보존 경로는 `fitWithEllipsis`를 호출하지 않고 사용하지 않는 ellipsis 폭 때문에 narrow-region을 반환하지 않는다. `layoutTextLines`의 명시적 opt-in 분기 또는 국소 helper로 구현하며 기존 호출은 바꾸지 않는다.

원문이 들어오면 설정 크기를 유지한다. 초과하면 원문 전체가 들어가는 유한 양수 크기를 구해 동일 크기로 원문 runs·정렬·lineHeight·기존 `PageDecorationPlan.fontSize`를 만든다. 이미 잘린 runs를 재측정해 성공으로 수용하지 않는다. 임의 1pt 하한으로 다시 자르지 않으며 불가능한 geometry/비유한 측정은 기존 오류로 처리한다. 기존 수직 overflow·CropBox·회전·좌표·최종 drawText의 `/UserUnit` 계약은 유지한다. watermark 전용 draw 경로는 대상이 아니다.

미리보기는 같은 변환 token 문자열을 표시하며 기존 CSS 근사 계약을 유지한다. 새 PDF 픽셀 동치 약속은 없다. 한영 도움말로 PDF에서 긴 문구가 더 작게 표시될 수 있음을 알린다.

## 변경 범위·검증

최소 제품 경로는 `finish/tokens.ts`(parser/변환 또는 같은 영역의 작은 helper), `finish/engine.ts`(타입/검증/전달/측정/plan), `PdfFinishPanel.tsx`(폼/한영/preview/include), 필요할 때만 `finish/text.ts`의 국소 보존 경계다. 새 런타임 의존성·전역 문자수/타이포 프레임워크·PDF ToUnicode 수리·다른 마무리 탭 수정·UI 재설계는 제외한다.

수정 중 실행:
- 기존 `tests/unit/pdf-finish-modules.test.ts`, `pdf-finish-engine.test.ts`에 parser blank/trim/N1/N1000/무효 소수·지수·suffix/앞자리0, N−1/N/N+1, `.PDF`, normalize 없음, 정책 삼상태와 폭 경계를 추가한다. ZWJ `A👨‍👩‍👧‍👦BC`, N3→`A👨‍👩‍👧‍👦…`; 조합자소 `\u1100\u1161나다`, N2→`\u1100\u1161…`를 검사한다.
- 머리글 전용 작은 browser smoke 또는 실제 지원 국소 분기에서 preview 변환값, include off 무효 비차단/on 차단/다른 활성 탭에서도 차단, 유효 새 값 다운로드를 확인한다. 기존 `pdf-finish-smoke.mjs`에 없는 필터를 만들었다고 가정하지 않는다.
- 실제 PDF는 지원 글꼴의 긴 ASCII·한글 합성 표본으로 전체 변환 문자열, 두 번째 자동 말줄임 없음, run 폭 containment와 실제 출력 크기를 확인한다. 빈 제한의 긴 파일명도 확인한다. emoji 분할 검사를 glyph 지원의 PDF 성공 기대값으로 승격하지 않는다. 비파일명 셀과 기존 watermark/페이지번호 동작 불변을 확인한다.

최종 후보에서 유효한 `npm run build`, `npm run test:unit`, `npm run test:static`, 영향 smoke와 ko/en 좁은/넓은 선정 QA 화면의 Gemini 실제 열람을 확인한다. 동일 입력·소스·환경의 기존 증거는 검사별 재사용한다. 기존 engine test713은 watermark 보존 검사이며 머리글 검사로 오인하지 않는다. 전체 U4/전 도구 회귀는 추가하지 않는다. 사용자 dummyfortest/before·after.docx/newui/naver검증파일/configzip 및 vendor 내용을 읽지 않고 합성 입력만 사용한다.

## 기록·종료

코드·테스트·배포는 승인된 역할의 Codex 담당, 일반 구현·마감/commit/push/live는 Sol, 까다로운 수리는 사용자 지시대로 Astra에 맡긴다. 한 제품 writer만 유지한다. 코드 변경은 CHANGELOG Codx, 판정·실측은 review-notes, backlog 항목은 구현·라이브 확인 후 종결한다. 정본 범위의 완료 검사와 고정 산출물 검수 후 정상 push·Pages/live 확인까지 기존 사용자 배포 승인으로 진행한다.

Claude Sonnet actual 초안/수정은 `/tmp/worklazy-pdf-filename-reading/PLAN-DRAFT.md`, `PLAN-REVISION.md`; 첫 호출은 미지원 effort 인자로 exit1/사용량0, 인자 교정 실행과 같은 대화 수정은 exit0이다. Astra `/tmp/worklazy-pdf-filename-plan-review/REPORT.md`의 5차단 및 `REVISION-REVIEW.md`의 정확한 확정 문구를 본 v1에 반영했다. Node parser/Segmenter/현재layout 반례 exit0, 관련9파일 SHA·HEAD/status불변, 수정 재검토는 실제실행 재사용·추가실행0. 최종 조건문구 반영으로 추가 왕복 없이 정본화 가능하다는 판정에 따라 본 문서를 고정한다. **제품 구현은 아직 미착수다.** — Codx
