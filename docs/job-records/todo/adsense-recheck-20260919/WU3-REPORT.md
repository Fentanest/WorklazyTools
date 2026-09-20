# WU3 실행 보고

## 기준과 범위

- 작업 ID: `adsense-recheck-20260919 / WU3`
- 구현자: Codx (Sol)
- worktree / branch: `/home/better0101/projects/wt-adsense-guides` / `work/adsense-guides-20260919`
- 시작 HEAD: `1d6302785ffb16163a501948d465f0c687683e85`
- WU1 고정 이력: `bc252d3`, `1d63027`
- 정본 PLAN: v0.3, SHA-256 `40c69eeb25b6ec4c7b58832070d94b84eef493c4915e0f50875e5b49a360c75d`
- 최종 SHA: `73cdb271241d7c1f0adf3386487f134b6fb78fdd`
- 의미 단위 커밋:
  - `da3f3bafd1426e72ea07916300dc7b7c569f7a23` — generated evidence 추적 해제 + `evidence/` ignore
  - `73cdb271241d7c1f0adf3386487f134b6fb78fdd` — 내부 부산물 archive 이동 + root/scratch ignore

## 실행 기록

| 명령·범위 | 종료 코드 | 결과 | 로그·근거 |
|---|---:|---|---|
| `pwd; git status --short --branch; git rev-parse HEAD; sha256sum ...` | 0 | 올바른 worktree, clean, HEAD·정본 해시 일치 | 세션 출력 |
| `git ls-files evidence scratch 'patch_*.py' test-drag.html integration_status.md` | 0 | 138개 | `WU3-CLASSIFICATION.md` 138행 |
| `rg -n 'evidence\|scratch\|patch_.*py\|test-drag\|integration_status' src scripts tests package.json .github` | 0 | PDF compare fixture 참조 있음; 이동 대상 참조 없음 | 세션 출력 |
| 임시 스캐너 첫 경로 실행 2회 | 1 | 임시 스크립트 경로 지정 실수; 대상 파일 처리 전 중단 | 세션 출력 |
| 임시 스캐너 ZIP 1차 구현 | 1 | `[Content_Types].xml` glob 해석 문제; 대상 파일 처리 전 중단 | 세션 출력 |
| `node /tmp/wl-adsense/wu3/scan-sensitive.mjs` (수정 후) | 0 | 138개 전수; 실제 민감정보 0; PDF 4개 미확인 | `/tmp/wl-adsense/wu3/sensitive-scan.json` |
| `node /tmp/wl-adsense/wu3/inspect-matches.mjs` | 0 | 후보를 마스킹 문맥으로 재판별; 모두 오탐/공개 OSS 표기 | `/tmp/wl-adsense/wu3/masked-match-contexts.json` |
| `node tests/helpers/pdf-compare-fixtures.mjs /tmp/wl-adsense/wu3/corpus` | 0 | 빈 격리 경로에 fixed fixtures 8 / 10 pages 생성 | `/tmp/wl-adsense/wu3/fixture-generation.log` |
| manifest 참조 PDF 존재 검사 | 0 | 8개 모두 존재 | `/tmp/wl-adsense/wu3/fixture-manifest-check.log` |
| 원본/격리 manifest `cmp`; 폰트·pdf-lib 확인 | 0 | byte 동일; 두 의존성 존재 | `/tmp/wl-adsense/wu3/fixture-status.log` |
| `git rm --cached` + archive 이동 + HEAD blob `cmp` | 0 | evidence 42개 디스크 보존; archive 96개 원본과 byte 동일 | 커밋 `da3f3ba`, `73cdb27` 및 세션 출력 |
| 최초 최종 검사 중 `git check-ignore -q` 다중 경로 호출 | 128 | 지원되지 않는 옵션 조합; 저장소 검사는 계속했으나 이 하위 판정은 무효 | 세션 출력 |
| `git check-ignore -v` 및 최종 정합 검사 재실행 | 0 | 대상 추적 0, evidence 42, archive 96, 분류 138행, 보호 경로 변경 0, clean status | `/tmp/wl-adsense/wu3/{ignore-check-final,final-verification,git-status-final,git-log-final}.log` |

## 민감정보 판정

- 텍스트 6종 패턴 후보는 모두 데이터 구조·해시·상수·제품 문구·공개 OSS 저자 표기로 판별됐다. 실제 비밀·개인정보 발견은 없다.
- XLSX 3개는 ZIP package 10개 항목 각각을, `multi.zip`은 목록과 내부 XLSX 2개(각 10개 항목)를 검사했다. sharedStrings, worksheet inline string 영역, comments 존재 여부, docProps 작성자 필드, 관계 target을 포함했다.
- PDF 13개는 `pdftotext` 전 페이지, `pdfimages -list`, `pdfdetach -list`를 적용했다. 4개는 분류표의 미확인 목록으로 남긴다.
- 민감정보 발견에 따른 처리 중단 파일은 없다.

## 검증 범위 판정 (F)

| 검사·범위 | 판정 | 근거·대상 상태 | 결과·증거 |
|---|---|---|---|
| 138개 전수 분류·민감정보 검사 | 이번에 실행 | WU3 직접 변경 입력 | 통과(4 PDF 내용 미확인 별도) |
| fixture 격리 재생성·manifest 비교 | 이번에 실행 | 추적 해제 전 원본과 생성기 | 통과 |
| 참조 grep·git status·WU1 이력 | 이번에 실행 | 이동·추적 해제 정합 필수 | 통과; `bc252d3`·`1d63027`이 HEAD 조상, status clean |
| 제품 build/unit/static/UI smoke | 적용 대상 아님 | 제품 소스·테스트·package 변경 금지, 추적 상태만 변경 | 미실행 |
| 최종 통합 검사 | 최종 통합 | PLAN §7의 WU4 담당 | 이월 |

## 미확인·잔여 사항

- 내용 기반으로 완료 판정할 수 없는 PDF 4개는 분류표에 미확인으로 기록했다. 생성기 출처·재생성 성공은 별도 근거이며 내용 검사를 대체하지 않는다.
- 원본 작업트리의 untracked/로컬 수정은 대상 밖이며 보존 상태다.
- push·통합·배포는 수행하지 않는다.
- 차단 결함은 없다. WU3 구현·범위 내 검증은 완료됐고, WU4 최종 통합 검사는 이월한다.
