# pdf-lib 중복 배포 제거 — v2 조사계획/구현안 분리

작성 Codx. 기준 HEAD `d9c79b7a16f5b99fa7cddfde741b8d10f08f07d0`, branch `s3-pdf-finish`.
상태: **B0/B1 조사 절차 정본 — sol R3 이견 0.** **B2 공급 구현안은 미정본**, B1의 고정 예산 실패 해소 증거를 받은 뒤 별도 반박 왕복한다. **착수 조건은 사용자 승인**(기존 5~10인일 비용/투자 판단). 이번 라운드는 계획만 작성하며 추적 파일/제품 구현/커밋/main 병합/push/배포 금지.
공통 근거·기준불일치·열린계획 소유권·고정 baseline은 [GATES.md](canon-rounds-20260909/GATES.md)를 이 문서에 편입한다. 지시 d3a8d89에서는 U4 자체 초과0, app잔여2507B. 그 뒤 main 통합으로 현재 상태가 바뀐 사실은 별도 회계이며 U4 단독 결함으로 돌리지 않는다. 목적은 **pdf-lib 중복 공급 제거와 성장 여유 확보**다.

## 코드 근거와 선택지
`src/utils/pdfFontEmbed.ts:1-10`의 main(fontkit+pdf-lib), `src/features/pdf-editor/pdf.worker.ts:4`의 legacy worker(pdf-lib)가 중복 공급한다. `vite.config.ts:26-48,62-71`의 main attribution 플러그인은 worker에 없고 main/worker는 별도 Rollup 빌드다. `new Worker(...,{type:'module'})`와 빌드 포맷은 다르며 현재 번들은 IIFE다.

|후보|구체 방법|대가/판정|
|A 단일 작업 worker|finish/QR/main의 PDF 작업을 worker 메시지로 옮김|main canvas/fontkit·취소·입력소유권 재설계 필요. Gemini의 '안전' 단정은 코드 근거 부족으로 기각. 기본안 아님|
|B 공유 ESM 공급|main/worker의 bare pdf-lib import를 external 처리하고 동일 배포 ESM URL 사용|실제 앱154886B 감량·제한기능실행 성공. 그러나 shared 게이트 실패, B1 조사후만 구현안 재왕복|
|C worker 작업을 main으로 이동|기존 worker 실행 격리를 제거|응답성/취소/메모리와 legacy 동작 위험으로 이번 제외|
|D main 소유 공용 chunk|main에 pdf-lib 단일 chunk를 유지하고 worker가 같은 모듈을 참조|별도파일 external의 opaque 문제 대안. export 이름안정성·worker가 DOM의존 chunk를 import하지 않는지·content hash URL 연결을 탐색해야 함. 아직 미실측, 채택안 아님|

B의 탐색 레시피는 **패키지 specifier/TS type을 유지**하고 main/worker 양쪽 `external: id === 'pdf-lib'`, `output.paths: {'pdf-lib':'./pdf-lib-runtime.mjs'}`, `worker.format:'es'`다. `public/assets/pdf-lib-runtime.mjs`는 설치된 고정 pdf-lib 소스에서 별도 번들 생성한 탐색 자산. 실제 제품 채택시 생성기+입력버전/lock/hash/licensing 검증, content hash 파일명과 import mapping 생성(원본 파일이 바뀌면 이름도 바뀜), dev/production/basepath·캐시교체를 함께 설계해야 한다. 고정이름 탐색 자산을 그대로 배포하지 않는다. 외부 CDN/서버 전제0. fontkit은main에유지, realm간 PDFDocument객체교환0·bytes만전달.

## B0 — 실제 분리 탐색 결과
B0는 **회수량/제약 실측 조사**다. 사용자 승인된 이번 계획 라운드에서 `/tmp/worklazy-canon/sol/repo.CFfJdV` 사본으로 수행했다. 제품 저장소에 적용하지 않았다.

|gzip 지표|control d9c79b7|유효 ESM 후보|후보-control|
|---|---:|---:|---:|
|entry|314043|314032|-11|
|affected 전체route|4236633|4064879|-171754|
|shared 총량|1393340|1410219|+16879|
|app 전체배포JS|5944016|5789130|**-154886**|
|CSS|38242|38242|0|

회수 관측 **154886B(151.26KiB)** = 5944016−5789130. root가 두 JSON `files.filter(type=js).reduce(gzipBytes)`를 직접 합산해 metrics와 동일함을 확인했다. **pdf.worker 전체219812B를 pdf-lib몫으로 세지 않는다**. 80~120KB 추정은 폐기; 이 수치는 worker 전체ES전환의 다른청크 변화도 포함한 탐색안 순감량이며 완성품 보장치가 아니다.
첫 후보(source-relative external+IIFE 유지)는 app5945811B로 **1795B 증가**했고 undefinedglobal 및 배포되지 않는 `../src/utils/pdf-lib-runtime.mjs` 참조가 생겨 기각했다. 원로그와 유효후보를 섞지 않는다.

실행 증거:
- `candidate-es.json`(실제 `bundle:measure` 산출), `candidate.json`(기각안), `bundle-r1.md`/`bundle-r2.md`: `/tmp/worklazy-canon/sol/`.
- `VITE_BASE_PATH=/probe/ node node_modules/vite/bin/vite.js build --outDir /tmp/worklazy-canon/sol/dist-es-probe` exit0. pdf.worker/pdfFontEmbed/qrLabelPdf의 import가 같은 assets 상대 ESM을 가리키고 index/CSS는 `/probe/assets`.
- root 독립 `node /tmp/worklazy-canon/bundle-browser-probe.mjs` exit0: `/`와`/probe/` 각각 PDF병합1페이지/회전90도, 한글QR라벨1페이지/3833398·3833399B, compiled worker **21개 기동오류0씩(42회)**. 결과 `bundle-browser-probe.json`. 실제 한글폰트 embed와 PDF read-back까지 실행했지만 QR시각/legacy byte oracle/21worker별 기능회귀를 대신하지 않는다.
- archive의 ignored video runtime 누락 때문에 초기control측정은 static ENOENT로실패했다. 고정SHA 벤더를사본에서생성하거나 검증된 `public/tools/video-studio/runtime`을복제해준비해야 한다. 신규설치0, root배포산출물수정0.

## B1 — worker/public 계측과 고정 shared 실패 조사 (필수 포함)
**현 후보는 고정5종PASS가 아니다.** 고정 schema3 baseline→후보 비교에서 shared gross546835−허용이동328742=**net218093B >30720B**로 실패한다. app−54585B(delta against baseline)는통과하지만 shared실패를상쇄하지못한다. 사용자상한/override/multiplier를바꾸지않는다.
`node`에서 `compareWithBaseline(candidate,fixedBaseline,resolveBudgetLimits(),()=>{})` 실행→`Bundle budget exceeded: sharedJsGzip 218093 > +30720`.

원인 근거(독립sol JSON대조, root 소스검증): 새runtime181865B는 public opaque라 baseline의 main pdf-lib197355B와 module이동대응이안된다. fontkit은 control/candidate의 renderedLength1000666/renderedGzip376793/renderedSHA가동일한데 청크gzip가중배분이달라 baseline귀속264075→candidate294559(+30484B)로보인다. 이 둘을'실제코드증가'와'계측불연속'으로구분해조사해야한다. **계측개선만으로상한내가된다는보장은없다**(fontkit배분차만30484B라 잔여236B).

조사 산출물 계약:
1. worker 플러그인의 각빌드별별도metadata(출력충돌0), public ESM의실제module provenance, 실행배포파일 inventory를수집한다. 원래main/worker/public각각의module목록·정규화ID·renderedSHA·gzip배분과 chunk합계를보존. opaque파일이0bytes/미계측으로빠지면FAIL.
2. **고정 schema3 보고서와검사는유지**하고 추가schema 보고서는병렬보조. `scripts/bundle-module-attribution.mjs:315-317`의non-main modules 거부를조용히해제하거나옛baseline을바꾸지않는다. schema변경이필요하면같은소스/고정기준커밋의새metadata를재빌드해v3와양방향대조하고, baseline의없는worker 내부를추측으로복구하지않는다. old report hash는불변.
3. candidateB/D의실제app총량·구조변경·module이동·gzip재배분을별도표로출력. 동일module identity가있는이동만증거로인정. semantic유사도/파일명만같음은크레딧0. 계측수정으로실제추가bytes가사라지지않음을독립합산/새worker·새.mjs·누락metadata/duplicate hash/변조moduleSHA 음성대조로입증.
4. **B1 완료판정**: 진단보고·재현script·failedgate·해결가능/불가근거완비. **B2로넘어가는별도조건**은고정schema3와상한의동등성검증을통과한정당한회계또는구조대안으로shared≤30720·5종모두PASS, 전체오류0. 구조/계측계약변경으로권한결정이필요하면사용자쟁점으로분리하며PASS로표시하지않는다.
5. 5~10인일은backlog의기존비용추정이지측정된작업시간아님. B1진단이끝나면설계/연결3~6·회귀/계측2~4인일의범위를새사실로갱신해사용자에게구체적투자판단입력으로제공. **현계획이비용승인은아니다**.

## B2/B3 — 미정본인 후속 구현과 완료 게이트
B2=채택한단일공급구현, B3=회귀/배포검수. B1완료와B2조건충족후정확파일/hash/export/loader/측정schema를다시sol반박해이견0일때별도구현정본을받는다. 아래는필수인계조건이며지금구현승인이아니다.
- legacy worker뿐아니라worker.format전역변경영향21개worker의정상작업/취소/다시시작·video지역화asset/SW·PDF.js worker·기동실패fallback 검증. 독립표에미실행을기동PASS로올리지않음.
- PDF legacy byteoracle/finish합성골든/QR한글폰트시각·출력구조보존. 페이지내같은pdf-lib class identity,realm간 bytes전달,변경전후typechecking 유지.
- 2빌드순차전환의contenthash/cache·stale문서재시도/base`/`와`/probe/` HTTP200/MIME/import graph. generated/벤더수기수정0·license생성기반영. JSzip제거나새서버/폰트subset재시도는범위밖.
- 단계예산: B0/B1 계측제품0B;B2 실측후보app−154886B/entry−11/shared총+16879/CSS0(현재shared순증실패),실제완성후재측정;B3검증코드제품0B. 다른후속도구의여유를미리예약/상한변경하지않는다.

## 실행 가능한 완료 검증 명령
현재계획조사의증거검증:
```sh
node /tmp/worklazy-canon/bundle-browser-probe.mjs
node --input-type=module -e 'import fs from "node:fs"; for (const p of ["/tmp/worklazy-u4-mergegate/bundle-full.json","/tmp/worklazy-canon/sol/candidate-es.json"]) { const j=JSON.parse(fs.readFileSync(p)); console.log(p,j.metrics,j.files.filter(x=>x.type==="js").reduce((s,x)=>s+x.gzipBytes,0)); }'
sha256sum docs/jobs/todo/canon-rounds-20260909/bundle-baseline.json
```
B1의계측구현작업승인후: `node --test --experimental-strip-types tests/unit/bundle*.test.ts`, `npm run bundle:measure`(고정baseline 환경), 신규 `node tests/bundle-pdflib-dedup.mjs`(위음성대조;지금미존재). B2/B3 미래필수:
```sh
npm run build
npm run test:unit
npm run test:pdf-finish-oracle
npm run test:pdf-finish
npm run test:qr-bulk
npm run test:qr-font-render
npm run test:static
BUNDLE_BASELINE=docs/jobs/todo/canon-rounds-20260909/bundle-baseline.json BUNDLE_BUDGET_MULTIPLIER=1 BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-canon/bundle-final.json npm run bundle:measure
```
**현지화·SEO·광고**: 사용자신규기능0. 필요로더실패메시지는ko/en행동중심,Worker/runtime/원시예외노출0. canonical/FAQ/sitemap/static/광고격리의전후동등성 및production로더정상·격리요청0 검사. 최종병합이월은위기본검증+PDF/QR/browser/recovery/21worker별소유smoke·production광고격리+새로더시각영향시Gemini로컬검수. 매라운드되돌림/legacyoracle/게이트건전성/사용자경로재현4항유지. 기존부채는부모대조backlog,새회귀면제없음.

## 명시 제외
이번제품구현/추적파일변경/커밋/main병합/push/배포, 예산상향·baseline교체·override/multiplier변경, U6/UI/직접경로기능구현, 폰트subset재시도·벤더최신화, 금지사용자4경로·dummyfortest자료fixture. B1계측변경도현재라운드에서는실행하지않는다.

## 반박에서 뒤집힌 것
R1 5개수용: ①moduleWorker옵션이면ES라는전제→worker.format 별도,②source relative external→명시배포path,③80~120KB예상→기각후보−1795/유효후보154886 actual,④worker만계측→public ESM도필수,⑤archive단독이면재현→ignored runtime준비.
root독립+R2추가1개수용: ⑥app회수면5종여유라는해석→shared218093실패, B0/B1조사정본과B2구현안분리. 총뒤집힌판단6개. U4단독초과0·현재통합4,301초과는시점분리이며사용자정정의기각이아니다.

## 사용자 결정으로 분리
**5~10인일 구조개선조사의 투자/착수 승인 여부**. 현실측 app회수154886B와 shared실패218093B,아직미검증한완성품oracle을함께판단입력으로제공한다. 상한상향은선택지로요청하지않는다. B2채택안/완료일은B1전확정하지않는다.


## 최종 정본화 기록 — 2026-09-09, Codx

실제 `gpt-5.6-sol` 구현자 반박 3회, 수정/철회한 판단 6건. 마지막 독립 판정: `/tmp/worklazy-canon/sol/bundle-r3.md`. **이견 0의 범위: B0/B1 조사 절차만 정본이다. B2 공급 구현안은 미정본이며 사용자 투자 승인과 B1 후 재왕복을 선행한다.**
상단 정본 상태와 이 최종 기록이 본문의 과거 “재확인 대기” 기록보다 우선한다. 상세 계약은 최종 v3/v4의 추가 정정이 같은 항목의 이전 문안보다 우선한다. 제품 구현에는 착수하지 않았다. 공통 기준 해시 게이트·열린 계획 소유권·고정 예산은 `canon-rounds-20260909/GATES.md`를 함께 읽는다.
