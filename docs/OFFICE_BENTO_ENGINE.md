# Office → PDF: Bento 엔진 소스와 연결 기록

## 엔진·자산의 실제 버전

- BentoPDF HEAD `3a5f146d1b89d54dc7ca576aa6797c8bd3e42b97`의 `src/js/utils/libreoffice-loader.ts`에서 `WorkerBrowserConverter`, gzip 자산 로딩, 형식 지정, 인스턴스 재사용 방식을 가져왔다.
- BentoPDF의 현재 잠금 파일은 `@matbee/libreoffice-converter` 2.6.0을 가리키지만, checkout의 `public/libreoffice-wasm/`에 있는 **다섯 파일 모두** 공식 npm **2.3.1** 배포물과 SHA-256이 정확히 일치한다. 파일을 처음 추가한 Bento 커밋 `f30a084fceae5e0dfe9c6b9455def11be7b2644e`의 잠금 파일도 2.3.1이었다. 공식 upstream `v2.3.1`의 커밋은 `b94b8a6887d223be93b082543f5fd32bbd8dc646`이다.
- `scripts/vendor-libreoffice-converter.mjs`는 npm 2.3.1의 browser API·Worker JS·soffice JS·pthread Worker·WASM·data를 같은 세트로 검증하고 `public/vendor/libreoffice-converter/2.3.1/`에 생성한다. WASM과 data는 전송을 줄이기 위해 gzip으로 제공한다. 원본 해시, Worklazy Worker 패치와 결과 해시는 생성된 manifest에 남긴다. 생성 디렉터리는 Git에 넣지 않는다.
- 한글 TTF는 Worklazy가 이미 고정한 `NanumGothic-Regular.ttf`의 해시를 확인해 Bento 정적 경로에 복사한다. 2.3.1 browser API는 사용자 글꼴 전달을 지원하지 않으므로, **같은 버전의 Worker 사본**이 `importScripts` 전에 TTF를 가져오고 Emscripten `Module.preRun`에서 가상 파일시스템에 쓴다. `noInitialRun`은 별도 native main이 이 글꼴 설치·LOK 초기화와 경쟁하지 않게 한다. 다른 Office 엔진의 실행 파일은 요청하지 않는다.

## Worklazy 연결부와 수명

- `bentoOfficeLoader.ts`: Bento 로더의 gzip 해제를 정적 경로에 맞추고, 초기화 Promise 공유, 취소 가능한 다운로드·해제, PDF 서명 확인, Blob URL과 package Worker 수명을 관리한다.
- `officePdfClient.ts`: 브라우저 페이지가 패키지의 **전용 Worker**를 직접 소유한다. 기존 숨김 iframe은 이전 편집 런타임의 캔버스 경계였으며 Bento 변환에는 필요하지 않아 제거했다. 파일은 한 Worker에서 순차 처리하고 사용자 순서를 지킨다. 대기 중 취소는 실행 중 파일을 건드리지 않는다. 요청 ID·세션 동일성으로 이전 결과를 배제한다.
- 취소·시간 초과에는 응답을 기다리는 upstream `destroy()`를 사용하지 않고 소유 Worker를 즉시 `terminate()`한다. 정상 처리 뒤에는 다음 파일에 인스턴스를 재사용하고, 배치 종료의 `releaseOfficePdfSession()` 또는 30초 유휴 타이머에서 Worker와 Blob URL을 정리한다. 작업별 문서 포인터와 가상 입출력 파일은 upstream `handleConvert()`의 `finally`가 정리한다.
- upstream 2.3.1 Worker는 PDF 결과 메시지를 보낸 뒤 `finally`에서 문서 포인터를 파괴한다. 생성기는 `worklazy-ping` 응답을 그 `finally` 뒤 메시지 큐에 추가하고 로더가 응답을 확인한 뒤에만 성공을 반환하게 한다. 문서 정리가 멈췄다면 빈 PDF나 부분 성공으로 표시하지 않고 오류·Worker 종료를 수행한다.
- 원본 파일 헤더로 암호화된 OOXML과 명백하게 잘못된 OOXML을 구분한다. PDF 결과 데이터는 변환 코어가 반환하고 다운로드·ZIP·화면 관리는 Worklazy 작업 계층이 맡는다.

## 실험 근거와 남은 검증

- 같은 synthetic `rich.xlsx` → `rich.docx`, 같은 Chrome·호스트·정적 자산 구성에서 **원본 2.3.1 전체 세트**는 XLSX PDF 2페이지를 3.916초, 이어진 DOCX PDF 2페이지를 4.316초에 만들었고 각 파일의 `documentLoad done`·`SaveAs ret=1`·`documentDestroy done`을 남겼다. **원본 2.6.0 전체 세트**는 초기화 뒤 XLSX `documentLoad(`에서 20초 이상 멈췄다. 두 결과의 가용 메모리는 약 99~100GiB, 메모리 압박 지표는 0이었다. 증거는 gitignored `docs/jobs/todo/converter-office-20261008/coherent-version/result.json`과 같은 디렉터리의 PDF에 있다.
- 2.3.1 원본 PDF의 추출 텍스트에는 한국어가 있었지만 Poppler 렌더링에서 글리프가 사각형으로 보였다. 기존 Worker의 LOK 직전 폰트 쓰기와 `preRun` 폰트 쓰기만 적용한 A/B는 각각 XLSX `documentLoad`에서 20초 이상 멈췄다. `preRun` + `noInitialRun` 조합의 별도 실행은 XLSX 2페이지 PDF 3.315초와 이어진 DOCX 2페이지 PDF 3.761초를 만들었다. 최종 Worklazy 경로에서도 `pdffonts`의 `NanumGothic` 임베딩과 Poppler 이미지의 실제 한국어 글리프를 확인했다. 비교 증거는 `coherent-font-ab/`, `coherent-prerunfont/`, `coherent-prerunfont-noinitial/`과 아래 연속 변환 출력에 있다.
- 2.6.0 `noInitialRun` 단독 실험은 자동 main 경합을 시사했지만, 2.6.0의 다른 native 자산에서 잔여 정지가 있었다. 2.3.1의 글꼴 연결은 대응하는 **2.3.1 전체 자산** 안에서만 적용한다. 임의 예열·짧은 자동 재시도·다른 엔진 전환은 포함하지 않는다. 최초 후보의 속도 측정도 현 후보 수치로 재사용하지 않는다.
- `npx tsc -b --pretty false` 통과. `tests/office-bento-batch-stress.mjs`를 세 개의 **새 Chrome 세션**에서 첫 입력을 XLSX·DOCX·PPTX로 바꿔 실행했다. 각 세션의 12개 파일, 총 **36/36개 PDF**를 Poppler로 다시 열어 페이지·한글/영문·표·그림·시트·슬라이드 비율과 임베드된 한글 글꼴을 확인했다. 매 세션에서 Bento Worker 시작/종료는 각각 1회, 외부 요청은 0건, 각 파일의 `documentLoad done`·`SaveAs ret=1`·`documentDestroy done`은 각각 12회였다. 입력별 최초 파일은 3.375~3.421초, 엔진 준비 후 파일은 같은 세션에서 0.06~0.588초였다. 이 측정 동안 MemAvailable 최솟값은 97.8GiB, memory PSI full avg10은 0이었다. 이는 해당 합성 입력·호스트 조건의 실측이며 일반 문서 속도·브라우저 전체 메모리 수치를 뜻하지 않는다. 결과와 PDF·렌더 PNG는 `docs/jobs/todo/converter-office-20261008/stress-231-prerun-{0,1,2}/`에 있다.
- `tests/office-bento-smoke.mjs`는 12개 PDF와 대기 중 취소, 변환 중 취소 뒤 다음 성공, 로딩 60%에서 취소 시 새 Worker 0개, 강제 자산 실패 뒤 새 세션 성공, 손상 파일 뒤 다음 성공, 명시 해제 후 소유 Worker 0개와 외부 요청 0건을 확인했다. 별도 A/B/C 경합에서는 XLSX A 완료·대기 중 B 취소·DOCX C 완료가 각각 3.555초·AbortError·3.906초에 끝났다. 증거는 `smoke-231-prerun-final/`와 `queue-231-final/`이다.
- 현재 후보의 **Vite 프로덕션 빌드·정적 검사·프로덕션 UI** 검증과 큰 문서의 브라우저 PSS·UI 응답성 측정은 통합 후보에서 남아 있다. 이전 iframe·2.6.0 후보의 속도 수치는 현재 후보에 재사용하지 않는다. 호스트 메모리·swap 소진 상태에서 중단한 실행도 통과에 넣지 않았다.
- 2.3.1 엔진에 원래 확장자의 `sample.hwp`·`sample.hwpx`를 직접 넣은 시험에서 HWP는 45초 안에 완료되지 않았고 HWPX는 `loadComponentFromURL returned an empty reference`로 실패했다. HWP/HWPX를 Bento Office 지원 형식에 추가하지 않았고 기존 한글 입력 경로는 그대로 둔다.
