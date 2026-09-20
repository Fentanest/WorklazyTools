**[검수 통과] — R6-numFmt-style-gap의 새 회귀 두 건과 지시된 기존 Row/Column 사각지대가 해소됐다. 정상 문자열 서식의 새 오탐·거짓 음성, R5 비용 회귀는 재현되지 않았다. 저장된 열 전체 검사는 필요한 선형 비용이며, sol의 세 관측값 차이 전체를 그 순회의 비용이라고 단정할 근거는 없다.** — Codx, 2026-09-07

대상은 `/tmp/worklazy-xr`, 브랜치 `excel-report-width-20260907`, HEAD **`0654fa74bd3e23bba86c1306501c4f9123fde60a`**다. 첫 행동으로 지정 `PROJECT_RULES.md` 전문을 읽고 AGENTS·7차/6차 보고·fix-7 수정 지시·8차 지시·sol 보고·관련 probe/로그/기록을 대조했다. 대상의 열린 작업 문서는 완료 상태 X-A 사본 하나이며 상반 지시는 없다. [시작 상태](start-state.json), [열린 문서 게이트](logs/open-plan-gate.log), [계보](logs/ancestry.log).

검증은 **`git archive 0654fa7` 사본** [source/](source/)에서 했다. 의존성과 vendor는 대상에서 복사했고 새 설치는 없다. unit의 `git ls-files`에 필요한 독립 Git index/metadata만 검수 디렉터리에 만들었다. archive SHA-256은 **`26edb9dc92d27650816f04622ccba8f9abfaaa3f2d3b054a275975b00d896cd6`**다. [준비 코드](probes/setup.py), [준비 출력](logs/setup.log).

아래 명령은 별도 표시가 없으면 `cd /tmp/worklazy-xr-review8/source; source ../env.sh` 환경이다. heap 4GiB·전용 TMPDIR/cache·TEST_SCOPE 미설정을 고정했다. 빌드·브라우저·bundle 내부 빌드와 비용 실험을 직렬 실행했다. preview는 **4380 `--strictPort`**, QR 보조 proxy는 4381이며 종료 뒤 4380~4389 리스너는 0이다. [환경](env.sh), [명령·exit·소요시간 78건](checks.jsonl), [실행 runner](probes/check.py).

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| R6 최소 원본 | **해소** | `python3 ../probes/run-original.py 7 numfmt-gap-safety.mts --test`: 무수정 **2/2**, fail0. fix-6 파일만 bind한 대조는 **0/2**, fail2. [현재](logs/numfmt-gap-safety.log), [R6 mutant](logs/r6-mutant.log) | 없음. 현재 검출력 유지. |
| 원본 13조건 | **통과** | `run-original.py 7 false-negatives-extra.mts`: **13/13** 안전 오류·serializer0·객체 불변. 독립 정상 대조와 목표 속성 접근 계측도 **13/13**. [원본 결과](logs/false-negatives-extra.json), [독립 단언](logs/independent-validation.log) | 없음. 높이 없는 빈 행의 보수적 거부를 현행 malformed 사례로 확대하지 않음. |
| 새 정상 API 사각지대 사냥 | **통과** | `independent-numfmt.mts`: 2·3·9번째 시트의 열/행/빈 행, 열 범위 양 끝, setter/style 혼합 **12/12** 안전 거부. `public-column-model.mts`: getColumn·열 정의·희소 정의·splice·재개방 범위 **5/5**, 최종 열의 위험 서식 검출·serializer0. [독립](logs/independent-numfmt.json), [공개 API](logs/public-column-model.json) | 없음. |
| 정상 서식·값 보존 | **통과** | **11종×5곳=55** Cell/Row/Column 서식 재개방·독립 XML 단언. `columnCount=3`, 저장 열20, 원시 값123 유지. 별도 **16,384열 공통/고유 서식** 두 workbook도 모든 열 서식과 값123 동일. [서식](logs/independent-validation.json), [대폭 workbook](logs/public-column-model.log) | 없음. 날짜 서식의 ExcelJS Date 반환은 값 손실로 판정하지 않음. |
| 빈 값·비문자열·접근자 경계 | **기존 계약 밖 한계 / 비차단** | **68회**, fix-6/fix-7 결과 차이0. 빈 문자열·undefined와 단순 숫자/boolean 등은 XML 손상 없이 처리된다. 금지 문자를 문자열화하는 객체 및 인위적 getter 가림은 양 버전 각10건에서 malformed를 만들 수 있다. **20/20** 독립 XML 실패 part=`styles.xml`, 제품 입력 파서 거부. [경계](logs/independent-numfmt.json), [XML](logs/independent-validation.json), [입력 거부](logs/boundary-input.json) | 이번 string numFmt 수리 확대 불필요. 비문자열 Workbook 모델을 지원하려면 후속 정본에서 허용 타입·강제 변환 여부를 먼저 정할 것. |
| 저장 열 순회 비용 | **정당 / 새 비용 회귀 근거 없음** | 16,384열·16자 서식 중앙값 **1.865ms**, 9시트×16,384열 **16.658ms**, getter 접근 정확히 **2×열 수**, 생성 API0·객체 수 불변. 실제 cleaner workbook의 검사만 분리한 교차 대조도 아래와 같다. [대폭 계측](logs/wide-cost.json), [분리 probe](probes/sparse-backstop-only.mts) | 전체 열 순회를 `columnCount`로 줄이거나 생성 순회로 되돌리지 말 것. 단일 ms를 unit 임계값으로 넣지 않음. |
| R5 동일 희소 입력 | **유지** | 실제 parser→preflight→engine→writer **265.216/735.696ms**, 출력 직후 max RSS **190,040/329,112KiB**. 두 입력 모두 5시트·SR3901/SR19001 재개방, XML/rels14·실제 데이터 시트 Cell4,412/19,512·`spans="512:512"`. [실행](logs/sparse-suite.json), [XML](logs/sparse-xml.json) | 없음. |
| 기존 안전 오류·사용자 안내 | **통과** | `sol-backstop.mts contract`: 값6+Cell 기반 numFmt6 모두 안전 오류·serializer0. production worker의 값·폭·Cell numFmt·Row numFmt·Column numFmt를 각각 주입, **5종×ko/en**, 오류 코드1·현지화 안내·다운로드0·내부 명칭/원시 예외 미노출. [계측](logs/backstop-contract.json), [행](logs/worker-row-numfmt-error.log), [열](logs/worker-column-numfmt-error.log), [Cell](logs/worker-numfmt-error.log), [값](logs/worker-backstop-error.log), [폭](logs/worker-safe-error.log) | 없음. |
| 1~7차 회귀·소비처 | **유지** | 원본 계열·확장2,880·문자1,114,112·3-reader34 workbook/70셀·음성6/양성4·폭/대량/토폴로지·사용자 파일·세 소비처·mutant 재실행. 상세는 아래 표. [원본 묶음](logs/regression-suite.log), [후속 묶음](logs/post-suite.log), [소비처11개](logs/consumer-xml.json) | 알려진 CDATA oracle 한계를 100% 통과로 바꾸어 적지 않음. |
| 변경 범위 | **통과** | `git diff --stat de66637..0654fa7`: **4파일 +60/−2**, backstop10줄·unit·두 기록만. 지정16 blob 및 폭 함수 동일. 나머지 입력 parser·엔진·UI·QR·한도·9시트 코드는 diff 밖. [전체 diff](logs/diff-full.log), [범위](logs/scope.json) | 없음. |
| 기록·1바이트 결론 | **통과** | R6 새 회귀2와 기존 사각지대 분리, P3/제품 도달성 한계, fix-6 상속 표현 보충, `core.xml` 시각 deflate **362→361B**를 정확히 기록. 현재 포함 시각 고정5버전 모두 **54,120B·동일 SHA**. [독립 확인](logs/independent-validation.json), [기록 diff](logs/diff-full.log) | 없음. |
| sol 보고 누락 사고 | **검증 무효 사유 아님** | Claude가 사후 보존한 REPORT를 로그75개·산출물 및 실제 XML과 대조. 최소2·13조건·unit270·희소2·밀집 수치가 남은 증거와 일치하고 이번에 독립 재실행. [대조 코드](probes/audit-sol.py), [대조 결과](logs/sol-evidence-audit.json) | 다음 잡은 `/tmp/.../REPORT.md` 저장·존재 확인까지 인계 완료에 포함. 제품 수리 불필요. |

**R6의 실제 검사 위치.** 원본 probe의 변수/결과 라벨 `fix6`는 변경하지 않았다. 이번 `run-original.py`는 그 import 대상인 `../source`를 **0654fa7 archive로 read-only bind**하므로 해당 13행은 현재 fix-7 결과다. 같은 probe의 `fix5` 대조는 실제 8b5b505 writer이며 별도 결과로 남았다. 이 이름을 실제 기준 해시와 혼동하지 않았다.

추가 [독립 probe](probes/independent-numfmt.mts)는 원본 13개 정상 XLSX를 다시 연 뒤, 지정 위치의 정상 서식으로 writer 성공·재개방을 먼저 단언했다. 이어 그 위치의 `style.numFmt`만 위험 문자열을 반환하도록 계측했다. `column-only-empty-sheet`, `column-hole-before-last-cell`, `only-late-row`, `merged-non-anchor`, dimension-small/large를 포함한 **모든 목표 속성을 실제로 두 번 읽은 뒤** 안전 오류가 났다. 나머지 셀을 위험하게 만드는 setter 전파나 공유 style에 기대지 않았다. 병합 비앵커는 새 style 객체를 대입해 앵커와 분리했다. 원본의 column setter 표본이 Cell에도 서식을 전파할 수 있다는 한계까지 이 추가 실험으로 분리했다.

**저장 컬렉션과 접근자.** 설치된 ExcelJS **4.4.0**에서 `column.numFmt` getter는 바로 `column.style.numFmt`를 반환한다. `worksheet.columns` getter는 serializer의 `Column.toModel(this.columns)`가 쓰는 동일 저장 컬렉션이다. getColumn은 앞의 빈 열을 실제 Column 객체로 채우고, columns setter·fromModel도 밀집 Column 배열을 만든다. 실제 열 범위를 재개방한 경우까지 이 등가성과 위험 서식 검출을 확인했다. [설치본 Column](logs/exceljs-column.js.txt), [Worksheet](logs/exceljs-worksheet.js.txt), [Styles serializer](logs/exceljs-styles-xform.js.txt), [공개 API 재현](probes/public-column-model.mts).

저장 컬렉션 밖 열도 만들 수는 있었다. columns 정의를 교체한 뒤 옛 key로 조회하면 예전 Column 참조가 남는 경우다. 이 객체에 위험 style을 넣어도 **현재 저장 컬렉션과 직렬화 모델 양쪽에서 빠지므로** 출력은 정상이며 위험 서식은 XML에 없다. 이를 검사기의 거짓 음성으로 세지 않았다. 반대로 `Object.defineProperty(column, 'numFmt', {value: undefined})`로 원래 getter를 가리면 style 객체에 있는 문자열이 보이지 않는다. 이 경우는 표준 API 동작이 아니라 호출자가 접근자를 변조한 실험이며 양 버전에서 동일하다.

**비문자열 한계의 정확한 범위.** 검사기는 `typeof numFmt === "string"` 조건 때문에 비문자열을 실제로 건너뛴다. `new String(bad)`, `[bad]`, `{toString:()=>bad}`는 ExcelJS serializer의 `value.toString()`에서 금지 문자가 되므로 공용 writer가 성공 반환하고 `styles.xml`을 깨뜨릴 수 있다. Cell/Row/Column 각3유형 및 getter 가림1유형, **10건×2버전=20건**을 독립 ElementTree와 ExcelJS가 모두 거부했다. 따라서 “어떠한 JavaScript 객체 모델도 안전하다”는 보장은 하지 않는다.

다만 ExcelJS 선언의 Style/Column `numFmt` 계약은 **문자열**이고, 세 제품 소비처 어디에도 박싱 문자열·배열·함수 객체나 getter를 numFmt에 넣는 경로가 없다. 이번 전체 실행 확장자 재귀 검색은 테스트/생성물/별도 writer 소유 경계를 명시했고, 정상 Row/Column XLSX의 실제 cleaner 파이프라인에서도 출력 Row/Column numFmt는 없고 Cell 값123이 유지됐다. 기존 R6 malformed5와 새 경계 malformed20은 입력 파서가 모두 거부했다. **현재 제품 입력의 새 결함이나 fix-7의 검출력 회귀로 채택하지 않으며 배포를 차단하지 않는다.** [재귀 검색](logs/repo-string-boundary-inventory.log), [허용/제외 경계](logs/boundary-inventory-policy.json), [실제 cleaner 도달성](logs/style-gap-reachability.json), [새 입력 거부](logs/boundary-input.json). R6 자체의 심각도는 이전 판정대로 **P3 공용 writer 방어 회귀**였으며 수리됐다.

**비용 판정의 근거와 한계.** 아래 희소 표는 동일 SHA 입력·동일 heap 설정에서 이번에 모두 새 프로세스로 실행한 **실제 출력 단계**다. KiB는 출력 직후 프로세스 max RSS로 입력 파싱 등을 포함하며 backstop만의 할당량이 아니다.

| 입력 / 실제 데이터 시트 셀 | fix-4 대조 | fix-6 대조 | fix-7 |
|---|---:|---:|---:|
| 43,165B / 4,412 | 243.610ms / 200,260KiB | 244.855ms / 186,628KiB | **265.216ms / 190,040KiB** |
| 166,209B / 19,512 | 726.042ms / 330,428KiB | 716.655ms / 324,624KiB | **735.696ms / 329,112KiB** |

첫 입력의 논리 셀은 **1,997,312·warnings=[]**, 큰 입력은 **9,728,512·LARGE_FILE만**이며 한도는 바꾸지 않았다. 두 출력은 60초 제한 안에서 재개방까지 완료했다. 실제 브라우저의 같은 작은 입력도 클릭→완료 **856.903ms**, 5시트·SR3901=3901로 완료됐다. [작은 출력](logs/sparse-3900x512-fix7.log), [큰 출력](logs/sparse-19000x512-fix7.log), [브라우저](logs/sparse-browser.json).

출력 전체에는 workbook 구성·직렬화·압축 등이 섞이므로 위 차이 또는 sol의 **292.689/734.029/153.460ms**만으로 추가 순회의 원가를 확정하지 않았다. 실제 cleaner가 완성한 workbook을 serializer 입구에서 확보해 **같은 객체에 fix-6/fix-7 검사만 순서를 바꿔 10회씩** 실행했다. 작은 workbook 전체는 Row/Cell **3,919/4,474**, 큰 것은 **19,019/19,574**, 저장 열은 둘 다 **538**이고 전후 불변이었다. 데이터 시트 Cell4,412/19,512와 보고서 시트까지 합친 이 수를 혼동하지 않는다.

| 실제 workbook의 검사만 분리 | fix-6 첫 회 / 중앙값 | fix-7 첫 회 / 중앙값 |
|---|---:|---:|
| 작은 희소 출력 | 16.676 / 10.871ms | 21.372 / 9.495ms |
| 큰 희소 출력 | 51.923 / 50.949ms | 55.305 / 44.449ms |

이 계측용 재실행의 `after-output` 시간에는 의도적으로 여러 번 수행한 검사까지 들어 있으므로 정상 출력 시간 표에 섞지 않았다. [작은 원측정](logs/sparse-backstop-only-4474.json), [큰 원측정](logs/sparse-backstop-only-19574.json). JIT·실행 순서의 영향이 있어 “항상 더 빠르다”는 주장도 하지 않는다. **sol 관측 증가분 전부가 저장 열 순회의 비용이라는 인과 주장은 기각한다. 추가 방어의 필요한 비용은 있지만, 지속적인 과도한 회귀는 이 대조에서 재현되지 않았다.**

| Cell 없는 열 서식 표본 | fix-7 첫 회 | 준비 실행 뒤 15개 표본 중앙값 | 계측 numFmt 읽기 / 생성 호출 |
|---|---:|---:|---:|
| 1시트×512열·서식16자 | 1.549ms | 0.092ms | 1,024 / 0 |
| 1시트×4,096열·서식16자 | 1.025ms | 0.471ms | 8,192 / 0 |
| 1시트×16,384열·서식16자 | 2.156ms | **1.865ms** | 32,768 / 0 |
| 9시트×16,384열·서식16자 | 16.599ms | **16.658ms** | 294,912 / 0 |
| 1시트×16,384열·서식1,024자 | 87.542ms | 86.759ms | 32,768 / 0 |

각 표본은 한 번에 3회 검사한 평균을 15개 얻고 fix-6/fix-7 순서를 번갈아 실행했다. 전체 결과·최솟값·최댓값도 보존했다. 문자열 길이를 늘리면 읽어야 할 문자량만큼 비용이 생긴다. 실제 접근 횟수는 열 수에 비례하며 Row/Cell을 생성하거나 열×행 객체를 채우는 동작은 없다. 밀집650,021셀은 sol 동일 probe **118.241/121.262/111.724ms**, 별도 동일 객체 교차 대조에서도 fix-6 **110.542~135.428ms**, fix-7 **110.005~119.666ms**였다. 소수 표본을 일반 성능 비율로 확대하지 않는다. [대폭/밀집 교차](logs/wide-cost.json), [sol 동일 밀집](logs/backstop-dense.json), [희소 객체 단언](logs/backstop-contract.json), [생성 API 차단 실험](logs/no-creation.log).

**정상 보존과 날짜 해석.** 한글·이모지·음악 기호·통화·날짜·숫자·조건부 색·FDD0/FDEF·유효 U+10FFFF·리터럴 `_xFFFE_`를 포함한 정상 서식11종이 다섯 지정 위치에서 유지됐다. 실제 `columnCount=3`보다 뒤인 20열과 높이만 있는75행도 포함한다. 16,384열 두 workbook은 공통 서식/열마다 다른 서식 모두 모든 열을 재개방해 단언했고, Row/Cell은 **1/1→1/1**이다. `Date`로 재개방하는 날짜 서식은 raw XML의 숫자123과 날짜를 Excel serial123으로 환산한 값을 함께 확인했다. CR/backslash의 기존 serializer/parser 정규화도 별도6종 [보존 실험](logs/format-preservation.json)에서 구분했다. 정상 입력을 거부하는 새 오탐은 없다.

| 기존 회귀 항목 | 이번 실제 결과 | 원출력 |
|---|---|---|
| R1·2차 R1·조합·요소·lexical·R3·R4 원본 무수정 | **2/2·2/2·2/2·5/5·32/32·2/2·2/2** | [원본 묶음](logs/regression-suite.log), [원본 SHA](logs/original-probe-sha256.json) |
| 독립 확장 / 문자 전수 | **2,880/2,880 / 1,114,112/1,114,112** | [확장](logs/independent-expanded.log), [문자](logs/characters.log) |
| 3-reader | **34 workbook·70셀**, ExcelJS·ElementTree·LibreOffice 재저장 뒤 값/시트명 유지 | [결과](logs/three-readers.json), [원출력](logs/three-readers.log) |
| 음성 / 양성 / 폭 경계 | **6/6 / 4/4 / [12,13,47,48,48]** | [음양성](logs/data-row-required.log), [폭](logs/core.log) |
| 50,000 / 150,000행 | 생성 **986/2,452ms**, 검사 **70/112ms**, RangeError0 | [대량](logs/core.log) |
| 9시트·13열·토폴로지·뒤 시트 폭 | 기존 조기 탐지와 안전 거부 유지 | [토폴로지](logs/early-exit-topology.log), [생성/검사](logs/performance.log) |
| 소비처 전수 / R4 브라우저 | 다운로드 고유 XLSX **11개**의 폭·헤더·순서, 별도 ko/en×FFFE/FFFF4개 보존 | [소비처](logs/consumer-xml.json), [Playwright](logs/style-playwright.json) |
| 사용자 파일 | **713/37/48/4·9시트·856행·95열·68 col 태그·폭12~48·오류0**, LO Summary99B/9행 | [parser→report](logs/user-files.log), [독립 XML](logs/user-xml-independent.json), [LO](logs/user-lo.log) |
| R3·R4·lexical·R6 mutant | **0/2·0/2·16 pass/16 fail·0/2**, 의도한 결함 검출 | [R3](logs/r3-mutant.log), [R4](logs/style-mutant.log), [lexical](logs/lexical-mutant.log), [R6](logs/r6-mutant.log) |
| 기존 CDATA oracle / scanner·reference | 원본 **2,764/2,880·exit1**, 독립 의미검사 **192/192**, scanner 불일치0. 기존 종료성 **60/60·32/32** | [원본](logs/legacy-matrix.log), [독립](logs/legacy-cdata-semantic.log), [scanner](logs/scanner-cost.log), [reference](logs/reference-cost.log) |

**기록과 1바이트 판정.** `docs/review-notes.md`의 R6 절은 표준 문자열 `style.numFmt`의 **새 회귀 두 건**과 fix-5부터 있던 마지막 Cell 밖 열/빈 시트 열/높이 있는 빈 행의 사각지대를 분리한다. 높이 없는 빈 행 style의 비직렬화도 명시했다. 기존 fix-6의 “행·열 상속도 계속 검사” 표현은 실제 Cell에 복사된 여섯 표본에 대한 설명으로 제한했다. P3·세 소비처의 Row/Column style 비복사·입력 단계 거부가 모두 적혀 있다. CHANGELOG는 코드 변경 한 줄이며 Codx 서명이다. UI·ko/en 문구·SEO/정적 입력·광고 배치와 격리·GitHub Pages 구조·의존성은 diff 밖이라 동반 코드 수정이 필요하지 않다.

7차 결론도 다시 실제 파일로 확인했다. 54,122B와54,121B의 압축 해제 차이는 **`docProps/core.xml` 한 part의 created/modified 시각뿐**이고, 그 원문은 양쪽746B, deflate는362/361B다. 현재 fix-7까지 시각 고정5개 버전이 모두 **54,120B**, SHA **`570145eea9ff218a7ac2fb32d3e4fdceac89f52e4b4dee6093110bc654d8b2e5`**다. 누락이나 유령 Cell 제거로 해석할 여지가 없으며 byteLength 하나를 불변 계약으로 삼지 않는다. [독립 검증 코드](probes/validate-independent.py), [결과](logs/independent-validation.json).

| 공통 검증 명령 | 실제 결과 | 원출력 |
|---|---|---|
| `./node_modules/.bin/tsc -b` | exit0 | [tsc](logs/tsc.log) |
| `npm run test:unit` | **270/270**, fail0·exit0 | [unit](logs/unit.log) |
| `npm run build` | **2,835 modules·61 정적 페이지**, exit0 | [build](logs/build.log) |
| `npm run test:static` | startup recovery **104문서**, exit0 | [static](logs/static.log) |
| `npm run test:excel-compare` | exit0 | [비교](logs/excel-compare.log) |
| `npm run test:excel-cleaner` | R4 브라우저 포함 exit0 | [정리](logs/excel-cleaner.log) |
| `npm run test:qr-bulk` | 첫 실행 exit0·기존 경합 재발0/1 | [QR](logs/qr-bulk.log) |
| `npm run test:browser` | TEST_SCOPE 미설정 전체 Excel·Word·PDF exit0 | [browser](logs/browser.log) |
| `npm run bundle:measure` | **80 JS/1 CSS**, 측정 명령 exit0 | [bundle](logs/bundle.log) |
| `npm run css:orphans` | orphan0·exit0 | [CSS](logs/css-orphans.log) |
| `node tests/tool-registry-routes.mjs` | **20 route**, 누락/초과/중복0·exit0 | [routes](logs/registry.log) |
| `git diff --check de66637..0654fa7`, `5bc6854..0654fa7`, 대상 worktree | 모두 exit0 | [실행 코드](probes/scope8.py), [결과](logs/scope-corrected.log) |

**하네스·예외 출력의 분리.** sol의 REPORT 누락은 인계 산출물 누락이었다. 사후 저장된 REPORT의 존재 자체를 과거 실행 증거로 삼지 않고, 남은 로그·sparse 실제 ZIP/XML·13조건/객체 수·270개 unit 원출력과 대조했다. 이 증거들이 보고와 일치하며 이번 필수 검사도 직접 실행했으므로 검증 무효 사유는 없다. 다음 인계는 REPORT 저장·존재 확인을 포함하면 된다. sol의 기존 R2-R1 artifact bind 누락·LO pipe 오류는 최초와 정정 로그가 보존되어 있고 이번 동일 원본 실행도 통과했다.

이번 자체 하네스 실패는 두 건이다. 정상 날짜 서식의 숫자123을 ExcelJS가 Date로 반환하는 것을 고려하지 않은 기대값 오류는 [최초](logs/independent-numfmt.log)를 보존하고 XML 숫자/Excel serial을 함께 검사한 [정정](logs/independent-numfmt-corrected.log)으로 통과했다. scope 보조 코드가 존재하지 않는 `src/features/spreadsheet-core/types.ts`를 참조한 것은 [최초](logs/scope.log)·[정정](logs/scope-corrected.log)으로 분리했고 제품 코드와 원본 probe를 바꾸지 않았다. CDATA exit1은 기존 oracle 한계, 네 mutant exit1은 기대 실패다. LibreOffice javaldx/dconf 경고는 원출력에 남기고 파일 존재·XML·값 단언으로 판정했다. 미해결 필수 검사 실패는 없다.

**불변 증명.** [시작](start-state.json)과 [종료](end-state.json)의 HEAD·branch·main은 같고 `git status --porcelain=v1`는 모두 빈 문자열이다. 대상 **추적2,376파일 변경0**, 기존 검수/sol probe·artifact·log·입력·열린 문서 등 **보호3,523파일 변경0**, archive의 **2,376파일도 원 archive와 바이트 차이0**이다. [SHA 대조](state-comparison.json), [포트 종료](logs/ports-final.json). 필수 첫 `PROJECT_RULES.md` 읽기 외 원 워킹트리 `s3-pdf-finish` 작업물과 `/tmp/worklazy-dc-impl`에는 접근하지 않았다. 사용자 입력은 이전 검수 안전 사본을 SHA 대조해 사용했다. 대상 추적 파일 수정·커밋·push·브랜치 전환·병합·배포는 하지 않았다. 이번 새 파일과 산출물은 모두 `/tmp/worklazy-xr-review8/`에 있다. 추적 기록 파일은 수정 금지이므로 이 보고서를 Claude 취합 입력으로 남긴다.

**배포 후보 판정과 통합 인계.** **0654fa7을 검수 통과·배포 후보로 확정한다.** 종료 시 main은 **`cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be`**로 재확인했다. 공통 기준 `5bc6854` 이후 main과 대상 브랜치의 **실행 코드 교집합0**, 공통 파일은 **`CHANGELOG.md`·`docs/review-notes.md` 두 개**다. [현행 교집합](logs/merge-intersection-final.json).

통합 담당은 **`ac9cc4a → 64af7b3 → cbe491a → 3270512 → 88fa10e → 8b5b505 → de66637 → 0654fa7`** 계보를 보존하는 **머지 커밋**으로 main에 통합하고 두 기록 파일을 취합할 것. **후속 Excel 중복키·머리글 계획보다 먼저 통합**한다. main이 달라지면 해시와 교집합을 다시 검사한다. 이 검수의 승인은 브랜치 산출물에 대한 것이며 병합 후 검사를 대신하지 않는다.

병합 뒤 tsc/unit/build/static·Excel 비교/정리·QR·전체 browser·원본 R1~R6·희소2개/행열서식/문자보존·사용자 파일·폭/토폴로지/소비처·bundle/CSS/routes/diff를 재검사한다. 특히 **`tests/document-diff-equivalence.mjs`·`tests/unit/document-diff-golden.test.ts`·실제 DOCX/HWP 비교 결과·토글 회귀**를 포함해야 한다. 배포 전 로컬 시각 검수는 공통 배포 규칙에 따라 별도로 수행한다.

`s3-pdf-finish`가 배포 뒤 main을 한 번 동기화할 때, 이번 폭 브랜치가 추가하는 예상 공통 충돌 표면은 **두 기록 파일의 취합**이다. 접근 금지된 진행 중 U4-4의 작업물은 열지 않았으므로 그 실제 코드 충돌 여부를 측정했다고 주장하지 않는다. 동기화 시 현행 변경과 충돌을 확인할 것.

**[검수 통과]**
