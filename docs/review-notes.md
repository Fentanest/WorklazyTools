# 검토 기록 (Review Notes)

검토 과정에서 산출된 사고의 결과물 정본 — 판정·기각 사유·실측 수치·가설 검증을 작업 단위로 기록한다(「작업 기록」 규칙). 코드에 일어난 변경 자체는 `CHANGELOG.md`에 간결히 기록하고, 여기에는 "왜 그렇게 했고 무엇을 기각했나"를 남긴다. 같은 길을 다시 제안하기 전에 이 파일을 먼저 확인한다.

## 2026-09-04

### 네이버 SEO — 루트 언어 선택 랜딩 메타 보강 (Codx)

- **진단·문구 실측**: 배포 기준 루트 description은 85 code points·UTF-8 123B이고 Open Graph·Twitter 태그는 0개였다. 확정 문구 `Choose English or Korean. 무료 업무 도구의 언어를 선택하세요.`로 교체한 빌드 결과는 description 정확히 1개·46 code points·76B였다.
- **소셜 메타 판정**: 기존 `getSocialImageDefinition("en", "/")`를 재사용해 기본 이미지 `https://worklazy.net/social/worklazy-tools-share.png`(1200×630 PNG·199,195B)를 절대 URL로 생성했다. 정본의 순서대로 canonical, ko/en/x-default, 나열된 Open Graph 전 항목과 Twitter 5종을 배치했다. “OG 12종” 표제와 달리 확정 목록은 `og:locale:alternate`와 `og:image:alt`를 포함해 실제 13태그이므로, 목록 우선 계약에 따라 13개 모두 각각 1개로 생성·검증했다.
- **중복·범위 판정**: `dist/index.html`에서 title·canonical·hreflang 3종·Open Graph 13개·Twitter 5개는 모두 각각 1개였고 나열 순서는 단조 증가했다. 루트 `worklazy-route-jsonld`는 0개를 유지했으며 `src/app/seo.ts`, 언어/도구 페이지, 사이트맵, 광고·격리 경로는 수정하지 않았다. 메타 전용 변경이라 화면 배치와 ko/en 런타임 문구에는 영향이 없다.
- **검증 실측**: `npm run build` exit 0(2,429 modules·Vite 57.48초·정적 59페이지), `npm run test:static` exit 0, `npm run test:unit` exit 0(158/158), `git diff --check` exit 0이었다.

## 2026-09-03

### shadcn 마이그레이션 라이브 UI 복구 — 6개 revert 판정 (Codx)

- **파손·복구 범위 판정**: 라이브 문서 비교 화면에서 스위치가 얼룩처럼 렌더되고 문서 쌍 영역 텍스트가 세로로 낙하한 현상은 사용자 실측으로 확정됐다. 신규 Excel 비교 U1·Excel 정리 U2와 테스트 전용 P-V(`10a4b72`)는 유지하고, P1c `415e35b` → P1-polish `00bd3fd` → P1b `d998afa` → P1a `fdfb6c3` → P0b `df8e85c` → P0a `c43e1a7` 순서로 revert했다. 6건 모두 충돌 없이 적용되어 수동 충돌 해소는 없었다.
- **트리·의존성 판정**: revert 뒤 `git diff --exit-code 10a4b72 HEAD --`와 `git diff dac13bb HEAD -- src/`는 모두 출력 없이 exit 0이었다. 따라서 `src/` 잔차는 tests 제외나 U1/U2 예외를 적용하기 전부터 0이며, 실제 이력상 U2는 `dac13bb` 자체이고 U1은 그 이전이라 둘 다 보존됐다. package manifest/lock의 shadcn·Tailwind 참조는 0건이고 `components.json`·`src/lib/utils.ts`·`src/styles/tailwind.css`·`src/components/ui/`는 모두 제거됐다. `global.css`·`ui.tsx`·ToolGuide·OperationProgress·ToolCard·LanguageSwitcher·AppShell은 `dac13bb`와 일치했다.
- **P-V 시각 판정**: 기준선을 갱신하지 않은 `npm run test:visual`이 Chrome 152.0.7977.64에서 원본 24/24를 일치시켰다(per-pixel threshold 0.1, 전체 diff ≤0.100%, 기존 footer 허용 영역만 적용). 후속 마이그레이션이 재생성했던 기준선이 P-V 원본으로 복원됐다는 점과 전환 이전 UI 복구를 함께 증명한다.
- **문서 비교 실측**: production build 로컬 preview의 `/ko/tools/document-compare/`를 1440×1200에서 캡처한 `/tmp/worklazytools-live-recovery/document-compare-restored-ko-desktop.png`를 직접 확인했다. 스위치 7개는 모두 43×25px·`border-radius: 999px`의 캡슐형이며 21×21px 원형 노브가 정상 분리됐다. 수정 전/후 문서 영역은 각각 484px 너비로 나란히 놓였고 `writing-mode: horizontal-tb`·페이지 수평 overflow 0으로 텍스트 세로 낙하가 없었다.
- **추적 제외 로컬 검수**: dev build에서 개인정보 동의를 `granted`로 고정하고 `/tmp/worklazytools-live-recovery/document-compare-restored-ko-dev-no-tracking.png`를 추가 캡처해 같은 정상 배치를 직접 확인했다. Google·Naver 분석 script 0, AdSense script/slot 0, 외부 요청 0으로 로컬 검수 중 추적·광고 로더가 비활성임을 확인했다.
- **검증 판정**: `npm run build` exit 0(2,429 modules·정적 59페이지), `npm run test:unit` 158/158, `test:visual` 24/24, `test:excel-compare`, `test:excel-cleaner`, `test:utilities`, `test:static`, `test:office`, `test:xls-preserve`, `test:xls-first-load`, `test:new-tools`, `test:video-hybrid`가 모두 exit 0이었다. `test:browser`는 서버 미기동 1회와 Vite cold dependency optimize/reload(Excel·Word·PDF) 중단 뒤 모든 lazy dependency가 warm인 동일 전체 명령에서 Excel·Word·PDF 스모크가 exit 0으로 통과했다. 제품 URL·ko/en 문구·SEO·광고/격리·GitHub Pages 구조에는 전환 이전 상태 이외의 변경을 넣지 않았다.

### shadcn 마이그레이션 P-V — 시각 회귀 기준선 판정 (Codx)

- **고정 매트릭스**: 홈 기본 상태·도구 목록의 `category=media` 필터 상태·Excel 비교 빈 상태 3개를 ko/en × light/dark × desktop 1365×900/mobile 390×844(DPR 1)로 전개해 정확히 24개 viewport PNG를 고정했다. Chrome 152.0.7977.64에서 채집한 before 기준선은 4,979,977B(약 4.8MiB)이며 대표 desktop/mobile 화면을 직접 확인해 lazy route 로딩 잔상과 빈 화면이 없음을 확인했다.
- **재현 계약**: `npm run test:visual`이 고정 포트의 로컬 Vite를 자체 기동하고 외부 origin 요청과 서비스워커를 차단한다. privacy consent는 denied, locale은 route와 localStorage에 일치시키고 `prefers-color-scheme`을 명시한다. 모든 animation·transition·smooth scroll·caret를 비활성화하고 폰트 준비와 2 RAF 뒤 viewport만 캡처한다. 허용 영역은 시간 의존적인 `.global-footer > span:first-child` 한 곳뿐이다.
- **회귀 0 판정**: pixelmatch per-pixel threshold 0.1, antialiasing 제외, 전체 픽셀 중 diff 비율 ≤0.100%를 “시각 회귀 0”으로 정의했다. 크기 불일치·기준선 누락/잉여·페이지 오류는 비율과 무관하게 실패하며, 초과 시 actual/diff PNG를 `/tmp/worklazytools-visual-regression`에 남긴다. 기준 갱신은 명시적인 `UPDATE_VISUAL_BASELINES=1`에서만 가능하다.
- **도구·검증 실측**: 비교기는 exact dev dependency `pixelmatch@7.1.0`·`pngjs@7.0.0`을 사용한다. 최초 `npm install`은 기본 `~/.npm` 캐시가 read-only여서 `EROFS`로 중단됐고, `/tmp/worklazytools-npm-cache`를 지정한 동일 설치는 성공했다. 기준선 채집 뒤 연속 자기 비교 2회가 24/24 통과했고 `npm run build` exit 0(2,429 modules, 정적 59페이지), `npm run test:unit` 158/158, `npm run test:static`, `git diff --check`가 통과했다.
- **제품 영향**: 테스트 전용 코드·dev dependency·license 생성물만 변해 사용자 문구·ko/en 리소스·SEO·정적 route·광고 배치/격리·GitHub Pages 런타임에는 제품 코드 변경이 없다.

### Excel 데이터 정리 U2 — 규칙 파이프라인·수식·출력·메모리 판정 (Codx)

- **스키마·lineage 판정**: version 1 discriminated union에 고정 type ID 28종을 두고 규칙 100개·JSON 256KiB·일반 문자열 1,000자·정규식 500자·수치 범위를 runtime에서 검사한다. variant별 unknown key, 필수 키, 기본값, 경계값, `y` flag, 잘못된 정규식을 거부한다. 첫 선택 시트의 `column:N`을 기준으로 다른 시트는 NFC 헤더명에 결합하고, 파생 열 ID는 JSON에 영속화해 생성 후 참조는 허용하되 기존/과거 파생 ID 재사용·삭제된 ID 참조·불완전 재정렬은 실행 전에 차단한다.
- **28종 구현 매트릭스**: 구조 13종은 `trim-edge-empty`·`remove-empty-rows`·`remove-empty-columns`·`collapse-consecutive-empty`·`unmerge-cells`·`unmerge-fill-down`·`rename-column`·`reorder-columns`·`delete-columns`·`combine-columns`·`split-column`·`add-constant-column`·`add-row-number-column`; 텍스트 7종은 `trim-whitespace`·`collapse-spaces`·`normalize-newlines`·`remove-invisible-chars`·`normalize-unicode`·`find-replace`·`regex-replace`; 행 필터 3종은 `dedupe-rows`·`dedupe-by-columns`·`filter-rows`; 값 변환 5종은 `fill-empty-cells`·`convert-numeric-strings`·`unify-date-format`·`format-phone-number`·`format-business-number`로 구현했다. split 초과 조각은 마지막 조각에 남기고, latest 중복의 빈 값/실패는 최구·동률은 앞 행 유지, 변환 실패는 원값 보존+오류 행 기록, 수식 셀 판정은 저장 계산값을 사용한다. 숫자·날짜·전화·사업자 변환은 텍스트 타입/`@` 서식/선행 0 보존 경계를 적용했다.
- **수식 골든 판정**: 문자열 리터럴을 건드리지 않는 A1 token 변환에서 행 삭제 `A2+$B$3+SUM(C2:D5)+"A2"`→`#REF!+$B$2+SUM(C2:D4)+"A2"`, 열 삭제 `B2+A2:C2`→`#REF!+A2:B2`, 열 삽입 `B2+A2:C2`→`C2+A2:D2`, 저장 후 재개봉 `B3+C3`→`B2+C2`를 확인했다. `$`는 보존하고 범위 부분 삭제는 남은 직사각형으로 축소하며 전체 삭제는 `#REF!`로 바꾼다. 재정렬·결합·분리로 범위가 비연속이면 그 수식 셀만 저장값으로 강등하고 오류 행을 남긴다.
- **preflight·병합 판정**: 합성 OOXML fixture에서 normal/shared/array와 캐시, shared master/ref, defined name, table, 병합, 1900/1904 날짜계를 실제 저장·재개봉했다. 교차 시트·동적·structured/shared/array/named/table 또는 비OOXML 수식은 모든 캐시가 있을 때만 사용자 확인 후 값으로 강등하고, 캐시 누락은 `시트!셀` 목록으로 차단한다. 살아 있는 병합보다 구조 규칙이 앞선 파이프라인은 차단하며 `unmerge-fill-down`은 master와 범위를 먼저 snapshot한 뒤 병합 해제·채움을 원자 적용한다. ExcelJS splice는 사용하지 않고 투영 모델에서 재구성한다.
- **실행·출력 판정**: 명시 미리보기는 이전 워커 abort+generation 폐기, 규칙 변경 뒤 stale 표시로 고정했다. worker는 규칙 시작/진행 메시지와 ID를 보내며 부모 30초 inactivity watchdog은 실제 `(a+)+$` fixture를 종료하고 UUID를 포함한 지역화 오류로 사용자 취소와 구분했다. 최종은 파일별 순차 워커로 실패를 격리한다. 입력당 선택 시트+변경 요약·처리 규칙·오류 행·제외 행의 XLSX 하나, 선택 시트별 CSV, 결과 둘 이상 ZIP을 만들며 시트명과 파일명 충돌은 결정적 suffix로 해소한다. CSV 기본은 위험 원문을 보존하고 다운로드 전에 경고하며 opt-in 모드는 작은따옴표를 붙인다. Chrome 실다운로드에서 XLSX 2개+ZIP 1개, ZIP entry 2개, 원본 byte 불변, URL 교체 정리, 취소 후 재실행을 확인했다.
- **heap 게이트 판정**: Chrome 152 `--enable-precise-memory-info`에서 CSV 파싱→C1 투영→날짜 변환 실패 100,000행→필터 제외 100,000행→4시트 XLSX 보고서 직렬화의 100,000×10 전체 경로를 실행했다. 오류/제외 capped buffer는 각각 정확히 100,000행, 누락 0행, 출력 5,040,747B였다. 단계 heap은 baseline 52,118,291B·parse 233,365,803B·투영 265,934,431B·엔진 302,740,227B·보고서 직렬화 697,908,835B·해제 뒤 152,852,193B, CDP polling peak **916,061,264B(873.62MiB)**로 합격 한도 1,258,291,200B(1,200MiB) 이하였다. 입력 buffer는 parse 직후, C1 원본 투영은 consume 직후, 엔진 모델·capped buffer는 출력 전사 직후, 출력 buffer는 인계 직후 참조를 끊는다. 보고서: `/tmp/worklazy-excel-cleaner-heap-final/excel-cleaner-heap-100000.json`.
- **현지화·SEO·광고 판정**: `/tools/excel-cleaner` route·registry와 ko/en 전 화면·오류·가이드·FAQ, 언어별 SEO title/description/application, 정적 페이지·사이트맵·소셜 이미지 생성 입력을 함께 추가했다. 일반 AdSense 경로를 유지하고 비디오·오피스·Excel 보존 격리 meta를 반입하지 않았으며 GitHub Pages 정적 실행만 사용한다. 390×844에서 가로 overflow 0, 파일·규칙 버튼 44px와 드래그의 위/아래 버튼 대안을 확인했다.
- **완료 검증**: 최종 연속 실행에서 `npm run build` exit 0(2,429 modules, Excel Cleaner page 31.65kB/9.66kB gzip, worker 1,504.81kB, 정적 59페이지), `npm run test:unit` 158/158, `npm run test:excel-cleaner`, `npm run test:excel-compare`, `npm run test:utilities`, `npm run test:static`, `npm run bench:excel-cleaner`, JS 구문 검사와 `git diff --check`가 모두 exit 0이었다. U2 코드는 `dummyfortest`를 참조하지 않고, 기존 MP4 3개·DOCX 2개는 읽기·수정·스테이징하지 않았다.

### Excel 데이터 정리 U0.1 — 편집 메타데이터·append 경계 판정 (Codx)

- OOXML 의미 모델은 ExcelJS 단일 파싱을 유지했다. ExcelJS가 빈 문자열 수식 캐시의 `<v></v>`를 `undefined`로 축약하므로, 이미 형식 판별에 연 OOXML ZIP의 worksheet XML에서 수식 셀별 `<v>` 존재 여부만 읽어 `present|missing`을 보존한다. `0`·`false`·`""`·오류 캐시와 캐시 누락 골든을 통과했다.
- shared master/slave·array ref, workbook defined name, table 범위·열, 원본 행/열 lineage를 공용 투영에 추가했다. 보고서 append helper는 기존 선택 시트를 보존하고 Excel 31자/금지문자 규칙과 대소문자·NFC 충돌을 결정적 `(2)` suffix로 해소한다.
- 표적 검증: `npx tsc -b --pretty false`와 `node --test --experimental-strip-types tests/unit/spreadsheet-core.test.ts` 6/6, `git diff --check` exit 0.

### Excel 비교 U1 후속 X-A~X-C — 보고서·파일 배치·선택 대사 판정 (Codx)

- **X-A 보고서 무결성 판정**: worker는 생성 직후 양수 byteLength와 `PK\x03\x04`를 검사하고 transfer와 별개인 `reportByteLength`를 동봉한다. client는 수신 buffer 길이, page는 Blob 크기를 각각 대조하며 세 실패는 `REPORT_INTEGRITY_FAILED`의 ko/en 재실행·재다운로드 안내로만 노출한다. 0바이트와 길이 불일치 page 주입은 다운로드 링크 없이 같은 안전 문구로 귀결됐다. 브라우저가 OS 다운로드로 넘긴 뒤의 저장 파일은 앱이 사후 검사할 수 없으므로, 재발 시 저장 파일 크기와 브라우저 이름을 받는 안내를 결과와 오류에 함께 두었다.
- **X-A URL·실다운로드 판정**: 이전 결과 URL 목록을 스냅샷한 뒤 `completed`/ZIP 제거가 DOM에 커밋된 다음 effect에서만 revoke하고, 언마운트에서는 소유 URL 전부를 정리한다. Chrome CDP 다운로드 설정으로 실제 디스크 파일을 내려받아 15,392B, PK 서명, ExcelJS 재개방, 정확한 9시트와 Summary `matched=8`·`changed=2`를 확인했다. 다음 실행에서 이전 앵커 부재가 먼저 확인된 뒤 그 URL의 revoke 호출이 관측됐다. preview 상태는 `COOP=same-origin`·`COEP=require-corp`·`crossOriginIsolated=true`·기존 서비스워커 제어였고 같은 환경에서 실다운로드가 정상이라 Excel 경로의 서비스워커/격리 상태를 빈 파일 원인으로 연결하지 않았다.
- **X-B 파일 배치·교환 판정**: 공용 단일 파일 drop zone 대신 `PairFileDropZone`을 두고, `assignPairFiles`가 빈 슬롯을 왼쪽부터 채우며 점유 슬롯을 보존하고 초과 파일 수를 알린다. 빈2+2·빈2+1·빈1+1·빈1+2·빈0+N의 5종 단위표가 통과했다. 교환은 file·inspection·검사 상태·error·sheet·header row·기본/보조 key·금액/날짜/거래처 mapping을 모두 맞바꾸고 검사 중 비활성화한다. Chrome에서 검사 중 비활성→완료 후 활성, 점유 쌍에 추가한 2개 파일 전량 거부 안내와 기존 이름 불변, 교환 전 `added=2/removed=0`에서 교환 후 `added=0/removed=2` 방향 반전을 확인했다.
- **X-C 선택 대사·한도 판정**: 금액 열은 필수로 유지하고 날짜·거래처/설명은 좌우 동시 사용/미사용 validator를 UI와 엔진이 공유한다. 정·역방향 partner/day 후보 필터는 활성 기준만 적용하며 비활성 기준에서 `INVALID_DATE`/`INVALID_PARTNER`를 만들지 않는다. 활성 오류는 `INVALID_AMOUNT`·`INVALID_DATE`·`INVALID_PARTNER`로 나뉜다. 정확 금액 후보에도 대상당 10개 상한을 적용해 초과 시 `RECON_SEARCH_LIMIT`로 자동 확정하지 않고, 역방향 복수 조합은 관여한 미확정 좌측 거래마다 Ambiguous 한 행으로 회계한다. 비적용 Parameters는 빈 문자열·거짓 기본값 대신 `UNUSED`로 기록한다.
- **X-C 골든 판정**: 날짜 미사용·거래처 미사용·금액 단독, 좌우 불변식 위반, 활성 오류 3종, 정방향·역방향 대칭, 후보 11개 초과, 전역 조합 한도를 단위 검사했다. 브라우저 금액 단독 fixture는 15,151B의 9시트 보고서로 재개방됐고 Summary는 `ambiguous=2`·`unmatched=3`·`error=0`, 날짜·거래처·날짜 허용치는 `UNUSED`, 후보 상한은 실제값과 같은 `10`이었다.
- **신고 파일 로컬 비게이팅 확인**: `dummyfortest/2026년 설 선물 발송처_20260204_취합.xlsx`와 `_김민정.xlsx`를 읽기 전용으로 현행 엔진에 직접 전달했다. `최종` 시트 78행×10열에서 770 records(`matched=761`, `changed=9`, 나머지 0), 보고서 49,958B·`504b0304`·ExcelJS 재개방·9시트를 확인했다. 보고서 데이터 행은 Summary 8·Parameters 46·Matched 761·Changed 9·Added/Removed/Duplicates/Ambiguous/Errors 각 0이었다. `src/`·`tests/`·`scripts/`·`package.json`의 `dummyfortest` 참조는 0건이며 신고 파일은 CI 게이트와 스테이징에서 제외했다.
- **현지화·SEO·광고 판정**: 변경된 사용자 문구와 접근성 라벨을 ko/en 동형으로 추가했고 내부 실행 명칭·원시 오류를 노출하지 않는다. 기존 `/tools/excel-compare` URL·registry·SEO 정적 페이지·사이트맵·FAQ·소셜 이미지 생성 입력과 일반 AdSense 배치, 광고 제외 격리 경로는 바뀌지 않았다.
- **완료 검증**: 최종 연속 실행에서 `npm run build` exit 0(2,423 modules, Excel Compare page 170.02kB/70.55kB gzip, worker 1,488.10kB, 정적 57페이지), `npm run test:unit` 147/147, `TEST_BASE_URL=http://127.0.0.1:4174 npm run test:excel-compare`, `npm run test:static`, `git diff --check`가 모두 exit 0이었다. 합성 fixture만 게이트에 사용했고 `dummyfortest` 코드·테스트 참조 0건을 유지했다.

### 비디오 W-A~W-D — DV base layer·호환 사유·음향 대안·진행 로그 판정 (Codx)

- **DV 판정·격리**: `dvcC`/`dvvC` 첫 5바이트에서 version 1.0·profile 8·BL present·compat 1/2/4만 허용하고, config 누락/단축·그 밖의 version/profile/compat·BL 없음·dual box는 구체 parser cause로 거부한다. `dvh1`/`dvhe`는 target encode/hybrid parse에서만 HEVC base layer로 열고 stream-copy는 계속 거부한다. hvcC에서 만든 base codec string은 32비트 compatibility를 unsigned bit reversal하고 constraint 원순서와 후행 0 생략을 보존한다. job의 compat ID는 중복 제거해 HDR10/SDR/HLG 단일 또는 혼합 안내로 preflight·결과 화면에 유지한다.
- **사유·용량 판정**: probe 실패는 parser/capability discriminated union으로 보존하고 모든 확정 cause를 사용자 행동 중심 ko/en 호환 변환 안내에 전사했다. 우선순위는 구제 CTA → 안전 용량 차단 → 구체 cause → decision 사유다. 1.5GiB predicate는 정확 임계만 허용하고 +1·NaN·음수를 거부하며 route fallback과 UI가 공유한다. UI 차단은 신뢰 가능한 예상치가 있는 target-bitrate video encode에만 적용하고 copy·CRF·GIF·음향은 제외한다. 4K 해상도는 시간·메모리 비차단 경고만 낸다.
- **음향 대안 판정**: WebCodecs parser 1회 결과로 현재 모드와 remove/encode 대안을 함께 평가한다. AAC 인코더 지원 여부로 선택하는 기존 hybrid와 달리, E-AC-3 등 소스 음향 부적합 구제는 `AUDIO_ENCODER_SUPPORTED`에 막히지 않게 분리했다. 두 대안이 가능하면 192kbps·원본 샘플레이트의 음향 변환을 기본 CTA, 음향 제외를 보조 CTA로 제시하고 job별 override와 결과 경고까지 유효 모드를 전파한다. copy 경로는 기존대로 변환을 제안하지 않는다. Chrome H.264+E-AC-3 target 스모크에서 encode/remove 두 선택이 각각 출력 1개로 완주했다.
- **진행 로그 판정**: worker→controller→`VideoWorkerProgress`→hook에 job/stage key를 전달해 같은 stage 행을 제자리 갱신하고, 현재 스피너는 배열 끝이 아니라 active ID/key를 따른다. coalescer는 정수 % 변경·100ms heartbeat·명시 완료 중 하나일 때만 내보내며 최종 mux/write 명시 완료는 중복 100%여도 보존한다. fake clock 50,000회 보고는 명시 완료 전 최대 101회로 제한됐고, mux/write 30쌍은 종전 63행에서 start 포함 3행(성공 추가 4행)으로 줄었다. stream-copy·WebCodecs는 audio 15%를 제외해 재정규화하고 hybrid·FFmpeg는 기존 가중치를 유지하며 mixed batch는 job별 활성 가중치를 쓴다.
- **fixture·실파일 실측**: `hvc1+hvcC`에 20-byte `btrt`를 재사용해 `dvh1`/`dvhe` × `dvcC`/`dvvC` 4종을 만들고 ffprobe tag·MP4Box hvcC+DOVI box·FFmpeg 전체 디코드를 모두 확인했다. 일반 codec string `hvc1.2.4.L30.90`, 고비트 `hvc1.B5.80000005.H123.12.34`, version/profile/BL/compat/dual/missing/short와 지원 true/false 주입이 단위를 통과했다. 이 Chrome host는 DV base-layer 스트리밍 route를 노출하지 않아 실제 HEVC encode만 skip하고 deterministic capability 단위와 FFmpeg 결과·HDR10 안내를 확인했다. 512MiB×2 희소 패스스루는 퍼센트가 있는 14행으로 완주했다. 사용자 제공 H.264/AAC 실파일 3개(3840×1600 2.37GiB + 2560×1080 1.06GiB×2, 합계 4.49GiB)는 read-only로 26.9초에 출력 3개를 만들었고 progress 이력 33개가 단조, 로그는 stage/job당 한 행인 20행이었다. 원본은 수정·스테이징하지 않았다.
- **범위·제품 표면 판정**: DV RPU/metadata 보존, profile 5/7, DV stream-copy, E-AC-3 pass-through, copy 경로 음향 변환, 해상도 hard block, 비video 용량 가드는 확정 제외를 유지했다. URL·SEO 메타·정적 페이지·사이트맵·FAQ·광고 배치와 비디오 광고 제외 격리 경로는 바뀌지 않았다. ko/en key 동형·내부 구현 명칭 비노출과 GitHub Pages 정적 실행 구조를 유지했다. 기준 커밋에서 Excel Compare 추가 뒤 유틸리티 카탈로그 기대치가 ko 18/en 17에 남은 선행 누락은 실제 registry의 ko 19/en 18로만 교정했다.
- **완료 검증**: 최종 연속 실행에서 `npm run build` exit 0(2,419 modules, stream worker 260.76kB, Video Studio 92.61kB/25.41kB gzip, 정적 57페이지), `npm run test:unit` 134/134, `npm run test:new-tools` 전체 HWP·이미지·오디오·비디오, `npm run test:utilities`, `npm run test:static`, `npm run test:video-hybrid`, `npm run test:excel-compare`, `node --check tests/new-tools-smoke.mjs`, `git diff --check`가 모두 exit 0이었다. 하이브리드는 6초 단일/12초 concat 모두 전체 decode·브라우저 재생·단조 DTS·A/V drift 한계·취소 후 부분 파일 0을 통과했고, Excel 비교는 공용 진행 훅 사용 상태에서 단일/다중/격리 실패/취소/모바일 회귀를 통과했다.

### 신규 도구 U0 — 스프레드시트·파일명·ZIP·보고서 공통 경계 판정 (Codx)

- **입력 경계 판정**: 확장자가 아니라 ZIP 내부 `xl/workbook.xml`/`xl/workbook.bin`과 content type, OLE·SpreadsheetML 서명을 우선해 XLSX/XLSM/XLS/XLSB/SpreadsheetML/CSV를 분류한다. OOXML은 ExcelJS 한 번, BIFF8·XLSB·SpreadsheetML은 SheetJS 한 번, CSV는 PapaParse 한 번만 파싱하며 기존 Excel 병합의 일괄 선버퍼링은 편입하지 않았다. 시트명·헤더 행 선택 모델과 수식/캐시값/표시값/numFmt/병합/OOXML 서식 공통 모델을 고정했다.
- **재사용 경계 판정**: OLE·SpreadsheetML 서명과 CDATA 전개, theme+tint RGB 베이크 구현을 `spreadsheet-core`로 옮기고 기존 병합 표면은 얇은 재노출만 남겼다. `requiresLegacySpreadsheetConversion`은 보존 변환 판정기로 기존 영역에 유지했다. XLS·XLSB 스타일은 어댑터가 비교 가능으로 승격하지 않는다.
- **파일명·ZIP 판정**: NFC 뒤 빈 이름·경로 구분자/상위 경로·제어/Windows 금지 문자·예약 이름·말단 점/공백·255 UTF-8 byte·대소문자/NFC 충돌을 검사하고 결정적 `-N` 이름을 만든다. 중립 ZIP writer는 branded 이름을 런타임 재검사한 뒤 파일을 한 번에 하나씩 Blob stream으로 읽고 강제 ZIP64로 쓴다. 기존 비디오 경로는 이 공용 writer를 호출하며 회귀에서 전체 `arrayBuffer()` 0회·다중 chunk·ZIP64 EOCD·외부 `unzip -t/-p` 및 SHA-256 왕복을 통과했다.
- **주입 경계 판정**: `writeUntrustedText`는 값 객체를 수용하지 않고 `String(value)` primitive와 text numFmt로 기록한다. `=`·`+`·`-`·`@`·탭·CR/LF·선행 공백·formula-object 음성 대조를 XLSX 재개봉 후 문자열 타입으로 확인했다.
- **U0 검증**: TypeScript build 검사 exit 0, 표적 U0/테마/legacy 단위 9/9, 전체 unit 110/110, `video-zip-streaming` 1/1, 정적 산출 검사 exit 0. URL·사용자 문구·광고 배치·격리 경로는 U0 공개 화면이 없어 바뀌지 않았다.

### 신규 도구 U1 — Excel 비교·재조정·보고서 판정 (Codx)

- **형식·파서 판정**: XLSX/XLSM은 ExcelJS, BIFF8 XLS·XLSB·SpreadsheetML은 SheetJS, CSV는 PapaParse라는 U0 단일 파서 경계를 그대로 사용했다. XLSX/XLSM만 numFmt·글꼴·솔리드 패턴 채움·테두리·정렬·보호를 비교하고 gradient와 XLS/XLSB 서식은 제외했다. OOXML `date1904`는 `xl/workbook.xml`을 직접 확인하고 ExcelJS의 Date 변환 여부를 대조해 1462일 보정이 중복되지 않게 했으며, 1900/1904 fixture의 날짜·시각이 동일하게 정규화됐다.
- **비교 판정**: 위치 방식은 열을 먼저 대응한 뒤 행의 FNV 서명과 실제 셀 내용을 재확인하고, patience anchor 사이의 제한 DP를 사용한다. 키 방식은 복합 키와 보조 열·발생 순서·오류 처리 중복 정책을 지원한다. 재조정 방식은 후보 10개, 부분집합 1,023개, 전체 평가 1,000,000회 상한에서 1:N/N:1을 찾고 복수 최적해는 모호함으로 분리한다. 정렬·재조정 루프는 4,096회 이내마다 취소를 확인하며, 상한 초과는 각각 `ALIGN_LIMIT_FALLBACK`·`RECON_SEARCH_LIMIT`의 사용자용 설명으로 강등한다.
- **정규화·결과 판정**: NFC·공백·줄바꿈·대소문자·날짜·숫자 문자열·수치 허용 오차를 독립 옵션으로 두고 선행 0과 text numFmt `@`는 숫자 승격에서 제외했다. 수식 원문·캐시값·표시값과 수식 캐시 누락 상태를 구분한다. 결과는 Summary·Parameters·Matched·Changed·Added·Removed·Duplicates·Ambiguous·Errors의 정확히 9개 시트이며 외부 유래 값은 모두 문자열 셀로 기록해 재개봉 시 수식 셀이 0개였다.
- **수명주기·배치 판정**: 비교 쌍을 순차 처리하고 현재 쌍의 ArrayBuffer만 worker로 넘긴다. 성공·실패·취소 모든 종결에서 worker를 종료하며 같은 File은 다음 쌍에서 다시 읽는다. 각 성공 쌍의 보고서는 즉시 개별 다운로드하고 성공 보고서가 2개 이상일 때만 안전 파일명 검사를 거친 ZIP64 묶음을 제공한다. 손상 파일 한 쌍은 실패해도 나머지 두 쌍의 보고서와 ZIP이 생성됐다.
- **브라우저 스모크**: Chrome 152, 390×844/DPR2/touch에서 단일 쌍은 `left-vs-right.xlsx`만, 2성공+1손상 쌍은 개별 보고서 2개와 `worklazy-excel-comparisons.zip`을 만들었고 ZIP 항목명도 두 보고서와 일치했다. 9시트·전 셀 문자열·수식 0, 상태 색상+텍스트 필터 8종, 검색, 취소, 실패 격리, XLSB/XLSM 지원 문구를 확인했다. 모바일 가로 overflow는 0px, 쌍 카드 열 폭 294px, 파일 선택 동작 높이는 44px였다.
- **정렬 성능 게이트**: Chrome 152/V8 heap 512MiB·CPU 4배 throttling·390×844에서 3,000×3,000(9,000,000 cell product) 세 표본 `683.4/694.7/643.9ms`, 중앙값 `683.4ms`, peak heap `20,603,501B`, checksum `4018493048`, fallback 없음이었다. 3,465×3,465(12,006,225)은 `2.9ms`에 결정적 위치 대응 3,465개와 `ALIGN_LIMIT_FALLBACK`을 반환했다. 보고서는 `/tmp/worklazy-excel-compare-alignment-final/excel-compare-alignment-mobile-golden.json`이다.
- **실형식 fixture 판정**: 생성 스크립트가 BIFF8 Formula record, XLSB `BrtFmlaNum`, 수식·서식을 포함한 XLSM과 실제 VBA project, SpreadsheetML 수식, CSV, OOXML 1900/1904 날짜, 손상 파일, 5,000행 취소 입력을 매번 임시 디렉터리에 만든다. BIFF8 수식 `7`, XLSB 참조 수식 `A1`, XLSM 수식 `B2+C2`, VBA project 15,872B와 Module1 stream을 재파싱해 형식 이름만 바꾼 fixture를 배제했다.
- **현지화·SEO·광고 판정**: ko/en 기능 key 동형과 사용자용 오류·가이드의 내부 명칭 비노출을 단위 검사했다. `/tools/excel-compare` ko/en 정적 페이지·canonical/hreflang·사이트맵·FAQ 각 3개·소셜 이미지 2개를 생성기 입력에서 추가했다. 이 도구는 일반 AppShell 경로이므로 기존 AdSense loader가 활성화되고 비디오·Office App·XLS 보존 격리/광고 제외 목록에는 편입하지 않았다. 스모크에서 광고 loader 존재와 isolation marker 부재를 확인했다.
- **검증**: U1 표적·fixture·공통 정렬 단위 13/13, SEO·문서 정렬·Excel 비교 단위 19/19, 전체 unit 119/119, 비디오 ZIP 스트리밍 1/1, 제품 브라우저 스모크와 정렬 벤치가 통과했다. 최종 `npm run build`는 exit 0(2,416 modules, Excel Compare page 164.18kB/68.86kB gzip, worker 1,486.75kB, 정적 57페이지), `npm run test:static`은 localized pages·hreflang·self-hosted runtime·ads.txt·robots.txt·sitemap 검증으로 exit 0이었다. `git diff --check`도 커밋 직전 실행한다.

### 비디오 V-A+V-B — copy 사유 안내·오디오 선행 하이브리드 판정 (Codx)

- **V-A 사유·선택 판정**: `VideoProcessingJobRoute`에 stream-copy/WebCodecs/hybrid probe의 상세 사유를 보존하고, copy 실패 job만 `audio=remove`로 다시 probe해 성공한 job에만 기존 remove 모드 override를 제안한다. 배치의 형제 job 설정은 바꾸지 않는다. ko/en copy 오류·WebM 경고는 음향 변환을 구제책으로 제안하지 않고 음향 제외만 안내한다. 제품 Chrome 스모크에서 faststart H.264+E-AC-3 MP4를 `2,147,483,649B` 희소 파일로 확장해 사유 문구·제안 버튼·수락 후 stream-copy 결과 생성을 확인했고, `2,147,483,650B` `dvhe` sample-entry fixture는 음향 제안 없이 대용량 가드의 화면 압축 방식 안내로 분리했다. 작은 비호환 영상의 기존 FFmpeg 폴백은 유지한다.
- **V-B 파이프라인·동기 판정**: 오디오 encode와 실제 AAC `AudioEncoder` 미지원이 함께 확인될 때만 hybrid route를 선택한다. 원본 hybrid parse는 오디오 codec을 거부하지 않고 video track과 원본 음향 메타데이터만 취득한다. FFmpeg WORKERFS에서 각 구간을 `atrim→asetpts→aresample/aformat`한 뒤 concat·AAC M4A 생성을 먼저 끝내고, MEMFS 사본 삭제·unmount·FFmpeg terminate 후 M4A를 worker로 transfer한다. mp4box edit list의 `media_time`(AAC priming 1,024 samples)을 뺀 비음수 packet만 0 기준으로 다시 놓아 video encoded chunk와 시간순으로 mux하며, demux 뒤 원본 M4A buffer 참조와 완료 뒤 packet queue를 해제한다.
- **취소·실패·진행률 판정**: 진행률에 audio 15% 구간을 신설하고 demux/decode/encode/mux/write를 8/20/35/12/10%로 재배분했다. 오디오 워커의 유휴 취소는 FS 정리 후 terminate, 활성 FFmpeg 취소는 terminate 뒤 FS API를 호출하지 않는 강제 분기로 나눴다. 스트리밍 워커는 `audio-demux`·`video-codec`·`mux-write`·`quota`를 오류에 태깅하고 오디오 FFmpeg의 `audio` 행과 함께 각 행이 예상 출력 ≤1.5GiB일 때만 전체 FFmpeg로 폴백한다. 소형 Chrome 스모크에서 idle=`idle`, 실행 중 audio=`forced`, video abort 관측=true, OPFS `result-*` 잔재 0을 확인했다.
- **추정·4K 선행 결함 판정**: target 예상 bytes를 `((video bps + audio bps) / 8) × duration × 1.1`로 고쳤다. audio는 remove=0, encode=설정값, copy=입력별 probe bitrate의 최댓값이며 입력 하나라도 미상이면 320kbps를 쓴다. 같은 값을 quota, 1.5GiB 단계별 폴백, OPFS expected size, write 진행률 가중에 전달한다. 중간 M4A 상한은 `(audio bps / 8) × duration × 1.2`다. 최초 4K 정식 실행은 출력 H.264가 해상도와 무관하게 Level 3.1로 고정된 선행 결함 때문에 `video-codec` 실패 뒤 FFmpeg 폴백 OOM으로 실패했다. 직접 단계 진단으로 원인을 확정하고 macroblock/frame·macroblock/s·bitrate에 맞는 최소 H.264 level(4K30 8Mbps는 Level 5.1)을 선택한 뒤 동일 조건을 통과했다.
- **4K 계약 실측**: `node scripts/benchmark-video-hybrid.mjs --output-dir /tmp/worklazy-video-hybrid-4k-20260903-final` 실행. fixture 생성 명령은 `ffmpeg -hide_banner -loglevel error -y -f lavfi -i testsrc2=size=3840x2160:rate=30:duration=60 -f lavfi -i sine=frequency=997:sample_rate=48000:duration=60 -c:v libx264 -preset ultrafast -crf 23 -g 60 -bf 2 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest -movflags +faststart /tmp/worklazy-video-hybrid-4k-20260903-final/hybrid-fixture-3840x2160-60s.mp4`; fixture `489,072,912B`, SHA-256 `326d557f27d9149c38fdc679992fa8919f57ea2f24b5a00737fee295363d7ac8`. Chrome 제품 오케스트레이터는 `AUDIO_ENCODER_UNSUPPORTED→HYBRID_READY`, 예상 `67,584,000B`, 실행 `105,136.980ms`, 출력 `61,512,687B`였다. ffprobe packet 수식은 `Δstart=0s`, `Δend=-1.0547118733938987e-15s`, `|Δend−Δstart|=1.0547118733938987e-15s ≤ 1024/48000=0.021333333333333333s`; H.264 3840×2160@30+Aac 48kHz, packet DTS 단조, 전체 FFmpeg decode exit 0, 브라우저 재생 성공, OOM=false, 진행률 단조·100%였다. 보고서: `/tmp/worklazy-video-hybrid-4k-20260903-final/video-hybrid-benchmark.json`.
- **concat·CI·실파일 보조 판정**: `npm run test:video-hybrid`는 640×360 6초 개별과 동일 입력 2개 12초 concat을 모두 hybrid로 실행했다. concat `Δstart=0s`, `Δend=7.216449660063518e-16s`, drift 한도 `0.021333333333333333s`, 전체 decode/재생/OOM=false였고 CI Pages build에 같은 명령을 추가했다. 실파일 `2026_0820_074240_000094F.MP4`는 스테이징 없이 ffprobe/SHA만 보조 확인했다: H.264 3840×1600@30 + AAC 48kHz mono, `382.485313s`, `2,548,039,680B`, SHA-256 `0e2cd865245cc4241aaa5ba9c987c20711aff9c263c2862c3c7f7035e04306da`.
- **범위·현지화·검증 판정**: WebM/MKV 스트리밍·CRF WebCodecs·E-AC-3 pass-through·Dolby Vision metadata 보존은 추가하지 않았다. URL·SEO 메타·정적 페이지 수·광고 위치·비디오 격리의 광고 제외·GitHub Pages 서버리스 구조는 바뀌지 않았고 ko/en key 동형·내부 명칭 비노출·정적 산출 검사가 통과했다. 최종 `npm run build` exit 0(2,363 modules, hybrid audio worker 8.36kB, stream worker 255.88kB, 정적 55페이지), `npm run test:unit` exit 0(106/106), `npm run test:new-tools` exit 0(HWP·이미지·오디오·비디오 전체), `npm run test:utilities` exit 0, `npm run test:static` exit 0, `npm run test:video-hybrid` exit 0, `git diff --check` exit 0. 전체 new-tools 최초 실행 1회는 비디오 도달 전 기존 오디오 redo 대기 60초 timeout이었고, `TEST_ONLY_AUDIO=1 npm run test:new-tools` 및 동일 전체 명령 재실행은 각각 exit 0이었다.
- **배포 CI 환경 교정**: 첫 push `29ba546`의 self-hosted Pages runner에는 시스템 `ffmpeg`/`ffprobe`가 없어 신규 스모크가 fixture 생성 전 `spawn ffmpeg ENOENT`로 종료됐다(제품·테스트 로직 실패 아님). 첫 설치 시도 `986765c`의 AnimMouse action도 runner에 `gh` CLI가 없어 release-id 조회에서 exit 127이었다. 외부 CLI를 요구하지 않는 `FedericoCarboni/setup-ffmpeg` v3.1 commit `37062fbf7149fc5578d6c57e08aed62458b375d6`으로 교체하고 재실행 결과를 배포 run으로 확인했다.

### Excel E-A+E-B — 위장 XLS 서식·입력별 테마색 판정 (Codx)

- **legacy 라우팅·강등 판정**: OLE/SpreadsheetML 시그니처를 공용 헬퍼로 통합하되 보존 화면에서만 두 종류를 정밀 변환 대상으로 삼았다. 일반 화면의 SpreadsheetML은 기존 SheetJS 값 경로와 CDATA 전개를 유지한다. 변환 명령의 파일별 실패는 별도 `degradedLegacy` 경고 상태로 두고 서식·수식을 끈 저장값 경로로 재검사해 병합 가능 상태를 유지한다. 이 값 경로까지 실패하면 해당 파일에 XLSX 재저장 안내를 표시하고, 격리·자산·기동 조건 실패는 추가 배치 전체를 중단한다. Chrome 이벤트 주입 스모크에서 세 분기를 각각 단언했다.
- **테마 판정·명시 제외**: 검사 워커가 각 XLSX의 `xl/theme/theme1.xml`만 ZIP에서 읽어 dk1/lt1/dk2/lt2/accent1~6/hlink/folHlink 순서의 파일 id별 팔레트를 만들고 병합 워커 payload에 전달한다. 누락·손상 팔레트는 오류 없이 현행 theme 참조를 유지한다. ExcelJS가 노출한 솔리드 pattern fill의 fg/bg, font, border 단색만 입력 팔레트 RGB로 베이크하고 gradient fill·rich-text run·DXF·차트/도형/그림은 건드리지 않았다. RGB·indexed(64 포함)·auto도 그대로 둔다.
- **색 정확성 실측**: ECMA-376 HSL 휘도식(음수 `L'=L(1+tint)`, 양수 `L'=L(1-tint)+tint`)과 채널별 최근접 정수/[0,255] 클램프를 적용했다. 6개 accent×tint `-0.25/0/0.6` 고정값 테스트와 서로 다른 테마 2파일 브라우저 병합이 통과했다. 실파일 `(회신필요) 금융기관별 시스템 구축 가능여부 및 담당자 확인 요청.xlsx`의 A1 `accent4=FFC000`, `tint=0.7999816888943144`는 출력 `ARGB=FFFFF2CC`(표시 RGB `#FFF2CC`)였고 `styles.xml`에도 `rgb="FFFFF2CC"`로 기록됐다.
- **AC285·XML 정합 실측**: `dummyfortest/AC285_202606.xls`와 `AC285_20260８５８6.xls`를 보존 화면(formula=1, format=1)에서 함께 병합해 2시트/15,800B 출력 생성. 첫 시트는 33×11, 스타일 셀 330·솔리드 채움 200·글꼴색 330, 둘째는 108×12, 스타일 셀 1,236·솔리드 채움 666·글꼴색 1,236으로 확인했다. 이 출력과 테마 실파일 출력의 `xl/styles.xml`은 각각 `xmllint --noout` exit 0이었다.
- **성능 판정**: 동일 production build·Chrome에서 150×80=12,000개 theme fill/font/border 스타일 셀 병합을 3회 측정했다. 변경 전 `1086.17/1080.28/1076.01ms`(중앙값 `1080.28ms`), 변경 후 `929.00/900.94/950.18ms`(중앙값 `929.00ms`)로 14.0% 감소했다. 입력별 WeakMap 스타일 캐시로 같은 원본 스타일의 반복 베이크/복제를 피했으며 성능 악화 없음으로 판정했다.
- **제품 범위 판정**: 신규 경고·상태 문구는 ko/en 동형이며 사용자에게 내부 처리 명칭이나 원시 예외를 노출하지 않는다. URL·SEO 메타·가이드 의미·정적 페이지 수·광고 배치·광고 제외 격리 경로·GitHub Pages 서버리스 구조는 변하지 않아 SEO/AdSense 코드 변경은 불필요하다.
- **완료 검증**: `npm run build` exit 0(2,358 modules, Excel worker 2,479.26kB, 정적 55페이지), `npm run test:unit` exit 0(103/103), `TEST_SCOPE=excel npm run test:browser`, `npm run test:xls-preserve`, `npm run test:xls-first-load`, `npm run test:static`, 두 출력의 `styles.xml` xmllint, 실파일 재현 및 성능 벤치가 모두 exit 0이었다. `TEST_SCOPE=excel` 최초 실행 1회는 Vite가 새 의존성을 처음 최적화한 직후 자동 reload되어 빈 DOM으로 종료됐고, 서버 로그에서 원인을 확인한 뒤 warm 상태의 동일 명령 재실행이 통과했다.

### 비디오 B3 — 목표 비트레이트 브라우저 인코딩 판정 (Codx)

- **범위·라우팅 판정**: MP4 H.264/HEVC 목표 비트레이트 job만 실제 입력 decoder와 사용자가 선택한 output encoder의 `isConfigSupported()`를 통과한 뒤 새 경로로 보낸다. 코덱을 바꾸지 않고 `hardwareAcceleration:"no-preference"`를 고정했다. CRF·VP9·WebM·MKV, 코덱 설정 미지원, concat 입력 중 FPS unknown은 FFmpeg로 유지했다. 오디오는 remove면 영상만 점진 처리, copy면 AAC mux 호환 시 encoded sample을 보존, encode면 decoder+encoder 설정을 모두 지원할 때만 처리하며 어느 하나라도 미지원이면 오디오-only 하이브리드 없이 job 전체를 FFmpeg로 보낸다. 무음 소스는 오디오 인코더가 필요하지 않은 것으로 판정한다.
- **변환·자원 수명 판정**: B2 점진 MP4 parser와 `mp4-muxer@5.2.2`를 재사용해 keyframe부터 decode하되 선택 범위 밖 frame을 버리고, worker의 `OffscreenCanvas`에서 중앙 aspect crop 또는 concat source 비율 letterbox/pillarbox, scale, 0/90/180/270도 rotation, 최종 수평 flip을 적용한다. concat은 모든 입력의 실측 FPS 중 최댓값과 첫 입력 기반 공통 해상도로 CFR 샘플링한다. video decode 합산 큐 8, encode 큐 6, audio decode 합산 큐 12, encode 큐 8에서 backpressure를 걸고 모든 decoded/generated `VideoFrame`·`AudioData`를 닫는다. 정상·실패·취소 모두 codec flush/close를 시도하고 OPFS 부분 파일을 폐기하며, worker 기동 제한 60초는 ready 이후 해제해 장시간 인코딩을 중단하지 않는다.
- **출력·오케스트레이터 판정**: job별 B4 오케스트레이터의 demux/decode/encode/mux/write 진행률과 1.5GiB 안전 폴백 계약을 유지하고 B2 random-access target에 `StreamTarget(chunked:true, chunkSize:1MiB)`·`fastStart:false`로 기록한다. Chrome 계측은 입력 전체 `arrayBuffer()` 0회, slice 4회/최대 725,642B, output write 3회/최대 1,048,576B·누적 단조, decoded 180/encoded 180/closed video frame 360, 최대 decode/encode queue 8/5를 확인했다. 취소 뒤 `result-*` 부분 파일은 0건이었다.
- **속도·정확성 실측**: Chrome 152/Linux, COI=true, 고정 fixture `tests/fixtures/video-vp9-benchmark.mp4`(725,642B, SHA-256 `15115424e7ed5e2bd589c392b87fea726e204f685151b744a5b3baa299b276c5`)에서 H.264 2Mbps+AAC sample copy를 warm-up 1회 후 각각 3회 측정했다. 제품 오케스트레이터 worker 실행부터 결과 완료까지 새 경로 `362.385/351.585/354.490ms`(중앙값 `354.490ms`), FFmpeg.wasm `1648.970/1545.495/1581.195ms`(중앙값 `1581.195ms`)로 새 경로가 `4.460×` 빨랐다. 1,603,615B 출력은 H.264/avc1 640×360 30fps+Aac, 전체 decode exit 0, 브라우저 재생 성공, `mdat` 뒤 `moov`였다.
- **변환·동기·폴백 실측**: 9:16 crop+90도 rotation+flip+audio remove의 2입력 concat은 새 route, 640×360/12초/2,134,342B로 재생됐다. 1.650–4.450초 trim은 video 2.800000초, audio 2.808667초이고 첫 video/audio DTS 정렬 오차 `0ms`(기준 ≤50ms), 전체 decode와 브라우저 재생이 통과했다. 이 Chrome에는 `AudioEncoder` 생성자는 있으나 AAC 설정 지원이 false여서 capability `AUDIO_ENCODER_UNSUPPORTED`, 최종 route `ffmpeg`를 실제 확인했다. 누락 AudioEncoder와 선택 video codec 지원 거부도 단위 테스트에서 전체-job 폴백으로 고정했다. 보고서: `/tmp/worklazy-video-webcodecs-b3-final/video-webcodecs-benchmark.json`.
- **현지화·배포 표면·검증 판정**: 사용자 문구는 처리 방식 대신 행동·결과 중심 ko/en으로 맞췄고 DOM 금칙어에 VideoEncoder/VideoDecoder/AudioEncoder/AudioDecoder/OffscreenCanvas를 추가했다. URL·SEO 메타·정적 페이지·광고 위치·광고 제외 격리·GitHub Pages 서버리스 계약은 변하지 않아 별도 SEO/AdSense 변경은 불필요하다. `npm run build` exit 0(2,358 modules, 스트리밍 worker 249.95kB, 정적 55페이지), `npm run test:unit` exit 0(100/100), `npm run test:new-tools`, `npm run test:utilities`, `npm run test:static`, `git diff --check`, 벤치 명령이 모두 exit 0이었다.

### 비디오 B2 — MP4/MOV 패스스루 스트리밍 판정 (Codx)

- **의존성·지연 로드 판정**: B1b에서 Mediabunny 1.55.5가 B-frame trim 종료 오차 2프레임으로 기각된 판정을 유지하고 `mp4box@2.4.1`(BSD-3-Clause)과 deprecated를 감수한 `mp4-muxer@5.2.2`(MIT)를 exact lock했다. 라이선스 생성기가 두 패키지와 타입 의존성 고지를 자동 반영했다. 두 라이브러리는 별도 `videoStream.worker` chunk 안에서만 정적 import하며 Chrome 요청 계측에서 비디오 페이지 진입·파일 선택까지 요청 0건, 패스스루 preflight/실행 때만 요청됨을 확인했다. 빌드 결과 워커는 `232.46kB` 독립 chunk였다.
- **preflight·route 판정**: `File.slice()`와 `fileStart`를 붙인 점진 append로 실제 video/audio track을 읽고 codec 이름·sample entry·`avcC`/`hvcC`·AAC AudioSpecificConfig·해상도·채널·sample rate·edit/sample table을 비교한다. H.264+AAC MP4, H.264+AAC MOV, HEVC+hvc1 MP4, 동일 파라미터 concat은 stream-copy, VP9 WebM·VP9 MKV와 해상도/구성 불일치 concat은 FFmpeg로 판정했다. 상위 오케스트레이터는 한 요청 안에서도 job별로 두 경로를 혼합 실행한다. 스트리밍 실패 예상 출력이 `1.5GiB` 이하일 때만 FFmpeg 재시도, 초과 시 ko/en 안전 오류로 종결하고 1.5GiB 사전 가드는 FFmpeg job에만 남겼다.
- **샘플·출력 계약 판정**: 선택 시작 이전 최근접 video sync sample부터 decode timestamp가 선택 종료보다 작은 sample까지 복사하고, audio는 스냅된 video 첫 DTS부터 선택한다. concat은 완전 동일한 track profile만 segment offset으로 이어 붙인다. 입력 sample은 최대 `8MiB` window, metadata는 `1MiB` chunk로 읽고, 출력은 `StreamTarget(chunked:true, chunkSize:1MiB)`·`fastStart:false`로 A4 세션의 random-access 임시 파일에 직접 기록한다. `fastStart:"in-memory"`, WebM 스트리밍, WebCodecs 인코딩은 도입하지 않았다.
- **2GiB 초과 실측**: `node scripts/benchmark-video-stream-copy.mjs --output-dir /tmp/worklazy-video-stream-copy-b2-final`로 70.4초/2,112-frame 합성 H.264 fixture를 실제 Chrome 제품 워커 경로에 넣었다. 입력과 ffprobe 확인 출력은 모두 `2,214,602,200B`로 2GiB를 `67,118,552B` 초과했다. 입력 전체 `arrayBuffer()`는 `0`회, slice read `267`회/총 `2,215,650,779B`/최대 `8,388,608B`; 출력은 `2,114`회 write/최대 `1,048,576B`, 누적 write byte는 끝까지 단조 증가했다. 출력 video는 H.264/avc1, `70.400000s`, 2,112 packets의 DTS가 단조 증가했고 취소 뒤 `result-*` 부분 파일은 `0`건이었다. 보고서는 `/tmp/worklazy-video-stream-copy-b2-final/video-stream-copy-benchmark.json`이다.
- **키프레임·A/V 수치 판정**: 1.650–4.450초 B-frame trim에서 원본의 선택 이전 최근접 keyframe PTS는 `1.000000s`였고 신규 스냅도 `1.000000s`로 오차 `0ms`였다. 원본·현행 FFmpeg copy·신규 출력 첫 video packet SHA-256은 모두 `80c25aaf78cda8b121abd10e1a1692074587ca096892671042d3ac2edee30a09`로 동일했다. FFmpeg와 신규 video duration은 모두 `3.533333s`로 오차 `0프레임`, 신규 첫 video/audio DTS는 모두 `0.000000s`로 정렬 오차 `0ms`; 신규 271개 packet의 stream별 DTS도 단조 증가했다. 동일 profile 2구간 concat 출력도 H.264/AAC 354 packets의 DTS 단조성을 통과했다.
- **현지화·SEO·배포 표면 판정**: 점진 저장·원본 화질 복사·대용량 안전 오류를 ko/en 동일 키로 추가하고 UI/DOM에서 OPFS·SyncAccessHandle·zip.js·mp4box·mp4-muxer·WebCodecs·remux·worker 비노출을 검사했다. URL·검색 의미·정적 페이지·광고 위치·광고 제외 격리 경로·GitHub Pages 서버리스 계약은 변하지 않아 별도 SEO/AdSense 변경은 불필요로 판정했다.
- **완료 검증**: `npm run build` exit 0(2,358 modules, 정적 55페이지), `npm run test:unit` exit 0(97/97), `npm run test:new-tools` exit 0(HWP·이미지·오디오·비디오 전체와 스트리밍 워커 지연 로드), `npm run test:utilities` exit 0, `npm run test:static` exit 0. `git diff --check`와 2GiB 실측 명령도 exit 0이었다.

### 비디오 B4 — route·오케스트레이터·진행률 기반 판정 (Codx)

- **route 결정표 판정**: 순수 함수 입력을 컨테이너(MP4/MOV/MKV/WebM)·코덱(H.264/HEVC/VP9)·bitrate(copy/CRF/target)·audio(copy/remove/encode)·OPFS 가용성·quota(enough/insufficient/unknown)로 고정했다. MP4/MOV+H.264/HEVC의 copy는 stream-copy, target bitrate는 WebCodecs 후보로 분류하되, B2/B3 미구현 상태에서는 648개 범주 조합 전부를 사유 코드와 함께 FFmpeg로 확정했다. MKV/WebM·VP9·CRF·copy+audio encode는 적합성 단계에서 FFmpeg로 남고, OPFS 미지원·quota 미확인/부족은 별도 사유로 구분했다.
- **용량·폴백 판정**: job 선택 구간의 예상 출력 크기를 route 계획에 저장하고, 스트리밍 실패 시 `1.5GiB` 이하만 FFmpeg 폴백, 초과·미확정은 reject로 고정했다. 페이지는 job 생성→OPFS/quota route preflight→`decision.route === "ffmpeg"` job의 1.5GiB 가드 순서로 바꿨다. 현재 route가 모두 FFmpeg이므로 기존 패스스루 제한과 사용자 동작은 동일하다.
- **오케스트레이터·진행률 판정**: `videoProcessingClient.ts`가 job route 계획과 실행을 소유하고 `videoWorkerClient.ts`는 FFmpeg 전용 어댑터로 유지했다. 단계 가중치는 demux/decode/encode/mux/write=`10/25/40/15/10%`로 두고, job별 영상 처리는 선택 duration, 결과 쓰기는 예상 bytes로 전체 진행률을 집계한다. 하위 콜백의 하락 값은 단조 가드가 이전 값으로 유지하고, resolve/reject 종결 후는 모든 이벤트를 차단한다. `useOperationProgress` 역시 단조 정규화와 종결 상태 지연 update 차단을 적용했다.
- **공통화·동작 동등성 판정**: `video.worker.ts` private이던 출력 이름·MIME·warning·오류 정규화·output count를 `videoProcessingShared.ts`로 추출했다. 이름/MIME 전 출력군, warning 조합·다중 route 개수 합산, quota/OOM/codec/일반 오류를 단위 테스트했다. 실제 브라우저 전체 스모크에서 개별·그룹 concat 비디오 결과, A3 세그먼트 정리, A4 File/ZIP64·오디오 handoff가 전부 통과해 사용자 가시 변화 0을 확인했다.
- **현지화·SEO·AdSense·범위 판정**: 새 사용자 문구를 추가하지 않아 ko/en 번역 변경은 불필요했다. 두 locale의 비디오 문구와 브라우저 DOM에서 OPFS·SyncAccessHandle·zip.js·WebCodecs·remux·worker 비노출을 검사했다. URL·SEO 메타·정적 페이지·광고 배치·격리 경로·서버 전제는 변화가 없고 정적 검증이 통과했다. B2/B3 스트리밍 워커·실제 스트리밍 분기는 추가하지 않았다.
- **완료 검증**: `npm run build` exit 0(2,355 modules, video worker 26.87kB, 정적 55페이지), `npm run test:unit` exit 0(94/94), `npm run test:new-tools` exit 0(HWP·이미지·오디오·비디오 전체), `npm run test:utilities` exit 0(ko/en·비디오 호환 포함), `npm run test:static` exit 0. `test:new-tools` 최초 1회는 preview 미기동으로 `ERR_CONNECTION_REFUSED`로 검증 시작 전 종료되었고, 빌드 산출물 preview 기동 후 동일 명령 재실행이 통과했다. `git diff --check`도 exit 0.

### 이미지 P3 — 레이어·다중 선택·컨텍스트 메뉴 판정 (Codx)

- **고정 블록·공통 순서 판정**: `[base,effects…,additional…,overlay…]`를 만드는 공통 helper를 신설하고 미니바 front/back, 레이어 패널 Sortable 재정렬, 컨텍스트 메뉴가 모두 같은 이동 함수만 사용하게 했다. `back`은 effect 개수와 무관하게 고정 블록 바로 위, `front`는 추가 레이어 최상단으로 제한하며 base·effect·crop overlay의 이동 요청은 거부한다. effect는 목록에 노출하지 않고 base 표시 상태를 강제 상속한다. 단위 테스트에서 뒤섞인 6객체를 고정 순서로 복원하고 세 이동 경로의 base/effect 거부를 확인했다.
- **레이어 상태·히스토리 판정**: 목록은 Fabric z순을 역순으로 표시하고 객체별 WeakMap ID로 선택을 연결한다. `moveObjectTo`와 `visible`이 이벤트를 내지 않는 전제를 따라 재정렬·표시 변경마다 즉시 snapshot과 패널 동기화를 수행했다. 활성 레이어 숨김은 단일 선택을 해제하거나 남은 ActiveSelection을 재구성하며, base 숨김은 모든 effect를 함께 숨긴다. Chrome에서 추가 레이어와 base 표시 변경 각각의 undo→redo→undo, 패널 재정렬 undo, 정렬 undo/redo, 다중 복제 undo/redo 뒤 패널 상태와 고정 순서를 직접 읽어 일치함을 확인했다. 숨긴 텍스트 레이어의 PNG data URL이 표시 상태와 달라 export 제외도 확정했다.
- **선택·정렬·복제 판정**: 데스크톱에서 Fabric `selectionKey=shiftKey`와 러버밴드를 켜고, selection hook이 base를 제거한 뒤 잔여 0/1/복수에 맞춰 해제·단일·ActiveSelection으로 강등/재구성한다. 실제 base 우선 Shift 선택은 base+텍스트에서 텍스트 단일로 강등되고 두 번째 도형 추가 시 base 없는 2객체 선택이 됐다. 러버밴드는 unlocked base를 후보로 포함시킨 상태에서도 추가 레이어 3개만 남겼다. 회전 `-8°/23°/-17°`, 비균일 scale 3객체를 scene `getBoundingRect()` 기준으로 좌·가로중앙·우·상·세로중앙·하 6종 × zoom 100/200%에서 정렬했고 12조합 모두 bbox 좌표 편차 0.75px 이하를 통과했다. 다중 복제는 구성 객체를 z순으로 각각 clone하고 24px scene translation을 합성해 활성 clone의 종류·상대 z순을 원본과 같게 유지했다.
- **우클릭·보호 경로 판정**: document 전역 contextmenu 공급은 기각하고 Fabric 7.4의 `instance.on("contextmenu")`만 사용했다. 일반 객체 메뉴는 복제·삭제·앞/뒤, IText는 편집 진입을 추가하며 ActiveSelection은 복제·삭제·6정렬만 제공한다. base·effect·빈 캔버스는 메뉴를 만들지 않고 Fabric upper canvas의 기본 메뉴만 억제했으며 캔버스 밖 우클릭은 `defaultPrevented=false`를 유지했다. Escape·외부 pointerdown·resize·scroll 네 닫힘 조건과 ko/en 문구를 실제 우클릭으로 확인했다. 객체 붙여넣기 공급원이 없고 복제로 요구를 충족하므로 클립보드 상태·붙여넣기 항목은 도입하지 않았다.
- **P4 입력 교차·모바일 판정**: 기존 touch-safe 비주버튼 guard와 crop 박스 target 조기 반환을 유지했다. zoom 200%에서 Space+드래그는 VPT만 바꾸고 ActiveSelection을 만들지 않았으며 crop 모드 드래그는 crop overlay가 소유하고 러버밴드를 만들지 않았다. 기존 P4 crop/effect 동작과 crop overlay 8조합(변형 유무×zoom 100/200%×지우개 유무)은 geometry/saved error 모두 0px로 재통과했다. 390×844에서는 `selection=false`, `selectionKey=null`, layers 하단 시트·44px 이상 행 버튼·패널 유지·삭제 동기화를 확인해 모바일 다중 선택 제외를 고정했다.
- **현지화·SEO·배포 표면 판정**: layers/유형/표시/삭제/정렬/우클릭/다중 선택 문구를 ko/en 동일 키로 추가했고 내부 Fabric 명칭·원시 예외는 화면에 노출하지 않았다. 기존 도구 메타와 SEO featureList가 이미 통합 편집 및 “텍스트·도형·스티커 레이어”를 명시하므로 URL·검색 의미·가이드 정합은 유지되며 별도 SEO 문구 변경은 불필요로 판정했다. 정적 페이지 수, GitHub Pages 단일 페이지 전제, 광고 위치와 광고 제외 격리 경로는 바뀌지 않았다.
- **완료 검증**: `npm run build` exit 0(2,351 modules, Image Studio 416.67KB/129.16KB gzip, 정적 55페이지), `npm run test:unit` exit 0(82/82), `TEST_ONLY_IMAGE=1 npm run test:new-tools` exit 0(P3 전체+P4 전체+DPR/effect), `npm run test:utilities` exit 0, `npm run test:static` exit 0. `git diff --check`와 `node --check tests/new-tools-smoke.mjs`도 exit 0.

### 비디오 A4 — 결과 저장 추상화·스트리밍 ZIP 판정 (Codx)

- **결과 계약·완료 순서**: `VideoWorkerOutput`을 buffer 전용에서 buffer/File/브라우저 임시 파일 참조 공통 계약으로 확장했다. 처리 워커는 완성 바이트를 워커 전용 동기 파일 핸들(미지원 시 비동기 writable)에 먼저 기록한 뒤 참조만 전달한다. 클라이언트의 출력 콜백은 직렬 Promise 큐로 대기해 마지막 `result` 이벤트가 먼저 와도 모든 File 해석·UI 저장이 끝나기 전 작업 성공을 resolve하지 않는다.
- **수명주기·폴백 판정**: 실행마다 난수 세션·소유 ID와 24시간 lease를 만들고, 시작 시 공유 루트 전체가 아니라 만료된 `session-*`만 청소한다. 소유 메타데이터가 다른 세션은 release하지 않으며 성공 파일은 유지하고 실패·취소 시 부분 파일만 삭제한다. 저장 방식 미지원 또는 일반 쓰기 실패는 기존 메모리 결과로 자동 전환한다. 용량 부족은 결과 예상 크기와 16MiB/5% 여유를 검사해 128MiB 이하만 메모리 폴백하고 그보다 크면 내부 명칭·원시 예외 없이 안전 오류를 표시한다. 단위 테스트에서 성공·미지원·소유권 불일치 폴백·용량 부족 소/대 분기·활성 쓰기 취소·TTL 잔재 청소·소유자 전용 해제를 통과했다.
- **메인 힙 실측**: Chrome 152/Linux/16 logical CPU·16.69GB RAM에서 `node scripts/benchmark-video-result-storage.mjs --runs 3 --outputs 4 --bytes-per-output 67108864 --output-dir /tmp/worklazy-video-result-storage-a4`를 실행했다. 64MiB 결과 4개(총 `268,435,456B`)의 File wrapper와 object URL을 모두 유지하고 강제 GC 뒤 측정한 세 실행의 메인 JS 힙 증분은 모두 `69,604B`, worker→main 전송 ArrayBuffer는 `0`이었다. 출력 바이트/힙 바이트 비율은 `3,856.61`, 결과 크기 대비 힙 상주 비율은 `0.02593%`였다.
- **ZIP 구현·스트리밍 실측**: 비디오 경로의 JSZip 참조를 0건으로 만들고 `@zip.js/zip.js@2.9.0`을 exact lock했다. `BlobReader` 입력을 `for` 루프의 순차 `await ZipWriter.add`로만 추가하고 입력·출력 모두 `bufferedWrite:false`, 각 add와 close에 `zip64:true`를 강제했다. 프로덕션 helper의 `8,388,731B` 계측 입력은 전체 `arrayBuffer()` `0`회, stream `1`회, `129`개 입력 구간·최대 `65,536B`; ZIP 출력은 `8,389,205B`를 `136`회 write·최대 `65,536B`로 기록했다. ZIP64 EOCD·locator·classic EOCD를 모두 확인하고 런타임 fixture를 시스템 `unzip -t/-p`로 왕복해 payload SHA-256 동일성을 통과했다.
- **브라우저 회귀·번들 판정**: 실제 Chrome 비디오 스모크에서 그룹 결과 2개가 세션 임시 파일로 남고 ZIP도 같은 세션의 ZIP64 파일로 생성됨을 확인했다. ZIP 워커 요청은 화면·결과 생성 전 `0`건, ZIP 버튼 뒤 정확히 `1`건으로 지연 로드를 유지했다. 사용자 화면에는 내부 저장/라이브러리 명칭이나 원시 번역 토큰이 없고, 새 ko/en 임시 파일 안내와 오디오 스튜디오 BroadcastChannel handoff도 통과했다. URL·검색 의미·정적 SEO 페이지·광고 위치·광고 제외 격리 경로·서버 전제는 바뀌지 않아 추가 SEO/AdSense 코드는 불필요로 판정했다.
- **의존성·범위 판정**: 라이선스 생성기가 zip.js 2.9.0 BSD-3-Clause 고지를 자동 반영했다. JSZip은 다른 도구가 사용하므로 전역 제거하지 않고 비디오 경로에서만 교체했다. B1b에서 기각된 Mediabunny는 manifest·lock·소스에 추가하지 않았고 B4·B2·B3은 진행하지 않았다.
- **완료 검증**: `npm run build` → exit 0(2,348 modules, video worker 26.76kB, ZIP worker 144.66kB, 정적 55페이지), `npm run test:unit` → 79/79, `npm run test:new-tools` → HWP·이미지·오디오·비디오 전체 통과, `npm run test:utilities` → ko/en·비디오 호환 포함 통과, `npm run test:static` → 현지화 페이지·self-hosted 런타임·ads/robots/sitemap 통과. `git diff --check`와 비디오 경로 JSZip 0건 검사도 통과했다.

## 2026-09-02

### 비디오 A3 — concat 세그먼트 오프로드 실측·판정 (Codx)

- **구현 판정**: 각 세그먼트 생성 직후 `readFile`→`Blob`→`deleteFile` 순서로 MEMFS 파일을 즉시 해제하고, 전체 Blob을 `processConcatJob` 지역 mount 수명주기에서 WORKERFS로 재마운트했다. concat list는 `-safe 0`과 `/worklazy-concat-segments-<job>/...` 절대경로를 쓴다. mount 디렉터리는 operation 성공·실패 모두 `finally` unmount/delete하며 전역 `mountedDirectories`에 소유권을 넘기지 않는다.
- **1GB급 실측 절차**: Chrome 152/Linux/16 logical CPU·16GiB·COI=true에서 배포 MT FFmpeg.wasm 0.12.10을 사용했다. `node scripts/benchmark-video-concat-memory.mjs --output-dir /tmp/worklazy-video-concat-memory-a3 --runs 3 --comparison-inputs 8 --boundary-high 40 --case-timeout-ms 720000` → 14초 640×360 H.264 고엔트로피 fixture `149,833,058B`, SHA-256 `7fd34d3d…fc02a`를 8개 논리 입력(`1,198,664,464B`)으로 마운트하고 각 4.5초를 패스스루 세그먼트로 만들었다. warm-up 1회 후 before/after 각 3회, Chrome 루트+모든 하위 프로세스 RSS를 100ms로 표본화했다.

| 지표(3회 중앙값) | before: 세그먼트 MEMFS 누적 | after: Blob+WORKERFS 오프로드 | 변화 |
|---|---:|---:|---:|
| MEMFS 파일 합계 피크 | 750,799,433B | 375,397,665B | -50.00% |
| Chrome 프로세스 합산 RSS 피크 | 4,271,190,016B | 3,424,997,376B | -19.81% |
| 경과 시간 | 8,780ms | 10,102ms | +15.06% |
| 출력 크기 | 375,397,362B | 375,397,362B | 동일 |

- **바이트 동일성**: before/after 6회 출력 SHA-256은 모두 `0f5f880412bbe00e1d461d1ec8aa95f77831c01a721aa6070758f8e648d9eefb`, 전체 decode exit 0. 현행 1.5GiB 패스스루 출력 가드 내 최대인 33개 입력(`4,944,490,914B` 논리 합계, 선택분 예상 `1,589,300,651B`)도 양쪽 모두 성공해 **성공 상한 증가는 관측되지 않았고 34개부터 기존 가드가 먼저 차단**한다. 33개 출력은 양쪽 `1,548,511,476B`, SHA-256 `614f7778…10a` 동일이며 MEMFS 피크는 `3,097,045,045B`→`1,548,512,752B`.
- **효과 범위**: 결론은 **“고정 wasm/MEMFS 압박 해제”**로 한정한다. `readFile`→Blob→delete 순간의 MEMFS+JS/Blob 일시 중복은 남고 총 메모리 감소를 보장하지 않는다. 실제로 1GB급 3회 중앙 RSS는 낮았지만 33개 단일 상한 실행에서는 after RSS `7,134,687,232B`가 before `6,894,424,064B`보다 높았다. 따라서 wasm buffer 1GiB는 측정 지표에서 제외하고 MEMFS 파일 합계와 브라우저 프로세스 RSS를 분리해 기록했다.
- **정리 스모크**: 실 FFmpeg WORKERFS mount 후 조인 실패형 `Error`와 취소형 `AbortError`를 각각 강제했고 루트 `listDir` 잔재가 모두 0건이었다. 단위 테스트도 `read`→`delete` 순서와 성공·실패·취소 정리 4건을 통과했다. 외부 취소는 현행 클라이언트가 전용 Worker를 종료하므로 해당 인스턴스의 MEMFS/WORKERFS 자체가 폐기된다.
- **완료 검증**: `npm run build` → exit 0(2,346 modules, video worker 22.46kB, 정적 55페이지), `npm run test:unit` → 69/69, `TEST_ONLY_VIDEO=1 npm run test:new-tools` → grouped concat 포함 비디오 스모크 통과, `npm run test:new-tools` → HWP·이미지·오디오·비디오 전체 통과, `npm run test:utilities` → ko/en·비디오 격리 포함 통과, `npm run test:static` → 현지화 페이지·self-hosted 런타임·ads/robots/sitemap 통과.
- **동반 영향**: 사용자 문구·URL·SEO·정적 페이지·광고 배치·광고 제외 격리 경로·서버 전제는 바뀌지 않아 ko/en·SEO·AdSense에 추가 코드 변경은 불필요로 판정했다.

### 이미지 P4 착수 3묶음 — 크기·내보내기·접이식 패널 판정 (Codx)

- **리샘플 판정**: 작업 캔버스 상한을 4096px로 두고 base·회전 도형·그리기 등 일반 객체의 기존 `calcTransformMatrix()` 앞에 전역 scale 행렬을 합성해 `util.applyTransformToObject`로 적용했다. region-effect는 직접 변환에서 제외하고 base의 원본 로컬 anchor로 다시 동기화했다. 1800×1200 fixture를 둔 900×600 작업공간에서 회전 도형·base를 1200×720 비균일 리샘플했을 때 합성 행렬과 일치했고 효과 행렬도 anchor 산식과 일치했다. 비율 잠금은 가로 1200 입력을 1200×800으로 계산했고, 잠금 해제 뒤 1200×720을 독립 적용했으며 5000 입력은 4096×2731로 제한됐다. 치수 변경 뒤 view는 100%로 초기화됐다.
- **캔버스·히스토리 판정**: 1200×720→400×300 변경은 모든 객체에 중앙 이동 `dx=-400`, `dy=-210`을 적용했고 캔버스 밖으로 잘린 객체를 포함해 객체 수를 보존했다. 치수 undo/redo 모두 1200×720↔400×300과 100% view reset을 복원했다. 모든 메모리 스냅샷에 `outputMultiplier`가 저장됨을 확인하고 이전 스냅샷 값을 1로 강제한 검증에서 undo 결과 안내가 900×600, redo가 원본 화질 배율 결과로 되돌아와 restore 배선을 확정했다. 파일 로드·빈 캔버스·restore 외 크기 작업에서는 multiplier를 바꾸지 않았다.
- **내보내기 판정**: 원본 화질은 기존 multiplier 렌더를 유지하되 4096px 작업 폭에서 결과 폭이 8192px을 넘지 않도록 유효 multiplier를 자동 축소하고 실제 8192px 결과 안내를 표시했다. 지정 크기는 VPT identity의 1× 결과를 목적지 캔버스에 재렌더한다. 잠금 ON 600×400과 잠금 OFF 600×600 결과에서 녹색 대조군 가로폭은 동일하고 세로만 1.4배 이상 늘어 균일/스트레치 분기를 확인했으며, 200% view에서도 data URL이 byte-identical이었다. 9000 입력은 8192로 제한됐다.
- **접이식 판정**: 우측 패널 토글은 `sessionStorage`로 기억되고 821·1020·1440px에서 패널이 사라진 만큼 stage 폭과 반응형 canvas fit이 증가했으며 ResizeObserver가 선택 미니바를 재계산했다. 1020px 접힘 뒤 reload에서도 유지됐고 820·390px에서는 저장값을 무시해 패널을 상대 위치 하단 시트로 강제 표시하고 토글을 비활성화했다. 821px로 돌아오면 저장된 접힘이 다시 적용됐다. sticky canvas는 데스크톱 전 구간에서 유지됐고 ko/en 라벨·aria를 확인했다.
- **완료 검증·동반 영향**: `npm run build`(2,346 modules, Image Studio lazy chunk 402.23KB/125.51KB gzip, 정적 55페이지) · `npm run test:unit`(65/65) · `TEST_ONLY_IMAGE=1 npm run test:new-tools`(P4 1·2묶음과 DPR/effect 회귀 포함) · `npm run test:utilities` · `npm run test:static` 전부 통과했다. 크기·출력 기능은 ko/en UI와 이미지 가이드·도구 메타·SEO featureList를 함께 갱신했다. URL·사이트맵 구조·광고 위치·광고 제외 격리 경로·서버 전제는 바뀌지 않아 AdSense/GitHub Pages 계약에 추가 변경이 없다.

### 이미지 P4 착수 2묶음 — 편집 가능한 자르기 박스·비율 경계 판정 (Codx)

- **박스 편집 판정**: crop overlay만 selectable/evented인 전용 객체로 두고 코너4+변4 컨트롤을 구성했다. 회전·skew 컨트롤은 없고 flip lock을 고정했으며, 박스 위 좌클릭은 Fabric 이동/scale에 위임하고 밖 좌클릭만 한 개의 새 박스로 교체한다. 이동·scale 중 캔버스 경계를 넘지 않았고 scale 동안 패널/플로팅 px 라벨이 변한 뒤 `object:modified`가 정확히 1회 발생해 `scaleX=scaleY=1`·정수 width/height로 정규화됐다. 일반 선택·Delete·미니바·히스토리에는 잡히지 않았다.
- **비율 판정**: `cropTo`의 900px 캔버스 재구성을 폐기하고 1:1·4:3·3:4·16:9·9:16+자유를 박스 상태로 분리했다. 기존 박스는 `w'=min(w,h×r)` 축소 우선 뒤 중심 유지·경계 이동·최소 확대 순으로 바뀌고 모든 preset이 ±1px 비율 오차를 통과했다. preset에서는 코너 4개만, 자유에서는 8개가 노출됐다. 경계의 9:16 최소 결과는 `10×18px`, 10×10 캔버스에서는 9:16이 ko 사유 tooltip과 함께 비활성화됐다. 무박스 preset 드래그와 적용 뒤 비율 유지, 자유 상태 Shift 드래그/핸들 1:1, Alt 드래그/핸들 중심 유지도 통과했다. Fabric 전역 `uniformScaling=true`는 바꾸지 않았다.
- **입력·소유권·출력 판정**: 박스 안/밖 좌클릭과 안/밖 우클릭 네 분기, 단일 touch 드래그, 200% zoom+Space pan 후 핸들 적중, 두 손가락 pinch 뒤 박스 기하 동일을 실동작으로 검증했다. crop↔effect 전환 시 상대 overlay 수는 항상 0이었고, crop 박스를 직접 제거해 내보낸 결과는 박스 취소 뒤 결과와 byte-identical data URL이었다. 핸들 조정 뒤 적용 캔버스 치수는 선택 정수 치수와 정확히 같고 합성 fixture의 녹색 대조군 픽셀도 보존됐다.
- **회귀·완료 검증**: `npm run build`(TypeScript+Vite, 2,346 modules, 55 정적 페이지) · `npm run test:unit`(65/65) · `TEST_ONLY_IMAGE=1 npm run test:new-tools` · `npm run test:utilities` · `npm run test:static` 전부 통과. P4-0 합성 8조합도 표시/저장·적용 오차 `0px`, 저장 치수 오차 `0px`, 펜·지우개·녹색 대조군 보존을 유지했다. 최초 이미지 스모크 사전 시도 1회는 preview 미기동으로 `ERR_CONNECTION_REFUSED`가 나 검증 시작 전 중단됐고, 로컬 preview 기동 후 동일 명령을 재실행해 통과했다.
- **동반 영향 검토**: crop 조작 안내와 극단 비율 사유는 ko/en을 함께 갱신했다. 기능 URL·핵심 검색 의미·SEO 메타데이터·가이드 정적 페이지·광고 위치·광고 제외 격리 경로는 바뀌지 않아 추가 변경 불필요로 판정했다. P4-3 크기 도구와 P4-4 접이식 패널은 건드리지 않았다.

### 이미지 P4 착수 1묶음 — overlay 좌표·상태 의미·선택 UI 판정 (Codx)

- **P4-0 판정**: crop/effect `Rect`의 `originX/Y`를 `left/top`으로 고정하고 비선택·비이벤트·내보내기 제외 속성을 유지했다. effect anchor는 계속 원본 이미지 로컬 좌표이고 히스토리는 세션 메모리뿐이므로 마이그레이션은 불필요하다. 합성 fixture(600×400 회색 바탕+녹색 대조군, `dummyfortest` 미사용)에서 없음/이동+90° 회전+flip × crop zoom 100/200% × 지우개 유무 8조합 모두 stroke 제외 overlay 표시-저장·적용 최대 오차 `0px`, 박스 안 펜 보존, 대조군 보존을 통과했다.

| base 변형 | zoom | 지우개 | 펜 픽셀 적용 전→후 | 지우개 투명 픽셀 | 녹색 대조군 | 기하/저장 오차 |
|---|---:|---:|---:|---:|---:|---:|
| 없음 | 100% | 없음 | 5,563→5,560 | 0→0 | 2,400→2,360 | 0/0px |
| 없음 | 100% | 있음 | 3,987→3,981 | 1,962→1,944 | 2,400→2,360 | 0/0px |
| 없음 | 200% | 없음 | 5,554→5,560 | 0→0 | 2,400→2,399 | 0/0px |
| 없음 | 200% | 있음 | 4,030→4,033 | 1,962→1,973 | 2,400→2,399 | 0/0px |
| 이동+회전+flip | 100% | 없음 | 5,545→5,549 | 0→0 | 2,400→2,399 | 0/0px |
| 이동+회전+flip | 100% | 있음 | 3,984→3,980 | 1,962→1,944 | 2,400→2,399 | 0/0px |
| 이동+회전+flip | 200% | 없음 | 5,553→5,559 | 0→0 | 2,400→2,400 | 0/0px |
| 이동+회전+flip | 200% | 있음 | 4,026→4,024 | 1,962→1,973 | 2,400→2,400 | 0/0px |

- **P4-1 판정**: crop/effect overlay ref·selection·clear와 Escape 분기를 분리했다. 자르기는 버튼·Enter 적용 때만 interaction mode와 active panel이 함께 select로 바뀌며 취소·Escape는 박스만 지우고 crop을 유지했다. effect 취소·Escape도 박스만 지우고 effect 모드/패널을 유지했다. `cropTo`와 P4-2/3/4 표면은 변경하지 않았다.
- **P4-5 판정**: 자르기 적용 버튼을 항상 렌더하고 영역 전에는 disabled + 눈에 보이는 ko/en 사유 + `aria-describedby`를 연결했으며, 활성 상태는 기존 `accent-sky` gradient를 재사용했다. crop/effect 모두 드래그 중 패널 W×H와 박스 우하단 라벨이 갱신됐고 두 overlay 기하 오차는 각각 `0px`였다.
- **동반 영향 검토**: 사용자 문구는 ko/en 동시 반영했다. 기능 URL·의미·SEO 메타데이터·가이드·정적 페이지·광고 위치·광고 제외 격리 경로는 바뀌지 않아 추가 변경 불필요로 판정했다.

### Word 비교 후속(서식 위양성·작성자 통일) — 8왕복 계획·재현 판정 (Claude·Codx·Gemini)

- 위양성 기전: 서명이 런 경계를 `||`로 포함해 proofErr/rsid 분절이 서식 변경으로 오인 — Gemini 전수 분석(127건)·Claude 독립 재계산(124건)·Codex 기본 UI 실측(133건, 방법론 차 정정). 시각 서식 실차이는 highlight 4건뿐(당시 웹 미검출).
- 기각·정정: tracked_docx에 동일 병합 적용안은 문자 토큰 실측으로 기각(Claude 판정 오류 정정) / (작성자,본문) 집합 메모 매칭은 중복 반례로 기각 → durableId→paraId→one-to-one 소비 채택(실 DOCX 식별자 실측) / "생성기 미산출·운영 404" 가설 기각.
- 구현 재현: dummyfortest 계약서에서 웹 133→4, OFF 추적 DOCX cyan highlight 4건, ON 신규 리비전 10건 통일·기존 메모 6건 보존·SML 신규 2건 재작성, identity 3파트 바이트 동일, LibreOffice 변환 성공. 데스크톱판(../word-compare)의 AcceptAll+RevisedAuthor 선례와 의미론 일치.

### 비디오 A2 — 스레드 캡 상향 기각 (Codx)

MT 스레드 상향안 `min(8,max(4,hc-1))`을 실측 후 **기각**. Chrome 152/Linux/16 logical CPU·COI=true에서 배포 MT 코어 0.12.10의 1GiB 고정 힙 선언과 SHA-256(core `270a2e6f…0de`, wasm `be2c9760…c41a`, pthread worker `f77898d6…ca3`)을 검증하고, 기존 fixture `15115424…76c5`에서 만든 24-frame 1080p `0e12db4a…b268`(1,159,714B)·4K `bd5d66f8…e677`(3,303,654B)를 `node --experimental-strip-types scripts/benchmark-video-threads.mjs --output-dir /tmp/worklazy-video-thread-benchmark-a2 --runs 3 --browser-timeout-ms 180000 --vp9-timeout-ms 45000 --resume`로 warm-up 후 3회 측정.

- 브라우저 4→8스레드: H.264 1080p `1,560.385/1,569.560/1,640.370ms`(중앙값 1,569.560ms·143,819B·decode 0)에서 8스레드 warm-up 180초 timeout으로 퇴행. H.264 4K 양쪽 OOM, HEVC 1080p·4K 양쪽 warm-up timeout, VP9 1080p·4K 양쪽 OOM.
- host 격리 대체 측정 4→8스레드 중앙값(ms/bytes/peak RSS KiB): H.264 1080p `437.593/143886/402648 → 340.648/141747/484764`, 4K `1751.354/394724/1244604 → 1477.708/397404/1449180`; HEVC 1080p `725.026/159821/541552 → 657.139/159821/615800`, 4K `1666.618/312940/1732880 → 1535.939/312940/2018652`; VP9 1080p `1525.762/306592/462648 → 1289.052/306592/487816`, 4K `4154.374/568351/1437528 → 3232.429/568351/1462640`. 전부 decode 0·host OOM 0.
- **판정**: host 시간 7.84–22.19% 감소에도 RSS 전 조합 1.75–20.39% 증가, 4K는 4스레드부터 이미 1GiB 초과, 실제 브라우저 성공 경로가 후보에서 정지 → 속도 이득·힙 안전 게이트 미충족으로 기각. `multiThreaded` 배선은 무해·유용하여 유지.

### 이미지 Phase 2 — 스티커 후보 스파이크 (Codx)

Twemoji v17.0.3(4,009개, 10,121,593B, 개별 gzip 합 4,475,637B) vs Noto Emoji v2.051(3,731개, 32,128,362B, 11,225,395B)을 경로별 라이선스 원문까지 비교해 **Twemoji 채택, Noto는 원시 3.17배·gzip 2.51배 규모로 기각**. 상한 120종 중 7카테고리 112종을 코드포인트·바이트·SHA-256 manifest로 고정(실제 합계 142,436B/개별 gzip 71,573B). Image Studio lazy chunk 356.23→384.87KB(gzip 109.76→120.86KB), SVG 본문 미포함.

### XLS 보존 첫 진입 실패 — 기전 확정·가설 기각 (Codx)

전역 격리 헤더 없는 GitHub Pages 동형 서버 재현으로 기전 확정: 표준 Excel 화면의 전역 SW 제어 뒤 보존 화면 첫 이동 시 문서는 `COEP: require-corp`로 격리되지만 `/assets/excel.worker-*.js` 응답은 무헤더 → Chrome `ERR_BLOCKED_BY_RESPONSE` 차단 → 합성 4파일 전부 "파일 처리를 시작하지 못했습니다". ko·en 보존 정적 페이지는 `332d8f7`부터 생성·검증되고 착수 시 운영도 200이어서 **"생성기 상수만 존재·운영 404" 가설(Claude C1 일부)은 기각**. `credentialless` 비디오 문서에서 `require-corp` 워커 스크립트 호환은 실기동으로 확인.

### 이미지 I2 줌·팬 — 기각안 (Codx)

보기 변환(VPT)을 반응형 fit이나 편집 기록에 섞는 안, DPR을 재유입하는 `getTotalObjectScaling` 계산은 각각 의미 충돌·강도 회귀로 **기각**. 강도 계약은 `getObjectScaling()+getZoom()` 유지 — DPR 1·2 × 100·200%에서 같은 16px·8px 소스 블록 실측.

### 엑셀 위장 XLS — F0 판정·기각 (Codx)

실파일 4개 재현에서 고정 ZetaOffice는 두 SpreadsheetML을 모두 열고 변환·4파일 병합까지 성공 → **"ZetaOffice SpreadsheetML 미지원"·"전각 파일명 단독 원인" 가설(Claude C1·C3) 기각**. SheetJS 0.20.3은 `AC285_202606.xls` 성공·`AC285_20260８５８6.xls` 실패(XLML CDATA)로 파일별 지원 편차 판정. OLE 헤더만 붙인 빈 fixture는 ZetaOffice가 정상 변환해 실패 fixture로 기각(→ 이벤트 주입식 결정론 테스트로 대체). 모든 `.xls`에 문자열 파싱을 적용하는 안은 기존 OLE 경로 회귀 위험으로 기각.

### 이미지 I1+I3 — 기각안 (Codx)

광고 공간을 침범하는 뷰포트 전체 고정 레이아웃은 AdSense 정책 충돌로 기각(Gemini 검증)·sticky 캔버스 채택. `src/app/seo.ts`·ko/en `tools.json`·이미지 가이드는 기능 의미가 정확해 변경 불필요 판단.

### 비디오 A1·B1b — 실측·기각 (Codx)

- A1 VP9 `-deadline good -cpu-used 4`: host libvpx 3회 중앙값 7,882.015ms→2,462.353ms(68.76% 감소·3.201×), 출력 672,326→720,187B(+7.12%), SSIM 0.971567→0.971193·PSNR 28.713933→28.708202dB, 전체 디코드 통과. 브라우저 FFmpeg.wasm VP9은 작은 fixture도 메모리 오류 — 별도 런타임 결함으로 기록.
- B1b: zip.js 2.9.0 게이트 3항목(순차 Blob 스트림·강제 ZIP64·외부 unzip 왕복) 통과. **Mediabunny 1.55.5는 B-frame fixture trim duration이 FFmpeg보다 2프레임 길어(계획 허용치 1프레임 초과) B2 후보 기각** → mp4box.js+고정 mp4-muxer 대안 회귀.

### 앱 아이콘 — 기각안 (Codx)

그라데이션 미지원 래스터라이저 재사용(색상 소실), 투명 라운드 아이콘의 Apple·maskable 겸용(마스크 크롭 문제) 각각 기각 → Chrome 렌더링 생성기 + purpose 분리 채택.

### 2026-08-15–16 신뢰성 작업지시서 종결 검토 (Codx)

- 라운드 요약: 1차는 전 도구 영역 약 120항목 감사(P0 데이터 무결성·주요 P1 수정), 2차는 수정 회귀·부분 해결 재검증, 3차는 R1–R14 해결과 블러·비디오 회귀 S1–S14 추적, 4차는 S1–S14 해결 확인.
- 3차 이의 제기 판정 보존: 규칙 출처 표기 일부 수용 / `w:trackRevisions` 삭제 지시는 정식 OOXML 요소 증거로 기각(잘못된 `trackChanges`만 제거) / 오디오 워커 파일 전환 종료는 메모리 정리 정책상 유지 / Excel 끝단 트림 안전장치 완화는 불변식 검증 전까지 기각 / 비디오 memo 콜백 비교는 의도적 무시 계약을 주석·테스트로 확정.
- 4차 T1–T7 재검증(`72981cc` 기준): T1·T2·T3·T5·T6·T7 해결, T4 미해결(`resolveConcatFrameRate(..., fallback = 30)` 잔존 → `docs/backlog.md` 이관). 근거는 `rg` 실측 — T1 `getObjectScaling`·DPR 비의존 테스트, T2 유효 구간 export readiness·60초 probe timeout, T3 `frameRateProbeStatus` 1회 가드, T5 base 위 효과 재정렬·Safari 2–3 pass, T6 선택 영역 소스 픽셀 렌더, T7 주석·가이드·테스트·시트 참조 인덱스. FPS 필터 단순 생략안은 stream-copy 결합 호환성 상실로 기각.
- 종결 검증: `npm run build`(2,336 modules·55 pages) · `npm run test:unit`(15/15) · `npm run test:static` 통과.
