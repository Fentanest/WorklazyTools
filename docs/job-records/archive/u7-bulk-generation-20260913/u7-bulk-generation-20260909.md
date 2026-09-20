# U7 문서 일괄 생성 — 상세 지시서

현재 실행: **U7-0~U7-3 구현·검수·배포·라이브 확인 종결 (2026-09-13 Codx)**. release `1df3c2e50edeb010272d82f15f279c1355f9f8ab`, Pages `34713794908` 성공. 최종 증거는 `closure-evidence/CLOSURE.json`. 아래 작성 당시 구현 금지는 사용자의 전체 정본 실행 지시로 대체되었으며 기술 계약은 유지한다. 과거 진행 기록은 당시 상태로 보존한다.

## 공통 실행 계약
- 작성/판정 Codx, 기준 `d9c79b7a16f5b99fa7cddfde741b8d10f08f07d0`, 브랜치 `s3-pdf-finish`, 2026-09-09. 이번은 **문서 정본화만**. 상태: **상세 정본 — 실제 gpt-5.6-sol R2 이견 0**.
- 현재 사용자 지시가 이전 로드맵의 U7/U8 상세 작성 연기와 번들 “마지막 상향” 조건을 대체한다. **번들 용량 상한 없음; 용량 정리는 모든 정본 작업의 맨 마지막.** 배포 JS/worker/public/mjs/CSS·route별 raw/gzip 증분과 초기/실행시 요청량은 계속 계측한다. 로딩 성능을 위해 route/엔진은 지연 로딩한다. 메모리/응답성 안전 경계는 번들 상한과 별개다.
- 실행자는 PROJECT_RULES.md 전문, 이 문서, PLAN-INDEX와 참조 정본/기각 이력을 선독하고 `git rev-parse HEAD`, `git status --short`, `git diff d9c79b7..HEAD -- <대상>`로 기준 차이와 열린 계획 충돌을 기록한다. 계획 승인과 제품 구현 착수/배포 승인은 구별한다. 이번엔 구현·커밋·push·배포가 금지다.
- 새 회귀는 수리하고 기존 부채는 부모 대조 증거로 backlog에 귀속한다. 매 구현 라운드: 되돌림 사냥, 하위 호환 oracle, 검사기 음성 대조/누락 감지, 사용자 경로 재현. 큰 검증을 미루면 항목을 기록해 최종 병합 전 전부 실행한다. 아래 미래 명령을 이번에 통과했다고 기록하지 않는다.
- UI가 생기면 ko/en 행동 중심 오류/진행/빈 상태/취소/부분 결과/접근성 이름, toolRegistry·App.tsx lazy route·SEO·정적 페이지·sitemap·FAQ·소셜 이미지 생성 입력을 함께 반영. 기존 일반 광고 경로를 사용하며 새 격리 필요성을 근거 없이 만들지 않는다. production 정적 검증과 `VITE_LOCAL_QA=1` 광고·분석 없는 브라우저 검증을 분리한다. 새 경로의 일반 로더와 기존 광고 제외 경로의 요청 0, 모바일 320/390·820/821·desktop, ko/en·light/dark·키보드·드래그 버튼 대안을 검증한다. Worker/런타임/원시 예외를 사용자에게 노출하지 않는다.
- 생성물 직접 수정 금지. 코드 변경은 CHANGELOG(Codx), 판정/기각/수치는 review-notes(Codx). 이번 문안은 `/tmp/worklazy-canon2/tracked-updates.md`에만 남긴다.

## 범위와 선행
`/ko/tools/document-generator/`, `/en/tools/document-generator/`. DOCX 양식 1개 + XLSX 또는 CSV 데이터 파일 여러 개, 파일별 시트 1개와 머리글 행을 명시 선택한다. 각 유효 데이터 행에서 DOCX 1개를 만든다. U6 종결·배포/사후 확인 후 구현 순서는 유지하되 이 상세 설계는 지금 확정한다. BL04 수리 뒤 C1 원시/표시값 계약을 재확인한다. UI 재설계와 공용 컴포넌트/등록 파일 교집합은 실행 게이트에서 조정한다.

## 실측 재사용 경계
- `QrBulkPanel.tsx:159-259`: 순차 `for`라 concurrency=1, 행별 오류는 성공 결과를 보존하지만 cancel/바깥 오류는 storage.clear와 결과 제거. 따라서 **취소 시 부분 보존은 기존 QR 동작이 아니다**. U7에서 아래 독립 계약으로 구현하며 QR 의미론을 바꾸지 않는다.
- `QrBulkPanel.tsx:281-310,370-404`: ZIP/PDF 공용 export token+AbortController, 늦은 finally 차단 패턴 재사용. U7은 생성 runId와 exportId를 별도 소유, 결과 세트 교체는 양쪽을 무효화한다.
- `qrBulkStorage.ts:1-76`: Blob/OPFS run 소유 선례. QR 전용 폴더명/메모리 기준을 공용인 척 import하지 않는다. U7 전용 storage adapter를 같은 작은 인터페이스로 작성하고 공용화는 실제 중복 검토 후 별도 변경한다.
- `fileNameSafety.ts` C2, `zipArchive.ts:40-91` C3 순차 ZIP64·유니코드 옵션 재사용. **zipArchive 자체가 zip.js 정적 import**이므로 UI에서는 type-only import, 실행 순간 `Promise.all([import('@zip.js/zip.js'), import('../../utils/zipArchive.ts')])`. U7 초기 route에 zip.js를 정적 끌어오지 않는다.
- C1 `parseSpreadsheetInput`을 그대로 사용(OOXML ExcelJS, CSV PapaParse). OOXML 이중 파싱 금지. C4 `writeXlsxReport`로 manifest 사용자 텍스트 주입 방어.
- docxtemplater/PizZip은 현재 package.json 미설치. 로드맵의 3.69.3 MIT 기록은 후보 정보이지 현행 설치/호환 보장이 아니다. U7-0에서 고정 Core+ZIP 의존 조합을 별도 /tmp 탐색 빌드로 확인하고 package lock/license/공급 방식을 결정한다. 무료 Core 밖 유료 모듈 금지.

## 데이터·양식·출력 계약
1. 머리글은 C1 표시 문자열을 보여 주고 열 식별은 물리 column index. 같은 이름/빈 이름은 자동 덮어쓰기 금지, 사용자에게 명시 매핑 요청. 템플릿 변수는 `{이름}` 형식의 스칼라 치환만. 변수명은 비어 있지 않은 머리글 문자열 또는 사용자가 지정한 별칭; 수식/eval/JS expression parser·prototype lookup 금지. `__proto__`, `constructor`, `prototype` 금지, own property 사전만 사용.
2. 전체 문서 본문·표 셀·머리말·꼬리말의 단순 변수와 run 분할을 지원한다. 반복/조건/raw XML/이미지 삽입 태그, 매크로 DOCM, 암호 문서, HWP/PDF 출력은 미지원으로 시작 전에 거부한다. 기본 DOCX의 기존 그림·스타일·표·hyperlink는 보존하며 외부 관계를 따라 fetch하지 않는다. unsupported tag를 조용히 잔류시키지 않는다.
3. 매핑 미존재와 존재하나 빈 셀을 구별한다. 전자는 실행 차단·변수 목록 표시, 후자는 빈 문자열. 먼저 `cell.type === "error"`와 수식 캐시 missing을 판정해 해당 행을 실패 처리한다. 이 검사를 통과한 정상 값만 C1 `displayValue` 우선(날짜·서식·선행0 보존), 수식은 계산하지 않고 캐시 표시값만. 캐시 없는 수식/진짜 오류 셀은 해당 행 실패로 명시; 문자열 '#N/A'는 정상 텍스트. 원본 데이터·템플릿 SHA 불변. 인접 셀·행 간 값 누수 0.
4. 파일명 템플릿은 `{변수}`와 `{row}`(원본 1-based 행), `{file}`(확장자 없는 입력명)만. 단일 pass라 값의 brace는 재해석하지 않는다. 기본 `document-{file}-{row}.docx`. 파일명 치환 → .docx 접미사가 없으면 부착/있으면 정확히 하나인지 검사 → NFC → C2 전체 이름 안전성/255 UTF-8 byte 검증 → 모든 유효 행의 최종 이름을 **단일 SafeFileNameRegistry에 reserve**한다. 다른 suffix/중복 .docx는 차단한다. 충돌은 비인접 행·파일 간·case/NFC를 포함해 sourceFile/sheet/row 쌍을 제시하고 전체 실행을 차단해 이름 템플릿 변경을 요구한다(자동 suffix 무한충돌 가능성 회피). 폴더 경로/덮어쓰기 없음. 최종 확장자 .docx 고정, 다른 접미사를 입력하면 설명 후 차단.
5. 전체 행 이름 preflight와 별개로 첫 유효 행/선택 행의 **치환 값·파일명 미리보기**를 제공하고 샘플 DOCX를 실제 생성·다운로드 가능하게 한다. Word와 동일한 화면 렌더를 약속하지 않는다. 생성 엔진이 문서를 손상하지 않았는지는 ZIP/XML 재개방 및 템플릿 비수정 파트 보존 oracle로 검사한다.
6. concurrency=1 전용 worker에서 행별 새 템플릿 인스턴스로 렌더. 압축/동기 구간 cancel은 worker terminate로 처리. row를 결과에 등록하기 직전 runId/abort 재검사, 저장 완료된 blob만 committed 결과. 취소/행 오류는 이미 committed 결과와 manifest를 보존, 현재 행 폐기, 미시작 행은 canceled 상태. 저장장치 실패는 배치 중단하고 기존 결과만 보존한다. 재실행은 preflight와 새 storage 생성이 성공할 때까지 이전 결과를 유지한다. 새 run은 별도 runId/storage로 준비하고 **첫 committed 결과를 등록하는 시점**에 이전 결과 세트를 교체/이전 URL을 React commit 이후 해제/이전 저장소 정리한다. 첫 commit 전 취소·storage/quota 실패·행 전체 실패는 이전 결과를 유지하고 새 실패 manifest를 별도 노출한다. 첫 commit 뒤는 새 세트의 committed 결과만 보존한다; 페이지 이탈/unmount/파일 변경은 전부 정리한다.
7. OPFS 성공 시 run별 저장, 미지원/초기 생성 실패는 메모리로 전환하여 안내. 처리 중 OPFS 쓰기 실패는 조용한 fallback 없이 중단. 메모리 누적 실제 blob **200MiB** 등록 전 검사(출발 안전 정책, 기기 안전 보장 아님), 넘을 행은 등록하지 않고 기존 결과 다운로드 안내. OPFS도 quota 추정과 실제 쓰기 오류를 구분. 입력/출력 1행 비용은 U7-0 벤치로 기록, 임의 번들 예산 차단 금지.
8. 개별 DOCX, 성공/실패/취소/미시작 행·sourceFile/sheet/row·최종 파일명·bytes·현지화된 사유의 XLSX manifest. 성공 2개 이상만 C3 ZIP. ZIP 실패/취소는 원본 개별 결과 보존, 완료 ZIP만 공개. 내보내기 중 생성/파일교체를 잠그되 취소·이탈 가능. Object URL은 다운로드 직후 안전한 다음 task 또는 교체/unmount에서 해제.

## 단계 분할
- U7-0: 합성 DOCX run 분할·표·header/footer·특수문자·누락 변수·unsupported 태그를 후보 Core에서 실행. 의존 버전/라이선스/고정 재현 script, 원본과 output ZIP/XML, 단일 행·100/1000행 시간·peak memory·ZIP·bundle 증분을 기록. **통과 전 지원표시/제품 연결 없음**. 후보 실패는 다른 라이브러리 임의 채택이 아니라 범위 밖 발견 보고 후 설계 재왕복.
- U7-1: 순수 매핑/파일명/preflight/worker·storage·manifest, 2파일×2시트 선택과 원본 행 좌표 보존, 동기 작업 terminate·늦은 결과 주입 테스트.
- U7-2: route·폼·미리보기·진행·부분 결과·다운로드·ko/en·SEO/광고 경계.
- U7-3: 하위 명령과 양식 골든/외부 reader 재개방·모바일 시각 검수, 증분 확정. 용량 정리 선행 금지.

## 완료 기준 검증 명령
구현 때 신규 하네스 `tests/document-generator-smoke.mjs`, `tests/unit/document-generator.test.ts`를 추가하며 아래 명령은 미래 계약이다.
```sh
npm run build
npm run test:unit
node tests/document-generator-smoke.mjs
npm run test:excel-compare
npm run test:excel-cleaner
npm run test:qr-bulk
npm run test:static
npm run test:utilities
npm run test:recovery
npm run bundle:measure
```
U7-0 고정 fixture: literal text/진짜 오류/날짜/leading0/formula cached/missing, split run 중 brace, ko/en/XML 제어문자·emoji·NFD, header/footer/table/style/image 외부 링크 보존, template 2회 다른 데이터 누수0, output 재개방+unzip+XML reader. 일반 DOCX는 LibreOffice headless 별도 프로필에서 재개방, PDF 출력 지원으로 오인하지 않는다. 0/1/2/100/1000행, 중복·예약 파일명·긴 이름, cancel 전/렌더 중/저장 직전/ZIP close 중·stale worker/늦은 finally·실패 뒤 재시도, OPFS unavailable/quota/write/read 오류·200MiB 경계. mutating oracle: 값 한 행 뒤섞기·부분결과 폐기·외부 fetch·ZIP truncation 각각 실패해야 한다.
제품 증분 사전 추정: 기존 C1/C2/C3/C4는 새 의존 0이나 route 재귀속 발생 가능; 새 양식 의존 **미측정**(0B 주장 금지), UI/worker **미측정**. U7-0 실제 탐색 → U7-3 실제 완성 수치로 대체, 상한 미적용.

## 명시 제외
제품 구현/저장소 수정/commit/push/deploy(이번), PDF/HWP 출력·DOCM·유료 모듈·반복/조건/raw XML/새 이미지 태그·수식 계산·Word 동일 미리보기·서버/외부 업로드·공용 QR 취소 정책 변경·BL04 외 기존 백로그 수리·번들 다이어트.

## 반박에서 뒤집힌 것
R1 sol 4건 수용: ①재실행 시작 즉시 과거 결과 삭제→첫 새 commit까지 보존, ②샘플 미리보기 충돌검사→전체 행/파일 단일 registry preflight, ③suffix/255B 순서 고정, ④오류/캐시 판정→displayValue 선택 순서. 판단 변경 2건(①②), 명확화2건(③④). R2 독립 확인 완료, 이견0. 초안 자체 실측과 사용자 번들 결정은 이 건수에 미포함.

### R1 추가 검증
부분결과→재실행 storage 생성/quota 실패/첫행 취소/전행 오류에서 이전 DOCX 다운로드 정상, 첫 새 commit 이후 교체·앵커 DOM 제거 후 revoke, 비인접 행 NFC/case 충돌로 실행 차단, .docx 포함255/256B 경계. `{file}`은 File.name의 최종 경로 구분자 뒤 이름에서 마지막 확장자만 제거하고 NFC하되 값은 재해석하지 않으며 최종 C2에서 거부/안내한다.


## 2026-09-13 실행 게이트·검사 배정 — Codx

현재 HEAD/origin main 5ac8b647, 원기준 d9c79b7 reachability exit0. `/tmp/worklazy-u7-preflight/root-gate/gate.json`에 명령·status·열린 최상위 계획 목록과 교집합을 기록했다. U6는 완료/아카이브, UI/번들 동시 구현 없음. 기존 미커밋 규칙 유지보수와 사용자 파일은 보존·제외한다. 기준 뒤 C1은 BL04 오류타입 수리, C3은 U6 선택적 Reader/options 추가이며 C2/C4는 불변; Sol `/tmp/worklazy-u7-preflight/sol-contracts/REPORT.md`에서 현재 API와 호출 관계를 확인했다. 빈 머리글을 열문자로 자동 대체하는 기존 helper를 U7의 명시 별칭으로 오인하지 않는다.

| 범위 | 구분 | 근거/산출물 |
|---|---|---|
| U7-0 고정 후보·합성 DOCX·독립 ZIP/XML/LibreOffice·1/100/1000행 계측 | 이번 실행, Astra | `/tmp/worklazy-u7-preflight` 제품 연결 전 후보 실증 |
| 고정 Core/PizZip 공식 버전·라이선스·parser 사양 | 이번 조사, Gemini | `/tmp/worklazy-u7-preflight/gemini-research` 실제 agy 호출 |
| C1~C4 API·직접 소비자·기준 차이 | 실행 완료, Sol 원문 조사 | `sol-contracts/REPORT.md`, 제품 변경0 |
| 제품 mapping/storage/worker·취소 및 UI·등록·출력 스모크 | 후속 U7-1~3 | U7-0 통과 이후, 현재 완료 주장 없음 |
| build/unit/static 및 정본 완료 명령 | 최종 통합 이월 | 실제 최종 후보와 연결, 관련 코드 불변 검사만 근거와 함께 재사용 |
| U4/U6 전체 재검수·UI 전면 개편·용량 정리 | 현 단계 대상 아님 | 선행 종결 및 후속 순서 유지 |

C3 조사 중 ZIP close를 반드시 새 worker로 처리해야 한다는 표현은 조사자의 구현 제안이다. 정본의 생성 동기구간 terminate와 ZIP 취소/실패 시 개별 결과 보존·완료 ZIP만 공개 계약은 유지하되, 새 ZIP worker 자체를 추가 완료 조건으로 만들지 않는다. 실제 C3 취소·settle·게시 token 경계로 구현과 검사를 판단한다.

### U7-0 후보 산출 고정·검수 중 — Codx

Astra 후보 `/tmp/worklazy-u7-preflight/REPORT.md`, 고정12소스/fixture aggregate `671f9ca2efdbdf9a8add8666bc62dc645f5cbe3803ea2c6612a3a95b4819d82b`를 root가 실제 SHA 대조했다. Core3.69.3/PizZip3.2.0, 별도 고정 lock 및 MIT 선택. 합성2출력·23음성·독립1101개 ZIP/XML·LibreOffice2재개방·Chrome153 worker1/100/1000 및 외부fetch변이exit1 실제근거를 보존. 작은2687B양식의 Node1000행3.275초+ZIP.629초/OS maxRSS187125760B, browser1000행2.783초; 브라우저worker peak·실기기 보장은 미측정이다. standalone worker 증가raw286190/gzip86110B는 제품전체 계측이 아니며 용량상한을 만들지 않는다.

원 PNG fixture CRC와 empty directory oracle 첫실패는 first-attempt에 보존 후 fixture/검사범위만 교정. 후보의 고정경로 preflight는 제품용 최종지원검사가 아니다. C1 실제오류/캐시·매핑/이름·OPFS/취소/manifest·등록/UI는 후속필수로 이월. 별도 Astra `/tmp/worklazy-u7-independent`에서 정본/고정증거와 핵심 경계만 독립검수 중이며 U7-1 제품착수는 아직이다.

Gemini 첫 agy는 exit0/SUCCESS이나 본문공백+명령거부로 미완료, 기존raw 읽기 단일재시도로 실제본문을 회수했다. `gemini-research/ROOT-DECISION.md`에서 공식라이선스/기본 inherited lookup만 수용. 읽기만으로 prototype pollution을 입증했다는 과도한 문구 및 OSV응답{}의 전수안전해석은 채택하지 않는다. 신규광역보안감사·권한우회는 추가하지 않았다.

### U7-0 후보 사전검사 국소수리 — Codx

독립검수 `/tmp/worklazy-u7-independent/REPORT.md`에서 content type/relationship을 유지한 custom-header.xml의 반복태그가 실제실행되는 경계exit1을 확인했다. Core 후보교체 사유가 아니라 후보wrapper의 파트발견누락으로 수용해 actual Core targets/compiled coverage·namespace기반발견·구조태그거부로 수리했다. 수정freeze `9ea63ffa2cb0631fd3d7edcaf1fda2ace9ea319087cd7ac9525d0fce0d969cbb`, 새국소13·원23음성/2출력/Pythonoracle·새worker1건통과. 매행preflight비용이 바뀌어Node1/100/1000을현재후보로회수: 52.93/759.55/5287.59ms, ZIP15.54/97.49/579.73ms, OSmaxRSS71487488/138244096/174854144B. 정상100행은최종namespace분기수리와무관한경로의동일실행, 전체batchXML/LO/browser matrix는관련근거로재사용·중복하지않았다.

독립 동일custom-header 재현은exit0로해소됐지만 `/tmp/worklazy-u7-independent/fixed/namespace.json`의 x:prefix+잘못된 namespace 문서가 치환태그를남긴채acceptedtrue여서 같은namespace earlyreject검사exit1. 정상대체prefix는지원유지하고 malformed root만거부하는 국소수리를author에지시. U7-0 최종수용/U7-1은수리후같은경계재검수까지보류. 최초수리중xmlns중복오류와수정전원자료는보존하며실패를PASS로덮지않는다.

### U7-0 최종 수용·U7-1 착수 — Codx

최종freeze `83fa6fb6ab95aea714c1e4d5b3f2d300fca742928a19d4f08b67653f0039de2a` 15소스/fixture를root가실제SHA확인. 두 번째수리는contenttype별Word part root namespace/localName검증이며정상docProps까지Word로오인하지않는다. author 원3+기존13+docProps보존1·새worker1/외부0, 독립Astra same3driver byte-exact actualexit0(정상custom header/footer 및대체prefix유지, 잘못된namespace는XML_PART_ROOT로생성전거부); 원반례2건해소와시작끝SHA/root상태불변을수용했다. 근거 `/tmp/worklazy-u7-independent/REPORT.md`, `final/invariance.json`, `final/namespace.json`. 현재범위의신규차단없음으로 U7-0 후보실증종결; 후속제품완료나실기기메모리보장으로확대하지않는다.

사용자의 까다로운코딩Astra 지정에따라 동일author에게 U7-1 정본내핵심제품구현을발행. 실행지시 `/tmp/worklazy-u7-preflight/U7-1-DISPATCH.md`, 원제품기준5ac8b647의별도U7작업사본, 한제품작성자유지. 정본의C1매핑/단일이름preflight/worker/OPFS·메모리/부분commit·취소/manifest 및관련검사가범위. Sol UI/등록과최종통합/배포는후속. 지금commit/push는발행하지않았으며 U7-0판정에다시광역감사를추가하지않는다.

U7-1 진행 사본은 `/tmp/worklazy-u7-impl`; root/U6와별개node_modules에 Core3.69.3/PizZip3.2.0/xmldom0.9.12 및pako2.2.0고정. Sol의 UI/등록 readonly연결지도 `/tmp/worklazy-u7-ui-prep/REPORT.md` SHA 05aeb025c0abbcb7fe045c925256db0ab3b2c15c370b585d6ce8d9e92576028f; C3 조사문구정정후계약보고 SHA 930dbba5366f7d9dab1cef6859b5bee7efe22fddc1825be5026780d320b38e31. 한제품작성자유지, stage1고정전UI작성/광역브라우저검사없음.

### U7-1 산출 고정·독립검수 / U7-2 화면 연결 — Codx

Astra 작성종료: `/tmp/worklazy-u7-preflight/implementation/REPORT.md`, API-HANDOFF 및source-freeze19파일 aggregate `1e340e165d4cbf9b5c940ebaef5d0771794602a20e3601375d101082217f4f76`; root실제19SHA일치확인. unit11/11·types clean, currentbrowser16/6DOCX/worker11terminate11·외부0/오류0, 실제200MiB equality/+1·OPFS/취소/재시도, Python6출력/ZIPentryexact·LO1재개방. root가raw summary/log와oracle-exits control0/drop1/swap1/truncate1 및worker fetch실패1을대조했다. CSV마지막완전빈행이빈DOCX를만드는실제수리는U7매핑에만반영, C1불변.

독립Astra는 `/tmp/worklazy-u7-core-review`의별도고정사본에서core계약/표본검수. Sol은`/tmp/worklazy-u7-ui-prep/U7-2-DISPATCH.md`로동일U7작업사본의새UI/등록표면만단독작성, 고정19는수정금지. 한제품작성자와고정검수소스유지, repo전체status는허용UI변경과분리한다. U7-0을제외한전체U7완료/배포판정은아직이며core구체차단발견시국소수리로조정한다.

notice생성은기존zetaoffice NanumGothic-OFL입력누락ENOENT로실패했고현재미통과. validated vendor준비와실제notice생성을최종통합필수로이월; 생성물직접수정/검증우회없음. 200MiB는한memory run의등록실제Blob합이고old/retired와new중첩·pending write/ZIP/manifest/전체heap은포함하지않는범위를API/기록에명시했다.

### U7-1 독립검수 수용 — Codx

`/tmp/worklazy-u7-core-review/REPORT.md`와author19파일/산출물근거를대조하여core단계미해소차단0수용. 독립 실제C1 CSV→firstcommit/writefailure→다음run지연write취소→old/new storage ack 및dispose exit0; 독립2DOCX본문/표/header/footer/비수정파트oracle0·swap1. 원본/사본19SHA와제출dist7/최종산출12/LO1의size/SHA일치. 기존author11unit/16browser/6DOCX·OPFS·Blob·worker/negative는원문·소스·실물연결을검수해재사용했다.

검수중root가발견한type증거공백을정정한다: author의 `tsc --noEmit`은files:[]인solution root에서app검사증명이되지않으므로앞선단순types clean을그대로수용하지않았다. 독립고정사본에서실제 `tsc -p tsconfig.app.json --noEmit --tsBuildInfoFile /tmp/worklazy-u7-core-review/app.tsbuildinfo` exit0로회수했고author실행으로소급하지않는다. 같은원자료의empty word/ directory oracle초기실패도허용된0byte디렉터리만분리해교정/보존했다.

이단계검수종결, Sol UI/등록을계속수행. 고정core를바꾸지않는UI표면에반복core전검사를추가하지않는다. 추가로lock의xmldom0.9.11→0.9.12 변경의직접소비자ExifReader/image-privacy 영향만별도Astra `/tmp/worklazy-u7-xmp-review`에서readonly한정확인; 전도구회귀나기존부채수리는추가하지않는다. 최종notice/vendor/build/unit/static·명시consumer·UI/Gemini/배포게이트는여전히이월필수다.

### xmldom 직접소비자 확인 — Codx

`/tmp/worklazy-u7-xmp-review/REPORT.md`·result.json root대조. 고정기존image-privacy.worker/ExifReader4.42.0를old xmldom0.9.11/new0.9.12 의존사본에서좁게esbuild worker로묶어Chrome실행, 합성JPEG Exif Make+XMP creator 1표본의cleaned출력SHA e2b766bce9561781dc9aef4b032362d31d541837caabdc8ebb741dc956066d71로동일, 삽입2metadata marker제거. Node distribution의실제requirefallback은양쪽creator추출동일. Browser worker에는DOMParser/__non_webpack_require__가둘다없어XMP:{}인것은기존한계이며새U7회귀/전체metadata보장으로승격하지않음.

제품/의존/frozen19수정0. 이결과는원제품worker의임시targeted bundle표본이며최종Vite앱산출이라고부르지않는다. Sol최종통합에서동일ExifReader ESM해석/불변buildconfig를연결하고일반적필수consumer선택을유지;이patch버전만으로전사진코퍼스나기존XMP부채수리를추가하지않는다.

### U7-2 재개·화면 계약 연결 확인 — Codx

사용자의 계속 수행 지시로 U7-2 기존 Sol 단독 작업을 이어간다. 현재 app tsconfig 직접 검사와 VITE_LOCAL_QA current build exit0는 구현 중 증거이며 최종 통합 완료로 승격하지 않는다. 제출 core19는 불변 유지. UI의 템플릿→데이터 순서 입력 보존을 수리했고 합성 브라우저 흐름 진행 중이다. root가 작성 중 화면과 정본을 대조해 실제 다운로드 최종 파일명, 선택행 치환값 표시, 초기 memory fallback 안내, StrictMode client 정리, 이전 완성 ZIP 실패/취소 보존의 연결 여부를 Sol에게 한정 확인 요청했다. 아직 고정 완료본의 결함/검수 통과 판정이 아니며 관련 UI만 확인한다.

최종 통합의 기존 완료 기준을 `/tmp/worklazy-u7-ui-prep/U7-3-READY-INSTRUCTIONS.md`에 실행 준비로 모았다. 지금 U7-3/커밋/push를 발행한 것은 아니다. source·UI corpus 고정 및 차단 정리 후 실제 실행하며 named consumer의 실행/정당한 재사용을 개별 기록한다. U8 이후 순서 및 비긴급 PDF 파일명 숫자 축약 요청은 유지한다.

### 비용 배분 변경 — 사용자 직접 지시, Codx

화면·UI 상호작용·간단한 검증을 Gemini에 적극 위임하고 Codex 중복 실행을 줄인다. Sol은 제품/테스트 코드 수정과 필요한 타입·핵심 수정 검증, Astra는 까다로운 코딩/핵심 독립검수 역할을 유지한다. U7 현재 dist-current-3(:4390)과 수정 완료 UI harness를 고정해 Gemini agy gemini-3.1-pro-high로 실제 호출했다. 지시와 원출력은 `/tmp/worklazy-u7-gemini-ui/`, 실행 session78564. Gemini는 합성 입력만 사용하며 제품 코드 변경 권한은 없다. 통과 판정은 실제 종료/산출물/열람 범위를 확인한 뒤 기록한다.

### U7-2 수리 종결·U7-3 발행 — Codx

최종 UI source aggregate f938aa0803f7aa57b82433c5aabd882382d7ac73aa0ea1f47ca488fb1eb12ae1; core19 불변. dist4 실제 UI 하네스 run2는19 case/9PNG/다운로드6, external·page·console 오류0. 원run1의 console 하드코딩17은 raw summary19와 별개 로그 결함으로 교정했으며 두 실행을 숨기지 않는다. 하네스 selector/별칭 문구/header setup 오류의 중간 실패는 `/tmp/worklazy-u7-gemini-ui/RUNNER.json` 및각run로그로 남긴다.

Astra 독립검수의 실제 신규반례 두건(sample 행 선택과 기존 다운로드 불일치, firstcommit 때 이전ZIP앵커 제거 전 URL revoke)은 Sol UI만 수리. `/tmp/worklazy-u7-ui-core-review/REPORT.md`의 dist4 정상대조 exit0/0, sample 새행실물 일치/oldlink0 및 revoke시 connectedAnchors[]를 root 원자료 대조해 수용했다. 관련page+core19/build5 불변, 이 검수 종결.

Gemini agy 첫 terminal 실행은 권한거부/빈응답, browser 전용도구 재시도는 도구부재가 확인돼 미실행으로 기록. 권한우회 없이 Codex가 기존명령 실행, Gemini는 허용된 view_file로 dist4-run1 고정9PNG/summary를 직접판독한다. `/tmp/worklazy-u7-gemini-visual/manifest.json` SHA6127a75614e6f1d3ededc0d645ceab1f424c8d261bde84127b613351cd5a6418, 실제session61391; run2기능증거와같은build인run1시각증거의출처를구분한다. 아직Gemini판정수용전.

U7-3는 `/tmp/worklazy-u7-ui-prep/U7-3-READY-INSTRUCTIONS.md`의 기존최종범위로 Sol에게 실제발행. owner vendor/notice, 기록, production build/unit/static, 정본 namedconsumer·recovery/utilities·bundle 증분을 회수한다. 한제품작성자유지/QA dist4보존; commit/push는최종결과판정후 별도발행. 읽기전용 ZetaOffice 보존snapshot server4498는owner검증용일뿐 generated직접수정없음.

### U7 최종 시각 수용 — Codx

Gemini는고정dist4 선택/상호작용9PNG, 제기한고정메뉴의심에대한viewport보충10PNG, 새initial/bottom6PNG를각각실제view_file로모두열람(각coverage missing0/changed0). 터미널/브라우저불가를반복호출하지않고Codex가명령실행,Gemini가허용된이미지판독을맡았다. 최초desktop모바일탭/코드원인단정은실제PNG와5profile DOM대조후Gemini가철회; 제품수리로기록하지않는다. 측정firstprobe smooth-scroll정착전실패도원문보존, 최종scope exit0. 최종시각정본 `/tmp/worklazy-u7-gemini-visual/ROOT-DECISION.md`, 각원보고/stream/coverage; 신규차단없음으로시각단계종결.

신규U7 baseline6는owner하네스로생성후일반비교에서해당6diff failure0. 두명령전체exit1은parent부터빠진U6 baseline7의global assertBaselineSet이며U6재생성/기준완화없음. 이기존검증목록부채는backlog/UI재기준화소유로분리한다. 최종unit1의count3실패는실제새consumer/등록목록에맞춰수리후538/538PASS. utilities의ko22/mobile메뉴23/en21(HWP제외)기대값도실물과대조해수리후PASS; 중간FAIL원로그보존. 최종배포/잔여명령은아직종결전이다.

### U7 커밋·배포 진행 — Codx

최종52파일freeze aggregate2f0c93d48949095ec94c4c6853638f561e96613a120568c0359ed9858b02cc0c / manifestSHAd7c4d2289818853dd4e682856421e6ac3ddbec7f6dd7cca80e42fa202a8274f9를root실제SHA/bytes/누락/잉여0으로수용(`/tmp/worklazy-u7-final/root-freeze-verification-final.json`). 최종REPORT SHA8efb7a9a53324e222582b34d216f705868d726550bc6739f4721002c016c08c9. 안전한최종HTTP(S)차단조건의utilities/Excel2 PASS로이전실행조건위반결과를대체했고recovery155/155 및bundle고정기준계측을회수했다. 실제생성된notice는728→731sections,docxtemplater/pizzip/pako추가+xmldom교체/기타제거0.

Sol에게52파일commit/main push와Pages/live사후확인까지발행했고커밋1df3c2e50edeb010272d82f15f279c1355f9f8ab,tree50170ad33c22eb252ece4b450c05d6cd9f59c9e2로반영했다. 제출파일missing/extra/SHA mismatch0,정상fast-forward push완료. Pages34713794908은현재build진행중이며아직배포성공/라이브검증완료로표시하지않는다. U8은사전Gemini코드읽기자료만있고착수전이다.

## 최종 종결 — 2026-09-13 Codx

52파일 commit/tree 검증과 Pages 성공 뒤 실제 CI artifact 10304286706 및 라이브 ko/en HTML·entry·CSS·route·worker 6종의 bytes/SHA 일치를 확인했다. 라이브 합성 1행 DOCX 2,798B 생성·다운로드·XML 재개방, ko/en canonical·en hreflang, 페이지 오류0·외부 HTTP 시도0. 최초 live harness는 기대 제목 오류로 exit1이고 교정된 attempt2는 exit0; 최초 로그를 보존한다. 원 작업트리는 fast-forward로 동일 release에 동기화했고 사용자 유지보수/미추적 경로 상태는 보존했다.

최종 build·unit538·static·소비자 스모크·recovery155 및 U7 기능·소유권·Gemini 실제 이미지 검수를 수용했다. 범위 지정 visual은 U7 6/6 차이0이나 전역 U6 기준선 7장 부재로 전체 명령 exit1이며 이를 PASS로 기록하지 않는다. 이 기존 부채는 backlog/UI 재기준화 소유다. 실제 기기 메모리 보장·전 화면 접근성 완료로 확대하지 않는다. 상세 결과와 고정 증거는 closure-evidence 및 원 /tmp 경로에 보존. 다음은 U8-0 정확도 실증이다.
