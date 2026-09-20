# WU1 위임문 — Sol (gpt-5.6-sol, Codex plugin)

[전달 주의] 모델 문자열은 정확히 `gpt-5.6-sol`. 바꾸거나 추정하지 말 것. 아래 원문을 추가·삭제 없이 전달.

구현 작업(파일 수정·커밋 필요). 작업 ID adsense-recheck-20260919 / WU1. 지시서 정본: /home/better0101/projects/wt-adsense-guides/docs/jobs/todo/adsense-recheck-20260919/PLAN.md (버전 v0.3, sha256 앞 16자 40c69eeb25b6ec4c). 요청 모드 plan-and-implement, 계획 상태 정본화 완료, 구현 허가 있음(사용자 `!계획!` 2026-09-19, Claude 정본화 2026-09-20).
작업 공간: git worktree /home/better0101/projects/wt-adsense-guides, 브랜치 work/adsense-guides-20260919, 기준 커밋 29fe72c. 이 worktree 밖(특히 /home/better0101/projects/worklazytools 원본)에는 쓰지 않는다.
역할: 당신은 구현 담당 Sol이다. PLAN.md §3(WU1) 전부와 §3-5 소유 범위만 수행한다. §4(WU2), §5(WU3), §6(WU4)는 이번 호출 범위 밖이다. 규칙 정본은 worktree의 PROJECT_RULES.md·AGENTS.md.
입력: 항목표 docs/jobs/todo/adsense-content-audit-20260919.md(worktree 사본), 원고 원본 참고는 원본 저장소의 scratch/content_plan.md·scratch/full_plan.md를 **읽기만** 허용(/home/better0101/projects/worklazytools/scratch/…).
순서: §3-1 OCR 이관 → §3-2 정적 검사기 분리·기대표 데이터화·자체 검증 → §3-4 검증기 강화·단위 테스트 → §3-3 39건 항목별 처리(WU1-ITEMS.md 갱신) → 빌드·확인 스크립트·캡처 → 보고.
검사(이번): `npm run test:guides`, `npm run test:unit`(신규 두 테스트 포함), `npm run build`, `npm run test:static`, §3-3 위치 기준 정적·런타임 확인(vite preview --port 4181 --strictPort, 크롬 /usr/bin/google-chrome), 시각 표본 캡처 → /tmp/wl-adsense/wu1/. 전 도구 회귀·시각 회귀 전체는 하지 않는다.
참고 사실: 현재 validate-static-output.mjs의 FAQ 검사 대상 배열(88행 부근)에 convert는 없고 ocr만 있다. convert 전용 기대 질문을 기대표에 추가하면 convert도 검사 대상이 된다. ToolGuideWrapper·getFaqsForPath는 선택 배열이 비어 있으면 전체 FAQ로 대체하므로 검증기가 빈 배열을 실패시켜야 한다.
금지: package.json, AdSenseLoader/AppShell/adEligibility, seo.ts canonical·redirect, 디자인 변경, evidence·scratch 삭제, 광고 정책 변경, 저장소 루트에 새 파일 생성(신규 파일은 §3-5에 전체 경로로 열거된 것만), push.
커밋: 작업 브랜치에 의미 단위로. 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` 를 넣지 않는다(구현자는 Sol). 최종 SHA를 고정 제출.
보고: docs/jobs/todo/adsense-recheck-20260919/WU1-REPORT.md(worktree 사본 경로)에 최종 SHA, 변경 파일, 실행 명령·종료 코드·로그 경로, 39건 상태 집계(수정/유지/제거/미연결 삭제/격리 미노출), 미완료·재현 불가, 지시서 밖 판단이 필요했던 지점. 실패·권한 오류는 원인과 함께 중단 보고. 샌드박스·승인 우회 금지.
