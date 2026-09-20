# S2b QR 라벨 PDF 폰트 감량 v1 — astra 1차 반박

작성: Codx (astra 반박 역할), 2026-09-06. 대상: `docs/jobs/todo/qr-font-20260906.md` v1. 실험 루트: `/tmp/worklazy-s2b-r1`.

**판정: [재왕복 필요]. 잔여 이견 6건 — §4의 1~6항별 1건씩 집계하며 하위 원인·예외는 중복 집계하지 않는다.** A는 보정하면 감량과 Poppler/PDF.js 비회귀를 함께 달성할 수 있다. 그러나 v1의 단순 서브셋·cmap 검사·GS 대체 검증·벤더 공급 설명을 그대로 sol에 넘기면 실제로 재해석이 필요하다. 이 보고서의 보정 제안은 정본 승인이나 구현 착수 선언이 아니다.

추천 실험 산출물 `fonttools-compatible.otf`: **931,704B**, gzip `-n -9` **561,161B**, Brotli q11 **444,235B**. 원본 대비 identity **79.94%**, 동일 gzip 조건 **84.97%** 감량. A4/Letter 합계 **17페이지**에서 원본 대비 **Poppler 차이 0픽셀 / PDF.js 추출 차이 0**. 동시에 **Ghostscript 검증은 실패**했고, 전체 원본 PDF에서도 한글 파손이 나타났다. 이를 성공으로 바꾸어 기록하지 않는다.

## 실행 게이트·격리

- 첫 도구 호출로 `cat PROJECT_RULES.md` 전문을 읽었다. AGENTS, 지정 디스패치, v1 전문, 상위 로드맵 사용자 결정 10·11 및 S2-P/S0, R4, OFFICE_EDITOR_ASSETS QR 절, review-notes R4 기각 기록을 읽었다.
- 시작 `git rev-parse HEAD`: `1a04f2571109495a76b8468af95b2f4edcd862cf` — 지시 기준 일치. 기존 변경은 `AGENTS.md`, `CLAUDE.md`; 미추적 사용자 파일은 `after.docx`, `before.docx`, `naver05161fb06bc9701a23cfc09ad5773578.html`.
- `rg -n 'qrLabelPdf|qr-label-font|QR_LABEL_FONT|S2b|S2-P|subset' docs/jobs/todo --glob '*.md'` → `logs/open-plan-scan.log`. 구 QR 계획/R4는 런타임 subset 금지, 최신 사용자 결정 10은 사전 서브셋 실험 허용. U4는 기존 전체 OTF 경로 유지. 실행을 막는 상반 지시 없음. 같은 전체 자산·vendor 스크립트를 공유하므로 S2b가 전체 경로를 대체하거나 지우는 구현은 금지해야 한다.
- 시작 SHA 목록 `start-sha256.json`: 추적 파일 + 현존 dist + jobs + 사용자 파일 **2,912개**. 종료 증명은 아래와 `invariance.json` 참조. 사용자 파일에는 SHA 읽기만 수행했다.
- 이전 실행에서는 venv(fonttools 4.59.2), npm(subset-font 2.4.0와 lockfile)만 재사용했다. 측정·PDF·보고서는 이번에 새로 생성했다. 저장소 설치·수정·빌드·커밋·push·dist 변경 없음. 모든 추가 다운로드·캐시·임시 스크립트는 실험 루트 안에 있다.
- 원래 `qrLabelPdf.ts`를 Node type stripping으로 **직접 import**하여 `createQrLabelPdf`를 호출했다. 배치·fitLine·wrapLines·fontkit 등록·`subset:false` 임베드 구현은 복제 또는 수정하지 않았다. 폰트 바이트와 합성 QR/라벨 입력만 /tmp에서 공급했다.
- 실행 환경: Python 3.12.3, fonttools 4.59.2, Node 22.17.1, pdf-lib 1.17.1, @pdf-lib/fontkit 1.1.1, pdfjs-dist 6.2.108, subset-font 2.4.0 → harfbuzzjs 0.4.15, Ghostscript 10.02.1, Poppler 24.02.0, Chrome 152.0.0.0. 현재는 **gs와 pdftoppm 모두 가용**하다.

## 항목별 판정 및 정본 반영 문안

| 항목 | 판정 | 근거: 실행 명령·출력 | 정본 반영 문안 |
| --- | --- | --- | --- |
| §4-1 A 도구·PDF 유효성 | **[이견 D1]**. 보정한 A 채택 방향에는 [동의]. 단순 ①/② 산출물 채택 및 GS=Poppler 취급에는 이견 | `generate.py`, `harfbuzz.cjs`, `pdf-probe.mjs`, `render.py`, `compare.mjs`: 단순 ①/② 모두 PDF 저장 성공이지만 sample Poppler **2,811픽셀 차이**, 추출 **32항목 차이**. `refine.py` + 보정 검증은 Poppler **17페이지/33,561,324픽셀 차이 0**, 추출 0. GS는 원본도 tofu, 보정안도 실패 | “fonttools 4.59.2의 **GID 보존 + layout closure의 원본 cmap 매핑 보존** 산출을 사용한다. `subset:false` 불변. Poppler를 필수 렌더 기준으로 고정하고 PDF.js 원본 대비 추출 동일을 별도 단언한다. 기존 GS 파손·추출 결함은 별도 기존 결함으로 기록하며 GS 통과를 주장하지 않는다.” GS 정상까지 요구한다면 현행 PDF 임베드 경계의 별도 범위 결정을 먼저 받아야 한다. |
| §4-2 문자 집합·폴백 빈도 | **[이견 D2]**. KS 2,350자 출발점에는 [동의], v1의 ‘등 명시 목록’과 cmap 단독 검사는 불충분 | `corpus.py`: Unicode 공식 매핑 대조 **2,350자 일치**, 위키 3문서 한글 **57,766회 중 KS 밖 1회**. `coverage-probe.cjs`: 분해형 한글 **11,172종 중 cmap 단독 오판 8,822**, 원문+NFC 검사 후 **0**. 정제 3,394자 집합의 위키 100문자 표본 **94/868 폴백**, 25라벨 묶음 **20/33 폴백** | “버전 있는 정적 목록은 아래 3,394코드포인트와 SHA로 고정한다. 제목·설명 치환 후 공백 정규화 원문 **및 그 NFC** 모두 cmap에 있어야 서브셋을 선택한다. 실제 draw 문자열에는 NFC를 새로 적용하지 않는다. 실제 사용자 배치 폴백률은 미확정이며 한글 음절 빈도로 보장하지 않는다.” |
| §4-3 검사 위치·캐시·실패/S0 | **[이견 D3]**. 메인 스레드 선택에는 [동의], 생명주기·재시도 계약이 v1에 없음 | `coverage-probe.cjs`: 2,400행/278,400문자 원문+NFC 검사 **30.686ms**(호스트 1회). `logs/source-panel.txt` 278~301·373~384: 현재 PDF fetch에 AbortSignal/자산 캐시 없음, cleanup 중 export 차단 없음. `logs/source-recovery.txt` 11~24: S0는 `vite:preloadError`에서 reload | “PDF 클릭 후 가벼운 QR 전용 helper를 lazy import, 현재 results 스냅샷의 제목·설명만 메인에서 검사한다. 성공 검증된 ArrayBuffer만 자산별 캐시, 실패/취소 promise는 저장하지 않는다. 서브셋 자산 실패만 전체 자산으로 1회 폴백; AbortError는 폴백하지 않는다. import 실패는 자산 실패와 분리해 S0 계약에 맡긴다. export token+AbortController를 cleanup/unmount에 연결한다.” |
| §4-4 벤더 재현성·해시표 | **[이견 D4]**. 도구 버전만 고정하고 ‘산출물만 벤더링’은 clean CI 공급 경로를 결정하지 못함 | `refine.py`: 별도 2회 생성 SHA **b84d27a5…3a252be** 일치. 원본 vendor 스크립트를 바이트 그대로 /tmp에 복사해 실행한 `logs/vendor-repro.log`: **subsetBefore=true → subsetAfter=false**, full 해시 유지. package prebuild는 매번 vendor 실행, CI에는 Python 도구 설치 단계 없음 | “오프라인 재생성 도구/입력/requirements hash를 보관하고, 고정 산출 `.otf.gz`와 coverage JSON을 **scripts/assets의 생성 입력**으로 추적한다. Node vendor는 원본/OFL과 이 입력을 모두 검증·전개한 뒤 public 산출을 교체한다. clean npm build에 pip/npm 신규 설치를 요구하지 않는다. 기존 전체 OTF·OFL·경로를 보존하고 전체·서브셋·coverage·toolchain의 크기/SHA를 구분 기록한다.” |
| §4-5 sol 예외·처리 계약 | **[이견 D5]**. 아래 결정표를 정본에 포함해야 함 | `coverage-probe.cjs`: `😀`는 full도 미지원, `e + U+0301`은 NFC만 검사하면 오판, `똠`은 raw만 검사하면 오판. `logs/source-pdf.txt` 46~69: 숨겨질 긴 꼬리도 먼저 폭 계산하고 `…`를 생성. `logs/source-panel.txt`: storage read/import/embed/download가 한 catch에 묶임 | “아래 예외표를 위치·최대 재시도·오류 결과와 함께 계약으로 채택한다. 전체 폰트 미지원 문자를 정상 지원한다고 단언하지 않는다. PNG/storage/import 실패를 font 실패로 오분류하여 재시도하지 않는다. 추가 발견은 ‘범위 밖 발견’으로 보고하고 임의 자산·라이브러리 교체하지 않는다.” |
| §4-6 B·C 판정 | **[이견 D6]** — B의 근거 정정. C 보조 판정은 **[동의]** | `browser-probe.cjs`: Chrome 152의 `new DecompressionStream('brotli')` → **Unsupported compression format**. 그러나 현재 WHATWG 표준과 BCD는 Brotli 항목 존재, Safari 18.4/Firefox 147 지원 기록. `sizes.json`: 전체 OTF br 3,179,143B vs gzip 3,733,434B | “B를 ‘모든 브라우저에서 불가능’으로 기각하지 않는다. 지원 환경에서 가능한 보조 대안이지만 현 대상 Chromium/Samsung 경계의 지원을 보장하지 못하고, A보다 감량이 작으며 폴백·배포 형식 분기를 늘리므로 **이번 구현에서 미채택**한다. C는 바이트 감량 없음, PDF 클릭 이전 prefetch는 하지 않는다. 필요하면 클릭 이후 import와 선택된 자산 fetch 병렬화만 보조로 검토한다.” |

**집계는 D1~D6의 6건이다.** 보정 실험이 성공한 부분을 ‘동의’로 구분했지만, 변경 문안에 대한 Claude와의 합의가 아직 없으므로 잔여를 0으로 세지 않는다. [해소 불가]로 선언한 항목은 없다.

## 1. A 실험: 원형 실패와 보정 결과

실행 명령(상대 경로는 실험 루트 기준):

```sh
/tmp/worklazy-s2b-r1/venv/bin/python /tmp/worklazy-s2b-r1/generate.py
node /tmp/worklazy-s2b-r1/harfbuzz.cjs
node --experimental-strip-types /tmp/worklazy-s2b-r1/pdf-probe.mjs
python3 /tmp/worklazy-s2b-r1/render.py
node /tmp/worklazy-s2b-r1/compare.mjs
/tmp/worklazy-s2b-r1/venv/bin/python /tmp/worklazy-s2b-r1/refine.py
node --experimental-strip-types /tmp/worklazy-s2b-r1/pdf-compatible.mjs
python3 /tmp/worklazy-s2b-r1/render-compatible.py
node /tmp/worklazy-s2b-r1/compare-compatible.mjs
node --experimental-strip-types /tmp/worklazy-s2b-r1/expanded-pdf.mjs
python3 /tmp/worklazy-s2b-r1/render-expanded.py
node /tmp/worklazy-s2b-r1/compare-expanded.mjs
node /tmp/worklazy-s2b-r1/size-probe.cjs
node /tmp/worklazy-s2b-r1/size-compatible.cjs
```

각 스크립트·로그·원본/산출 OTF·PDF·PNG·텍스트 JSON이 남아 있다. PDF 첫 시도만 PDF.js 6의 `document.destroy()` 부재로 실패했다(`logs/pdf-probe-first-failure.log`). /tmp 하네스에서 `loadingTask.destroy()`로 고친 뒤 전부 다시 실행했다. 폰트나 저장소 코드를 고친 것이 아니다.

| 폰트 산출 | identity B | gzip -n -9 B | Brotli q11 B | 판단 |
| --- | ---: | ---: | ---: | --- |
| 원본 전체 | 4,644,748 | 3,733,434 | 3,179,143 | 비교 기준 |
| fonttools 기본 재번호 부여 | 659,136 | 487,801 | 411,225 | 렌더/추출 비회귀 실패 |
| subset-font/HarfBuzz 기본 재번호 부여 | 658,024 | 486,817 | 416,100 | 렌더/추출 비회귀 실패 |
| fonttools retain-gids만 추가 | 931,408 | 561,044 | 444,583 | ligature/Jamo 매핑 차이 잔존 |
| **fonttools GID+cmap 매핑 보존** | **931,704** | **561,161** | **444,235** | Poppler/PDF.js 비회귀 통과; GS는 기존 경계 실패 |

`gzip -n`은 파일명/mtime 메타데이터를 제거한다. v1의 `gzip -9 -c NotoSansKR-Regular.otf` **3,733,457B**와 차이 **23B**는 파일명 헤더 차이이고 압축 성능 변화가 아니다. Node zlib gzip, 라이브 전송 gzip, 위 gzip CLI 값을 서로 같은 수치로 취급하지 않는다. Brotli는 q11로 실제 생성했지만 GitHub Pages에서 이 바이트로 전송됐다는 뜻은 아니다.

정적 coverage JSON은 **19,616B**, gzip9 **7,691B**로 JS/별도 JSON 비용을 추가한다. ‘폰트는 JS 밖’이라는 이유로 이 신규 비용을 번들 5종 측정에서 누락하면 안 된다. 84.97%는 **폰트 본체끼리**의 비교다.

### 원형 실패의 내용

- 원형 ①/② 모두 3,095 cmap 코드포인트, 5,366 glyph(레이아웃으로 필요한 추가 glyph 포함)를 생성한다. 두 번 실행 시 각자 동일 해시. file magic은 둘 다 **OTTO**이며 `subset-font`의 `targetFormat:'truetype'`는 이 호출에서 CFF를 TrueType outline으로 바꾸지 않았다.
- sample 25라벨/2페이지: fonttools와 HarfBuzz 각각 Poppler **2,811 / 4,011,288 픽셀 차이**, PDF.js **32항목 차이**. retain-gids만 추가한 경우 Poppler 차이 2,811 그대로, 추출 차이 3항목.
- 예: 원본 `office ffi fi fl`은 정상 추출되는 반면, 기본 서브셋은 `o౸ce ౸ ౶ ౷`, GID만 보존하면 `o咋ce 咋 咉 咊`. fontkit의 shaping 결과에 쓰이지만 subset cmap에서 제거된 Unicode 매핑을 pdf-lib의 `allGlyphsInFontSortedById()`/`computeWidths()`/`embedUnicodeCmap()`가 알지 못하는 문제가 있다. 설치된 `node_modules/pdf-lib/es/core/embedders/CustomFontEmbedder.js`의 실제 코드를 읽었다.
- 따라서 ‘별도 OTF이고 subset:false이므로 현행과 같은 결과’는 충분조건이 아니다. **cmap 밖 shaping glyph와 그 원본 매핑/GID까지 보존**해야 이 스택에서 동일해진다.

### 보정 레시피와 실증 범위

1. `generate.py`의 기본 subset이 실제 보유한 glyph 이름 집합을 얻는다.
2. 원본 cmap에서 그 glyph들에 대응하는 매핑을 모두 포함한다. 이번 입력은 3,095→**3,394자(+299)**. 추가 목록 전체는 `alias-closure.json`, 최종 명시 Unicode 입력은 `unicodes-alias.txt`.
3. 원본 OTF에서 아래 고정 옵션으로 새로 생성한다. 임의의 CFF 파서·런타임 subsetter는 도입하지 않는다.

```sh
/tmp/worklazy-s2b-r1/venv/bin/python -m fontTools.subset \
  /tmp/worklazy-s2b-r1/full.otf \
  --unicodes-file=/tmp/worklazy-s2b-r1/unicodes-alias.txt \
  --output-file=/tmp/worklazy-s2b-r1/fonttools-compatible.otf \
  '--layout-features=*' '--name-IDs=*' '--name-languages=*' \
  --name-legacy --notdef-glyph --notdef-outline --no-recalc-timestamp --retain-gids
```

- 두 독립 생성 결과: **931,704B / SHA-256 `b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be`**.
- `--retain-gids`로 24,938 GID 슬롯을 남기지만 미선택 outline은 비워진다. 이를 ‘24,938자의 폰트’로 해석하지 않는다. 실제 cmap은 3,394자다. fontkit의 `characterSet` 배열은 종단값을 포함해 3,395로 표시되므로 생성된 cmap 목록을 정본으로 삼는다.
- FontTools RecordingPen으로 3,394코드포인트의 원본 대비 **GID/hmtx/outline 차이 0** (`logs/outline-probe.log`). fontkit 자체 `glyph.path` 진단은 `Unknown op: 17`로 실패했으므로 이를 검증 성공으로 기록하지 않고 FontTools로 대체했다(`logs/fontkit-outline-failure.log`). 제품의 full embed 경로는 그 path API를 호출하지 않는다.

| fixture | 설정 | 원본 PDF B | 보정 PDF B | Poppler 원본 대비 | PDF.js 원본 대비 |
| --- | --- | ---: | ---: | --- | --- |
| sample | 25라벨 / A4 2p; 이름·주소·기호·전각·공백·긴 제목/설명·빈 라벨·NFD·ligature | 3,979,130 | 728,659 | 4,011,288픽셀 중 차이 0 | 차이 0 |
| inventory | 최초 3,095문자 / 155라벨 / A4 7p | 4,742,245 | 1,491,802 | 14,039,508픽셀 중 차이 0 | 차이 0 |
| expanded | 최종 3,394문자 / 170라벨 / Letter 8p | 4,829,717 | 1,579,295 | 15,510,528픽셀 중 차이 0 | 차이 0 |

크기·PDF 결과는 각각 `sizes.json`, `compatible-sizes.json`, `pdf-metrics.json`, `compatible-pdf-metrics.json`, `logs/expanded-pdf.log`. 픽셀 비교는 PNG를 디코드해 RGB 바이트를 전수 비교했으며 허용 오차를 두지 않았다. 단일 glyph 집합과 합성 문자열은 실증한 범위이며 모든 임의 조합의 수학적 증명은 아니다.

### GS/PDF.js 기준의 기존 결함 — 숨기면 안 되는 차이

직접 실행한 렌더 명령은 다음과 같다(각 PDF/페이지에 적용, 명령 원문은 `logs/gs-*.log`, `logs/poppler-*.log`).

```sh
gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pnggray -r144 \
  -dTextAlphaBits=4 -dGraphicsAlphaBits=4 \
  -sOutputFile=/tmp/worklazy-s2b-r1/renders/sample-full-%02d.png \
  /tmp/worklazy-s2b-r1/sample-full.pdf
pdftoppm -r 144 -png /tmp/worklazy-s2b-r1/sample-full.pdf \
  /tmp/worklazy-s2b-r1/renders/poppler-sample-full
```

- GS/Poppler는 다른 구현이다. GS는 **exit 0이어도 원본 전체 OTF PDF부터 한글 tofu/엉뚱한 한자**를 보였다. `renders/sample-full-01.png`와 `renders/poppler-sample-full-1.png`를 직접 열어 확인했다. 보정안 sample GS 차이 7,808픽셀, inventory 60,204픽셀. **GS 정상 렌더 또는 동등이라고 할 수 없다.**
- `node pdf-structure.cjs` → 원본·보정안 모두 PDF descriptor가 **FontFile2**, 그 스트림을 해제하면 magic **OTTO**. 이는 기존 임베드 경계의 진단 단서이며, 이번에 정확한 원인 수리나 PDF 구조 변경을 수행하지 않았다.
- 원본 PDF.js 추출에도 기존 오류가 있다. `김민수 서울 강남구`의 일부 공백이 `堺`로, shaping된 숫자가 `塧塨塩塪`로 추출된다. 단순 subset은 같은 위치가 다른 잘못된 코드포인트가 되며, 보정안은 **원본과 동일한 기존 출력**을 낸다. ‘원본 대비 추출 동일’과 ‘입력과 완전히 동일한 추출’은 다른 게이트다. 정본에서 이 둘을 구분해야 한다.
- 추천은 **감량 범위에서는 Poppler 비회귀+PDF.js 기준값 동등을 채택하고 기존 결함을 명시**하는 것이다. GS·입력 정확 추출까지 새로 보장하려면 별도 임베드 수리 범위와 U4 영향 합의가 필요하다. 이번에는 그것을 고치거나 기존 허용 기준을 조용히 완화하지 않았다.

## 2. 문자 집합·통계·검사 알고리즘

명시 입력은 KS 2,350 + 아래 범위 중 **원본 cmap에 실제 존재하는 것**이다. 최초 요청 3,218 중 123은 원본에도 없어 제외했고 3,095가 남았다. 최종은 원본 매핑 보존 299개를 더한 3,394개다. 생성물 밖의 Unicode를 폰트가 지원한다고 부풀리지 않는다.

```text
0020–007E ASCII printable
00A0–00FF Latin-1
1100–11FF Hangul Jamo
2000–206F General Punctuation
20A0–20CF Currency Symbols
3000–303F CJK punctuation
3131–318E Hangul Compatibility Jamo
FF01–FF60, FFE0–FFE6 fullwidth forms/symbols
+ KS X 1001 현대 한글 2,350
+ 원본 cmap/layout 매핑 보존 299개 (unicodes-alias.txt로 최종 고정)
```

KS 생성은 Python `euc_kr`에서 정확히 `B0–C8 × A1–FE`의 두 바이트만 해독했다. 모든 `euc_kr` 인코딩 가능 문자를 고르는 방식은 확장/조합 처리와 혼동할 수 있어 사용하지 않았다. Unicode Consortium의 **KSX1001.TXT(2011-10-14, table 1.1)**를 내려받아 한글 코드포인트를 독립 대조: **2,350자 동일**. 파일 SHA `d8d2a35206ac0ea2865f5d801c9d6717f735bf46f263a658a64a960abe59e371`; 출처와 라이선스 머리말은 `corpus/ksx1001.raw`에 보존했다. [Unicode 원문](https://www.unicode.org/Public/MAPPINGS/OBSOLETE/EASTASIA/KSC/KSX1001.TXT)

인터넷 접근이 가능하여 한국어 위키백과 3문서 HTML을 실제 다운로드했다. HTMLParser로 `<p>` 텍스트를 모으고 script/style/sup를 제외했으며 공백을 정규화했다. 메뉴·표·제목 전수를 포함한 문서 코퍼스가 아니라 **세 문서의 문단 표본**이다. 최신 판본 고정 URL은 아니므로 raw 파일과 SHA로 이번 측정 입력을 동결했다. 저장소는 `src/locales/ko/*.json`의 **값 문자열** 및 `tests/fixtures/qr-bulk-golden.json`을 별도로 집계했다.

| 표본 | 문자열/문단 수 | 한글 음절 출현 | KS 밖 음절 | 100문자 단위 폴백(최종 coverage) | 연속 25단위 묶음 폴백 |
| --- | ---: | ---: | --- | ---: | ---: |
| 위키 한글 | 77 | 11,714 | 몯 1회 (0.00854%) | 47/178 | 7/7 |
| 위키 대한민국 | 224 | 33,291 | 0 | 20/491 | 7/19 |
| 위키 서울특별시 | 101 | 12,761 | 0 | 27/199 | 6/7 |
| 저장소 ko 로케일 | 2,681 | 38,969 | 0 | 10/626 | 6/25 |
| QR golden | 32 | 121 | 0 | 0/7 | 표본 없음 |

위키 합계 KS 밖 **1/57,766 = 0.001731%**. 그러나 폴백은 **한글이 아닌 문자도 포함한 전체 PDF 배치의 OR 조건**이다. 한자·화살표·℃ 등 때문에 100문자 단위 **94/868 = 10.83%**, 25라벨 묶음 **20/33 = 60.61%**가 전체 폰트로 간다. 실제 주소/이름/품목 분포나 독립 표집이 아니므로 이 값을 제품 사용자 폴백률로 추정하면 안 된다. 텍스트를 연속 100문자씩 자른 수치는 민감도 예시이며 실제 라벨 필드 길이를 관측한 것이 아니다. 현대 한글 문장에는 KS 2,350이 유용하다는 근거는 있으나, 모든 사용자 배치의 감량을 보장하는 근거는 없다.

원문: [한글](https://ko.wikipedia.org/wiki/한글), [대한민국](https://ko.wikipedia.org/wiki/대한민국), [서울특별시](https://ko.wikipedia.org/wiki/서울특별시). 실행 `python3 corpus.py`, `python3 corpus-compatible.py`; 분모·미포함 문자 빈도·묶음 1/10/25/100별 결과는 `corpus-results.json`, `corpus-compatible-results.json`, 추출 문단은 `corpus/*.paragraphs.json`.

검사 제안(공유 pure helper, PDF 측 문자열 정규화와 동일한 `/\s+/gu → ' '` 및 trim):

```ts
const cleaned = value.replace(/\s+/gu, ' ').trim();
const covered = hasEveryCodePoint(cleaned) && hasEveryCodePoint(cleaned.normalize('NFC'));
// 모든 성공 result의 title/description에 적용. 하나라도 false면 전체 OTF.
// 실제 draw 입력을 NFC로 변경하지 않는다. for...of로 코드포인트를 순회한다.
```

- 원문만 검사: `똠`의 세 Jamo는 모두 있는데 결과 똠 글리프가 없어서 오판. 원본 GID `[12908]`, 보정 subset `[23389,23890,24496]`.
- NFC만 검사: `e\u0301`→é는 cmap에 있지만 실제 draw하는 원문 combining U+0301은 subset에 없어 오판. 원본 GID `[70,253]`, subset `[70,0]`.
- **양쪽 검사**: NFD 현대 한글 전수 **11,172종 중 거짓 양성 0**, 8,822종은 full 선택. `한글` NFD는 subset 선택 및 GID 동일. 이는 Unicode 정규화 기능을 사용자 텍스트 수정으로 추가하지 않고도 적용 가능하다.
- 최종 cmap에 말줄임표 **U+2026**를 필수 단언. 제목·설명 밖 QR payload/파일명/group 때문에 full을 선택하지 않는다. 긴 꼬리는 화면에서 잘리더라도 현재 `widthOfTextAtSize`가 전체 문자열을 먼저 처리하므로 검사에서 생략하지 않는다.
- 메인 스레드 호스트 30.686ms는 모바일 상한 증명이 아니다. 검사 비용이 길어지면 예를 들어 8,192코드포인트마다 경과시간을 확인해 8ms 이상이면 태스크를 양보하고 AbortSignal을 확인하는 계약을 둘 수 있다. 새 worker·fontkit 선로드·행 텍스트 복제는 필요 없다. 큰 문자열의 단일 NFC 처리 시간까지 이 수치로 보장하지 않는다.

## 3. sol 구현 계약: 자산 선택·실패·취소

위치는 제안이며 이 문안을 정본에서 확정해야 한다. 새 가벼운 `qrLabelFont.ts`에 coverage 검사·fetch/cache를 두고 **PDF 클릭 시만 lazy import**한다. `qrBulk.ts:18`의 기존 `QR_LABEL_FONT_PATH` 의미는 **전체 OTF**로 보존한다. subset 상수를 별도로 추가한다. coverage JSON은 동일 snapshot의 검증된 생성 입력을 번들에 포함하고 외부 요청으로 선택 전에 추가 fetch하지 않는다. 실행 중 파일 내용을 외부로 보내는 기능은 없다.

`QrBulkPanel.downloadPdf`에서 results/preset/storage를 캡처하고 token/AbortController를 만든다. 선택 뒤 최대 1개 폰트를 요청하며 subset 실패 시만 추가 full 요청한다. helper가 검사·다운로드한 성공 ArrayBuffer만 asset별 메모리 캐시(max 2개 약 5.58MB)에 보관하고 cleanup/unmount에서 해제한다. abort 가능한 pending promise를 서로 다른 export가 공유하지 않는다. PDFDocument/PDFFont를 캐시하지 않는다. HTTP 캐시는 기본 정책을 사용하고 query cachebuster/no-store/SW 변경을 넣지 않는다.

| 상황 | 처리 계약·코드 위치 | 구현 완료 검증 |
| --- | --- | --- |
| 모든 제목/설명 지원 | helper가 subset만 fetch; 명시 empty entry 배열은 panel의 기존 조기 return | subset 요청 1, full 0; PDF 저장/재열기 |
| 빈 title/description이 있는 QR | 빈 문자열 커버=true; glyph 없는 QR도 기존 결과 유지. 라벨 0개와 구분 | 빈 라벨은 정상; 결과 0이면 요청 0 |
| 똠/힣/한자 또는 긴 잘릴 꼬리 | 한 글자라도 밖이면 처음부터 full; subset 선요청하지 않음 | full 요청 1, subset 0, 원본 PDF 기준 동일 |
| NFD 현대 한글 / combining | 원문+NFC 모두 검사. NFC 문자열로 실제 입력을 교체하지 않음 | 위 양성/음성 사례 + 11,172종 판정 전수 |
| emoji/VS/ZWJ/lone surrogate | 코드포인트 검사 실패→full. 원본도 미지원인 문자의 기존 한계는 감량 성공/정상 글리프 보장으로 쓰지 않음. 새로 제거·대체·그림화하지 않음 | `😀`, `❤️`는 full 선택만 단언; ‘이모지 정상 렌더’ 단언 금지 |
| 서브셋 404/503/네트워크 실패 | 자산 획득 helper 범위에서만 full 1회. subset 실패 cache 금지 | 실패 주입 후 full 1회·성공, 다음 사용자 시도에서 subset 재시도 가능 |
| 200 HTML/빈 body/잘린 OTF/다른 snapshot | fetch 성공으로 간주하지 않음. 고정 size·SHA-256 검증 실패를 자산 오류로 분류; subset이면 full 1회 | 네 가지 응답 주입·수신 바이트 해시 검증·오염 cache 0 |
| subset parsing/embed 실패 | `qrLabelPdf`의 font 생성/embedding **좁은 단계**에서 내부 typed font-error를 반환; 그 단계에만 full 1회. 에러를 사용자에게 노출하지 않음 | font-error 주입과 PNG-error 주입을 분리하여 요청 횟수 단언 |
| 둘 다 실패 / full parsing 실패 | 현행 `features:qr.bulk.errors.pdf` ko/en 메시지로 끝내고 exporting 해제. 무한 재시도/빈 PDF 다운로드 금지 | 네트워크 최대 subset+full, 다운로드 0, 다음 클릭 허용 |
| generation/save/render 문제지만 font 초기화 오류 아님 | 임의 font 재시도 금지. 기존 generic PDF 오류. 시각적 파손은 런타임에서 자동 판별할 수 없으므로 vendor/골든 게이트에서 차단 | PNG/storage/save 실패에 full 재요청 0; 렌더 음성 대조는 기본 subset로 실패 |
| abort/unmount/file 교체/재생성 | cleanupResults/useEffect cleanup에서 export controller abort + token 무효화. 모든 await 뒤와 download 직전에 token/signal 검사. AbortError는 조용히 종료, full fallback·오류 안내 없음 | 지연 font 응답·지연 storage·PDF 완료 직전 취소; stale 다운로드 0 |
| 이전 작업 finally가 새 작업과 경합 | token이 여전히 현행일 때만 setExporting/setMessage; storage snapshot 사용, 중간 cleanup 후 refs 재사용 금지 | 취소 직후 재실행 후 새 exporting 상태 유지 |
| 빠른 중복 클릭 | exporting state만 기다리지 말고 active export ref/token으로 동기 가드 | 같은 클릭 묶음에서 export/fetch 1회 |
| PDF helper/생성 청크 import 실패 | 폰트 실패 catch와 분리. S0 `vite:preloadError`/reload 예산을 변경하거나 clear하지 않음. generic export catch는 reload가 불가능할 때의 안내로만 | 실제 청크 실패와 폰트 404 각각 주입; 폰트 404는 reload 0 |
| coverage 입력 파손·누락 | 빌드에서 실패. runtime schema/버전 불일치가 검출되면 coverage 최적화 생략하고 full; 단 dynamic import 실패를 coverage 데이터 실패로 위장하지 않음 | 파일 누락/해시 mismatch 음성 빌드·runtime 값 불일치 |
| 경로/base/caching | 기존 `BASE_URL`+origin 규칙 보존. subset은 새 immutable snapshot 경로로 고정; full 경로 유지; 성공 바이트만 자산별 캐시 | `/`와 하위 base 경로, 반복 PDF, subset→full→subset 캐시 분리 |
| PDF 상한·OPFS | 기존 2,400라벨 상한 유지; 검사 결과를 위해 PNG를 중복 읽거나 모든 텍스트를 큰 문자열 하나로 합치지 않음 | 2,400/2,401 경계·storage 실패·cleanup |
| U4 병합 | QR selector는 U4로 전파하지 않음. 전체 OTF path/size/SHA/OFL 보존, 공용 vendor만 모든 자산 유지하도록 확장 | 전체 OTF 해시 불변·U4 경로 검색·clean vendor 후 양쪽 파일 존재 |

현재 범위에서 완성한 것은 **실험과 계약 제안**이다. 위 HTTP 실패/취소 상태기계를 제품에 구현하거나 테스트한 것으로 주장하지 않는다. 미래 검증 위치: pure `tests/unit/qr-label-font.test.ts`(제안), `tests/qr-bulk-smoke.mjs`의 font 응답/취소 분기, 동일 생성 스크립트 입력을 사용하는 렌더 회귀 하네스. 큰 렌더 시험은 font snapshot 교체 시 실행하고 일반 unit에 매번 무거운 GS 프로세스를 넣을 필요는 없다.

## 4. 벤더 재현성·문서 반영 제안

기존 vendor는 cache 전체 OTF/OFL을 검증한 뒤 **destinationRoot를 통째로 삭제**한다. 바이트 동일한 스크립트 복사본으로 /tmp의 cache/public만 조작해 검증했다:

```text
node /tmp/worklazy-s2b-r1/vendor-repro/scripts/vendor-qr-label-font.mjs
exit: 0
subsetBefore: true
subsetAfter: false
filesAfter: [NotoSansKR-Regular.otf, OFL.txt, manifest.json]
```

따라서 1회 subset을 public에 놓고 끝내면 `npm run build`의 prebuild가 지운다. `logs/vendor-repro.log`의 원본/복사 스크립트 SHA 둘 다 `6af3a1e74656e239437b0ecaab8d77ae69a38367108840d13ca3d0e95beb6328`. 저장소 vendor를 실행한 것은 아니다.

제안하는 재현성 경계:

1. 개발자 명시 regenerate: `scripts/build-qr-label-font-subset.py`(신설 제안), 고정 원본 SHA, KS 매핑/Unicode 목록, toolchain lock를 입력으로 fonttools 실행. 시각의존 timestamp 갱신 금지. outline/layout/name/OFL 유지. 산출 `.otf.gz`와 coverage JSON을 `scripts/assets/qr-label-font/<subset-v1>/` 아래 생성 입력으로 보관·추적한다. 손으로 수정하지 않는다.
2. 일반 Node vendor/prebuild: `scripts/assets`의 고정 gzip SHA 확인 → gunzip → OTF size/SHA와 JSON schema/SHA 확인 → 원본/OFL도 검증 → **모든 입력 성공 후** 산출 디렉터리 교체/manifest 생성. Python/pip 미설치, npm 신규 devDependency 없는 clean checkout에서도 동작하게 한다. public 산출은 이 스크립트만 작성한다.
3. JSON은 같은 source 입력 하나에서 public manifest 및 QR lazy helper가 참조한다(프로젝트 `resolveJsonModule:true` 확인). 별도 수기 문자 목록을 만들지 않는다. 배포 artifact와 runtime manifest의 snapshot/size/SHA가 함께 검증되어야 한다.
4. 원본 전체 snapshot은 현행 유지. subset은 별도 `.../noto-cjk-sans-2.004-ksx1001-v1/` 경로를 제안한다. 라이선스·생성 provenance도 함께 둔다. 기존 URL의 내용을 다른 바이트로 바꾸지 않는다.
5. 독립 2회 동일 SHA는 이 호스트 도구 조합에서 실증했다. 모든 OS/Python 버전에 대한 동일 출력 주장은 하지 않는다. 재생성은 아래 고정 wheel 환경에서 하며, 다른 환경은 결과 SHA가 다르면 실패시킨다. 고정 공급용 `.gz` 검증·전개는 Node로 수행하므로 사이트 빌드가 Python 환경에 종속되지 않는다.

fonttools wheel을 실제 다운로드하고 SHA를 고정했다:

```sh
/tmp/worklazy-s2b-r1/venv/bin/python -m pip download --no-deps --only-binary=:all: \
  fonttools==4.59.2 --dest /tmp/worklazy-s2b-r1/wheels \
  --cache-dir /tmp/worklazy-s2b-r1/pip-cache
```

`fonttools-4.59.2-cp312-cp312-manylinux1_x86_64.manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_5_x86_64.whl` SHA **`738f31f23e0339785fd67652a94bc69ea49e413dfdb14dcb8c8ff383d249464e`**. `requirements-fonts.txt`에 `fonttools==4.59.2 --hash=sha256:...`를 기록했다. 향후 재설치 명령은 `pip install --require-hashes --only-binary=:all: --no-index --find-links <wheels> -r requirements-fonts.txt`처럼 환경/휠을 명시한다. 이번에는 재설치하지 않고 기존 venv를 재사용했다. [fontTools 공식 subset 옵션](https://fonttools.readthedocs.io/en/latest/subset/)

npm ②는 `subset-font@2.4.0`만 고정해도 transitive가 고정되지 않는다. 이번 lock은 harfbuzzjs 0.4.15, fontverter 2.0.0, lodash 4.18.1, p-limit 3.1.0이며 `npm/package-lock.json`을 보존했다. 기본 API에 retain-gids 옵션이 없어 이번 동등성 실험에 통과하지 못했다. ‘HarfBuzz로 원천 불가능’ 판정은 아니며, 저수준 WASM API를 새로 개발하는 대안은 추가 구현/검증 비용 때문에 이번 추천에서 제외한다.

`docs/OFFICE_EDITOR_ASSETS.md`에 넣을 제안 문안:

> QR 라벨 PDF는 고정 전체 OTF와 QR 전용 사전 생성 OTF를 사용한다. QR 제목·설명의 공백 정규화 문자열 및 NFC가 모두 coverage에 포함될 때만 사전 생성본을 선택하고, 이외에는 현행 전체 OTF를 사용한다. U4는 계속 전체 OTF를 사용한다. 두 경로 모두 pdf-lib/fontkit runtime subset을 사용하지 않는다. QR 사전 생성본은 fonttools 4.59.2의 retain-gids 및 원본 cmap/layout 매핑 보존 옵션으로 생성했다. 생성 도구/입력/검증된 압축 산출물은 scripts에 보관하며 일반 vendor는 Node로 고정 산출물을 검증·전개한다. 크기·해시가 다르면 빌드를 중단한다. 원본/OFL은 변경하지 않는다.

문안의 표에 등록할 실측값(생성 입력과 배포 자산의 역할을 구분):

| 역할/파일 | B | SHA-256 |
| --- | ---: | --- |
| 전체 OTF(기존) | 4,644,748 | `69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68` |
| OFL(기존) | 4,301 | `6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2` |
| QR subset OTF | 931,704 | `b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be` |
| subset gzip 생성 입력 | 561,161 | `e1db3cdcbb8d76fc0546ec582bed773b3b7ef3da60867b6828493a6b342c7e66` |
| cmap JSON(이번 실험 배열 직렬화) | 19,616 | `63a25fe8084daf6f58b6596294186a80dbe0e582124000fa50339784600d1ded` |

제품 JSON에 snapshot/schema 등의 필드를 추가하면 JSON size/SHA는 새로 생성·측정해야 한다. 위 JSON 해시를 다른 schema에 억지로 적용하면 안 된다. font 바이트도 레시피/목록/옵션을 바꾸면 새 snapshot과 재검증 대상이다.

## 5. B/C 판정과 검증 인계

B의 브라우저 지원 부정은 현재 근거와 불일치한다. [WHATWG Compression Standard](https://compression.spec.whatwg.org/)에 Brotli가 있고 [MDN BCD 원자료](https://github.com/mdn/browser-compat-data/blob/main/api/DecompressionStream.json)는 Safari 18.4, Firefox 147 지원을 기록한다. 이 둘은 이번 호스트에서 실기기를 구동한 결과가 아니다. 실제 실행한 Chrome 152는 다음과 같다:

```text
node /tmp/worklazy-s2b-r1/browser-probe.cjs
HeadlessChrome/152.0.0.0
brotli.supported: false
Failed to construct 'DecompressionStream': Unsupported compression format: 'brotli'
```

B가 지원되는 환경에서도 전체 폰트 br 절감은 같은 gzip 기준 **554,291B(14.85%)**다. A 보정안의 **3,172,273B(84.97%)**보다 작다. 미지원 환경 full fallback 및 `.br` 응답의 Content-Encoding/애플리케이션 해제 중복을 다룰 계약도 필요하다. 따라서 **B는 기술적 전면 불가가 아니라 이번 목표/대상/복잡도 비교로 미채택**을 추천한다. C는 감량량 0이며 클릭 전 prefetch를 하면 PDF를 받지 않는 사용자까지 폰트를 받는다. 클릭 뒤 선택된 자산과 코드 로드 병렬화는 바이트 감량 결과에 더하지 않는다.

구현 단계에서 반드시 실제 실행할 항목:

- clean copy에서 `npm run vendor:qr-font` 2회·`npm run build`: 전체/subset/coverage 존재와 동일 SHA, Python/network에 기대지 않는 subset 공급, 전체 경로 보존. 프로젝트 prebuild/vendor를 이 저장소에서 실행하지 않은 이번 반박과 구분한다.
- `npm run test:unit`: coverage/NFD·캐시·실패/Abort·token 계약. 실제 선택 함수를 시험하고 음성 대조(단순 cmap 검사)가 실패하도록 한다.
- `npm run test:qr-bulk`, `npm run test:utilities`, `npm run test:static` 및 상위 C-D 게이트. 외부 요청/광고 격리·ko/en·SEO·a11y·CLS·시각 회귀는 사용자 문구가 바뀌지 않아도 지정 검증을 실행한다.
- `npm run measure:qr`: 정상 subset 배치와 밖의 문자 1개를 넣은 full 배치 각각, 새 context·SW 차단·기존 CDP/NetLog 방식으로 네 단계 전송량 기록. subset 손상 fallback에서는 추가 전송 비용도 별도 기록한다. 실제 전송/JS gzip/PDF 출력 크기를 분리한다.
- 기존 `5,153,562B` PDF 단계 값은 identity OTF를 포함한 이전 측정이다. 현 font 크기만 대입하면 약 `1,440,518B`지만 이는 **산술 추정**이며 구현 후 신규 helper/coverage 요청·헤더·청크 변화를 반영한 실제 네트워크 측정이 아니다. 라이브 gzip 3,731,894B와 혼합 계산하지 않는다. 이번에 `measure:qr` 이후 전송량을 실측했다고 주장하지 않는다.
- 기록은 구현 시 CHANGELOG에 코드 변경, review-notes에 이 실측·기각·기존 결함을 Codx 서명으로 이관한다. 이번에는 사용자 금지에 따라 그 두 저장소 문서와 계획서를 수정하지 않았다.

## 종료 선언

**잔여 이견: D1~D6, 6건. [재왕복 필요].** A의 구현 가능성을 뒷받침하는 실물과 보정 문안은 확보했지만, GS/추출의 기존 결함 처리 기준·정확한 charset 및 정규화 검사·자산 생명주기·clean vendor 공급·예외 분류·B 근거 정정을 v2에 반영한 뒤 합의해야 한다. 현재 v1을 [정본화 가능]으로 선언하지 않는다.

종료 불변 검증: `git status --porcelain` 시작/종료 동일, HEAD/main 기준 해시 동일. SHA 대상 **2,912개 중 변경 0**. 시작/종료 manifest SHA-256 모두 `d355d6af53de0397faec32a48c943c7b0670de094ee97470aad8073557ebdb30`. 세 사용자 파일·기존 AGENTS/CLAUDE 변경·dist·jobs 보존. 원문 `start-status.txt`, `end-status.txt`, `start-sha256.json`, `end-sha256.json`, `invariance.json`.
