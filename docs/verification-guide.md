# WorklazyTools 변경 영역별 검증 안내

정책은 PROJECT_RULES.md다. 이 문서는 실제 진입점 안내이며 매 작업 전 행 실행 목록이 아니다. 명령·필터는 현재 후보의 package.json과 해당 스크립트에서 확인한다.

| 변경 영역 | 우선 확인할 기존 진입점 |
|---|---|
| 순수 로직·회귀 | `tests/unit/*.test.ts`, `npm run test:unit` 및 실제 지원하는 개별 테스트 선택 |
| 정적 페이지·SEO·광고 제외·언어 | `test:static`, `test:guides`, `test:i18n`, `test:ads` 중 관련 항목 |
| 일반 도구 | `test:utilities`, `test:new-tools`, `test:browser` 중 실제 변경된 도구/소비자 |
| Excel 비교·정리·XLS 보존 | `test:excel-compare`, `test:excel-cleaner`, `test:xls-preserve`, `test:xls-first-load` |
| 문서 비교·오피스 | `test:document-diff`, `test:office` |
| PDF 마무리·워터마크·비교 | `test:pdf-finish`, 관련 oracle·성능·비교 UI 스크립트 |
| QR | `test:qr-bulk`, `test:qr-font-render`, 관련 metrics |
| 화면·초점·모바일·접근성 | `test:control-geometry`, `test:ui-migration`, `test:visual`, `test:a11y`의 필요한 조합 |
| 복구·로딩 | `test:recovery`, 실제 관련 첫 로드 검사 |
| 생성물·벤더 | 생성기·입력·vendor snapshot 크기/해시 계약, `docs/OFFICE_EDITOR_ASSETS.md` |
| 에이전트 운영 코드·문서 | `python3 -m unittest discover -s tests/agent_ops -v`, 문서/경로/정책/복사본 검사 |

최종 제품 통합 후보는 build·test:unit·test:static과 영향 범위 스모크/필요한 시각 검수·이월 필수 항목을 확인한다. 이 단계와 중간 보존용 커밋·묶음 검수를 혼동하지 않는다. 기존 유효 결과는 관련 입력이 같을 때 재사용한다. 각 브랜치 결과를 합쳐 최종 후보의 통과로 적지 않는다.

`PUBLISHING_CHECKLIST.md`의 전체 목록은 최초 공개·광범위 변경·운영 기반 변경 때 적용한다. 평상시 작은 수정에서 전 도구/전 형식 검사를 반복하는 근거로 쓰지 않는다. CI의 기존 필수 검사는 유지한다.

UI는 광고/추적 코드가 실행되지 않는 로컬에서 영향받는 언어·테마·크기·초기/상호작용/하단을 실제 열람한다. 캡처·자동 픽셀 검사만으로 열람 완료라고 하지 않는다. 민감 입력 대신 합성 자료를 쓴다.
