# 작업지시서 — U1 후속 3건: 빈 보고서·파일 배치 UX·대사 매핑 선택화 (2026-09-03)

**상태: 구현 완료(커밋) (2026-09-03 — X-A `6bf781c`, X-B `0a7403b`, X-C `8facd98`, 기록 `9c28c8c`. 4차 왕복 이견 0 정본 계약 이행.)**
기준 해시: **`e44d4564fbae8afbd9ce046402d35c331583a6b2`**(Claude 실측, `git rev-parse HEAD`=`origin/main` — Excel Compare 코드는 da8aa18과 동일 확인). 근거: 2026-09-03 사용자 신고 3건 + 원인 분석(Codex — 엔진 직접 호출 재현).
재현 파일: `dummyfortest/2026년 설 선물 발송처_20260204_취합.xlsx` · `..._취합_김민정.xlsx`(CI 참조 금지).

## X-A. 보고서 빈 파일 (신고 ② — 원인 미확정·방어 계약)

- **분석 결과(실측)**: 신고 파일 2종으로 엔진→9시트 보고서 직접 실행 시 **정상**(770 records·matched 761/changed 9·49,889B·PK 서명·ExcelJS 재개방 성공·전 시트 데이터 행 존재). worker transfer→Blob→URL 흐름 시뮬레이션도 정상(blobSize=49,888·fetch 재수신 일치). 합성 파일 대조도 정상. **파일 특이성·엔진·전송 계층 원인 배제 — 근본 원인 미확정**(브라우저/배포 환경 가설 단계).
- 수정 계약(미재현 상태의 방어·계측 — 조용한 빈 파일 금지. **2차 정정: 검증 책임 계층 분리**):
  1. **worker 계층**(`excelCompare.worker.ts:58` 일대): 보고서 생성 직후 `byteLength>0`·XLSX `PK\x03\x04` 서명 검증 + transfer로 분리되지 않는 **`reportByteLength` 필드를 결과에 동봉**.
  2. **client 계층**(`excelCompareClient.ts:48`): 수신 `reportBuffer.byteLength === reportByteLength` 대조.
  3. **page 계층**(`ExcelComparePage.tsx:150`): `blob.size === reportByteLength` 확인 후에만 URL·성공 결과 노출. 0/불일치/서명 오류는 **동일 안전 오류 코드로 귀결** — ko/en 행동 중심 안내(내부 명칭·원시 예외 비노출)·재시도 유도.
  4. **URL 수명 계약(4차 정정)**: revoke는 **React commit으로 앵커가 DOM에서 실제 제거된 이후**에만 수행 — 동기 `setCompleted → revoke`는 DOM 반영 전 revoke라 부적합(자체 모순 실측). 구현 계약: 교체 대상 이전 URL 목록을 보관하고 **`completed` 상태 변경 반영 후의 `useEffect`(또는 effect cleanup)에서 revoke**, 언마운트 cleanup 정리 유지. 스모크: 결과 교체 직후 이전 앵커 부재+새 앵커 다운로드 정상 단언. preview COOP/COEP 상태 기록(서비스워커는 excel 무관 실측 — 가설 폐쇄 기록).
  5. **검출 범위 밖 명시**: 브라우저가 OS 다운로드로 넘긴 이후 저장 파일이 비는 경우는 웹 앱이 사후 확인 불가 — 오류 안내에 재다운로드 유도 포함, 재발 시 사용자 회신(저장 파일 크기·브라우저) 기반 재조사 항목으로 기록.
- 검증(**2차 정정 — 실다운로드**): 스모크를 `fetch(anchor.href)` 방식에서 **CDP 다운로드 설정(office-editor-smoke 방식 재사용)으로 교체** — 디스크 저장 파일의 크기·PK 서명·ExcelJS 재개방·9시트·Summary 수치 단언. 0바이트/길이 불일치 주입 시 오류 안내 노출 단언.

## X-B. 파일 배치 UX (신고 ① — 표면 확정)

- 현행(실측): 좌우 독립 드롭존·`multiple` 미지정이라 **한 영역에 2파일 드롭 시 첫 파일만 남고 둘째는 조용히 유실**(`ExcelComparePage.tsx:271`·`ui.tsx:120,126`). 교환 제어 부재.
- 수정(**2차 정정 — 구현 표면 확정**): ① **전용 `PairFileDropZone` 쌍 컨테이너 신설**(공용 FileDropZone 재사용 금지 — multiple 계약이 슬롯 배치와 충돌 실측) + 순수 함수 `assignPairFiles`로 분배 결정. **분배 규칙(3차 정정 — 단일 규칙으로 통일)**: `배치 수 = min(빈 슬롯 수, 드롭 파일 수)` — 빈 슬롯(왼쪽 우선)에 드롭 순서대로 채우고, **점유 슬롯은 어떤 경우에도 덮지 않으며**, 초과분(빈 슬롯 수를 넘는 파일)은 배치하지 않고 항상 개수 포함 안내(**조용한 유실 금지**). 도출 케이스: 빈2+2→좌·우 / 빈2+1→왼쪽 / 빈1+1→빈 슬롯 / **빈1+2→첫 파일만 배치+둘째 안내** / 빈0+N→전부 안내. ② **교환 버튼**(⇄ 도상+접근성 라벨 ko/en, 버튼 방식) — **교환 범위는 PairState 전체**: file·inspection·error·sheet·headerRow·key columns·reconcile columns 일괄 스왑(열 번호 오적용 방지). **(3차 정정) 검사 중 교환 금지**: 어느 한쪽이라도 inspection 비동기 검사 진행 중이면 교환 버튼 비활성(완료 후 활성 — `selectFile` 완료 가드(`ExcelComparePage.tsx:89`)와의 경쟁 상태 원천 차단), 비활성 상태 스모크 단언.
- 검증: `assignPairFiles` 분배표 전 케이스 단위 테스트·교환 후 PairState 전 필드 스왑·비교 방향(추가/삭제 의미) 반전 스모크.

## X-C. 거래 대사 매핑 선택화 (신고 ③ — 표면 확정)

- 현행(실측): 매핑 6종 전부 필수 숫자(`types.ts:43`), UI는 실제 열만 선택 가능(`ExcelComparePage.tsx:298`), 엔진은 날짜·거래처 모두 유효해야 거래 인정(`compareEngine.ts:362`) — 열 0 주입 시 `INVALID_TRANSACTION` 오류 실측.
- 수정: **금액 필수 유지, 날짜·거래처/설명은 "사용 안 함" 선택 가능**(타입 optional 확장 + UI 선택지). **(2차 정정) 계약 보강**:
  - **좌우 쌍 불변식**: 각 기준은 좌우 동시 사용 또는 동시 미사용(한쪽만 매핑 금지 — UI·validator 강제).
  - **소비처 전수 갱신(3차 정정)**: `types.ts:43`·`ExcelComparePage.tsx`·`compareEngine.ts:362, 204-230` + **역방향 N:1 후보 필터 `:233-245`**(partner·day 필터 — 미사용 기준이 역방향 대사에 잔존하지 않도록 분기)·테스트 fixture 2곳. 정방향·역방향 대칭 골든 포함.
  - **오류 코드 세분화**: `INVALID_TRANSACTION` 단일 → `INVALID_AMOUNT`/`INVALID_DATE`/`INVALID_PARTNER`(활성 기준만 발생).
  - 매칭·허용 오차에서 미사용 기준 제외(해당 상태·오류 미생성). 후보 증가 시 자동 확정 금지 — Ambiguous 처리.
  - **(2차 정정) 후보 한도·회계 정합**: 정확 금액 후보의 무제한 검사 vs Parameters 고정 10 기록 불일치(실측) 해소 — **실제 적용 한도와 기록 일치**, 한도 초과 탐색 중단은 `RECON_SEARCH_LIMIT` 기록+자동 확정 금지. **Ambiguous 회계 = left-target 단위**(미확정 좌측 거래 1건당 1행). Parameters의 `undefined→빈 문자열`을 **`UNUSED` 명시값**으로 교체.
- 검증: 날짜/거래처/둘 다 미사용 골든(금액 단독 → Ambiguous 증가·회계 방식 단언), 오류 코드 세분화 케이스, Parameters `UNUSED`·한도 기록 일치 단언, 기존 전체 매핑 회귀.

## 공통

- 검증: `npm run build` · `npm run test:unit` · `npm run test:excel-compare` · `npm run test:static` + 항목별. **(2차 정정) 필수 게이트 검증은 합성 동형 fixture만 사용**(dummyfortest 경로 CI/테스트 참조 0건 유지) — 신고 파일 실행은 로컬 비게이팅 확인 절차로 분리 기록. ko/en 신규 문구·기록 이원 체계·로드맵 「단위 공통 완료 기준」 해당분.

## 반박 기록

### Codex 1차 (2026-09-03, 완료 — 9건 전원 수용 → v2 확정. 실측 기여: 검증 계층 분리 필요성·revoke 순서 불일치·스모크 fetch 한계·FileDropZone multiple 계약 충돌·PairState 스왑 범위·후보 한도/기록 불일치 재현·Parameters undefined 처리. 판정 "재왕복 필요")
### Codex 2차 (2026-09-03, 완료 — 6건 반영 확인, 3건 미흡(분배 규칙 충돌·검사 중 교환 경쟁(`:89` 완료 가드 실측)·역방향 N:1 소비처 `:233-245` 누락) → v3 정정)
### Codex 3차 (2026-09-03, 완료 — 3건 반영 확인(완료 가드 실위치 `:97-100` 정정 포함), 신규 1건(동기 setCompleted→revoke는 DOM 커밋 전 — effect 기반 지연 필요) → v4 정정)
### Codex 4차 (2026-09-03, 완료 — revoke effect 지연 계약 해소 확인·전문 무모순, **"이견 0" 명시 선언·[정본화 가능]** → 정본 확정. 즉시 착수).

## 실행 기록

- 2026-09-03 Codx 실행 게이트: `git rev-parse HEAD`와 `git rev-parse origin/main` 모두 `e44d4564fbae8afbd9ce046402d35c331583a6b2`로 기준 해시와 일치. 기존 미추적 `dummyfortest/` 외부 파일(MP4 3개·DOCX 2개)은 작업·스테이징 제외 대상으로 확인.
- 열린 계획서 충돌 검사: `excel-cleaner-20260903.md`는 U1 표면에 `test:excel-compare` 회귀만 요구하고, `shadcn-migration-20260903.md`는 본 후속과 Excel Cleaner 배포 뒤 착수하는 초안이다. 원 U1·로드맵·완료 계획서를 포함한 열린 문서 검색 결과 X-A/X-B/X-C 표면과 상반 지시 없음.
- X-A/X-B/X-C 구현 커밋: `6bf781c` · `0a7403b` · `8facd98`; 이원 기록 커밋: `9c28c8c`.
- 신고 파일 비게이팅 확인: 770 records(`matched=761`, `changed=9`), 보고서 49,958B·PK·9시트 재개방. 데이터 행 Summary 8·Parameters 46·Matched 761·Changed 9·나머지 결과 시트 0. 코드·테스트의 `dummyfortest` 참조 0건.
- 최종 검증: `npm run build` exit 0(2,423 modules·정적 57페이지), `npm run test:unit` 147/147, `TEST_BASE_URL=http://127.0.0.1:4174 npm run test:excel-compare` exit 0, `npm run test:static` exit 0, `git diff --check` exit 0.
