# U4-6 SCOPE-OUT 보고서

- 판정: **SCOPE-OUT — 번들 예산 초과로 구현 중단**
- 브랜치 / 기준 HEAD: `s3-pdf-finish` / `79c20710b756d58d87fe2e0bdb9cc51782855c82`
- 기준선: `/tmp/worklazy-u4-4-review5/evidence/bundle-baseline.json`
- 기준선 SHA-256: `4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`

## 탐색 빌드

수정 전 측정(`/tmp/worklazy-u4-6/explore/current.json`)은 다섯 지표를 모두 통과했다.

| 지표 | 수정 전 delta | 상한 |
| --- | ---: | ---: |
| entry JS gzip | 8,878 B | 20,480 B |
| PDF route JS gzip | 61,923 B | 72,000 B |
| shared JS gzip | 2,407 B | 30,720 B |
| app JS gzip | 74,107 B | 81,920 B |
| CSS gzip | 393 B | 10,240 B |

후보 설계는 기존 v13 OCG/Type3 판별기를 재사용하고, 새 문서의 페이지 참조를 먼저 할당한 뒤 단일 `PDFObjectCopier`로 허용된 페이지·카탈로그 루트만 복사하는 방식이었다. 첨부/주석/양식/메타데이터 선별 제거, URI·직접 목적지·이름 기반 목적지 보존, 한·영 사전 고지와 보존표까지 연결한 탐색 후보를 측정했다.

최종 탐색 측정(`/tmp/worklazy-u4-6/explore/candidate-ui.json`) 결과:

| 지표 | 후보 delta | 상한 | 판정 |
| --- | ---: | ---: | --- |
| entry JS gzip | 10,132 B | 20,480 B | 통과 |
| PDF route JS gzip | 69,435 B | 72,000 B | 통과 |
| shared JS gzip | 2,427 B | 30,720 B | 통과 |
| app JS gzip | **82,887 B** | **81,920 B** | **967 B 초과** |
| CSS gzip | 400 B | 10,240 B | 통과 |

명령은 기록된 기준선과 고정 상한으로 실행했으며 multiplier·override·route 상계는 변경하지 않았다. 측정 스크립트는 `Bundle budget exceeded: appJsGzip 82887 > +81920`로 종료했다.

## 중단 처리

- 사용자 지시에 따라 추가 상향 요청이나 추가 축소 구현을 시도하지 않았다.
- 탐색용 소스 변경은 모두 되돌렸다.
- 기존 사용자 작업(`CLAUDE.md`, `PROJECT_RULES.md`, 기존 미추적 파일/디렉터리)은 건드리지 않았다.
- 구현 커밋은 만들지 않았다.
- main 병합·push·배포를 수행하지 않았다.

— Codx
