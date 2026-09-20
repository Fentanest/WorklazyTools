**U4-4 fix-2 3차 재검수 — Codx / gpt-6-astra — 2026-09-08**

대상은 `s3-pdf-finish`의 `5a9d5b7b5c570ffa7ebb190b23f2e8d4d2aa4a2b`이다. 판정은 **[수정 후 재검수]**다. 의존 패치·응답성·A3·접근성 수정의 검증과 별개로, 새 PDF.js 표시 자산의 중복 배포와 번들 측정 누락(P2)이 남아 U4-5 착수 게이트를 통과시키지 않는다.

검증 사본은 `git archive 5a9d5b7`로 만든 [repo](repo)이며 실행·fixture·렌더·보고서는 모두 이 보고서의 상위 `/tmp/worklazy-u4-4-review3/` 안에 있다. 원 저장소에는 구현 변경·커밋·push·브랜치 전환을 하지 않았다. 선독은 PROJECT_RULES.md → AGENTS.md → 본인의 review2 → fix2 지시서 → sol 보고서 → 정본 계획서 및 기각 이력 순으로 수행했다. 19개 열린 계획서도 읽기 전용으로 확인했으며 이번 작업은 검수만 수행한다.

**새 결함 P2 — `.mjs`로 추가된 표시 런타임이 예산 게이트에서 빠진다**

정상 PDF를 워터마크 화면에 올려 미리보기를 만드는 제품 경로에서 도달한다. `src/features/pdf-editor/pdfPreview.ts:2`는 `pdfjs-dist`를 main 청크에 정적 포함하고, `pdfThumbnailRender.worker.ts:3,35`는 같은 버전의 표시 API 전체를 `pdf.min.mjs?url`로 다시 배포·로드한다. main 청크 `PdfEditorPage-BUwMpJ21.js`에 `pdfjs-dist/build/pdf.mjs` 모듈이 실제로 들어 있음을 Rollup 모듈 메타데이터로 확인했다. 그 모듈의 renderedLength는 845,715B다(독립 rendered gzip은 배분 가중치이므로 실제 청크 크기에 합산하지 않았다).

새 `assets/pdf.min-DNQlQ5cq.mjs`는 **454,673B / gzipSync 기본값 130,427B**, SHA-256 `a678944e8b233ef4ebe832ad08ff3ede55e8a7fee8c3e03a4f622a8caa5c6c5c`다. `scripts/measure-bundle-budget.mjs:92`의 `!relativePath.endsWith(".js")`가 이 실행 자산을 제외한다. worker 본체의 1.67kB만으로 비용을 설명하거나 “표시 런타임 중복 없음”이라고 기록할 수 없다. `docs/review-notes.md:15`와 sol 보고의 해당 주장은 기각한다.

[probes/bundle-review.mjs](probes/bundle-review.mjs)는 저장된 정식 production 측정값에 **이 새 파일 하나만 메모리에서 추가**한 뒤 원래 `compareWithBaseline`과 상한을 그대로 호출한다. 기준선·측정기·제품 파일은 수정하지 않았다. 기존 `pdf.worker.min.mjs`는 이전에도 동일 SHA로 존재하므로 전체 크기를 신규 증가로 더하지 않았다. [결과](evidence/bundle-review.json):

```text
Bundle budget exceeded: sharedJsGzip 133495 > +30720; appJsGzip 164213 > +81920.
```

| 예산 항목 | 현행 scoped 보고 증가 B | 새 표시 자산 포함 증가 B | 상한 B | 잔여 B |
|---|---:|---:|---:|---:|
| entry | 7,177 | 7,177 | 20,480 | 13,303 |
| PDF route | 22,750 | 22,750* | 61,440 | 38,690* |
| shared net | 3,068 | 133,495* | 30,720 | **-102,775*** |
| app net | 33,786 | **164,213** | 81,920 | **-82,293** |
| CSS | 235 | 235 | 10,240 | 10,005 |

\* 현행 측정기의 소유자가 없는 opaque public 자산 규칙으로 shared에 넣은 값이다. 새 자산을 PDF route로 귀속하면 route/shared 분배는 달라지지만 **app 초과는 바뀌지 않는다**. QR 509,380B + image 414B = 509,794B의 기존 route→shared 이동은 원래 규칙대로 상쇄했다. gzip은 측정기와 같은 Node `gzipSync(bytes)` 기본값을 썼다. 탐색 단계 Python level9 값 129,510B는 최종 예산 계산에 쓰지 않는다.

수정 지시 문안: “모든 배포 실행 자산(`.js`·`.mjs`, URL import와 worker 의존성 포함)을 inventory와 gzip 총계에 넣어 확장자에 따른 누락을 제거한다. 기준선도 동일한 자산 범위로 검증하고 변경 전부터 존재한 동일 SHA는 신규 증가로 세지 않는다. main/worker가 표시 런타임의 동일 배포 자산을 공유하도록 구성하는 등 실제 중복을 줄인 뒤 상한·배수·override를 바꾸지 않고 5종 예산을 재측정한다. worker 제거만으로 비용을 줄이는 안은 32/64MiB 응답성 목표 실패 때문에 채택하지 않는다. 실제 네트워크 자산과 inventory 완전성을 회귀로 고정하고, 의존 패치 네 빌드·렌더·fallback·11+128MiB 성능·legacy oracle을 재검수한다. ‘중복 없음/5종 통과’ 기록을 정정한다.”

무범위 비교기도 그대로 실행했다(전체 lazy route를 지정한 원래 비교 함수 호출). 결과는 `baseline.perRouteJsGzip.audio-studio must be a finite non-negative integer (bytes).`이며 **PASS가 아니다**. `npm run bundle:measure` 전체 무범위 명령을 통과했다고 주장하지 않는다.

**의존 패치 안전성**

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| 의존 패치 의미·픽셀 | 통과 | `node --experimental-strip-types probes/render-matrix.mjs` + `node probes/render-scalar.mjs`;4빌드×180,새 회귀0,기존 tail77픽셀 교정 | scalar/tail 회귀 기준 보존 |
| 패치 최소 범위·hash | 통과 | `node probes/dependency.mjs`;4파일×2치환,그 외 바이트차이0 | 없음 |
| unknown hash/version fail-closed | 통과 | 격리본 `npm run build`5음성→exit1/Vite전 중단;재적용0 | 미지 버전 자동 허용 금지 |
| 생성물 경로·버전 고정 | 통과 | script 재생성,원본/패치 SHA일치;lock resolved6.2.108·타 패키지변경0 | 현행 재현 경로 유지 |
| upstream 대안 | 패치 유지 의견 | 공식6.3.289/master 원문에도 동일2지점 미수정 | upstream 수정 릴리스 후 별도 갱신 게이트 |
| worker 중복·번들 | **P2 수정 필요** | `node probes/bundle-review.mjs`;app164213>81920 | 본문 수정 지시 적용 |
| worker fallback | 기능 통과 | Worker부재/생성예외→preview·download 성공;제거32/64MiB heartbeat208/364ms | fallback 응답성 한계 명시 |
| 성능·128MiB 확장 | 목표 통과 | 본인11개+3개×3회,worker제거6회;128MiB까지 준선형 | 측정 구간·환경·실측값으로 기록 |



공식 npm `pdfjs-dist@6.2.108` tarball을 별도로 내려받아 해제한 원본과 대조했다. 네 파일 각각 정확히 두 번의 선언된 치환만 존재한다. 전체 설치 패키지 대조에서도 이 네 파일 이외 차이와 추가 파일은 0이다. [dependency.json](evidence/dependency.json), [패키지 전체 대조](evidence/pdfjs-entire-package-diff.json).

| 빌드 | 원본 SHA-256 | 패치 후 SHA-256 | 판정 |
|---|---|---|---|
| `build/pdf.mjs` | `487bde1bcf89e041f791173d0509a1dc18d0feb6655d78395e1611f9da0de17d` | `e0fac5c8abfe978d550ea1efc23bcd384bb4c9e1e5c91e13084cbb6d0ca69812` | 2회 치환만, 일치 |
| `legacy/build/pdf.mjs` | `842284e0d1d439e60701e3355c2128cd3016ebebf14220e27f512467682aad66` | `36644d07144713ca05f8749012cf174afc7c94a50b08efd6966442741d830004` | 2회 치환만, 일치 |
| `build/pdf.min.mjs` | `e0be3863c23c8af2305b16548febd58e7f8874a460253317d7771cddbc1c0f6d` | `a678944e8b233ef4ebe832ad08ff3ede55e8a7fee8c3e03a4f622a8caa5c6c5c` | 2회 치환만, 일치 |
| `legacy/build/pdf.min.mjs` | `9fab0c910bf1484835c5c2aeb68f7eb3dfce7f9eb435a004526c5af86d70890c` | `377bcc2a9ca97fb68fcd6137955be0c8538573c02a708933121281c2f5f68da3` | 2회 치환만, 일치 |

`convertRGBToRGBA`의 32-bit bulk 부분은 이미 `srcPos`를 반영한다. 남은 0~3픽셀 루프도 같은 청크의 위치에서 시작해야 하므로 `srcPos + i * 4`가 맞다. 원본 `i * 4`는 뒤 청크에서 이전 입력을 다시 훑으며 목적지 범위를 넘어선 쓰기를 시도하고, 일부 마지막 청크에서는 tail 색도 틀릴 수 있다. little/big endian 두 분기의 동일 위치 수정은 원래 API의 입력·출력 위치 계약을 보존한다.

`node --experimental-strip-types probes/render-matrix.mjs`를 실제 Chrome에서 실행했다. DeviceGray/RGB/CMYK/CalGray/CalRGB의1/2/4/8/16bit, Indexed1/2/4/8bit, ImageMask1bit를 W/H=7×15,8×16,7×17,17×31,8×32,17×33으로 조합한180개를 modern/legacy×full/min의 원본·패치 각각 렌더했다(**1,440렌더**). RGBA 전체 SHA가 네 빌드 사이에서 동일하다.147개는 패치 전후 정확히 같고,33개는 마지막1~3픽셀, 합계77픽셀만 달라졌다. “전후 픽셀 차이0”은 사실이 아니다.

이 차이는 정상 입력을 잘못 바꾼 회귀가 아니라 원본의 잘못된 tail 수정이다. 별도 `node probes/render-scalar.mjs`에서 원본 변환 함수만 단순한1픽셀씩 복사하는 독립 scalar 기준으로 교체한 **실험용 HTTP 응답**을180개 다시 렌더했다. 제품 설치 파일은 변경하지 않았다. **패치 네 빌드 모두 scalar 기준과 RGBA 차이0**, 원본은77픽셀 불일치다. DeviceGray/RGB8bit는 생성한 원시 sample 공식과도 직접 비교하여 불일치0이다. 예를 들어7×17 Gray8의 마지막3값은 입력대로247/28/65가 맞는데 원본은 첫 행 쪽167/204/241을 잘못 사용한다. [독립 기준 결과](evidence/render-scalar.json), [tail 그림](render/matrix/tail-oracle.png).

Poppler24.02.0도180페이지 전부 렌더(exit0/오류로그0)했다. 이 저해상도 이미지에 대한 Poppler 픽셀은 resampling으로 원시 sample과 다르므로, 전체 L1거리만 보면33개 중15개가 패치 후 오히려 커진다. 이를 숨기거나 새 회귀라고 단정하지 않았다. 위 원시 sample·독립 scalar·모든 빌드 일치로 차이의 원인을 판정했다. LE와 모의 BE, width1/2/3/4/5/7/8/17/31, height1/15/16/17/31/32/33, srcPos0/4/48/384의**504개 변환 호출**도 scalar 값·반환 src/destPos·범위 밖 sentinel 불일치0이다. [전체 비교 데이터](evidence/render-matrix.json), [명세](render/matrix/manifest.json), [실행 로그](logs/stage4-render-matrix-chrome.log).

[probes/dependency.mjs](probes/dependency.mjs)를 실행하여 격리한 패키지 사본에 음성 주입 후 **각각 `npm run build`를 실제 실행**했다. 알려지지 않은 source hash, 6.2.109 버전, 원문 치환 횟수 3, 이미 패치된 치환 횟수 3, 잘못된 결과 hash 모두 **exit 1, Vite 시작 전 중단**했다. 원본 적용과 재적용은 exit 0이다. 상세 오류는 `logs/patch-*.log`에 보존했다.

`package.json`의 범위만 `^6.2.108`→`6.2.108`로 좁아졌고 lock의 resolved/version/integrity는 동일하다. 다른 lock 패키지 변경은 0이다. prepare/dev/prebuild 스크립트 경로로 적용되며 archive 재빌드가 재현된다. 수기 생성물 변경은 이 검수에서 없고 최종 패키지 바이트도 선언된 패치로만 설명된다. 과거 작업자의 모든 수동 명령 이력까지 Git만으로 증명한다는 뜻은 아니다.

2026-09-08 확인한 공식 최신 배포는 [PDF.js 6.3.289](https://github.com/mozilla/pdf.js/releases/tag/v6.3.289)(2026-08-29)이다. [해당 태그의 image_utils.js](https://github.com/mozilla/pdf.js/blob/v6.3.289/src/shared/image_utils.js)와 [현재 master](https://github.com/mozilla/pdf.js/blob/master/src/shared/image_utils.js)에도 같은 두 remainder 시작점이 남아 있다. 최신 버전으로 올리는 것만으로 이 결함은 해결되지 않는다. 원문 사본은 `evidence/upstream-*.js`, 릴리스·npm 응답은 `evidence/upstream-latest-release.json`, `evidence/npm-pdfjs.json`에 저장했다.

유지 방침 의견: 현재의 좁은 exact-version/hash 패치를 유지하되 upstream 수정 릴리스가 확인되면 별도 정본 작업으로 갱신한다. 원본/패치 hash, 4개 빌드, LE/BE 변환 oracle, RGB tail/색 공간 렌더, 미지 hash 실패, worker/fallback, 기존 소비처 회귀를 갱신 게이트로 유지한다. API 변경(예: 권한 반환 타입 변화)도 함께 검토한 후 패치와 훅을 제거한다. 이번 검수에서 의존 버전 갱신이나 외부 이슈 발송은 하지 않았다.

**성능 — 독립 재측정**

[probes/performance.mjs](probes/performance.mjs), [48회 원시 측정](performance/measurements.json), [fixture 크기·SHA](performance/fixtures.json), [중앙값](performance/summary.json). 본인의 review2 원본 11개 PDF를 그대로 사용하고 128MiB, 폭1024의16MiB, 폭8192의raw1MiB를 더했다. 14입력×3회=42회, worker 제거32/64MiB×3회=6회다. Chrome 152.0.7977.64, 1280×900/DPR1, 무 CPU·네트워크 throttle, 매회 새 context, QA production4272다. heartbeat는 파일 change 시각부터 20ms interval의 실제 간격으로 측정하고 Long Task와 구분했다.

| 입력(해제 데이터 크기) | n | 미리보기 ms | 총 처리 ms | preview 단계 최대 heartbeat 중앙값 ms | preview 단계 최대 Long Task 중앙값 ms |
|---|---:|---:|---:|---:|---:|
| raw-1024 | 3 | 442.932 | 450.569 | 40.835 | 0.000 |
| raw-10240 | 3 | 455.366 | 461.886 | 41.750 | 0.000 |
| raw-65536 | 3 | 461.560 | 468.957 | 44.225 | 0.000 |
| raw-204800 | 3 | 467.892 | 480.373 | 37.910 | 0.000 |
| raw-1048576 | 3 | 492.286 | 498.803 | 47.130 | 0.000 |
| flate-1MiB | 3 | 501.424 | 509.102 | 42.635 | 0.000 |
| flate-4MiB | 3 | 542.753 | 549.999 | 40.515 | 0.000 |
| flate-8MiB | 3 | 599.925 | 606.930 | 41.065 | 0.000 |
| flate-16MiB | 3 | 714.930 | 1793.385 | 42.680 | 0.000 |
| flate-32MiB | 3 | 1001.629 | 2217.921 | 52.840 | 0.000 |
| flate-64MiB | 3 | 1508.889 | 3490.867 | 63.060 | 60.000 |
| flate-128MiB-w8192 | 3 | 2430.074 | 6221.281 | 85.565 | 70.000 |
| flate-16MiB-w1024 | 3 | 715.843 | 1755.108 | 43.310 | 0.000 |
| raw-1MiB-w8192 | 3 | 481.093 | 488.724 | 47.175 | 0.000 |
| fallback/flate-32MiB | 3 | 933.766 | 940.927 | 208.420 | 180.000 |
| fallback/flate-64MiB | 3 | 1407.584 | 1414.804 | 363.680 | 335.000 |

총 처리는 16/32/64/128MiB 및 폭변형16MiB에서 업로드→실제 생성·다운로드까지 포함한다. 작은 입력과 worker 제거 대조의 total은 preview 확인까지이므로 서로 다른 작업 범위의 total을 섞어 곡선을 만들지 않았다. 이 표의 heartbeat/Long Task는 upload→preview 측정 구간이다. worker 사용42회 해당 구간 전체 최대 heartbeat도 **91.900ms**로 목표200ms 이하다. 64MiB Long Task 중앙값60ms, 128MiB70ms(전체42회 최대77ms)로 sol의 “11개 모두0”까지 재현되지는 않았지만 응답성 상한 실패는 아니다.

16→64MiB 총 처리 비는 **1.9465**, 64→128은 **1.7822**, 16→128은 **3.4690**다. 4점 선형 적합은 약 `40.2174 ms/MiB + 1017.82 ms`, R²=**0.99680**이다. 128MiB까지 측정한 범위에서 준선형 판정에 부합한다. 모든 크기·장치에 대한 점근적 보장은 아니다. [곡선 PNG](performance/curves.png), [SVG](performance/curves.svg), [적합값](performance/curve-fit.json).

worker 제거 대조의32/64MiB heartbeat는 **208.420/363.680ms**로 목표를 넘는다. 원래 보고219/387ms와 방향이 재현된다. 별도 실제 브라우저에서 Worker 미지원과 thumbnail worker 생성 예외를 각각 주입하면 source preview ready·다운로드가 성공한다. fallback은 기능적 호환 경로이며 큰 입력의200ms 응답성 보장으로 해석하지 않는다.

곡선의16/32/64MiB와 확장128MiB·폭변형16MiB에서 preview canvas·overlay1개·실제 다운로드를 모두 확인했다. [probes/output-validity.mjs](probes/output-validity.mjs)를 다시 실행해 source14개를 Poppler로 읽고, 다섯 대형 입력의 source/download를 PDF.js·Poppler 양쪽으로 렌더했다. 다섯 출력은 각각 source와 PDF.js1,798픽셀/Poppler1,936픽셀 차이로 워터마크가 추가됐으며, source 검은 도형을 보존한다. PDF.js source/output 잉크6,400→6,996, Poppler6,561→7,191로 빈 결과가 아니다. [독립 렌더 결과](evidence/output-validity.json), [대표 출력](render/validity/flate-16MiB-output-poppler.png). 정상 inline corpus도 Poppler101페이지·exit0·stderr0이다. uncertain-underflow 사례의 기존 그래픽 상태 경고와 잉크0은 별도로 남겨 정상 corpus와 혼합하지 않았다.

전체 작업 구간을 빠뜨리지 않도록 최종 **production** 빌드를4273 strictPort로 다시 열고, `node probes/performance-total.mjs`로16/32/64/128MiB를각3회 추가 측정했다. 이12회는 마지막 다운로드 바이트를 확인한 뒤 heartbeat/Long Task를 수집한다. 외부 요청은 interception 처리했다. 이전 QA 곡선과 섞지 않은 독립 보완 측정이다.

| 입력 | n | upload→preview ms | upload→download ms | 전체 최대 heartbeat 중앙값 ms | 생성 구간 heartbeat 중앙값 ms | 전체 최대 Long Task 중앙값 ms |
|---|---:|---:|---:|---:|---:|---:|
| flate-16MiB | 3 | 656.615 | 1614.535 | 135.870 | 135.870 | 119.000 |
| flate-32MiB | 3 | 888.280 | 1824.135 | 58.055 | 58.055 | 0.000 |
| flate-64MiB | 3 | 1461.665 | 3052.250 | 71.965 | 53.570 | 52.000 |
| flate-128MiB-w8192 | 3 | 2417.635 | 5549.860 | 174.685 | 174.685 | 167.000 |

전체 구간12회 중 최악의 heartbeat는 **188.965ms**(목표200ms 이내), 최대 Long Task는172ms다. 단지 preview만 빨라졌다는 이유로 전체 처리까지 통과 처리한 것이 아니다. 각 출력은 실제 다운로드 바이트까지 존재한다. [전체 구간 원시값](evidence/performance-total.json), [중앙값](evidence/performance-total-summary.json), [실행 로그](logs/performance-total.log).

**양보·취소·수명주기**

256B token, 64KiB scan, 1MiB Flate 경계를 코드와 실제 타이머로 검증했다. 단순 resolved Promise가 아니라 macrotask 양보 뒤 abort를 재확인한다. [engine-corpus](evidence/engine-corpus.json)의 4MiB 다섯 스트림에서 setTimeout abort가 실행되고 AbortError로 종료했다. 내부 scanner/inflater를 직접 호출한 [yield-inner](evidence/yield-inner.json)는 token/literal/comment/unknown-inline/inflate/library-fallback 모두 타이머 이벤트1~2회, AbortError다. 타이머 도달11.8~115.8ms, abort후 응답0.275~3.470ms. 이 내부 probe는 원본 함수 본문 복사에서 import 경로 수정과 private export만 추가했으며 제품 코드는 바꾸지 않았다.

[퍼징·타일 취소](cancel-fuzz.json): 1,256사례 종료; 400타일 direct abort25.601ms·취소 신호 후0.343ms, 새 content 등록false. full engine abort51.463ms·신호 후0.158ms, 재시도 성공. [리소스·등록 계약](contracts-new.json): 이미지 XObject1개를 single/tile/300tile에서 재사용(Do1/18/300), 폰트 로드/descriptor 각각1, 기존 중복 reference 순서 보존, validator 네 음성 입력 거부, consent 및 분할 불가 구간의 결과 미등록 계약 유지.

[실제 브라우저 lifecycle](performance/lifecycle.json): 검사 취소 UI81.365ms/외부 CDP press→UI12.628ms, preview취소 UI91.969ms/press→UI14.917ms로250ms 이내다. 두 경우 canvas0·staleResult=false·detachedDraws=[]·재시도 성공. 파일교체 UI303.534ms는 새 입력 준비 시간이며 취소250ms 측정값으로 혼용하지 않았다. unmount UI61.763ms, 잔존 canvas0. 파일교체 후 새 canvas1, staleResult=false, detachedDraws=[], 재시도 성공.

더 확실한 교체 대조도3회 수행했다.128MiB400×600 gray 문서가 **rendering**인 상태에서200×200 흰 문서로 교체하고3초 기다렸다. 세 번 모두 최종 canvas520×520/유색픽셀0, staleSource=false, staleResult=false였다. 이전 큰 미리보기가 늦게 덮어쓰지 않는다. 같은 네트워크 기록에 main `PdfEditorPage` 청크와 새 `pdf.min-DNQlQ5cq.mjs` 요청이 함께 남아 번들 중복의 실제 제품 도달성을 뒷받침한다. [lifecycle-contrast](evidence/lifecycle-contrast.json), 재현 `node probes/lifecycle-contrast.mjs`.

**A3·오탐·A8·P3 재현 판정**

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| 597B EI 원본 | 통과 | `node probes/browser-contracts.mjs`; ko/en risks0, 실제 download1,433B. `node --experimental-strip-types probes/render-new.mjs` 및 두 렌더러 확인 | 없음 |
| 회전 이탈·1픽셀 | 통과 | 회전45°/offset180은 empty-placement. 0°/offset199는 생성 허용, PDF.js·Poppler 모두 빨강1픽셀 | 양성 대조 계속 보존 |
| 공백·줄바꿈 ko/en | 통과 | 실제 필드 오류 empty-text, 생성 disabled, 네 브라우저 사례 | 없음 |
| uncertain clip | 통과 | underflow-line은 위험1+동의 후1,376B 출력. underflow-zero는 동의 후에도 watermark-clipped 결과 실패·download0 | “완전한 가시성 판정”으로 확대하지 말 것; 현행 review-notes:33에 한계 명시됨 |
| 정상 inline payload | 통과(한계 명시) | `node --experimental-strip-types probes/engine-corpus.mjs`;101개 모두 생성 성공, 오류0. G/RGB/CMYK/IM,1/2/4/8/16bit, W/H·행 padding, CRLF·긴키·Decode·명명 색 공간·escaped name·Indexed·ASCIIHex·Flate | benign5개는 uncertain 경고·동의를 거친다. 경고0/완전지원으로 기록하지 말 것 |
| A8 실제 F2 DOM 귀속 | 통과 | text/image/risk/error 고유 target 미귀속0. 실제 image label+helper에 gradient 주입 시 incomplete2개 모두 f2-watermark, shared54 그대로 | 이 DOM 음성 대조 유지 |
| A8 감사기 거부 | 통과 | 실제 위2개를 전체 감사 보고에 반영해 원래 assertAccessibilityResults 실행→F2 incomplete 오류. selector 미발견/invalid 즉시 오류. 기존6개 음성 mutation 모두 거부 | 없음 |
| A8 일반 QA12페이지 | 범위 통과 | violations0, F2 incomplete0, inherited925, 외부요청0; placeholder 대비4.8871 | inherited925는 기존 부채로 유지, 전체 사이트 접근성 해결 주장 금지 |
| P3 Helvetica 두줄 tile 상단 | 통과 | `node --experimental-strip-types probes/bbox-controls.mjs`;상단+20px control과 잉크량 동일. PDF.js 14520/10972/14520/10972;Poppler16137/12208/16137/12208 | 폰트·간격 축소 없이 상단 클립 해결 |
| P3 내부 구현 명칭 | 통과 | ko/en 실제 disclaimer에서 PDF.js·UserUnit0 | 없음 |
| A4 영어 모바일 | 통과 |320/390px 실제3tabs·scrollWidth≤clientWidth, documentWidth=viewport. 각 tab높이56px | 없음 |

정상 corpus 중 경고가 난5개는 named-gray, escaped-names, indexed, asciihex, flate-inline이다. 해당 fallback은 정확한 payload 길이나 그래픽 상태를 확정하지 못할 때 동의를 요구하지만 새 hardblock을 만들지는 않았다. uncertain line의 최종 잉크가0일 수 있는 한계는 유지된다. 확실한 zero rectangle만 실패시키는 정책과 양립한다.

[브라우저 계약](evidence/browser-contracts.json), [실제 DOM 음성 집계](evidence/a11y-dom-negative.json), [6개 음성 mutation](a11y-aggregation-negative.json), [A8 전체](a11y.json), [렌더 A3](render-new.json), [Helvetica](bbox-controls.json), [시각 기준선24개 개별 판정](visual-inspection/INSPECTION.md).

**회귀 명령과 실제 결과**

공통 `NODE_OPTIONS=--max-old-space-size=4096`; 빌드·브라우저·시각회귀는 직렬이다. `npm` 명령 cwd는 archive의 `repo/`, 자체 `node probes/*`는 보고서 상위 디렉터리다. 브라우저는 `TEST_BASE_URL`과 각 스크립트 환경 변수로 지정한4271(초기 production)/4272(QA·최종 production)/4273(전체 처리 구간 추가 측정)를 사용했다. Vite 서버는 `--strictPort`. 정확한 각 단계 인자·환경은 [regression.py](probes/regression.py), [stage2.py](probes/stage2.py), [stage3.py](probes/stage3.py), [stage4.py](probes/stage4.py)에 보존했다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| 타입 검사 | 통과 | `npx tsc -b`, exit0 | 없음 |
| unit | 통과(환경 보정 후) | `npm run test:unit`,318/318 | archive에 Git 이력이 없어 처음316/318. 아래 재현 환경 설명 참조 |
| PDF finish/A1/A4/A5/A6/A7 | 통과 | `npm run test:pdf-finish`,16직접경로·48preview·재선택6·숫자표현8·동일탭2·새출력10·ko/en 오류·타일취소·재시도 | 없음 |
| 골든 | 통과 | 위 명령에 포함,128image+32text=160/160, PDF.js·Poppler | 없음 |
| legacy oracle | 통과 | `npm run fixtures:pdf-legacy-oracle`,client3/structure4/render32/output4/input1, diff0,2회 확인 | 없음 |
| 기존 PDF4모드 | 통과 | `TEST_SCOPE=pdf npm run test:browser`,exit0; legacy none/numbers/watermark/both 동등 | 없음 |
| 전체 browser·문서 비교 | 통과 | `npm run test:browser`,exit0 | 없음 |
| 신규 도구·utility·office | 통과 | `npm run test:new-tools`, `npm run test:utilities`, `npm run test:office`,각0;office95downloads | 없음 |
| QR | 통과 | `npm run test:qr-bulk`, `npm run test:qr-font-render`,각0;3폰트fixture Poppler diff0·추출동일 | 없음 |
| 복구 | 통과 | `npm run test:recovery`,147pass | 없음 |
| Excel 회귀 | 통과 | archive에서 `npm run test:excel-cleaner`, `npm run test:excel-compare`,각0 | 다른 검수 워크트리는 접근하지 않음 |
| 도구20 | 통과 | `node tests/tool-registry-routes.mjs`,20·missing/unexpected/duplicate0 | 없음 |
| CSS·legacy manifest | 통과 | `npm run css:orphans`,0; `npm run legacy:manifest`,155중153removed/0split/2active | manifest는 Git 이력 환경 보정 후 재실행 |
| a11y | 범위 통과 | `npm run test:a11y`,위반0/F2 0/inherited925/외부0 | 기존 부채 유지 |
| CLS | 통과 | `npm run test:rendering`,7페이지×3회,모든표본<0.1,외부0 | 최대값과 중앙값을 구별하여 기록 |
| 번들5종 scoped | **수정 필요 P2** | `npm run bundle:measure` 자체는0이지만 `.mjs`누락. `node probes/bundle-review.mjs`로 동일 비교기에서 shared/app 초과 재현 | 앞의 수정 문안 적용 |
| 무범위 비교기 | **실패 유지** | 원래 비교기 전체route호출→audio-studio 기준값 오류 | PASS로 기록하지 말 것 |
| production 최종 빌드·정적 | 통과 | `npm run build`,exit0/2,847modules/69정적페이지; `npm run test:static`,exit0/startup116 | 없음 |
| 광고 격리 | 통과 | `node probes/production-ads.mjs`;production ko/en PDF 각각ads script1,video/office/xls-preserve 각각0 | 외부 요청은 interception으로 응답, 실제 광고 서버에 보내지 않음 |
| 시각 회귀 | 통과 | `LANG=ko_KR.UTF-8 npm run test:visual`,211/211; `LANG=en_US.UTF-8 npm run test:visual`,211/211;각exit0/직렬 | 기존 기준선은 수정하지 않음 |
| 변경 기준선24개 | 개별 타당 |24쌍 모두 직접 확인;안내 문구와 ko 모바일 추가 줄에 따른 위치 이동만 존재 | `visual-inspection/INSPECTION.md`에 파일별 판정 |

시각 명령의 LANG 두 실행은 각각211개 ko/en 혼합 시나리오 전체를 수행했다. 따라서 서로 다른 언어별211개로 과장하지 않는다(총422회 캡처). 허용 차이≤0.100%, per-pixel threshold0.1, antialiasing 제외, footer 첫 span만 허용영역이라는 기존 조건을 유지했다. CLS는 finish계열 중앙값0.0001480366이며 **최대 표본0.0116484111**(page-numbers/header-footer)도0.1 미만이다. sol의 “계열 max0.0001480366” 수치 자체까지 재현된 것은 아니다.

[회귀 실행 이력](evidence/regression.json), [stage2](evidence/stage2.json), [stage3](evidence/stage3.json), [stage4](evidence/stage4.json)와 각 `logs/`에 원시출력을 보존했다. 첫 archive의 unit2건·legacy manifest는 `git show`/`git ls-files`에 필요한 Git 메타데이터 부재로 실패했다. `GIT_DIR=/home/better0101/projects/worklazytools/.git GIT_WORK_TREE=/tmp/worklazy-u4-4-review3/repo GIT_OPTIONAL_LOCKS=0`으로 **읽기 전용 이력 조회만 연결**해 재실행했고 통과했다. 추적 제품 파일을 고쳐 테스트를 통과시킨 것이 아니다.

처음 matrix를 Node22 modern 빌드로 실행할 때 Promise.try와 Uint8Array.toHex API 부재로 probe가 실패했다. 최종 비교는 제품과 같은 실제 Chrome에서 원본/패치 네 빌드를 각각 로드해 수행했으며 제품 polyfill은 추가하지 않았다. 이 초기 실패 로그도 삭제하지 않았다. QA4270 서버의 strictPort 충돌을 발견한 첫 성능 실행은 유효측정0건 상태에서 폐기하고 중단했다. 기존 listener를 건드리지 않고4272에서 새 서버의 자산 SHA를 확인한 뒤48회를 처음부터 수행했다. 허용 범위 밖 포트·금지된 다른 작업 디렉터리는 사용하지 않았다.

**다음 단계와 저장소 불변**

U4-5(F3 도장·서명)는 이번 P2 수정 정본화→sol 구현→astra 재검수→Claude의 잔여0 게이트 판정 후 착수할 수 있다. 앱 예산은 현재82,293B 초과이므로 F3에 가용 예산이 남았다고 잡으면 안 된다. 기존925개 공유 접근성 부채는 해당 후속 계획에 계속 귀속한다.

main `597a92ff56ed9c3eb23755a58df2580b0269b8bd`와 merge-base `5bc6854175331bdd73b267784d9633cdccda8446`를 기준으로 읽기 전용 `git merge-tree`를 실행했다. 양쪽 변경 파일은 CHANGELOG.md·docs/review-notes.md·package.json이다. 텍스트 충돌은 앞의 두 기록 파일에서 재현되고 package.json은 자동 합병된다. 실제 병합은 하지 않았다. 나중에 동기화할 때 양쪽 기록을 보존하고 package 스크립트/정확 의존 고정 및 새 변경과 함께 전체 게이트를 다시 확인해야 한다. [충돌 표면](evidence/main-overlap.json).

`git diff --stat 15bad33..5a9d5b7`:57 files changed,1,417 insertions(+),160 deletions(-).24개 시각 기준선과11개 성능fixture를 포함한다. `git diff --check` 통과. [범위](evidence/scope-stat.txt), [전체 diff](evidence/scope.diff).

[시작 snapshot](evidence/start.json)과 [종료 snapshot](evidence/end.json)의2620개 추적 파일 SHA-256을 모두 비교하여 **변경0**, HEAD·브랜치·git status 동일을 확인했다. archive의 해당2620개 파일도 시작 사본과 SHA 차이0이다. `git diff --check 15bad33..5a9d5b7`는 exit0([출력](logs/diff-check.log)). [불변 판정](evidence/invariance.json), 재현 `python3 probes/invariance.py`. 시작부터 있던 untracked4항목(after.docx/before.docx/naver…html/newui/)은 상태를 유지했고 내용에 접근하지 않았다. 감사 소유 서버는 종료했으며 금지된 다른 워크트리와 포트4350~4359는 접근하지 않았다.

환경: Node22.17.1/npm10.9.2, Chrome152.0.7977.64, Playwright1.63.0, Poppler24.02.0, axe4.13.0. 모든 보고 산출물은 `/tmp/worklazy-u4-4-review3/`에 저장했다. REPORT.md 저장 뒤 파일 존재·크기·참조 링크를 최종 확인했다.

**[수정 후 재검수]**
