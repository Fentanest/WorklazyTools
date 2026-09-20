# U4-1 fix-1 신규 unit ↔ 1차 누락 재대조 — Codx

대상 `ba762b4b1cf38b13bef3013aa465e59e33eb9146`, `tests/unit/pdf-finish-modules.test.ts`. `source-audit-repro.log`/`source-audit.json`으로 13개 test와 문자열·PDF.js import를 확인했고, 공통 `unit.log`는 272/272이다. 아래는 커밋된 단언 범위다. 검수용 `/tmp` 골든 통과와 구분한다.

| 시작 줄 | 1차 누락 → 현행 단언 | 판정 |
|---:|---|---|
| 57, 82 | 기존 모서리 표 + 새 실제 생성 PDF 4쪽, visual 크기 4종, 비영점 CropBox, margin 포함 중앙 2개까지 24개 좌표 리터럴. PDF.js 역변환 교차검사 | [통과] E5 핵심 누락 해소 |
| 145 | N1 exact set/번호/표지 하한 유지. `isThumbnailDisabled` 직접 단언은 startPage=1의 1·2쪽뿐. startPage=4의 2·3쪽 disabled 및 disabled toggle 불변은 여전히 없음 | [결함] F5-R; `ignore-disabled-start-page` mutant 생존 |
| 179 | 날짜 23형식 전수·clock 1회·ko/en·중첩 괄호·치환 결과 재파싱 방지 유지 | [통과] 1차의 `file{date:HH}`는 선택적 보강이었으며 미구현을 새 결함으로 세지 않음 |
| 215 | E6-2 10행을 lines/warnings/errors/blocked/font/missing 리터럴로 직접 단언. D8 및 scalar81 포함. 그러나 전체 Helvetica 검사 → Noto 검사 순서 trace는 없음 | [통과] 전처리/coverage 표; [결함] F5-R의 호출 순서. `early-noto-coverage` mutant 생존 |
| 287 | F2 긴 줄/i/빈 줄 narrow 선검사 추가. 폭12 … 및 50×28.8 경고 유지. 6영역 x는 결과의 box/width로 공식을 재계산, y/줄간격 리터럴 없음. 높이10은 여전히 `['A']`만 사용하여 E6의 `80A/B/C` 수평+수직 두 경고를 고정하지 못함 | [통과] F2; [결함] F5-R의 레이아웃 전수. `zero-text-y` mutant 생존 |
| 330 | input 타입 키 검사, 400 생성400회/420 생성0회/override 시도 생성0회/361 생성361회 추가. 비영점 offset은 여전히 없음(offsetX=0, offsetY=0) | [통과] F1/생성계측; [결함] F5-R의 위치. `ignore-nonzero-offset` mutant 생존 |
| 372 | UserUnit2×4회전×3DPI=12행의 width/height/pixels/RGBA/allowed를 리터럴로 단언. B ledger3시점1200/800/200B와 장수·계수·메모리4행 포함. `chooseCanvasDpi.appliedDpi` 기대는 200,200,null뿐. A의 maxArea 독립 실패/4096 경계 단언 없음 | [통과] A 12행/B/F3; [결함] F5-R의 150 하향 성공 및 A 독립 경계. `reject-150-success`, `ignore-max-area` mutant 생존 |
| 486 | 실제 legacy PDF.js CSS viewport와 DPR 적용 bitmap viewport를 사용해 고정 좌표4개×16조합 단언. N2 비율/clamp 유지. `stampPdfCorners`는 여전히 배열 길이4만 단언 | [통과] D7/N2; [결함] F5-R의 corners 좌표. `zero-stamp-corners` mutant 생존 |
| 549 | 정본7단계·order1~7·전체 옵션/default original 유지 | [통과] 기본 계약. 64조합은 이번 별도 goldens에서 전수 통과; 추가 unit 의무로 확대하지 않음 |
| 559 | helper/product export identity 및 대표2 fixture 유지; 실제 helper 정적1줄 + oracle87전수는 전용검증이 소유 | [통과] F4 |
| 577 | `const expected = factory()` 후 20회 반복 | [통과] 결정성 전용. 이 코드를 리터럴 골든 위반으로 세지 않되 누락 골든을 대신한다고 인정하지 않음 |
| 602 | 주입 fixed font, AB…/30pt 리터럴 유지 | [통과] 주입 계약; 다른 레이아웃 좌표 전수를 대체하지 않음 |

`expectation-audit-grep.txt`의 315~317은 결과 box/width로 x를 재계산하고 327은 외부 폰트 측정값과 교차검사한다. 후자는 width/draw 일치 검증으로 유효하다. 새 E5·E6 후보표·A12행·D7 기대 좌표가 제품 함수를 다시 호출해서 생성됐다는 증거는 없으며, D7의 종전 동일 함수 기대 문제는 해소됐다. **남은 문제는 리터럴 단언 자체가 없는 위 계약들이다.**

재현: `python3 /tmp/worklazy-u4-1-review2/mutation-audit.py`. 각 독립 사본에서 `node --test --experimental-strip-types tests/unit/pdf-finish-modules.test.ts` 실행. 다음 7개 모두 **13 pass / 0 fail, exit0**. 동일 계약의 독립 리터럴 probe는 현행 HEAD에서 exit0, mutant에서 exit1이다. 원 저장소와 `head/` 사본은 이 실험에서 변경하지 않았다.

| mutant | 의도적으로 깨뜨린 계약 | 독립 probe 실패 |
|---|---|---|
| `reject-150-success` | A를 만족하는150을 거부 | `null !== 150` |
| `ignore-max-area` | 면적검사 결과를 항상false | `false !== true` |
| `ignore-disabled-start-page` | disabled 판정에서 startPage 하한 무시 | `false !== true` |
| `ignore-nonzero-offset` | offsetX를 항상0 | 실제 x=0/10, 기대5/15 |
| `zero-text-y` | 모든 run의 y=0 | 실제[0,0], 기대[768,753.6] |
| `zero-stamp-corners` | 네 PDF corner 좌표 모두(0,0) | 기대(11,22)/(41,22)/(11,62)/(41,62) 불일치 |
| `early-noto-coverage` | Helvetica 전수검사 전에 Noto coverage 호출 | 실제 H:Русский,N,H:ASCII,N, 기대 H:Русский,H:ASCII,N |

대조군 `control-reintroduce-F2`는 **12 pass / 1 fail, exit1**. 새 narrow-region unit은 실제 결함을 잡는다. 로그는 `mutants/<name>/unit.log`, `head-contract.log`, `mutant-contract.log` 및 `mutation-audit.json`에 있다. **제품에 위 7개 결함이 있다는 뜻이 아니라, F5의 요청된 회귀 보호가 아직 완성되지 않았다는 증거다.**
