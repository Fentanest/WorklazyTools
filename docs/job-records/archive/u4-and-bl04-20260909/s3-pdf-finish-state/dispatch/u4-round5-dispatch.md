# 지시서 — U4(PDF 마무리) 계획 v6 · Codex astra 5차 반박 (2026-09-06)
## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(신설 「모델 역할 분담」 — 이 라운드는 astra 반박: 작업 중 발생·인지될 예외 상황과 구성의 흠결까지 sol 이 감당할 수 있을 만큼 고려해 반박) → `docs/jobs/todo/pdf-finish-20260905.md` 전문(**「v6 확정」 절이 최신**) → `roadmap-completion-20260906.md` §2·§3 S3·§결정 10·11 → 자신의 3차·4차 보고 `/tmp/worklazy-u4-r3/REPORT.md`·`/tmp/worklazy-u4-r4/REPORT.md`.
## 1. 성격·기준
- **반박 라운드(실험 모드)** — 저장소 파일 수정·커밋·push·`dist` 변경·npm 설치 절대 금지. 실험은 `/tmp/worklazy-u4-r5/`(3차·4차의 `/tmp/worklazy-u4-r3/project/`·`/tmp/worklazy-u4-r4/project/` 복제본·계측 플러그인 재사용 가능). 시작·종료 불변 증명(3차의 `verify-unchanged.py` 방식).
- 저장소 루트 `/home/better0101/projects/worklazytools`, 기준 HEAD `main` = `1a04f2571109495a76b8468af95b2f4edcd862cf`. **`AGENTS.md`·`CLAUDE.md` 는 워킹트리에 Claude 의 문서 변경이 있다(모델 역할 규칙 추가) — 이는 알려진 변경이며 불변 증명에서 제외하고 그 외 파일 불변을 증명한다.**
- 동시에 S2b 1차 반박(읽기 전용)이 같은 저장소를 읽는다.
## 2. 반박 대상
「v6 확정」 절의 D1·D3·D4·D5·N1·N2·N3 결정 문안. 항목별 [동의]/[이견] + 실행 명령·출력. 특히:
- **D5**: "메인 스레드 장식 엔진 + 공용 lazy 청크 `pdfFontEmbed`(fontkit·PDFDocument, owners=[pdf-editor,qr-studio]) 를 QR 도 import" 그래프를 4차 계측 플러그인으로 **1회 탐색 빌드**해 계산식(독립 rendered gzip 가중 배분·순증분 게이트)으로 5종 판정. 협력적 취소(페이지 루프 `signal.aborted` + await 양보)가 F0b adapter 범위 축소와 정합하는지.
- **D3**: 가독성 oracle(text-vector 8pt, Poppler 렌더 x-height ≥5px) 이 측정 가능한지 1 fixture 로 probe. 포맷 규칙(모바일 에뮬레이션 photo-scan 300DPI 1쪽 paired 중앙값 비율 ≥2.0) 의 측정 절차가 결정적인지. "DPI 기본 150·모바일 한계 미교정 명시" 가 로드맵 규칙과 충돌하지 않는지.
- **D4**: 표의 각 행이 pdf-lib 1.17.1 API 로 구현 가능한지(4차 E4-4 재사용), "지원 제외 = 경고 후 진행 시 제거" 효과가 확정 25 와 일관한지.
- **D1·N1·N2·N3**: 문안 오류·미정의 잔존 여부. N3 말줄임 정책과 확정 1 ④ 안내의 충돌 여부.
- **sol 관점 최종 점검**: v6 상태로 U4-0~8 코딩 시 재해석 지점이 남는가 — 남으면 이견. 남지 않으면 "Claude–Codex 간 이견 0 · [정본화 가능]" 명시.
## 3. 판정 형식
항목별 표 · 잔여 이견 수 · [정본화 가능]/[재왕복 필요]. 잔여 0 이면 "Claude–Codex 간 이견 0" 명시. 산출물 `/tmp/worklazy-u4-r5/REPORT.md`.
## 4. 금지
저장소 변경 · 계획서 편집 · 사용자 파일 조작 · 상한 변경 제안.
