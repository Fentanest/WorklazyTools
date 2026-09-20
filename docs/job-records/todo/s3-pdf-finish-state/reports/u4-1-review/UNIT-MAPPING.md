# U4-1 신규 unit ↔ 정본 골든 매핑

기준 `fd37cea`, 파일 `tests/unit/pdf-finish-modules.test.ts`. 전체 271/271, 신규 12/12 통과는 `unit-repro.log`. 아래 누락은 제품 계산 실패와 구분한다. 검수에서만 수행한 /tmp probe는 커밋된 회귀 테스트를 대체하지 않는다.

| # · 시작 줄 | 기존 unit이 실제 단언하는 것 | 정본 대비 누락·약점 | 검수 보충 결과 |
|---|---|---|---|
| 1 · 56 geometry | 수동 viewport 4개·CropBox 모서리 16좌표, 영역 이름 6개, rotation 값 | 6영역 중 중앙 2개 좌표 미단언. margin 적용 좌표·실제 fixture viewport·혼합 visual 크기 미단언. manifest의 rotations/boolean만 읽음 | `goldens.mjs` E5: 24 anchors 및 margin→실제 PDF.js 역변환 일치. `mixed.mjs`: 서로 다른 visual 크기 4쪽/24 anchors 일치 |
| 2 · 81 selection | N1 `2-8+even`→3쪽 toggle exact set/parity/text 전체, canonical, 홀짝, anchor 4/2, cover 하한, 4→5·6→7, `{pages}=10`, 빈 set, 파일별 분리 | startPage=4 하한에서 2·3쪽 disabled와 disabled toggle 불변은 미단언 | `goldens.mjs` N1-D2: 하한·토글 불변·표지 제외로 empty 전부 PASS |
| 3 · 115 tokens | 허용 5·오류 4·보충 14 **전수 23형식**. clock 호출 1회, ko/en 기본 날짜, filename 내부 토큰 재해석 없음, unknown literal+warning, date error, 중첩 괄호 2반례 | 요구된 날짜 골든 누락 없음. `filename={date:HH}`처럼 치환 산물의 잘못된 날짜 재해석 0은 추가 보강 가능 | `goldens.mjs`: 23×100회, file{date:HH} 반례 PASS |
| 4 · 151 text | E6-2 전처리 첫 입력+토큰 입력+NUL/VT/U+0085, D8 3종, A×80+🙂 위치81, mixed 문서 Noto, Helvetica 성공 시 Noto getCharacterSet 0회 | E6-2 10입력 중 `가\r나`, `{foo}`, `{date:foo}`, `\n\n`의 preprocess/coverage 통합 단언 없음. 정상 CRLF/TAB 후보의 coverage·제어오류의 document blocked도 직접 단언하지 않음. 전체 Helvetica 검사 후 Noto 검사 순서 추적 없음 | `goldens.mjs`: 10입력·coverage·순서 `[H:Résumé €,H:Русский,N]` PASS. r6 raw JSON emoji blocked:false는 v7 정본 및 r6 REPORT의 차단 판정으로 정정하여 대조 |
| 5 · 195 layout | 12pt ellipsis width12, 폭5의 **A(폭8.004)** 오류, 폭12 ellipsis만, 폭50/높이28.8의 2줄·AAAA…, 높이10 0줄, 영역 이름 및 x 공식, 여백합 양축 오류, 최종 run width 재계산 일치 | 좁은 영역에 들어가는 짧은 `i`·빈 줄 반례 없음(F2). 각 6영역 y/줄간격의 독립 골든 미단언. 높이10은 E6의 80A/B/C 대신 A 하나라 수평+수직 경고 조합 미단언 | `goldens.mjs`: 원 E6 layout 4행 및 실제 PDF 저장 Tj 입력 PASS. `defects.mjs`: 폭5의 i/빈 줄 오류 누락 재현 |
| 6 · 237 tiles | 400 허용·420 거부·361 허용, gap<0·폭0 거부, rotation -32 | **배치 생성 횟수 미계측**. 제목의 offset 보존은 offset=0만 넣어 비영점 미검증. 최대400을 외부 maximumTiles로 완화하는 반례 없음(F1) | `goldens.mjs`: 예상420은 실제 push 0회, 400은400회. 비영점 offset+rotation PASS. `defects.mjs`: maximumTiles=1000→420개 실제 생성 |
| 7 · 251 canvas | A4 200DPI 1654×2339, A4 150DPI 8쪽 누적17,413,712, 300→200·150까지 실패, 계수인자/호출1회, 경고 경계, 메모리 표 **4행 전수** 및 byte boundary | 실제 viewport rotation/UserUnit, RGBA 값, A maxSide/maxArea의 독립 분기, 300→200→150에서150 성공 미단언. B rawLedger/동시생존 장수·합계 단언 없음(F3) | `goldens.mjs`: 실제 UserUnit2×4rotation×3DPI, A 양분기,150 성공, 메모리4행 PASS. `defects.mjs`: 동시100px+200px 입력1200B 대신800B |
| 8 · 302 stamp | 수동 viewport×DPR2×shrink2 = 16 loop, N2 400×600·600×400·100×10 수치, corners 배열 길이4 | DPR 변수는 assertion 메시지에만 사용. 주입 변환과 기대 모두 **제품의 동일 viewportPointToPdf**라 독립 좌표 oracle 아님. corners의 좌표값 미단언 | `goldens.mjs`: 실제 legacy fixture PDF.js(scale .5), 별도 bitmap viewport(.5×DPR), E5 고정 PDF 좌표 16행 전부 PASS |
| 9 · 339 plan | 7단계 순서, 1~7 order, 모든 옵션true, 기본original | 기본 골든 충족. 조합 중간 enable/입력 불변은 미단언 | `goldens.mjs`: frozen input 64조합 PASS |
| 10 · 349 preflight | helper===product 함수 동일성, fixture on/Type3 2개 allowed/reason/code·반복 | unit은 native strip flag로 실행하므로 새 **plain Node fallback loader**는 실행하지 않음. 87종 전체는 별도 oracle 소유(정상 분업) | `npm run test:pdf-finish-oracle`: plain fallback 실제56/31·양 renderer56. `loader-check.mjs`: plain/native87분류 및 함수SHA 동일 |
| 11 · 367 determinism | 9개 함수 각각20회 값 동일 | 결정성 테스트가 골든 수치 단언을 대체하지 않음. 순서/값이 틀려도 반복해서 같으면 통과 | 모듈별 독립 골든과 병행해서 판정 |
| 12 · 392 injected layout | fixed-width font→AB…/30pt | 주입과 수평 말줄임 계약은 충족. 나머지 E6 전수를 대체하지 않음 | 기존 unit PASS |

수정 지시(F5, P2): 위 명시 누락을 기존 unit에 추가하고, 특히 F1/F2/F3 반례와 D7 실제 fixture/독립 좌표, E6-2 10입력 전체를 회귀로 고정한다. 개수 자체를 늘리는 대신 테이블 기반으로 골든을 전수 단언한다. CHANGELOG/review-notes의 검증 주장은 실제 단언 범위로 갱신한다.
