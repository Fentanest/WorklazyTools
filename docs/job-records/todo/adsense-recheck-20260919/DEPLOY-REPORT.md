# adsense-recheck-20260919 / WU4 배포 보고

- 담당: Sol (Codx)
- 배포 승인: 사용자 2026-09-20 `main에 올려`
- 상태: **운영 반영 완료**
- 배포 대상: `integration/adsense-recheck-20260919`의 `290a11f94025b040d935e8a9f104241a9ca72fe7`
- 기존 `origin/main`: `29fe72cb5a25c6d9643d69f66d713f1386a4ff4e`

## Push 전 확인

| 항목 | 결과 |
|---|---|
| `git rev-parse HEAD` | `290a11f94025b040d935e8a9f104241a9ca72fe7` |
| 현재 브랜치 | `integration/adsense-recheck-20260919` |
| `git status --short` | 출력 없음(clean) |
| `git fetch origin` | exit 0 |
| fetch 후 `origin/main` | `29fe72cb5a25c6d9643d69f66d713f1386a4ff4e` |
| `git merge-base --is-ancestor origin/main HEAD` | exit 0(조상 관계 확인) |

## Main 반영

명령: `git push origin HEAD:refs/heads/main`

```text
To github.com:Fentanest/WorklazyTools.git
   29fe72c..290a11f  HEAD -> main
```

exit 0. Fast-forward로 반영됐으며 force 옵션을 사용하지 않았다.

## GitHub Pages

| 항목 | 결과 |
|---|---|
| Workflow | `Deploy GitHub Pages` |
| Run ID | `35480115773` |
| Head SHA | `290a11f94025b040d935e8a9f104241a9ca72fe7` |
| 상태 / 결론 | `completed` / `success` |
| 시작 / 완료 | `2026-09-20T00:57:27Z` / `2026-09-20T01:03:07Z` |
| 총 소요 | 5분 40초 |
| Build job | 성공, 5분 15초 |
| Deploy job | 성공, 18초 |

Build, 정적 SEO·AdSense 검사, 하이브리드 비디오 경로 검사, Pages 아티팩트 업로드와 deploy가 모두 성공했다. Node.js 20 대상 액션을 Node.js 24에서 강제 실행한다는 deprecation annotation 1건이 있었으나 실행 결론은 성공이다.

## 운영 확인

운영 HTML과 번들을 `curl -fsSL`로 읽어 `/tmp/wl-adsense/integration/deploy/attempt-1/`에서 검사했다. 첫 조회에서 모두 충족돼 2분 간격 재시도는 수행하지 않았다.

| 운영 대상 | 확인 조건 | 결과 |
|---|---|---|
| `/ko/tools/pdf-editor/ocr/` | `"@type":"FAQPage"` 존재 | 통과 |
| `/ko/tools/pdf-editor/ocr/` | `PDF 전체를 검색 가능한 파일로 만들 수 있나요?` 존재 | 통과 |
| `/en/tools/pdf-editor/ocr/` | `"@type":"FAQPage"` 존재 | 통과 |
| `/en/tools/pdf-editor/ocr/` | `Can I make the whole PDF searchable?` 존재 | 통과 |
| `/ko/tools/text-merger/` 정적 가이드 본문 | 옛 메모 `결과를 보여준다` 부재 | 통과 |
| `/ko/tools/work-calculator/` 정적 가이드 본문 | 옛 문구 `실제 공휴일 날짜를 임의로 정해` 부재 | 통과 |
| `/ko/tools/image-studio/resize/` 정적 가이드 본문 | 고아 제목 `<h2>이미지 모자이크</h2>` 부재 | 통과 |
| `/ko/tools/hwp-editor/` 정적 HTML | `pagead2.googlesyndication.com` 부재 | 통과 |
| `/ko/tools/pdf-editor/` 정적 HTML | `pagead2.googlesyndication.com` 부재 | 통과 |
| `/ko/tools/document-compare/` 정적 HTML | `pagead2.googlesyndication.com` 부재 | 통과 |
| 운영 index의 메인 번들 `/assets/index-B5mMaf4H.js` | `startsWith("/tools/hwp-editor")` 존재 | 통과 |

## 미확인·범위 밖

- 이번 배포 지시의 운영 확인 항목에는 미확인 사항이 없다.
- AdSense 계정의 페이지 제외 목록·사이트 수준 Auto ads 설정, 실제 광고 요청·노출·모바일 overlay와 심사 결과는 읽기 전용 코드·정적 운영 확인 범위 밖이므로 확인하지 않았다.
- 제품 코드·테스트·설정은 수정하지 않았고, 커밋·브랜치 재작성·force push·워크플로 재실행도 수행하지 않았다.

