# 메인 UI·4테마·shadcn 제거 v2 — 반박 2차

2026-09-07 · Codx(astra 검토/실험). 대상은 docs/jobs/todo/ui-theme-redesign-20260907.md의 v2 반영 및 2차 요청(i)~(vii). **잔여 이견7건(N1~N7), [정본화 보류].** 사용자 결정5건에 대한 이의는0건이다. 새 문안은 Claude 수용·정본 반영 대기이므로 보고서 작성만으로 "이견0"을 선언하지 않는다. 이후0에 도달해도 **착수는 S3 main 통합 후 갱신된 단일 정본 수령 뒤**다.

## 결과·산출물

- [정본 삽입 문안](CANONICAL-AMENDMENTS.md): N1~N7 구체적인 선택·대체 문장.
- [문장 단위 대조148행](SENTENCE-CROSSWALK.md), [v2 대조 원문 포함 JSON](evidence/sentence-crosswalk.json).
- [W0~W5 gate·회귀·checkpoint](GATES.md), [7종 API/이벤트/엣지 계약](PRIMITIVES.md).
- [144쌍 CSS 값/대비 전체표](CONTRAST.md), [4테마 token JSON](evidence/palette-proposed.json), [CSS prototype](lab/palette.css).
- **406개 실제 조합 전체 목록:** [CSV](evidence/visual-profiles-406.csv), [JSON](evidence/visual-profiles-406.json). 축약 예시가 아니라406행이다.
- [검색/select 파일·selector·routing 변경표](SELECTORS.md), [공통 theme fixture prototype](probes/theme-fixture.mjs).
- [브라우저 실제 증거](evidence/browser.json), [OS 8조건 surface 부정대조](evidence/w0-os-cross.json), [언어전환 실제 URL](evidence/routing-browser.json).

## 기준·실행 게이트

PROJECT_RULES.md 전문→AGENTS.md→지시서/v2/1차 보고서·probe→review-notes의 기각이력/관련 docs→newui 핸드오프를 읽었다. 현재 작업트리는 s3-pdf-finish, 시작 HEAD c8bff1fd1ab64f89afb7240778e0a373c953d1a3; 지정 main은5bc6854175331bdd73b267784d9633cdccda8446. 두 기준을 섞지 않았다.

- 406목록은 현재 S3 config/scenarios를 **읽기만** 해서 산출. 관측 source 파일도 sources/에 복사하고 SHA 보존.
- 실제 제품 표본은 허용된1차 main 사본의 /tmp/worklazy-ui-r1/theme-qa-dist를 재사용했다. 새 native dialog/검색/색상 실험은 /tmp/worklazy-ui-r2/lab에만 작성.
- 저장소 추적파일 수정·커밋·push·branch 전환·새 npm 설치 없음. /tmp/worklazy-dc-impl은 접근/변경하지 않음. newui7개 원본은 읽기만.
- 열린 계획서 검사 결과 P2/shadcn의 과거 토큰·source-count 계약과 v2가 같은 표면을 다룬다. 사용자 최신 결정의 v2가 이를 대체한다는 명시가 필요하다. 문서 비교 엔진은 별도 구현중, 화면U1~U6는 UI작업에 이관됐지만 **§6-B의 W5 표기는 옛 단계명**이라 정정 필요. 현재 작업은 제품구현이 아니므로 지정 main archive에 안전하게 실험했다.
- 포트4230/4231에 Vite --strictPort. NODE_OPTIONS=--max-old-space-size=4096. 모든 브라우저는 직렬. 재빌드는 하지 않았으며 기존 QA dist를 썼다고 기록한다.

## (i) 1차 R1~R12 반영 대조 — [동의 일부] [반박: 증거] [보완]

148문장/보충행으로 대조했다. R1 main/S3 분리, R2 수동테마/OS블록 이관, R3 단일primary/상태색, R5 public path/의존범위, R6 combobox, R7 이미지 별도예산, R8 sparse family 확장, R9 S3선행/격리host포함, R10 단계분해, R11 사용자카드/how-to, R12 명령교정이라는 **핵심 방향은 수용**됐다. "전건 수용"이 모든 구체계약까지 완성되었다는 뜻은 아니다.

명확한 정정/누락:

1. **CSP vendor3문서는 틀림.** 107HTML 중104제품, 예외는 RHWP2(CSP있음)+Naver인증1(CSP없음). v2 R4의3문서 표현 정정. 1차 Codx 보고서도 총수 설명과 뒤의 CSP 표현이 불일치했으므로 자기 정정 포함.
2. **CSS rule-count oracle 누락.** 1차 실제 unit 실패로 확인한 ui-legacy-isolation의 rules>=541·OS media/source 구조 검사 교체가 v2에 빠졌다. p1b node_modules 읽기 외 six-color oracle도 명시해야 한다.
3. **선택지가 남음.** CVA 유지/대체, startup-help 예외/수리, encoder CI 설치/산출검증, 정확한 header/drawer 규격, expanded visual set 등이 아직 sol의 판단으로 남는다. N3~N7에서 값/방법을 제안했다.
4. **ToolsPage matcher 공유·검색 corpus 회귀**가 v2의 matcher 설명만으로는 명확하지 않다. 기존 category/eyebrow 검색을 보존하는 범위를 명시했다.
5. §6-B U1~U6 구현단계와 v2 W4/W5의 연결을 수정해야 한다.

재현:
~~~bash
python3 /tmp/worklazy-ui-r2/probes/crosswalk.py
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-ui-r2/probes/source-audit.mjs
rg -n '541|prefers-color-scheme' tests/unit/ui-legacy-isolation.test.ts
~~~
실제 출력: sentence rows148; CSS literal138·OS dark내31; strict HWP trailing slash branch차이. HTML exact inventory는 evidence/html-inventory.json. 정본 문안 N1/N2/N7.

## (ii) W0~W5 완료 gate — [보완]

[GATES.md](GATES.md)에 단계마다 명령·필수case·PASS조건·회귀위험·복귀점을 적었다. 신규 테스트 이름은 **sol 구현 산출물**임을 표시했으며, 아직 없는 파일을 실행한 것처럼 보고하지 않는다.

특히 W0 최소일관성은 "색이 대충 어울림"이 아니다. source owner manifest에 미분류 literal0, 각 실제 mount surface에서8조건의 OS독립·본문/상태4.5·경계3·schema/meta/값일치·복구/상태보존으로 판정한다. selector 누락/투명합성 미판정도 FAIL. 도구표현을 W4에서 마무리하더라도 W0의 읽힘·OS 독립 실패는 미루지 않는다.

실행한 부정대조:
~~~bash
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-ui-r2/probes/w0-browser.mjs
~~~
출력 **conditions8/pageSamples16/osDependentSurfaceCount32**. 옛 r1 QA 사본은 올바른 data-theme를 갖고도 hero/sidebar 등이 OS에 따라 변한다. 이 검사는 그 실패를 잡는다. v2제품은 아직 구현하지 않았으므로 제품32실패로 계산하지 않는다.

문서UI 이관은 W4 구현·W5 검증. baseline476 추정시간22m29.7이20분을 넘으므로 exact shard238/238·각20분·합집합전수를 제안. 정본 문안 N2/N5.

## (iii) CSS 팔레트·실제 대비 — [보완] [반박: 기존 focus opacity]

v2 기본palette를 유지하며 빠진상태를 명시값으로 채웠다. 36case×4theme=**144쌍**, 브라우저 computed CSS와 독립 Python 계산 전부 통과. 표본은14px/500 텍스트여서 large text 완화를 사용하지 않았다. focus/control은 실제 border로 측정했다.

| 테마 | 텍스트 최소(기준4.5) | 비텍스트경계 최소(기준3) |
|---|---:|---:|
| light-coral | 4.8654946736 | 3.5778893008 |
| dark-coral | 6.0832385979 | 5.6337092530 |
| light-mint | 5.0544671053 | 3.5778893008 |
| dark-mint | 6.4820489687 | 5.3232252233 |

기존 opacity 스타일을 남겼을 때의 부정대조(화이트 배경 sRGB alpha 합성):
- coral primary/80 hover **3.678825**; mint **3.559624** →4.5미달.
- coral primary/30 focus **1.589727**; mint **1.538923** →3미달.
- 따라서 hover/active/disabled 색을 따로 정하는 것뿐 아니라 **기존 ring/30 단독focus를 제거**해야 한다. 반올림해서 통과시키지 않았다. 1차의 coral hover3.687과 차이는 채널반올림 유무이며 본 보고서는 반올림하지 않은 합성값이다.

재현:
~~~bash
python3 /tmp/worklazy-ui-r2/probes/palette.py
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-ui-r2/probes/browser.mjs
~~~
144본문/보조/CTA모든상태/tag/tint/placeholder/focus/control/diff/paper/checker/toast success/error/warning/info 전체값은 CONTRAST.md. 기존 root색만 바꾸고 직접색·opacity·gradient가 남는 제품은 이 실험 통과를 그대로 재사용할 수 없다. 실제 DOM합성/최저대비는 구현 gate. 정본 문안 N3.

## (iv) 7종 계약 — [보완]

v2의 키워드만으로 controlled거절·render/ref/handler병합·form·동적 disabled·초점대상제거·nested cleanup을 일관되게 구현하기 어렵다. PRIMITIVES.md에 API/DOM/상태·콜백·중첩·SSR없음/RTL없음·폼·양방향Tab·route/820px cross까지 구체화했다.

실제 Chromium152 prototype의 확인 사례: Switch label/Space/Enter각1회·43×25/21×21/중심Y0·오른쪽여백2px; ToggleGroup disabled skip·focus이동과선택분리; Sheet 앞/뒤Tab wrap, nested ESC최상위만, native inert배경 focus거절, inside→backdrop drag는열림유지, outside down/up은닫힘, scroll/focus복원, focusable0개fallback. browser.json에 단언별 기록, nested-dialog.png에 top layer 캡처.

이것은 React public primitives 완성구현이 아니다. controlled/ref/form/StrictMode·모든cleanup edge와 실제폰트/브라우저범위는 sol의 fixture에서 추가검증해야 한다. 정본 문안 N4.

## (v) 406정확한集合·공통하네스 — [동의: 406계산] [보완]

실제85scenario의203profile을 family2로 펼친 결과406, 중복name0. theme별88/115/88/115, home16. CSV/JSON은 scenario·route/path·locale·viewportID·실제width/height/DPR·theme·filename을 모두 포함한다. 따라서 이 목록이 기본안의 정확한集合이다.

추가proposal은 app70(검색48+접힘8+drawer8+문서결과6)와 별도primitive fixture16. 기존시나리오의 다른 brightness를 모두 확장한 full4集合가 아니라는 의미를 유지한다.

실제하네스 prototype:
- Playwright4표본(4theme, ko/en,1365/390, **OS는 저장theme와 반대**)과 Puppeteer1표본 모두 **actual QA product**에서 storage seed→제품bootstrap→DOM단언→캡처.
- 4개의 잘못된 filename-theme expected값은 모두 assertion실패로 검출.
- 공통 seed는 최상위document에만 적용하고 dataset을 테스트가 강제덮지 않는다.
- a11y/rendering의 hardcoded ko·baseId/exception/placeholder 단일변수 문제도 명시했다. suffix확장만으로 생기는 조용한누락 방지.

재현:
~~~bash
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-ui-r2/probes/inventory.mjs
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-ui-r2/probes/browser.mjs
~~~
출력 scenarios85/base203/expanded406/home16/additionalProposed86, browser profiles5. 정본 문안 N5.

## (vi) 검색/select와기존테스트 — [보완] [반박: HWP trailing slash]

SELECTORS.md에 제품/스모크/unit/visual/a11y/rendering 파일과selector·대체안을 모두 적었다. native select와global input은 모두combobox 의미일수 있으므로 scope없는 getByRole('combobox')는 모호해진다.

실제원본에서 **HWP URL끝 slash가 있으면 언어전환후 query/hash가사라짐**을3경로브라우저 대조로 확인했다(위증거표). 프로토타입의 slash정규화는 이를보존한다.

검색prototype은 전각Excel4 ID(Excel3+문서비교설명매치), ko/en초성문서검색, enHWP제외, active descendant, Escape문자/초점유지, Enterlocal routing, IME조합중이동차단, empty status, Tab자연이동을확인했다. 문안은 초성전용query에 한정하고 prototype의token별초성확장은 제품으로그대로복사하지않도록명시했다. 정본 문안 N6.

## (vii) 잔여 이견·규칙4/5/19 — [보완]

| ID | 정본에서 확정할 계약 | 반영 문안 |
|---|---|---|
| N1 | HTML 예외 오기·누락된 test oracle·복구 상태 | CANONICAL N1 |
| N2 | 단계별 gate·문서 U1~U6의 W4 소유·열린 계획 충돌 | GATES + N2 |
| N3 | 상태별 CSS·focus opacity·preview/diff 범위 | CONTRAST + N3 |
| N4 | 7종 API·controlled/ref/modal 예외 처리 | PRIMITIVES + N4 |
| N5 | 기본/추가 profile·shard·공통 fixture·ID 집계 | 406 목록 + N5 |
| N6 | 검색 상태·select 라우팅·query 보존·selector 변경 | SELECTORS + N6 |
| N7 | header/drawer/sticky·copy·CVA/fallback/encoder 선택 | N7 |

세부 발견을 중복 합산하지 않았다. **잔여7건은 위 계약군의 Claude 수용 대기 수이며, 실험 실패 개수가 아니다.** 각 그룹에 바로 반영할 문안을 제시했지만 합의 완료를 뜻하지 않는다. **[정본화 보류]**이며, 요청한 이견0 선언의 조건은 아직 충족되지 않았다.

규칙4는 ko/en·SEO/static/FAQ/sitemap·동의·광고 host 경계·backend 없음으로, 규칙5는 사용자 화면의 원시 예외·내부 명칭·광고 상태 노출 금지로, 규칙19는 Gemini QA 육안검수와 Codx geometry 교차 후 production 복원/static으로 구체화했다. Codx 표본 캡처를 Gemini 최종 검수로 대체하지 않았다. 자세한 gate는 GATES와 CANONICAL 말미를 참조한다.

## 실제 실행·실패 보존·한계

| 실행 | 실제 결과 |
|---|---|
| inventory.mjs | exit0, 85scenario/203profile→406 unique, home16, 추가86(앱70+fixture16) |
| crosswalk.py | exit0, 문장 대조148행 |
| source-audit.mjs | exit0, CSS literal138/OS media내31, strict HWP branch 차이 |
| palette.py | exit0, 144쌍 미달0 |
| browser.mjs 최종 | exit0, 2driver 총5개 제품 표본, computed144쌍, 단언36개, lab axe violations0/incomplete0 |
| w0-browser.mjs | exit0, 8조건16진입, 의도한 옛 QA 부정대조32개 검출 |
| routing-browser.mjs | exit0, 3경로 결과; HWP 끝 slash의 query/hash 소실 확인 |
| asset 입력/12개 산출물 SHA·encoder 판독 | 완료, 신규 변환/설치 없음 |
| final-audit.py | exit0, CSV/JSON·계산/DOM 수치 일치, 깨진 문서 링크0, 실험 포트 종료, 보호 UI 파일40개·newui7개 변경0 |

초기 실패도 보존했다.

1. 설치된 Puppeteer의 내부 경로를 잘못 가정해 module import가 실패했다. require.resolve 기반으로 교정했다. browser-initial-import-failure.log.
2. 전각 Excel 결과를3개라고 단언해 실패했다. 문서 비교의 설명도 매치하므로4개가 맞으며 exact ID 집합으로 교정했다. browser-first-contract-failure.log.
3. 경계3:1 swatch를 텍스트로 표시한 실험표에서 axe color-contrast4노드를 검출했다. 이를 실제 border 표본과 computed border 검사로 교정했다. browser-specimen-a11y-failure.json 보존. 최종 결과는0/0이다.
4. 첫 최종검사에서 저장소 전체 불변을 단언하자 병행 PDF 변경 때문에 실패했다. final-audit-first-observed.json에 보존했다. 전체 불변을 주장하는 대신 보호 UI 입력과 병행 변경을 분리해 기록했다.

브라우저는 Chromium152/Linux에서 실행했다. OS native select popup·실제 모바일 IME/soft keyboard·다른 브라우저 엔진의 최종 제품 보증은 아니다. 두 driver 주입은 기존 r1 QA 제품, 7종·검색 실험은 standalone prototype이다. 새 v2 build·전체 unit·406장 전수 visual·제품 전체 a11y/rendering은 미실행이다. 제품 구현이 아닌 반박 범위이며, 배송 gate를 완료했다고 주장하지 않는다.

## 재현 순서

서버 두 개를 차례로 시작한다. --strictPort로 포트 중복 시 실패한다.

~~~bash
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-ui-r1/main/node_modules/vite/bin/vite.js preview --config /tmp/worklazy-ui-r2/lab/vite.config.mjs --port 4230 --strictPort
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-ui-r1/main/node_modules/vite/bin/vite.js --config /tmp/worklazy-ui-r2/lab/vite.config.mjs --port 4231 --strictPort
~~~

이후 inventory·palette·browser·w0-browser·routing-browser를 직렬 실행한다. palette 수치 계산만 재현할 때는 서버 없이 palette.py를 실행한다. 406개 목록을 검토하는 데 재빌드는 필요 없다. 제품 표본은 기존 QA 산출물을 사용했고 Playwright에는 외부 요청 차단을 추가했다. 입력 파일이나 newui 원본을 수정하지 않았다.

## 불변성 관측

시작/종료 HEAD는 c8bff1fd1ab64f89afb7240778e0a373c953d1a3, main은5bc6854175331bdd73b267784d9633cdccda8446이다. 추적 파일2587개를 SHA로 대조했다.

- 공용 컴포넌트·스타일·홈/목록·테마 관련 locale·visual/a11y/rendering 입력 등 보호 파일 **40개 변경0**.
- newui 원본 **7개 변경0**.
- 전체 추적 파일 중 **7개 변화 관측**. 따라서 **저장소 전체 불변은 주장하지 않는다**.
- 관측된 변경: src/features/pdf-editor/PdfEditorPage.tsx, src/features/pdf-editor/PdfFinishPanel.tsx, src/features/pdf-editor/finish/engine.ts, src/features/pdf-editor/pdfUi.tsx, src/locales/en/features.json, src/locales/ko/features.json, src/utils/pdfFontEmbed.ts.
- 종료 git status에는 병행 PDF의 미추적 outputName.ts도 있다. 해당 파일을 생성하거나 수정하지 않았다.
- 차이는 병행 U4 작업 영역이며 원상복구하지 않았다. 작성자에 대한 독립 감사는 하지 않았고, 이 세션의 수정 명령은 /tmp/worklazy-ui-r2에만 실행했다.
- 실험 Vite 서버4230/4231은 종료했고 socket 검사로 닫힘을 확인했다.

시작/종료 SHA·git status·관측 diff는 evidence/start-sha.json, end-sha.json, start-git.txt, end-git.txt, immutability.json, parallel-u4-observed.diff에 보존했다. 원본 docs/review-notes에는 쓰지 않았으며 이 보고서가 Claude 취합 입력이다. /tmp/worklazy-dc-impl과 U4 작업트리에 수정 명령을 실행하지 않았다.

— Codx
