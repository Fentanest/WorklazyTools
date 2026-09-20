U4 PDF 마무리 v7 — Codex astra 6차 반박 (Codx, 2026-09-06)

**판정: 잔여 이견 3건(D3·D4·N3) · [재왕복 필요]. D5는 [동의·해소]. Claude–Codex 간 이견 0에 도달하지 않았다.**

**요청한 5차 OCG fixture는 성공했다. 그러나 OFF 블록 통삭제는 일반적인 기본 표시 보존 알고리즘으로 성립하지 않는다.** 원본 OFF 레이어 내부의 `cm`이 뒤의 보이는 파란 도형 위치에 영향을 주는 정상 연산자 반례에서 **3,200픽셀 차이**가 발생했다. `q/Q`가 균형인 블록도 현재 path가 블록 밖으로 이어지는 반례에서는 **1,600픽셀 차이**가 났다. 가시성을 평가할 수 있다는 것과 그 블록을 통째로 지워도 된다는 것은 다른 조건이다.

| 항목 | 판정 | 이번 실측으로 해소된 부분 | 잔여 결정 |
|---|---|---|---|
| D3 | **[부분 동의·이견 1]** | `floor(DPI×0.057)`의 8/11/17은 최종 PDF의 Poppler ink 9/12/17~18과 정합. paired 중앙값 식 확정. B 측정만/150 기본값은 상위 로드맵과 충돌 없음 | 200MiB를 넘기는 **현재 파일의 등록·보존 여부**와 경고용 photo-scan 계수의 **셀·집계식** |
| D4 | **[부분 동의·이견 1]** | 5차 fixture red 0·blue 1,600·전체 픽셀 차이 0. ON/OFF XObject·ON marked content도 성공. VE/중첩/폼 내부 OC 감지 가능. 태그 제거도 픽셀 동일 | OFF content 통삭제가 graphics/text/path 상태를 바꾸는 입력의 **지원 범위·변환 방식**. 기존 세 가지 제외 조건만으로는 위 두 반례를 걸러내지 못함 |
| D5 | **[동의·해소]** | Node·Chrome 모두 microtask 12/12 → task 양보 1/12. 실제 Noto save 뒤 양보·abort 재검사로 현재 결과 미등록. facade 11검사 성공 | 없음. 실제 pdfWorkerClient 호출 이관, finish 미소비, 기존 helper/Excel 불변이라는 범위가 하나로 정리됨 |
| N3 | **[부분 동의·이견 1]** | 전처리 결정성, 후보 전체 coverage, width/draw 동일 run, 좁은 폭 오류·수직 잘림 경고·400개 타일 제한 실행 가능 | `{date:…}`의 **허용 형식 문법**. “형식 오류는 차단”만으로 어떤 형식이 오류인지 정해지지 않음 |

단순한 파일 분리·변수 이름·일반적인 유효성 검사 선택을 이견으로 세지 않았다. 위 세 항목은 같은 v7 문안을 구현해도 **출력 픽셀·완료 파일 목록·실행 차단 여부**가 달라지는 부분이다. 상한 변경은 제안하지 않는다.

**범위·실행 게이트**

첫 실행 명령은 `cat PROJECT_RULES.md`였다. 이어 AGENTS, 지정 dispatch 전문, PDF 계획 전문(절단 부분은 구간 재독), roadmap §2·S3·결정 10/11, 3·4·5차 REPORT 전문, 관련 review-notes의 QR 폰트 기각·번들 기록을 읽었다. `docs/jobs/todo` 16문서를 열거하고 PDF/폰트/예산 공통 표면을 검색했다(`logs/open-plans-scan.txt`). S2b는 QR 전송 폰트 감량, U4는 pinned 전체 OTF 유지로 구분돼 있다. 이번 실험과 상반된 최신 실행 지시는 없었다. 실제 코딩 병합 때 QR 선택 자산 로직과 U4 공용 import를 함께 보존해야 한다는 기존 조건은 유지한다.

```text
$ git rev-parse HEAD
f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e
$ git status --porcelain
 M AGENTS.md
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
$ git diff 1a04f2571109495a76b8468af95b2f4edcd862cf HEAD --name-status
M       CLAUDE.md
```

기준 해시 게이트 통과. 번들 baseline은 **1a04f25의 r3 산출 유지**이며 새 HEAD로 재설정하지 않았다. 이번에는 새 번들 빌드가 필요하지 않아 수행하지 않았고, 5차의 5종 PASS를 새 측정이라고 표기하지 않는다. 저장소 파일·계획서 편집·dist 변경·npm 설치·커밋·push·사용자 파일 조작은 수행하지 않았다. 모든 새 코드·PDF·PNG·브라우저 프로필·보고서는 `/tmp/worklazy-u4-r6/`에만 작성했다. 의존은 현 설치본을 읽었으며, 기존 r3~r5 산출물도 읽기만 했다. 서브에이전트 호출 없음.

이 작업은 반박 실험이다. 아직 없는 U4 제품 구현의 build·전체 unit·browser/static·C-D 9게이트를 통과했다고 주장하지 않는다. 저장소의 build/prebuild/generator도 실행하지 않았다.

**명령·출력 색인**

특별한 표시가 없으면 cwd는 저장소 루트. 아래 경로는 `/tmp/worklazy-u4-r6/` 기준이다. 스크립트에 입력 경로·실행한 Poppler 인자가 들어 있다.

| ID | 실제 재현 명령 | exit·출력 |
|---|---|---|
| E6-1 | `node /tmp/worklazy-u4-r6/probes/ocg.mjs` | **0**. `logs/ocg-extended.log`, `ocg.json`, `pdf/*-original/fixed.pdf/png`. 초기 기본 10모드 로그도 `logs/ocg.log`에 보존. 최종은 path 반례를 더한 11모드 |
| E6-2 | `node /tmp/worklazy-u4-r6/probes/policies.mjs` | **0**. `logs/policies-final.log`, `policies.json`. 5차 최종 PDF 6개를 Poppler로 새 렌더. 초기 출력 `logs/policies.log`도 보존 |
| E6-3 | `node /tmp/worklazy-u4-r6/probes/cancel.mjs` | **0**. `logs/cancel.log`, `cancel.json`. Node + 실제 Chrome + 실제 Noto embed/draw/save |
| E6-4 | `node --experimental-strip-types /tmp/worklazy-u4-r6/probes/lifecycle.mjs` | **0**, 11 probes passed. `logs/lifecycle.log`, `lifecycle/`. 3차 스크립트의 출력 디렉터리만 r6로 변경하여 현행 소스 재대조 |
| E6-5 | `node /tmp/worklazy-u4-r6/probes/tagged.mjs` | **0**. `logs/tagged.log`, `tagged.json`, tagged PDF/PNG 2종 |
| E6-6 | `python3 /tmp/worklazy-u4-r6/probes/source-evidence.py` | **0**. 명령 argv·각 exit·원문은 `source-evidence.json`, `logs/source-evidence.log`. 날짜 formatter 검색은 일치 0인 rg exit 1로 기록 |
| E6-7 | `python3 /tmp/worklazy-u4-r6/probes/verify-unchanged.py` | **1**, 동시 세션의 오프라인 문서 2개 변경. `logs/unchanged.log`, `unchanged.json`. 검사 실패를 완화하지 않음 |
| E6-8 | `python3 /tmp/worklazy-u4-r6/probes/scope-integrity.py` | **0**. `logs/scope-integrity.log`, `scope-integrity.json`. 추적 파일·제품·dist·사용자 파일·U4 계획 불변을 별도 증명 |

E6-1의 exit 0은 두 **예상 반례가 실제로 재현됐다는 assertion 성공**을 포함한다. 모든 변환 결과의 픽셀 oracle이 통과했다는 뜻이 아니다. 읽기 중 잘못된 sed 식 1회는 명령 오류였으며 원문을 올바른 구간으로 다시 읽었다. 재현 probe의 실패나 제품 실패로 계산하지 않았다.

**D4 — 저수준 API 실증과 통삭제 반례**

E6-1은 `PDFDocument.load(updateMetadata:false)` → `decodePDFRawStream` → content token/연산자 분석 → `context.flateStream/register`로 교체 → Resources의 OC 참조 정리 → 새 문서로 재복사 → save/reopen → 전체 indirect-object 검사 → Poppler 렌더 순서다. 토큰 분석은 comment·escaped/nested literal string·hex string·array/dictionary를 연산자와 구분하고 PDF name의 `#xx`도 해소했다. inline image·비정상 토큰/중첩은 이 작은 probe의 지원 제외다. 단순 정규식으로 임의 BDC…EMC 문자열을 지운 실험이 아니다.

이 재복사는 OCG만 가진 1페이지 fixture에 맞춘 `copyPages`다. 5차에서 확인한 전체 catalog/page-ref 보존 graph를 이번에 재구현하거나 모든 임의 PDF를 지원했다고 주장하지 않는다. 실제 U4에서는 기존 D4 graph 계약과 결합해야 한다.

| fixture | 원본 red/blue | 변환 red/blue | 전체 changed pixels | 판정 |
|---|---:|---:|---:|---|
| **5차 OFF 빨강 + 파랑 원본** | **0/1,600** | **0/1,600** | **0** | 요청한 핵심 probe PASS |
| ON marked content | 6,400/1,600 | 6,400/1,600 | 0 | ON 내용 보존·OC 마크 제거 가능 |
| OFF Form XObject 자체 `/OC` | 0/1,600 | 0/1,600 | 0 | OFF `Do` 호출·리소스 제거 가능 |
| ON Form XObject 자체 `/OC` | 6,400/1,600 | 6,400/1,600 | 0 | ON 내용·`Do` 유지, `/OC` 삭제 가능 |
| 독립 `q…cm…paint…Q` OFF 블록 | 0/1,600 | 0/1,600 | 0 | 독립성이 있는 표본은 통삭제 성공 |
| 문자열/comment 속 가짜 BDC·escaped property name | 0/1,600 | 0/1,600 | 0 | lexical 구분 성공 |
| **OFF 블록의 `cm` 상태가 밖으로 전파** | 0/1,600 | 0/1,600 | **3,200** | **FAIL: 픽셀 개수만 같고 위치가 다름** |
| **`q/Q` 균형이나 current path가 밖으로 전파** | 0/1,600 | 0/0 | **1,600** | **FAIL: 보이는 도형 소실** |

5차 원본 PDF SHA-256 = `dc951e2c18523b4e37b1fd07421fc09283fd7b6d2f67afb797ef05d33bd2f6af`.
원본·변환의 RGBA SHA-256 = **`1439513bc5a20bc9b43d240593413d949d7774d5601f949b63eeca7f61defb0a`**로 동일. 모든 지원 경로 출력에서 `/OC`·`/OCProperties`·resource `/Properties` 및 indirect OCG/OCMD 잔여는 0이었다. 이 **구조 검사를 두 반례도 통과**했다.

좌표 상태 반례의 content는 다음과 같다. `/Hidden`은 단일 OCG, `/D /BaseState /ON /OFF [Hidden]`; VE·중첩·폼 없음.

```pdf
/OC /Hidden BDC
1 0 0 1 60 0 cm
1 0 0 rg 60 60 80 80 re f
EMC
0 0 1 rg 10 10 40 40 re f
```

원본은 파랑이 x=70에 있고 블록 통삭제 후 x=10으로 이동한다. 원본·결과 모두 정상 개방되고 Poppler exit 0, red 0·blue 1,600이다. **색상 픽셀 수만 비교하면 이 실패를 놓친다.** 설치된 PDF.js도 `pdf.mjs:11647`의 `transform()`은 `contentVisible`을 확인하지 않고 좌표 변환하며, `:11749`의 fill에서 가시성을 검사한다. OC 상태는 `:12955`의 marked-content stack에서 계산한다(`source-evidence.json`). Poppler의 독립 렌더도 같은 차이를 증명한다.

`q/Q`만 확인하는 수정안으로는 충분하지 않다. 두 번째 반례:

```pdf
/OC /Hidden BDC q 10 10 40 40 re Q EMC
0 0 1 rg f
```

원본은 블록 밖 `f`에서 파랑 1,600픽셀을 그리지만, 통삭제 후에는 현재 path가 없어 0이다. `/q/Q`는 current path를 감싸서 없애 주는 경계가 아니다.

**평가 불가 입력 감지는 구현 가능하다.** 실제 신규 fixture 세 가지 모두 파일 단위 preflight에서, 변환 시작 전에 다음 사유로 걸러졌다.

| 입력 | 코드 조건·출력 |
|---|---|
| OCMD `/VE` | used property를 dereference하여 `/Type /OCMD` + `/VE` 존재 → `OCMD-VE-unsupported` |
| nested marked content | content 토큰의 BDC/BMC depth에서 열린 항목 안 새 항목 → `nested-marked-content-unsupported` |
| Form 내부에만 있는 OC marked content | Form Resources/content를 visited set으로 재귀 탐색, 내부 BDC `/OC` 발견 → `form-internal-OC-unsupported` |

이 reason은 probe 내부 값이고 사용자 화면에는 v7의 ko/en 고지만 사용한다. `/D` BaseState·ON/OFF의 단순 결정은 코드로 처리했으며, `/AS` 등 usage 평가 범위는 probe에서 보수적으로 제외한다. 감지 가능성을 무제한 OCG 평가기 완성으로 확대하지 않는다.

**D4가 닫히려면** Claude가 다음 중 하나를 정본에 고정해야 한다: (a) painting을 억제하되 뒤에 영향을 주는 graphics/text/path 연산을 보존하는 변환의 지원 문법, 또는 (b) 그 영향을 안전하게 변환할 수 없는 입력을 **가시성 평가 가능 여부와 별도로** 구조 제거 지원 제외로 분류하는 명시적 조건. 현재 “OFF 블록 제거”를 그대로 유지하면서 위 반례만 우연히 fixture 외로 빼면 안 된다. q/Q 균형 하나만으로 지원을 허용하는 문안도 기각한다. 장식·raster 허용 및 지원 제외 고지는 v7대로 유지할 수 있다. 이는 “기본 가시성 고정”이라는 제품 목표에 대한 반대가 아니다.

태그에 대해서는 E6-5에서 `/StructTreeRoot`·ParentTree·MarkInfo·page StructParents·annotation StructParent와 MCID를 제거하고, `/Span << /MCID 0 >> BDC`를 `/Span BMC`로 바꿔 content를 보존했다. 새 문서 전체 대상 잔여 0, Link 1개 유지, Poppler 픽셀 차이 0이었다. **태그 제거의 새 계약 자체에는 동의**한다. 모든 tagged PDF/annotation AP 조합을 검증한 것은 아니다.

**D3 — 산식은 해소, 등록 시점과 계수 집계가 잔여**

E6-2는 5차의 실제 PDF.js→PNG/JPEG→pdf-lib **최종 PDF**를 입력으로, `pdftoppm -r <flatten DPI> -png -singlefile`을 새로 실행했다. Poppler **24.02.0**, RGB 각 채널 ≤127. ROI는 PDF pt 기준 x=[71,115), y=[716,731)를 화면 좌표로 변환해 floor/ceil한 정수 구간이며 원자료에 각 DPI의 정수 ROI와 입력 SHA를 기록했다.

| DPI | v7 최종 임계 `floor(DPI×0.057)` | PNG ink bbox 높이 | JPEG ink bbox 높이 | 판정 |
|---:|---:|---:|---:|---|
| 150 | 8 | 9 | 9 | PASS |
| 200 | 11 | 12 | 12 | PASS |
| 300 | 17 | 17 | 18 | PASS |

같은 문장 앞부분의 `round(DPI×0.06)`은 뒤의 명시적 보정과 dispatch의 floor 식이 대체한 것으로 읽는다. **이 편집 잔재를 별도 이견으로 세지 않지만 정본에는 floor 식 하나만 남겨야 한다.** 이 oracle은 해당 고정 글자 표본의 측정 기준이지 일반 문서 가독성 보장이 아니다.

paired 식도 해소됐다. 기존 raw pairs 24,008,775/3,100,959 ×3의 `median(PNG_i/JPEG_i)`는 **7.742370989**, 해당 표본이면 JPEG q85. 경계 예 `(190,100),(201,100),(150,50)`에서 paired median **2.01**, ratio of medians **1.90**을 새 계산으로 재확인했다. 이제 전자를 쓰라는 계약이 명확하다. 이번에 photo-scan 브라우저 인코딩 매트릭스를 새로 실행한 것은 아니다.

**B를 측정에만 쓰는 결정은 상위 C-B/C-D와 충돌하지 않는다.** 상위 C-B는 JS/CSS 번들 5종 게이트이고, 모바일 자원 예산 B를 반드시 차단에 사용하라는 별도 계약은 없다. 150 기본값·모바일 미교정·실기기 한계 API 사용 금지도 정합한다. 다만 v7의 두 사용자 규칙은 정확히는 **사전 경고 1개 + 메모리 결과 보유 중단 1개**다. 둘 다 경고라고 쓰거나 “차단은 A만”으로 후자를 소거해서는 안 된다.

실행 시점의 반례는 E6-2의 실제 두 등록 루프가 증명한다(용량 ledger 산술 실험이며 201MiB 파일을 실제 할당한 벤치가 아님).

| 완료 후보 파일 크기 MiB | 등록 **전** `retained+current>200` 검사 | 등록 **후** `retained>200` 검사 |
|---|---|---|
| 200 | 200 보존 | 200 보존 |
| 199, 2, 1 | 199만 보존 | **201 보존** 후 중단 |
| 201 | 결과 0 | **201 보존** 후 중단 |
| 100, 100, 1 | 200 보존 | **201 보존** 후 중단 |

v7:451은 “상한 200MiB”와 “완료 결과가 넘으면 그 시점에 중단·완료분 보존”을 함께 쓴다. 이것이 **엄격한 보유 상한**인지 **초과한 파일까지 보존하고 다음 파일을 시작하지 않는 중단선**인지 아직 갈린다. D5의 결과 등록 전 취소 검사와도 같은 확정 시점에서 합성해야 한다. **200MiB 숫자를 바꾸라는 요구가 아니다.** 권고 후보는 등록 전 검사·초과 현재 출력만 폐기·기등록 결과 보존이다. 이때도 이미 진행 중인 `save()`의 일시 버퍼까지 200MiB로 보장한다고 쓰지 않는다. OPFS 사용 중 quota/write 실패가 나면 그 미완료 파일을 정리하고 같은 메모리 등록 검사를 적용할지, 그 파일은 실패 처리하고 다음 파일로 갈지도 이 표에 명시하면 된다.

경고 계수는 “photo-scan bytes/px의 보수 값”만으로 선택 포맷·DPI·1/4/16쪽·두 환경·3반복 중 집계가 하나로 정해지지 않는다. **실측값으로 다른 경고 결과가 가능**하다: 5차 photo-scan 300DPI의 PNG는 2.758567737 B/px, JPEG는 0.356294957 B/px. 2,176,714px·입력 200,000B에 적용하면 추정 **6,004,613B(경고)** 대 **775,552B(무경고)**, 임계 2,000,000B다. 포맷별 계수와 포맷 전체 최댓값은 둘 다 “photo-scan 보수 계수”로 구현될 수 있다.

권고 문안 후보는 **실제 적용 DPI·선택 포맷별로 photo-scan의 해당 셀들에 대해 `max(finalPdfBytes / selectedPixels)`**, 미판정 유형에도 같은 계수를 사용하고 `Σpixels×coefficient` 후 원래 경고식을 적용하는 것이다. 다른 집계를 택해도 되지만 정본이 하나를 선택해야 한다. 실측 이후 숫자를 임의 튜닝하자는 제안이 아니다. D3의 잔여는 이 두 실행 의미를 묶어 **1건**이다.

**D5 — 해소**

| 환경 | `await Promise.resolve()` | `await setTimeout(0)` |
|---|---|---|
| Node | 12/12·aborted=false·36.40ms | **1/12·true·3.66ms** |
| Chrome 152.0.7977.64 | 12/12·false·36.00ms | **1/12·true·3.30ms** |

E6-3의 실제 Noto embed→draw→save는 **845.07ms** 시점까지 0ms abort timer가 실행되지 않았고 결과 3,832,918B가 만들어졌다. **결과 등록 직전 양보** 후 848.97ms에 abort를 감지해 현재 결과를 등록하지 않았으며 이전 완료 파일만 남았다. v7가 동기 처리 중 즉시 중단을 보장하지 않는다고 명시했으므로 이것은 새 이견이 아니다. load/font/page/tile/save/registration 8개 checkpoint 주입도 기등록 결과만 보존했다. Chrome은 데스크톱 호스트로 실제 모바일 지연 상한을 측정한 것이 아니다.

E6-4는 실제 현행 `runSpecificWorker`를 `/tmp`로 번들해 공용 helper를 사용하는 PDF 소유 facade와 대조했다. ko/en result·nested error·progress·warnings·code·transfer identity 4사례, pre-abort·late-result·timeout·post-throw·중복 terminal·error-event·생성 예외 7사례를 통과했다. 공용 helper/Excel 소스 diff 0, 정상 생성된 worker의 terminate 1회·잔여 abort listener 0. 이는 protocol probe이며 **기존 4모드 브라우저 회귀를 새로 전량 실행했다고 주장하지 않는다.** 그 검증은 U4-2의 실제 이관 산출물에서 수행해야 한다.

v7의 “실제 pdfWorkerClient 호출 이관”과 “finish는 직접 소비하지 않음”은 정합한다. 기존 엔진의 호출 경계 개선과 새 메인 엔진의 협력적 취소는 별개 구현이다. 기존 signal 미전달 호환성, legacy worker 불변, PDF.js `renderTask.cancel → promise 정착 → cleanup → destroy`, 공용 청크/QR import·기존 5종 예산 계약을 그대로 유지한다.

**N3 — 전처리·레이아웃은 해소, 날짜 문법만 잔여**

E6-2의 순수 함수는 토큰 context(이미 1회 캡처한 날짜/페이지/파일명)를 인자로 받는다. 단일 pass 치환 뒤 CRLF/CR→LF, TAB→4공백, C0(LF 제외)/DEL/C1 오류, LF 줄 분리를 수행한다. 10개 입력을 각각 100회 호출해 동일 객체 값이 나오는지 단언했다. 치환된 파일명 속 `{page}`를 다시 템플릿으로 해석하지 않았고, 파일명에서 유입된 TAB도 동일하게 정규화했다.

- `A\tB\r\nC\rD` → `["A    B","C","D"]`, Helvetica 사용 가능. NUL·VT·U+0085는 필드 오류로 차단. `가\r나`는 Noto coverage 성공.
- `A×80 + 🙂`는 말줄임 전 U+1F642 누락으로 차단된다. 잘릴 꼬리라고 삭제해 통과시키지 않는다. 후보 전체를 함께 검사해 최종 문서 폰트에 필요한 coverage를 판단하는 구현 경로가 가능하다.
- 실제 Helvetica 12pt `…` 폭 **12pt**. 영역 5pt는 오류, 정확히 12pt는 `…`만 출력·경고. 폭 50pt·높이 28.8pt에는 2줄만 남고 경고, 높이 10pt는 0줄·경고로 v7 수직 규칙을 그대로 실행했다.
- width에 사용한 최종 run을 그대로 draw했다. `A    B` 폭 **29.352pt**, 저장·재개방 stream의 실제 `<412020202042> Tj` 일치. `C`/`D`도 일치. coverage 검사용 두 폰트를 한 probe 문서에 준비한 것이며, 이 측정 문서를 제품의 “폰트 하나만 embed” 최종 경로라고 부르지 않는다.
- 200×200pt, 10×10pt tile, gap 0 → **400 허용**. 폭 201 → **420 오류**, gap 1 → **361 허용**. tile 폭 0·음수 gap은 오류. 실제 구현은 회전/오프셋을 적용한 배치 목록을 만들 때 401번째 전에 중단하면 전체 큰 목록을 만들지 않고 상한을 검사할 수 있다. 400은 gap의 단독 함수가 아니다.

따라서 전처리 결정성·width/draw 입력 공유·수평/수직 overflow·타일 상한 자체에는 이견이 없다.

남은 것은 `pdf-finish:226,469`의 날짜 형식이다. **유효한 예는 `YYYY-MM-DD` 하나이고 유효 문법/지원 목록은 없다.** E6-2에서 아래 두 순수 parser를 실제 실행했다. 두 함수 모두 문서의 유효 예와 명백한 오류를 만족하지만 같은 다른 입력에서 실행 허용 여부가 갈린다.

| 형식 | `YYYY-MM-DD`만 허용하는 parser | `YYYY/MM/DD` 등의 구성요소·구분자를 허용하는 parser |
|---|---|---|
| YYYY-MM-DD | 2026-09-06 | 2026-09-06 |
| **YYYY/MM/DD** | **필드 오류** | **2026/09/06** |
| DD.MM.YYYY | 필드 오류 | 06.09.2026 |
| foo / 빈 형식 | 필드 오류 | 필드 오류 |

`source-evidence.json`의 기존 PDF/공용 utils/QR 범위 날짜 formatter 검색은 일치 0이라, 해당 표면에서 이미 정해진 문법을 그대로 이관하는 상황도 아니다. **알 수 없는 `{foo}`의 리터럴+경고 결정은 해소됐지만, 알 수 없는 date format의 범위는 해소되지 않았다.** 정본에서 “명시 형식은 `YYYY-MM-DD`만 지원, 나머지 오류” 또는 지원 token/구분자 whitelist를 하나로 명시하면 닫힌다. 새로운 날짜 기능이나 라이브러리를 요구하지 않는다. 이 선택은 구현자가 임의로 해도 되는 변수명 선택과 달리 사용자 입력의 실행 차단을 바꾼다.

**sol 인계 판정**

기존 D1·D2·D6·D7·D8·N1·N2 및 5경로/canonical·ToolReady·recovery·clock unit·219캡처 예측·legacy oracle·9단계/1회 배포는 다시 이견으로 세지 않았다. U4-0~8의 준비를 진행하려면 다음 세 결정만 더 왕복하면 된다.

| 잔여 | 코딩 전에 닫을 것 |
|---|---|
| D3 — U4-0/1/7/8 | 200MiB 검사와 결과 등록의 순서·초과 현재 파일의 운명, OPFS 실패 경계, photo-scan 계수의 명시적 셀/집계 |
| D4 — U4-0/6/7/8 | 가시성 평가와 안전한 content 제거를 구분하고 graphics/path/text 상태 의존 입력을 지원 제외하거나 상태 보존 변환으로 처리하는 문법. 두 새 pixel oracle 포함 |
| N3 — U4-1/3/4 | `{date:…}`의 허용 형식 목록/문법 |

**잔여 이견 3건 · [재왕복 필요]. 정본화·sol 제품 구현 착수 조건 미충족.**

**종료 무변경 검증 — 전체 실패와 범위별 통과를 구분**

초기 snapshot **2,912파일**, 지정 제외 **AGENTS.md·CLAUDE.md 2개**. 같은 verifier를 실행했고 **exit 1을 보존**했다. 허용목록을 늘리지 않았다.

```json
{
  "snapshotFiles": 2912,
  "verifiedFiles": 2910,
  "distFiles": 531,
  "changed": [
    "docs/jobs/todo/qr-font-20260906.md",
    "docs/jobs/todo/roadmap-completion-20260906.md"
  ],
  "extraDist": [],
  "excludedChanged": [],
  "headEqual": true,
  "origin-mainEqual": true,
  "git-statusEqual": true,
  "diffIncludingClaudeEqual": true,
  "indexEqual": true,
  "nonExcludedWorktreeDiffExit": 0
}
```

변경 문서의 현 내용은 **Claude의 S2b v3 확정·2차 반박 결과 기록**이다. 이번 세션의 쓰기는 `/tmp/worklazy-u4-r6/`에만 있었고, 이 두 문서를 수정하지 않았다. 동시 세션의 변화로 판단하되 “저장소 전체 불변”이라고 선언하지 않는다. 전후 SHA/size/mtime는 `scope-integrity.json`에 보존한다. 별도 검사 E6-8은 다음을 증명했다.

- 지정 제외 외 **추적 파일 SHA/크기/mtime 불일치 0**, 제품 소스·의존/설정 입력 불변.
- **dist 531파일 내용·크기·mtime·집합 불변, 추가 0**.
- **U4 v7 계획 불변**, 사용자 DOCX 2개·네이버 HTML 불변.
- HEAD=`f29d249…`, origin/main·git status·Claude 변경 포함 worktree diff·index 모두 시작과 동일. 제외한 AGENTS/CLAUDE 자체도 이번 시작 이후 변화 0.

실험의 전제와 U4 판정은 유지된다. 저장소 기록 금지에 따라 CHANGELOG/review-notes/계획서에 기록하지 않고 이 REPORT로 전달한다.

**최종: D5 해소 · 잔여 D3·D4·N3 = 3건 · [재왕복 필요]. — Codx**
