# 작업지시서 초안 — U4 PDF 마무리 (2026-09-05)

**상태: 정본 (2026-09-07 03:20 정본화 — Codex astra 12차 반박 `task-mtq4cub1-qsqe6k` 에서 "Claude–Codex 간 이견 0 · [정본화 가능]" 선언. 우선순위: 「정본화」 절 > v13 > v12 > … > v2 확정 사항 > 초안 본문. 구현 = sol(U4-0~8 단계별 디스패치), 검수 = astra.)**
기준 후보: `ui-migration` **`2b1aabdc840ea01458ddefef46241130a587dd9d`**(B5b 종료 커밋 — Codex 2차 반박 실측으로 갱신. v2 의 `9c2b38c` 는 낡음). B6·B-shared 가 pdf-editor 표면을 더 바꿀 수 있으므로 정본화 시 재확정한다.
근거: 사용자 제공 신규 기능 프롬프트(2026-09-03, 대화 원문 U4 절) + 로드맵 정본 `new-tools-roadmap-20260903.md` 순서 4항.

## 선행 의존 (로드맵 정본 26줄 — 사용자 결정)

U3부터의 신규 도구는 **shadcn 기반으로 구현**한다. U4 화면은 처음부터 shadcn primitive 로 짓고 legacy CSS 클래스를 새로 방출하지 않는다.

**B5a 순서 충돌은 해소됐다**(v1 쟁점 1항 삭제) — B5a(audio+pdf-editor UI 전환)는 `9c2b38c` 로 완료·Gemini 검수 통과했다. U4 는 shadcn 으로 전환된 pdf-editor 표면 위에서 시작한다.

## 사용자 원 요구사항 (프롬프트 원문 요지 — 임의 생략 금지)

경로 후보: `/tools/pdf-editor/finish` · `/page-numbers` · `/watermark` · `/stamp`

1. **페이지 번호** — 시작 번호 · 총 페이지 수 표시 · 접두어/접미어 · 표지 제외 · 특정 페이지부터 시작 · 페이지 범위 · 홀수/짝수 · 위/아래 · 왼쪽/가운데/오른쪽 · 글꼴 크기·색상·여백 · **회전 페이지와 혼합 페이지 크기 대응**
2. **머리말·꼬리말** — 왼쪽/가운데/오른쪽 영역 · 여러 줄 · `{page}`·`{pages}`·`{filename}`·`{date}` 토큰 · 페이지 범위 · 표지 제외 · 글꼴·크기·색상
3. **워터마크** — 텍스트 또는 이미지 · 위치 · 회전 · 투명도 · 반복 타일 · 단일 중앙 배치 · 페이지 범위 · **앞쪽 또는 뒤쪽 배치**
4. **도장·서명 이미지** — 페이지 위에서 직접 이동·크기 조절 · 선택 페이지 적용 · 같은 위치를 여러 페이지에 복제 · 가로세로 비율 고정 · 실행 취소/다시 실행. **공인 전자서명·암호학적 서명이 아님을 화면에 명시**(로드맵 명시 제외 68줄).
5. **제거·평탄화** — PDF metadata · 주석 · 양식 필드 · 첨부파일 제거, 주석·양식·페이지 래스터 평탄화를 **지원 가능한 범위에서** 구현.

로드맵 단위 공통 완료 기준 54줄: "기능 요구를 임의 생략하거나 UI 목업으로 대체하지 않는다. 정확 구현이 어려운 항목은 **검증 결과·제한을 기록하고 지원 표시에서 제외**한다."

## 현행 코드 실측 (v2 — Codex 1차 반박으로 정정, 기준 `9c2b38c`)

1. **워터마크·페이지 번호는 이미 최소 형태로 존재한다** — 신규 구현이 아니라 **기존 `decoratePdf` 확장**이 이 작업의 실체다. `PdfOutputOptions { watermarkText?, pageNumbers?, imagesAlreadyNormalized? }`(`types.ts:30-34`)의 **불리언 옵션은 있고, 위치·크기·범위 등 상세 옵션이 없다**(v1 의 "옵션 없음"은 부정확 — 정정).
2. **고정값 전체 목록**(`pdf.worker.ts:92-117` + `pdfWorkerClient.ts:119-134`):
   - 이미지 워터마크: 중앙, `width = min(MediaBox width × 0.72, PNG width × 0.55)`, 비율 유지 높이, `-32°`, opacity `0.2`.
   - 페이지 번호: `9pt`, `y=12`, 중앙, `${index+1} / ${pages.length}`, RGB `0.35/0.35/0.38`, opacity `0.9`.
   - **PNG 생성 자체의 고정값**(v1 누락 — 정정): system-ui 600/46px, 폭 420~1,800px, 높이 92px, RGBA alpha `0.82`, 최대 120 UTF-16 code unit.
   - 따라서 **현행 워터마크 글자의 실효 alpha 는 `0.2` 가 아니라 PNG 내부 alpha(`0.82`)와 곱해진 값**이다. 호환 보존 시 이 곱을 그대로 재현해야 한다.
3. **회전과 CropBox 원점을 모두 무시한다**(v1 은 회전만 지적 — 정정). `getSize()` 는 **CropBox 가 아니라 MediaBox 크기**를 반환한다(`pdf-lib/cjs/api/PDFPage.js:288-295`). 그리기 API 는 페이지 회전을 참조하지 않는다(`grep -c 'this.getRotation()' … PDFPage.js` → **0**).
   - Codex 재현 probe(비영점 CropBox·회전 4종, PDF.js viewport 변환):
     ```
     rotation=0   viewport=[400,600] canvas corners→PDF [[50,700],[450,700],[50,100],[450,100]]
     rotation=90  viewport=[600,400] canvas corners→PDF [[50,100],[50,700],[450,100],[450,700]]
     rotation=180 viewport=[400,600] canvas corners→PDF [[450,100],[50,100],[450,700],[50,700]]
     rotation=270 viewport=[600,400] canvas corners→PDF [[450,700],[450,100],[50,700],[50,100]]
     ```
4. **한글 불가 — 실제 재현됨**: `Error: WinAnsi cannot encode "한" (0xd55c)`. U3 폰트 공급 경계(로드맵 R4)를 재사용해야 한다. `@pdf-lib/fontkit` 1.1.1 은 이미 의존에 있다(`package.json:45`).
5. **모드·라우팅**(`App.tsx:55-59`·`:129`, `types.ts:1`): `organize`(기본) / `split`→redirect / `image-to-pdf` / `pdf-to-image` / `convert`. `PdfToolMode` 는 4개 리터럴 유니온. **navigation 은 4칸 하드코딩**(`PdfEditorPage.tsx:30-35,94`) — finish 추가 시 **5칸이 되므로 B5a 에서 넣은 모바일 페이드 단서를 재실측**해야 한다.
6. **스택 버전**(`package.json:45,77,78`): `@pdf-lib/fontkit` 1.1.1 · `pdf-lib` ^1.17.1 · `pdfjs-dist` ^6.2.108.
7. **feature 규모**: `src/features/pdf-editor/` **12파일 2,562줄**(v1 의 2,471 은 `9c2b38c` 부모 시점 값 — 정정).
8. **모드마다 처리 경계가 다르다**(v1 누락 — 취소 설계의 전제): organize·image-to-pdf 는 `pdf.worker` / **pdf-to-image 는 PDF.js 렌더 + JSZip 으로 worker client 를 거치지 않고**(`PdfImagePanel.tsx:149-164`) / convert 는 PDF.js·Tesseract + `pdfOffice.worker` 또는 `pdf.worker`(`PdfConvertPanel.tsx:57-85`).

## Gemini 외부 조사 검증 (2026-09-05, Claude 실측 + Codex probe 교차)

| 항목 | Gemini 주장 | 판정 | 근거 |
|---|---|---|---|
| 1 좌표 | `/Rotate`·CropBox 자동 보정 없음 → 수동 변환 | **확인** | `this.getRotation()` 사용 0건. Codex 회전 4종 probe(위). |
| 2 텍스트 투명도 | `drawText` opacity 미지원 → ExtGState 수동 주입 | **기각(2중 확인)** | `PDFPageOptions.d.ts:19-25` 에 `opacity?: number` 실재. `PDFPage.js:860-875` 가 **opacity 로 graphics state 를 내부 생성**. Codex 저장·재개방 probe: `extGState=<</Type /ExtGState /ca 0.37>>` 자동 생성 확인. 현행 `pdf.worker.ts:114` 도 이미 사용 중. |
| 3 배경 배치 | `Contents` 앞에 삽입 | **가능하나 절차 불완전 — 보강** | `PDFPageLeaf.js:142-169`(단일 stream→array 정규화·`q/Q` 래핑) · `PDFArray.js:22-24 insert`. Codex 순서 probe: `["q","BACKGROUND","q","ORIGINAL","Q","HEADER","Q"]`, `backgroundBeforeOriginal=true`. **단, `normalize()+insert(0,ref)` 만으로는 같은 stream 이 두 번 실행된다** — 기존 위치에서 `remove` 후 이동해야 하고, foreground(머리말 등)가 같은 캐시 stream 에 들어가면 함께 앞으로 밀린다. |
| 4 제거 | catalog/node `delete()` | **불충분 — 상향** | `PDFDict.d.ts:52 delete()` 는 실재하나, Codex probe 에서 **unlink 후에도 첨부 payload 가 orphan stream 으로 출력에 남았다**(`orphanAttachmentPayloadStillDecoded: true`). 새 `PDFDocument` 로 재구축했을 때만 제거됨(`rebuiltAttachmentPayloadDecoded: false`). |
| 5 래스터 | 150DPI·JPEG·직렬 스트리밍 | **미검증 + 반례** | 수치는 미채택. 게다가 **`pdf-lib.save()` 가 최종 전체 `Uint8Array` 를 만들므로 "페이지 직렬 스트리밍"만으로 메모리 문제가 해결되지 않는다**(Codex). |
| 6 좌표 변환 | `viewport.convertToPdfPoint` | **확인·경로 정정** | `pdfjs-dist/types/src/display/page_viewport.d.ts:136` · `build/pdf.mjs:912`(Gemini 가 댄 `display_utils.d.ts` 아님). |
| 7 현행성 | pdf-lib 방치, `@pdfme/pdf-lib` 포크 | **부분 정정 · 교체 안 함** | `npm info`: pdf-lib **1.17.1 · MIT · 2022-05-12**(Gemini 의 2021-11 부정확). `@pdfme/pdf-lib` **6.1.12 · MIT · 2026-07-23** 실재. **U4 에서 교체하지 않는다** — 필요한 API 가 현행에 전부 실재하고, PDF 출력은 QR 라벨 등도 소비해 회귀 표면이 U4 범위를 넘는다. 교체는 backlog 별도 단위. |

## 확정 사항 (v2 — Codex 1차 반박 전건 반영)

**1. 폰트 정책 — v1 의 "ASCII/CJK 분기·4.6MB"는 폐기한다.**
Codex 실측(854B 입력 PDF, 동일 조건):
```json
{"fontFileBytes":4644748,"inputPdfBytes":854,"ascii":1227,"cjk-uniform":3833519,
 "cjk-hybrid":3833532,"cjk-double":7665725,"deltaAscii":373,
 "deltaCjkUniform":3832665,"deltaCjkHybrid":3832678,"deltaCjkDouble":7664871}
```
- **실제 증가량은 4.6MB 가 아니라 약 3.83MB**(4,644,748B 는 OTF 원본 크기일 뿐).
- **hybrid(한글 머리말 Noto + 숫자 번호 Helvetica)가 단일 Noto 보다 13B 더 크다** → 혼합 문서에서 표준 폰트를 섞을 **용량 이점이 없다**. v1 의 분기 설계는 근거를 잃었다.
- **`embedFont` 를 두 번 부르면 7.66MB** — 중복 임베드가 실제로 발생하므로 문서당 인스턴스 1개를 공유해야 한다.
- ASCII/CJK 이분법은 문자 집합을 잘못 모델링한다(Codex coverage probe): `Résumé €`·`Русский` 는 Helvetica 실패·Noto 성공, `Δοκιμή`(ί)·이모지·`𠮷` 는 **Noto 도 실패**.

**→ 확정**: 분류 기준은 ASCII/CJK 가 아니라 **"토큰 치환을 마친 모든 문자열의 glyph coverage"**다. ① `{filename}`·`{date}` 까지 치환한 뒤 ② Helvetica `encodeText` 가능 여부 검사 ③ 실패 시 Noto `getCharacterSet()` 으로 전 Unicode scalar 검사 ④ **Noto 에도 없는 글자는 tofu 로 조용히 내보내지 말고 위치를 사용자에게 알린다** ⑤ 한 문서에서 하나라도 Noto 가 필요하면 머리말·번호·텍스트 워터마크가 **Noto 인스턴스 하나를 공유** ⑥ 안내 문구는 "출력당 약 3.8MB 증가할 수 있음", 결과가 여럿이면 결과 수만큼 예상치 표시 ⑦ 폰트 fetch 도 조건부이며 취소 signal 을 받는다. `export-groups` 는 결과 PDF 마다 별도 `PDFDocument`(`pdf.worker.ts:72-79`)이므로 출력마다 비용이 든다는 점을 안내에 반영한다.
**subset 재시도 금지**(로드맵 R4 에서 한글 파손으로 기각 — 이미 기각된 길).

**2. worker 취소 — "신설"이 아니라 "이관"이다(v1 정정).**
공용 계약이 **이미 구현돼 있다**: `src/utils/workerLifecycle.ts:7-87`(signal 12 · terminal guard 29·43-49 · abort listener 제거 47 · terminate 48 · AbortError 53 · pre-aborted 55-56 · postMessage 예외 정리 82-86). 소비처는 `excelCleanerClient.ts`·`excelCompareClient.ts`. 이것이 로드맵 확정 4항 ②의 실제 구현이다.
**→ 확정**: F0b 는 "취소 계약 신설"이 아니라 **PDF 경로의 공용 lifecycle 이관**이다. 단순 교체는 불가 — PDF worker 는 `{type:"error", error:{message,code}}` envelope 을 쓰는데 `runModuleWorker`(`:59`)는 flat `code/details` 를 기대하고, PDF client 는 warnings·오류 메시지 현지화도 수행한다(`pdfWorkerClient.ts:29-61`). 따라서 **envelope adapter 를 추가하거나 PDF envelope 을 공용 형식으로 이관**하고, signal 은 기존 positional 인자를 깨지 않도록 **마지막 optional 인자 또는 options object** 로 넣는다. `file.arrayBuffer()` 전후와 파일 loop 사이에도 abort 를 검사한다. raster 경로는 `renderTask.cancel()` 과 loading task 정리를 별도로 연결한다(현재 signal 을 받는 것은 썸네일 렌더뿐 — `pdfPreview.ts:137-165`; 내보내기 렌더 `:210-238`·`:356-363` 에는 취소 경로가 없다).
**→ 경계**: **취소 UI 는 새 finish 모드만 소유**한다. 기존 4개 모드에 취소 버튼을 추가하는 것은 「명시 제외」의 기능 변경에 해당한다. 기존 모드는 signal 미전달 시 **동작·오류 code·warnings·transfer 가 완전히 동일**해야 하며 기존 PDF 스모크를 전량 재실행해 증명한다.

**3. 기존 organize 모드 — v1 잠정안(엔진 위임 + 안내 문구)을 폐기한다.**
v1 안은 「명시 제외」와 정면 충돌한다(Codex 지적 타당): 벡터 전환·회전 보정·새 폰트 적용은 **출력 동작 변경**이고, "세부 설정은 PDF 마무리에서" 안내는 **문구 변경**이다.
**→ 확정**: 기존 UI·문구를 **그대로 둔다**. 공용 엔진에 **`legacy-organize` compatibility preset** 을 두어 다음을 정확히 보존한다 — 현행 PNG raster 생성 · MediaBox 비보정 좌표 · `-32°` · PNG alpha `0.82` × `0.2` · 숫자 Helvetica 9pt `y=12` · 현재 색·opacity·형식 · 전 페이지 · foreground. 새 finish 모드만 벡터·회전/CropBox 보정·상세 설정을 쓴다. 안내 링크는 넣지 않는다(상단 finish 탭으로 발견 가능). **기존 두 옵션을 실제로 켜고 출력을 단언하는 legacy compatibility 스모크를 추가**한다 — 현행 `TEST_SCOPE=pdf` 는 두 옵션을 켜지 않는다.

**4. 배경 워터마크 stream 계약(검증 3항 보강).**
① 배경 operator 를 **독립 content stream** 으로 생성 ② **기존 위치에서 `remove` 한 뒤 `Contents[0]` 으로 이동**(그냥 `insert` 하면 같은 stream 이 두 번 실행) ③ foreground 는 **별도 stream** 에 기록(같은 캐시 stream 에 들어가면 함께 앞으로 밀림) ④ **빈 Contents · 단일 stream · 다중 stream · 비정상 Contents** fixture 를 각각 저장·재개방 ⑤ object 순서 단언뿐 아니라 **PDF.js/Poppler 렌더 픽셀로 앞뒤 관계 확인** ⑥ 저수준 조작 실패 시 조용히 앞쪽 배치로 바꾸지 말고 사용자에게 알린다.

**5. 제거 보증 수준(검증 4항 상향).** "저장 후 다시 열어 없음"은 **불충분**하다 — orphan stream 이 남는다.
보증 수준: ① Info dictionary + XMP metadata 모두 제거 ② `/EmbeddedFiles`·`/Filespec`·`/EmbeddedFile`·catalog/page `/AF` 제거 ③ `/AcroForm`·Widget·page `/Annots` 제거 ④ **orphan 객체까지 출력하지 않도록 새 문서로 재구축** ⑤ PDF.js 고수준 검사 **와** 전체 indirect-object 검사를 함께 통과 ⑥ arbitrary annotation flatten 은 검증 전 지원 표시 금지 ⑦ XFA·깨진 appearance stream 등 미지원 범위 명시.

**6. 대용량 경계·래스터 정책(v2 — Gemini 조사 검증 후 반영. 일부는 F4b 벤치로 확정).**
현재 PDF.js loader 는 파일 전체를 `ArrayBuffer` 로 읽어 캐시하고(`pdfPreview.ts:43-63`), worker client 는 선택 입력을 전부 버퍼화하며(`pdfWorkerClient.ts:64-69`), worker 는 source 들을 동시에 `Map` 에 유지한다(`pdf.worker.ts:119-126`). 게다가 `pdf-lib.save()` 가 최종 전체 배열을 만든다.

**→ 확정**: ① finish 다중 파일은 **concurrency 1** ② active preview 외 PDF.js document cache 해제 ③ **캔버스 한 변·면적 상한을 초과하면 DPI 를 자동 하향하고, 하향해도 초과하면 거부**(조용한 빈 렌더 방지 — 아래 검증 1항) ④ 모바일/데스크톱 별 benchmark 와 peak heap 기록 ⑤ 부분 결과와 Object URL/OPFS 정리 ⑥ 결과 2개 이상일 때 C2(`src/utils/fileNameSafety.ts`)·C3(`src/utils/zipArchive.ts`)를 쓰는 단계 명시 ⑦ **취소는 `RenderTask.cancel()` → `PDFPageProxy.cleanup()` → `PDFDocumentProxy.destroy()` 순서**로 연결하고 `RenderingCancelledException` 은 삼킨다.

**→ F4b 벤치로 확정할 수치**: 입력 bytes · 페이지 수 · 예상 출력 픽셀 총량의 **경고·거부 임계값**. 아래 계산이 출발점이다(Claude 실측 — `node -e` 산출).

| DPI | A4 픽셀 | 면적 | RGBA raw heap/page |
|---:|---|---:|---:|
| 150 | 1241×1754 | 2.18M px | 8.3 MiB |
| 200 | 1654×2338 | 3.87M px | 14.8 MiB |
| 300 | **2481×3508** | **8,703,348 px** | 33.20 MiB |

**⚠ v3 정정 — raw 메모리와 출력 용량을 혼동하지 말 것**(Codex 2차 실측): 위 표의 33.20MiB 는 **캔버스 raw 메모리**이지 출력 용량이 아니다. 300DPI A4 한 장의 **실제 인코딩 결과**는 내용에 따라 크게 다르다.

| 페이지 내용 | PNG | JPEG q85 |
|---|---:|---:|
| 빈 페이지 | 0.04 MiB | 0.05 MiB |
| 문서(텍스트·벡터) | 1.79 MiB | 1.31 MiB |
| 노이즈(스캔·사진형) | **28.10 MiB** | 5.93 MiB |

또한 A4 세로는 `ceil` 때문에 3507 이 아니라 **3508**이다(`pdfPreview.ts:431` 이 양변을 `ceil`). **즉 "PNG 기본값이면 무조건 용량 폭발"은 문서형에서 과장이고, 스캔·사진형에서만 참이다.** 기본값 판정은 여전히 F4b 벤치로 미루되, **논거는 "raw 메모리"가 아니라 "내용 유형별 인코딩 실측"으로 교체**한다. F4b 는 중간 이미지뿐 아니라 **최종 PDF bytes** 도 재고, fixture 매트릭스를 **blank · text-vector · photo-scan · 투명도** 4종으로 고정한다.

## Gemini 대용량·fixture 조사 검증 (2026-09-05, Claude 실측)

| 항목 | Gemini 회신 | 판정 | 근거 |
|---|---|---|---|
| 1 캔버스·버퍼 한계 | 한 변 32,767px · 면적 Chrome/Safari 16,384² · **iOS Safari 4,096²** · 초과 시 **예외 없이 빈 이미지** · ArrayBuffer 실질 2GB | **채택(수치는 F4b 에서 실측 재확인)** | 계획 영향이 큰 것은 "예외 없이 조용히 실패"다 → **사전 상한 검사를 필수 계약으로 승격**(위 ③). iOS 4,096² = 16.78M px 이므로 A4 300DPI(8.70M px)는 통과하지만 **A3·대형 페이지는 초과 가능** — 페이지별로 검사해야 한다. |
| 2 래스터 DPI·포맷 | **300 DPI 기본 · 기본값 PNG**(FADGI/NARA 근거) | **부분 채택 — 기본값은 기각** | **출처는 진짜지만 용도가 다르다.** FADGI·NARA 는 **영구 보존 아카이빙** 기준이고, 우리 용도는 "텍스트 계층을 제거한 결과물을 사용자가 내려받는 것"이다. 300DPI×PNG 무손실은 페이지당 33.2MiB heap 에 출력 용량이 폭발해 브라우저 제약과 충돌한다. **→ DPI 는 선택지(150/200/300)로 제공하되 기본값과 포맷 기본값은 F4b 벤치(용량·가독성·peak heap)로 확정**한다. 아카이빙 기준을 그대로 제품 기본값으로 쓰지 않는다. |
| 3 pdfjs 자원 해제 | `cancel()`→`cleanup()`→`destroy()`·`RenderingCancelledException` | **확인** | 저장소 실측: `api.d.ts:1644 RenderTask.cancel(extraDelay?)` · `:1526 PDFPageProxy.cleanup(resetStats?): boolean` · `:1165 PDFDocumentProxy.cleanup(keepLoadedFonts?)` · `:827`·`:1607 destroy()` · `display_utils.d.ts:102 RenderingCancelledException`(Gemini 가 든 `api.d.ts` 아님 — 경로 정정). |
| 4 손상·암호 fixture | qpdf(Apache-2.0) 명령 5종 | **v3 정정 — qpdf 불필요** | 도구 미설치는 사실이나(`qpdf/mutool/pdftk` 전부 MISSING, `gs` 만 존재), **"암호 fixture 는 qpdf 가 있어야 한다"는 v2 판정은 틀렸다.** Codex 2차가 **Node 내장 `crypto` 만으로 PDF Standard Security Handler R2 fixture 를 생성해 PDF.js 로 검증**했다: open-password 915B·permission-restricted 916B, 무암호 열기 → `PasswordException`(code 1), 정답 암호 → OPEN(권한 8종), 빈 암호 restricted → OPEN(권한 4종). truncated/xref/malformed 도 Node 만으로 생성됨. **→ F-fix 는 "도구 확보"가 아니라 "fixture 생성기·암호 세대·기대 oracle 확정"이다.** qpdf 는 **AES-256/R6 교차 fixture 를 추가할 때만** 생성 전용 oracle 로 확보한다(R2/RC4 만으로 현대 AES 암호 PDF 를 대표할 수 없음). |
| 5 배경 stream 부작용 | `q/Q` 불균형 · OCG 레이어 · 태그된 PDF 리딩 오더 | **채택(경고로 편입)** | 확정 4항의 fixture 목록에 **`q/Q` 불균형 문서 · OCG 레이어 문서 · 태그된 PDF** 를 추가한다. 배경 stream 은 독립 `q…Q` 로 감싼다. ~~위 세 유형에서 깨짐이 확인되면 배경 배치를 거부~~ → **확정 25항으로 정정**: 사전 완전 판정은 무겁고 오탐이 나므로 **거부가 아니라 경고 후 사용자 선택**. 단 **결과 리오픈 검증에서 실제 파손이 확인되면 그 결과는 제공하지 않는다**(사전 경고 ≠ 사후 검증). 조용한 앞쪽 폴백은 여전히 금지. |
| 6 subset 재검토 | **미해결** — fontkit upstream 한계, `@pdfme/pdf-lib` 도 `subset:false` 권장 | **확인 — 재시도 금지 유지** | 로드맵 R4 의 기각 판정이 여전히 유효하다. 확정 1항의 "subset 재시도 금지"를 유지한다. |

**7. 페이지 번호·토큰 의미(정본에 예제로 고정 — 구현 전 필수).**
다음이 미정의 상태다: ① 표지 제외 + "특정 페이지부터"가 동시에 켜질 때의 시작점 ② 범위·홀짝이 **물리 PDF 페이지 기준인지 표시 번호 기준인지** ③ 건너뛴 페이지가 `{page}` 증가에 포함되는지 ④ 시작 번호가 1이 아닐 때 `{pages}` 가 페이지 수인지 최종 표시 번호인지 ⑤ 다중 파일에서 `{filename}`·`{pages}` 의 계산 단위 ⑥ `{date}` 의 timezone·형식.
**→ 확정**: 위 6개를 **표와 예제로 정본에 박고**, `{date}` 는 **injectable clock** 으로 고정해 시각 기준선의 날짜 의존성을 제거한다.

**8. 도장 위치 모델.** raw PDF 좌표가 아니라 **회전된 visual viewport 기준 정규화 rectangle** 을 저장하고, 대상 페이지마다 **네 모서리를 `convertToPdfPoint` 로 재변환**해야 혼합 크기·회전 문서에서 "같은 위치"가 성립한다.

## v3 확정 사항 (Codex 2차 반박 반영 — 정본화 전 반드시 채울 것)

**9. 토큰 의미 표(v2 가 "이관"만 하고 비워둔 것 — 여기서 확정).**

| 토큰·옵션 | 확정 의미 | 예 |
|---|---|---|
| 페이지 범위·홀짝 | **물리 PDF 페이지 기준**(표시 번호 아님) | 10쪽 문서에 "2-5, 홀수" → 물리 3·5쪽 |
| 표지 제외 + "N쪽부터 시작" 동시 | 표지 제외를 **먼저** 적용해 대상 집합을 정하고, 그 집합에 시작 번호를 부여 | 표지 제외 + 시작 5 → 물리 2쪽이 "5" |
| 건너뛴 페이지의 `{page}` | **증가에 포함**(번호가 비어도 카운터는 전진) | 홀수만 인쇄해도 물리 4쪽은 번호 4를 소비 |
| `{pages}` | **파일별 물리 총 페이지 수**(최종 표시 번호 아님) | 10쪽 문서는 시작 번호와 무관하게 `10` |
| `{filename}` | **파일별 base name**(확장자 제외) | `보고서.pdf` → `보고서` |
| `{date}` | **작업 시작 시 1회 캡처한 사용자 로컬 날짜**. ~~`YYYY-MM-DD` 고정~~ → **확정 24항으로 정정**: 기본 표기는 **문서 언어 로케일**, `{date:YYYY-MM-DD}` 로 형식 지정 가능 | 배치 전체가 같은 값 |

**10. `clock()` 계약 — "injectable 이면 자동으로 안정된다"는 v2 서술은 틀렸다.**
현행 시각 하네스는 **timezone 만 UTC 로 고정하고 `Date` 자체는 고정하지 않는다**(`visual-regression.config.mjs:13`·`visual-regression.mjs:286` 실측). 따라서 다음을 명시한다: ① `clock(): Date` 는 **작업 시작 시 1회** 호출하고 batch 전체가 같은 날짜를 사용 ② production 기본은 브라우저 현재 시각 ③ **시각 하네스 config 에 고정 ISO 시각을 두고 navigation 전에 브라우저 `Date` 를 고정**(하네스 수정이 동반 작업) ④ unit test 는 fake clock 직접 주입.

**11. `/Annots` 를 통째로 지우면 링크도 사라진다 — 제품 의미 결정.**
PDF.js 는 LINK 와 TEXT/WIDGET 을 **모두 annotation subtype 으로 분류**한다(`pdf.mjs:115`). **확정: 링크(Link subtype)는 보존한다.** 사용자 요구는 "주석 제거"이지 "하이퍼링크 제거"가 아니다. F4a 는 **subtype 별 선별 삭제**로 구현하고, **비제거 객체 보존표**(무엇을 남기는가)를 지원 표시와 함께 화면에 밝힌다.

**12. 복합 실행 순서(옵션을 여러 개 켰을 때) — v2 미정의.**
`구조 제거/양식 처리 → background 워터마크 → 원문 → foreground 워터마크 → 번호·머리말·꼬리말 → 도장 → (필요 시) 최종 raster flatten`. **전체 옵션 조합 골든 케이스**를 F5 완료 기준에 둔다.

**13. `PdfFinishPreset` typed prop 계약 — v3 에서 실제로 고정한다.**

로드맵 22줄의 typed preset 원칙(전역 generic router 금지·페이지 복제 금지)에 따라, 네 경로는 **같은 finish 화면**에 **초기 탭만 다르게** 진입한다.

```ts
// src/features/pdf-editor/types.ts
export type PdfFinishTab = "page-numbers" | "header-footer" | "watermark" | "stamp";
export interface PdfFinishPreset { initialTab: PdfFinishTab }
```

| route | preset | 비고 |
|---|---|---|
| `/tools/pdf-editor/finish` | `{ initialTab: "page-numbers" }` | 정본 경로. 네 탭 모두 노출 |
| `/tools/pdf-editor/page-numbers` | `{ initialTab: "page-numbers" }` | 직접 진입 |
| `/tools/pdf-editor/watermark` | `{ initialTab: "watermark" }` | 직접 진입 |
| `/tools/pdf-editor/stamp` | `{ initialTab: "stamp" }` | 직접 진입 |

- ~~**머리말·꼬리말은 전용 route 를 만들지 않는다** — 사용자 원 프롬프트의 경로 후보 4개에 없고, 페이지 번호와 좌표·토큰 계약을 공유하므로 `finish` 화면 안의 탭으로만 제공한다.~~ → **확정 23항으로 정정됨**: SEO 표면 손실이라 `/header-footer` route 를 되살린다(탭은 늘리지 않고 직접 진입 preset 전용). **route 는 5개다.**
- `PdfToolMode` 유니온에는 **`"finish"` 하나만 추가**한다(4개 → 5개). 나머지 3경로는 mode 가 아니라 preset 이다 — **navigation 탭도 5칸**이다(확정 14항).
- **canonical 은 `/finish`**, 직접 진입 3경로는 canonical 을 `/finish` 로 가리킨다. 정적 페이지·사이트맵·소셜 이미지는 4경로 모두 생성하되 중복 콘텐츠 신호를 피한다(「현지화·SEO·AdSense 동시 검토」).
- preset 은 **초기 상태만** 정한다. 진입 후 사용자가 탭을 바꿔도 route 는 바뀌지 않는다(history 오염 방지).

**14. navigation 5칸 — 하드코딩 실측(Codex 2차).**
현재 `PdfEditorPage.tsx:94` 가 모바일 `repeat(4, …)`·데스크톱 `grid-cols-4` 를 **하드코딩**하므로 항목만 추가하면 다섯 번째가 줄바꿈된다. 390px 뷰포트 실측: clientWidth 366 / 4탭 최소 500(overflow 134) / **5탭 최소 624(overflow 258)**.
**확정**: 탭 패턴을 바꾸지 않는다. ① 모바일 `repeat(5, minmax(120px,1fr))`·데스크톱 `grid-cols-5` ② finish 를 organize **다음**에 배치 ③ 직접 진입 시 active 탭을 가시 영역으로 스크롤 ④ **320/390/820/821px × ko/en 에서 시작·끝 fade 와 active-tab 가시성 단언** ⑤ selector 는 `data-pdf-nav-mode`.

**15. 위치 의존 selector 는 시각 하네스에도 남아 있다**(v2 가 browser smoke 만 지목 — 보강). `tests/visual-regression.scenarios.mjs:230,241,253` 도 `.pdf-tool-navigation a:nth-child(...)` 를 쓴다. **완료 기준: 저장소 전체에서 해당 grep 결과 0건.**

**16. legacy-organize 검증은 byte equality 단독으로 하지 않는다. 기준선은 리팩터링 *전* 에 뜬다.**
출력에 PDF object 번호·압축·metadata 와 브라우저 `system-ui` 로 만든 PNG 가 섞여 byte hash 는 취약하다. **F-fix 에서 현재 `2b1aabd` 기준으로 3종 oracle 을 먼저 채취**한다: ① **구조 oracle** — 페이지 수·회전·MediaBox 기반 행렬·PNG XObject·ExtGState·Helvetica 9pt·색/opacity/operator 순서 ② **렌더 oracle** — 고정 입력의 Poppler/PDF.js 렌더 픽셀 baseline ③ **client oracle** — PNG 420~1800×92 크기·alpha 0.82·120 UTF-16 단위 절단. byte equality 는 고정 날짜·고정 PNG 에서 결정적임을 확인한 경우 **보조 게이트로만** 쓴다.

**17. 손상 fixture 는 "전부 실패"가 아니다 — 기대표 필수.**
Codex 실측: `truncated-half` → `InvalidPDFException` / `xref-offset-all-9` → **OPEN(pages=1, 복구됨)** / `malformed-Contents` → **OPEN("Unknown command" 경고)**. 따라서 **fixture 마다 "열기 실패 / 복구 성공 / 경고 후 성공" 기대값을 명시**한다. "손상=실패" 단언은 잘못된 테스트다.

**18. 캔버스 상한 검사는 세 곳에 둔다**(v2 는 "사전 검사" 한 곳만 언급).
**iOS 4,096² 는 보편 사실이 아니라 보수적 호환 상한 후보**로만 쓴다(브라우저·OS·GPU 별로 한 변/면적/할당 실패 양상이 다르며, 사전 검사만으로 모든 조용한 실패를 잡을 수 없다). ① **공용 순수 정책 모듈** — viewport 에서 width·height·area·RGBA bytes·전체 예상 pixels 산출 ② **UI preflight** — 페이지 크기를 읽은 직후 자동 DPI 하향·거부 사유를 **처리 전에** 표시 ③ **실행 직전 재검사** — `pdfPreview.ts:356` 캔버스 생성 직전(OffscreenCanvas worker 로 옮기면 worker 안에서도).

**19. 취소 순서 정밀화**(v2 의 화살표는 부정확). PDF.js 는 **렌더 중 `cleanup()` 호출이 오류를 낼 수 있다**고 명시한다(`api.d.ts:1153`·`:1633`). 정확한 순서: **`renderTask.cancel()` → `renderTask.promise` 의 취소 rejection 이 정착할 때까지 대기 → `page.cleanup()` → document/loadingTask destroy.**

**20. F4b 결정 규칙 — v3 에서 실제로 고정한다**(v2 는 "벤치 후 결정"만 적어 서로 다른 결과에서 무엇을 고를지가 없었다).

**측정 매트릭스**: fixture 4종(blank · text-vector · photo-scan · 투명도) × DPI 3종(150/200/300) × 포맷 2종(PNG · JPEG q85) × 기기 2종(데스크톱 · 모바일). 각 셀에서 **① 최종 PDF bytes ② peak heap ③ 소요 시간**을 기록한다.

**결정 규칙(벤치 전에 확정 — 결과가 어떻게 나오든 이 규칙으로 고른다)**:

1. **포맷 기본값**: `photo-scan` fixture 에서 **PNG 최종 bytes ÷ JPEG 최종 bytes ≥ 2.0** 이면 **JPEG 를 기본값**으로 한다(라이브 실측 참고: 300DPI 노이즈 페이지 PNG 28.10MiB vs JPEG 5.93MiB = **4.7배**). 2.0 미만이면 PNG 기본. **어느 쪽이든 사용자가 바꿀 수 있는 선택지로 둘 다 제공**한다.
2. **DPI 기본값**: **모바일에서 peak heap 이 기기 한계의 안전 마진을 넘지 않는 최대 DPI**로 한다. 안전 마진은 **peak heap ≤ 256MiB**(모바일 브라우저 탭의 보수적 상한)로 잡되, F4b 실측에서 이 값이 비현실적으로 드러나면 실측치로 대체하고 **사유를 기록**한다. 동률이면 **낮은 쪽**을 고른다(용량·시간이 유리).
3. **거부 임계값**: 확정 18항의 정책 모듈이 산출한 **예상 픽셀 총량**이 캔버스 상한(보수 후보 4,096² = 16.78M px)을 넘으면 → **먼저 DPI 를 한 단계 낮추고**, 최저 DPI(150)에서도 넘으면 **거부**한다. 거부 사유는 사용자 언어로 표시한다(「내부 구현 비노출」).
4. **경고 임계값**: 예상 출력 bytes 가 **입력의 10배 또는 100MiB 중 작은 값**을 넘으면 처리 전에 경고한다(공통 완료 기준의 "대용량 사전 안내").
5. **동률·경계 사례**: 위 규칙으로 결정되지 않으면 **사용자 판단으로 넘긴다** — 임의 선택 금지(정본 확정 5항의 예산 면제 금지와 같은 원칙).

**리포트 의무**: 벤치 결과 전체 표를 `docs/review-notes.md` 에 남기고, 각 기본값이 **위 규칙 중 몇 번으로 결정됐는지** 명시한다.

## v3 추가 확정 (Gemini 제3자 검토 반영 — Claude 검증 후 편입)

**21. "여러 줄"·"반복 타일"의 구현 계약을 명시한다 — 조용한 축소 방지.**
사용자 원 요구 2항("여러 줄")·3항("반복 타일")인데 v3 확정 사항에 **어떻게 만들지가 없었다.** `pdf-lib` 의 `drawText`/`drawImage` 는 자동 줄바꿈도, 패턴 기반 타일링도 내장하지 않으므로 **구현 단계에서 "라이브러리 미지원"을 이유로 생략될 위험**이 실재한다(로드맵 54줄: "기능 요구를 임의 생략하거나 UI 목업으로 대체하지 않는다").
- **F0a 에 명시**: 개행(`\n`) 기준 분리 + 줄 높이 계산 + 각 줄의 좌표 배열 산출(정렬 좌/중/우 반영).
- **F2 에 명시**: 타일 간격·오프셋으로 격자 반복 렌더 루프. 리소스는 **한 번만 임베드하고 참조만 반복**(용량 폭발 방지 — Gemini 1차 조사 권고 중 유효한 부분).

**22. 도장 좌표 — Gemini 의 "scale 역산 필요"는 원인 진단이 틀렸다. 정확한 계약으로 대체한다.**
Claude 실측(`pdfjs-dist/build/pdf.mjs:912`): `convertToPdfPoint(x,y)` 는 `Util.applyInverseTransform(p, this.transform)` 이고 `transform` 은 viewport 생성 시 **scale·rotation·offset 을 이미 포함**한다 → **배율은 자동 보정된다.** 따라서 "scale 로 나눠서 넣으라"는 제안을 채택하면 **이중 보정으로 오히려 어긋난다.**
**진짜 위험은 CSS 픽셀과 캔버스 픽셀의 불일치다.** 마우스 이벤트는 CSS 좌표를 주는데 캔버스는 devicePixelRatio·CSS 축소 표시 때문에 다른 해상도를 가질 수 있다.
- **확정 계약**: ① 포인터 CSS 좌표 → `canvas.getBoundingClientRect()` 대비 `canvas.width/height` 비율로 **캔버스 좌표로 먼저 변환** ② 그 값을 `convertToPdfPoint` 에 넣는다(여기서 scale·rotation 자동 보정) ③ 저장은 **정규화 rectangle**(0~1) 로, 적용 시 대상 페이지 viewport 로 재변환(확정 8항).
- **골든 케이스**: devicePixelRatio 1·2, 캔버스 CSS 축소 표시, 회전 4종에서 미리보기 위치와 출력 위치 일치.

**23. `/header-footer` 진입 경로를 되살린다 — SEO 판정 정정.**
v3 확정 13항은 "사용자가 준 경로 후보 4개에 없다"는 이유로 전용 route 를 만들지 않기로 했다. **「현지화·SEO·AdSense 동시 검토」 규칙에 비추면 이 판단은 손실이다** — "머리말·꼬리말 추가"는 "페이지 번호 추가"와 **검색 의도가 다른 독립 키워드**이고, 탭 안에 숨기면 색인될 표면이 사라진다.
- **정정**: `PdfFinishTab` 은 그대로 4개, **route 는 5개**(`/finish`·`/page-numbers`·`/header-footer`·`/watermark`·`/stamp`). `/header-footer` → `{ initialTab: "header-footer" }`.
- **navigation 탭은 늘리지 않는다** — 확정 14항의 5칸(organize·finish·image-to-pdf·pdf-to-image·convert)을 유지하고, `/header-footer` 는 **직접 진입 preset 전용**이다(탭에 6번째를 만들지 않는다).
- 정적 페이지·사이트맵·소셜 이미지·ko/en 메타는 **5경로 모두** 생성하되 canonical 은 `/finish` 로 통일한다.

**24. `{date}` 는 로케일을 따른다 — 확정 9항 정정.**
`YYYY-MM-DD` 단일 고정은 「현지화·SEO·AdSense 동시 검토」와 충돌한다(한국어·영어 사용자의 기대 표기가 다름). **정정**: 기본값은 **문서 언어 설정에 따른 로케일 표기**로 하고, `{date}` 는 그 기본값을, **`{date:YYYY-MM-DD}` 형태로 형식을 명시**할 수 있게 토큰 문법을 확장한다. 시각 회귀에서는 확정 10항의 고정 clock + **고정 로케일**로 결정성을 확보한다.

**25. 배경 배치 실패는 "거부"가 아니라 "경고 후 허용"으로 완화한다 — 확정 4항 ⑥ 정정.**
`q/Q` 불균형을 사전에 완벽히 판정하려면 전체 content stream 파싱이 필요해 무겁고 오탐이 난다. **멀쩡히 처리될 파일을 막는 것이 더 나쁜 결과**다.
- **정정**: 위험 특성(`q/Q` 불균형 의심·OCG·태그된 PDF)이 감지되면 **"레이아웃이 깨질 수 있음"을 처리 전에 경고**하고 사용자가 진행 여부를 고른다. 원본은 불변이고 결과는 새 파일이므로 되돌릴 것이 없다 — 다시 만들면 된다.
- **단, 결과 리오픈 검증(확정 4항 ④⑤)에서 실제 파손이 확인되면 그 결과는 제공하지 않는다.** 경고는 사전 안내이고, 검증 실패는 여전히 차단이다.

**26. 미리보기와 페이지 선택 — 제품 경험 공백(채택, 범위 제한).**
- **텍스트 계열 오버레이 미리보기**: 페이지 번호·머리말·워터마크는 현재 **텍스트 입력값만 보고 결과를 알 수 없다.** 매번 내려받아 확인하는 것은 이 도구의 가치를 깎는다. → **F1·F2 에 PDF.js 렌더 캔버스 위 DOM 오버레이 미리보기를 포함**한다. **범위 제한**: 위치·크기·정렬·색·투명도의 **근사 표시**이며 픽셀 동일성을 보장하지 않는다(출력은 pdf-lib 가 그린다). 이 한계를 화면에 밝힌다.
- **썸네일 기반 페이지 선택**: organize 모드가 이미 썸네일 그리드를 갖고 있다(`PdfOrganizePanel.tsx`). finish 에서도 **범위 텍스트 입력의 대안으로** 썸네일 토글을 제공한다. 텍스트 규칙(범위·홀짝)과 **양방향 동기**되어야 한다 — 한쪽만 반영되면 사용자가 혼란한다.

**27. 링크 보존을 실행 *전* 에 알린다 — 확정 11항 보강.**
확정 11항은 링크 보존을 결과에 밝히기로 했으나, **사용자는 링크를 끊으려고 "주석 제거"를 골랐을 수 있다.** 실행 후 통보는 기대 위반이다. → **옵션 선택 UI 단계에서 "하이퍼링크 보존" 여부를 명시**(체크박스 또는 "링크는 유지됩니다" 문구)해 실행 전에 기대를 맞춘다.

## 단계 분할 (v2 — Codex 반박 반영해 6단계 → 8단계 vertical slice 로 재분할)

v1 의 F0~F5 는 **F5 에서야 route 를 붙이므로 그 전 커밋들이 사용자 화면에서 도달 불가**했고, 현지화·SEO 를 마지막으로 미루는 것은 「현지화·SEO·AdSense 동시 검토」 규칙과 충돌했다. **각 공개 slice 에서 번역·SEO·정적 route 를 동시에 반영한다.**

| 단계 | 내용 | 예상 production TS/TSX |
|---|---|---:|
| **F-fix** | **fixture 생성기 + oracle 채취** — ① Node 전용 fixture 생성기(truncated·xref·malformed·R2 open-password·R2 permission-restricted, **qpdf 불필요** — v3 확정 4행) + `q/Q` 불균형·OCG·태그된 PDF ② **fixture 별 기대 oracle 표**(확정 17항) ③ **`2b1aabd` 기준 legacy-organize 3종 oracle 채취**(확정 16항 — 리팩터링 *전* 에 떠야 함) | 스크립트·fixture |
| **F0a** | 좌표(회전·CropBox)·페이지 선택·토큰·글꼴 resolver **순수 모듈** | 420~650 중 일부 |
| **F0b** | 공용 worker lifecycle 이관(envelope adapter) + finish 취소 orchestration | 위와 합해 420~650 |
| **F1** | **`/finish`·`/page-numbers` 공개 route** + 번호·머리말·꼬리말 + ko/en·SEO·static·스모크 | 550~850 |
| **F2** | 워터마크 + `/watermark` preset + 동반 SEO/스모크 | 400~650 |
| **F3** | 도장·서명 UI + `/stamp` preset · history(undo/redo) · 정규화 rectangle | 700~1,050 |
| **F4a** | metadata·annotation·form·attachment **구조 제거** / 양식 flatten | 700~1,100 중 일부 |
| **F4b** | 페이지 **raster flatten** + 메모리 benchmark·명시 상한 | 위와 분할 |
| **F5** | 최종 누락 감사 · legacy-organize 호환 · 다중 파일/ZIP · 전체 회귀 | 80~150 |

테스트·스모크·벤치는 별도로 약 **1,500~2,400줄** 예상. 참고 규모: U3 커밋 tracked TS/TSX 18파일 net +1,359줄 / B5a PDF 6파일 net +91줄 / 현행 PDF feature 2,562줄 · QR feature 1,559줄.

## 확정 사항 → 단계 매핑 (v3 — 실행 시 어느 단계가 무엇을 책임지는가)

확정 27개가 세 절(1~8 · 9~20 · 21~27)에 나뉘어 있어 **단계별 책임이 흩어져 있었다.** 아래가 정본 기준이다.

| 단계 | 책임지는 확정 항목 |
|---|---|
| **F-fix** | **4**(배경 fixture 4종) · **5**(제거 검증 대상) · **16**(legacy-organize 3종 oracle — **리팩터링 전 채취**) · **17**(손상 fixture 기대표) · Gemini 검증 4행(Node 전용 생성기, qpdf 불필요) · 확정 25 의 위험 문서 fixture(`q/Q`·OCG·태그) |
| **F0a** | **1**(glyph coverage 폰트 정책) · **7·9**(페이지 선택·토큰 의미) · **10**(clock 계약) · **18**(캔버스 상한 정책 모듈) · **21**(여러 줄 좌표 산출) · **22**(도장 좌표 변환 계약) |
| **F0b** | **2**(worker lifecycle 이관·envelope adapter) · **19**(취소 순서) · 확정 2의 "기존 4모드 불변 보증" |
| **F1** | **9**(토큰 표 실제 적용) · **13·23**(route 5개·preset) · **14**(navigation 5칸) · **15**(selector 교체) · **24**(`{date}` 로케일) · **26**(오버레이 미리보기·썸네일 선택) |
| **F2** | **4**(배경 stream 절차) · **21**(반복 타일) · **25**(경고 후 허용) · 텍스트 워터마크 벡터 전환(쟁점 4) |
| **F3** | **8·22**(도장 정규화 rectangle·좌표) · undo/redo · 다중 페이지 복제 · 비전자서명 고지 |
| **F4a** | **5**(제거 보증 수준) · **11**(`/Annots` 링크 보존) · **27**(실행 전 고지) |
| **F4b** | **6**(대용량 경계) · **18**(실행 직전 재검사) · **20**(F4b 결정 규칙·벤치 매트릭스) |
| **F5** | **3·16**(legacy-organize 호환 preset + oracle 비교) · **12**(복합 실행 순서 골든) · 최종 누락 감사 · 다중 파일/ZIP |

**전 단계 공통**: 확정 **15**(위치 의존 selector 0건)는 완료 기준의 grep 검사로 매 단계 확인한다.

## 완료 기준 (로드맵 단위 공통 48~54줄 + U4 고유)

- ko/en 번역 전 문구 · toolRegistry 등록 · SEO 정적 페이지·사이트맵·FAQ·소셜 이미지 반영 · AdSense 배치·격리 경로 영향 검토 기록. **소셜 이미지와 시각 baseline 은 생성 스크립트로만 갱신**(「생성물 직접 수정 금지」).
- 원본 파일 불변 · 다중 파일 · 진행률 · **취소·재실행**(F0b) · 손상/미지원 구분 · 대용량 사전 안내 · 개별 다운로드(결과 2개 이상 시 ZIP) · 임시 URL 정리 · 모바일 동작 · 드래그의 버튼 대안.
- 내부 구현 명칭·원시 예외 비노출(「내부 구현 비노출」).
- **U4 고유 골든 케이스**:
  ① 회전 0/90/180/270 × 비영점 CropBox × 혼합 페이지 크기에서 번호·머리말이 지정 위치에 오는지 — **좌표뿐 아니라 "화면에서 글자가 똑바로 보이는 방향"까지 단언**
  ② glyph coverage 분기(Helvetica 가능 / Noto 필요 / **둘 다 불가**)와 출력 크기 증가 실측
  ③ 배경/전경 순서를 **렌더 픽셀로** 확인
  ④ 제거 후 **전체 indirect-object 검사**로 orphan 부재 증명
  ⑤ 도장 rectangle 이 미리보기와 출력에서 일치(혼합 크기 문서 포함)
  ⑥ **손상/암호 PDF**: truncated·xref 손상 · open-password · permission-restricted · malformed Contents · **다중 파일 중 하나만 실패할 때 성공 결과 보존** · 내부 code·원시 예외 비노출. **현재 저장소에 이 fixture 가 없다 — F1 이전에 만들어야 한다.**
  ⑦ cancel → retry 정상 동작
- **스모크 계약**: 현행 `TEST_SCOPE=pdf`(`browser-smoke.mjs:54-55 testPdfTools`)는 **기존 4모드만 순회하고 fixture 도 회전·CropBox 없는 400×600/600×400 2페이지**(`:1382-1390`)라 **새 모드 커버리지가 0** 이다. → 기존 `TEST_SCOPE=pdf` 는 4모드 회귀로 유지하고 **`test:pdf-finish` 를 신설**한다. navigation 단언은 `nth-child`(`:265-286`·`:348-357`) 대신 **href/data-mode** 로 바꾼다.
- 검증: `npm run build` · `npm run test:unit` · `TEST_SCOPE=pdf npm run test:browser` · **`npm run test:pdf-finish`** · `npm run test:static` · 시각 회귀(신규 scenario) · **배포 전 로컬 시각 검수**(규칙 19 — 추적 코드 제외 빌드 → Gemini 브라우저 검수).

## 명시 제외

- 공인 전자서명·암호학적 디지털 서명(로드맵 68줄 — 이미지 삽입임을 화면 명시).
- 브라우저 단독 구현 불가로 판정된 항목은 **지원 표시에서 제외**하고 사유 기록(임의 목업 금지).
- **기존 organize·convert 모드의 기능·문구 변경**(확정 3항 — 취소 버튼 추가 포함). 이 범위를 열려면 명시 제외를 먼저 바꾸는 별도 합의가 필요하다.
- pdf-lib → `@pdfme/pdf-lib` 교체(검증 7항 — backlog 별도 단위).

## 왕복 기록

- **(완료) Gemini 외부 능력 조사 — `agy-u4-ext.md`.** Claude 실측 대조: 투명도 1건 기각 · API 경로 1건 정정 · 나머지 확인.
- **(완료) Gemini 저장소 구조 조사 — `agy-u4-repo.md`.** 모순 없음. 발견 2건(worker 취소 부재 · 폰트 임베드 비용).
- **(완료) Codex 1차 반박 — 판정 `[재왕복 필요]`.** 7항 전건 실측 증거 첨부(재현 스크립트 실행). **v1 의 네 판단을 정정**: ① 폰트 4.6MB→3.83MB·ASCII/CJK 분기 폐기(hybrid 이점 없음 실측) ② worker 취소 "신설"→"이관"(`workerLifecycle.ts` 이미 존재) ③ organize 엔진 위임안 폐기→legacy 호환 preset ④ 단계 분할 재구성(route 를 마지막에 두면 도달 불가). 신규 공백 5건 편입(orphan stream · 손상/암호 fixture 부재 · 대용량 수치 · 스모크 커버리지 0 · 토큰 의미 미정의). 전부 v2 확정 사항에 반영했다.
- **(완료) Gemini 대용량·fixture 조사 — `agy-u4-limits.md`.** Claude 실측 대조: **DPI/포맷 기본값 권고 기각**(FADGI·NARA 는 영구 보존 아카이빙 기준으로 용도가 다름 — 출처는 진짜지만 맥락이 틀렸다), **fixture 도구 미설치 실측**(`which qpdf mutool pdftk` 전무 → F-fix 선행 단계 신설), pdfjs API 경로 1건 정정, 캔버스 "조용한 실패" 특성을 사전 상한 검사 계약으로 승격, subset 미해결 재확인. 위 「Gemini 대용량·fixture 조사 검증」 절 참조.
- **(완료) Codex 2차 반박 — 판정 `[재왕복 필요]`.** 1차 반영은 대체로 [반영됨]이나 **v2 의 판정 2건이 실증으로 뒤집혔다**: ① **"암호 fixture 는 qpdf 필수" 기각** — Node 내장 `crypto` 로 R2 암호 fixture 를 실제 생성해 PDF.js 로 검증(915B/916B, PasswordException·권한 배열 확인) ② **"33.20MiB 출력 용량" 정정** — 그것은 raw 캔버스 메모리이고 실제 인코딩은 내용 유형별로 0.04~28.10MiB. 추가로 A4 세로 3507→**3508**(`ceil`), iOS 4,096² 는 보편 사실 아님, 취소 순서에 **promise rejection 정착 대기** 누락, navigation 5탭 실측(390px 에서 overflow 258px·`grid-cols-4` 하드코딩), 시각 하네스에도 `nth-child` 잔존, legacy 기준선은 **리팩터링 전** 채취, 손상 fixture 는 **전부 실패가 아님**(xref·malformed 는 복구되어 열림). 미정의 5건(토큰 표·preset 계약·복합 실행 순서·`/Annots` 링크 보존·F4b 합격 규칙)을 확정 9~20항으로 채웠다.
- **(완료) Gemini 제3자 검토 — `agy-u4-review.md`.** Codex 와 다른 각도(사용자 요구 대조·제품 경험·경쟁 도구 격차·SEO)에서 **아무도 못 본 것 5건**을 찾았다. Claude 검증 후 확정 21~27항으로 편입: **"여러 줄"·"반복 타일" 구현 계약 누락**(조용한 축소 위험) · **`/header-footer` SEO 표면 손실**(내 판단 정정) · **텍스트 계열 미리보기 부재** · **배경 배치 사전 거부가 과하다** · **링크 보존을 실행 후 통보하는 문제** · `{date}` 로케일 · 썸네일 페이지 선택.
  **1건은 원인 진단이 틀려 정정 채택**: "도장 좌표에 `viewport.scale` 역산이 필요하다" → **틀림**. `pdf.mjs:912` 실측상 `convertToPdfPoint` 는 `applyInverseTransform(transform)` 이라 **scale·rotation 이 자동 보정**된다. 제안대로 나누면 이중 보정으로 어긋난다. 진짜 위험은 **CSS 픽셀 ↔ 캔버스 픽셀 불일치**(devicePixelRatio·CSS 축소 표시)이며 확정 22항에 그 계약으로 대체했다.
- **(대기) Codex 3차 반박** — 잔여 이견: 암호 fixture 세대 범위(R2 만으로 충분한가) · 캔버스 상한 3중 검사의 구현 위치 · legacy oracle 3종의 채취 시점과 F5 비교 방법 · worker adapter 의 공용 회귀 범위 · 확정 9~20항의 실행 가능성.

> **2026-09-06 — U4 의 착수 조건(S2 배포 후)·3차 반박에 추가할 현행화 항목(기준점·legacy oracle·시계 목록 확장·9단계표·C-D 전항·영어 모바일)은 `roadmap-completion-20260906.md` §3 S3 에 있다.** 본 초안은 v3 상태 그대로이며 그 항목을 포함한 3차 반박 → 이견 0 후 정본화한다.

---

## v4 현행화 (2026-09-06, Claude — 로드맵 정본 `roadmap-completion-20260906.md` §3 S3 의 요구 항목. 전부 `main` 에서 실측)

**착수 조건 충족**: S0(빈 페이지)·S1(죽은 코드)·S2(하네스+CLS+a11y) 가 2026-09-06 에 순서대로 배포·라이브 확인됐다(로드맵 「진행 기록」). U4 = 로드맵 S3.

### H1. 기준점 — `ui-migration 2b1aabd` 는 폐기, **`main` = `1a04f2571109495a76b8468af95b2f4edcd862cf`**(S2 병합 `7c98628` + 사후 기록)
- `ui-migration` 은 P2 병합(`1ff9187`)으로 소진됐다. **legacy-organize 3종 oracle(확정 16항)은 이 `main` 에서 채취**한다 — B5a 이후 B6·B-shared·S0·S2 가 pdf-editor 표면을 바꿨으므로 `2b1aabd` oracle 은 무효. 현행 `decoratePdf` 고정값은 v2 실측과 동일함을 재확인했다(`pdf.worker.ts:92-117`: `-32°`·opacity 0.2·Helvetica 9pt `y=12`·`rgb(0.35,0.35,0.38)` 0.9; `pdfWorkerClient.ts:114-132` PNG 생성). `PdfOutputOptions`(`types.ts:30-34`) 3필드 불변. feature 12파일 2,562줄 불변. 스택 `@pdf-lib/fontkit` 1.1.1 · `pdf-lib` ^1.17.1 · `pdfjs-dist` ^6.2.108(`package.json:50,82,83`) 불변.
- `PdfEditorPage.tsx:94` navigation 하드코딩은 현재 `grid-cols-[repeat(4,minmax(120px,1fr))] … min-[821px]:grid-cols-4`(확정 14항의 5칸 전환 대상 그대로). nth-child 잔존: `tests/visual-regression.scenarios.mjs:233·245·258`(확정 15항 — browser-smoke 의 `.pdf-output-mode-list button:nth-child(2·3)`·`.pdf-page-card:nth-child(2)` 는 **navigation 이 아닌 내부 목록**이라 15항 범위 밖 — 3차 반박에서 포함 여부 판정 요청).

### H2. S0·S1·S2 가 U4 에 미치는 영향(신규 전제)
- **S0**: `App.tsx` `PdfRoute` 는 이제 `<Suspense fallback(min-h-screen)><ToolReady><PdfEditorPage mode/></ToolReady></Suspense>` 이며 `AppShell` `<RouteErrorBoundary>` 아래다. finish 모드는 같은 `PdfRoute` 로 들어오므로 경계·청크 재시도 가드(`chunkRecovery.ts` — 키 = route path+search)를 자동 상속한다. **새 route 5개는 `tests/blank-page-recovery-smoke.mjs` 의 정상 진입 표본에 포함되지 않는다**(`availableToolRoutes` 20 도구만 순회) — U4 완료 기준에 finish 5경로 정상 진입·청크 404 사례를 `test:pdf-finish` 또는 recovery 스모크 확장으로 추가할지 3차 반박에서 판정.
- **S1**: 무관(문서 비교만).
- **S2-H**: ① 번들 측정기 — 5종 고정 상한 유지(`BUNDLE_LIMIT_*` override 는 사유 기록 필수). **pdf-editor route 현행 gzip = 171864 B**(S2 `bundle-final.json` `perRouteJsGzip`). U4 예상 production 코드 2,850~4,650줄이 **전부 `PdfEditorPage` lazy 청크에 들어가면 route +60KB 상한을 넘을 가능성이 높다** → **C-B 탐색 빌드**(`vite.build({write:false, manifest:true})`) 로 finish 를 **별도 lazy 청크(`PdfFinishPanel` 동적 import)** 로 분리했을 때의 route/shared 귀속을 3차 반박에서 실측하고, 상한 초과가 예상되면 **분리 설계를 정본에 박는다**(상한 변경은 금지 — 로드맵 C-B). ② 렌더링 게이트 — **절대 CLS ≤0.1 이 차단 게이트로 개시**됐고 `pdf-editor` 가 `targets` 에 있다(`rendering-baseline.mjs:19`). finish 화면(오버레이 미리보기·썸네일·5칸 navigation)은 CLS 0 을 유지해야 하며, 새 route 를 `targets` 에 **등록**한다(등록 누락은 unit 이 잡는다). ③ 접근성 — 8페이지·`A11Y_MAX_TOTAL=0` 기본. `/ko/tools/pdf-editor/finish` 를 `pages` 에 등록(desktop) + 모바일 412px 등록 여부 판정. ④ 도구 목록 — finish 는 새 도구가 아니라 pdf-editor 하위 route 이므로 `expectedToolIds` 20 불변(`tool-registry-routes.mjs`). 단 **정적 페이지·seo.ts·소셜 이미지·사이트맵·validate-static** 의 route 등록은 5경로 전부 필요(현행 등록: `/tools/pdf-editor`·`/image-to-pdf`·`/pdf-to-image`·`/convert` — `seo.ts:145-148·208-226·363-364`).
- **S2-P**: QR 라벨 폰트 경계 = `qrBulk.ts:18` `QR_LABEL_FONT_PATH = "vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf"`(4,644,748B identity) + `qrLabelPdf.ts:14` `registerFontkit`. **U4 확정 1항의 Noto 임베드는 이 동일 경로를 재사용**한다(별도 폰트 자산 추가 금지 — 벤더 해시표 `docs/OFFICE_EDITOR_ASSETS.md`·`vendor:qr-font` 스크립트 소유). QR 감량 결정(로드맵 §5-4, 사용자 정지점)에서 **폰트 서브셋/woff2 전환이 선택되면 U4 도 같은 자산을 쓰므로 정합 필요** — 3차 반박에서 "U4 는 R4 기각(subset 재시도 금지)을 유지하되 QR 이 서브셋을 도입하면 U4 는 전체 OTF 를 계속 쓴다"로 분리할지 판정.

### H3. 시계 목록 확장(로드맵 C-F)
`tests/visual-regression.config.mjs:17-21` `clock.toolReasons` 는 현재 timezone·work·payroll 3개. U4 `{date}` 토큰(확정 9·10·24항) 때문에 **`pdf-editor`(finish scenario) 를 추가**하고 사유를 적는다: "Finish header/footer `{date}` token captures the batch start date." 확정 10항 ③(navigation 전 `Date` 고정)은 S-QA 에서 이미 하네스가 구현했다(`6fc458f` — 계산기 3종 고정) → **U4 는 목록 추가만**, 하네스 수정은 불필요(3차에서 확인).

### H4. 단계표 현행화(9단계 — S 접두 표기, 각 단계 = 커밋 묶음, 배포 단위는 U4 전체 1회)
| 단계 | 내용 | 정본 근거 | 게이트 |
|---|---|---|---|
| U4-0 F-fix | fixture 생성기(Node `crypto` R2·손상 3종·`q/Q`·OCG·태그) + 기대 oracle 표 + **`main` 기준 legacy-organize 3종 oracle 채취**(리팩터링 전) | 확정 4·5·16·17·25 | unit(생성기) · oracle 파일 커밋 |
| U4-1 F0a | 순수 모듈: 좌표(회전·CropBox)·페이지 선택·토큰·glyph coverage·캔버스 상한 정책·여러 줄·도장 좌표 | 확정 1·7·9·10·18·21·22 | unit(골든 ①②⑤ 순수 부분) |
| U4-2 F0b | 공용 worker lifecycle 이관(envelope adapter)·finish 취소·기존 4모드 불변 증명 | 확정 2·19 | `TEST_SCOPE=pdf` 전량 + legacy oracle 비교 |
| U4-3 F1 | `/finish`·`/page-numbers`·`/header-footer` route + 번호·머리말·꼬리말 + 오버레이 미리보기·썸네일 선택 + navigation 5칸 + ko/en·SEO·static·소셜 | 확정 9·13·14·15·23·24·26 | `test:pdf-finish` 신설 · static · 시각 scenario(영어 모바일 포함) |
| U4-4 F2 | 워터마크(벡터·배경 stream·타일) + `/watermark` | 확정 4·21·25 | 골든 ③ 렌더 픽셀 |
| U4-5 F3 | 도장·서명 + `/stamp` + undo/redo + 비전자서명 고지 | 확정 8·22 | 골든 ⑤ |
| U4-6 F4a | 구조 제거·양식 flatten·링크 보존 사전 고지 | 확정 5·11·27 | 골든 ④ indirect-object |
| U4-7 F4b | raster flatten + 벤치 매트릭스 + 결정 규칙 적용 | 확정 6·18·20 | 벤치 표 review-notes |
| U4-8 F5 | 복합 순서 골든·legacy 호환·다중 파일/ZIP(C2·C3)·최종 누락 감사 | 확정 3·12·16 | 전 스코프 |
**분기·배포**: `main` 에서 `s3-pdf-finish` 브랜치 하나, 단계별 커밋, **배포는 U4 종료 시 1회**(로드맵 C-A). 단계 사이에 main 이 바뀌면(S2b QR 감량 병합) rebase 금지·merge 로 따라간다.

### H5. C-D 9게이트 전항 적용(로드맵 C-D — v3 「완료 기준」을 대체·보강)
① 시각 회귀 전체 2로케일(+finish scenario 신설, **영어 모바일 scenario 필수** — C-G) ② 접근성 `A11Y_MAX_TOTAL=0` + finish 페이지 등록 ③ 번들 5종(탐색 빌드로 route 귀속 사전 확정, 상한 변경 금지) ④ **CLS ≤0.1 절대**(finish 등록) ⑤ 광고 격리 0·로더 정상(finish 는 격리 경로 아님 — 일반 광고 로더 정상 확인) ⑥ ko/en·SEO·사이트맵·정적·FAQ·소셜(5경로, canonical `/finish`) ⑦ build·`tsc -b`·unit·전 스코프 스모크·static·`test:recovery`·`test:pdf-finish` ⑧ Gemini 로컬 검수 + Claude 육안 + Codex DOM 교차 ⑨ 배포 후 라이브 확인(P2 계약 계승 + Gemini 라이브 재검수 — 신규 화면이 있으므로 S0 처럼 수행).

### H6. 영어 모바일(C-G)
finish 4탭 × ko/en × desktop/mobile 시각 scenario 를 `visual-regression.scenarios.mjs` `pdf-editor` 배열에 추가(현행 4 scenario: organize·image-to-pdf·pdf-to-image·convert 로 추정 — 3차에서 실측). **영어 모바일 320·390px 에서 5칸 navigation 의 fade·active 가시성**(확정 14항 ④)을 scenario 로 고정.

### H7. 3차 반박 요청 항목(정본화 전 이견 0 필요)
v3 잔여 5건(암호 fixture 세대 범위 · 캔버스 상한 3중 검사 위치 · legacy oracle 채취 시점과 F5 비교 방법 · worker adapter 공용 회귀 범위 · 확정 9~20항 실행 가능성) + v4: (a) H1 nth-child 범위 (b) H2 recovery 표본 확장 여부 (c) **H2 route 예산 탐색 빌드 실측**(finish 분리 청크 vs 통합, route/shared 귀속·5종 delta 예측) (d) H2 QR 폰트 자산 정합 (e) H3 하네스 수정 불필요 확인 (f) H4 단계표·U4 1회 배포 vs 중간 배포(예: U4-3 F1 후 1차 배포) 판정 (g) H6 scenario 수와 시각 회귀 상한 20분(C-E: +4 도구 ≈ 5분 기준) 영향.

---

## v5 반영 (2026-09-06, Claude — Codex 3차 반박 잔여 이견 D1~D8 판정. 근거 `/tmp/worklazy-u4-r3/REPORT.md`, 실측 E1~E13)

3차에서 [동의]된 항목(V3-2·3·4, 확정 10·12~19, H1(a)·H2(b)·H4(f)·H5·H6(g))은 Codex 의 "정본 반영 문안"을 그대로 채택한다. 아래는 이견 8건에 대한 Claude 판정이다. **전건 [수용]** — 단 D5 는 수용하되 해법을 Claude 가 제안하므로 4차에서 실증이 필요하다.

| ID | 판정 | 정본 문안(확정 항목 정정) |
|---|---|---|
| **D1** 암호 fixture | **[수용]** | 확정 17·Gemini 검증 4행 정정: U4-0 fixture 생성기는 **R2(RC4) 와 AES-256/R6 각각** open-password·permission-restricted(빈 user password) 4종을 Node `crypto` 만으로 **테스트 전용 고정 salt/key** 로 결정적 생성한다(E1: open 1,361B/restricted 1,380B, PDF.js PasswordException 1/2·정답 OPEN, Poppler AES-256 판독). **"R6 때만 qpdf 확보" 문구 삭제** — qpdf 전제 없음. 기대 oracle: 무암호→실패 code 1 · 오답→2 · 정답/owner→OPEN · restricted 빈 암호→OPEN+permissions `[]`(현행 `inspectPdf` 편집 거부 경계와 일치 → finish 는 이 파일을 "암호 보호로 편집 불가"로 안내). 재현 스크립트의 암호화 구현은 제품 기능이 아니다. |
| **D2** 토큰 의미 | **[수용]** | 확정 9항 표의 "표지 제외 + N쪽부터" 행을 **두 필드로 분리**: `startPage`(물리 시작 페이지, 1-base) · `startNumber`(표시 시작 번호). 규칙: `anchor = max(startPage, excludeCover ? 2 : 1)`, `displayNumber(p) = startNumber + p − anchor`(p = 물리 페이지). 범위·홀짝·썸네일 선택은 **출력 여부만** 정하고 카운터를 압축하지 않는다(확정 9 "건너뛴 페이지도 증가" 유지). 예: startPage=4·startNumber=5·표지 제외·물리 4·6 선택 → 4→"5", 6→"7". `{pages}` 는 물리 총수 유지. 이 표를 unit 골든으로 고정(E5 의 세 갈래 결과가 하나로 수렴함을 단언). |
| **D3** F4b 결정 규칙 | **[수용]** | 확정 20항 재작성: **(A) 단일 캔버스 상한**(`maxSide`·`maxArea`, 보수 후보 4,096²/16.78M px — 페이지별 검사, 확정 18)과 **(B) 문서/배치 누적 자원 예산**(누적 pixels·raw RGBA bytes·최종 PDF bytes·peak heap)을 **분리**한다. A4 150DPI 8페이지 합 17.4M px 는 (A) 위반이 아니다(E5). (B) 상한은 F4b 벤치 실측으로 정하되 **정하는 절차를 먼저 고정**: ① 셀 = fixture 4종 × DPI 3 × 포맷 2 × 기기 2, 각 셀 최종 PDF bytes·peak heap·시간 ② **포맷 기본값은 DPI 별이 아니라 전역 하나** — `photo-scan` 의 300DPI 셀 ratio(PNG/JPEG)로만 결정(≥2.0 → JPEG) ③ DPI 기본값 = 모바일 셀에서 peak heap ≤ **실측 기기 한계의 50%**(256MiB 고정값 폐기 — 벤치 기기의 `performance.memory`/`navigator.deviceMemory` 실측을 근거로 하고 근거 기록) ④ 150DPI 도 (B) 를 넘는 입력은 **거부가 아니라 "지원 제외 안내 + 페이지 범위 축소 제안"**(사용자 결정 경계) ⑤ 경고 임계(입력 10배 또는 100MiB 중 작은 값) 유지. |
| **D4** 재구축 보존표 | **[수용]** | 확정 5·11항 보강: **U4-0 에서 "재구축 시 비대상 구조 보존/지원 제외 표"를 채운다** — 대상: `/Outlines` · `/Names`(Dests·EmbeddedFiles 분리) · `/PageLabels` · `/ViewerPreferences` · `/OCProperties`(OCG) · `/StructTreeRoot`(tagged) · `/Metadata`(XMP) · `/AcroForm` · 페이지 `/Annots` subtype 별. 링크는 **URI · 직접 Dest · 이름 기반 Dest** 를 구분해 새 page ref 로 매핑(E5: copyPages 재구축 후 named destination 소실 실측). 보존을 구현·검증할 수 없는 구조는 **"제거됨"으로 지원 표시에 명시**하고 실행 전 고지(확정 27 확장). "리오픈 성공 = 의미 보존" 으로 쓰지 않는다. |
| **D5** 5종 예산 통과 설계 | **[수용 + Claude 해법 제안 → 4차 실증]** | 사실: fontkit 을 finish 에서 재사용하면 **기존 QR route 의 507KB 가 shared 로 재분류**된다(E6). 이는 신규 바이트가 아니라 **귀속 이동**인데 현행 측정기 `compareAttribution`(S2-H ①)은 **동일 SHA 청크 이동만** 이동으로 인식해 공통 청크 추출(hash 변경)을 순증분으로 센다. **해법(측정기 정밀화, 상한 불변)**: `measure-bundle-budget.mjs` 의 귀속 비교를 **청크 SHA → 모듈(module id) 단위**로 내린다 — manifest/`modules` 의 모듈별 rendered gzip 기여를 산출해, baseline 에서 route 카테고리였던 모듈이 current 에서 shared 로 옮겨간 바이트는 **"이동"**, 카테고리 내 신규 모듈·크기 증가만 **"순증분"** 으로 분리한다. **게이트는 shared·app 의 순증분에 적용**하고 이동은 리포트(이동 총량이 route 예산의 −로 나타나는 것도 기록). 이는 S2-H ① 의 "route→shared 귀속 변경과 실제 증분 분리"(로드맵 C-B·C-C) 를 완성하는 것이며 **5종 상한 값은 바꾸지 않는다**. unit: 현행 통과 · 동일 모듈 이동만 있는 합성 빌드에서 shared 순증분 0 · 신규 모듈 +1B 실패. **이 측정기 변경은 U4-0 에 앉힌다**(U4 첫 커밋, 별도 논리 단위). 4차 반박에서 E6 의 `lazy-fontkit` 빌드로 재계산해 **순증분 shared ≤ +30KB · app ≈ +13KB** 가 나오는지 실증. 실증 실패 시 대안: finish 의 폰트 임베드를 **QR 과 동일한 owner 집합의 청크**가 아니라 별도 `pdfFontEmbed` 청크로 두고 QR 이 그것을 import(QR route 가 shared 를 참조하는 방향) — 그래도 재분류는 같으므로 결국 측정기 정밀화가 정답이다. |
| **D6** clock unit | **[수용]** | H3 정정: `visual-regression.config.mjs` `toolReasons` 에 `pdf-editor` 추가 **와 함께** `tests/unit/visual-config.test.ts`(도구 목록·scenario 수·캡처 수 고정 단언 :47·48·55·69–70)·`visual-clock.test.ts` 기대값을 동반 갱신한다(E8: config 만 바꾸면 unit 1 fail). 런타임(`configureVisualClock`·`visual-regression.mjs:289→:309`) 은 무변경. batch 시작 시 메인 realm 에서 1회 `clock()` 을 호출해 값·locale 을 worker 로 전달(worker 의 `new Date` 에 하네스 주입이 자동 전파된다고 가정하지 않음). |
| **D7** 도장 좌표 | **[수용]** | 확정 22항 문안 교체: **`convertToPdfPoint` 에 넣는 좌표는 그 viewport 의 좌표계**여야 한다. 현행 `pdfPreview.ts:142` 는 CSS scale viewport, `:143–155` 는 별도 `outputScale=DPR` render transform. 따라서 ① 포인터 CSS 좌표 → `getBoundingClientRect` 대비 **CSS 픽셀 viewport 좌표**(bitmap 배율을 곱하지 않음)로 변환 ② **CSS scale 로 만든 viewport** 의 `convertToPdfPoint` 사용 — 또는 bitmap 좌표를 쓰려면 **bitmap 배율을 포함한 viewport** 를 따로 만들어 그 viewport 로 변환(E5: DPR2 에서 전자 조합 16/16 일치, v4 문안 8/16 실패·오차 240~268pt). 골든: DPR 1·2 × CSS 축소 1·0.5 × 회전 4종 = 16조합 전부 일치. |
| **D8** 사실 오기 | **[수용]** | ① 확정 1항: `Résumé €` 는 **Helvetica 성공**(WinAnsi 범위) — 예시를 `Русский`(Helvetica 실패·Noto 성공)로 교체, Greek 누락 문자는 `ή U+03AE`. ② 확정 21항: `pdf-lib` `drawText` 는 **`\n` 분리(lineSplit)·`maxWidth` 줄바꿈을 지원**한다(E5 `TjCount=2`·`T*`) — 미지원은 좌/중/우 정렬·6영역 배치·overflow 정책이므로 "여러 줄 계약"의 대상을 그것으로 좁힌다. ③ 확정 6 표: A4 200DPI 는 `ceil` 로 **1654×2339**. |

**v5 에서 함께 고정하는 3차 [동의] 문안(요약 — 상세는 3차 보고서 표의 "정본 반영 문안")**
- H2(b): finish 5경로 × ko/en × desktop/mobile **20개 정상 진입**은 `test:pdf-finish` 에 둔다(recovery 스모크의 20도구 표본은 불변). **경계·가드 상속 조건**: finish 내부에 중첩 Suspense 를 두면 표식 없는 fallback 이 성공 전에 가드를 지우거나(ToolReady 오판) 성공 후에도 남길 수 있다(E9) → **바깥 `PdfRoute` 의 Suspense/ToolReady 만 재사용**하고 내부 지연 로딩은 `.tool-route-loading` 표식 + 내부 `ToolReady` 를 둔다.
- H5: 접근성에 finish **desktop + 412px mobile** 둘 다 등록. 렌더링에 finish 5경로를 독립 ID·finish-ready selector 로 등록. 등록 목록 unit 의 하드코딩 기대값 동반 갱신.
- H6(g): finish 4탭 interaction scenario 4개(light/dark × ko/en × desktop/mobile = 32캡처) + nav 3상태(직접 진입 active 가시성·스크롤 시작·끝) × ko/en × 320/390 = 12캡처 → **219 캡처/실행, scenario 87**, 예상 5.6분(느린 기준 134.10s/175 비례) — 20분 내. `mobile-320` viewport ID 신설(390 은 기존 `mobile`), 기존 scenario 를 320 으로 전역 중복시키지 않는다. 820/821 은 DOM 단언만.
- H4(f): **U4 전체 1회 배포** 확정(`s3-pdf-finish` 한 브랜치·단계별 커밋·U4-8 뒤 9게이트 1회). F1 중간 배포는 이점보다 2회 게이트·미완성 탭 SEO 관리 비용이 크다.
- 확정 15: navigation 위치 selector 4건(`browser-smoke.mjs:349` + `visual-regression.scenarios.mjs:233·245·258`) 만 대상. 내부 페이지 순서·출력 모드 목록의 nth-child 는 대상 아님.
- V3-4: F0b 는 공용 helper 무수정 **PDF 소유 facade adapter**(nested error→flat code · progress→phase · PDF client 현지화). 완료 기준에 `npm run test:excel-cleaner`·`test:excel-compare` + Excel 소스 `git diff` 불변 추가.
- V3-3: legacy oracle 은 U4-0 에서 `main` 기준으로 채취(옵션 4조합 × 2회, byte·구조·Poppler 렌더 diff 0 확인됨 → byte equality 보조 게이트 허용). U4-0 기록에 의존 버전·OS·폰트·renderer·DPI·배경색 명시, F5 에서 **실제 브라우저(Chrome) 경로**의 PNG 생성까지 재비교.

**4차 반박 요청**: D1~D8 문안의 실행 가능성(특히 **D5 측정기 모듈 단위 귀속**을 E6 빌드로 재계산 — 순증분 shared·app 수치 제시) · D3 절차의 (B) 예산 정의가 F4b 에서 실측 가능한 형태인지 · D4 보존표 초안(구조별 보존/제거 판정) · 잔여 이견 0 여부.

---

## v6 확정 (2026-09-06, Claude — Codex 4차 반박 잔여 7건 판정. 근거 `/tmp/worklazy-u4-r4/REPORT.md` E4-1~E4-11)

4차에서 [동의·해소]된 D2·D6·D7·D8 과 v5 [동의] 재확인 항목은 4차 보고서의 상세 문안(조건부 ToolReady 계약 · rendering 5 route · CLS ≤0.1 차단/0 목표 · 219캡처 예측 · U4-0 측정기 별도 논리 단위 등)을 그대로 채택한다. 아래 7건은 **Claude 결정**이다 — Codex 의 문안 후보를 채택하되 열려 있던 선택지는 여기서 닫는다.

### D1 — 암호 fixture oracle (확정 17 최종)
U4-0 생성기는 Node `crypto` 만으로 **테스트 전용 고정 salt/key** 로 결정적 생성한다. 기대표(E4-6·E4-7 실측):

| 파일 | PDF.js 무암호/빈 암호 | 오답 | 정답·owner | permissions | finish 동작 |
|---|---|---|---|---|---|
| R2 open, `/P=-4` | PasswordException code 1 | code 2 | OPEN | `[4,8,16,32,256,512,1024,2048]` | 편집 거부 |
| R2 restricted, `/P=-64` | OPEN | code 2 | OPEN | `[256,512,1024,2048]` | 편집 거부 |
| R6 open, `/P=-4` | PasswordException code 1 | code 2 | OPEN | `[4,8,16,32,256,512,1024,2048]` | 편집 거부 |
| R6 restricted, `/P=-3904` | OPEN | code 2 | OPEN | `[]` | 편집 거부 |

- 제품 거부 단언은 **`permissions !== null`**(배열 길이 무관 — R2 는 4원소, R6 는 빈 배열이 정상). 안내 문구는 "암호로 보호된 문서라 편집할 수 없습니다"(ko/en, 내부 code 비노출). 바이트 수·SHA 는 U4-0 생성 시 기록해 이후 불변 단언(다른 생성기에 강제하지 않음). qpdf 전제 없음.

### D3 — F4b 계측·결정 절차 (확정 20 최종)
- **A(단일 캔버스)**: 선택 페이지마다 PDF.js viewport(scale=DPI/72, rotation·UserUnit 반영) → `ceil(w)·ceil(h)`·면적 → `maxSide`·`maxArea`(보수 후보 4,096²) 검사. preflight(geometry 전체) + 할당 직전 재검사. 누적은 A 위반이 아니다.
- **B(누적 자원 예산) 지표와 계측 방법(4차 표 채택)**: 누적 pixels(선택 페이지 ceil 면적 합, 문서/배치 별도) · raw RGBA ledger(동시 생존 canvas/bitmap 장수·합계 — peak heap 대용 금지) · 최종 PDF bytes(`save()` byteLength = Blob.size 검산, 중간 PNG/JPEG 별도) · **관측 peak** = main + 사용 worker 각각 CDP `usedSize`·`backingStorageSize` 를 50ms 주기 + 단계 경계(load/render/encode/embed/save/retain/release) 스냅샷으로 수집(page `performance.memory` 와 중복 합산 금지) · native/renderer/canvas 메모리는 실기기 계측 불가 시 **"미측정"** 표기 · 시간(wall + 단계별, cold cache·폰트 fetch 포함 여부 고정).
- **기기 한계 교정 — 실기기 없음을 전제로 고정**: `jsHeapSizeLimit`·`deviceMemory` 를 한계로 쓰지 않는다(E4-5 기각). U4 완료 시점에 실기기 계측이 없으면 **"모바일 한계 미교정"** 으로 review-notes 에 기록하고, **DPI 기본값 = 150**(선택지 150/200/300 제공), 포맷 기본값은 아래 규칙으로 정한다. 실기기 계측이 확보되면 별도 단위에서 기본값 재판정(상한·기준 사후 변경 금지 원칙과 무관 — 기본값은 제품 설정).
- **매트릭스**: fixture 4종(blank·text-vector·photo-scan·투명도(배경 #FFFFFF 고정)) × 페이지 수 축 **1/4/16쪽** × DPI 3 × 포맷 2 × 환경 2(desktop 실측 · Pixel 7 에뮬레이션 — "실기기 아님" 표기) + 다중 파일 3개 배치 1열. warm-up 1회 + 기록 3회, bytes·시간 중앙값(원시값 보존), 자원은 반복 중 최대.
- **포맷 전역 기본값 규칙**: 모바일 에뮬레이션 photo-scan **300DPI 1쪽** 셀의 paired PNG/JPEG 최종 bytes **중앙값 비율 ≥ 2.0 → JPEG q85**, 미만 → PNG. 두 환경 판정이 갈리면 모바일 셀 우선. 사용자는 항상 바꿀 수 있다.
- **가독성 oracle**: text-vector fixture 의 최소 글자(8pt) 라인이 각 DPI 렌더에서 PDF.js 텍스트 추출은 무관하므로, **Poppler 렌더 후 픽셀 기준 x-height ≥ 5px** 를 통과 조건으로 고정(150DPI A4 에서 8pt ≈ 16px 이므로 통과 예상 — 실측 기록).
- **사전 경고·거부**: 예상 출력 bytes(fixture 유형별 보수 추정식: photo-scan 계수 사용, 유형 미판정 입력은 photo-scan 계수) 가 입력 10배 또는 100MiB 중 작은 값 초과 → 경고. A 위반은 DPI 하향 → 150 도 위반 시 "지원 제외 안내 + 페이지 범위 축소 제안". 결과 저장 후 실제 크기 경고는 사전 경고 대체가 아니다.
- **결과 보유**: 결과는 **OPFS 우선, 불가 시 메모리 Blob**; 취소·할당 실패 시 완료된 출력은 보존(partial success), 미완료는 정리. concurrency 1.

### D4 — 재구축 보존/지원 제외 표 (확정 5·11·27 최종 — 4차 표 채택 + 효과 고정)
| 구조 | 결정 |
|---|---|
| 페이지 트리·Contents·Resources·Media/Crop/Rotate | 보존(출력 page ref 사전 배정 후 동일 map 으로 subtree 복사) |
| `/Outlines`(로컬 목적지) · `/Names//Dests`·구식 `/Dests` · `/PageLabels` · `/ViewerPreferences` | **보존**(저수준 graph 복사 + 새 page ref 매핑, E4-4 성공 경로). 검증 밖 action(외부 JS 등)은 unsupported 사전 표시 |
| Info + XMP `/Metadata` | metadata 제거 선택 시 **둘 다 제거 + `updateMetadata:false` 로 재생성 방지**(Producer/CreationDate 자동 생성 없음 단언); 미선택 시 보존 |
| `/AcroForm`·Widget | 미선택 보존 / **제거**·**flatten** 은 배타 모드. flatten 후 dangling Widget ref 명시 정리 → 최종 재구축. XFA·서명 필드·AP 없는 필드는 flatten 지원 제외(사전 고지) |
| 첨부(`/EmbeddedFiles`·`/EmbeddedFile`·`/Filespec`(포함 파일 용도)·`/AF`·`/FileAttachment`) | 첨부 제거 선택 시 **복사 전 필터**로 제거 → 전체 indirect stream 에서 payload sentinel 부재 단언 |
| `/Annots /Link` (URI·직접 Dest·이름 Dest) | **보존**, Dest 는 새 page map 으로 재매핑(E4-4 원형 index 0 오류 → 명시 graph 후 index 1). 실행 전 "하이퍼링크는 유지됩니다" 고지(확정 27) |
| 기타 마크업 주석(Text·FreeText·Highlight·Ink·Stamp·Square/Circle·Line·Polygon·Caret·Popup·Redact 등) | 주석 제거 선택 시 subtype 별 제거(Popup/IRT/Parent 연결 정리). Redact 는 본문 redaction 아님을 문구로 구분. 임의 annotation flatten **지원 안 함** |
| `/OCProperties`·OCG/OCMD · `/StructTreeRoot`(tagged)·ParentTree·MarkInfo | **지원 제외 — 효과 = "경고 후 진행 시 해당 구조 제거"**(확정 25 와 동일 원칙). 사전 고지 문구: "레이어/접근성 태그 정보는 결과에 유지되지 않습니다". 조용한 삭제 금지, 파일 실패 격리 아님 |
| Sound/Movie/Screen/RichMedia/3D·알 수 없는 subtype · 기타 `/Names` 항목 | unsupported 사전 표시 후 **제거**(Link 아닌 것 무조건 삭제는 remove 미선택 시 금지 → 미선택이면 "지원 제외 구조 제거" 고지 하에만 진행) |
| 최종 raster flatten | 픽셀 보존 범위 명시 + 검색/태그/양식/링크 손실을 지원 표시에 명시. raster 후 Link 재부착 **하지 않음**(단순화 — 문서화) |
**구현 순서**: 원본 불변 → 별도 로드(`updateMetadata:false`) → 구조 목록/preflight → 모드 확정 → 위험/미지원 고지 → **복사 전** 필터·필드/AP 처리 → 출력 page ref 사전 생성 → 허용 graph 만 복사/매핑 → 장식 → (선택) raster → 최종 문서 전체 indirect-object·대상 없음·링크 목적지·열기/페이지/렌더 검증. 이 표를 U4-0 fixture 생성의 입력으로 쓴다(sol 이 지원 범위를 정하지 않는다).

### D5 — 번들 측정기 모듈 귀속 계약 + finish 실행 경계 (확정 신설 28)
- **계산식(4차 후보 1~8 채택)**: 청크 실제 gzip `G_c` 보존 · 모듈 가중치 = **독립 rendered gzip**(Rollup `generateBundle` `chunk.modules[id].code` 를 계측 플러그인으로 수집) · 정수 배분(내림 + 나머지 큰 순·동률 id 사전순 1B) · `sum=G_c` 단언 · canonical id 는 realm(main/worker) 구분·패키지 경로·virtual prefix·query 보존 · 동일 id 이전 기여는 같은 category 잔존분 우선, 이동은 `min(기존 잔여, 현재 필요)`, 각 바이트 1회 · **category 순증분 = 총 Δ − 유입 이동 + 유출 이동**, 합 = 실제 app Δ · **게이트: shared·app 은 순증분, entry·선택 route·CSS 는 총 Δ**(route 이동 보정은 하지 않음) · 상한 5종·multiplier·override 불변 · schema 버전 고정, metadata 없는 구 schema 는 **오류**(SHA 폴백 금지) · 신규 route baseline 0·기존 route 누락 거부·유한 정수 검사 유지 · **worker/public JS 는 U4 에서 SHA 기준 opaque 기여로 유지**(worker realm module 수집은 후속 단위 — backlog).
- **실측 기대(재현 조건)**: 3차 E6 빌드 재계산에서 lazy-fontkit shared 순증분 **+80B**·app **+13,264B**, integrated **+90/+14,029B**(E4-3). unit: 현행 통과 · 이동만 있는 합성 → shared 순증분 0 · **상한 도달 상태에서** +1B 실패 · 구 schema 오류.
- **finish 실행 경계(4차 미해결 구성 — Claude 결정)**: **장식 엔진(번호·머리말·워터마크·도장 + 폰트 임베드)은 메인 스레드**에서 실행한다 — QR 라벨 PDF 와 같은 방식, fontkit·`PDFDocument` 를 **공용 lazy 청크(`pdfFontEmbed` — owners=[pdf-editor, qr-studio] → shared)** 로 두고 QR 도 그것을 import. worker 안 fontkit(E7: app +342KB) 은 **기각**. 메인 스레드 취소는 **페이지 루프마다 `signal.aborted` 검사 + `await` 양보**(협력적)로, 무거운 래스터(F4b)와 PDF.js 렌더는 기존 PDF.js worker 가 담당하고 `renderTask.cancel()` 계약(확정 19)을 따른다. **legacy-organize preset 은 현행 `pdf.worker` 경로 불변**(확정 3). 따라서 F0b 의 lifecycle adapter 범위는 **기존 4모드 worker 호출의 취소 전파(신규 finish 가 organize 엔진을 쓰지 않으므로 실제로는 raster/PDF.js 경로 + adapter 골격)** 로 줄어든다 — F0b 산출은 "adapter + Excel 무변경 증명 + finish 메인 엔진 abort 골든".

### N1 — 페이지 선택 상태 전이 (확정 26·9 보강)
- 상태 정본은 **물리 페이지 exact set**(파일별). 텍스트 범위·홀짝 입력을 바꾸면 set 을 재계산. 썸네일 토글은 set 을 직접 바꾸고 **parity=all 로 전환**, 범위 텍스트는 canonical 표기(`2-4,6,8`)로 재생성. `startPage`/표지 제외는 별도 하한 — 제외 페이지 썸네일은 disabled(토글 불가). 파일별 기본 = 전체. 빈 set → 실행 버튼 비활성(빈 PDF 생성 금지). unit 골든: E4-4 의 `2-8 + even` 에서 3쪽 토글 → `{2,3,4,6,8}`·parity all·text `2-4,6,8`.

### N2 — 도장 위치·크기 모델 (확정 8·22 보강)
- 저장: **정규화 중심 `(cx,cy)`(0~1, visual viewport 기준) + 상대 폭 `rw`(도장 폭 / viewport 폭) + 이미지 고유 종횡비**. 대상 페이지 적용: 폭 = `rw × 대상 visual 폭`, 높이 = 폭 / 종횡비(**비율 고정**), 넘치면 두 변을 같은 비율로 축소 후 중심 clamp. "같은 위치" 정의 = 정규화 중심 + 상대 폭. 골든: 400×600 → 600×400 복제에서 종횡비 불변 단언(E4-4 반례 해소).

### N3 — 개행·coverage·레이아웃 순서 (확정 1·21 보강)
- 파이프라인: 토큰 치환 → CRLF/CR→LF 정규화 → LF 로 줄 분리(레이아웃 구분자, 제어문자는 coverage 대상에서 제외) → **실제 그릴 line/glyph run 만** coverage 검사(Helvetica `encodeText` → 실패 시 Noto `getCharacterSet`) → 문서당 폰트 결정·**1회 embed**(Noto 필요 시 공유 인스턴스) → 레이아웃(좌/중/우 × 6영역, 줄 높이 = size × 1.2) → overflow 정책: **폭 초과 줄은 축소 없이 말줄임(…)** + 실행 전 경고 "일부 문구가 잘립니다" → 타일 워터마크는 XObject/폰트 1회 임베드 후 참조 반복. Noto 에도 없는 문자(예: `ή U+03AE`, 이모지)는 위치와 함께 사용자 안내(확정 1 ④).

### 5차 반박 요청
D1·D3·D4·D5·N1·N2·N3 문안의 실행 가능성과 sol 재해석 지점 잔존 여부. 특히 D5 의 "메인 스레드 엔진 + 공용 `pdfFontEmbed` 청크" 그래프를 3차/4차 탐색 빌드 방식으로 1회 재현해 5종(순증분) 통과를 확인하고, D3 의 가독성 oracle 수치(x-height ≥5px) 와 포맷 규칙이 측정 가능한지 판정. 잔여 0 이면 [정본화 가능] 선언.

---

## v7 확정 (2026-09-06, Claude — 5차 반박 잔여 D3·D4·D5·N3 판정. 근거 `/tmp/worklazy-u4-r5/REPORT.md` E5-1~E5-7)

5차에서 [동의·해소]된 D1·N1·N2 와 D5 의 예산·그래프(공용 main 청크 `owners=[pdf-editor,qr-studio]` 507,328B, 순증분 shared +80B·app +13,264B, 5종 PASS, 물리 청크 이름은 계약 아님)는 확정. 아래 4건 **전건 [수용]**.

### D3 — 가독성 oracle·포맷 식·B 예산의 역할 (확정 20 최종 보정)
- **가독성 recipe(U4-0 고정)**: fixture = A4 595.28×841.89pt, Helvetica **8pt `xxxxxxxxxx`** at (72,720) + 색상 벡터 사각형. flatten 결과 **최종 PDF** 를 **Poppler `pdftoppm -r <flatten 과 같은 DPI> -png`** 로 재렌더(재렌더 DPI 를 flatten DPI 로 고정 — 5차 표: 72DPI 재렌더는 FAIL, 동일 DPI 는 150→9px·200→12px·300→17px). ROI = 알려진 글자 bbox, ink = RGB 세 채널 모두 ≤127, 측정값 = ink 세로 bbox 높이. **통과 = `ink_height_px ≥ round(DPI × 0.06)`**(150→9, 200→12, 300→18 — 300 의 5차 실측 17/18px 는 PNG 17·JPEG 18 이므로 임계는 **17** 로 두어 `≥ floor(DPI×0.057)`: 150→8, 200→11, 300→17). Poppler 버전(24.02.0)·threshold·ROI 정의·fixture SHA 를 review-notes 에 기록.
- **포맷 식**: `median_i(PNG_i / JPEG_i)`(**paired 비율의 중앙값**, `median(PNG)/median(JPEG)` 아님) ≥ 2.0 → JPEG q85. 셀 = Pixel 7 에뮬레이션·photo-scan fixture(seed·크기·해시 U4-0 고정, 5차 합성 fixture 7.74 는 참고값)·300DPI 1쪽·흰 배경·warm-up 1쌍 제외 3쌍.
- **B 의 역할 확정 — 이번 U4 에서 B 는 차단 게이트로 쓰지 않는다**(실기기 한계 미교정 명시). B 지표(누적 pixels·raw RGBA ledger·최종 bytes·관측 peak main+worker)는 F4b 벤치에서 **측정·기록만**. 사용자 대면 규칙은 두 개만: ① **사전 경고** = 예상 출력 bytes(Σ선택 페이지 `ceil(w)·ceil(h)` × 유형 계수 — 계수는 F4b fixture 실측 bytes/px 의 photo-scan 값을 보수 기본으로) 가 입력 10배 또는 100MiB 중 작은 값 초과 ② **메모리 폴백 시 누적 결과 상한 200MiB** — OPFS 불가 환경에서 완료 결과 누적 bytes 가 200MiB 를 넘으면 그 시점에 중단·완료분 보존·"파일을 나눠 처리해 주세요" 안내(partial success). 차단은 A(단일 캔버스) + "150DPI 도 A 위반 → 지원 제외 안내 + 범위 축소 제안" 만. 실기기 계측 확보 후 B 차단 도입은 별도 단위(backlog).
- 매트릭스·반복·150 기본값·모바일 미교정 표기는 v6 유지.

### D4 — OCG·태그 제거의 출력 의미 (표 행 최종)
- **OCG(`/OCProperties`·OCG/OCMD·resource `/Properties`)**: 지원 제외 효과 = **"기본 가시성 굳히기"** — 기본 상태(`/D` 의 ON/OFF) 를 평가해 **OFF 레이어의 content(`/OC … BDC…EMC` 블록·`/OC` 가 OFF 인 XObject 호출)는 결과에서 제거**, ON 레이어 content 는 유지하되 `/OC` 마크·참조·`/OCProperties`·`/Properties` 항목을 제거. **oracle = Poppler 렌더 픽셀이 원본 기본 표시와 동일**(5차 반례: 삭제만 하면 OFF 빨간 레이어 6,400px 노출 — 금지). OCMD 표현식(`/VE`)·중첩 BDC·`/OC` 가 폼 XObject 내부에만 있는 경우 등 **평가 불가 입력은 파일 단위로 "레이어가 있는 문서는 구조 제거를 지원하지 않습니다" 고지 후 구조 제거 옵션만 비활성**(장식·raster 는 가능). 사전 문구 2종: "레이어 정보는 결과에 유지되지 않습니다(현재 보이는 상태로 고정)" / "이 문서의 레이어는 처리할 수 없어 구조 제거를 건너뜁니다".
- **Tagged(`/StructTreeRoot`·`/ParentTree`·`/MarkInfo`·page `/StructParents`·annotation `/StructParent`·content `BDC /Tag <</MCID>>` 마크)**: 전부 제거(마크 operator 는 콘텐츠 유지·MCID 속성만 제거), 시각 변화 0 이 oracle(픽셀 동일). 사전 고지 "접근성 태그(읽기 순서) 정보는 유지되지 않습니다".
- 확정 25 와의 관계: 25 는 **배경 워터마크 삽입 시** 위험 문서 경고이고, D4 는 **구조 제거 옵션** 의 효과 — 둘 다 "사전 고지 → 사용자 선택 → 리오픈+픽셀 oracle 실패 시 결과 미제공" 원칙을 공유하되 별개 항목으로 표기.
- AcroForm flatten: 정상 AP 사용 시 `updateFieldAppearances:false` 명시(dirty 한글 값 재생성 → WinAnsi 오류 방지); AP 없음·XFA·서명 필드는 flatten 지원 제외(사전 고지, "값 없는 성공" 금지).

### D5 — 실행 realm 정정·협력적 취소·adapter 범위 (확정 28 보정)
- **realm 정정**: PDF.js worker 는 파싱·디코딩·operator list 생성만 담당하고, **canvas 그리기(`page.render`)·이미지 인코딩·pdf-lib embed/save 는 메인 스레드**에서 실행된다(`pdfPreview.ts:362`, `pdf.mjs:16923/16986`). v6 의 "래스터는 worker" 문구 삭제.
- **협력적 취소 계약**: 양보 helper `yieldToEventLoop()` = `await new Promise(r => setTimeout(r, 0))`(또는 `MessageChannel` 기반) — **`await Promise.resolve()` 금지**(5차: 12/12 페이지 진행, 입력 task 실행 기회 0). abort 검사 지점 = 파일 load 전·후 · 폰트 fetch/embed 전·후 · **페이지/타일 루프 매 반복(양보 포함)** · save 전 · **결과 등록 전(양보 후 재검사)**. 동기 embed/압축/save 한 단위 안에서의 즉시 중단은 **보장하지 않음**을 문서·안내에 명시(5차: Noto embed→draw→save 812ms 동안 타이머 미실행). 취소 시 이미 완료·등록된 파일만 보존.
- **adapter 범위 하나로**: F0b = **실제 `pdfWorkerClient` 호출을 공용 lifecycle facade 로 이관**(signal 은 마지막 optional 인자, 미전달 시 기존 4모드 동작·code·warnings·transfer 완전 동일 — oracle + `TEST_SCOPE=pdf` + Excel 소스 diff 0). finish 는 legacy-organize 엔진을 쓰지 않으므로 이 facade 를 직접 소비하지 않고, finish 자체 취소는 위 협력적 취소 + PDF.js `renderTask.cancel()`(확정 19) 로 한다. "골격만" 옵션 폐기.

### N3 — 텍스트 전처리·coverage·overflow·토큰·타일 (확정 1·21·24 최종)
- **전처리(순수 함수, width 계산과 draw 가 같은 결과를 사용)**: 토큰 치환 → CRLF/CR→LF → **TAB → 공백 4개**(현행 `cleanText` 와 동일) → **그 외 제어문자(U+0000–U+001F(LF 제외)·U+007F·U+0080–U+009F) 는 필드 오류로 실행 차단**("지원하지 않는 문자가 있습니다", 위치 표시) → LF 로 줄 분리.
- **coverage 정책**: "실제 그릴 run" 표현을 **"정규화 후 전체 후보 run(말줄임 적용 전)"** 으로 교체. 후보 run 에 Noto 에도 없는 scalar 가 있으면 **필드 오류로 실행 차단**(위치 안내 — 확정 1④). 말줄임은 coverage 통과 후 레이아웃 단계에서만 발생하므로 `…`(양 폰트 지원) 재검사 불필요.
- **overflow**: 수평 — 영역 폭 < `…` 폭이면 필드 오류 "영역이 너무 좁습니다"; 그 외 초과 줄은 말줄임 + 실행 전 경고. 수직 — 줄 수×줄높이 > 영역 높이면 초과 줄 제거 + 실행 전 경고(조용한 축소 금지 — 경고 표시가 조건). 6영역 여백·폭 유효성: 여백 합이 페이지 치수 이상이면 필드 오류.
- **토큰**: 알 수 없는 `{foo}` 는 **리터럴 유지 + 경고**; `{date:…}` 형식 문자열 오류는 필드 오류.
- **타일**: 간격(gap) 최소 0, 페이지당 타일 수 상한 **400** — 초과 시 필드 오류 "간격을 늘리세요"(조용한 축소 금지). 리소스 1회 임베드·참조 반복 유지.

### 6차 반박 요청
D3·D4·D5·N3 문안의 실행 가능성(특히 D4 OCG "기본 가시성 굳히기" 의 content 제거가 pdf-lib 저수준 API 로 구현 가능한지 5차 OCG fixture 로 probe — OFF 레이어 제거 후 Poppler 픽셀 원본 동일), D3 임계 `floor(DPI×0.057)` 가 5차 표와 정합하는지, D5 양보 helper 로 5차 취소 반례가 해소되는지, N3 전처리 순수 함수의 결정성. sol 재해석 지점 잔존 여부. 잔여 0 이면 "Claude–Codex 간 이견 0 · [정본화 가능]".

---

## v8 확정 (2026-09-06, Claude — 6차 반박 잔여 D3·D4·N3 판정. 근거 `/tmp/worklazy-u4-r6/REPORT.md` E6-1~E6-5)

D5 는 6차에서 [동의·해소](Node·Chrome 취소 12/12→1/12, facade 11검사 통과). v7 D3 의 `round(DPI×0.06)` 잔재는 삭제하고 **`floor(DPI×0.057)` 하나만** 남긴다(6차 실측 8/11/17 ≤ 9/12/17~18 PASS). 아래 3건 **전건 [수용]**.

### D3 — 200MiB 검사 시점·OPFS 실패·경고 계수 (확정 20 최종 보정 2)
- 사용자 규칙은 정확히 **사전 경고 1개 + 메모리 결과 보유 중단 1개**(둘을 "경고"로 합치지 않고, "차단은 A 만"으로 후자를 소거하지 않음).
- **200MiB 는 엄격한 보유 상한**: 메모리 폴백(OPFS 불가) 상태에서 각 출력 완료 시 **등록 전** `retained + current > 200MiB` 검사 → 초과면 **현재 출력 폐기**(기등록 결과 보존) + 안내 "메모리 한도로 남은 파일은 나눠 처리해 주세요" + 다음 파일 시작 안함. 6차 표의 `199,2,1 → 199만 보존`, `201 → 결과 0`, `100,100,1 → 200 보존` 이 기대값. 검사는 D5 의 "결과 등록 전 양보+abort 재검사"와 **같은 지점**에서 순서 = abort 검사 → 용량 검사 → 등록. 진행 중 `save()` 일시 버퍼는 200MiB 보장 대상이 아님(문서화).
- **OPFS 사용 중 quota/write 실패**: 해당 미완료 파일 폐기 + 기등록 결과 보존 + 안내(partial success) — 메모리 폴백으로 조용히 전환하지 않음.
- **경고 계수 집계 고정**: F4b 벤치의 **photo-scan fixture, 실제 적용 DPI·선택 포맷의 해당 셀들(1/4/16쪽 × 두 환경 × 3반복)** 에 대해 `coefficient = max(finalPdfBytes / selectedPixels)`. 미판정 유형에도 같은 계수. 예상 bytes = `Σ(선택 페이지 ceil(w)·ceil(h)) × coefficient` → 입력 10배 또는 100MiB 중 작은 값 초과 시 경고. 계수는 review-notes 에 셀별 원시값과 함께 기록, 벤치 후 임의 튜닝 금지.

### D4 — OCG "기본 가시성 굳히기" 의 지원 문법과 지원 제외 조건 (표 행 최종 보정)
- 6차 반례: OFF 블록 안의 `cm` 이 블록 밖 도형 위치에 영향(통삭제 시 파랑 x=70→10, 3,200px 차이) · OFF 블록 안 `q 10 10 40 40 re Q` 의 current path 를 블록 밖 `f` 가 사용(통삭제 시 1,600px 소실). 색상 픽셀 수 비교로는 못 잡음 → **oracle 은 RGBA 전체 SHA 동일**(위치 포함).
- **(b) 채택 — 안전한 블록만 제거, 그 외는 구조 제거 지원 제외**. OFF marked-content 블록(`/OC … BDC … EMC`)이 다음 **전부**를 만족하면 "자기완결"로 보고 통삭제 허용: ① 블록 내부 `q`/`Q` 균형 + 블록이 `q` 로 시작하고 `Q` 로 끝남(내부 graphics state·`cm`·색·선 상태가 밖으로 전파되지 않음) ② 블록 종료 시 열린 path 없음(마지막 path 연산 뒤 painting 연산자 `S/s/f/F/f*/B/B*/b/b*/n` 으로 종결) ③ `BT`/`ET` 균형(텍스트 상태 `Tf/Tc/Tw/Tz/TL/Tr/Ts` 는 `BT…ET` 안에서만) ④ 중첩 marked content 없음(BDC/BMC depth 1) ⑤ inline image(`BI…EI`) 없음. **하나라도 위반 → 파일 단위 "레이어가 있는 문서는 구조 제거를 지원하지 않습니다" 고지 + 구조 제거 옵션 비활성**(장식·raster 는 허용). `q/Q` 균형 하나만으로 허용하는 문안 기각(6차 두 번째 반례).
- OFF Form XObject 자체 `/OC` 는 `Do` 호출과 리소스 제거(6차 성공). ON 블록은 내용 유지·OC 마크 제거(`/OC /x BDC`→제거, 짝 `EMC` 제거). 평가 불가 감지(OCMD `/VE`·중첩·폼 내부 `/OC`·`/AS` usage)는 6차 preflight 조건 채택 → 같은 고지·비활성.
- **fixture oracle 추가(U4-0)**: 5차 원본(SHA `dc951e2c…f6af`) + 6차 자기완결 블록 5종(PASS 기대, RGBA SHA 동일) + **`cm` 전파·current path 전파 2종(지원 제외 고지 기대 — 변환 시도 금지)**.
- 태그 제거 계약(StructTreeRoot·ParentTree·MarkInfo·StructParents·StructParent·MCID 제거, `/Span <</MCID>> BDC`→`/Span BMC`, 픽셀 동일)은 6차 [동의] 그대로.

### N3 — `{date}` 허용 문법 (확정 24 최종)
- `{date}` = 문서 언어 로케일 기본 표기(ko `2026. 9. 5.` / en `9/5/2026` — `Intl.DateTimeFormat` 기본).
- `{date:<format>}` 의 `<format>` 은 **화이트리스트 문법만**: 토큰 `YYYY`·`MM`·`DD`(각 정확히 1회 이하), 구분자 `-`·`.`·`/`·공백(연속 1개), 토큰 순서 임의. 유효 예: `YYYY-MM-DD`·`YYYY.MM.DD`·`DD/MM/YYYY`·`YYYY MM DD`·`MM-DD`. **그 외(소문자 `yyyy`, `HH`, 리터럴 문자, 빈 형식, 토큰 중복)는 필드 오류**("날짜 형식은 YYYY·MM·DD 와 -, ., / 만 사용할 수 있습니다"). 새 라이브러리·시간 토큰 도입 없음. unit 골든: 6차 표의 `YYYY/MM/DD`→`2026/09/06`(허용), `DD.MM.YYYY`→`06.09.2026`(허용), `foo`/빈 형식 → 오류.

### 7차 반박 요청
D3·D4·N3 문안 실행 가능성 — 특히 D4 자기완결 조건 ①~⑤ 를 6차 fixture 7종(5 PASS + 2 지원 제외)에 적용해 분류가 기대와 일치하는지, D3 등록 전 검사 표 4행 재현, N3 문법 parser 골든. sol 재해석 지점 잔존 여부. 잔여 0 이면 "Claude–Codex 간 이견 0 · [정본화 가능]".

---

## v9 확정 (2026-09-07, Claude — 7차 반박 잔여 D3·D4 판정. 근거 `/tmp/worklazy-u4-r7/REPORT.md` E7-1~E7-4)

N3 는 7차에서 [동의·해소](허용 5·오류 4·보충 14형식·결정성). D3 의 200MiB 등록 전 검사 4행·abort→용량→등록 순서·계수 집계식(포맷·DPI별 photo-scan 셀 `max`, 5차 값 PNG 2.7586 / JPEG 0.3563 B/px — 300DPI 1쪽 셀만의 값이며 F4b 18셀 실측으로 대체) 도 해소. 아래 2건 **[수용]**.

### D3 — OPFS quota/write 실패 뒤 배치 정책 (확정 20 최종 보정 3)
- **가장 좁은 후보 채택: 배치 일괄 중단.** OPFS `createWritable`/`write`/`close` 어느 경계에서든 실패하면 ① 해당 미완료 파일 abort·임시 항목 제거 ② **기등록 결과 보존** ③ **다음 파일을 시작하지 않음**(메모리 cap 문장과 동일 규칙) ④ 메모리 폴백으로 전환하지 않음 ⑤ 안내 "저장 공간 문제로 남은 파일은 처리하지 않았습니다 — 완료된 파일은 내려받을 수 있습니다"(partial success). 7차 표의 `B write 실패 → A 만 등록·C 시작 안함` 이 기대값(`A·C` 계속 루프는 기각). 근거: 저장소 공통 실패는 다음 파일도 같은 실패를 반복할 가능성이 높고, 사용자에게 "일부만 성공" 상태를 한 번에 알리는 쪽이 재시도 판단에 유리. 이후 완화(개별 격리)는 별도 단위.

### D4 — OFF 블록 제거의 안전 조건 6개 + fixture 기대 정정 (표 행 최종 보정 2)
- **새 반례(7차)**: 블록 **밖에서 들어온 current path** 를 블록 안 `f` 가 소비 → 통삭제 시 파랑 1,600px 출현(Poppler·PDF.js 동일). 5조건은 "출구"만 봤다.
- **조건 ⑥ 추가 — 진입 시 current path 비어 있음**: 원본 페이지의 **논리적 Contents 전체(배열 stream 을 순서대로 이어 붙인 단일 토큰 열)** 를 순회하며 각 OFF 블록 **진입 직전**에 열린 path(마지막 path-construction 연산자 `m/l/c/v/y/h/re` 이후 painting/`n` 으로 종결되지 않은 상태) 가 없음을 확인. stream 경계에서 path 상태를 초기화하지 않는다. `BT…ET` 안의 text 상태·`W n` clip 도 진입 전 path 로 취급(clip 은 `W`/`W*` 뒤 `n` 으로 종결되어야 비어 있음).
- **정상 외곽 wrapper 해석**: 블록 전체를 감싸는 `q … /OC BDC … EMC … Q` 처럼 외곽 `q/Q` 가 블록 밖에 있는 경우는 조건 ① 을 "블록 내부 첫 토큰 `q`·마지막 토큰 `Q`" 로만 판정한다(외곽은 무관).
- **fixture 기대 정정(보수적)**: 7차 실행 결과에 맞춘다 — `on`·`xobject-off`·`xobject-on`·`balanced-state` = **허용(RGBA SHA 동일)**; `lexical-decoy`(q/Q 없음)·`state-leak`·`path-leak`·5차 원본 `ocg-off-original.pdf`(q/Q 없음, SHA `dc951e2c…f6af`) = **지원 제외**(변환 시도 0); 7차 신규 `incoming-path`(SHA `14f52bb3…da0d6`) = **지원 제외**(조건 ⑥). 즉 U4-0 fixture manifest = **허용 4 · 제외 5**. "q/Q 없는 자기완결 블록을 허용하는 추가 안전 문법" 은 도입하지 않는다(단순 사각형이라도 상태 전파 판정을 일반화할 근거가 없음 — 보수적 지원 범위가 원칙).
- 지원 제외 효과·고지 문구·평가 불가 감지(VE·중첩·폼 내부·AS)·태그 제거 계약은 v8 그대로.

### 8차 반박 요청
D3 일괄 중단 문안이 7차 OPFS probe 루프로 재현되는지(B 실패 → A 만·C 미시작), D4 조건 ⑥ 을 7차 `classifyPage` 에 추가해 fixture 9종이 **허용 4 · 제외 5** 로 정확히 분류되는지 + 조건 ①~⑥ 을 통과하면서 픽셀이 바뀌는 새 반례 탐색(있으면 이견). sol 재해석 지점 잔존 여부. 잔여 0 이면 "Claude–Codex 간 이견 0 · [정본화 가능]".

---

## v10 확정 (2026-09-07, Claude — 8차 반박 잔여 D4 판정. 근거 `/tmp/worklazy-u4-r8/REPORT.md`)

8차에서 D3 [동의·해소](OPFS 세 실패 경계 모두 A 만 보존·C 미시작·메모리 전환 0), D4 조건 ①~⑥ 으로 fixture 9종 **허용 4 · 제외 5** 일치·허용 4 의 RGBA SHA 두 렌더러 동일. 아래 1건 **[수용]**.

### D4 — 가시성 평가 대상의 명시적 한정 (표 행 최종 보정 3)
- **새 반례(8차)**: `/AS` 없는 OCG 의 `/Usage <</View <</ViewState /OFF>>>>` 를 **PDF.js 는 적용**(빨강 6,400px 출현), Poppler 는 무시 — 렌더러 간 표시가 다르므로 "기본 가시성" 자체가 하나로 정해지지 않는다.
- **결정 — 가시성 평가는 `/OCProperties /D` 의 `/BaseState`·`/ON`·`/OFF` 만으로 한다.** 다음이 하나라도 있으면 **파일 단위 구조 제거 지원 제외**(v8 고지 문구·옵션 비활성 그대로): ① 어떤 OCG dict 에 **`/Usage`** 키(내용 무관 — View/Print/Export/Zoom 등 전부) ② OCG `/Intent` 가 `/View` 이외(또는 배열에 `/Design` 포함) ③ `/D` 에 `/AS` ④ `/OCProperties` 에 **`/Configs`**(대체 구성) ⑤ 기존: OCMD `/VE`·중첩 marked content·폼 내부 `/OC`. `/Order`·`/RBGroups`·`/Locked`·`/ListMode`·`/Creator` 는 표시에 영향 없으므로 무시(제거 대상).
- **fixture manifest**: 9종 + 8차 `usage-viewstate-off`(지원 제외) = **허용 4 · 제외 6**. 허용 4 의 oracle 은 Poppler·PDF.js **두 렌더러 모두** RGBA SHA 원본 동일(둘 중 하나만 동일하면 결함).
- 구현 순서: preflight(위 ①~⑤ + 조건 ①~⑥) → 통과 파일만 변환 → 결과 리오픈 + 두 렌더러 픽셀 oracle(U4-0 fixture) — 런타임에는 구조 검사(OC 잔여 0)만, 픽셀 oracle 은 테스트.

### 9차 반박 요청
D4 지원 제외 조건 ①~⑤ 를 8차 preflight 에 추가해 fixture 10종이 **허용 4 · 제외 6** 으로 분류되는지, 허용 4 가 두 렌더러 SHA 동일인지, **`/D` BaseState·ON·OFF 만 평가할 때 두 렌더러가 갈리는 새 입력**이 남는지 탐색(예: `/BaseState /OFF` + `/ON` 배열, OCMD `/OCGs` 배열 + `/P /AnyOn` 등 — OCMD 는 `/VE` 없이도 `/P` 정책이 있으므로 `/P` 가 `/AnyOn` 이외면 제외로 넣을지 판정 요청). sol 재해석 지점 잔존 여부. 잔여 0 이면 "Claude–Codex 간 이견 0 · [정본화 가능]".

---

## v11 확정 (2026-09-07, Claude — 9차 반박 잔여 D4 판정. 근거 `/tmp/worklazy-u4-r9/REPORT.md` E9-1~E9-8, 174입력 탐색)

9차: 지정 10종 **허용 4·제외 6 일치**, 허용 4 두 렌더러 SHA 동일 [해소]. 새 탐색 174입력에서 v10 preflight 허용 151 중 Poppler 변화 30(28 = OCMD 원시 표현에서 렌더러 간 표시 차이 · 2 = catalog 밖 OCG 등록 허점). Codex 후보 지원 문법을 **[수용]**하여 D4 를 닫는다.

### D4 — OCMD 지원 문법·catalog 검증·평가 순서 (표 행 최종 보정 4)
- **OCMD 인식 범위**: `/VE` 없음 · `/P` 는 생략(=AnyOn) 또는 Name `/AnyOn`·`/AllOn`·`/AnyOff`·`/AllOff` 만.
- **`/OCGs` 원시 값별 규칙(dereference 전에 원시 표현을 본다)**:
  ① **비어 있지 않은 직접 배열** → 모든 원소가 catalog `/OCProperties /OCGs` 에 등록된 OCG 간접 참조일 때만 **4정책 모두 허용**(9차: 32/32 두 렌더러 동일).
  ② **단일 OCG 간접 참조** → 등록 집합에 있고 P 가 생략/`AnyOn`/`AllOn` 일 때만 허용. **단일 참조 + `AnyOff`/`AllOff` 는 지원 제외**(9차 반례 A: Poppler 6,400px 변화).
  ③ **배열을 가리키는 간접 참조**(`/OCGs 6 0 R` → `[…]`) 는 **정책 무관 지원 제외**(9차 반례 B: `AnyOn`·P 생략도 실패).
  ④ 누락·빈 배열·직접 dict 멤버·중첩 OCMD·잘못된 정책 이름 → 지원 제외.
  ⑤ Form XObject 자체 `/OC` 가 OCMD 인 경우도 위 ①~④ 동일 적용(Form 내부 marked content 는 기존 제외).
- **catalog 검증**: `/OCProperties /OCGs` 는 유효한 OCG 간접 참조 집합으로 검증. `/D` 의 `/ON`·`/OFF` 원소는 그 집합의 ref 만 허용 — **등록 밖 ref 는 state map 에 추가하지 않고 지원 제외**(9차 `unlisted-off`·`empty-catalog-OCGs`: 두 렌더러 모두 6,400px 손실). `/D` 없음·`/BaseState /Unchanged` 제외 유지.
- **평가 순서 명시**: BaseState 생략 → ON; 적용 순서 BaseState → `/ON` 배열 → `/OFF` 배열(같은 ref 가 양쪽에 있으면 **OFF 최종 우선** — 9차 실측과 동일, 규격 적합성 인증은 아님).
- **fixture manifest(U4-0)**: 10종 + 9차 대표 반례 4종(`marked-single-AllOff-1` SHA `e4b526bd…b4ab`, `extra-marked-indirect-AnyOn-00` SHA `18ae5a0d…4c74`, `extra-form-indirect-AnyOn-00` SHA `5a8f061e…db86f`, `unlisted-off` SHA `72f2d2a6…0804`) = **허용 4 · 제외 10** + 회귀 세트: 직접 배열 32입력(4정책 × 4상태 × marked/Form) **허용·두 렌더러 SHA 동일**. 생성기는 9차 `probes/` 재사용, 결정성 2회 단언.
- 런타임 구조 검사(OC 잔여 0)는 표시 손실을 잡지 못하므로 **테스트 픽셀 oracle 이 지원 범위의 유일한 증명** — 지원 문법을 넘는 입력은 preflight 에서 전부 제외한다는 원칙 유지.

### 10차 반박 요청
D4 문법을 9차 `candidate-guard.mjs` 와 대조해 174입력 재분류(허용 수·제외 수 제시) + **허용 집합 전부 두 렌더러 SHA 동일**인지 재실행. 문법을 통과하면서 표시가 갈리는 새 입력 탐색(예: OCG 가 다른 OCMD 를 참조·`/OCGs` 배열 안 중복 ref·Resources 상속 `/Properties`·Annotation `/OC`). sol 재해석 지점 잔존 여부. 잔여 0 이면 "Claude–Codex 간 이견 0 · [정본화 가능]".

---

## v12 확정 (2026-09-07, Claude — 10차 반박 잔여 D4 판정. 근거 `/tmp/worklazy-u4-r10/REPORT.md` E10-1~E10-13)

10차: v11 문법으로 174입력 허용 84·제외 90, manifest 4/10, 직접 배열 회귀 32/32, 허용 88 두 렌더러 SHA 동일 — v11 [해소]. 새 반례 (a) OFF 블록 **출구 미완료 `W/W*`**(6조건·깊은 OC 잔여 0 통과, Poppler 6,400px) (b) 열린 `BT` 안의 OFF Form `Do`(PDF.js 311px) (c) **Annotation `/OC`**(24개 전부 OC 잔여·OFF 12개 양쪽 6,400px) · 패턴·SMask·AP 경로 OC (d) catalog 없는 orphan OCG/OCMD 경계 · PDF Name `#xx` 해독. Codex 가 실행한 **보완 후보(`proposed-guard.mjs`: 허용 198 전부 두 렌더러 원본/결과 동일)** 를 그대로 **[수용]**.

### D4 — 최종 지원 문법 (표 행 최종 보정 5)
- v11 OCMD 원시 규칙(`/OCGs` 직접 배열/단일 참조/간접 배열)과 OFF 블록 6조건 유지.
- **catalog 경계**: `/OCProperties` 가 있으면 `/OCGs` 는 **비어 있지 않은 유효 OCG ref 배열**이어야 한다(빈 registry 는 제외). `/OCProperties` 가 없어도 **전체 직접/간접 객체를 검사**해 OCG/OCMD 가 하나라도 발견되면 구조 제거 지원 제외. OC 가 전혀 없는 일반 문서는 허용.
- **조건 ⑦ 출구 clipping**: OFF 블록 내부의 `W`/`W*` 가 **같은 블록 안** painting 또는 `n` 으로 소비되지 않고 끝나면 제외(v9 ⑥ 의 "진입" 검사와 별개로 출구도 검사).
- **조건 ⑧ text 문맥**: OFF XObject `Do` 가 **열린 `BT` 안**에서 실행되면 제외.
- 논리적 Contents 배열 경계에서 상태 초기화 금지(유지).
- **OC 제거 지원 위치 명시**: ① 페이지 논리적 Contents 의 OC marked content ② 페이지 유효 Resources(상속 해소 포함)에 **직접 등록된 Form/Image XObject 자체 `/OC`**. **그 밖의 OC 사용처 — Annotation `/OC`(Link·Square·Stamp·Widget 등 전부), Form/Pattern stream 내부 OC, 패턴·SMask(ExtGState)·AP 경로의 OC — 는 파일 단위 구조 제거 지원 제외**(Annotation 을 조용히 삭제하거나 상시 표시하는 대안 도입 없음). 직접/간접 dict·배열·stream dict·리소스 그래프를 **순환 방지 전객체 탐색**으로 검사하고 미사용(orphan) 객체도 포함.
- **PDF Name `#xx` 해독**을 tag/property/resource 비교와 잔여 검사에 동일 적용.
- 제외 효과·고지 문구·옵션 비활성·장식/raster 허용은 v8 그대로.
- **fixture manifest(U4-0)**: v11 의 10종 + 회귀 32 + 10차 대표 반례(`supp-pending-clip-nonzero-empty` SHA `4da6e14f…c716` · `supp-form-incoming-text` SHA `aa836834…8af6` · `new-annot-Link-OCG-0` SHA `5a99469a…849d` · 빈 registry·catalog 없는 OCMD 2종) = **허용 4 · 제외 15** + 회귀 32(+ 10차 허용 집합 198 중 대표 20 을 회귀 세트에 추가 — U4-0 에서 결정성 2회 단언).

### 11차 반박 요청
v12 문안이 10차 `proposed-guard.mjs` 와 동치인지(184+2+보충 입력 재분류·허용 전부 두 렌더러 SHA 동일), 문안을 통과하면서 표시가 갈리는 새 입력 탐색을 **한 라운드 더**(ExtGState `/SMask` 밖의 다른 ExtGState 경로·Shading `/OC`·Type3 글꼴 CharProcs 내부 OC·Optional content in Widget AP 의 조합). sol 재해석 지점 잔존 여부. 잔여 0 이면 "Claude–Codex 간 이견 0 · [정본화 가능]". **주의**: 지원 범위는 충분히 보수적이므로, 새 반례가 "지원 제외 조건에 이미 걸린다"면 이견으로 세지 말고 fixture 로만 추가.

---

## v13 확정 (2026-09-07, Claude — 11차 반박 잔여 D4 판정. 근거 `/tmp/worklazy-u4-r11/REPORT.md` E11-1~E11-7)

11차: v12 로 355입력 허용 198·제외 157, 허용 전부 두 렌더러 SHA 동일 — v12 [해소]. 새 72입력 중 **Type3 글꼴 반례 2**(CharProcs 에 OC 없음, ON/OFF 블록이 같은 `d1` glyph 재사용 → OFF 블록 제거 후 Poppler 1,722px 변화·PDF.js 0; **원본부터 렌더러 간 표시가 다름**). 이미 제외 조건에 걸리는 탐지 누락 14개는 이견 아님(fixture 후보). **[수용]**:

### D4 — Type3 글꼴 지원 제외 (표 행 최종 보정 6)
- **페이지 유효 리소스 그래프(상속 해소 · Form/Pattern/ExtGState `/Font` 경로 포함, 순환 방지 전객체 탐색)에서 `/Subtype /Type3` 글꼴이 하나라도 도달 가능하면 파일 단위 구조 제거 지원 제외**(d0/d1·OC 유무·glyph 재사용 여부 무관 — "원본 렌더러 간 표시 불일치"는 계약이 성립하지 않는 조건). 고지 문구는 기존 "레이어 처리 불가" 문구를 재사용하되 사유 분류값은 내부 기록에만(사용자 비노출).
- fixture manifest 에 `r11-type3-page-true-1`(SHA `a4718041…7c44a`)·`r11-type3-page-true-0`(SHA `328886f3…899fa`) 을 **제외 기대**로 추가, 11차의 탐지 누락 14 입력을 제외 기대 회귀로 추가(prototype 탐지 누락은 U4-6 구현에서 전객체 탐색으로 잡아야 하며 unit 대상). 최종 manifest = **허용 4 · 제외 31**(15+2+14) + 회귀 32(+대표 20).
- 그 외 v12 문안 전부 유지.

### 12차 반박 요청
v13 문안으로 355+72 입력 재분류(허용 198 유지·제외 증가 확인) + 허용 집합 두 렌더러 SHA 동일 재실행 + **마지막 새 입력 탐색 1라운드**(Type0/CIDFont·Type1 임베드 글꼴은 정적 glyph 라 Type3 와 다른지 대조 2~4개 · 이미지 SMask/Mask 경로 · Transparency Group). **이번 라운드에서 새 반례가 나오지 않으면 "Claude–Codex 간 이견 0 · [정본화 가능]" 을 선언**하고, 나오면 v14 로 1회 더. sol 재해석 지점 잔존 여부 명시.

---

# 정본화 (2026-09-07, Claude)

## 우선순위·읽는 법
「v13 확정」→「v12」→…→「v5 반영」→「v4 현행화」→「v3 확정 사항」→「확정 사항(v2)」→ 초안 본문 순으로 **뒤의 절이 앞의 절을 정정**한다. 같은 주제의 최종 문안은 다음 절에 있다: 폰트 정책 = 확정 1 + N3(v7) + D8(v5) · worker/취소 = 확정 2·19 + D5(v6·v7) · legacy 호환 = 확정 3·16 + V3-3(v5) · 배경 stream = 확정 4·25 · 재구축/제거 = 확정 5·11·27 + D4(v6·v8·v9·v10·v11·v12·v13) · 대용량/래스터 = 확정 6·18·20 + D3(v6·v7·v8·v9) · 토큰·선택 = 확정 7·9·24 + D2(v6)·N1(v6) · 도장 = 확정 8·22 + D7(v5)·N2(v6) · route/preset/navigation = 확정 13·14·15·23 + H1(v4) · clock = 확정 10 + H3(v4)·D6(v5) · 게이트·단계·배포 = H4·H5·H6(v4) + 5차/6차 [동의] 상세(219캡처·1회 배포·mobile-320) · 번들 측정기 모듈 귀속 = D5(v6 확정 28). **암호 fixture oracle 표 = v6 D1 · OCMD/OCG 지원 문법 = v11+v12+v13 · fixture manifest = 허용 4 · 제외 31 + 직접 배열 32 + 대표 20 회귀**.

## 기준 해시
`main` = **`5bc6854175331bdd73b267784d9633cdccda8446`**(S2b 병합 `6173125` + 사후 기록 `5bc6854`, `origin/main` 동일 — 2026-09-07 04:02 Claude 실측). 번들 5종 기준점은 **U4-0 착수 시 main production 빌드**로 새로 고정(`/tmp/s3-bundle-baseline.json`). 브랜치 `s3-pdf-finish`, 단계별 커밋, **배포 1회**(U4-8 뒤).

## 왕복 기록(3~12차, 전부 astra — 산출물 `/tmp/worklazy-u4-r3..r12/`, 보고서 사본 `docs/jobs/todo/pdf-finish-rounds/`)
- 3차 `task-mtpszd7o-9xhstw`: v4 현행화 판정, 잔여 8(D1~D8) — 탐색 빌드로 route 예산 추론 기각·fontkit 재귀속 shared 초과 발견.
- 4차 `task-mtpum9j1-qrmro2`: D5 모듈 귀속 수치 성립(+80B/+13,264B), N1~N3 신규, 잔여 7.
- 5차 `task-mtpvmk24-zt9d8z`: 공용 청크 5종 PASS, 취소 양보 반례, realm 정정, 잔여 4.
- 6차 `task-mtpwhhob-pvakgh`: D5 해소, OFF 블록 통삭제 반례 2(cm·path 전파), 잔여 3.
- 7차 `task-mtpx76pd-mogwv7`: N3 해소, incoming-path 반례, OPFS 다음 파일 정책, 잔여 2.
- 8차 `task-mtq02n3i-256rbi`: D3 해소, `/Usage` 반례, 잔여 1.
- 9차 `task-mtq0tf6b-64biz2`: 174입력 탐색, OCMD 원시 표현 반례·catalog 밖 OCG, 후보 문법, 잔여 1.
- 10차 `task-mtq2ep5c-8dfvhv`: 출구 clipping·BT 안 Do·Annotation OC·orphan, 보완 후보(허용 198 동일), 잔여 1.
- 11차 `task-mtq3h5q4-g7k5pw`: Type3 반례 2, 탐지 누락 14, 잔여 1.
- 12차 `task-mtq4cub1-qsqe6k`: v13 으로 427입력 허용 228 전부 두 렌더러 동일, 마지막 탐색 50 새 반례 0 → **이견 0 · [정본화 가능]**.

## 완료 기준 검증 명령 총람(U4 전체 — 단계별 상세는 H4·H5 및 각 확정 절)
공통: `npm run build` · `npx tsc -b` · `npm run test:unit` · `npm run test:static` · 전 스코프 스모크(`test:browser`·`test:new-tools`·`test:utilities`·`test:office`·`test:qr-bulk`·`test:recovery`) · **`npm run test:pdf-finish`(신설 — 5 preset 진입·SPA 전환·20 정상 진입·404·cancel/retry·오류·geometry·영어 모바일)** · `TEST_SCOPE=pdf npm run test:browser`(legacy 4모드) · `npm run test:excel-cleaner`·`test:excel-compare`(F0b facade 회귀) · `LANG=ko_KR.UTF-8`/`en_US.UTF-8 npm run test:visual`(87 scenario·219 캡처 예측, 상한 20분) · `VITE_LOCAL_QA=1 npm run build` 후 `A11Y_MAX_TOTAL=0 npm run test:a11y`(finish desktop+412 등록) · `npm run test:rendering`(finish 5 route 등록, ≤0.1) · `npm run bundle:measure`(모듈 귀속 순증분 게이트, 5종 상한 불변) · `npm run css:orphans` · `npm run legacy:manifest` · `node tests/tool-registry-routes.mjs`(20 불변) · `git diff --check`.
U4 고유: U4-0 fixture 생성기 결정성 2회(암호 R2/R6 4종·손상 3종·OCG manifest 허용 4/제외 31+회귀·legacy oracle 3종) · 골든 ①~⑦(H5) · F4b 벤치 표(fixture 4 × 쪽수 3 × DPI 3 × 포맷 2 × 환경 2) + 가독성 oracle + 포맷 규칙 판정 · 배경/전경 렌더 픽셀 · 전체 indirect-object orphan 부재 · **두 렌더러(Poppler·PDF.js) RGBA SHA oracle**(OC 구조 제거 허용 집합).

## 명시 제외
공인 전자서명 · 기존 organize/convert 모드 기능·문구 변경(취소 버튼 포함) · pdf-lib → `@pdfme/pdf-lib` 교체 · subset 재시도 · wasm 메모리 상한 시험 · B(누적 자원 예산) 차단 게이트(측정만) · OCG/tagged/Annotation OC/Type3 문서의 구조 제거(지원 제외 고지) · raster 후 Link 재부착 · 실기기 모바일 한계 교정 · 임의 annotation flatten · F1 중간 배포.

## 착수 조건
S2b 배포·라이브 확인 완료(로드맵 S2 종결 조건) → U4-0 부터 sol 디스패치(단계별 지시서는 이 정본의 해당 절을 인용하고 새 결정을 넣지 않는다).

