# 방법 3 / 수량 가정 고정 표본

`assumption-replay-20261113.json`은 파이프라인 후보 `f1e9a98904edcf4c28e0b30e884e687bcc3c374f`의 2026-11-11 가격 재생에서 가져온 **16개 가정 행 전부**, 확정 감자 보정 STX, 제외 유지 에이프로젠을 담은 18행 시험용 투영이다. 실제 전체 운영 스냅샷이 아니며, 운영 수치라고 게시하지 않는다.

원본: 작업 증거 `wt/_jobs/20261113/ft-ca-evidence/sol-fix1/approved-final.json.values.json`의 `by_key`. `quantity`, `estimated_value`, `quantity_adjustment`, `quantity_assumption`을 그대로 사용했다. 공개 계약에 맞게 가정의 발행 신주 `shares`만 정수→문자열로 바꿨다. 16개 접수번호·상장일·발행량과 개별 수량·금액은 원 재생 값이다. 원본 파일 SHA-256은 아래에 기록한다.

기존 고정 `chart-snapshot-20261103.json`에서 기업 코드·연말/공시 출처 메타데이터·과거 7점 및 공통 포트폴리오를 가져왔다. 그 메타데이터는 11/11 실제 조립 메타데이터를 재현한다는 주장이 아니다. 재생 행의 접수일은 값이 있으면 사용하고, 없으면 기존 표본 메타데이터를 유지했다. 검증된 정수 종가는 재생 평가액/평가 수량으로 복원(잔차 0)했다. 비중·현재 합계·종목 수는 18행 부분집합에 맞게 재집계했다. 마지막에 현재 방법 3인 표본 점을 추가하고 기존 과거 점은 방법 2로 명시했다. 재구성 19점은 기존 고정 표본을 그대로 썼다. 표본 datasetVersion은 시험 투영 식별자의 SHA-256이다.

기존 형식 회귀 표본은 수정하지 않은 `chart-snapshot-20261103.json`(방법 2, 가정 필드 없음)이며 기존 19점 재구성 표본과 함께 검사한다. 이 표본을 실제 공개 데이터 경로로 복사하지 않는다.
ce5a90a0132d14b880f244b8d9e218b54d79f46125bc74b934f23119268eed78  /home/better0101/projects/worklazytools/wt/_jobs/20261113/ft-ca-evidence/sol-fix1/approved-final.json.values.json
