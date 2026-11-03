# FolioTrace 공개 스냅샷 계약 (개정 2)

작성 2026-10-25 · 계획 `foliotrace-ops-replacement-plan-20261024` P3-1 · 확정 결정 D2·D4·D5·D6·D8(2026-10-25 사용자).
코드 정본: `src/features/foliotrace/contracts.ts`(형), `src/features/foliotrace/data/loadSnapshot.ts`(`validSnapshot`·`SNAPSHOT_LIMITS`·`SOURCE_KINDS`), `scripts/foliotrace-public-data.mjs`(파일 단위 검증·비공개 내용 검사). 이 문서는 그 설명이며, 어긋나면 코드가 정본이다.

## 위치와 파일
- 데이터 위치: 비공개 저장소 `Fentanest/foliotrace-site-data` main의 `v1/`. 배포 워크플로가 이를 빌드 전에 `public/data/foliotrace/v1/`로 복사한다(사이트 URL `/data/foliotrace/v1/`, 이 저장소에는 커밋하지 않음; docs/foliotrace-delivery-and-deploy.md). 경로의 `v1`과 파일의 `schemaVersion: 1`은 **그대로 둔다**(개정 2는 호환 확장이라 화면이 읽는 주소와 판별값을 바꾸지 않는다).
- `manifest.json`(≤ 4,096바이트): `schemaVersion=1`, `datasetVersion`(64자리 16진), `snapshotPath=snapshots/<datasetVersion>.json`, `snapshotSha256`(스냅샷 파일 바이트의 SHA-256).
- 데이터 루트(`v1/`)에는 `manifest.json`과 `snapshots/` 외 아무것도 두지 않는다(검증기가 거절).
- `snapshots/<datasetVersion>.json`: 스냅샷 본체. 폴더에는 **매니페스트가 가리키는 파일 하나만** 둔다(D5: 일자별 전체 사본 비보관, 이전 파일은 새 전달 때 삭제).
- 화면은 `manifest.json`을 먼저 읽고(캐시 없음), 해시가 다르면 `schema-error`로 처리한다.

## 개정 2에서 바뀐 것 (개정 1 대비)
| 항목 | 개정 1 | 개정 2 |
|---|---|---|
| `holdings[].receiptNo` | 14자리 필수 | **null 허용**(연말 목록 행은 접수번호 없음). 전부 0인 14자리 자리표시도 "없음"으로 취급(`hasReceiptNo`) |
| `holdings[].sourceKind` | 없음 | **선택 필드**, 값은 아래 4개만 |
| 크기·개수 상한 | 없음 | 아래 표 |
| 총액·종목 범위 | 5% 이상 추적 종목 | 연말 보유 목록 전체(5% 미만 포함)를 마지막 확인 수량 × 종가로 평가(D8) |

**하위 호환**: 개정 1 스냅샷(접수번호 항상 있음, `sourceKind` 없음)은 개정 2 검증기를 그대로 통과한다. 근거: 2026-10-25 실제 공개본(`worklazy.net/data/foliotrace/v1`, 2.13 MB, holdings 451, events 5,108)을 파일 검증기와 `validSnapshot`에 넣어 통과했고, 같은 공개본의 축약 표본과 실측 수치가 `tests/fixtures/foliotrace/live-revision1-*.json`·`tests/unit/foliotrace-public-data.test.ts`로 고정돼 있다(전체 파일은 용량 때문에 저장소에 넣지 않았다). 반대로 개정 2 스냅샷을 옛 검증기에 넣으면 `receiptNo: null` 행이 거절되므로, 생산자는 전달 전에 이 저장소의 검증기(또는 그 사본)로 확인한다.

## quantityAdjustment (개정 2.1, 선택 필드 — 기업행위 비율 보정)
`holdings[].quantityAdjustment`는 **없거나 null이면 보정 없음**(기존 스냅샷 그대로 통과). 있으면 아래 모양을 엄격히 검증한다.

| 필드 | 형식 |
|---|---|
| `reportedQuantity` | 보고 수량, 정수 문자열(0 이상) |
| `ratioNumerator` / `ratioDenominator` | 비율 분자·분모, 양의 정수 문자열. 보정 수량 = `reportedQuantity × ratioNumerator ÷ ratioDenominator`(소수점 버림) |
| `events[]` (1~20개) | `receiptNo` 14자리, `kind` ∈ `bonus-issue`·`stock-split`·`reverse-split`·`capital-reduction`·`spin-off`·`stock-dividend`, `priceChangeDate` YYYY-MM-DD, `quantityChangeDate` YYYY-MM-DD 또는 null |

- 이때 `holdings[].quantity`는 **보정 후 수량**(평가에 쓴 값)이다. `evidence`·`sourceKind`는 바꾸지 않는다.
- 화면: 표의 수량 아래 "비율 보정" 표시, 상세에 보고 수량·적용 비율·근거 공시(DART 링크)·가격/수량 변경일. 변화 색(↑/↓)은 보정 종목에서 쓰지 않는다. 안내 섹션에 "일부 수량은 공시된 기업행위 비율로 보정한 추정값" 한 줄.
- 새 `valuationExclusionReason` 값: `corporate_action_pending`(시행 중 거래 정지 구간), `corporate_action_ratio_unverified`(비율 미확인). 이 값 외 알 수 없는 사유는 일반 문구로 표시된다.
- 생산자 사본(`foliotrace-pipeline`의 `contract_v1/contracts.ts`·`loadSnapshot.ts`)은 R2 구현자가 이 파일들로 동기화한다.

## sourceKind (D4: 상세 화면에만, 일반 표현)
허용 값과 화면 문구(상세 패널 "자료 출처" 한 줄, 표에는 노출하지 않음. 단 연말 목록 행의 근거 한 줄만 "연말 기준 보유 목록"으로 표시):

| 값 | 한국어 | English |
|---|---|---|
| `year-end-list` | 연말 기준 보유 목록 | Year-end holdings list |
| `nps-filing` | 국민연금 대량보유 공시 | NPS large-holding filing |
| `issuer-report` | 발행회사 보고서 | Issuer report |
| `disclosure-text-read` | 공시 원문 판독 | Disclosure text reading |

내부 도구·모델·런타임 이름(예: 판독 방식 코드, 모델명)은 어떤 필드에도 넣지 않는다. 목록 밖의 값은 검증 실패다.

## 상한 (`SNAPSHOT_LIMITS`, 화면 로더와 검증기가 같이 강제)
| 항목 | 상한 | 비고 |
|---|---|---|
| 스냅샷 파일 | 16 MiB | 실측 개정 1 공개본 2.13 MB, 생산자 dry-run 0.89 MB. 생산자 관문은 더 엄격(6,000,000바이트) |
| 매니페스트 | 4,096 B | |
| `holdings` | 10,000 | 실측 공개본 451, dry-run 1,192 |
| `events` | 20,000 | 실측 공개본 **5,108**(2009년부터, 최근 연 약 500건씩 증가), dry-run 727, 생산자 기본 2,000 |
| `history` | 1,000 | 실측 공개본 8, 생산자는 최근 90개 유지 |

근거(2026-10-25 실측): 성장하는 항목은 실측 최대값의 3배 이상 여유를 둔다(시험이 강제). 처음 5,000으로 두었다가 실제 공개본(events 5,108)을 거절해 20,000으로 재설정했다.

## 이력 범위 (D5)
- 최신 스냅샷 1개만 공개한다. 일자별 전체 사본은 두지 않는다(Git 이력에 이전 커밋이 남는 것은 별개).
- 종목별 이력은 `events`(연말 고정점 이후 접수 공시, 최근 400일·최대 2,000건 기본)이며, 포트폴리오 값 이력은 `history`(거래일별 1건, 같은 거래일 재계산은 덮어씀).

## 검증 두 겹
1. 화면(`validSnapshot`): 형·날짜·십진 문자열·URL 형식(`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=14자리`만)·상한. 통과하지 못하면 화면은 오류 상태를 보이고 데이터를 그리지 않는다.
2. 파일(`validatePublicData`, CLI `scripts/validate-foliotrace-snapshot.mjs <사이트루트> [--no-html]`): 매니페스트 필드, 폴더에 파일 하나만, 크기, 해시, 비공개 내용 없음, 스키마, `trackedCount`·`pricedCount`가 행과 일치, `stockCode` 중복 없음, 평가 가능 행 ≥ 1·총액 존재·`valuationCoverage != unavailable`(전부 미평가 스냅샷 보류). `dist`를 검증할 때는 ko/en 정적 요약(`data-foliotrace-dataset`, 총액)도 확인한다.

**비공개 내용 검사**(원문 텍스트 전체, 일치 내용은 출력하지 않음): `/home/`·`/tmp/`·`/mnt/`·`file://`·`.env`·`.jsonl`, 비밀값 단어(`api_key`·`password`·`secret`·`bearer `·`sk-ant-`·`ghp_`·개인키 머리말 등), 40자리 16진 열쇠 모양, 모델·내부 런타임 이름(claude·anthropic·sonnet·opus·haiku·gemini·muse·luna·jev·codex·openai·llm_read·msgbatch·orchestrator·systemd). 생산자 관문(`gate.py`)의 목록을 포함하고 몇 개(`/mnt/`·`file://`·`.jsonl`·`sk-ant-`·`ghp_`·키 모양·`orchestrator`·`systemd` 등)를 더한 것이다. 양쪽이 어긋나면 이 쪽(공개 직전 마지막 관문)이 우선이며, 생산자 쪽을 맞춘다.

## 화면 의미 (5% 미만 포함에 따른 정합)
- 총액("공개 보유분 추정 평가금액")은 연말 보유 목록 전체와 이후 공시 반영분을 **마지막으로 확인된 수량 × 직전 거래일 종가**로 합산한 값이다. 5% 미만 종목도 포함한다.
- 지분율 5% 미만이고 추적 상태가 `active`인 행의 상태 문구는 "지분율 5% 미만 · 마지막 확인 수량 기준"이다. 필터 "5% 미만"은 이 행과 기존 `below-5-percent` 행을 모두 고른다.
- 안내 문구(소개·범위 설명·가이드 FAQ 두 개)는 한·영 모두 같은 의미로 고쳤다.

## 생산자(foliotrace-pipeline) 후속 — 이 저장소 범위 밖
1. 연말 목록 행의 `receiptNo`를 자리표시 `00000000000000` 대신 `null`로 낸다(둘 다 통과하지만 null이 계약).
2. `contract_v1/` 사본(`contracts.ts`, `loadSnapshot.ts`)을 이 저장소의 개정 2 파일로 교체하고 드리프트 시험을 갱신한다. `scripts/foliotrace-public-data.mjs`의 비공개 내용 검사와 `gate.py`의 목록을 맞춘다.
3. 전달 시 `manifest.json`·`snapshots/<버전>.json` 외 파일을 데이터 경로에 두지 않는다.


## F6 선택 확장 valuationSeries (2026-11-03)

`schemaVersion=1`, data URL, 기존 `history`의 3개 필드와 공개값 의미는 유지한다.
선택적 `valuationSeries`의 형은 `src/features/foliotrace/valuationSeriesContract.ts`,
검증은 `data/valuationSeries.ts`다. 데이터 담당의 `f6-data-20261103/contract.ts` 인계를 반영한다.

- 확장이 없으면 기존 공개 history만 읽는다. 브라우저는 차트 이력/선택 확장 검증과 핵심 스냅샷 검증을 분리한다.
  history나 valuationSeries가 잘못되면 차트와 날짜표만 숨기고 짧은 안내를 표시하며 보유종목·공시는 유지한다.
  검증 실패한 차트 필드는 표시용 객체에서 제외한다. 재구성 점을 공개 history로 바꾸거나 공개값만으로 조용히 대체하지 않는다.
  핵심 계약 필드·manifest·파일 해시·전체 파일 크기 위반은 기존처럼 schema-error다.
  발행/정적 파일 게이트의 validSnapshot은 계속 핵심+차트를 엄격하게 검사해 부정 데이터를 새로 발행하지 않는다.
- 확장은 최대 1,000점, 실제 달력 날짜·엄격한 오름차순·날짜 중복 금지다. 기존 history도
  최대 1,000점의 엄격한 오름차순/중복 금지를 검사한다.
- 재구성은 `kind=reconstructed`, `reconstructed=true`, `datasetVersion=null`, methodology=2다.
  점의 calculationPolicyRevision은 계열과 같아야 한다. KRW·포트폴리오·knowledgePolicy·priceBasis를 검사한다.
- tracked=priced+unvalued, 제외 사유별 합계=unvalued, 0 이상 안전한 정수·상한과 coverage를 검사한다.
  null 금액은 합계의 결손이다. 종목별 평가 수와 별개로 보존하며 0이나 전일값으로 채우지 않는다.
- knowledgeCutoff는 거래일 이하, 거래일/조립일은 생성일 이하, 확장 거래일은 공개 스냅샷 평가일 이하로 검사한다.
  이는 공개 메타데이터 검증이며 원장/공시 원문까지 독립 재판독하는 것은 아니다.
- SHA-256 형식·식별자·문자열/배열 상한을 검사한다. 파일 검증기는 같은 validSnapshot 및 기존 비공개 정보 검사를 사용한다.

### 최신 사용자 표시 결정

원본 확장19점은 모두 재구성으로 보존/검증한다. 화면에서는 날짜가 겹치면 기존 history의
공개값을 우선한다. 현재 표시는 **공개7점 + 중복이 없는 재구성12점 = 19개 날짜**다.
이 결정은 초안 HANDOFF의 두 계열 중첩 표시안보다 나중에 주어진 사용자 지시를 따른다.

공개 실선/재구성 점선, 표지·범례·툴팁의 재구성 설명으로 출처를 구분한다.
데이터 검수 결론은 수량 시점 오차 ≤0.06%, 공개 7일 대조에서 가격·기업행위 잔차 0이다.
과거 12일은 당시 저장 수량과 직접 대조할 수 없으며 실제 보유액 정확도 보장이 아니다.
출처가 달라지는 경계와 null 결손은 선을 잇지 않는다. 헤더에는 공개 구간 변화만 표시하고
재구성 구간 변화는 범례와 재구성 툴팁으로 옮겨 운용 수익률과 혼동하지 않게 한다. 과거 공개점에 없는 평가/제외 종목 수는
추정하지 않으며, 해당 공개 datasetVersion/평가일과 현재 스냅샷이 일치할 때만 현재 수를 연결한다.

차트 좌표에서만 유한 Number를 사용하고 원화 레이블/차이는 원본 십진 문자열·BigInt로 유지한다.
1~2개 유효 값에는 추이 선 대신 기록 부족 상태와 날짜별 대체 기록을 제공한다.
