U4 PDF 마무리 v13 — Codex astra 12차 반박 (Codx, 2026-09-07)

**잔여 이견 0건. Claude–Codex 간 이견 0 · [정본화 가능].**

v13의 Type3 지원 제외 결정을 [동의·해소]로 판정한다. 기존 355입력은 **허용 198·제외 157 그대로**, 11차 추가 72입력은 **허용 30·제외 42**다. 따라서 427입력 전체의 허용 수는 **228**이며, **허용 228 전부를 새로 변환하고 Poppler·실제 Chrome PDF.js에서 각각 원본/결과 전체 RGBA SHA 동일**을 재실행했다. 마지막 새 입력 탐색 50개도 **허용 28·제외 22**, 허용 28 전부 두 렌더러 동일이고 **문안을 통과하는 새 반례 0**이다. 지원 범위는 이번 정본화 판단에 충분히 보수적이다.

**항목별 판정**

| 대상 | 판정 | 실행 근거 |
|---|---|---|
| v13 페이지 유효 리소스 그래프의 Type3 제외 | **[동의·해소]** | E12-1/3/7. 직접 Font dict, 간접 Font dict, 간접 Subtype Name, ExtGState Font, Form/Pattern Resources, 상속, 순환, 두 번째 페이지 모두 탐지 |
| 11차 Type3 d1 반례 2개 | **[동의·해소]** | 지정 원본 SHA 일치, 둘 다 변환 전 제외. d0/ExtGState의 정상 대조까지 동일한 지원 규칙으로 제외 |
| 기존 355 및 11차 72 재분류 | **[동의]** | E12-1: 355=198/157, 72=30/42, 전체=228/199. 기존355의 분류 변화 0 |
| 허용 집합 전부 두 렌더러 SHA 재실행 | **[동의]** | E12-1/2/7: 228문서·230페이지 전부 각 렌더러 원본=결과, 깊은 OC 잔여 0 |
| 11차 탐지 누락 14 | **[동의·해소]** | E12-5: 이전 prototype의 잘못된 허용 14/14 재현, v13 결합 검사 제외 14/14. **Type3 단독 탐지는 6개**, 나머지8은 v12의 비페이지 OC 사용 경로 검사 |
| manifest 허용4/제외31 + 회귀 | **[동의]** | 35행 이름·SHA·기대 일치. 직접 배열32 및 명시 대표20을 각각 두 번 생성해 과거 SHA까지 일치 |
| Type0/CIDFont·Type1 임베드 대조 | **[동의]** | 4개 전부 허용·두 렌더러 동일. 실제 직렬화된 글꼴 프로그램과 pdffonts의 embedded=yes 확인 |
| 이미지 SMask/Mask·Transparency Group·동일 OCG 이중 사용 | **[동의]** | E12-3/4/7, 아래 매트릭스. 이미 제외인12개는 fixture 후보이며 새 정책 이견으로 계산하지 않음 |
| sol U4-0~8 최종 인계 | **[동의]** | 아래 단계별 확인. 새 지원 정책·출력 의미·게이트를 sol이 선택할 잔여 지점 0 |

**실행 범위·기준·선독**

첫 명령은 `cat PROJECT_RULES.md`였다. AGENTS 및 지정 dispatch 전문, PDF 계획 전문(「v13 확정」 우선), roadmap §2·§3 S3·결정10/11, r3~r11 REPORT를 읽었다. 절단 출력은 구간 재독했고 관련 review-notes의 OTF/WOFF2/subset·번들 기각 이력과 자산 정본도 대조했다. 열린 계획 16개의 PDF/폰트 표면 검색은 `logs/open-plans-scan.txt`에 있다. S2b의 QR 선택 자산·fallback 보존과 U4 전체 OTF·공용 import 계약은 정합한다. 완료된 선행 UI 지시를 새 기능 금지로 재해석하지 않았다.

```text
HEAD   2f59a44737e87019fd90ca84f23e75c7d297ef97
main   f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e
branch s2b-qr-font
$ git diff main -- src/features/pdf-editor
(출력 없음, exit 0)
$ git status --short --branch
## s2b-qr-font
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```

최신 사용자 지시대로 **main만 기준 해시로 대조**, 브랜치 전환 없이 PDF 표면 동일을 확인했다. 새 스크립트·PDF·PNG·Chrome 프로필·로그·보고서는 **`/tmp/worklazy-u4-r12/`에만** 썼다. 저장소/계획서/사용자 파일/기존 r3~r11 산출물 수정, dist 변경, 설치, build/prebuild, commit/push, 제품 구현, 서브에이전트 호출은 하지 않았다. 저장소 기록 금지에 따라 CHANGELOG·review-notes 대신 이 보고서로 전달한다.

**재현 명령과 출력**

아래 cwd는 저장소 루트다. 모든 명령을 실제 실행했다. 실험 E12-1~8과 범위 검사 E12-10은 **exit0**, 전체 불변 검사 E12-9의 최종 실행은 동시 문서 갱신으로 **exit1**이다. 경로는 `/tmp/worklazy-u4-r12/` 기준이며 전체 stdout/stderr와 구조화 자료를 보존했다.

| ID | 실행 명령 | 원출력·결과 |
|---|---|---|
| E12-1 | `node /tmp/worklazy-u4-r12/probes/rerun.mjs` | `logs/rerun.log`, `rerun.json`: 427 재분류·입력 SHA 대조·허용228 새 변환 및 Poppler |
| E12-2 | `node /tmp/worklazy-u4-r12/probes/browser.mjs rerun` | `logs/rerun-pdfjs.log`, `rerun-pdfjs.json`: total228, errors=[], changed=[], rgbaEqual228 |
| E12-3 | `node /tmp/worklazy-u4-r12/probes/explore.mjs` | `logs/explore.log`, `explore.json`: 고정50입력·두 번 생성·기대 불일치0·허용28 Poppler 동일 |
| E12-4 | `node /tmp/worklazy-u4-r12/probes/browser.mjs explore` | `logs/explore-pdfjs.log`, `explore-pdfjs.json`: total28, errors=[], changed=[], rgbaEqual28 |
| E12-5 | `node /tmp/worklazy-u4-r12/probes/regression.mjs` | `logs/regression.log`, `regression.json`: 회귀32 결정성·과거 SHA 일치, 이전 가드 누락14 재현·결합 검사 제외14 |
| E12-6 | `node /tmp/worklazy-u4-r12/probes/representatives.mjs` | `logs/representatives.log`, `representatives.json`: 명시 대표20 두 번 생성·과거 SHA 동일·전부 허용 |
| E12-7 | `node /tmp/worklazy-u4-r12/probes/final-assertions.mjs` | `logs/final-assertions.log`, `final-assertions.json`: 실제 PDF/PNG 재독·전체 RGBA SHA/차이·깊은 OC 잔여·폰트 구조 검산 |
| E12-8 | `python3 /tmp/worklazy-u4-r12/probes/source-evidence.py` | `source-evidence.json`의 argv12명령 전부 exit0, `logs/source-evidence.log`, `font-sources.json` |
| E12-9 | `python3 /tmp/worklazy-u4-r12/probes/verify-unchanged.py` | 최초 exit0, **최종 exit1**. `logs/unchanged.log`, `unchanged.json`: 동시 로드맵1개 변경 검출 |
| E12-10 | `python3 /tmp/worklazy-u4-r12/probes/scope-integrity.py` | **exit0**, `logs/scope-integrity.log`, `scope-integrity.json`: PDF/main·추적파일·dist·U4계획·사용자파일·git 불변 |

Poppler **24.02.0** 명령은 `pdftoppm -f <page> -l <page> -r 72 -png -singlefile <pdf> <prefix>`다. PDF.js **6.2.108**, Chrome **152.0.7977.64**, scale=1·흰 배경·ceil viewport의 전체 RGBA를 검사했다. Node **v22.17.1**, pdf-lib **1.17.1**, puppeteer-core **25.6.0**, pngjs **7.0.0**이다. 모든 페이지를 검사했으며 **각 renderer 안의 원본=결과**가 oracle이다. 두 렌더러의 글꼴 안티앨리어싱 자체를 서로 같아야 한다고 요구하지 않는다. 외부 요청 **0**, 실 모바일 측정 아님. 정적 글꼴 대조 PNG도 직접 열어 ON glyph 표시를 확인했다.

이번 실험 명령에는 실패 후 기준 완화가 없었다. 브라우저 console의 로컬404 및 기존 집합의 XObject 경고5개는 JSON에 그대로 남겼다. 렌더 실패0·픽셀 변화0이며 경고를 삭제해 결과를 만들지 않았다. 아직 미구현인 U4의 build/unit/browser/static·C-D 9게이트를 이번에 통과했다고 주장하지 않는다.

**집계와 Type3 경계**

| 집합 | 입력 | 허용 | 제외 | 새 렌더 결과 |
|---|---:|---:|---:|---|
| r9 174 + 기존10 | 184 | 88 | 96 | 허용 전부 양쪽 동일 |
| r10 탐색 | 156 | 105 | 51 | 허용 전부 양쪽 동일 |
| r10 clip/Do/escaped 보충 | 13 | 5 | 8 | 허용 전부 양쪽 동일 |
| 빈 registry·catalog 없는 OCMD | 2 | 0 | 2 | 변환0 |
| **기존355 소계** | **355** | **198** | **157** | **198 유지** |
| **r11 추가72** | **72** | **30** | **42** | **허용30 양쪽 동일** |
| **지정427 합계** | **427** | **228** | **199** | **228문서·230페이지 양쪽 동일** |

“허용198 유지”는 기존355 집합의 수치다. 추가72 중 정상30을 빼서 전체 허용 수를198로 맞추지 않았다. v12의 72집합 허용36에서 Type3 대조6을 추가 제외한 결과다. manifest와 회귀32·대표20은 이 입력들의 **부분집합**이므로 총입력에 중복 합산하지 않았다.

`probes/v13-guard.mjs`는 v12 검사와 별도로 **각 페이지의 유효 Resources**에서 시작하는 순환 방지 탐색을 구현했다. 참조를 해제하고 dict/array/stream dict를 따라가며 Subtype Name을 해독한다. **글꼴 바이너리 자체를 PDF content로 파싱하지 않는다.** 원본 bytes·이름·SHA·기대 픽셀로 분류하지 않으며, 단순한 전체 파일 문자열 검색도 아니다.

v13은 r11의 미채택 후보와 두 경계가 다르며, 최신 문안대로 고정했다.

- **OCProperties 유무를 전제로 하지 않는다.** 도달 가능한 Type3이면 OC가 없는 일반 문서도 구조 제거 제외(`r12-type3-no-OC`). d0/d1·glyph 사용 여부·내부OC 여부의 예외 없음.
- **Type3만 있고 페이지 유효 Resources에서 도달 불가능한 orphan이나 shadow된 조상 Resources는 이 Type3 규칙의 제외 사유가 아니다.** `r12-type3-orphan`·`r12-type3-shadow-parent`는 허용·두 렌더러 동일. v12의 OCG/OCMD·비지원OC orphan 전객체 검사는 별도로 유지한다.

새 reachability 대조12개는 **제외10·허용2**다. 제외10은 page-direct, page-indirect-name, page-indirect-font, ext-font, form, pattern, inherited, cyclic, no-OC, second-page다. 탐색 witness와 방문 수는 `explore.json`에 있다. 이 결과는 상속을 조상과 merge하거나 첫 페이지만 검사하는 구현을 채택할 근거가 없음을 명확히 한다.

**11차 누락14를 Type3 한 조건으로 잡는다고 쓰면 사실과 다르다.**

| 기존 가드 누락군 | 수 | Type3 탐지 | v13 최종 제외 근거 |
|---|---:|---:|---|
| ExtGState `/Font` → 내부OC Type3 | 2 | 2 | Type3 + v12 비페이지 content OC |
| 직접/간접 CharProcs의 내부OC | 4 | 4 | Type3 + v12 비페이지 content OC |
| 페이지 XObject와 Widget AP가 같은 OC Form 공유 | 2 | 0 | page.Annots 사용 경로 |
| 페이지 XObject와 ExtGState SMask가 같은 OC Form 공유 | 2 | 0 | page.Resources.ExtGState 사용 경로 |
| 페이지 XObject와 Pattern이 같은 OC Form 공유 | 2 | 0 | page.Resources.Pattern 사용 경로 |
| 페이지 XObject와 다른 Form이 같은 OC Form 공유 | 2 | 0 | Wrapper.Resources 사용 경로 |
| **합계** | **14** | **6** | **v12+v13 결합14/14** |

E12-5는 이전 `/tmp/worklazy-u4-r10/probes/proposed-guard.mjs`를 직접 호출해14개가 정말 허용되는지 다시 검사했다. 그 뒤 v13 결합 검사로14개 모두 제외됨을 단언했다. **객체 순환 방지용 visited와 사용 경로의 지원 판정은 분리**해야 한다. 페이지에 직접 등록됐다는 이유로 같은 객체의 AP/SMask/Pattern 경로를 생략하지 않는다. v13은 v12를 유지한다고 명시하므로 이8개를 새 정책 이견으로 세지 않는다.

**manifest와 회귀**

기존19행(4/15) + Type3 d1 반례2 + 탐지 누락14 = **35행(허용4/제외31)**이다. 전체 이름·SHA·기대·실제 결정은 `rerun.json.manifest`에 보존했다. Type3 두 지정 SHA는 다음과 같다.

```text
r11-type3-page-true-1 a4718041019e9f525182c8acf964db1b1f1cee8bd745fdfad7c38f3f1147c44a
r11-type3-page-true-0 328886f315026c475cf70a81d133dfcd97a80c0438405542d1710fabe2d899fa
```

직접 배열32(4정책×4상태×marked/Form)와 명시 대표20은 각2회 생성 및 이전SHA 일치, 허용 여부 일치를 확인했다. 이번 탐색50 역시 전부2회 생성SHA 동일이다. 제외 입력의 지원 변환 시도는 **0**, 해당 fixed PDF가 없다는 파일 검사도 E12-7에서 단언했다.

**마지막 새 입력 탐색 한 라운드 — 50개**

`exploration-matrix.json`에 이름·축·기대를 먼저 고정했다. 이후 새로운 탐색군을 추가하지 않았다. 아래 허용28개 전부 Poppler·PDF.js 각각 원본/결과 전체 RGBA SHA 동일, 깊은 OC 잔여0이다.

| 축 | 입력 | 허용/제외 | 판정 |
|---|---:|---:|---|
| Type0/CIDFontType2 TrueType + Type1 PFB, ON/OFF 순서2종 | 4 | 4/0 | 정적 glyph 대조 통과 |
| Image SMask/Mask·색상키·마스크OC·직접등록 공유·중첩SMask | 16 | 6/10 | plain 마스크/색상키 허용. 마스크 경로OC10은 v12에서 이미 제외 |
| Form Transparency Group(I/K 각2값×ON/OFF) + 내부OC | 10 | 8/2 | Group 자체는 허용. 내부OC2는 기존 제외 |
| 같은 OCG를 Contents와 Form/Image 자체OC에서 함께 사용, 단일/배열 Contents | 8 | 8/0 | 이중 사용 자체는 허용·동일 |
| Type3 도달성 경계 | 12 | 2/10 | 위 v13 경계 기대 그대로 |
| **합계** | **50** | **28/22** | **새 반례0·기대 불일치0** |

폰트4개는 `/Type0`→`/CIDFontType2`·Identity-H·FontFile2의 LiberationSans와 `/Type1`·WinAnsi·FontFile의 NimbusSans를 실제 임베드했다. 각각 같은 A glyph를 ON/OFF 블록이 재사용하며 순서를 바꾼 두 파일이다. decoded font program은 **139,512B / SHA f8ace1f8…8221f**, **104,001B / SHA c39d89b8…69216**이고 `final-assertions.json.fonts`에 전체 SHA가 있다. `pdffonts`도 각각 **CID TrueType / Type1, embedded=yes, subset=no**를 확인했다. 폰트 대체에 우연히 의존하는 표본으로 처리하지 않았다. 이4개 결과가 모든 static font·임의 PDF의 적합성 인증을 뜻하지는 않는다.

마스크OC·내부GroupOC는 v12의 명시 지원 위치 밖이라 fixture 후보일 뿐이다. 일부 중첩 마스크/추가키 입력을 정상 PDF 규격으로 인증하지 않는다. 새 Type3 정책을 더 좁히거나, Group·정적 글꼴·OCG 이중 사용을 추가로 금지할 실행 근거는 발견하지 못했다.

**sol 최종 인계 — 정책 재해석 잔여0**

| 단계 | 정본화 때 유지할 실행 계약 |
|---|---|
| U4-0 | main의 실제 착수 기준 재확정·리팩터링 전 legacy3종 채취, R2/R6 oracle, 4/31+32+20 명시 fixture, 새50은 위 분류의 보충 fixture 후보. 번들 모듈 귀속 측정은 별도 논리 단위·5종 상한 유지 |
| U4-1 | exact physical set·anchor 산식, 날짜 whitelist·전체 후보 coverage, CSS viewport 좌표·도장 중심/상대폭/고유비율, 캔버스 A와 측정용 B 분리 |
| U4-2 | 실제 PDF lifecycle facade 이관·기존4모드/Excel 불변, task 양보·등록 전 abort, PDF.js cancel→promise정착→cleanup→destroy |
| U4-3~5 | 5경로·canonical finish·typed preset·내부 ToolReady 조건, ko/en/SEO/static·영어 모바일, 미리보기 한계·400타일·background 독립stream·도장 undo/redo |
| U4-6 | v12 전객체/사용경로 검사 **및** v13 effective-resource Type3 검사 모두 필수. raw OCMD membership·해독Name·8조건 유지. 지정 제외는 사전 고지·구조 제거 비활성, 장식/raster 허용. 사유 code는 내부 기록만 |
| U4-7 | 150기본·모바일 한계 미교정, paired 포맷식·floor 가독성식·photo-scan max계수. OPFS 실패 배치중단, memory cap 등록 전200MiB, abort→cap→등록 |
| U4-8 | 전체 옵션 순서 golden·legacy 실제브라우저 비교·다중파일/ZIP·전 스코프 및 C-D9게이트. S2b QR selector/fallback과 U4 전체 OTF·공용 import를 함께 보존 |

이전 버전의 폐기 문장·예측 캡처 수를 새 정책으로 되살리지 않고 최신 확정 절과 채택된 상세 문안을 하나의 정본으로 취합하면 된다. 이는 **정본화 편집 작업**이며 새로운 사용자 선택이나 잔여 이견이 아니다. 이번 실험은 제품 구현 전체 검수를 대신하지 않는다. 구현 중 범위 밖 발견은 sol이 임의로 지원 범위를 바꾸지 않고 보고하는 기존 계약을 유지한다. **정본화 가능 선언이며, 저장소 구현 착수를 수행한 것은 아니다.**

**종료 불변 증명**

3차 방식으로 시작/종료 파일 집합·SHA-256·크기·mtime 및 git 상태를 대조했다. 최초 E12-9는 변경0·exit0이었지만, **보고서 작성 뒤 최종 재검사에서 오프라인 로드맵1개 변경을 검출해 exit1**이었다. 전체 verifier나 지정 예외목록을 완화하지 않고 실패를 보존했다.

```json
{"snapshotFiles":2929,"endFiles":2929,
 "changed":["docs/jobs/todo/roadmap-completion-20260906.md"],"trackedChanged":[],
 "pdfFiles":12,"pdfChanged":[],"pdfDiffFromMain":"",
 "distFiles":537,"distChanged":[],"u4PlanUnchanged":true,
 "userFilesChanged":[],"mainMatches":true,"scopePass":true,"pass":false}
```

변경 문서에는 동시 S2b 4차 검수 통과·Claude 게이트 판정(03:15)·U4 라운드 종료 후 병합 실행 기록이 추가된 상태다. `git check-ignore -q`는 exit0이다. 시작 SHA는 `fb7af0de89a0496e8763891ac9cf122e27556852e0d203ce8bff3af0b18a63fe`(49,386B), 종료는 `fd101f8d87cea4e6503fc141de936657c1792e972760750f89f5adb1bc2550ba`(50,416B)다. 전후 SHA/크기/mtime와 종료 원문은 `scope-integrity.json`·`roadmap-end.txt`에 보존했다. 이 세션은 로드맵을 수정하지 않았다.

**추적파일·PDF12·dist537·U4 v13계획·사용자3파일 불변**이며 HEAD·main·branch·git status·worktree diff·index도 시작과 동일하다. AGENTS/CLAUDE의 변화도0이다. 전체2,929파일 중 위 오프라인 문서 외2,928파일은 SHA/크기/mtime/집합 불변이다. 최신 지시의 PDF/main 범위와 실험 입력의 무결성을 별도로 검증한 E12-10은 **exit0**이다. **저장소 전체 불변이라고 확대하지 않는다.** 외부 문서 갱신은 PDF 지원 정책의 새 이견이 아니며 실험 결과에 영향 없다. 커밋·push·브랜치 전환·npm 설치·저장소/생성물 수정은 수행하지 않았다.

**최종: 기존355 허용198 유지, 지정427 허용228 전부 두 렌더러 동일, 마지막50 허용28 전부 동일. 잔여 이견0 · Claude–Codex 간 이견 0 · [정본화 가능]. — Codx**
