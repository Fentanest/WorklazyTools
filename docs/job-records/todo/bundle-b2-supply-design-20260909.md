# 번들 B2 공급 — 설계 공간·사전 판정 규칙 정본

## 공통 실행 계약
- 작성/판정 Codx, 기준 `d9c79b7a16f5b99fa7cddfde741b8d10f08f07d0`, 브랜치 `s3-pdf-finish`, 2026-09-09. 이번은 **문서 정본화만**. 상태: **정본 — 실제 gpt-5.6-sol R2 이견 0**. B2는 설계 공간/판정규칙에 한정하며 실제 공급 구현안은 미선택이다.
- 현재 사용자 지시가 이전 로드맵의 U7/U8 상세 작성 연기와 번들 “마지막 상향” 조건을 대체한다. **번들 용량 상한 없음; 용량 정리는 모든 정본 작업의 맨 마지막.** 배포 JS/worker/public/mjs/CSS·route별 raw/gzip 증분과 초기/실행시 요청량은 계속 계측한다. 로딩 성능을 위해 route/엔진은 지연 로딩한다. 메모리/응답성 안전 경계는 번들 상한과 별개다.
- 실행자는 PROJECT_RULES.md 전문, 이 문서, PLAN-INDEX와 참조 정본/기각 이력을 선독하고 `git rev-parse HEAD`, `git status --short`, `git diff d9c79b7..HEAD -- <대상>`로 기준 차이와 열린 계획 충돌을 기록한다. 계획 승인과 제품 구현 착수/배포 승인은 구별한다. 이번엔 구현·커밋·push·배포가 금지다.
- 새 회귀는 수리하고 기존 부채는 부모 대조 증거로 backlog에 귀속한다. 매 구현 라운드: 되돌림 사냥, 하위 호환 oracle, 검사기 음성 대조/누락 감지, 사용자 경로 재현. 큰 검증을 미루면 항목을 기록해 최종 병합 전 전부 실행한다. 아래 미래 명령을 이번에 통과했다고 기록하지 않는다.
- UI가 생기면 ko/en 행동 중심 오류/진행/빈 상태/취소/부분 결과/접근성 이름, toolRegistry·App.tsx lazy route·SEO·정적 페이지·sitemap·FAQ·소셜 이미지 생성 입력을 함께 반영. 기존 일반 광고 경로를 사용하며 새 격리 필요성을 근거 없이 만들지 않는다. production 정적 검증과 `VITE_LOCAL_QA=1` 광고·분석 없는 브라우저 검증을 분리한다. 새 경로의 일반 로더와 기존 광고 제외 경로의 요청 0, 모바일 320/390·820/821·desktop, ko/en·light/dark·키보드·드래그 버튼 대안을 검증한다. Worker/런타임/원시 예외를 사용자에게 노출하지 않는다.
- 생성물 직접 수정 금지. 코드 변경은 CHANGELOG(Codx), 판정/기각/수치는 review-notes(Codx). 이번 문안은 `/tmp/worklazy-canon2/tracked-updates.md`에만 남긴다.

## 정본의 경계와 원문 대체
이 문서는 `bundle-pdflib-dedup-20260909.md`의 **B1 shared≤30,720/5종 PASS 선행조건 및 예산 관련 착수 차단을 대체**한다. 과거 측정·기각 기록은 보존한다. B0는 탐색 완료, B1의 worker/public 진단은 **미실행**, B2의 실제 공급 구현은 **미착수·채택 미정**이다. 지금 확정하는 것은 후보·측정 항목·채택/기각 규칙이며 구체 export/hash/loader/계측 schema는 B1 없이 지어내지 않는다. B1 후 구현안은 다시 sol 반박으로 정본화한다. 용량 정리 성격의 B1/B2/B3 실행은 **모든 제품 정본 작업 뒤 맨 마지막**으로 이동. 현재 작업은 투자 승인/제품 착수 지시가 아니다.

## 확인한 기존 사실
- `src/utils/pdfFontEmbed.ts:1-10` main의 fontkit/pdf-lib, `src/features/pdf-editor/pdf.worker.ts:4` legacy worker의 pdf-lib는 별도 빌드 그래프다. `vite.config.ts` worker.format과 worker plugins는 별도 계약. runtime class 객체는 realm 사이로 옮기지 않는다.
- 기존 B0 `/tmp/worklazy-canon/sol/candidate-es.json` vs `/tmp/worklazy-u4-mergegate/bundle-full.json`의 실제 JS gzip 파일 합을 이번 Python으로 다시 합산: 5,944,016→5,789,130B, **순감 154,886B**. entry -11B, affectedRoute -171,754B, shared 총량 +16,879B, CSS0. worker 전체 gzip 219,812B를 라이브러리 몫으로 오인하지 않는다.
- schema3 과거 baseline 대비 shared net **218,093B >30,720B**는 당시 검사가 실패한 사실. 현재 상한 해제로 **이 숫자는 구현 차단 게이트가 아니다**. 그렇다고 회계 오류가 해소되거나 후보가 완성된 것은 아니다. public runtime opaque·동일 fontkit gzip 배분 변화·main/worker attribution 부재 진단은 계속 필수다.
- source-relative external+IIFE 탐색안은 배포되지 않는 ../src URL와 undefinedglobal이어서 기능상 기각 유지. ES 후보의 제한 browser 기동/병합/회전/한글 QR 성공은 전체 worker 기능·byte oracle 통과를 대신하지 않는다. 과거 측정은 B1 현재 기준 baseline이 아닌 참고값이다.

## 설계 공간
|후보|공급/실행 방식|이득 후보|대가·위험·사전 기각 조건|
|A 단일 작업 worker|PDF 생성 작업들을 하나의 worker 서비스로 이관|main+legacy 중복 제거 가능|fontkit·canvas·취소·OPFS/소유권/메시지 설계 대범위. legacy 바이트/기능 동등성을 못 지키거나 렌더 main 동기 블로킹이 증가하면 기각. B/D가 동등 목표를 작은 범위로 충족하면 후순위|
|B 독립 공유 ESM|동일 self-hosted content-hash ESM URL을 main/worker가 import|B0 net -154,886B 관측|public opaque attribution, 개발/배포/base/cache, 버전 혼합, 라이선스·생성기. 실제 provenance와 경로/MIME 불완전·광역 worker 회귀면 기각. shared 임계값 초과만으로 기각하지 않음|
|D main 소유 공유 chunk|main이 emit한 pdf-lib chunk를 worker graph에서 같은 URL 참조|Rollup main provenance가 남을 가능성|별도 빌드 순서와 hash/export 안정성, DOM 의존 혼입, 순환/레이스. 문자열 치환/파일명 우연에 기대거나 두 빌드 clean determinism을 못 증명하면 기각|
|N 현 구조 유지|현재 중복 두되 계측만 보강|구조 위험/개발 비용 최소|다이어트 최종 단계의 정량 순감/응답성 이득이 없거나 B/D 모두 품질 gate 실패면 N으로 종결. 부족한 예산 때문에 급히 구조를 바꾸지 않음|
C(worker 작업을 main으로 이동)는 기존 응답성·취소 경계 폐기여서 본 후보에서 제외. A는 비용 비교용 설계 공간이며 B1 전에 구현하라는 지시가 아니다.

## B1 필수 산출 값
미래 B1에는 최신 source의 **/tmp 격리 control/B/D prototype 및 candidate build**를 포함한다. 제품 브랜치/공급 구현 완료와 구별하고 이번 계획 라운드에서는 prototype을 새로 만들지 않는다. prototype을 만들지 못한 후보는 unmeasured(적격도 기각도 아님)로 남기며 측정 없이 비교하지 않는다. D는 별도 main/worker 그래프의 출력 순서·manifest/contenthash 연결·dev와 production 동일 loader 연결을 먼저 작은 feasibility probe로 확인; 구조적으로 불가임을 입증하면 이후 고비용 기능 측정 전에 기각한다.
1. 최신 안정 HEAD·lock·Node/browser/빌드 flags·base path·baseline SHA, 각 clean build 반복2회의 자산명/bytes/SHA. 기준 제품 버전은 마지막 제품 작업 종결 후 고정. 오래된 154,886B를 재측정 없이 기대값/절감 약속으로 사용하지 않는다.
2. main/각 worker/public ESM·동적 import별 실제 배포 파일 inventory와 실행 경로. js/mjs/cjs/worker/vendor 예외 명시, 누락 file·unknown provenance 0을 요구하되 해당값이 없으면 unknown으로 보고, 0B로 합산 제외하지 않는다.
3. module normalized identity·version·rendered SHA·raw/rendered gzip·chunk gzip·attribution 합 및 rounding, source-to-output map; baseline 없는 worker 내부는 사후 추측 복원 금지. 실제 byte 변화/모듈 이동/gzip 배분 변화를 세 열로 분리. 계측의 이동 credit은 normalized module identity/version/rendered SHA까지 일치할 때만 인정하고 wrapper/minification 차이로 불일치하면 unknown으로 둔다. 별도로 공급 dedup 이득은 동일 배포 URL+content SHA+실제 network 요청으로 계산하며 whole-file 동일성을 module 귀속으로 바꾸지 않는다. sourcemap/rendered-length는 귀속 조사 자료이지 동일SHA gate 면제 수단이 아니다.
4. 실제 다운로드(브라우저): 일반 home→PDF organize/finish→QR bulk/PDF, 각 독립 cold/warm, transfer/encoded/decoded bytes·URL set·새 runtime 요청횟수·cache hit·route 진입시간·첫 결과시간. main/worker 공유 URL이어도 parse/compile/heap은 realm마다 별개라 메모리 공유로 주장 금지.
5. peak main+worker 메모리(bytes)·메인 50ms timer의 **최대 event-loop gap(ms, 낮을수록 좋음)**·cancel latency(ms)·작업 성공/재실행률. 같은 fixture·기기·환경 warmup1+5회 median/p95(실행별값도 보존). cold는 새 브라우저 프로필·CacheStorage/SW 해제·CDP Network.clearBrowserCache 후 실행, warm은 같은 profile에서 동일 route 시퀀스를 1회 실행해 캐시를 채우고 측정한다. bytes·URL/request count는 clean build/run별 exact delta로 기록하고 시간/메모리 noise 공식을 적용하지 않는다. 실패/timeout은 이진 gate다. 실제 noise band는 control 반복에서 먼저 계산. GPU/native 미계측은 명시.
6. 코드 변경면적(파일/worker/loader/테스트)·개발/회귀 비용 추정·브라우저 미지원 범위와 로더 실패/복구 설계. 5~10인일은 과거 추정, B1에서 새 근거로 갱신.
7. schema3 과거 보고서 불변 보존, 필요 새 schema 병렬 산출·같은 source의 과거/새 계측 양방향 대조. 새 .mjs/worker 누락, duplicate hash, metadata 누락, moduleSHA 변조를 주입한 gate가 실패해야 한다. size 제한이 해제되어도 계측 건전성 실패는 B1 완료를 막는다.

## 사전 채택/기각 규칙
- 우선순위는 **기능/데이터 무결성·격리/오프라인·취소·호환성 → 측정 완전성 → 사용자 체감/네트워크 순이득 → 개발 비용 → 배포 크기 이득**. 상한/예산 여유를 기준으로 후보를 선택하지 않는다.
- B1 완료는 위 7산출과 재현 명령/출력·실패도 포함한 진단보고 완비. 진단 결과 “불가능/현 구조 유지”도 유효 완료. 없으면 B2 실행안 선택 불가.
- B와 D 각각 기능 gate를 모두 통과한 경우, JS 배포 독립 합계 순감>0이며 cold transfer bytes가 control보다 증가하지 않고 첫 결과시간/최대 event-loop gap/cancel latency/peak memory 각각에서 control noise band를 넘는 악화가 없는 후보를 적격으로 둔다. noise band = control 5회 max−min, 시간/메모리 후보 median이 control median+noise band를 넘으면 악화. 1회 실패/timeout도 성공률 저하로 별도 fail, 중앙값으로 숨기지 않는다. 작은 노이즈로 판단 못 하면 N 유지하며 후속 추가 측정 조건을 기록한다.
- 둘 다 적격이면 worker.format 전역변경 없이 유지 가능한 안→변경 worker/loader 수가 적은 안→실제 cold 다운로드 감소가 큰 안 순서로 선택. 동률은 비용 추정이 낮은 안. 이 순서로 고를 수 없는 기능/성능 tradeoff는 B1 실측표를 사용자 결정으로 분리; 지금 가상 수치로 묻지 않는다.
- A는 B/D 모두 품질 gate에서 탈락하고 중복 공급 해소의 실제 네트워크/응답성 이득이 계측된 경우에만 후속 상세 설계 후보. 대규모 이관을 성능 향상 없이 용량 숫자만으로 착수하지 않는다.
- N이면 '중복 제거 구현 완료'가 아니라 '중복 유지 결정·다이어트 조사 종결', 근거와 남은 비용을 backlog에 남긴다.

## B2 구현 정본이 나중에 고정할 것
채택 후보/생성 스크립트·고정 dependency/hash·module public API·external 범위·export map·dev/production/base path·asset cache/stale retry·type checking/class identity·copy/transfer ownership·worker별 적용 범위·실제 계측 schema를 파일별로 확정한다. 로더 URL 생성과 라이선스는 생성기에서, public/dist/vendor 수기 수정0. 이 문서는 해당 값들을 빈칸 채우듯 발명하지 않는다.

## 단계 및 완료 기준 검증 명령
B1 진단 → B2 실제 공급 구현안 재왕복/정본화 → 별도 구현 지시 → B3 회귀. 신규 진단 하네스 `tests/bundle-pdflib-dedup.mjs`는 미래 추가 대상. 모든 크기 명령은 상한 해제 잡의 측정 계약을 먼저 확인; legacy budget CLI 실패를 성공으로 처리하거나 override를 몰래 넣지 않는다.
```sh
npm run build
npm run test:unit
node tests/bundle-pdflib-dedup.mjs
npm run bundle:measure
npm run test:pdf-finish-oracle
npm run test:pdf-finish
npm run test:qr-bulk
npm run test:qr-font-render
npm run test:browser
npm run test:new-tools
npm run test:office
npm run test:excel-compare
npm run test:excel-cleaner
npm run test:recovery
npm run test:static
```
글로벌 worker.format을 바꾸면 **현행 전체 worker inventory** 정상작업·취소·다시시작·load failure fallback을 각 owner smoke로 실행한다. 이전21개는 고정 기대목록이 아니며 실제 재귀 inventory와 대응해야 한다. legacy bytes/QR한글 시각·PDF 구조/합성 finish 골든, 두 빌드 교체·`/`/`/probe/` HTTP/MIME·production 일반 광고·기존 격리 요청0 필수. 새 메시지만 ko/en, URL/SEO/FAQ/static/sitemap 의미 변화0은 실제 전후 대조로 기록한다.

## 명시 제외
이번 B1 계측 구현/제품 코드/저장소 수정/commit/push/deploy, B1 전 실제 B2안 선택, 과거 상한 복원/변조·baseline 교체로 과거 PASS 만들기, JSZip 제거·벤더 최신화·폰트 subset 재시도·공용 UI 개편.

## 반박에서 뒤집힌 것
R1 sol 4건 수용: ①B1 진단에는 /tmp 후보 prototype 측정도 필요, ②byte/시간/메모리/heartbeat/실패 단위와 방향 분리, ③공급 dedup와 module 귀속 분리, ④D feasibility를 고비용 측정 전에 추가. 판단 변경2건(①②), 명확화2건(③④). R2 독립 확인 완료, 이견0. 사용자 지시로 뒤집힌 별도 판단: shared 실패가 B2 진입을 막는다는 과거 조건을 폐기. 이 사용자 결정은 sol 반박 건수와 구별한다.

## 사용자 결정으로 분리
현재 새 사용자 선택이 필요한 실제 쟁점은 없음. B1 전 후보/완료일/비용을 확정하지 않는다. B1 후 정량 tradeoff가 위 규칙으로 해소되지 않을 때만 구체 선택표를 넘긴다.
