# FolioTrace 상장시장 참조표

출처: **한국거래소(KRX) Data Marketplace 종목검색 자료**.
공식 조회 위치: https://data.krx.co.kr/contents/MDC/MAIN/main/index.cmd
보존 원문은 `krx-stock-finder-YYYYMMDD.json`, 생성물은
`src/features/foliotrace/data/marketReference.json`이다. 원문은 dist에 배포하지 않는다.
화면에도 공급자·출처 링크·자료 기준일을 표시한다.

## 주기와 담당

- FolioTrace 운영 담당(sol-ops)이 **매주 첫 거래일**에 신규 상장·이전 상장·상장폐지 및 기준일을 확인한다.
- 시장 변경을 확인하거나 미분류 코드가 생기면 정기 주기를 기다리지 않고 갱신한다.
- Claude 총괄이 갱신을 발주하고 검수 결과를 확인한 뒤 통합·원격 반영을 맡는다.
- 이는 수동 운영 절차다. 자동 갱신 서비스나 스케줄러를 설치한 것은 아니다.

## 갱신

자신의 작업 브랜치에서 실행한다. `YYYYMMDD`는 조회일로 바꾸고 이전 원문을 보존한다.

```sh
curl --fail --show-error --silent \
  --referer 'https://data.krx.co.kr/' \
  --data-urlencode 'bld=dbms/comm/finder/finder_stkisu' \
  --data-urlencode 'locale=ko_KR' --data-urlencode 'mktsel=ALL' \
  --data-urlencode 'typeNo=0' --data-urlencode 'searchText=' \
  'https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd' \
  --output vendor/foliotrace/krx-stock-finder-YYYYMMDD.json
node scripts/generate-foliotrace-market-reference.mjs \
  vendor/foliotrace/krx-stock-finder-YYYYMMDD.json
```

생성기는 응답의 CURRENT_DATETIME에서 기준일을 얻고 단축코드·시장 코드·중복·최소 건수를 검사한다.
파일명만 바꿔 기준일을 갱신하거나 코드/이름으로 시장을 추정하지 않는다.

## 검증과 인계

1. 생성물의 `sourceSha256`이 보존 원문의 SHA-256과 같은지 확인한다.
2. KOSPI/KOSDAQ/KONEX 건수와 기존 자료의 차이, 실제 공개 스냅샷의 미분류 코드를 대조한다.
   미분류 종목은 기타·시장 미확인에 남긴다. 이전 상장처럼 기존 코드의 시장이 바뀐 경우도 확인한다.
3. `npm run test:unit`, `npm run test:i18n`, `npm run build`, `npm run test:static`을 실행한다.
4. dist를 서빙하고 `F7_OUTPUT=/tmp/market-review node --test tests/foliotrace-markets.mjs`를 실행한다
   (다른 포트는 TEST_BASE_URL 지정). 모바일 탭/데스크톱 2단, 건수·금액·상세 이력을 확인한다.
5. 원문·생성물·해시·건수 차이·검사 로그를 함께 검수에 넘긴다. push·배포는 총괄의 승인/담당 절차를 따른다.

## 낡은 자료 안내

화면은 **공개 스냅샷의 평가일**과 참조표 기준일을 UTC 달력일로 비교한다.
참조표가 평가일보다 **30일을 초과해 오래된 경우(31일부터)** 작은 안내를 표시한다.
평가일이 없거나 참조표가 더 새로우면 이 안내를 표시하지 않는다.
안내는 시장을 자동 재분류하거나 종목을 숨기지 않으며, 실제 갱신 절차를 대체하지 않는다.
