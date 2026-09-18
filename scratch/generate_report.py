report = """
# AdSense 노출 경로 수정 및 검증 결과

| URL | 언어 | 화면 상태 | 실제 게시자 본문 | 정상 UI | 광고 로더 자격 | 스크립트 요청 | 광고 요청 | 실제 표시 | 테스트 방식 | 증거 / 비고 | 미검증 원인 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/tools/excel-merger` | KO/EN | 일반 접속 | 예 | 예 | ✅ 허용 | 예 | (Google 판단) | (Google 판단) | 로컬 빌드 테스트 | `!isAdIneligible` 상태 확인 | 계정 미확인 |
| `/tools/pdf-editor/merge` | KO/EN | 일반 접속 | 예 | 예 | ✅ 허용 | 예 | (Google 판단) | (Google 판단) | 로컬 빌드 테스트 | `pathFaqs` 연결 확인 | |
| `/tools/document-compare/results/:id` | KO/EN | 결과 조회 | 아니오 | 예 | ❌ 차단 | 아니오 | 아니오 | 아니오 | 로컬 빌드 테스트 | `AppShell` 내 URL 감지 | |
| `/tools/hwp-editor` | KO/EN | 집중 편집 (editor) | 아니오 | 예 | ❌ 차단 | 아니오 | 아니오 | 아니오 | 로컬 빌드 테스트 | `focusMode` 감지 확인 | |
| `/*` (임의의 도구) | KO/EN | `RouteErrorBoundary` | 아니오 | 예 | ❌ 차단 | 아니오 | 아니오 | 아니오 | 로컬 빌드 테스트 | `RouteFailure` 마운트 감지 | |
| `/tools/video-studio` | KO/EN | 비디오 편집 | 아니오 | 예 | ❌ 차단 | 아니오 | 아니오 | 아니오 | 코드 검토 | 기존 보호 논리 보존 | |

## 작업 요약
1. **편집자 메모 정리**: `ko/guides.json`, `en/guides.json`에서 "게시", "fixture", "합성", "검증", "예시 스크린샷" 등의 제작자 전용 지시문을 모두 사용자 친화적인 설명으로 교체했습니다.
2. **콘텐츠 연결 복구**: `/tools/pdf-editor/page-numbers` 등 PDF 및 Video의 하위 경로에 대해 `pathFaqs` 조회가 비어 있을 때 JSON-LD 및 화면 모두에서 **전체 FAQ로 Fallback** 하도록 `guideData.ts`와 `ToolGuideWrapper.tsx`를 통일했습니다. 고립된 섹션 제목("오디오 자르기", "이미지 크기 변경")을 제거했습니다.
3. **광고 적격성 분리**: 기존의 단순 환경/동의 체크(`AdSenseLoader.tsx`)를 넘어, **무콘텐츠 화면**(집중 편집 모드, 문서 비교 결과, 라우트 에러 등)에 진입할 경우 즉시 광고 자격을 상실(`setAdIneligible`)하도록 설계했습니다.
"""
with open("/home/better0101/.gemini/antigravity/brain/fb05f606-fbec-4677-9ea4-0b98e3551f6b/adsense_verification.md", "w", encoding="utf-8") as f:
    f.write(report)
print("Report generated")
