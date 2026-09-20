# WU-B 보고서 (adsense-followup-20260920, Muse)

- 작업 ID: adsense-followup-20260920 / WU-B
- 지시서: docs/jobs/todo/adsense-followup-20260920/PLAN.md v0.2 (§4 전부, §4-4)
- 브랜치: work/followup-b-20260920 · 기준 290a11f(=main)
- 최종 SHA: d7fb5f6 (커밋 3건, 테스트 파일별 의미 단위, push 없음)

## 변경 파일 (제품 코드·가이드 데이터·헬퍼·package.json 무수정)

1. 58e4629 — tests/unit/seo.test.ts
2. 7697853 — tests/unit/feature-locales.test.ts
3. d7fb5f6 — tests/ad-eligibility-smoke.mjs

## 명령·종료 코드 (순차 실행)

| 명령 | 종료 |
|---|---|
| node --experimental-strip-types --test tests/unit/seo.test.ts tests/unit/feature-locales.test.ts | 0 (9 pass / 0 fail) |
| env -u VITE_LOCAL_QA npm run build | 0 |
| RECOVERY_TEST_PORT=4192 npm run test:ads | 0 — status {pass 26, not-applicable 1, recorded 1, unverified 1}, fail 버킷 0, 전 시나리오 allowedExternal 0, 메타 runHead=290a11f 기록 |
| RECOVERY_TEST_PORT=4192 npm run test:ads -- --discriminate | 0 — DISCRIMINATION OK |

산출물(모두 git 제외, worktree 내부): tests/visual-artifacts/adsense-recheck/ad-smoke-results.json,
ad-smoke-discrimination.json, 캡처 PNG. 상수 ARTIFACT_DIR(adsense-recheck) 무변경.
참고: 스모크 실행 시점 HEAD가 기준 290a11f 그대로였으므로 meta.runHead=290a11f로 기록됨.
제품 소스 변경이 없어 dist는 동일 입력의 빌드이며, 테스트 파일 커밋은 dist에 영향을 주지 않음.

## 갱신한 기대값 목록 (이전 → 이후)

### seo.test.ts — title 기대표 (KO 14·EN 10 = 24개, 정확 문자열 단언 유지)

KO:
- /tools/video-studio: '비디오 스튜디오 | 영상 자르기·이어붙이기·음원 추출' → '온라인 동영상 편집 - 자르기·합치기·변환 | Worklazy Tools'
- /tools/audio-studio: '오디오 스튜디오 | 파형 편집·구간 자르기·피치 조절' → '온라인 오디오 편집 - 음소거·피치 조절 | Worklazy Tools'
- /tools/image-studio: '이미지 스튜디오 | 사진 편집·모자이크·콜라주·GIF' → '온라인 사진 편집 - 자르기·그리기·콜라주 | Worklazy Tools'
- /tools/image-privacy: '사진 메타데이터 제거 | EXIF·GPS 확인 및 삭제' → '사진 위치정보 삭제 - EXIF·GPS 확인 및 제거 | Worklazy Tools'
- /tools/qr-studio: 'QR 스튜디오 | QR 코드 만들기·카메라 스캔' → 'QR 코드 만들기·읽기 - 로고 삽입·사진 스캔 | Worklazy Tools'
- /tools/qr-studio/bulk: 'QR 일괄 생성 | Excel·CSV 행별 PNG·ZIP·라벨 PDF' → 'QR 코드 일괄 생성 - 엑셀·CSV로 대량 생성 | Worklazy Tools'
- /tools/data-converter: '표 데이터 변환기 | CSV·JSON·HTML 상호 변환' → 'CSV·JSON·HTML 표 변환기 | Worklazy Tools'
- /tools/document-compare: 'Word·HWP 문서 비교 - DOCX·DOC·HWP·HWPX Diff' → '워드·한글 문서 비교 - 수정 전후 차이 확인 | Worklazy Tools'
- /tools/pdf-compare: 'PDF 파일 비교 | 페이지 화면·추출 텍스트 차이' → 'PDF 파일 비교 - 화면·텍스트 변경사항 확인 | Worklazy Tools'
- /tools/excel-compare: 'Excel 파일 비교 - XLSX·XLSM·XLS·XLSB·CSV Diff' → '엑셀 파일 비교 - 값·수식·기준 항목별 차이 | Worklazy Tools'
- /tools/excel-cleaner: 'Excel 데이터 정리 - XLSX·XLS·CSV 클리너' → '엑셀 데이터 정리 - 공백·빈 행·중복 정리 | Worklazy Tools'
- /tools/document-generator: '워드 메일머지 | 템플릿 기반 문서 대량 생성기' → '워드 문서 일괄 생성 - 엑셀 명단으로 메일머지 | Worklazy Tools'
- /tools/office-editor: '브라우저 오피스 편집기 - DOCX·XLSX·PPTX 온라인 편집' → '온라인 문서 편집 - Word·Excel·PowerPoint | Worklazy Tools'
- /tools/text-merger: '텍스트 병합 | 직접 입력·TXT 파일 순서대로 합치기' → '텍스트 파일 합치기 - TXT·메모 순서대로 병합 | Worklazy Tools'

EN (pdf-compare·excel-compare·excel-cleaner·document-generator 4건은 기존 기대값이 실제와 일치해 유지):
- /tools/video-studio: 'Video Studio | Trim, Join & Extract Audio' → 'Online Video Editor - Trim, Merge & Convert | Worklazy Tools'
- /tools/audio-studio: 'Audio Studio | Waveform Editing, Trimming & Pitch' → 'Online Audio Editor - Mute, Trim & Pitch Shift | Worklazy Tools'
- /tools/image-studio: 'Image Studio | Edit Photos, Mosaic, Collage & GIF' → 'Online Photo Editor - Crop, Draw & Collage | Worklazy Tools'
- /tools/image-privacy: 'Photo Metadata Remover | Inspect & Remove EXIF and GPS' → 'Remove Photo Location - Delete EXIF & GPS Data | Worklazy Tools'
- /tools/qr-studio: 'QR Studio | Create & Scan QR Codes' → 'QR Code Generator & Scanner - Add Logo | Worklazy Tools'
- /tools/qr-studio/bulk: 'Bulk QR Generator | Excel & CSV to PNG, ZIP and Label PDF' → 'Bulk QR Code Generator - Excel & CSV | Worklazy Tools'
- /tools/data-converter: 'Table Data Converter | Convert CSV, JSON & HTML' → 'CSV, JSON & HTML Table Converter | Worklazy Tools'
- /tools/document-compare: 'Document Compare | Compare DOCX, DOC, HWP & HWPX' → 'Compare Word & HWP Documents - Track Changes | Worklazy Tools'
- /tools/office-editor: 'Browser Office Editor | Edit DOCX, XLSX & PPTX' → 'Online Office Editor - Word, Excel & PowerPoint | Worklazy Tools'
- /tools/text-merger: 'Text Merger | Combine Pasted Text & TXT Files' → 'Merge Text Files - Combine TXT & Notes | Worklazy Tools'

### seo.test.ts — FAQ 개수

- document-compare: 3 → 5 (KO/EN 실측 5)
- PDF 편집기 루트(/tools/pdf-editor): 2 → 4 (KO/EN 실측 4)
- KO/EN 동수 검사는 추가만: 5개 루트 루프에 ko/en 길이 동등 단언 추가, 7개 루트(text-merger·excel-merger·excel-compare·excel-cleaner·pdf-editor·video-studio·qr-studio/bulk) 대상 별도 동수 루프 추가. 기존 개수·내용 단언 유지.

### feature-locales.test.ts — guides.json 이관

- features 단언 유지: noLeftRows KO/EN, showLeftRows_one/Show, duplicateGuidance KO/EN, fullValue, 금지 패턴(doesNotMatch).
- 삭제(이관): features.json의 guide.blocks·guide.faq 읽기 2행 (TypeError 원인).
- 추가(guides.json excelCompare 대상): title·description 비어 있지 않음, blocks≥1, faq는 객체이며 배열 아님,
  pathFaqs['/tools/excel-compare']가 faq_5 포함. 선택 FAQ 결합 텍스트에 KO/EN 모두
  중복 키(/중복\s*키|duplicate key/i), 독립 목록(/독립된 목록|independent lists/),
  자동 연결 안 함(/자동으로 연결|not matched automatically/) 포함 확인.

### ad-eligibility-smoke.mjs

- 메타: 'reused c40c2eb build' 하드코딩 삭제 → buildProvenance()로 runHead(git rev-parse --short HEAD),
  distMtime(dist/index.html mtime)을 정확한 키 이름으로 기록. 증명 문구 없음.
- 판별 모드: isExpectedStubFailure(error) = AssertionError ∧ code ERR_ASSERTION ∧ 정확한 스텁 기대 메시지 포함일 때만
  discriminated. assertNoRealNetwork는 별도 실행, 그 실패(networkFailure 기록)는 discriminated와 AND되어
  판별 성공으로 흡수되지 않음. 성공·실패 모두 counters{attempt, stub, blocked, allowedExternal} 4계수 + JSON 기록.
- S5 not-reproduced 분기: assertNoRealNetwork 추가(실패 시 계수 첨부 후 throw → runCase fail로 전달).
- runCase: 실패 반환에 error.counters가 있으면 counters로 전달.

## 후속 (Astra 차단 반영, cc95a94)

- 지적: tests/unit/feature-locales.test.ts의 한국어 정규식 /자동으로 연결|…/ 은 긍정문
  "자동으로 연결합니다"에도 통과하므로 부정 의미를 검사하지 못함.
- 수정(1행, tests/unit/feature-locales.test.ts:70): 한국어 측을 실제 guides.json 문장의 정확한
  부정 구절 /자동으로 연결한 것은 아닙니다/ 로 교체 (영어 not matched automatically 유지).
  ※ 지시 예시 /자동으로 연결하지 않/ 은 실제 문장("…연결한 것은 아닙니다")과 맞지 않아
  실측 문구 기준으로 택함. 기대값 하향 아님(단언 강화).
- 검사: node --experimental-strip-types --test tests/unit/feature-locales.test.ts → 4 pass / 0 fail.
- Mutation 확인: guides.json 사본에서 faq_5 문장을 "자동으로 연결합니다"로 바꾼 뒤 테스트 사본을
  분리 구조(worktree 내부 scratch-mut, 원본 무수정·사후 삭제)에서 실행 →
  구 정규식은 통과(true, 차단 사유 재현), 신 정규식은 'ko selection covers no automatic matching'에서
  실패(exit 1). 데이터 파일 원상 유지(scratch 삭제, git status clean except committed test file).
- 커밋: cc95a94 test(locales): assert negated auto-link wording in KO (1개).
  통합 제출 고정 커밋: 58e4629·7697853·d7fb5f6·cc95a94.

## 미완료·이월

- 없음(WU-B §4 범위 전부 완료). 전체 unit·test:static·시각 재확인은 통합 단계(Sol) 범위.
- push·통합·배포는 금지事项이므로 미수행 — 통합 담당(Sol)에 고정 커밋 58e4629·7697853·d7fb5f6 제출.
- 권한 거부·실패 우회 없음. npm ci 미실행(준비된 node_modules 사용), /tmp 미사용.

서명: Muse
