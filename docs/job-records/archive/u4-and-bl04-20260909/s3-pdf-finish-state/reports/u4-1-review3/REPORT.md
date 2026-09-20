# U4-1 fix-2 재검수(3차) — Codx

**최종 판정: [검수 통과].** F5-R 회귀 7건과 R-DOC 기록 출처는 해소됐다. **2차 원본의 7개 변이 각각 unit exit 1, 12 pass/1 fail**을 현재 HEAD 사본에서 재현했고, 실패 지점은 추가한 단언과 일치한다. 정상 unit **272/272·finish 13/13**, TypeScript 진단 0, diff-check 0이다.

**하네스 대조 결과는 별도 유의사항이다.** sol 조정판은 **경로만 변경한 것이 아니다**. 종료코드 단언을 변경하고 F2 대조군을 제거했다. 이 사실을 지시 준수 이탈로 기록한다. 이번 판정 근거는 원본 변이·probe·단언을 유지하고 F2 대조군까지 복원해 실행한 독립 결과다. 원본의 과거 생존 기대 단언에서 발생한 AssertionError도 원출력에 보존했다. 따라서 “조정판의 판정 로직 무변경”은 승인하지 않으며, **F5-R/R-DOC 해소 여부는 원본 재현 증거로 통과 판정**한다. 추가 제품·unit 수리가 필요한 결함은 없다.

- 대상 브랜치: `s3-pdf-finish`
- HEAD/fix-2: `f56dc68d4c53d58cad520fe41973cd2699a4f548`
- fix-2 기준: `ba762b4b1cf38b13bef3013aa465e59e33eb9146`
- main: `5bc6854175331bdd73b267784d9633cdccda8446`
- 모든 상대 산출물 경로는 `/tmp/worklazy-u4-1-review3/` 기준이다.

## 실행 게이트·범위

첫 행동으로 `PROJECT_RULES.md` 전문을 읽고 `AGENTS.md`, review3/fix2 dispatch, 2차 `REPORT.md`·`UNIT-MAPPING.md`·원본 `mutation-audit.py`와 변이 산출물, sol `commands.json`·원로그·JSON·실제 adjustment diff를 읽었다. 관련 정본 N1/D2/D3/N3·기각 이력과 review-notes U4-1 절을 대조했다.

HEAD·브랜치·main은 지시서와 일치한다. `open-plans-scan.txt` 및 `plan-contract-scan.txt`로 열린 계획서와 관련 계약을 확인했으며 이번 unit·기록 검수와 상반된 현행 지시는 없다. 로드맵 말미의 오래된 `3672fc7/main5485fad` 문구는 같은 행의 최신 U4-1 진행 기록·dispatch·실제 ref와 불일치하므로 기준으로 사용하지 않았다.

`git archive f56dc68d4c53d58cad520fe41973cd2699a4f548`로 `head/`에 전개하고 기존 의존성을 **복사**했다. 설치하지 않았다. 사본 **2,543개 추적 파일 SHA-256 불일치 0**이며 검증 종료 뒤에도 동일하다(`copy-integrity.json`, `invariance.json`). TypeScript cache·npm cache·unit fixture·변이 산출물은 모두 `/tmp`에 위치한다. unit의 `git ls-files`에는 원 Git 객체와 별도 `/tmp` index를 사용했다.

```text
$ git diff --stat ba762b4..HEAD
 docs/review-notes.md                  |  36 +++++-----
 tests/unit/pdf-finish-modules.test.ts | 125 ++++++++++++++++++++++++++++++----
 2 files changed, 131 insertions(+), 30 deletions(-)

$ git diff ba762b4..HEAD -- src/
<출력 0바이트, exit 0>
```

지시된 좁은 범위에 따라 **build·bundle·oracle·브라우저 스모크·static은 생략**했다. 제품 코드·의존성·실행 스크립트·UI·한국어/영어·SEO·정적 생성기·광고 경로 변경 0이 근거이며, 이번에 생략한 명령을 실행했다고 주장하지 않는다.

## 항목별 판정

아래 `M <name>`은 `python3 /tmp/worklazy-u4-1-review3/run-original-case.py <name>`을 뜻한다. 전체 재현은 `python3 /tmp/worklazy-u4-1-review3/run-mutations.py`다. 각 변이는 원본과 동일한 한 식 변경이며, 각 사본의 커밋된 unit 파일 SHA는 정상 HEAD와 같다. `mutants/<name>/`에 `product.diff`·`unit.log`·`head-contract.log`·`mutant-contract.log`·`result.json`을 보존했다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| F5-R 150DPI 성공 | **통과** | `M reject-150-success`: unit **exit1,12/1**, 새 단언 `pdf-finish-modules.test.ts:480`에서 `appliedDpi:null` 대 기대150·supported/decision 불일치. 정상/변이 probe **0/1**. 요청300의 attempts `[300,200,150]`, applied150, supported=true, `use-lower-dpi`가 리터럴 | 없음 |
| F5-R maxArea 독립 경계 | **통과** | `M ignore-max-area`: unit **exit1,12/1**, **495줄**에서 area=false/allowed=true 대 기대true/false. probe **0/1**. 100×100/maxArea9999 → pixels10000·side=false·area=true·allowed=false, 4096² 허용·4096.01 한 변 거부가 리터럴 | 없음 |
| F5-R startPage 하한 | **통과** | `M ignore-disabled-start-page`: unit **exit1,12/1**, **159줄** `false !== true`. probe **0/1**. 155~169줄에 startPage4+excludeCover, `[4,6,8]`, 2·3쪽 disabled, 3쪽 toggle 객체 identity 유지, 표지 제외 empty 경계 고정 | 없음 |
| F5-R 6영역/여러 줄 | **통과** | `M zero-text-y`: unit **exit1,12/1**, **337줄**의 y=0 대 기대16.8/2.400000000000002. probe **0/1**, 독립 y `[768,753.6]` 보호. 335~362줄에 E6 50×10/28.8와 6영역 12개 run의 text/width/x/y·lineHeight 리터럴. 상세 아래 | 없음 |
| F5-R 타일 offset/rotation | **통과** | `M ignore-nonzero-offset`: unit **exit1,12/1**, **413줄**에서 x=0/10 대 기대5/15. probe **0/1**. 20×20·타일10×10·gap0·offset5/5·rotation30 → `(5,5),(15,5),(5,15),(15,15)` 및 각rotation30 리터럴 | 없음 |
| F5-R stamp corners | **통과** | `M zero-stamp-corners`: unit **exit1,12/1**, **641줄**에서 (0,0)들 대 네 기대 좌표. probe **0/1**. stamp(10,20,30,40), 주입변환(x+1,y+2) → `(11,22),(41,22),(11,62),(41,62)` 리터럴 | 없음 |
| F5-R Helvetica→Noto 순서 | **통과** | `M early-noto-coverage`: unit **exit1,12/1**, **311줄** 실제 `H:Русский,N,H:ASCII,N` 대 리터럴 `H:Русский,H:ASCII,N`. probe **0/1**. 기존 noFallback Noto0회 단언도 **320줄**에 유지 | 없음 |
| F2 원본 대조군 | **통과** | `M control-reintroduce-F2`: unit **exit1,12/1**, **328줄** `i`의 narrow-region 위반 검출; probe **0/1**. 원본 control 단언은 통과해 driver exit0 | 없음 |
| 하네스 경로 한정 여부 | **불일치 확인; 독립 재현으로 근거 보완** | `python3 …/run-mutations.py`: 원본/sol mutation tuple **7/7 동일**, supplied diff와 실제 diff 동일, **pathOnly=false**, 원본8종→sol7종, `p.returncode==…0`→`p.returncode!=0`. `harness-provenance.json`·`actual-sol-adjustment.diff` | “경로만 조정·판정 로직 불변”으로 기술하거나 승인하지 말 것. 본 원본 재현 결과·F2 대조군·종료코드 구분을 감사 근거로 인계. 제품·unit 추가 수정 없음 |
| 정상 회귀 | **통과** | `python3 …/run-checks.py`: `npx --no-install tsc -b --pretty false` **exit0**, `npm run test:unit` **272/272**, finish 직접 실행 **13/13**, 모두 fail/skip/cancel0 | 없음 |
| R-DOC·CHANGELOG | **통과** | `python3 …/records-audit.py`: `ls` **exit0**, 기록 인용 경로9개 존재. 원구현271/12, fix1 원로그0 명시+review2 272/13, fix2 원로그272/13·명령 정보 존재, artifact missing=[], Codx 서명. CHANGELOG 기존 U4-1 한 줄과 정합·diff0 | 없음 |
| 변경 범위·공백 | **통과** | `git diff --stat ba762b4..HEAD`: 지정2파일만. `git diff ba762b4..HEAD -- src/`: **0바이트**. `git diff --check`, `git diff --check ba762b4..HEAD`: **exit0**, 각각0바이트 | 없음 |
| 저장소·선행 증거 불변 | **통과** | `python3 …/finalize.py`: refs/status/index 동일, tracked **2543/2543**, 원dist+사용자파일 **540/540**, 선행 감사 증거 **288/288** SHA동일. head 사본도2543/2543 동일 | 없음 |

## 리터럴 기대값 판정

`git diff ba762b4..HEAD -- tests/unit/pdf-finish-modules.test.ts`와 해당 파일을 직접 읽었다(`logs/scope-diff.log`). 일곱 회귀군의 기대 배열·객체·숫자·문자열·boolean은 코드에 고정돼 있다. 입력 viewport 함수·주입 font/변환 함수와 실제 결과의 `map`은 검사 대상을 구성하거나 실제값을 투영하며, 기대값을 생성하지 않는다. disabled toggle의 `strictEqual(originalState)`는 요청된 **동일 객체 유지** 계약이다.

6영역의 실제 box는 입력으로 쓰며, 종전처럼 `region.box.x + (region.box.width - run.width) / 2`로 기대값을 계산하는 단언은 제거됐다. 새 6영역 기대값은 다음과 같다(AB width16.008, CD width17.328):

| 영역 | 첫 run (AB) x,y | 둘째 run (CD) x,y |
|---|---|---|
| top-left | 30,768 | 30,753.6 |
| top-center | 291.996,768 | 291.336,753.6 |
| top-right | 553.992,768 | 552.672,753.6 |
| bottom-left | 30,54.4 | 30,40 |
| bottom-center | 291.996,54.4 | 291.336,40 |
| bottom-right | 553.992,54.4 | 552.672,40 |

lineHeight 기대는 JS 표현의 `14.399999999999999` 리터럴이다. `80A/B/C`, 50×28.8의 두 run은 `AAAA…/44.016/y16.8`, `B/8.004/y2.400000000000002`로 고정했다. 같은 후보의 50×10은 runs=[]와 `['horizontal-overflow','vertical-overflow']`를 모두 단언한다. 제품 함수나 결과 box로 기대 좌표를 재산출하지 않는다.

## 원본 감사 실행 방식·sol 변경 판정

원본 `/tmp/worklazy-u4-1-review2/mutation-audit.py` SHA-256:

```text
f9d557ea888b3ae6af757c1b54ae8a8cf803aeaf0b862b4c05c92ff63044922f
```

원본은 review2 경로에 쓰고 **7개 변이가 살아 있던 상태를 증명**하는 스크립트다. 그대로 전체 실행하면 옛 사본을 감사하며 선행 증거를 덮어쓴다. 따라서 `run-original-case.py`는 원본 AST의 초기 선언과 **원본 For 노드 자체를 변경 없이** 실행하고 `out/head/TMPDIR`을 review3로 바꾼다. 첫 생존 기대 실패가 나머지 실험을 중단시키지 않도록 원본 목록에서 한 case씩 별도 프로세스로 실행한다. 원본 mutation 한 식·독립 probe·unit 명령·TAP 파싱·두 assert를 모두 유지했다. 원본 파일과 선행 mutants는 변경하지 않았다.

```text
원본 55줄: assert outcomes=={'head':0,'mutant':1},row
원본 56줄: assert p.returncode==(1 if name.startswith('control-') else 0),row
```

7개 모두 unit exit1과 정상/변이 probe 0/1을 먼저 기록하고 **원본 56줄의 옛 생존 기대에서 AssertionError/driver exit1**로 종료했다. 이는 현재 unit이 변이를 잡았다는 결과다. 이를 숨기거나 unit exit0으로 바꾸지 않았다. `logs/original-<name>.log`에 실제 traceback을 남겼다. F2 대조군은 원본부터 unit exit1을 기대하므로 driver exit0이다.

외부 집계 `run-mutations.py`는 각 unit **exit1·pass12·fail1**, probe **0/1**, 원본 traceback 위치, unit SHA와 제품 한 식 diff를 검사해 전체 exit0을 냈다. 이를 원본 스크립트 전체가 exit0인 것으로 표현하지 않는다. 명령·cwd·환경·각 exit는 `mutation-commands.json`, 실제 행 결과는 `mutation-audit.json`에 있다.

sol의 실제 diff(`/tmp/worklazy-u4-1-fix2/logs/mutation-audit-adjustment.diff`)는 경로 외에 ① F2 대조군 삭제 ② 기존 생존 기대를 `p.returncode != 0`으로 교체 ③ 최종 메시지 변경을 포함한다. 제공 diff와 실제 스크립트 diff는 timestamp header 제외 동일하다. **경로 한정이라는 전제는 반박한다.** 다만 이 종료코드 변경은 수정 지시의 “7개 각각 unit 비영”을 집계하는 방향이며, 7개 mutation/probe 자체는 완전히 동일하다. 본 검수는 제거됐던 대조군까지 원본 그대로 재실행해 모두 의도한 AssertionError임을 확인했으므로 F5-R 결과 조작·잔여 회귀 누락으로 판정할 근거는 없다. 이 이탈은 기록하고 검증 근거를 보완한 상태로 종결한다.

dispatch의 adjustment diff 경로 표기는 `logs/`를 생략한 약칭이었다. 실제 `commands.json`은 존재하는 `logs/mutation-audit-adjustment.diff`를 정확히 가리킨다.

## 공통 검증 원출력·R-DOC

`checks.json`에 명령·cwd·환경·exit·시간을, `logs/tsc.log`·`logs/unit.log`·`logs/finish-unit.log`에 원출력을 보존했다. TypeScript는 캐시된 tsbuildinfo를 사본에서 제거한 뒤 실행했다. 진단은0이며 npm 업데이트 notice 208바이트는 원로그에 남겼다. 설치·업데이트는 수행하지 않았다. Node strip 실험 경고도 숨기지 않았다.

재현 환경(cwd `/tmp/worklazy-u4-1-review3/head`):

```bash
export NODE_OPTIONS=--max-old-space-size=4096
export TMPDIR=/tmp/worklazy-u4-1-review3/tmp
export GIT_DIR=/home/better0101/projects/worklazytools/.git
export GIT_WORK_TREE=/tmp/worklazy-u4-1-review3/head
export GIT_INDEX_FILE=/tmp/worklazy-u4-1-review3/head.index
export GIT_OPTIONAL_LOCKS=0
export npm_config_cache=/tmp/worklazy-u4-1-review3/npm-cache
export npm_config_offline=true
npx --no-install tsc -b --pretty false
npm run test:unit
node --test --experimental-strip-types tests/unit/pdf-finish-modules.test.ts
```

R-DOC는 실제 `ls -ld`/`ls -la` 출력(`logs/records-paths.log`, `logs/records-listings.log`)과 각 단계 TAP·커밋별 finish test 이름을 대조했다(`records-audit.json`).

| 단계 | 원출력·확인 결과 |
|---|---|
| 원구현 fd37ceab | `/tmp/worklazy-u4-1/unit.log`: **271/271·finish12/12** |
| fix-1 ba762b4b | `/tmp/worklazy-u4-1-fix1/`에는 **REPORT.md·bundle.json만**, `.log`0. 문서가 부재를 명시하며 과거 원로그 보존을 주장하지 않음 |
| fix-1 독립 재현 | `/tmp/worklazy-u4-1-review2/unit.log`: **272/272·finish13/13**, 원 fix-1 보고와 구분 |
| fix-2 f56dc68 | `/tmp/worklazy-u4-1-fix2/logs/unit.log`: **272/272·finish13/13**. commands.json의 cwd/env/exit 및 모든 rawOutput/structuredOutput/adjustmentDiff 경로 존재 |

review-notes U4-1 절의 Codx 서명·기각 사유와 CHANGELOG의 간결한 기존 U4-1 변경 항목은 정합한다. CHANGELOG 변경은 이번 fix 지시의 필수가 아니며 부정확한 새 수치도 없다.

## 저장소 불변 증거

`start-state.json`/`end-state.json`, `start-status.txt`/`end-status.txt`, 시작·종료 SHA 목록과 `invariance.json`으로 확인했다.

| 비교 | 결과 |
|---|---|
| 브랜치·HEAD·main·Git index SHA | 시작·종료 동일 |
| `git status --porcelain=v1 -uall` | byte-identical |
| 저장소 추적 파일 | **2,543/2,543 SHA 동일** |
| 기존 dist·사용자 미추적 파일 | **537+3=540/540 SHA 동일** |
| 선행 review2/fix2 감사 원본·변이·로그 | **288/288 SHA 동일** |
| HEAD 사본 추적 파일(검증 전후) | **2,543/2,543 SHA 동일** |

시작·종료 status:

```text
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```

추적 파일·계획서 수정, 커밋, push, main 병합, 브랜치 전환, 설치는 수행하지 않았다. 보고서와 실험 산출물은 `/tmp/worklazy-u4-1-review3/`에만 작성했다.

**[검수 통과] — F5-R 7건·R-DOC 해소. 하네스 경로 외 조정 사실은 위에 명시했으며 원본 독립 재현으로 검증 근거 보완 완료. — Codx**
