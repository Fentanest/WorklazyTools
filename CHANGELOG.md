# CHANGELOG

코드에 일어난 변경을 자신의 이름(Claude · Codx · Gemini)으로 간결히 기록한다(「작업 기록」 규칙). 검토 과정의 판정·기각 사유·실측 수치는 [`docs/review-notes.md`](docs/review-notes.md)에 기록한다.

## 2026-09-05

- P2 B6의 Image Studio 편집·일괄·콜라주·GIF 화면을 shadcn/Tailwind 표면으로 전환하고 전용 legacy CSS와 class 방출을 제거했다. 7개 상태 시각 시나리오, 모바일 편집 제스처·접이식 패널 회귀와 Playwright/axe 접근성 감사 명령을 함께 고정했다. — Codx
- P2 B5b의 Video Studio 입력·그룹/트림·출력/진행·결과 화면을 shadcn/Tailwind 표면으로 전환하고 전용 legacy CSS와 class 방출을 제거했다. 그룹 편집·범위 선택 시각 시나리오와 모바일 트림 값 가독성, 기존 비디오 처리 회귀를 함께 고정했다. — Codx
- P2 B5a의 Audio Studio·PDF 도구 내부 화면을 shadcn/Tailwind 표면으로 전환하고 전용 legacy CSS와 class 방출을 제거했다. 오디오 파형·효과와 PDF 4모드 썸네일 시각 시나리오, 모바일 PDF 탭 스크롤 페이드 단서를 함께 고정했다. — Codx
- P2 B4의 Excel 병합·Excel 비교·QR Studio 내부 화면을 shadcn/Tailwind 표면으로 전환하고 전용 legacy CSS와 class 방출을 제거했다. 병합 시트 선택·비교 모드/파일 쌍·QR 생성/스캔을 포함한 3상태 시각 시나리오와 다크 선택 경계·Swap/Add 접근성 회귀를 함께 고정했다. — Codx

## 2026-09-04

- P2 B3의 문서 비교·Word 결과·Excel 정리 내부 화면을 shadcn/Tailwind 표면으로 전환하고 전용 legacy CSS와 class 방출을 제거했다. 실제 DOCX·HWP 결과와 정리 규칙·결과를 포함한 3상태 시각 시나리오 및 사고 지점 기하 회귀를 함께 고정했다. — Codx
- P2 B2의 데이터 변환·세계 시간·텍스트 합치기·HWP 편집·Office 편집 화면을 shadcn/Tailwind 표면으로 전환하고 전용 legacy CSS와 class 방출을 제거했다. 실제 HWP 문서 로드와 격리 Office workspace를 포함한 3상태 시각 시나리오·스모크·owner manifest를 함께 갱신했다. — Codx
- P2 묶음 검수 캡처를 `VISUAL_ONLY` 기반 공용 QA 경로로 통합해 initial·bottom·interaction 3상태의 전체 로케일·테마·뷰포트를 수집하고 상태별 장수를 출력하도록 했다. B1 증거를 144장으로 다시 채집하고 모바일 컨트롤 기하 스모크를 추가했다. — Codx
- P2 B1의 포맷터·영업일/연차·급여·비밀번호·사진 메타데이터·텍스트 도구 내부 화면을 shadcn/Tailwind 표면으로 전환하고 전용 legacy CSS를 제거했다. 155개 잔여 규칙의 owner/refcount manifest와 고정 번들 예산 측정기, B1 초기·하단·상호작용 시각 시나리오 및 추적 제외 QA 캡처를 함께 추가했다. — Codx
- 시각 회귀 캡처를 CPU 기반 로케일 전용 브라우저 작업자로 병렬화하고, scenario/route/tool 단위 `VISUAL_ONLY` 부분 실행과 소요 시간·캡처 수·동시성·필터 리포트를 추가했다. — Codx
- 시각 회귀 하네스를 59개 scenario·151개 상태별 캡처로 확장하고, 브라우저 UI 로케일·언어 헤더·타임존·폰트·DPR·애니메이션을 고정했다. 전 도구 모바일 최하단 assertion과 음성 대조를 공용화하고 상태명 기준선을 전면 재생성했다. — Codx
- QR Studio에 표 파일 기반 7종 QR 일괄 생성, 최종 PNG 재판독, OPFS·메모리 결과 보관, 증분 ZIP·manifest XLSX·한글 A4/Letter 라벨 PDF를 추가했다. 공용 QR 디코더와 안전 ZIP 경로, ko/en 안내·SEO·정적 페이지·소셜 이미지·브라우저 회귀도 함께 반영했다. — Codx
- `main`의 라이브 복구 기준에서 `ui-migration` 브랜치를 분기해 shadcn P0a~P1c 6개 단계를 순서대로 재적용하고, 전환된 공용 컴포넌트 12종의 legacy class 방출을 제거했다. 문서 비교 스위치와 작업 버튼 배치 계약, 추적 제외 로컬 QA 빌드, 전 도구 96화면 시각 기준선·회귀 검사를 추가했다. — Codx
- UI 변경의 배포 전 조건으로 추적·광고 제외 로컬 빌드와 브라우저 육안 검수를 의무화하고, 정렬 붕괴와 컴포넌트 내부 오정렬을 파손 범위에 명시했다. — Codx
- RHWP Studio와 `@rhwp/core`·`@rhwp/editor`를 0.8.6으로 올리고 파일 집합·크기·해시를 검증하는 벤더 manifest, 재귀 PWA 차단, 생성기 기반 구 스냅샷 정리를 추가했다. — Codx
- 고정 HWP fixture의 편집·저장·core 재파싱·Studio 재개방 왕복 스모크와 RHWP 라이선스 생성·정적 버전 검사를 보강했다. — Codx
- `VITE_LOCAL_QA=1` 빌드에서 분석·광고 로더를 비활성화해 추적 없는 로컬 시각 검수를 준비했다. — Codx
- 루트 랜딩의 제목과 설명을 사이트 가치를 담은 한·영 병기 문구로 교체하고 정적 검증 계약을 갱신했다. — Codx
- 루트 언어 선택 랜딩의 설명을 80자 이내로 교체하고 Open Graph 12종·Twitter 카드 5종과 중복 방지 정적 검증을 추가했다. — Codx
- 네이버 서치어드바이저 사이트 소유 확인 파일을 배포 루트에 추가했다. — Codx

## 2026-09-03

- 라이브 화면을 파손한 shadcn UI 마이그레이션 6개 커밋을 역순으로 되돌려 전환 이전 UI를 복구했다. Excel 비교·Excel 정리 도구와 P-V 시각 회귀 하네스는 유지했다. — Codx
- AppShell의 모바일 바로가기를 shadcn Base UI Sheet로 전환해 모달·포커스 트랩·닫힘 후 포커스 복귀를 공용 primitive에 위임했다. SEO·분석/광고 로더와 영상·Office·XLS 격리 경계, 사이드바·하단 네비게이션을 보존하고 모바일 목록 스크롤·접근성·광고 격리 회귀를 보강했다. — Codx
- 모바일 드롭존 확장자 안내를 구분자 단위로 안정적으로 줄바꿈하고, 점선 테두리를 large 카드 radius에 맞췄다. 공통 모바일 콘텐츠에 하단 네비게이션 높이 이상의 여백을 추가했다. — Codx
- ToolGuide·OperationProgress·ToolCard·LanguageSwitcher를 shadcn Base UI 기반 공용 컴포넌트로 전환했다. 기존 section/article/link DOM, ko/en 안내·언어 토글 접근성, 6색 accent와 stage-key 진행 로그·활성 스피너·행별 퍼센트 계약을 보존하고 시각 기준선·스모크를 갱신했다. — Codx
- 공용 UI 8종을 shadcn Base UI 기반 호환 어댑터로 전환하고 6색 accent·파일 누적/비동기·접근성·키보드 계약을 보존했다. 미사용 NavigationRow를 제거하고 전 화면 시각 기준선과 회귀 검증을 갱신했다. — Codx
- Tailwind preflight를 전역 base layer로 활성화하고, 기존 화면의 heading·small text·목록 marker·폼 기본값·pseudo-element box model·line-height를 legacy layer에서 보정해 기존 시각 기준선을 유지했다. — Codx
- shadcn 4.20.1의 Base UI `base-luma` preset 기반과 Tailwind CSS 4.3.3을 설치했다. preflight 없이 theme/base/legacy/components/utilities layer를 분리하고 현행 CSS를 legacy에 격리했으며, prefers-color-scheme용 토큰 브리지와 소유 소스만 스캔하는 구성을 추가했다. — Codx
- Chrome 기반 시각 회귀 하네스를 추가해 홈·미디어 필터·Excel 비교 빈 상태를 ko/en·light/dark·desktop/mobile 24개 고정 화면으로 비교한다. 애니메이션 제거·허용 영역·픽셀 임계값을 명시하고 shadcn 도입 전 PNG 기준선을 함께 고정했다. — Codx
- Excel 데이터 정리 도구를 추가해 다중 파일·시트에 28종 구조·텍스트·필터·값 변환 규칙을 순차 적용하고, 수식 참조 갱신·안전 강등·병합 선행 검사·명시 미리보기·규칙 watchdog을 제공한다. 정리 XLSX·시트별 CSV·4시트 보고서·다중 ZIP, ko/en 화면·가이드·SEO·정적 페이지·소셜 이미지와 합성 fixture·Chrome 스모크·heap 게이트를 함께 반영했다. — Codx
- 스프레드시트 공용 어댑터에 OOXML 수식 종류·참조·defined name·table·원본 행/열 lineage와 수식 캐시 존재 상태를 추가하고, 기존 workbook에 충돌 없는 보고서 시트를 붙이는 XLSX helper를 추가했다. — Codx
- Excel 비교 보고서에 생성·전송·다운로드 준비 단계별 무결성 검사를 추가하고 결과 교체 뒤 URL을 정리하도록 변경했다. 쌍 전용 다중 파일 배치와 전체 좌우 설정 교환을 도입했으며, 거래 대사의 날짜·거래처 기준을 쌍 단위로 선택 해제하고 오류·후보 한도·모호성 회계를 세분화했다. ko/en 안내와 실다운로드·분배·정방향/역방향 회귀를 함께 보강했다. — Codx
- Dolby Vision profile 8의 HDR10·SDR·HLG base layer 인코딩 경로와 job별 안내를 추가하고, parser/capability별 호환 변환 사유·목표 비트레이트 용량 가드·E-AC-3 음향 변환/제거 제안을 연결했다. 비디오 진행률은 route별 활성 단계 가중치와 stage-key 로그 갱신·worker 이벤트 병합을 적용하고 ko/en 문구·DV/CTA/대용량 실파일 회귀를 함께 보강했다. — Codx
- Excel 비교 도구를 추가해 위치·키·1:N/N:1 재조정 비교, 형식별 수식·표시값·서식 판정, 정규화·허용 오차·중복 키 정책, 쌍별 실패 격리·취소·진행률과 9시트 XLSX/다중 ZIP 보고서를 제공한다. ko/en 화면·가이드·SEO·정적 페이지·소셜 이미지와 실형식 fixture·모바일 스모크·정렬 벤치를 함께 반영했다. — Codx
- 스프레드시트 실제 형식 분류·형식별 단일 파서·시트/헤더 선택 공용 어댑터, 안전 파일명 검증·충돌 처리, 순차 ZIP64 writer, 외부 유래 값을 텍스트로 고정하는 XLSX 보고서 빌더를 추가했다. 기존 Excel 테마색·legacy 서명과 비디오 ZIP은 공용 경계를 재사용하도록 이관했다. — Codx
- 비디오 원본 복사 사유를 job별로 보존하고, 음향만 부적합할 때 재검사로 확인한 기존 음향 제외 모드를 상황별 버튼으로 연결했다. copy 안내는 ko/en 모두 음향 제외만 제안하며 2GB 초과 E-AC-3·Dolby Vision 분리 회귀를 추가했다. — Codx
- AAC 브라우저 인코딩 미지원 시 오디오를 먼저 FFmpeg로 준비하고 priming을 제거한 뒤 WebCodecs 영상과 점진 MP4로 합치는 하이브리드 경로를 추가했다. 단계별 폴백·취소/메모리 계약·출력 추정 교정·해상도별 H.264 level·오디오 진행률과 소형 CI/4K 벤치를 함께 반영했다. — Codx
- XLS 보존 화면에서 OLE·SpreadsheetML 입력을 정밀 변환하고, 개별 실패는 값 전용 경고 상태로 강등해 배치를 계속하도록 변경했다. 입력별 Excel 테마색은 솔리드 채움·글꼴·테두리에서 RGB로 고정하며 ko/en 안내와 tint·혼합 테마·3분기 폴백·성능 회귀를 함께 추가했다. — Codx
- MP4 목표 비트레이트 작업을 코덱·오디오 지원 판정 뒤 브라우저 영상 인코딩과 점진 임시 파일 저장 경로로 처리했다. crop·scale/pad·rotation·flip·concat FPS 정규화, 오디오 제거/복사/지원 시 인코딩, 취소·큐 제한·FFmpeg 폴백, ko/en 안내와 성능·재생 회귀를 함께 반영했다. — Codx
- MP4·MOV H.264/HEVC 패스스루를 실제 트랙 적합성 판독 뒤 job별 점진 demux·키프레임 스냅·샘플 concat·임시 파일 스트리밍 출력으로 처리하고, 비호환·저장 공간 부족·안전 한도별 FFmpeg 폴백을 연결했다. 정확 버전 의존성·ko/en 안내·2GiB 초과/라우팅/타임스탬프/취소 회귀도 함께 반영했다. — Codx
- 비디오 job별 route 결정표와 상위 처리 오케스트레이터를 추가하고, 현재 모든 job의 FFmpeg 동작을 보존했다. 진행률 단계·단조성·종결 계약과 결과 이름·MIME·warning·오류·개수 공통 모듈, route 조합/회귀 테스트를 함께 반영했다. — Codx
- 이미지 편집기에 base+effect 최하단 블록을 보존하는 공통 레이어 순서 계약, 레이어 패널의 선택·표시·삭제·재정렬, 데스크톱 다중 선택·6방향 정렬·다중 복제와 대상별 우클릭 메뉴를 추가했다. ko/en·모바일 레이어 시트·히스토리/내보내기/입력 우선순위 회귀를 함께 반영했다. — Codx
- 비디오 완성 결과를 공통 buffer/File/브라우저 임시 파일 계약으로 확장하고 세션 소유권·만료·실패/취소 정리를 도입했다. 비디오 ZIP은 zip.js 순차 스트리밍·강제 ZIP64로 교체했으며 비동기 결과 저장 대기, 용량 부족 폴백, ko/en 안내와 힙·ZIP64·수명주기 회귀를 추가했다. — Codx

## 2026-09-02

- 비디오 concat 세그먼트를 생성 직후 Blob으로 오프로드하고 MEMFS 파일을 삭제한 뒤 WORKERFS 절대경로로 재마운트해 조인하도록 변경했다. mount 수명주기 정리 단위 테스트와 Chrome 대용량 MEMFS·RSS·SHA 벤치를 추가했다. — Codx
- 이미지 편집기에 전 객체 행렬 리샘플·중앙 기준 캔버스 크기 변경·원본 화질/지정 px 내보내기와 4096/8192px 상한을 추가하고, 출력 배율을 Undo·Redo에 포함했다. 우측 옵션 패널은 세션 기억 접기/펼치기와 모바일 강제 시트 동작을 지원하며 ko/en·SEO·가이드·브라우저 회귀를 함께 갱신했다. — Codx
- 이미지 자르기의 900px 캔버스 강제 비율 변경을 폐기하고, 이동·실시간 경계 제한·정규화되는 8핸들 crop 박스와 5비율+자유 preset을 도입했다. preset 핸들 잠금, Shift 정사각형·Alt 중심 조절, 핀치 유지, ko/en 비활성 사유와 P4-2 브라우저 회귀를 추가했다. — Codx
- 이미지 자르기·영역 효과 overlay 원점을 좌상단으로 고정하고 두 도구의 선택 상태·취소 처리를 분리했다. 자르기 적용 시 선택 패널로 동기화하며, 적용 버튼의 상시 비활성 사유와 ko/en 접근성 문구·드래그 중/박스 우하단 px 라벨·8조합 합성 회귀를 추가했다. — Codx
- Word 비교의 동일 서식 인접 런을 OOXML 경계를 지키며 병합하고 highlight 차이를 표시해 실문서 웹 서식 변경을 133건에서 진양성 4건으로 정정했다. 기존 리비전을 수락한 사본으로 비교·생성하고 신규 변경 작성자와 후 문서의 신규 메모 작성자만 통일하는 선택 옵션을 ko/en UI와 합성 회귀·LibreOffice 검사까지 추가했다. — Codx
- 비디오 인코딩 스레드 캡 상향안을 실측 게이트에서 기각하고 현행 4스레드 캡 유지. `multiThreaded` 상태의 인자 조립 배선과 스레드 벤치 스크립트(`scripts/benchmark-video-threads.mjs`)·hc 경계 단위 테스트는 추가. — Codx
- 이미지 편집기에 도형 7종(둥근 사각형·삼각형·별·육각형·말풍선·단/양방향 화살표·형광펜)을 단일 Fabric 객체로 추가하고, Twemoji v17.0.3 기반 스티커 112종을 해시 고정 벤더 파이프라인(`scripts/vendor-image-studio-assets.mjs`)+카테고리·검색 피커로 도입. ko/en 문구·모바일 피커·스모크 포함. — Codx
- 무접두사 `/tools/excel-merger/xls-preserve/` 정적 페이지를 ko판과 동일 정책(noindex·사이트맵/hreflang 제외·canonical)으로 산출하고 정적 검사에 고정. — Codx
- XLS 보존 경로 첫 진입 시 엑셀 워커가 격리 헤더 부재로 차단되던 문제 수정: 전역 SW가 same-origin worker/sharedworker 응답에 `COEP: require-corp`·`CORP: same-origin`을 부여하고, 문서 격리 준비는 세션 가드로 최대 1회 자동 리로드. 무헤더 동형 서버 재현 스모크(`test:xls-first-load`) 신설. — Codx
- 이미지 편집기에 사용자 보기 전용 25–400% 줌·팬 추가(휠·Space+드래그·모바일 두 손가락 중재). 내보내기는 보기 변환을 잠시 제거해 픽셀 결과 불변 보장, 치수 변경 전이는 100% fit 초기화·치수 불변 undo/redo는 보기 보존, 미니바 위치 보기 추종. — Codx
- SpreadsheetML 위장 `.xls`의 CDATA 섹션을 파싱 전 XML 이스케이프로 전개해 CDATA 포함 파일도 시트 표시·병합 지원. 합성 혼합 배치 스모크 추가. — Codx
- Excel XLS 보존 판정을 확장자에서 OLE compound 시그니처로 교체(XML 위장 .xls는 일반 검사 경로), 변환 실패는 파일별 격리+원본 파일명 ko/en 안내, 변환 FS·URL은 순번 기반 ASCII 내부명으로 제한. — Codx
- 이미지 스튜디오 편집기를 상호작용 모드/8패널 상태 분리 + 상단 툴바·sticky 캔버스·우측 패널·모바일 하단 시트로 재구성. 그리기 서브도구 보존, 삽입 후 패널 유지, 선택 객체 플로팅 미니바(색·굵기·맨앞/뒤·복제·삭제, base 보호) 추가. aria/data-testid 스모크·390×844 검증 포함. — Codx
- Excel 시트 선택기를 1~2열 카드 그리드로 재배치: custom 모드 `aria-pressed` 칩 토글, all/positions 상태 칩, 카드 접근성·목록 내부 스크롤·모바일 44px 타깃·Step 2 sticky 요약(ko/en). — Codx
- VP9 인코딩에 `-deadline good -cpu-used 4` 추가(호스트 실측 3.2배 가속·품질 동등), 전체 인자 배열 회귀 테스트와 고정 벤치 fixture·스크립트 추가. — Codx
- Gemini 위임 경로 확립: agy CLI 호출 방법(`--add-dir` 필수, 타임아웃·구조화 출력·샌드박스 기준)과 산출물 검증 절차를 `CLAUDE.md` 「호스트 참고」에 기록. — Claude
- Chrome 렌더링 기반 앱 아이콘 생성기(`scripts/generate-app-icons.mjs`)로 그라데이션 PNG 5종 재생성, manifest `any`/`maskable` 분리, iOS용 불투명 180px 생성. — Codx
- 세 에이전트 협업 체계 도입: `PROJECT_RULES.md` 신설(공통 3규칙 명명 이관), 역할 지시서 `CLAUDE.md`·`AGENTS.md`·`GEMINI.md` 분리, `docs/jobs/` 작업지시서 체계·`docs/backlog.md` 도입, 「커밋·업로드·배포는 Codex」 규칙 추가(사용자 결정). 운영 문서 2종을 규칙 부속 명세로 연계. — Claude
- 2026-08-15–16 신뢰성 작업지시서 4개 종결·`docs/jobs/archive/` 이관(검토 내역은 `docs/review-notes.md`). — Codx
