**[수정 후 재검수] — U4-3 fix-1 재검수, Codx, 2026-09-07**

F1~F8의 1차 반례는 수리됐고, 공통 검증도 통과했다. 다만 **F5의 사전 검사 상태를 초기화하는 변경에서 정상 입력의 만들기 버튼을 막는 회귀(R1, P2)**가 발견됐다. **F9의 파일명 정리는 끝 공백이 있는 입력에서 확장자 제거와 빈 이름 fallback을 놓친다(R2, P3).** 두 항목을 수리하고 재검수해야 한다. 시각 기준선은 의도한 30장만 바뀌었으며, 이번 검수에서는 기준선을 갱신하지 않았다.

| 기준 | 확인값 |
|---|---|
| 저장소 | `/home/better0101/projects/worklazytools` |
| 대상 브랜치·HEAD | `s3-pdf-finish` · `ff0452b3ad171bfba920f41ec0789612e5ec2001` |
| fix / 1차 검수 / 구현 기준 | `ff0452b` / `c8bff1f` / `446a1e3` |
| 비교용 main 사본 | `5bc6854175331bdd73b267784d9633cdccda8446`로 고정 |
| 실제 main 변동 | 시작 `5bc6854` → 06:08:14 UTC 관측 `d69e73a` → 06:17:05 UTC 관측 `cdb4007`; 검수 중단·비교 기준 변경 없음 |
| 실험 환경 | Node 22.17.1 · Chrome 152.0.7977.64 · Poppler 24.02.0 |
| 실행 | `git archive` 사본, build·browser·visual 직렬, `NODE_OPTIONS=--max-old-space-size=4096`, visual concurrency 1 |
| 저장소 불변 확인 | 05:48:03~06:40:14 UTC, 추적 **2,588개 SHA 동일**, 변경 경로 `[]`, HEAD·branch·status 동일 |

`PROJECT_RULES.md` 전문을 첫 행동으로 읽고 AGENTS, 재검수/fix 지시서, 1차 보고·제품 결정문·원본 재현 스크립트와 결과, sol 보고·34개 원로그, 정본의 해당 계약과 기각 이력을 대조했다. 열린 계획서도 검사했다. UI 재설계는 S3 통합 뒤 착수 계약이며 다른 병행 작업은 별도 표면이다. 이번 검수는 원본 추적 파일이나 열린 계획서를 수정하지 않는다. 금지된 타 작업 트리와 사용자 파일은 작업 대상으로 사용하지 않았다.

증거: [시작 상태](start.json), [종료 상태](end.json), [불변 증명](invariance.json), [시작 SHA](tracked-sha-start.json), [종료 SHA](tracked-sha-end.json), [main 관측](ref-observations.jsonl), [열린 계획 스캔](open-plans-scan.json), [환경](environment.json).

**지시서 12항 판정**

아래 `원본 engine/QR/browser/focused`는 1차 astra 스크립트다. 실행 명령 전문과 환경·exit·시간은 [commands.jsonl](commands.jsonl), 출력은 [logs](logs/), 상세 집계는 [findings.json](findings.json)에 있다. 조사 probe의 exit 0은 제품 합격을 뜻하지 않는다. 판정은 JSON에 기록된 관측값에 따른다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안·심각도 |
|---|---|---|---|
| 1. F1 시작 쪽 입력 | [통과] | 원본 `browser.mjs`의 `start-page-*` 4건 모두 routeError=0. `node probes/supplement-browser.mjs`: ko/en 8건에서 필드 오류·실행 비활성·파일/폼 보존, `1` 복귀 후 실행 활성. | 없음. 1차 P1 해소. |
| 2. F2 업로드 오류 | [통과] | 원본 R2/R6 4종 오류 표시 확인. 보충 ko/en × 보호4종+손상1종 × 기존 파일 유/무 **20건**, 보호/읽기 실패 문구 구별·routeError=0·정상 재업로드 성공. | 없음. 원시 예외 표시 없음. |
| 3. F3 미리보기 | [통과] | 원본 loaded **24건**, 중앙 최대 0.0078125px·종횡비 오차 최대 0.000009574·body overflow 0. 보충 portrait/landscape×6영역×ko/en×light/dark×390px **48/48 canvas 내부 포함**, 중앙·비율·wrapper 최대 오차 모두 0. 가운데 style `left:50%`. | 없음. 기존 thumbnail/preview helper 소스 diff 0. |
| 4. F4 CropBox | [통과] | 원본 engine **24/24** 위치/upright 통과. Media 400×600, Crop −50,−80,600,850 × 4회전에서 각 PDF.js 빨간 픽셀 **40**, Poppler **50**, PDF.js upright 및 Poppler 수평 bbox·MARK 추출 통과. 빈 교집합 fallback unit도 통과. | 없음. |
| 5. F5 사전 오류·안내 | **[결함]** | 원래 이모지/제어문자/날짜 오류 위치와 말줄임·줄 생략·3.8MB 사전 안내는 ko/en 통과. 그러나 보충 `reselection` **4/4**에서 선택된 탭/위치를 다시 클릭하면 `ready/활성 → idle/비활성`, 오류 없음. | **R1 · P2**: 동일 값 재선택에서 유효한 사전 검사 결과를 보존하거나, 초기화한 경우 반드시 같은 입력의 재검사를 예약한다. 아래 재현을 회귀로 고정. |
| 6. F6 취소 결과 | [통과] | 원본: partialOutputs 1·secondReads 0. 보충: 읽기 직전 취소 reads=`[1,0,0]`, 실제 두 번째 read 도중 취소=`[1,1,0]`; 둘 다 첫 PDF **919B/1쪽** 재개방 성공·세 번째 read 0. | 없음. 공개 `PdfFinishCanceledError.partialResults` 계약이 sol REPORT와 review-notes에 명시돼 있음. |
| 7. F7 QR 불변 | [통과] | **원본 `qr-compare.mjs` 무수정 실행**. subset **661,064B**, full **3,911,538B**, 두 경우 byteEqual=true·SHA 동일·Info/Producer/Creator/CreationDate/ModDate 동일·Poppler 두 쪽 SHA 동일. | 없음. |
| 8. F8 navigation | [통과] | 원본 focused en821: nav client523/scroll764, 링크5개 client=scroll=148. 보충 ko/en×320/390/820/821/1024/1440×active/start/end **36건 실패 0**, 실제 overflow와 fade 일치·직접 진입 active 가시. 순서/data 속성 유지. | 없음. 사용자가 끝으로 스크롤한 뒤 active가 밖으로 나가는 것은 정상이다. |
| 9. F9 계약 | **[결함]** | preset4표본·10pt/24pt/색·실제 PDF opacity0.9, ko/en 범위 밖 오류·300자 counter/초과 안내 통과. 일반/반복 확장자/빈 basename도 정상. **끝 공백 이름 4건은 실제 다운로드에서 `.pdf-마무리.pdf`/`.pdf-finished.pdf`가 남음.** | **R2 · P3**: source 이름을 trim/정리한 뒤 terminal 확장자와 기존 접미사를 제거하고 fallback을 판정한다. 300자 초과 *시도* 안내의 부정확한 현재 개수 문구도 정정. |
| 10. 시각 기준선 | [통과] | `git diff --name-only c8bff1f..ff0452b`와 고정 기대 목록: **정확히30**, 초과/누락0. F3/F8가 반영된 화면으로 재생성됐음을 캡처·원로그·이번 전체 비교로 확인. ko **203/203**, en **203/203**. 사본의 기준선203파일 변경0. | 없음. R1 같은 상호작용은 이 시각 표본에 포함되지 않음. |
| 11. 회귀·범위 | **[결함]** — 자동 게이트는 통과 | 45파일 +943/−140은 수리·관련 하네스·기록·30PNG 범위. tsc/unit301/build/static/PDF/전체 스모크/QR/recovery/legacy/a11y/CLS/bundle/CSS/registry/diff-check 모두 최종 통과. 보호 표면 diff0. 추가 정상 조작 반례 R1은 자동 스모크 밖에서 실패. | R1 재선택 회귀를 보강. 상한/기준선 완화로 해소하지 말 것. |
| 12. 기록 | [통과] — 새 발견은 후속 기록 필요 | [sol 원로그 감사](sol-log-audit.json): 원문34개·보관사본34개 모두 실존/SHA 동일. 수치 재현 일치. F9 확정 문안/반환 계약/1차 원로그 소실/selector 문서 인용 예외가 기록됨. | 다음 fix의 원인·수리·재검증에 R1/R2를 추가. 현행 기록을 새로운 반례까지 통과했다는 증거로 확대하지 않음. |

**R1 · P2 — 선택된 탭/위치를 다시 누르면 정상 입력도 만들 수 없다(F5 회귀)**

위치: [PdfFinishPanel.tsx:192](/home/better0101/projects/worklazytools/src/features/pdf-editor/PdfFinishPanel.tsx:192)의 `updateForm`, [사전 검사 effect:260](/home/better0101/projects/worklazytools/src/features/pdf-editor/PdfFinishPanel.tsx:260), [탭 클릭:345](/home/better0101/projects/worklazytools/src/features/pdf-editor/PdfFinishPanel.tsx:345), [위치 클릭:362](/home/better0101/projects/worklazytools/src/features/pdf-editor/PdfFinishPanel.tsx:362).

재현은 ko/en 각각 `/tools/pdf-editor/finish/`에 2쪽 정상 PDF 업로드 → 템플릿 `short` 입력 → preflight=ready·실행 활성까지 대기 → 이미 선택된 페이지 번호 탭 클릭이다. **1.5초 뒤에도 idle·실행 비활성, alerts=[]·routeError=0, 파일과 텍스트는 그대로**다. 템플릿을 `short2`로 바꾸면 다시 활성화되지만, 이미 선택된 아래 가운데 위치를 클릭하면 같은 문제가 발생한다. 양 언어 × 두 조작 **4/4 재현**.

```text
before: status=ready, disabled=false, alerts=[], file=review.pdf
after : status=idle,  disabled=true,  alerts=[], file=review.pdf
```

클릭 처리기가 값의 실제 변경 여부와 관계없이 `preflight`를 idle로 초기화한다. effect 의존성은 template/region/숫자/selection 등 실제 입력값이므로, 동일 선택에서는 새 검사를 예약하지 않는다. `preflightBlocked`는 계속 true다. 기다리는 것만으로 복구되지 않는 이유가 코드에서도 확인된다.

**수정 지시**: 선택값이 같은 탭/위치 클릭에서는 사전 검사 결과를 초기화하지 않는다. 실제 입력이 바뀔 때는 현재와 같이 즉시 실행을 막고 해당 입력의 검사를 다시 시작한다. 그 밖의 초기화 경로도 “idle 전환 뒤 검사가 반드시 다시 예약되는가”를 점검한다. ko/en에서 **검사 완료 후** 선택된 탭과 위치를 재클릭하고, 오류 없는 폼·실행 활성·실제 PDF 생성 가능을 단언한다. 유효/무효 입력 전환과 진행 중 취소 회귀도 유지한다.

증거: [보충 스크립트](probes/supplement-browser.mjs), [관측 `reselection`](supplement-browser.json), [실행 로그](logs/browser-supplement.log), [한국어 재클릭 화면](shots/supplement-ko-same-tab.png), [영어 재클릭 화면](shots/supplement-en-same-tab.png).

**R2 · P3 — 이름 끝 공백을 정리하기 전에 확장자를 제거해 F9 계약을 놓친다**

위치: [outputName.ts:15](/home/better0101/projects/worklazytools/src/features/pdf-editor/outputName.ts:15). `sourceName.replace(/(?:\.pdf)+$/iu, "")`를 먼저 하고 그 다음 `normalizeOutputName`의 trim을 적용한다. 따라서 유효 PDF의 파일명 끝에 공백이 있으면 확장자가 제거되지 않고 빈 basename 판정도 빗나간다. MIME `application/pdf`인 이 입력은 실제 업로드가 허용된다.

| 실제 입력 이름 | ko 다운로드 | en 다운로드 | 기대 |
|---|---|---|---|
| `  report.pdf  ` | `report.pdf-마무리.pdf` | `report.pdf-finished.pdf` | `report-마무리.pdf` / `report-finished.pdf` |
| ` .pdf ` | `.pdf-마무리.pdf` | `.pdf-finished.pdf` | `Worklazy-PDF-마무리.pdf` / `Worklazy-PDF-finished.pdf` |

순수 함수뿐 아니라 **Chrome 실제 생성 후 download 속성 4건**에서도 동일하다. 보통 이름·`report.pdf.pdf`·공백 없는 `.pdf`는 통과한다. PDF 내용 손상으로 확대하지 않는다.

또한 301번째 문자 입력 시 native 제한으로 실제 값과 counter는 **300/300**인데, 양 언어 안내의 두 번째 문장은 “현재 글자 수가 제한을 넘었습니다”/“The current count exceeds the limit.”이다. 한도 안내 자체는 존재하지만 현재 상태를 잘못 설명한다.

**수정 지시**: source 이름을 기존 관례대로 trim/정리한 뒤 반복 terminal `.pdf`와 기존 마무리 접미사를 제거하고, 마지막으로 빈 basename의 현지화 fallback을 적용한다. 일반 이름·반복 확장자·끝 공백·빈 이름을 ko/en 기대값으로 고정한다. native 300자 제한은 유지하고 초과 안내는 **입력 시도가 한도를 초과했으며 현재 반영된 내용은 300자 이내**라는 문안으로 바꾼다. 새 SEO 설명은 필요하지 않으며 catalog·기대값·기록을 함께 정정한다.

증거: [함수 경계값](output-name-edge.json), [엔진 보충](supplement-engine.json), [실제 다운로드 `outputNames` 및 `limits`](supplement-browser.json).

**통과한 수리의 실측 범위**

F5 원래 요구는 확인됐다. `A😀Z`는 1행2열, `ok\nABC\u0001DEF`는 2행4열, `ok\nAB{date:foo}`는 2행3열로 ko/en 필드 오류가 붙고 실행 전에 차단된다. `A𠮷😀`의 엔진 missing 위치는 scalar 2·3열이다. 없는 문자·제어문자·날짜 형식·좁은 영역·무효 여백을 구별한다. `W`200개, 75줄, `Русский`, `{unknown}`은 생성 전에 각각 말줄임·줄 생략·약3.8MB·리터럴 유지 경고를 표시하며 유효 출력은 활성이다. 변조한 동일 크기 OTF도 각 언어 요청1회·현지화 오류·실행 비활성·다운로드0으로 거부했다. [브라우저](supplement-browser.json), [엔진](supplement-engine.json).

F3의 1차 loaded24건과 보충48건은 서로 다른 표본이다. 원본 표본의 최대 중앙 오차 0.0078125px·최대 종횡비 오차 0.000009574, 보충 표본은 중앙/종횡비/wrapper 오차0·canvas 내부48/48이다. 원본4모드 helper는 수정되지 않았다. [치수](visual-metrics.json), [48조합](supplement-browser.json), [영어 모바일](shots/focus-en-header-footer-390-light.png), [한국어 다크](shots/focus-ko-header-footer-390-dark.png), [가로형 아래 가운데](shots/supplement-ko-light-landscape.pdf-bottom-center.png). QA 직접 진입24장·업로드24장과 집중/보충 캡처를 생성했고, 대표 모바일/데스크톱·light/dark·가로형·821px 및 회전 출력 이미지를 직접 열어 확인했다. 전체 긴 panel 캡처의 고정 navigation 위치는 촬영 방식의 결과이며 실제 미리보기의 canvas 치수는 별도 DOM 실측으로 판정했다.

F4 원본24건은 회전×6영역의 위치/upright 회귀다. 보충4건은 경계 밖 CropBox의 네 회전이다. PDF.js transform과 Poppler bbox·텍스트/빨간 픽셀을 함께 확인했다. [원본 engine](engine-results.json), [보충 engine](supplement-engine.json), [회전90 Poppler](boundary/rotation-90-1.png). 원본에 포함된 UserUnit=2 추가 표본은 양 렌더러의 전체 픽셀 동등성 계약으로 확대하지 않는다.

F6 원본의 취소 지점은 정확히 **두 번째 reading 진행 이벤트 직후·arrayBuffer 호출 전**이다. 그 반례에서 다음 read0·부분 결과1을 재현했다. 보충은 실제 두 번째 arrayBuffer 안에서 await 뒤 abort한 경우까지 검사했다. 첫 PDF를 재개방하고 세 번째 파일 read0을 확인했다. 반환 배열 계약은 유지되고, 완료 결과가 있는 취소 rejection에 `partialResults`를 공개한다는 문안이 보고·review-notes에 있다. U4-8의 다중 업로드 UI/ZIP을 요구하지 않았다.

F7은 원본 QR probe 파일 SHA **`224b7695a6075948f3ecdbfdacf78db2fbfe86a9c61c9ebb361fe5c22c5541ba`**를 그대로 실행했다. `2026-09-05T03:00:00Z` 고정 시각에서 subset/full의 `/Info 3 0 R`, Producer/Creator, CreationDate/ModDate와 두 쪽 Poppler SHA가 전부 복원됐다. [byte 비교](qr-byte-compare.json), [원본 실행 출력](logs/qr-original-rerun.log). QR bulk/font-render 통과를 byte 동일성의 대체 근거로 쓰지 않았다.

F8 en821은 nav client523/scroll764이며 active·start에서는 오른쪽 fade, 끝에서는 왼쪽 fade가 보인다. 각 링크 client/scroll148로 레이블 잘림·겹침이 없고, 36개 표본의 cue/active/overflow 검사 실패0이다. [원본 focused](focused-visual.json), [보충 치수](supplement-browser.json), [821px 캡처](shots/focus-en-nav-821.png). 순서는 organize→finish→image-to-pdf→pdf-to-image→convert다. 원본 selection/history 골든도 URL/history 불변과 `2-8+even → 3쪽 toggle → 2-4,6,8/all`을 재확인했다.

**시각 기준선·범위·기록 대조**

30장 기대 목록은 현행 glob 결과에서 만들지 않고, 고정된 두 탭×두 언어×두 테마×두 화면16장, nav3상태×두 언어×두 모바일12장, 지정된 기존 PDF 모바일2장으로 만들었다. 실제 diff와 완전히 같다. **203개 기준선의 검수 사본도 원본과 byte 동일**하므로 이번 검수의 baseline update는0이다. [기대/실제 전체 목록](scope.json), [diff stat](diff-stat.txt), [baseline 불변](invariance.json).

sol의 `06-astra-engine-probe` 수리 결과, `07-visual-baseline-update`의 28장 생성, `20-visual-ko`의 기존 모바일2장 실패, `21-visual-existing-pdf-update`, `22/23` 최종 통과, `32` 기존 PDF 집중 재확인을 대조했다. F3/F8가 실제 반영된 기준선 화면과 이번 재현의 일치가 갱신 상태의 근거다. 실패 로그도 보존돼 있고, 실행시간 문자열만 바뀐 비제품 interaction2장을 복원했다는 기록은 최종30장 목록과 일치한다. [34개 로그 감사](sol-log-audit.json).

이번 전체 시각 결과는 ko **7분21.43초**, en **7분26.25초**, 합 **14분47.68초**다. shell 전체 합도889.693초로20분 안이다. pixel threshold0.1, 다른 픽셀 비율≤0.1%, AA 무시 및 기존 footer 허용 규칙을 그대로 쓴 통과이며 모든 픽셀이 정확히 같다는 의미는 아니다. [ko](logs/visual-ko.log), [en](logs/visual-en.log).

[실제45경로](scope.json)를 개별 대조했다. 범위는 PDF finish/공용 font create 옵션/기존 normalizeOutputName의 동일 함수 추출/관련 검증·기록이다. 기존 normalize 함수의 본문은 그대로이며 `pdfUi.tsx`에서 재수출한다. 복구 하네스의 추가는 포트를 명시적으로 받기 위한 것이다. 기존 PDF 패널3개·PdfThumbnail·pdfPreview·pdf.worker·pdfWorkerClient·공용 lifecycle/cooperativeCancel·Excel·legacy oracle·package/lockfile은 **diff0**다. 기존 locale 값도 `pdf.finish` 밖 변경0. [scope](scope.json), [source diff](source.diff).

repository의 실행 가능 확장자 후보를 재귀 조사하고 변경된 오류 전달 경로를 검토했다. UI는 분류된 오류를 ko/en catalog로 바꾸며 raw message는 검사 오류 분류와 취소 객체 내부 전파에만 쓴다. 테스트/문서/생성·vendor는 제품 UI 실행 경로와 구별했고, vendor는 고정 산출물 예외다. 새 사용자 오류 문구에 내부 code·Worker·원시 예외를 표시하지 않는다. repo-wide 광고 허용목록 unit도 통과했다. navigation selector literal은 `docs/review-notes.md:84`의 문서 인용 **1건**, 실행 경로0이며 이 예외의 기록 소유자는 Codx다. [후보 목록](raw-candidates.json), [selector 실측](scope.json).

production static 검증은67페이지/startup113문서를 통과했다. production finish3경로에서 광고 loader 각1회 요청을 확인하되, 외부 요청은 빈 응답으로 intercept했으므로 실제 광고 경매/노출 성공을 주장하지 않는다. QA의 a11y·CLS·원본/보충 브라우저 외부 요청은0이다. [광고 표본](ads-production.json), [a11y](a11y.json), [CLS](rendering.json). route·SEO·정적 페이지·광고 격리 코드는 이번 fix에서 변경되지 않았다.

**번들·공통 게이트**

고정 `/tmp/s3-bundle-baseline.json`, `BUNDLE_ROUTES=pdf-editor`, override `{}`, multiplier1을 유지했다. QR→shared **509,380B 이동**을 실제 순증분과 분리했다. [번들 원문](bundle-pdf.json).

| gzip 지표 | 순증분 B | 고정 상한 B |
|---|---:|---:|
| entry JS | 4,837 | 20,480 |
| PDF route JS | 13,753 | 61,440 |
| shared JS | 2,066 | 30,720 |
| app JS | 21,109 | 81,920 |
| CSS | 118 | 10,240 |

a11y11페이지 위반0, 자체 업로드4표본 위반0. CLS는6대상×3회, 기존3대상0·finish3경로 각각 최대 **0.0001480365514755249≤0.1**. CSS orphan0, legacy manifest155/153removed/0split/2active, registry20, unit301/301 fail·skip0, legacy oracle client3/structure4/render32/output4/input1의 총diff0. 관련 원출력과 실행시간은 아래 전 실행표에 남긴다.

**재현 방법·환경 실패 구분**

`repo`와 고정 main은 git archive 사본이며 의존성·vendor·.git도 독립 복사했다. main의 node_modules symlink는 **같은 review2 사본** 안으로만 연결된다. 원본1차 스크립트 파일을 보존하기 위해 bwrap 내부에서만 review2 디렉터리를 `/tmp/worklazy-u4-3-review` 경로에 연결했다. QR/engine 파일은 source byte 무수정이며, browser/focused 사본은 4283→4250 포트만 바꿨다. sol 드라이버는 판정에 사용하지 않았다. [원본 SHA 시작](original-probe-sha-start.json), [종료](original-probe-sha-end.json), [browser 포트 diff](browser.mjs.port-only.diff), [focused 포트 diff](focused-browser.mjs.port-only.diff).

```bash
cd /tmp/worklazy-u4-3-review2/repo
export NODE_OPTIONS=--max-old-space-size=4096
bwrap --bind / / --dev /dev --proc /proc \
  --bind /tmp/worklazy-u4-3-review2 /tmp/worklazy-u4-3-review \
  --chdir /tmp/worklazy-u4-3-review/repo \
  node --experimental-strip-types /tmp/worklazy-u4-3-review/probes/qr-compare.mjs
```

같은 명령의 마지막 파일을 `engine.mjs`로 바꾸면 원본 engine을 재현한다. browser/focused는 먼저 아래 preview를 별도 터미널에서 실행한 뒤 같은 bwrap 방식으로 실행한다. `repo/dist`는 QA 빌드다.

```bash
cd /tmp/worklazy-u4-3-review2/repo
NODE_OPTIONS=--max-old-space-size=4096 node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4250 --strictPort
```

```bash
cd /tmp/worklazy-u4-3-review2/repo
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-u4-3-review2/probes/supplement-browser.mjs
NODE_OPTIONS=--max-old-space-size=4096 node --experimental-strip-types /tmp/worklazy-u4-3-review2/probes/supplement-engine.mjs
```

최초 namespace 준비에서 `/dev`·`/proc` 구성을 빠뜨려 Poppler/Chrome의 stdio 초기화가 EACCES로 실패한5개 실행을 보존했다. `--dev /dev --proc /proc`를 추가해 각각 다시 실행했고 모두 완료했다. 제품 소스나 기준선을 고친 재실행이 아니다. 선택적으로 추가한 최초 광고 probe는 원본의 `listen(0)` 때문에 자동 포트를 잠시 할당한 뒤 Chrome 기동 전에 실패했다. 이 최초1회는 지정 포트 조건을 충족했다고 기록하지 않는다. 이후 사본에서 **포트만4252로 고정**해 재실행했다. 성공한 검증은 Vite4250 `--strictPort`, recovery4251·광고4252의 fallback 없는 정확 bind를 썼다. 현재 검수 서버는 전부 종료했다.

원본 browser의 `validation-*`3건은 이제 실행 전에 차단돼 옛 “실행 후 pdf-error/download 대기”가 timeout된다. font-asset 원본도 사전 차단된 버튼을 클릭하려다 timeout된다. 이 네 건을 제품 실패나 통과로 잘못 집계하지 않고 그대로 남겼다. 별도의 자체 보충 검사로 동일 입력의 사전 오류·위치·버튼 상태 및 변조 글꼴 거부를 기록했다. 원본 스크립트의 종료0만으로 합격을 선언하지 않았다.

반복된 PDF.js standardFontDataUrl/Poppler OTF 경고와 new-tools의 기존 Dolby Vision host capability skip은 원로그에 있다. 이번 검수에서 GS tofu 교정·QR selector 정책·미구현 watermark/stamp·다중 ZIP은 요구하지 않았다.

**실행 원출력 표**

| 실행 이름 | exit | 초 | 원출력 |
|---|---:|---:|---|
| tsc | 0 | 20.170 | [log](logs/tsc.log) |
| unit | 0 | 4.731 | [log](logs/unit.log) |
| build-production | 0 | 104.848 | [log](logs/build-production.log) |
| static-production | 0 | 0.916 | [log](logs/static-production.log) |
| engine-original | 1 | 0.902 | [log](logs/engine-original.log) |
| qr-original | 1 | 1.951 | [log](logs/qr-original.log) |
| pdf-finish | 0 | 114.335 | [log](logs/pdf-finish.log) |
| browser-pdf | 0 | 10.065 | [log](logs/browser-pdf.log) |
| browser | 0 | 52.572 | [log](logs/browser.log) |
| new-tools | 0 | 115.917 | [log](logs/new-tools.log) |
| utilities | 0 | 100.541 | [log](logs/utilities.log) |
| office | 0 | 25.179 | [log](logs/office.log) |
| excel-cleaner | 0 | 51.788 | [log](logs/excel-cleaner.log) |
| excel-compare | 0 | 20.582 | [log](logs/excel-compare.log) |
| qr-bulk | 0 | 48.411 | [log](logs/qr-bulk.log) |
| qr-font-render | 0 | 38.734 | [log](logs/qr-font-render.log) |
| recovery | 0 | 277.927 | [log](logs/recovery.log) |
| legacy-oracle | 0 | 4.875 | [log](logs/legacy-oracle.log) |
| ads-production-original | 1 | 0.484 | [log](logs/ads-production-original.log) |
| visual-ko | 0 | 442.420 | [log](logs/visual-ko.log) |
| visual-en | 0 | 447.273 | [log](logs/visual-en.log) |
| bundle | 0 | 75.768 | [log](logs/bundle.log) |
| css-orphans | 0 | 0.628 | [log](logs/css-orphans.log) |
| legacy-manifest | 0 | 0.357 | [log](logs/legacy-manifest.log) |
| registry | 0 | 0.525 | [log](logs/registry.log) |
| build-qa | 0 | 101.687 | [log](logs/build-qa.log) |
| a11y | 0 | 32.573 | [log](logs/a11y.log) |
| rendering | 0 | 77.542 | [log](logs/rendering.log) |
| browser-original | 1 | 0.652 | [log](logs/browser-original.log) |
| focused-original | 1 | 0.655 | [log](logs/focused-original.log) |
| engine-original-rerun | 0 | 4.639 | [log](logs/engine-original-rerun.log) |
| qr-original-rerun | 0 | 6.401 | [log](logs/qr-original-rerun.log) |
| engine-supplement | 0 | 1.791 | [log](logs/engine-supplement.log) |
| browser-original-rerun | 0 | 236.723 | [log](logs/browser-original-rerun.log) |
| focused-original-rerun | 0 | 11.714 | [log](logs/focused-original-rerun.log) |
| browser-supplement | 0 | 146.221 | [log](logs/browser-supplement.log) |
| ads-production-original-rerun | 0 | 4.231 | [log](logs/ads-production-original-rerun.log) |

**종료 판정: [수정 후 재검수] — R1(P2)·R2(P3) 수리와 해당 회귀 검증 필요.** 이번 잡은 검수 보고와 `/tmp` 실험 산출물만 작성했으며, 원본 추적 파일 수정·커밋·push·브랜치 전환을 수행하지 않았다. — Codx
