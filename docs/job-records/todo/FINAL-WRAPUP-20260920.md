# 2026-09-20 작업 묶음 마무리 보고 (Claude) — 확정(세 계획 모두 운영 반영 완료, main 0523801)

## 배포된 것 (main 기준)
| 순서 | 계획 | main SHA | Pages | 내용 |
|---|---|---|---|---|
| 1 | adsense-recheck-20260919 | 290a11f | 35480115773 성공 | OCR·convert FAQ 연결 복구, 원고 39건 정리, 검증기 강화, 광고 로더 결함 수정(동의 사용자 lazy 경로 미로드), 광고 상태 스모크 29건, 부산물 138개 추적 해제 |
| 2 | adsense-followup-20260920 | 10186df | 35483710375 성공 | PC 하단 모바일 메뉴 숨김, PDF 비교 페이지 안내·FAQ, .ts import 2건, seo·feature-locales 테스트 갱신(unit 실패 10→4), 스모크 메타·판별 강화 |
| 3 | adsense-followup2-20260920 | 0523801 | 35485514033 성공 | 컴포넌트 규격 테스트 3건 갱신(unit 실패 4→0), 엑셀 정리 checkbox 색 선언 치환, 오피스 편집기 화면 안내 표시(집중 모드 밖), 오피스 앱 경로 FAQ 5개·EN 문장 정정, 런북 추가 문안 |

## 사용자 결정 대기
- **ToolCard 제목 h2/h3**: 정본(ui-theme-redesign-20260907:159)은 h3, 현재 제품·테스트는 h2(c5b64f6 회귀). 이번 작업은 건드리지 않았고 백로그·review-notes에 회부 기록. 정본을 따를지(h3 복원) 현재를 승인할지 결정 필요.
- **S5 잔류 광고 처리**: 같은 문서에서 렌더 오류가 나면 기존 광고 스크립트가 남음(주입 재현 실측). 제품 처리 여부 결정 필요.
- **S9 이동 경고 UX**: 광고 허용→제외 경로 이동 시 새로고침으로 도구 로컬 상태 유실, 경고 없음. 경고 도입 여부.
- **원본 작업트리 정리**: /home/better0101/projects/worklazytools는 아직 29fe72c 체크아웃 + 미커밋 patch_notes.py 수정 + untracked 17개. 사본은 docs/jobs/todo/adsense-recheck-20260919/archive/(untracked-main, patch_notes.local.py)에 보존. `git pull --ff-only`는 patch_notes.py 로컬 수정과 충돌하므로 사용자 확인 후 정리(예: 로컬 수정 폐기 뒤 pull).

## 사용자 계정에서 확인할 것 (AdSense)
- Auto ads 페이지 제외 목록: /tools/pdf-editor*, /tools/hwp-editor*, /tools/document-compare*, /tools/pdf-compare*, /tools/office-editor/app/, /tools/excel-merger/xls-preserve/, /tools/video-studio*, /tools/document-redactor* (KO/EN)
- 사이트 수준 Auto ads 설정, 실제 노출 표본, 모바일 overlay(S10)

## todo 문서 감사 결과 (TODO-STATUS-AUDIT-20260920.md)
- 완료 15건 → docs/jobs/archive 이동(인덱스 링크 복구). 미완료·미확인 9건: 번들 다이어트 B1/B2/B3(미착수), UI v3 최종 게이트(W5 3실패·mint·1920·shard·a11y incomplete), U9·파일명 제한 이월 검수 증거, roadmap 두 문서 상태 갱신, PLAN-INDEX 현행화(09-20 갱신 절 추가). 상세는 감사 문서 §C.

## 정리 대상 (사용자 확인 후 Claude 수행 가능)
- worktree 9개: wt-adsense-{guides,adtest,integration}, wt-followup-{a,b,integration}, wt-followup2-{c,d,integration} (모두 main에 병합 완료 후 제거 가능)
- 작업 브랜치: work/adsense-guides-20260919, work/adsense-adtest-20260919, integration/adsense-recheck-20260919, work/followup-a-20260920, work/followup-b-20260920, integration/adsense-followup-20260920, work/followup2-c-20260920, work/followup2-d-20260920, integration/adsense-followup2-20260920 (로컬만, 원격 미push)
- ~/.codex/config.toml 신뢰 등록 9줄(wt-adsense-* 3, wt-followup-* 3, wt-followup2-* 3), 백업 config.toml.bak-adsense-recheck-20260920
- 검수 복사본 /tmp/wl-adsense/review/{wu1-src,wu2-src,final-src}(detached worktree), /tmp/wl-adsense, /tmp/wl-followup, /tmp/wl-followup2 증거(재부팅 시 소실 — 필요 로그는 docs/jobs/todo 각 폴더에 사본)

## 잔여 위험·미확인
- 실제 광고 요청·노출, 심사 결과는 보장 불가. Muse 부트스트랩 정지 원인 미확인(런북에 대응 절차 반영). Gemini 헤드리스 제약(런북 반영).
