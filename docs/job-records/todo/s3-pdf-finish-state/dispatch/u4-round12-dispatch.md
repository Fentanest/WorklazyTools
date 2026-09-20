# 지시서 — U4(PDF 마무리) 계획 v13 · Codex astra 12차 반박 (2026-09-06)
## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(신설 「모델 역할 분담」 — 이 라운드는 astra 반박: 작업 중 발생·인지될 예외 상황과 구성의 흠결까지 sol 이 감당할 수 있을 만큼 고려해 반박) → `docs/jobs/todo/pdf-finish-20260905.md` 전문(**「v13 확정」 절이 최신**) → `roadmap-completion-20260906.md` §2·§3 S3·§결정 10·11 → 자신의 3차·4차 보고 `/tmp/worklazy-u4-r3/REPORT.md`·`/tmp/worklazy-u4-r4/REPORT.md`·`/tmp/worklazy-u4-r5/REPORT.md`·`/tmp/worklazy-u4-r6/REPORT.md`·`/tmp/worklazy-u4-r7/REPORT.md`·`/tmp/worklazy-u4-r8/REPORT.md`·`/tmp/worklazy-u4-r9/REPORT.md`·`/tmp/worklazy-u4-r10/REPORT.md`·`/tmp/worklazy-u4-r11/REPORT.md`.
## 1. 성격·기준
- **반박 라운드(실험 모드)** — 저장소 파일 수정·커밋·push·`dist` 변경·npm 설치 절대 금지. 실험은 `/tmp/worklazy-u4-r12/`(3차·4차의 `/tmp/worklazy-u4-r3/project/`·`/tmp/worklazy-u4-r4/project/`·`/tmp/worklazy-u4-r5/`·`/tmp/worklazy-u4-r6/`·`/tmp/worklazy-u4-r7/`·`/tmp/worklazy-u4-r8/`·`/tmp/worklazy-u4-r9/`·`/tmp/worklazy-u4-r10/`·`/tmp/worklazy-u4-r11/`(explore·final-assertions·Type3 fixture) 재사용 가능). 시작·종료 불변 증명(3차의 `verify-unchanged.py` 방식).
- 저장소 루트 `/home/better0101/projects/worklazytools`, 기준 HEAD `main` = `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`. **`AGENTS.md`·`CLAUDE.md` 는 워킹트리에 Claude 의 문서 변경이 있다(모델 역할 규칙 추가) — 이는 알려진 변경이며 불변 증명에서 제외하고 그 외 파일 불변을 증명한다.**
- 동시에 S2b 1차 반박(읽기 전용)이 같은 저장소를 읽는다.
## 2. 반박 대상
「v13 확정」 절 D4(Type3 글꼴 도달 가능 시 구조 제거 지원 제외 · manifest 허용 4/제외 31+회귀). 항목별 [동의]/[이견] + 명령·출력. 특히:
- v13 문안으로 355+72 입력 재분류(허용 198 유지·제외 증가) + 허용 전부 두 렌더러 원본/결과 RGBA SHA 동일 재실행. Type3 탐지(직접/간접 `/Subtype /Type3`, ExtGState `/Font`, Form/Pattern 리소스, 상속)가 11차 탐지 누락 14 를 전부 잡는지.
- **마지막 새 입력 탐색 1라운드**: Type0/CIDFont·Type1 임베드 글꼴 대조(정적 glyph — Type3 와 달리 안전한지 2~4개) · 이미지 `/SMask`·`/Mask` 경로 · Transparency Group(`/Group`) Form · 같은 OCG 가 Contents 와 XObject 양쪽에서 쓰이는 경우. **v13 제외 조건에 이미 걸리면 fixture 후보로만**. 문안을 통과하면서 표시가 갈리는 입력만 이견.
- **선언 규칙**: 이 라운드에서 새 이견이 없으면 **"Claude–Codex 간 이견 0 · [정본화 가능]"** 을 명시 선언한다(지원 범위가 충분히 보수적임을 확인). 새 이견이 있으면 제외 조건 문안과 함께 [재왕복 필요].
- **HEAD 주의**: 기준 `main` = `f29d249…`, 워킹트리 `s2b-qr-font`(HEAD 2f59a44) — 브랜치 전환 금지, pdf-editor 표면 불변만 확인. 동시 S2b 4차 검수 무관.
- **sol 관점 최종 점검**: v13 으로 U4-0~8 코딩 시 재해석 지점이 남는가.
## 3. 판정 형식
항목별 표 · 잔여 이견 수 · [정본화 가능]/[재왕복 필요]. 잔여 0 이면 "Claude–Codex 간 이견 0" 명시. 산출물 `/tmp/worklazy-u4-r12/REPORT.md`.
## 4. 금지
저장소 변경 · 계획서 편집 · 사용자 파일 조작 · 상한 변경 제안.
