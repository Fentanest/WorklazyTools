# Backlog

> 과거의 도구별 광고·방문통계 제외 및 광고 제거용 문서 이동 항목은 2026-09-30 정책 변경으로 대체됐다. 현재 계약은 [PROJECT_RULES.md](../PROJECT_RULES.md)와 [변경 기록](ad-policy-2026-09-30.md)을 따른다. 아래 완료 기록은 당시 이력으로 보존한다.

종결된 작업 묶음에서 살아남은 후속 항목을 여기에 남긴다(「작업지시서 관리」 규칙). 항목마다 배경이 된 작업과 판단 근거를 한 줄로 병기한다.

과거 제외 경로·AdSense 콘솔 설정과 GA4 자동 History 측정, 지역별 CMP는 `docs/PUBLISHING_CHECKLIST.md`의 운영 확인 대상이다.

## 홈 CTA 4.5:1 종결 범위 결정 (2026-11-04)

- 히어로 글자색만 보강한 `fix-hero-cta-contrast-20261104`의 라이트 민트 KO 데스크톱 CTA는 normal/hover/focus 모두 순검정에서도 4.469276:1이다. 실제 글자 뒤 어두운 배경은 4.5를 위해 음수 전경 휘도를 요구하고, 밝은 배경은 밝은 전경 휘도 1 초과를 요구하므로 단색 글자색만으로 종결할 수 없다. 배경·배치 등 기존 승인 밖 범위의 결정을 받은 후 수리해야 한다. 근거: `evidence/herocta/cta-feasibility.json`, 전후192측정과 지정 `SOL-HEROCTA-REPORT.md`; 목표 미달을 완료·검수 통과로 표시하지 않는다. — Codx

## 안내 fragment 복원 판별 범위 (2026-11-04)

- FIX2는 최초 복원 pageshow부터 다음 보정 프레임 사이의 경합만 한 번 허용한다. 레이아웃 변화·복원 시점 근거 없이 뒤늦게 발생한 스크롤은 사용자 이동으로 처리한다. Safari/Firefox의 실제 이력 복원 시점은 미검증이며, 향후 확장 시 사용자 pointerless 스크롤을 되돌리지 않는 조건을 유지한다. Chromium 회귀 및 근거는 지정 `SOL-ANCHOR-FIX2.md`. 기존 하네스의 HTTP 전달은 실제 브라우저 네트워크 스택 오류를 재현하는 검증이 아니라는 한계도 유지한다. — Codx

## 로컬 브라우저 시험 네트워크 오류 진단 (2026-11-04)

- 안내 앵커 반복 중 hash 없는 최초 진입·reload의 redactor 준비 대기 실패를 별도로 관측했다. 추가 계측의 두 독립 브라우저는 동일 시점 로컬 bcmap 요청에 `net::ERR_NETWORK_CHANGED`를 기록했고 worker 시작 전 준비 실패 UI를 보였다. 제품의 앵커 위치 실패와 구분하며, 일반 반복 중 같은 준비 증상의 개별 원인 로그가 없는 건까지 네트워크 오류로 단정하지 않는다. 최종 비교는 제품·좌표 판정을 유지한 채 loopback 전용 네트워크 namespace에서 실행한다. 후속 하네스 작업 때 requestfailed/준비 상태 증거를 상시 보존할 것. 근거: anchorflaky worktree `scratch/anchorflaky/prep-diagnostic/`, `after/`, `after-isolated/`, 지정 `SOL-ANCHORFLAKY-REPORT.md`. — Codx

- 11-04 FIX1에서 상시 진단 보존은 구현했다. `tests/shell-guide-offset-smoke.mjs`는 최초 준비·fragment reload 단계를 구분해 requestfailed·HTTP 오류·worker 시작과 실패 시 준비 UI·resource 상태를 남긴다. 실제 준비된 input과 활성 파일 선택 버튼을 기다리며 terminal 오류를 통과시키지 않는다. 위 namespace 비교는 과거 실행 조건이며 FIX1의 반복은 호스트 기본 네트워크에서 수행한다. Reviewer의 기존 1건에는 개별 네트워크 로그가 없어 같은 원인으로 확정하지 않는다. — Codx

- FIX1의 첫 비격리 반복 2회차에서 준비 실패 2건을 재현했고, 두 건 모두 reload 중 로컬 자산의 `net::ERR_NETWORK_CHANGED`와 준비 실패 UI가 함께 기록됐다. 로컬 응답은 Playwright HTTP 클라이언트로 실제 서버에서 읽어 상태·헤더·본문 그대로 전달하도록 수리했다(재시도·대체 자산 없음). HTTP 404를 실제 서버에서 돌려준 음성 대조는 계속 준비 실패로 검출했다. 제품 runtime의 네트워크 오류 후 수동 새로고침 동작은 유지한다. 근거: `scratch/anchor-fix1/pre-transport/run-02/`, `preparation-http-negative/`, 지정 `SOL-ANCHOR-FIX1.md`. — Codx

## 사물·제품 배경 제거: iOS 경고·보고된 저메모리 제한 (2026-11-03)

- **사용자 결정: iOS 전면 차단 → 선택 가능한 경고** — 확인된 크래시는 iPhone 11 4GB 한 대의 QA다. 이를 최신 iPhone·M칩 iPad 전체의 실행 불가로 일반화하지 않는다. iOS/iPadOS WebKit은 사물·제품 선택을 허용하고, 실행 때 탭 종료 위험과 인물 모드·수동 지우개 대안을 먼저 안내한다. 사용자가 ‘그래도 진행’을 골라야 기존 다운로드 동의로 넘어간다. 인물 기본 추천, HTTPS·GPU 기능 확인, 모델 무결성은 유지한다. 이전 `0b5bc129`의 기기군 전체 차단을 이 결정으로 대체한다. — Codx
- **보고된 deviceMemory ≤ 4 차단 유지** — 유한한 양수 메모리 구간이 4 이하이면 iOS 여부보다 먼저 차단한다. 문구도 ‘브라우저가 보고한 구간’임을 명시한다. RAM 미보고는 4GB로 간주하지 않는다. 근사 bucket이므로 6GB급 기기도 4로 보고될 수 있고, 실제 여유 RAM을 정밀 측정하는 정책이 아니다. 근거: `SOL-IOS-BG-REPORT.md`, `REVIEWER-SONNET-IOSBG.md` P3-1. — Codx
- **계속 남길 후속** — 더 작은 사물 모델 또는 메모리 절감과 iPhone 11급·iPadOS·저메모리 Android의 실제 세션 생성/첫 추론 peak, cold/warm 완료·취소/재실행을 계측한다. 경고 후 진행 허용은 메모리 문제 해결이나 모든 iOS 기기의 성공 보증이 아니다. UA/기능 모의와 실기기 판정을 구별하고 화질·무결성·라이선스·다운로드 전 보호를 보존한다. 보고된 저메모리 차단 자체의 완화는 별도 결정/검수 대상이다. — Codx

## 시간대 지도 프레임 간격·확대 계측 (2026-11-03)

- Reviewer TZLEADER2의 인위적 극단 밀집(8핀 ±10~40 SVG 단위)에서는 탐색 예산 소진 시 라벨이 겹칠 수 있다. `6de64be`의 라우터를 유지하는 FIX2에서도 남는 P3 한계다. 실제 도시·선택 표본의 무교차와 분리해 취급한다. 근거: `REVIEWER-SONNET-TZLEADER2.md`, `SOL-TZLEADER-FIX2.md`. — Codx

- `f579a48` 후속에서 이동 중 Long Task는 네 조건 모두 0건이었으나, Linux headless Chrome 데스크톱 rAF 간격 약 150ms와 확대 단계 최대 127ms가 관측됐다. 이동 중 경로 탐색 개선과 분리해 실제 장비/렌더링 비용을 판독할 후속이며, 실기기나 모든 프레임의 100ms 미만을 확인한 것으로 보지 않는다. 근거: `SOL-TZLEADER-PERF-REPORT.md` 전후 연속 측정. — Codx

## 영업일·연차 자료 유지보수 (2026-10-14)

- 새 선거·임시공휴일·공휴일 법령 개정 때 확인일·자료 버전·시행일·고정 기대값을 함께 갱신한다. 2050 이후 음력/법제 자료, 2000 이전 공휴일 및 구법 전체 월 이력은 별도 검증 없이는 확장하지 않는다. 반복 월말·윤일의 회사별 산정 차이는 `work-calculator-rules.md`의 명시적 모델과 구분하며 실제 사용·소멸·퇴직 장부는 지원 범위 밖이다. — Codx

## 이미지→PDF 실제 Android 확인 (2026-10-14)

- 갤럭시 탭 S7의 실제 Chrome/Samsung Internet 파일 선택기(내 파일·갤러리·외부 제공자)에서 17장 동시/개별 추가, 삭제·재선택·정렬, 준비/변환 취소, 백그라운드 복귀와 저메모리 조건을 확인한다. 이번 데스크톱 Chromium·모바일 viewport 검사와 통제된 읽기 실패는 당시 원인이나 실제 장비 재현의 증거가 아니다. 직접 원인 로그가 없으며 CMYK/특수 ICC의 모든 뷰어 색상 일치도 보증하지 않는다. — Codx

## 2026-10-26 출고 이월 (main 47d4f50)

비교 이식 수리·도구 불러오기 일시 실패 복구·HWP 편집기 영어권 개방을 함께 출고하며 남긴 항목이다. Word 생성 시간 관문 R30은 아래 「Diffchecker 이식 수리 후속」에 있다.

- **WebKit 복구 대기 시한 없음**: WebKit(아이폰·Safari) 재시도는 실패한 modulepreload 의 오류 이벤트를 기다린 뒤 그 주소를 `cache: "reload"` 로 다시 받는다(WebKit bug 270357 대응, `src/app/chunkRecovery.ts`). 오류 이벤트가 끝내 오지 않으면 자동 복구 없이 「다시 불러오는 중」에 머문다. 홈 단추로 나갈 수는 있다. 시한을 둘지는 이벤트 지연 실측과 함께 판단한다. — Claude
- **Safari·아이폰 실기 미확인**: 도구 불러오기 복구는 Playwright WebKit 26.6(Docker 원격 서버)·Chromium·Firefox 에서 503 1회/2회로 확인했다. 실제 Safari·iOS 기기에서는 확인하지 않았다. — Claude
- **HWP 편집기 영어 화면의 내장 메뉴**: 영어권 개방 뒤 호스트 화면은 영어지만 내장 rhwp Studio 메뉴·도구 모음은 한국어다(외부 구성요소). 영어 사용자 안내 문구를 둘지는 사용자 결정. — Claude
- **기존 시험 문제(Linux 재검사에서 확인, 이번 출고와 무관)**:
  - `tests/direct-entry-ocr-cancel-smoke.mjs` 는 저장소에 없는 `/tmp/worklazy-u9-core/browser/input.pdf` 고정 입력이 필요하다. 3쪽 PDF를 만들어 넣어도 41행 대기에서 시간 초과가 나며, 분기점 37d67b8e 에서도 같다. 원인 미확인. — Claude

## Diffchecker 이식 수리 후속 (2026-10-25)

- **열이 바뀐 표의 칸 단위 기록**: 지금은 표 전체 교체로 기록한다(실제 문서에서 칸 단위 기록은 칸 너비 tcW가 새 격자에 맞지 않아 Word 결과가 어긋남). 칸 너비를 격자에 맞추면 바뀐 열만 표시하는 칸 단위 기록으로 되돌릴 수 있다. — Claude
- **Astra 비차단 소견**: 빈 줄 균형 LCS의 행렬 메모리(양쪽 긴 빈 줄 구간), 검수 추론 강도가 Codex 전역 기본값(low)을 따름. — Claude
- **Word 시간 관문 R30(열림)**: 생성기 정비 묶음 4(2026-10-26) 뒤 DOCX 완료는 main 대비 중앙값 1.34배·최대 2.40배(w046)다. 관문은 1.25배·2배이고, 정비 전은 1.56배·3.05배였다.
  - 2026-11-03 Linux 후속: 원 50쌍 코퍼스/하네스 부재를 확인했다. 저장소 fixture·합성 입력의 단계별 측정과 출력 파트 해시 대조로 국소 최적화를 검증하며, 과거 비율과 직접 비교하거나 이 관문을 닫지 않는다. 재현 절차: `docs/word-performance.md`. — Codx
  - 원인: 생성은 거의 main 수준이다(중앙값 쌍 5.5s 대 5.3s). 남은 차이는 추출에 있다(w010 2.9s 대 1.4s, w046 21.9s 대 3.9s). 모든 요소의 원천 목록을 만드는 설계 비용이다.
  - 사용자 결정(10/26): 출력 불변 미세 최적화까지 하고 열린 과제로 인계한다. 추출 구조 재설계는 별도 판단.
  - 미세 최적화 남은 후보(Fable 검토)
    - 수락본 본문에서 `_qname_rewriter`가 포기한 뒤 다시 해석하는 경로(w046 −1.3s 추정)
    - `_text` 런 메모 재사용
    - 전송 형식 순회
  - 5쌍 묶음 브라우저 실측: 화면 26s(main 35s), DOCX 완료 51s(main 35s). — Claude
- **Word 메모리 남은 부분**
  - 네이티브 생성 최고점은 w046 847→723MB다.
  - Pyodide 프로세스 최대 RSS는 w046 1,096→1,071MB, w050 778→739MB로 조금만 줄었다(main 425/514MB). WASM 메모리가 줄지 않는 성질과 추출 단계 최고점이 원인으로 추정되지만 미확인이다.
  - 생성기 D단계(복사 대신 이동)는 하지 않았다. — Claude
- **무관한 두 문서 쌍의 변경 추적 파일**: 판본 관계가 없는 두 문서(예: 다른 문서의 수정본끼리)는 머리말·꼬리말 연결을 안전하게 표현할 수 없어 `UNSUPPORTED_TRACKED_SOURCE_STORY`로 DOCX를 내지 않는다(화면 비교는 정상, 묶음 이전부터 같다). main은 이 경우에도 파일을 만든다. — Claude
- **기본 모드와 기존 변경 기록**: 입력에 변경 기록이 있으면 기본 모드는 수정본 기록을 유지하므로 Word의 모두 거절이 그 기록까지 되돌린다. 기존 기록을 먼저 수락하는 선택은 정확하다. 화면 안내 문구 점검 대상. — Claude
- **문서 속성에 연결된 내용 컨트롤**: Word가 docProps 값으로 다시 채우므로 원본 쪽 표시는 수정본 속성값이 된다(w047·w048 글상자). — Claude
- **Linux 재실행**: Windows에서 실행한 검사(단위·Word 노드·코퍼스 하네스)는 Linux 호스트에서 다시 돌려야 한다. Word 오라클은 Windows 전용 도구다. — Claude
- **Linux 전용 경로를 쓰는 시험**: `image-compare-history-ui`·`direct-entry-ocr-cancel` 등은 `/usr/bin/google-chrome`·`/tmp/...` 고정 경로에 기대어 Windows에서 실행하지 못했다. Linux 재실행에서 확인한다. `image-ocr-smoke`의 보기 전환 단계는 Windows 글꼴에서 고정 머리글이 단추를 가려 기준·후보가 같이 실패했다. — Claude
- **HWP 읽기 실패 표본**: 동치 확인 12쌍 중 5쌍은 기준·후보 모두 「HWP 문서를 읽지 못했습니다」였다(같은 결과라 동치). 오래된 HWP 형식 지원 여부는 별도 확인 대상이다. — Claude
- **환경 의존 실패**: `bundle-output-metadata` 단위 시험은 Windows에서 TMP가 짧은 경로(ADMINI~1)일 때 실패한다(긴 경로에서 통과, 기준 코드도 같음). `image-alignment-smoke`는 서버 기동 직후 1회 실패 후 연속 통과. — Claude

## 사용자 요청으로 이월한 비교 기능 종합 검증 (2026-10-24)

- 마지막 Word 고정 범위 구현·부분 검수 이후, 현재 소스의 전체 build/unit/static·루트/하위 경로 실제 브라우저/출력·한영/테마/모바일/인쇄·광고/분석 종합 검사와 전체 후보 Astra·정식 감사는 실행하지 않았다. 정식 통합을 재개할 때 [최상위 인계 문서](../DIFFCHECKER_PORT_HANDOFF.ko.md)의 검증 순서와 실제 명령을 따른다. 기존 dist/subpath-site를 최신 결과로 쓰지 않는다. — Codx
- 임의 OOXML 추가 변형, 데스크톱 앱·라이선스 업무는 이 이식 작업의 새 필수 후속이 아니다. 검증된 하위 집합과 명시한 A5 차단을 유지한다. — Codx

## 비교 기능의 실제 환경 확인 (2026-10-24)

- **미확인 — 운영체제 폴더 선택 대화상자**: 읽기 전용 핸들과 비공개 원점 파일 시스템의 동작 검사는 실제 운영체제 선택창·권한 UI의 호환성을 대신하지 않는다. 최종 지원 브라우저에서 실제 선택창을 확인한다. — Codx
- **미확인 — S10 실제 모바일 광고 겹침**: QA에서는 모든 외부 공급자 요청을 차단하므로 실제 광고 overlay의 표시·겹침을 증명하지 않았다. 기존 광고 정책 검사 통과와 구분하며, 실제 공급자 환경의 별도 확인 대상으로 유지한다. — Codx

- **추가 측정 — 대표 환경·반복 관측**: Y5의 단일 기기·고정 입력 관측은 저사양·장시간 작업·반복 통계나 PDF 래스터 전체 메모리·ORB/PNG 자원 보유 시간을 일반화하지 않는다. 새로운 성능 주장이나 예산 조정이 필요할 때 해당 환경·구간을 별도 측정한다. — Codx

## FolioTrace 연말 파이프라인 대조 후속 (2026-10-13)

- 고정된 연말 수리/파이프라인 후보의 Astra 정식 검수와 Claude 감사·승인된 통합이 남았다. 이번 작업은 모델 호출·push·배포가 금지된 구현 제출이다. — Codx
- 2차 수리 후 불일치 25개, 허용오차 내 출처 충돌 1개, 공시 대상 근거 없음 7개, 이름 미해결 24개의 운영 근거·정확한 명칭 매핑을 후속 조사한다. 원문 진단 41건은 37보류·4검색0이며 불일치를 해소하지 않는다. `review-output/fty-pipeline-run2/REPORT.md`에 32개 행의 미입력 국민연금 대량보유 접수 69개 항목(고유 67접수)을 보유 판정 없이 나열했다. — Codx
- 방법론 SHA별 최초 관측 시각은 실제 버전 순서의 추론이다(FTY2-F07 비차단). 명시적 버전/해시 등록부 도입은 별도 범위로 남긴다. — Codx
- 20261011..20261013 corpus의 서로 다른 접수번호 41,200개가 지정 입력에 없고 20261010 corpus 모집단은 미확인이다. 파이프라인 담당이 후기 판정/정형 산출 범위를 보완한 뒤 이 입력을 갱신해 대조해야 한다. 이 수치는 보유 건수나 파이프라인 실행 상태가 아니다. 근거: `review-output/fty-pipeline-run/REPORT.md`. — Codx

## 문서 변환 지원 한계 (2026-10-08)

- HWP/HWPX **원본→PDF** 일괄 자동 저장·ZIP 포함은 제공하지 않는다. 브라우저 인쇄를 문서별로 안내하며, 닫기나 확인 버튼을 실제 저장 성공으로 판정하지 않는다. 자동 저장을 추가하려면 별도 입력 변환 엔진의 실증이 필요하다. PDF→HWPX 출력은 현재 배치 ZIP에서 제공한다. — Codx
- 복잡한 원본의 배치·수식·벡터·글꼴 완전 복원, 풍부한 HWPX 입력의 모든 구조, 일반 OCR 정확도는 작은 합성 표본으로 보장하지 않는다. 현 지원 범위와 재구성 한계를 제품에 표시했다. — Codx
- Bento `findTables()`는 OCR 글자가 있어도 스캔 표의 래스터 선·셀 경계를 항상 복원하지 못한다. 표를 찾지 못하면 빈 XLSX 성공 대신 원본 페이지별 실패 이유를 보여 준다. 이 범위를 넓히려면 스캔 셀 구획에 맞춘 별도 검증이 필요하다. — Codx
- 회전된 디지털 글자·색 도장과 OCR 글자 겹침·복잡한 벡터 그림이 있는 페이지는 원본 모양을 이미지로 보존할 수 있다. 그 페이지의 글자 편집 가능성은 출력하지 않으며, 흑백 그림과 글자 경계가 겹치는 경우 잉크 제거 품질은 아직 일반화되지 않았다. Stirling의 전체 표 셀 유형·다단 조판 분석은 이번 브라우저 포팅 범위에 들어오지 않았다. — Codx

## 상품 배너 T5 후속 (2026-10-05, R3a 수정 후보)

- R3a 수정 후보의 Astra 재검수·Claude 최종 판정이 남아 있다. 통과 후 M02 개발용 샘플/실제 데이터 구분 UI와 M03 나머지 위험 중심 UI 경계를 이어간다. T6·최종 통합 검사 및 기존 utilities 언어 전환 결함·ads S10 미확인은 이전 증거의 구분을 유지한다. — Codx **현재 상태: T5b·R3b 이후 해당 T5 후속 구현·검수는 완료. utilities N02는 2026-11-03 현 main 재현 안 됨(SOL-LANGSWITCH, 51경로 왕복 유실 0건)으로 갱신하며 ads S10은 열린 상태로 별도 유지한다.**

## FolioTrace 후속 (2026-09-26)

- **후속 — 원장·게시 검증**: 첫 build-only CI에서 DART 목록 9페이지, 262개 종목 가격 조회가 실행됐고 데이터 브랜치에 상태가 보존됐다. 이후 정규장 15:30 분봉과 과거 공시 사실 보강 코드를 수정했으므로 새 후보의 live 재실행·정식 검수·최종 배포 수치를 별도로 판정한다. 과거 전체 공시 coverage는 여전히 미검증이다. — Codx
- **후속 — 공시 정정·metadata 복구**: 원문 수량의 '주식등'과 의결권 주식량 일치만으로 보통주를 단정하지 않는다. 별도 종목코드·증권종류 근거가 없는 보유는 평가에서 제외한다. 정정 원접수번호의 확인된 연결·철회 확정은 추가 실증 대상이다(현행 공개 이벤트 `correctionOf`는 null). — Codx (2026-11-03 정리: metadata 미해결 596건은 9/26 MyTradingDesk 캐시 이관 상태의 접수 단위 집계로, 해당 옛 수집 경로가 `ebcd70b8`에서 삭제되고 2025년 말 엑셀 베이스로 전환돼 종결. 다일 추이는 10/22·11/3 스냅샷으로 확인.)
- **후속 — 특별 거래시간·기업행위 근거 확대**: 네이버 분봉은 날짜·종목이 맞는 KRX 확정 종가와 매 종목 대조하고, KRX 공식 연도별 휴장일을 조회한다. 특별 거래시간은 공식 발표로 확인한 날짜만 등록한다. 향후 변경 공지는 날짜별로 반영해야 하며, 확인되지 않은 세션의 가격이 공식 종가와 맞지 않으면 미평가한다. 상장주식 수가 접수일 이후 달라졌고 사건별 직접 근거가 없으면 해당 보유를 미평가로 남긴다. — Codx

## 번들 다이어트 (2026-09-21) — 종결

- **종결 — B1/B2/B3 착수하지 않음(사용자 결정)** — pdf-lib 중복 공급 제거는 게이트 위반 해소가 아니라 선택적 최적화다. 커밋 `0f02458`(사용자 결정)이 기본 번들 상한 5종을 `null`로 없애 정본이 조사 대상으로 삼은 `sharedJsGzip > +30720` 실패가 현재 소스에서 발생할 수 없고, 고정 비교 입력 3종도 소실됐다. 회수량 154,886 B(151.3 KiB, 앱 전체 배포 JS gzip의 2.61%)에 비해 21개 worker 회귀·PDF 바이트 동일성·캐시/해시 설계 비용(추정 5~10인일)이 커 착수하지 않기로 했다. 관련 문서 3건은 `docs/jobs/archive/`로 이동했다. — Claude 판정(Opus) / Codx 진단
- **비차단·작업 없음 — 번들 계측 사각지대** — `scripts/bundle-module-attribution.mjs`가 non-main module을 거부해 worker·public 산출물이 opaque로 빠진다. 다이어트와 무관한 계측 정확도 문제이며 현재 어떤 게이트도 이에 의존하지 않는다. — Claude

## 접근성 (2026-09-22)

- **후속 — PDF 정리의 모바일 출력 생성 버튼 대비** — 준비 완료한 출력 dialog에서 light-coral/light-mint × ko/en의 `새 PDF 만들기/Create PDF` 버튼이 기존3.54~3.73:1이다. 2차의 dialog 역할·포커스 수정과 구분하며, 전후 동일4노드·신규0으로 확인했다. 별도 국소 색상 수정 후보. 근거: `evidence/a11yfix2/dialog-validation.json` 및 `dialog-steady/`. — Codx (2026-11-04)
- **완료 — 대비·랜드마크 수정** — 자동 위반 64→28, `region` 57→0, `color-contrast` 위반 89→72, incomplete 1,858→1,807. 라이트 `--label-secondary` 한 단계 하향 + 미달 tertiary 소비자 4곳 교체(위계 보존), 320px 배지 겹침 수정, 상단바 `role=region`. — Muse 구현 / Claude 감사
- **기각 — 브랜드 카드 흰 글씨 대비** — 사용자 결정. 코랄을 눈에 띄게 어둡게 해야 하므로 채택하지 않았다. **수용된 부채이며 이후 감사에서 새 결함으로 보고하지 않는다.** 결정이 바뀌면 `docs/jobs/archive/TODO-STATUS-AUDIT-20260920.md` §F를 갱신한다. — Claude 판정
- **완료 — 접근성 감사기 언어 정합** — 루트 `/`를 ko-KR로 가정해 첫 페이지에서 중단되던 것을 제품 기본 언어(`en`)를 읽도록 고쳤다. 선언을 못 찾으면 실패하므로 조용히 어긋나지 않는다. — Codx 구현 / Claude 감사

## 시각·접근성 (2026-09-21)

- **완료 — 시각 회귀 스위트 복구** — 기준 이미지 249장 재생성(표본 12건 육안 판정 후), 구식 하네스 셀렉터 14건 수정, desktop-1920 viewport 추가(+4), mint family 연결(+4), VISUAL_SHARD 구현. N=274, shard 계약 합집합 274·교집합 0·누락 0·중복 0 총괄 재확인. `src/` 변경 0건. — Muse 구현 / Claude 감사
- **결정 대기 — 접근성 대비 수정** — 자동 위반 64건(146노드)과 incomplete 판정 실제 결함 514노드. 네 군데 색 문제가 반복 집계된 것이다. `--label-secondary` 한 단계 하향은 육안 차이 없이 다수를 해소하지만, 브랜드 카드 흰 글씨 문제는 코랄을 눈에 띄게 어둡게 해야 해 승인된 테마 변경에 해당한다. 사용자 판단 필요. — Claude 판정 / Codx 판정
- **접근성 감사기 선행 결함** — `tests/accessibility-audit.mjs`가 `/`를 ko-KR로 추정하나 현행 기본 언어는 `en`이라 첫 페이지에서 감사가 중단된다. 우회 없이는 접근성 검사가 헛돈다. 수정 필요. — Codx

## 스모크 기대값 드리프트 (2026-09-22)

오늘 하루에 발견한 **"검사가 조용히 헛도는" 네 번째·다섯 번째 사례**다. 제품 변경 뒤 검사 기대값이 따라오지 않아 첫 관문에서 막히고, 그 뒤 단언이 아예 실행되지 않는다. 실패가 쌓여도 CI 게이트가 아니라 아무도 보지 않았다.

- **완료 — excel-compare 타이틀 기대값** — `6eff3de`. `"Excel 비교·대사"` → `"Excel 비교"`. 제품이 맞고 검사가 낡았다(`92925e8`, 09-16). 관문 통과 후 **약 25개 단언이 실제로 실행·통과**했다. — Muse 구현 / Claude 판정
- **완료 — pdf-finish 준비 상태 안내 허용목록** — `3568b42`. alert 0건 기대를 의도된 안내 2건(`pdf-finish-link-preservation`, `pdf-finish-preview-disclaimer`) 명시 허용으로 바꿨다(`cea060b`, 09-08). 그 외 alert는 여전히 실패하고 허용목록 2건이 없어도 실패한다. 관문 통과 후 **약 50개 단언이 실제로 실행·통과**했다. — Muse 구현 / Claude 판정
- **남음 — excel-compare `assertB4Affordance`(`:243`)** — 검사가 `hover:bg-green-500/10!`를 요구하나 제품은 `eea9b1e`(액센트 정리, main 포함)의 `hover:bg-primary/10!`다. `origin/main`에서도 동일 실패. 제품이 맞고 검사가 낡았다. — Muse 보고 / Claude
- **남음 — pdf-finish `testFinishWorkflow`(`:663`)** — `[role='alert'].last()`가 글꼴 오류 대신 미리보기 고지를 잡는다. `6fd7c8a`(warning 기본 role=alert, main 포함) 이후 페이지 전역 `.last()` 선택자가 낡았다. `origin/main`에서도 동일 실패. lifecycle·golden 4종은 아직 미실행. — Muse 보고 / Claude
- **판정 — 배포를 막지 않는다** — 두 스모크는 CI 게이트가 아니며(옛 `deploy-pages.yml`[2026-10-25 삭제, 현재는 `deploy-site.yml`]은 build·unit·ads·static·video-hybrid만 강제) `origin/main`에서도 동일하게 실패한다. 즉 현재 운영도 이 검사를 통과한 적이 없다. 검증된 제품 수정을 기존 검사 부패 때문에 붙잡지 않는다. 복구는 별도 작업으로 이어간다. — Claude 판정(Opus)

## 화면 결함·기술 부채 묶음 (2026-09-22)

- **완료 — T8 사이드바 메뉴 경계 잘림**(사용자 직접 신고) — `858af6e`. 박스 겹침이 아니라 클리핑 경계가 행 가운데를 지나는 것이 원인. 단일 여백값으로 3높이를 동시에 만족할 수 없어 `margin-bottom: 8px` + `padding-bottom: 56px` + 하단 페이드 마스크 채택. — Muse 구현 / Claude 감사
- **잔여 위험 — ZIP 4GiB+ 크기 경계 미실측** — entry 수 경계(65,536)는 통과했으나 크기 경계는 실측하지 않았다. — Codx

## 모바일 셸 (2026-09-21)

- **완료 — 모바일 수평 오버플로 24px** — `.wl-topbar`의 1020px 이하 `margin: 0 -24px`를 820px 이하 규칙이 되돌리지 않아 390px에서 상단바 폭이 438px이 되고 문서가 24px 넘쳤다. 4개 도구 bottom 모바일 8/8이 전부 24px였고 운영 3페이지에서도 재현됐다. 820px 이하에 `margin: 0`을 추가해 해소했다. 390·900·1365px에서 오버플로 0을 확인했고 900px 구간의 음수 여백은 의도대로 유지된다. — Codx 진단 / Muse 구현 / Claude 감사
- **완료 — 라이트 테마 브랜드 워드마크 대비** — 모바일 브랜드는 텍스트가 아니라 `logo.svg` 이미지이고 워드마크가 `#FFFFFF`로 박혀 있어 라이트 테마의 밝은 헤더에서 묻혔다. 워드마크만 `#18181B`로 바꾼 `public/logo-light.svg`를 추가해 라이트 2종에서만 교체한다. 4테마 실측 대비 라이트 16.86:1 · 다크 17.26:1. 언어 선택 화면은 이미지에 `background: #111118` 어두운 타일이 깔려 있어(`global.css:132`) 양 테마 모두 18.80:1이므로 교체 대상이 아니다. — Muse 구현·반박 / Claude 감사

## AdSense 재검토 후속 (2026-09-20)

- **완료 — 기존 unit 실패 잔여 4건 해소** — `p1b-components` 3건은 승인된 현행 컴포넌트 계약을 놓친 낡은 단언으로 판정해 갱신했고, `ui-legacy-isolation` 1건은 유효한 Tailwind checkbox utility를 동등한 arbitrary utility로 치환했다. 최종 통합 전체 unit 605/605, 실패 0을 확인했다. — Codx
- **ToolCard 제목 h2/h3 결정 대기** — 제품과 테스트는 모두 `h2`이나 정본 `ui-theme-redesign-20260907:159`는 `h3`이고 `c5b64f6`에서 회귀가 유입됐다. 제품·테스트 중 어느 계약을 고칠지 사용자 결정을 기다린다. — Claude 판정 / Codx 확인
- **완료 — Muse 새 worktree 부트스트랩 정지 원인 조사** — 원인은 stdin이 닫히지 않는 소켓/파이프였다(정지 프로세스의 fd 0이 socket, epoll 등록, `ep_poll` 대기). `< /dev/null`을 붙이면 7초 만에 세션이 생성된다. DB 크기와 inotify 한도 고갈 가설은 모두 기각했다. 런북 반영 `7fb3290`, 상세 `docs/review-notes.md` 2026-09-21. — Claude 판정(Opus) / Muse 반영
- **완료 — PdfComparePage 가이드 미연결** — `PdfComparePage`에 기존 `pdfCompare` 가이드를 연결해 한·영 사용법 안내와 FAQ 3개를 런타임에 표시한다. — Codx
- **Office Editor 랜딩 가이드의 `?guide=1` 한정 노출** — 일반 랜딩은 `/tools/office-editor/app/`으로 즉시 이동하고 편집기에서 안내 링크로 돌아온 `?guide=1`일 때만 랜딩 가이드가 보인다. 의도와 발견 가능성을 별도 판정한다. — Codx
- **완료 — S5 도구 로딩 실패 시 광고 제외 오류 페이지 이동** — Auto ads 초기화 API 부재 이유로 광고 없는 독립 오류 문서로의 전체 문서 이동으로 구현했다. 첫 시도 1·재로드 1, 최종 광고 0 실측. — Codx
- **S10 모바일 overlay 이번 범위 제외** — 사용자 판단에 따라 2026-09-21 배포에서 제외. 실제 광고 overlay를 만들려면 정확 URL 스텁이 필요. — Claude 판정
- **S6 PDF Editor 루트 SPA 이동** — `/tools/pdf-editor/merge` 정확 링크 부재는 확인했고 PDF 루트 전환은 한국어·영어에서 검사했다. 후속으로 제외 하위 경로의 직접 링크가 생기면 해당 전환을 추가 검사한다. — Muse
- **AdSense 계정 설정 확인** — 계정의 페이지 제외 목록에 광고 전면 제외 4경로군과 격리 경로가 포함됐는지, 사이트 수준 Auto ads 설정과 실제 노출 표본이 코드 정책과 일치하는지 확인한다. — Muse
- **Codex worktree 신뢰 등록 정리** — 작업을 위해 `~/.codex/config.toml`에 추가한 `wt-adsense-guides`, `wt-adsense-adtest`, `wt-adsense-integration` 신뢰 등록 3줄은 관련 worktree 작업 종료 뒤 제거한다. — Codx
- **완료 — S9 보호 가드 광고 제외 경로 문서 교체 — 2026-09-21** — 앱 확인창에서 승인한 동일 이동을 `beforeunload`가 다시 차단한 것이 원인이었다. 승인 intent를 출발 URL·작업 세대에 한정해 재차단을 건너뛰되, 승인 없는 새로고침·닫기 보호는 유지했다. — Claude 판정(Opus) / Codx 확인
- **완료 — 데스크톱 `.bottom-tabs` 노출** — 전역 기본값을 `display: none`으로 두고 기존 모바일 미디어 쿼리의 3열 `display: grid`를 유지했다. 통합 production 화면에서 1365×900 숨김과 412×839 3열 표시를 재확인했다. — Codx
- **완료 — 광고 스모크 빌드 출처 메타데이터 오기** — 하드코딩 문구를 제거하고 실행 시점의 `runHead`와 `distMtime`을 구분해 기록한다. — Muse
- **완료 — 광고 스모크 판별·네트워크 단언 보강** — 기대 실패의 타입·코드·정확한 메시지를 함께 검사하고 S5·판별 경로에서도 네트워크 단언을 독립 실행하며 실패 결과의 계수를 보존한다. — Muse

## UI 시각 기준선 재설정


## Excel 비교 — 중복키·머리글 후속

- **완료 — BL01 마지막 더보기 소진 뒤 초점 목적지** (2026-09-22, `5139c75`. 중복 목록 한정 정책, ko/en 완료 문구 추가) — 151행 중복 목록을 키보드로 펼친 뒤 마지막 50개를 불러오면 버튼이 DOM에서 사라지고 초점이 `BODY`로 이동했다(ko/en × light/dark **4/4**). `/ko/tools/excel-compare/`에서 151행 동일 키 CSV 두 파일 → 키 비교 → 중복 목록 → 마지막 더보기를 Tab·Enter로 실행해 재현한다. 다음 Tab의 목적지와 완료 안내 정책을 별도 접근성 계약으로 정한다. — Codx
- **종결(수정 없음) — BL02 긴 시트명 잘림** (2026-09-22. `guides.json`에 대상 문자열 0건, 390px·dark 직접 열람 넘침 0. 기존 변경으로 해소) — Excel 비교 안내 카드의 연속 영문 시트명 문자열이 카드 오른쪽에서 잘리는 상태가 기존 시각 기준선과 S2/S3 캡처에 동일하게 남아 있다. `/ko/tools/excel-compare/` guide를 모바일 폭 390px·dark에서 최하단까지 내려 재현하며, 표현 또는 줄바꿈을 고친 뒤 해당 기준선만 갱신한다. — Codx
- **완료 — BL03 desktop 컨트롤 상단 가림** (2026-09-22, `0899636`. 죽은 `.app-topbar` 셀렉터가 원인. 셸 개별 평가 + 뷰포트 fallback) — 1365×900 한국어 사용자 1행/B 결과에서 오른쪽 목록을 Enter로 펼친 뒤 toggle rect가 `y=-19.53125..24.46875`, 전후 Tab·Shift+Tab 상태는 `y=0.46875`로 3px 초점 링 여백이 부족했다. 중앙 hit는 보이지만 라벨·링 일부가 잘리며 두 테마 **6상태**가 이전 커밋과 동일하다. `/ko/tools/excel-compare/` 결과에서 오른쪽 toggle을 키보드로 열고 앞뒤로 이동해 재현한다. 고정 shell이 없는 desktop 상단 회피 정책은 UI 재설계 계획에서 정한다. — Codx
- **완료 — BL05 결과 검색 입력 헤더 가림** (2026-09-22, `0cded0d`. 입력이 보정 대상에 미등록이 원인. 활성 요소와 링 측정 분리) — 390×844 결과 준비 단계에서 검색 입력 중앙 가시성은 전체 72상태 중 **71/72**였고, 실제 Tab 진입 시 ko/en `y=44.5/44.53125`, header bottom `63`, 중앙 hit가 `HEADER`였다. `/ko/tools/excel-compare/` 또는 `/en/tools/excel-compare/`에서 결과를 만든 뒤 검색 입력까지 Tab으로 이동해 재현한다. 고정 chrome 회피 범위를 검색 입력까지 넓힐지는 UI 재설계 계획에서 정한다. — Codx
- **BL06 · Excel cleaner의 오류 셀 재출력 타입 — 중간 우선순위(spreadsheet-core 소비자)** — BL04 부모 `d9c79b7`부터 cleaner 모델은 공용 셀의 `type`을 투영하지 않고 출력도 `value/cachedValue`만으로 작성해 실제 오류 표시값을 일반 문자열로 재출력한다. BL04는 머리글 감지 정확도를 위한 입력 모델 교정이므로 출력 정책까지 넓히지 않았다. 실제 오류와 같은 literal 문자열을 구별해 정리 결과의 오류 셀 타입을 보존할지 별도 출력 계약과 roundtrip oracle로 정한다. — Codx

## 비디오 스튜디오

- **B단계 10단계(확대) 후속** — 비디오 성능·용량 정본 계획(2026-09-02, 1~9단계 완료·아카이브) 잔여: ① WebM 스트리밍 확대(mediabunny 기각으로 보류 — 채택 조건은 대안 demuxer/muxer의 WebM roundtrip 검증) ② 브라우저 네이티브 AudioEncoder 지원 범위 확대(미지원 AAC는 현재 FFmpeg 오디오-only 하이브리드로 처리) ③ copy 모드의 비호환 음향을 FFmpeg로 변환해 영상 패스스루와 합치는 별도 하이브리드(현재는 품질을 암묵 변경하지 않고 job별 음향 제외만 제안). 근거·기각 이력은 `docs/review-notes.md` 참조.
- **A5 · 속도/품질 토글(코덱별 전문가 옵션)** — 계획 왕복에서 제외 확정(VideoTask에 preset 필드 부재·VP9는 cpu-used 체계·CRF/비트레이트 모드별 의미 상이·UI 복잡도). B3 하드웨어 인코딩 배포로 필요성 재평가 후 설계.

- **T4 · 모든 concat 입력의 FPS 확인 실패 시 30fps 강제 폴백** — 4차 신뢰성 작업지시서 후속. 현행 `src/features/video-studio/videoEncoding.ts`의 `resolveConcatFrameRate(frameRates, fallback = 30)`과 `tests/unit/video-encoding.test.ts`의 `[undefined, 0, NaN] -> 30` 단언을 `rg -n 'resolveConcatFrameRate|fallback = 30|undefined, 0, Number.NaN' ...`로 확인했다. 60fps 원본이 모두 probe 실패하면 30fps로 낮아질 수 있다. FPS 필터를 단순 생략하는 안은 재인코딩 세그먼트의 stream-copy 결합 호환성을 깨므로 기각하며, 입력 스트림에서 신뢰 가능한 레이트를 추가 취득하거나 사용자 선택 공통 레이트로 정규화하는 방식이 필요하다. — Codx

## 문서 비교

- **도달 불가 컴포넌트 3종 제거 검토** — P2 UI 마이그레이션 정본(`p2-tool-migration-20260904.md` 확정 2항)에서 **P2 명시 제외 + backlog 이관**으로 판정한 항목. `/word-compare`·`/hwp-compare`는 독립 route 가 아니라 `/document-compare` redirect 이므로 아래 3개 파일은 route 도달성이 없다. 전환 비용을 들일 이유가 없어 P2 에서 손대지 않았고, 제거는 별도 단위로 남긴다.
  - 대상(2026-09-05 Claude 실측 — `grep -rn "<심볼>" src/ --include=*.ts --include=*.tsx`): `src/features/word-compare/WordComparePage.tsx`(318줄) · `src/features/hwp-compare/HwpComparePage.tsx`(231줄) · `src/features/hwp-compare/HwpCompareResultPage.tsx`(19줄). 세 심볼 모두 자기 `export` 선언 외 **참조 0건**.
  - **제거 시 주의 — 같은 디렉터리에 살아 있는 모듈이 섞여 있다.** `WordCompareResultPage`(448줄·외부 참조 1건)는 `DocumentCompareResultPage` 가 소비하는 **현역**이고, `wordWorkerClient`·`hwpWorkerClient`(각 외부 참조 2건)도 현역이다. `wordCompareSession`·`hwpCompareSession`·`docModel`·`word.worker`·`hwp-compare.worker`·`*.py` 는 디렉터리 **외부** 참조가 0이지만 내부에서 현역 client 체인에 물려 있을 수 있으므로, 페이지 3개를 지운 직후 그 자리에서 각 모듈의 남은 사용처를 다시 grep 해 죽은 것만 함께 정리한다(「사용처를 하나 지우면 그 자리에서 다른 사용처를 grep 한다」). 디렉터리 통째 삭제 금지.
  - 완료 기준: `npm run build` · `npx tsc -b` · `TEST_SCOPE=word npm run test:browser` · `TEST_ONLY_HWP=1 npm run test:new-tools` 통과 + `/word-compare`·`/hwp-compare` redirect 동작 유지. — Claude

## ZIP 출력 공통

> 두 항목 모두 **U5 파일 정리 선조사(2026-09-05)에서 나왔으나 U5 와 무관하게 성립하는 저장소 결함 후보**다. U5 는 2026-09-06 사용자 결정으로 로드맵에서 드랍됐고, 이 둘만 살려 이관했다. — Claude

- **완료 — ZIP 결과 쓰기 4경로 공통화** (2026-09-22, `aff608b`. DOCX·읽기 3경로는 계약 상이로 제외, ExcelJS 간접 의존은 잔존. unzip·jar 한글 및 65,536 entry ZIP64 통과, 4GiB+ 경계 미실측) — 이 저장소는 ZIP 라이브러리 **두 개**를 함께 의존한다: `@zip.js/zip.js` 2.9.0(공용 C3 결과 ZIP 경로)과 `jszip` ^3.10.1(PDF `pdf-to-image` 경로가 소비 — `PdfImagePanel.tsx:149-164`). 실측 근거: `grep -n "zip.js\|jszip" package.json`(53행·72행). **두 경로의 한글 파일명 처리와 대용량(zip64) 동작이 갈릴 수 있다.** 두 구현을 같은 입력으로 실측 대조하고 C3 로 단일화할지 판정한다. 단일화되면 번들도 줄어든다 — **2026-09-06 사용자 지시 「QR 번들 무게 축소」와 같은 표면이므로 함께 재는 것이 효율적이다.** — Claude
- **`zipArchive.ts` 유니코드 파일명 옵션 미명시** — `src/utils/zipArchive.ts:49-56` 의 `zipWriter.add(...)` 는 `bufferedWrite`·`dataDescriptor`·`level`·`signal`·`zip64`·`onprogress` 만 넘기고 **`useUnicodeFileNames` 를 명시하지 않아 라이브러리 기본값에 의존**한다. 한글 파일명이 포함된 결과 ZIP 에서 동작이 라이브러리 버전에 따라 바뀔 수 있으므로 방어적으로 명시한다. 완료 기준: 한글 파일명 fixture 로 생성한 ZIP 을 최소 두 해제 도구(예: OS 기본 · `unzip`)에서 이름 보존 확인. — Claude

## PDF 글꼴 임베드 후속

- **완료 — Ghostscript 한글 tofu** (2026-09-22, `d5f3112`. CID-keyed CFF 전용 임베더로 해결, 의존성 패치 없음. 총괄 렌더 확인) — S2b QR 글꼴 감량 렌더 대조에서 전체·빌드 타임 subset OTF 모두 Poppler는 정상 렌더했지만 Ghostscript는 원본 전체 OTF부터 한글을 tofu로 표시했다. PDF의 `FontFile2` descriptor에 `OTTO` CFF 스트림이 들어가는 pdf-lib/fontkit 임베드 경계의 기존 결함이며 S2b subset 회귀가 아니다. U4 공용 PDF 글꼴 임베드 경계를 구현할 때 descriptor/stream 조합을 교정하고 GS·Poppler 동시 렌더로 판정한다. — Codx
- **완료 — PDF 텍스트 추출 불일치** (2026-09-22, `d5f3112`. 원문별 ToUnicode + CID 기준 `/W` 생성. 총괄 왕복 5/5 일치 확인) — 같은 S2b fixture에서 PDF.js는 전체 OTF와 subset OTF 사이 추출 결과는 동일했지만 일부 공백을 `堺`로, shaping 숫자를 한자로 추출하는 기존 오류가 남았다. S2b의 oracle은 전체 대비 불변이고 입력 문자열과의 완전 일치는 범위 밖이다. U4에서 ToUnicode/CMap 생성 경계를 다룰 때 입력 문자열 일치 fixture를 별도 추가한다. — Codx

## PDF 생성 라이브러리 중복 배포

- **main·legacy worker의 `pdf-lib` 단일화** — U4-6 번들 조사에서 main 그래프의 `pdf-lib` 귀속 **118,977B**와 legacy `pdf.worker` **219,622B** 내부의 별도 `pdf-lib` 번들을 확인했다. 목표는 중복 실행 경계를 하나로 합쳐 **순감량 80~120KB**를 확보하는 것이다. 예상 비용은 설계·연결 **3~6인일**, 회귀·계측 **2~4인일**, 합계 **5~10인일**이다. U4-6의 app/PDF route 상한 상향은 이 부채를 해결한 것이 아니라 U4 완료 뒤 구조 변경으로 미룬 결정이다. — Codx

## 공용 데스크톱 언어 전환 UI

- **종결(재현 불가) — 고정 언어 스위처 가림** (2026-09-22. 독립 fixed 스위처가 현행에 없음. 관찰되는 것은 고정 헤더 아래 정상 통과) — 1365px에서 PDF 마무리 화면을 아래로 스크롤하면 우상단 KO/EN 스위처가 모드 탭의 마지막 라벨 위에 겹친다. `src/styles/global.css`의 fixed 위치는 `76ceecc7`부터 존재하며 U4에서 바뀌지 않았다. 최상단에서는 탭이 보이고 이번 UI 추가 회귀는 아니다. UI 재설계에서 공용 고정 요소의 가림 정책으로 함께 처리한다. 실제 이미지 `/tmp/worklazy-u4-mergegate3/f5-audit/ko-light-1365-combined.png`, Claude 직접 열람 및 Codx source blame 교차. — Codx
- **PDF 마무리 한국어 제목·탭의 단어 중간 줄바꿈 — U4 cosmetic P3** — 320/821px에서 제목이나 `머리글·바닥글` 탭의 마지막 글자가 다음 줄에 놓인다. 821px 탭 라벨 폭은 77.75px이며 두 줄이다. U4 라벨·4개 탭 구성의 영향이므로 부모 `d3a8d89`와 같다는 이유로 U4 이전 부채라고 부르지 않는다. UI 재설계에서 한국어 줄바꿈·폭 정책으로 묶어 처리한다. 개인정보 안내 pill의 같은 현상은 공용 CSS는 U4 이전이지만 F5 제목의 인접 폭 영향이 있어 정확한 증상 귀속은 미확정이다. P2 도장 공지의 제목 수직 붕괴는 이 항목으로 미루지 않고 U4에서 별도 수리했다. 근거 `/tmp/worklazy-u4-audit3/visual-dom-initial-final/REPORT.md`. — Codx

## PDF 마무리 확장 동작의 레이아웃 안정성

- **업로드부터 다운로드까지 확장 구간 CLS — P3, 도입 시점 미확정** — 최초 U4 배포 뒤 합성 두 파일을 프로그램으로 선택하고 PDF·ZIP 다운로드까지 누적하면 CLS **0.189165**, 최대 단일 이동 **0.172023**이었다. 기존 초기 표시 게이트와 측정 구간이 달라 같은 목표 통과/실패로 혼합하지 않는다. 초기 표시 검증은 별도로 통과했다. 실제 사용자 입력의 `hadRecentInput`과 완료·결과 카드 삽입을 포함한 측정 계약을 UI 재설계에서 정하고 부모 실증으로 도입 시점을 확인한다. 이전 결함이라고 단정하지 않는다. 근거 `/tmp/worklazy-u4-mergegate4/live-asset-attribution/audit/CLS-SCOPE.md`, `live-network-ci-initial/rendering-ko-finish.json`. — Codx

## PDF 마무리 API 후속

- **머리글·바닥글 파일명 축약 길이 직접 지정 — 사용자 요청, 비긴급 P3** — 2026-09-09 사용자가 긴 파일명을 자동 말줄임으로 줄이면 파일 식별 의미가 약해진다고 지적했다. 머리글·바닥글에 넣는 파일명의 축약 기준을 숫자로 입력받고, 지정한 글자 수 이상인 경우 줄이는 옵션을 요청했다. 진행 중 작업 사이의 PDF 관련 후속으로 편성하며 기존 작업 순서를 대체하거나 종결된 U4를 다시 미완료로 바꾸지 않는다. 미리보기와 생성 PDF에 같은 기준을 적용하고, 사용자가 지정한 길이와 실제 배치 폭이 충돌할 때의 표시 방법은 함께 검토한다. 현재는 요청 기록이며 상세 정본·구현·배포 완료가 아니다. — Codx
  - 2026-09-14 정본 v1대로 구현·검증 완료(빈 값=문자 축약 없이 폭 맞춤, N이상=앞N−1그래핌+말줄임). 배포·라이브 확인은 U9 묶음과 함께 이월한다. — Muse
- **상위 텍스트 옵션의 조용한 누락 — 기존 P2 API 계약** — `PdfFinishDecorationOptions`가 상위 텍스트 필드를 유지하면서 `textDecorations`는 optional인 계약(`src/features/pdf-editor/finish/engine.ts:151-173`) 때문에, 배열을 생략하고 stamp 또는 image watermark를 함께 넘기면 `engine.ts:785-788`에서 상위 텍스트 장식이 조용히 버려진다. 부모 revision도 같고 제품 UI는 항상 명시적 `textDecorations` 배열을 넘겨 안전하므로 이번 회귀 수리 범위에는 넣지 않았다. 후속 수리는 ① typed/discriminated 계약과 문서로 호출 의미를 명시하거나 ② 모호한 입력을 오류로 거부하는 두 방향을 비교한다. 단순 fallback은 기존 stamp-only 호출에 placeholder 텍스트를 새로 출력할 수 있어 기각한다. — Codx

## PDF 이미지 평탄화 후속

- **`save()` 할당 실패의 부분 결과 비노출 — 기존 P2** — `PDFDocument.save()`가 두 번째 파일에서 할당 오류를 내면 부모와 U4-7 대상 모두 완료된 첫 파일을 `partialResults`로 공개하지 않는다. U4-7 fix-1에서 수리한 새 `Blob()` 할당 경로와 별개이며, 일반 저장·직렬화 예외를 완료 결과 보존 계약에 연결하는 후속 작업이 필요하다. — Codx
- **스모크 preview의 점유 포트 오인 — 기존 P2 하네스 부채** — `startPreview()`가 자신이 띄운 child의 listen 성공을 확인하기 전에 같은 포트의 HTTP 응답만 보고 준비 완료로 판정할 수 있다. 자기 서버 식별/준비 로그를 확인하고 점유 포트는 즉시 실패시키는 계약이 필요하다. fix-1 검증은 4270을 건드리지 않고 4275~4279의 점유 확인·고정 `--strictPort` 서버만 썼다. — Codx
- **scoped browser 완료 문구 과장 — 기존 P3** — `TEST_SCOPE=pdf` 실행도 마지막 문구가 Excel·Word까지 완료했다고 열거한다. 실제 분기와 종료 코드만 PDF 범위 증거로 사용했으며, 후속에서 선택된 scope만 출력하게 한다. — Codx
- **공용 UI incomplete — 기존 UI 재설계 부채** — U4-7의 125건과 전량 통합 감사의 표본 수를 혼합하지 않는다. 2026-09-09 통합 QA 43페이지에서는 상속 incomplete **1,973건**을 보존했고 F2/F3/F4a/F4b 소유 미확인은 0이었다. 별도 F5 8환경×5상태의 토글·파일 목록·다중 결과 원자료에서도 위반·incomplete는 0이다. 공용 미확인을 성공으로 재분류하지 않고 UI 재설계에서 표시·스크롤 상태를 포함해 해결한다. 근거 `/tmp/worklazy-u4-mergegate3/a11y.json`, `f5-audit/summary.json`. — Codx
- **실기기 모바일 메모리 한계 미교정** — 벤치는 Pixel 7 에뮬레이션의 호스트 CDP heap만 측정했고 native/renderer/canvas 및 물리 기기 한계는 측정하지 않았다. 150 DPI는 사전 명시된 미교정 폴백이며, 실기기 확보 뒤 별도 교정하기 전에는 “기기 한계의 50% 안전 마진 달성”을 주장하지 않는다. — Codx
- **PDF 마무리 heartbeat 목표 미달·PDF.js 의존 패치 유지 — 기존 P2** — 2026-09-09 같은 하네스·합성 12입력×3회 대조에서 부모 `d3a8d89`와 통합 `0f02458` 모두 **20/36회**가 실행별 200ms 목표를 넘었다(최대 **329.4/333.8ms**). 미달은 128MiB 저장에 한정되지 않고 사전 검사·미리보기와 생성에서도 재현된다. PDF 제품 소스는 두 후보 사이 동일하며 취소 응답 **111.1/159.5ms**, 늦은 결과 0·재시도·폴백은 통과했다. 중앙값·취소 가능성을 근거로 heartbeat 목표를 통과로 바꾸지 않는다. 원자료 `/tmp/worklazy-u4-performance-attribution/{parent,candidate-rerun}.json`; 첫 통합 재실행은 30/36에서 SIGTERM으로 중단됐으므로 별도 실패 로그로 보존했다. 의존 갱신 때 exact/lock/4SHA·4빌드×180렌더·음성·worker/fallback 검증을 다시 수행한다. — Codx
- **접근성 요약 검사기의 빈 근거 수용 — 기존 P2 하네스 부채** — 통합 감사 독립 음성 대조에서 `targets:[""]`, `reasons:[""]`, 전체 `incomplete:[]` 치환은 요약 검사가 거부하지 못했다. 요약 함수는 부모 `d3a8d89`와 byte 동일하고 실제 브라우저 수집기는 빈 target·reason을 검사하므로 이번 원자료가 지워졌다는 뜻은 아니다. 수집·요약 사이 완전성 계약과 빈 문자열 거부를 별도 보강한다. 재현 `/tmp/worklazy-u4-audit3/a11y/results.json`; 현행 원자료의 상속 1,973건은 그대로 보존했다. — Codx

## UI 색 체계 — 도구 고유색 축소·컨트롤 단일 primary

> 2026-09-06 사용자 결정("1안"). shadcn 전환 후 스위치·버튼·포커스 링은 `--primary`(인디고) 단일인데 도구 고유색(아이콘 타일 6색)이 따로 놀아 어색하다는 사용자 소견. **`!계획!` 미발동 — 결정 기록만.** UI 변경이므로 「배포 전 로컬 시각 검수」·시각 기준선 갱신 수반. 로드맵(`roadmap-completion-20260906`) 순서상 S2 이후 별도 단위 후보. — Claude

- **컨트롤은 인디고 단일 유지**: 스위치·버튼·체크·포커스 링은 `--primary` 그대로(흰 글자 대비 8.09:1 검증 완료). 도구별 `--primary` 덧씌우기(도구 테마)는 **기각** — 6색 대비 재검증·시각 기준선 175장 전면 갱신·통일성 역행.
- **도구색은 "분류 표지"로 축소**: 아이콘 타일(`src/components/toolAccentStyles.ts` — 도구 카드·사이드바만 소비, 2026-09-06 grep 실측)·헤더 눈썹 라벨·상단 얇은 선 정도. 현행 `*-100` 배경/`*-700` 글자 톤 유지.
- **색 수 6→4**: `toolRegistry.ts` 카테고리 accent(documents·media·text-data 등)를 도구가 상속. **blue 계열은 인디고 primary 와 겹쳐 교체**(회색 계열 또는 teal 후보).
- 완료 기준 후보: 시각 회귀 2로케일 기준선 갱신 사유 기록 · a11y `A11Y_MAX_TOTAL=0` · 카드/사이드바 색 매핑 unit · Gemini 로컬 시각 검수.

## 공용 UI 접근성 대비·ARIA — UI 전면 재설계 게이트

- **U4-4(F2) 접근성 감사에서 분리된 기존 결함** — 2026-09-07 1차 수동 판정은 color-contrast incomplete **930노드** 중 기준 이상 743·미달 183·미확정 4, aria-prohibited-attr incomplete **3노드**였다. 미달은 home 0, document-compare 15, tools 28, excel-compare 11, pdf-editor 16, pdf-finish-ko/en/watermark 각 18, pdf-finish-mobile 12, hwp-editor 14, home-mobile 9, tools-mobile 24였다. 대표 원인은 footer 정책 링크·광고 설정·copyright **2.839:1**, sidebar caption **2.954~2.991:1**, 로컬 처리 안내 약 **2.899~3.110:1**, 검색 placeholder **2.524:1**, 도구 수 **2.341:1**이며 공용 AppShell/global CSS/ToolsPage/HWP host 소유다. F2 blob 변경 전부터 존재하므로 워터마크 단계에서 전역 팔레트를 임의 수정하지 않는다.
- **귀속과 완료 조건** — `docs/jobs/todo/ui-theme-redesign-20260907.md`가 채택한 WCAG 보정 팔레트·대비 게이트에서 위 노드와 역할 없는 `div aria-label` 3건을 처리한다. U4-4 fix-1 하네스는 incomplete의 target·reason을 삭제하지 않고 F2/공용 소유를 분리하며, 현행 QA 실측은 **공용 상속 925·F2 신규 0**이다. 925를 pass로 바꾸거나 광역 예외 처리하지 않는다. UI 계획 완료 시 표시/스크롤 상태를 포함해 다시 측정하고 미확정 4건도 판정한다. — Codx

## 배포 후 라이브 감사에서 나온 기존 결함 (S0 배포 2026-09-06 — S0 회귀 아님)

- **HWP 편집기 iframe 접근성 위반 4노드** — 벤더 rhwp Studio 내부(`#sb-message` 대비 3.54 · `#style-name`·`#font-lang`·`#font-name` 는 title 만으로 라벨). `4d0bae9` 에서도 동일 검출(`/tmp/worklazy-s0/deploy/logs/baseline-findings-full.log`). `public/vendor/**` 라 저장소에서 수정 불가 — 선택지: ① 상류(rhwp) 이슈 제기 ② 접근성 게이트에서 벤더 iframe 을 목적·소유자 명시 예외로 분리(광역 wildcard 금지). S2-H ③ 에서 결정. — Claude
- **rhwp 0.8.7 재검사 — 미해결** (2026-10-07, document-converters 작업본) — iframe 예외를 제외하지 않은 axe 실제 검사에서 `#sb-message` 대비 1개, title-only 라벨 `#style-name`·`#font-lang`·`#font-name`·`#font-size`·`#linespacing-select` 5개, 총 serious 6노드를 확인했다. 과거 4노드 기록을 0.8.7 통과로 재사용하지 않는다. 기존 iframe 면제를 확대 승인하거나 이 6개를 해결했다고 표시하지 않는다. 동일 axe·1280×800 호스트·960×720 iframe·빈 문서로 0.8.6과 0.8.7을 대조하니 rule ID와 여섯 target 모두 같았다(신규 회귀 0, 미해결 6). 과거 4노드와 조건이 달라 단순 증가량을 회귀로 해석하지 않는다. 원자료는 `docs/jobs/todo/document-converters-20261007/rhwp-0.8.6-a11y-ab.json`, `rhwp-0.8.7-a11y-ab.json`, `rhwp-087-a11y-raw.json`; 최종 공개 전 검수에서 처리해야 한다. — Codx
- **모바일 하단 탭 라벨 대비 3.06**(`.bottom-tab > span`, `#909098`/`#fbfbfd`, 12px bold, 기준 4.5) — P2 셸 스타일, S0 diff 무관. 색 토큰 1개 조정 + 시각 기준선 갱신. 접근성 하네스가 mobile viewport 를 재지 않아 게이트에 안 걸렸다 — S2-H ③ 페이지·viewport 등록 확장과 함께. — Claude
- **없는 경로의 인앱 NotFound 뷰 부재** — 정적 `404.html`(noindex)·HTTP 404 는 정상이나 앱 기동 후 React Router 가 홈을 렌더한다(`4d0bae9` 동일). SEO 영향 없음(HTTP 404 유지). 제품 결정 필요: 홈 폴백 유지 vs ko/en NotFound 뷰 신설(신설 시 「현지화·SEO·AdSense 동시 검토」·시각 회귀 추가). — Claude
## U6 검수에서 확인한 공용 UI 후속

- **해소됨 — EN320 동의 배너의 오른쪽 동작 잘림** — 과거 `Accept and continue` 버튼 right 381.97px 문제는 `277276a`의 자체 광고·분석 동의 배너 삭제로 대상 자체가 제거됐다. 2026-11-03 기준 `fdc9d01` 소스와 320px 한영·라이트/다크 6개 도구 DOM(24조합)에서 기존 배너·버튼 0개를 확인했다. 배너를 다시 만들거나 제품 동의 정책을 바꾸지 않는다. 현재 근거: `SOL-SHELL-A11Y-REPORT.md`, 로컬 작업 증거 `scratch/shell-a11y/mobile-stable/`; 과거 근거 `/tmp/worklazy-u6-preflight/final-ui-review/inherited-comparison.json`.
- **고정 데스크톱 언어 스위처의 배경 의존 대비** — U6 결과 화면의 안정 axe에서 기존 translucent LanguageSwitcher 대비 1건이 남았다. UI v3에서 이 공용 control의 실제 배경별 대비를 고정한다. U6에서 전역 스위처 색을 임의 변경하지 않는다.

- Codx(Sol), T6a: Product banner image-status callbacks clear a previously visible clipboard failure notice in ProductBannerPage dispatch (present at df460ee). Controlled held-image reproduction is recorded in T6a evidence. Scope a UI repair and retain the failing case before requiring three consecutive core/CI passes. **현재 상태: edd1872에서 수리하고 R4a 검수 통과로 해소.**

- 2026-10-05 Codx(Sol), T6c: 광고 S4는 기준선 cc20462와 후보의 동일 조건 실행에서 모두 chunk 404 1회로 실패했다(기대 >=2 유지). 재로드 요청 뒤 TextMerger 재로드 문서 커밋 없이 /ko/error/가 커밋되는 기존 복구/오류 문서 전환 경쟁이다. 당시 공유 복구 코드 수리는 범위 밖이었고 광고 필수 게이트 PASS가 아니었다. 근거: product-banner/evidence/T6c.md 및 tmp/T6c/s4-comparison.json. **현재 상태: 2026-11-03 현 main 재현 안 됨 — SOL-CHUNKRACE에서 동일 S4의 기존 단언을 유지한 20/20회 통과, 경쟁 0/20을 확인했다. 당시 실패 이력은 유지하며 모든 환경의 간헐 경쟁이 불가능하다는 뜻은 아니다.**
- 2026-10-05 Codx(Sol), T6c: S10은 스텁이 광고 오버레이를 렌더링하지 않아 실제 겹침 미검증이다. 자동화 운영 광고 호출은 유지 차단하고 실제 오버레이는 T7 운영 확인에 이월한다. analytics-2 자식의 호스트 전체 잔존 여부는 exec PID namespace 제약으로 미확인; 호스트 조회가 필요하다. lttng O_CREAT 2건의 배타 생성/파일 소유도 미확인이며 다음 선택적 WebKit 실행 전 경로 제약 진단을 이월한다.
- **현재 상태 — analytics-2 잔존 확인 해소**: 총괄의 호스트 전체 /proc 조회에서 잔존 0을 확인했고 T7 Astra가 `resolved_at_recorded_host_observation`으로 정식 수용했다. 종료 143의 원인은 미확인으로 유지하며 지속 감시를 주장하지 않는다. 근거: 로컬 작업 기록 docs/jobs/todo/product-banner/claude-evidence/R4c-M01/README.md (gitignored), 로컬 작업 기록 docs/jobs/todo/product-banner/logs/T7-final-review-result.json (gitignored). — Codx(Sol)
- **열림 — S10·lttng IPC**: 실제 모바일 광고 오버레이 겹침과 lttng O_CREAT 2건의 배타 생성/소유는 미확인으로 유지한다. 자동화의 운영 광고·분석 공급자 호출 차단도 유지한다. — Codx(Sol)
- **2026-11-03 현 main 재현 안 됨 — utilities N02**: SOL-LANGSWITCH에서 HWP 원래 절차와 정적 도구 51경로 왕복의 query/hash 유실 0건을 확인했다(원래 HWP 포함 총 52왕복). 제품 수정 없이 해소됨으로 보고됐으며 개발 서버 검사 범위다. 아래는 당시 실패 이력이다. 기존 HWP → 영어 전환에서 query/hash가 유실됐다. T7 utilities-r3는 당시 이 결함에서 실패했고 이후 순차 검사는 미실행이므로 당시 utilities 전체는 FAIL이었다. 별도 카탈로그 4건의 범위 PASS 재사용은 전체 utilities 통과가 아니다. 근거: 로컬 작업 기록 docs/jobs/todo/product-banner/logs/R4b-review-result.json (gitignored), 로컬 작업 기록 docs/jobs/todo/product-banner/logs/T7-final-review-result.json (gitignored). — Codx(Sol)

## 상품 배너 T7 비차단 이월 (2026-10-05)

- **b9f8cb9 검수 PASS·P3-1 후속 보정 — 200% 확대의 공통 고정 내비·헤더와 포커스 가림**: 2026-11-03 `fdc9d01`에서 실제 200% 확대/Tab·Shift+Tab 전수 측정으로 상품 배너 입력 포커스 13회 완전 가림을 재현했다. 공통 문서 `scroll-padding` 보정은 검수 PASS였고, main 병합 후 P3-1의 안내 제목 여백 중복을 제거해 위치 18/18·기존 안내 링크 26/26을 확인했다(`SOL-SHELL-A11Y-FIX1.md`). 결과와 남은 부분 겹침은 `SOL-SHELL-A11Y-REPORT.md` 및 `scratch/shell-a11y/`에 구분한다. 아래는 최초 이월 당시 근거다. 사이트 공통 하단 고정 내비 및 상단 헤더가 화면 하단 입력란을 가릴 수 있다. R4c-N02에서는 Tab 이동 시 입력란이 중앙으로 스크롤되고 키보드 편집·포인터 클릭·출력 반영이 가능했다. 조작 불가로 판정하지 않지만, 공통 셸의 모든 포커스 위치에 대해 가림(WCAG 2.4.11)을 전수 검증한 것은 아니다. 공통 셸 `scroll-padding` 등 후속 보정을 검토한다. 근거: 로컬 작업 기록 docs/jobs/todo/product-banner/logs/R4c-review-result.json (gitignored), 로컬 작업 기록 docs/jobs/todo/product-banner/work/tmp/T6c/runs/native-zoom-wWIVB3/generator-200-edit.png (gitignored), 로컬 작업 기록 docs/jobs/todo/product-banner/research/gemini-visual-T6c-native-out.md (gitignored). — Codx(Sol)
- **열림 — 실제 이미지 로드 2/3·원격 서버 거부**: 실제 샘플 3행 중 2행 이미지는 정상 로드됐고 2번 행 이미지는 원격 HTTP 403 `text/html` 응답으로 브라우저 ORB에 차단됐다. 출력은 HTML·iframe 각각 상품별 대체 표시 1건이며 원본 링크·이미지 주소·순서 보존은 정상이다. 서버 거부 사유는 미확인으로 유지하며 이 외부 호스트 한계를 제품 차단으로 재분류하지 않는다. 실제 URL·상품 정보는 기록하지 않는다. 근거: 로컬 작업 기록 docs/jobs/todo/product-banner/logs/R4b-review-result.json (gitignored), 로컬 작업 기록 docs/jobs/todo/product-banner/evidence/T6b.md (gitignored). — Codx(Sol)
