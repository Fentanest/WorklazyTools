# 검토 기록 (Review Notes)

검토 과정에서 산출된 사고의 결과물 정본 — 판정·기각 사유·실측 수치·가설 검증을 작업 단위로 기록한다(「작업 기록」 규칙). 코드에 일어난 변경 자체는 `CHANGELOG.md`에 간결히 기록하고, 여기에는 "왜 그렇게 했고 무엇을 기각했나"를 남긴다. 같은 길을 다시 제안하기 전에 이 파일을 먼저 확인한다.

## 2026-09-03

### 이미지 P3 — 레이어·다중 선택·컨텍스트 메뉴 판정 (Codx)

- **고정 블록·공통 순서 판정**: `[base,effects…,additional…,overlay…]`를 만드는 공통 helper를 신설하고 미니바 front/back, 레이어 패널 Sortable 재정렬, 컨텍스트 메뉴가 모두 같은 이동 함수만 사용하게 했다. `back`은 effect 개수와 무관하게 고정 블록 바로 위, `front`는 추가 레이어 최상단으로 제한하며 base·effect·crop overlay의 이동 요청은 거부한다. effect는 목록에 노출하지 않고 base 표시 상태를 강제 상속한다. 단위 테스트에서 뒤섞인 6객체를 고정 순서로 복원하고 세 이동 경로의 base/effect 거부를 확인했다.
- **레이어 상태·히스토리 판정**: 목록은 Fabric z순을 역순으로 표시하고 객체별 WeakMap ID로 선택을 연결한다. `moveObjectTo`와 `visible`이 이벤트를 내지 않는 전제를 따라 재정렬·표시 변경마다 즉시 snapshot과 패널 동기화를 수행했다. 활성 레이어 숨김은 단일 선택을 해제하거나 남은 ActiveSelection을 재구성하며, base 숨김은 모든 effect를 함께 숨긴다. Chrome에서 추가 레이어와 base 표시 변경 각각의 undo→redo→undo, 패널 재정렬 undo, 정렬 undo/redo, 다중 복제 undo/redo 뒤 패널 상태와 고정 순서를 직접 읽어 일치함을 확인했다. 숨긴 텍스트 레이어의 PNG data URL이 표시 상태와 달라 export 제외도 확정했다.
- **선택·정렬·복제 판정**: 데스크톱에서 Fabric `selectionKey=shiftKey`와 러버밴드를 켜고, selection hook이 base를 제거한 뒤 잔여 0/1/복수에 맞춰 해제·단일·ActiveSelection으로 강등/재구성한다. 실제 base 우선 Shift 선택은 base+텍스트에서 텍스트 단일로 강등되고 두 번째 도형 추가 시 base 없는 2객체 선택이 됐다. 러버밴드는 unlocked base를 후보로 포함시킨 상태에서도 추가 레이어 3개만 남겼다. 회전 `-8°/23°/-17°`, 비균일 scale 3객체를 scene `getBoundingRect()` 기준으로 좌·가로중앙·우·상·세로중앙·하 6종 × zoom 100/200%에서 정렬했고 12조합 모두 bbox 좌표 편차 0.75px 이하를 통과했다. 다중 복제는 구성 객체를 z순으로 각각 clone하고 24px scene translation을 합성해 활성 clone의 종류·상대 z순을 원본과 같게 유지했다.
- **우클릭·보호 경로 판정**: document 전역 contextmenu 공급은 기각하고 Fabric 7.4의 `instance.on("contextmenu")`만 사용했다. 일반 객체 메뉴는 복제·삭제·앞/뒤, IText는 편집 진입을 추가하며 ActiveSelection은 복제·삭제·6정렬만 제공한다. base·effect·빈 캔버스는 메뉴를 만들지 않고 Fabric upper canvas의 기본 메뉴만 억제했으며 캔버스 밖 우클릭은 `defaultPrevented=false`를 유지했다. Escape·외부 pointerdown·resize·scroll 네 닫힘 조건과 ko/en 문구를 실제 우클릭으로 확인했다. 객체 붙여넣기 공급원이 없고 복제로 요구를 충족하므로 클립보드 상태·붙여넣기 항목은 도입하지 않았다.
- **P4 입력 교차·모바일 판정**: 기존 touch-safe 비주버튼 guard와 crop 박스 target 조기 반환을 유지했다. zoom 200%에서 Space+드래그는 VPT만 바꾸고 ActiveSelection을 만들지 않았으며 crop 모드 드래그는 crop overlay가 소유하고 러버밴드를 만들지 않았다. 기존 P4 crop/effect 동작과 crop overlay 8조합(변형 유무×zoom 100/200%×지우개 유무)은 geometry/saved error 모두 0px로 재통과했다. 390×844에서는 `selection=false`, `selectionKey=null`, layers 하단 시트·44px 이상 행 버튼·패널 유지·삭제 동기화를 확인해 모바일 다중 선택 제외를 고정했다.
- **현지화·SEO·배포 표면 판정**: layers/유형/표시/삭제/정렬/우클릭/다중 선택 문구를 ko/en 동일 키로 추가했고 내부 Fabric 명칭·원시 예외는 화면에 노출하지 않았다. 기존 도구 메타와 SEO featureList가 이미 통합 편집 및 “텍스트·도형·스티커 레이어”를 명시하므로 URL·검색 의미·가이드 정합은 유지되며 별도 SEO 문구 변경은 불필요로 판정했다. 정적 페이지 수, GitHub Pages 단일 페이지 전제, 광고 위치와 광고 제외 격리 경로는 바뀌지 않았다.
- **완료 검증**: `npm run build` exit 0(2,351 modules, Image Studio 416.67KB/129.16KB gzip, 정적 55페이지), `npm run test:unit` exit 0(82/82), `TEST_ONLY_IMAGE=1 npm run test:new-tools` exit 0(P3 전체+P4 전체+DPR/effect), `npm run test:utilities` exit 0, `npm run test:static` exit 0. `git diff --check`와 `node --check tests/new-tools-smoke.mjs`도 exit 0.

### 비디오 A4 — 결과 저장 추상화·스트리밍 ZIP 판정 (Codx)

- **결과 계약·완료 순서**: `VideoWorkerOutput`을 buffer 전용에서 buffer/File/브라우저 임시 파일 참조 공통 계약으로 확장했다. 처리 워커는 완성 바이트를 워커 전용 동기 파일 핸들(미지원 시 비동기 writable)에 먼저 기록한 뒤 참조만 전달한다. 클라이언트의 출력 콜백은 직렬 Promise 큐로 대기해 마지막 `result` 이벤트가 먼저 와도 모든 File 해석·UI 저장이 끝나기 전 작업 성공을 resolve하지 않는다.
- **수명주기·폴백 판정**: 실행마다 난수 세션·소유 ID와 24시간 lease를 만들고, 시작 시 공유 루트 전체가 아니라 만료된 `session-*`만 청소한다. 소유 메타데이터가 다른 세션은 release하지 않으며 성공 파일은 유지하고 실패·취소 시 부분 파일만 삭제한다. 저장 방식 미지원 또는 일반 쓰기 실패는 기존 메모리 결과로 자동 전환한다. 용량 부족은 결과 예상 크기와 16MiB/5% 여유를 검사해 128MiB 이하만 메모리 폴백하고 그보다 크면 내부 명칭·원시 예외 없이 안전 오류를 표시한다. 단위 테스트에서 성공·미지원·소유권 불일치 폴백·용량 부족 소/대 분기·활성 쓰기 취소·TTL 잔재 청소·소유자 전용 해제를 통과했다.
- **메인 힙 실측**: Chrome 152/Linux/16 logical CPU·16.69GB RAM에서 `node scripts/benchmark-video-result-storage.mjs --runs 3 --outputs 4 --bytes-per-output 67108864 --output-dir /tmp/worklazy-video-result-storage-a4`를 실행했다. 64MiB 결과 4개(총 `268,435,456B`)의 File wrapper와 object URL을 모두 유지하고 강제 GC 뒤 측정한 세 실행의 메인 JS 힙 증분은 모두 `69,604B`, worker→main 전송 ArrayBuffer는 `0`이었다. 출력 바이트/힙 바이트 비율은 `3,856.61`, 결과 크기 대비 힙 상주 비율은 `0.02593%`였다.
- **ZIP 구현·스트리밍 실측**: 비디오 경로의 JSZip 참조를 0건으로 만들고 `@zip.js/zip.js@2.9.0`을 exact lock했다. `BlobReader` 입력을 `for` 루프의 순차 `await ZipWriter.add`로만 추가하고 입력·출력 모두 `bufferedWrite:false`, 각 add와 close에 `zip64:true`를 강제했다. 프로덕션 helper의 `8,388,731B` 계측 입력은 전체 `arrayBuffer()` `0`회, stream `1`회, `129`개 입력 구간·최대 `65,536B`; ZIP 출력은 `8,389,205B`를 `136`회 write·최대 `65,536B`로 기록했다. ZIP64 EOCD·locator·classic EOCD를 모두 확인하고 런타임 fixture를 시스템 `unzip -t/-p`로 왕복해 payload SHA-256 동일성을 통과했다.
- **브라우저 회귀·번들 판정**: 실제 Chrome 비디오 스모크에서 그룹 결과 2개가 세션 임시 파일로 남고 ZIP도 같은 세션의 ZIP64 파일로 생성됨을 확인했다. ZIP 워커 요청은 화면·결과 생성 전 `0`건, ZIP 버튼 뒤 정확히 `1`건으로 지연 로드를 유지했다. 사용자 화면에는 내부 저장/라이브러리 명칭이나 원시 번역 토큰이 없고, 새 ko/en 임시 파일 안내와 오디오 스튜디오 BroadcastChannel handoff도 통과했다. URL·검색 의미·정적 SEO 페이지·광고 위치·광고 제외 격리 경로·서버 전제는 바뀌지 않아 추가 SEO/AdSense 코드는 불필요로 판정했다.
- **의존성·범위 판정**: 라이선스 생성기가 zip.js 2.9.0 BSD-3-Clause 고지를 자동 반영했다. JSZip은 다른 도구가 사용하므로 전역 제거하지 않고 비디오 경로에서만 교체했다. B1b에서 기각된 Mediabunny는 manifest·lock·소스에 추가하지 않았고 B4·B2·B3은 진행하지 않았다.
- **완료 검증**: `npm run build` → exit 0(2,348 modules, video worker 26.76kB, ZIP worker 144.66kB, 정적 55페이지), `npm run test:unit` → 79/79, `npm run test:new-tools` → HWP·이미지·오디오·비디오 전체 통과, `npm run test:utilities` → ko/en·비디오 호환 포함 통과, `npm run test:static` → 현지화 페이지·self-hosted 런타임·ads/robots/sitemap 통과. `git diff --check`와 비디오 경로 JSZip 0건 검사도 통과했다.

## 2026-09-02

### 비디오 A3 — concat 세그먼트 오프로드 실측·판정 (Codx)

- **구현 판정**: 각 세그먼트 생성 직후 `readFile`→`Blob`→`deleteFile` 순서로 MEMFS 파일을 즉시 해제하고, 전체 Blob을 `processConcatJob` 지역 mount 수명주기에서 WORKERFS로 재마운트했다. concat list는 `-safe 0`과 `/worklazy-concat-segments-<job>/...` 절대경로를 쓴다. mount 디렉터리는 operation 성공·실패 모두 `finally` unmount/delete하며 전역 `mountedDirectories`에 소유권을 넘기지 않는다.
- **1GB급 실측 절차**: Chrome 152/Linux/16 logical CPU·16GiB·COI=true에서 배포 MT FFmpeg.wasm 0.12.10을 사용했다. `node scripts/benchmark-video-concat-memory.mjs --output-dir /tmp/worklazy-video-concat-memory-a3 --runs 3 --comparison-inputs 8 --boundary-high 40 --case-timeout-ms 720000` → 14초 640×360 H.264 고엔트로피 fixture `149,833,058B`, SHA-256 `7fd34d3d…fc02a`를 8개 논리 입력(`1,198,664,464B`)으로 마운트하고 각 4.5초를 패스스루 세그먼트로 만들었다. warm-up 1회 후 before/after 각 3회, Chrome 루트+모든 하위 프로세스 RSS를 100ms로 표본화했다.

| 지표(3회 중앙값) | before: 세그먼트 MEMFS 누적 | after: Blob+WORKERFS 오프로드 | 변화 |
|---|---:|---:|---:|
| MEMFS 파일 합계 피크 | 750,799,433B | 375,397,665B | -50.00% |
| Chrome 프로세스 합산 RSS 피크 | 4,271,190,016B | 3,424,997,376B | -19.81% |
| 경과 시간 | 8,780ms | 10,102ms | +15.06% |
| 출력 크기 | 375,397,362B | 375,397,362B | 동일 |

- **바이트 동일성**: before/after 6회 출력 SHA-256은 모두 `0f5f880412bbe00e1d461d1ec8aa95f77831c01a721aa6070758f8e648d9eefb`, 전체 decode exit 0. 현행 1.5GiB 패스스루 출력 가드 내 최대인 33개 입력(`4,944,490,914B` 논리 합계, 선택분 예상 `1,589,300,651B`)도 양쪽 모두 성공해 **성공 상한 증가는 관측되지 않았고 34개부터 기존 가드가 먼저 차단**한다. 33개 출력은 양쪽 `1,548,511,476B`, SHA-256 `614f7778…10a` 동일이며 MEMFS 피크는 `3,097,045,045B`→`1,548,512,752B`.
- **효과 범위**: 결론은 **“고정 wasm/MEMFS 압박 해제”**로 한정한다. `readFile`→Blob→delete 순간의 MEMFS+JS/Blob 일시 중복은 남고 총 메모리 감소를 보장하지 않는다. 실제로 1GB급 3회 중앙 RSS는 낮았지만 33개 단일 상한 실행에서는 after RSS `7,134,687,232B`가 before `6,894,424,064B`보다 높았다. 따라서 wasm buffer 1GiB는 측정 지표에서 제외하고 MEMFS 파일 합계와 브라우저 프로세스 RSS를 분리해 기록했다.
- **정리 스모크**: 실 FFmpeg WORKERFS mount 후 조인 실패형 `Error`와 취소형 `AbortError`를 각각 강제했고 루트 `listDir` 잔재가 모두 0건이었다. 단위 테스트도 `read`→`delete` 순서와 성공·실패·취소 정리 4건을 통과했다. 외부 취소는 현행 클라이언트가 전용 Worker를 종료하므로 해당 인스턴스의 MEMFS/WORKERFS 자체가 폐기된다.
- **완료 검증**: `npm run build` → exit 0(2,346 modules, video worker 22.46kB, 정적 55페이지), `npm run test:unit` → 69/69, `TEST_ONLY_VIDEO=1 npm run test:new-tools` → grouped concat 포함 비디오 스모크 통과, `npm run test:new-tools` → HWP·이미지·오디오·비디오 전체 통과, `npm run test:utilities` → ko/en·비디오 격리 포함 통과, `npm run test:static` → 현지화 페이지·self-hosted 런타임·ads/robots/sitemap 통과.
- **동반 영향**: 사용자 문구·URL·SEO·정적 페이지·광고 배치·광고 제외 격리 경로·서버 전제는 바뀌지 않아 ko/en·SEO·AdSense에 추가 코드 변경은 불필요로 판정했다.

### 이미지 P4 착수 3묶음 — 크기·내보내기·접이식 패널 판정 (Codx)

- **리샘플 판정**: 작업 캔버스 상한을 4096px로 두고 base·회전 도형·그리기 등 일반 객체의 기존 `calcTransformMatrix()` 앞에 전역 scale 행렬을 합성해 `util.applyTransformToObject`로 적용했다. region-effect는 직접 변환에서 제외하고 base의 원본 로컬 anchor로 다시 동기화했다. 1800×1200 fixture를 둔 900×600 작업공간에서 회전 도형·base를 1200×720 비균일 리샘플했을 때 합성 행렬과 일치했고 효과 행렬도 anchor 산식과 일치했다. 비율 잠금은 가로 1200 입력을 1200×800으로 계산했고, 잠금 해제 뒤 1200×720을 독립 적용했으며 5000 입력은 4096×2731로 제한됐다. 치수 변경 뒤 view는 100%로 초기화됐다.
- **캔버스·히스토리 판정**: 1200×720→400×300 변경은 모든 객체에 중앙 이동 `dx=-400`, `dy=-210`을 적용했고 캔버스 밖으로 잘린 객체를 포함해 객체 수를 보존했다. 치수 undo/redo 모두 1200×720↔400×300과 100% view reset을 복원했다. 모든 메모리 스냅샷에 `outputMultiplier`가 저장됨을 확인하고 이전 스냅샷 값을 1로 강제한 검증에서 undo 결과 안내가 900×600, redo가 원본 화질 배율 결과로 되돌아와 restore 배선을 확정했다. 파일 로드·빈 캔버스·restore 외 크기 작업에서는 multiplier를 바꾸지 않았다.
- **내보내기 판정**: 원본 화질은 기존 multiplier 렌더를 유지하되 4096px 작업 폭에서 결과 폭이 8192px을 넘지 않도록 유효 multiplier를 자동 축소하고 실제 8192px 결과 안내를 표시했다. 지정 크기는 VPT identity의 1× 결과를 목적지 캔버스에 재렌더한다. 잠금 ON 600×400과 잠금 OFF 600×600 결과에서 녹색 대조군 가로폭은 동일하고 세로만 1.4배 이상 늘어 균일/스트레치 분기를 확인했으며, 200% view에서도 data URL이 byte-identical이었다. 9000 입력은 8192로 제한됐다.
- **접이식 판정**: 우측 패널 토글은 `sessionStorage`로 기억되고 821·1020·1440px에서 패널이 사라진 만큼 stage 폭과 반응형 canvas fit이 증가했으며 ResizeObserver가 선택 미니바를 재계산했다. 1020px 접힘 뒤 reload에서도 유지됐고 820·390px에서는 저장값을 무시해 패널을 상대 위치 하단 시트로 강제 표시하고 토글을 비활성화했다. 821px로 돌아오면 저장된 접힘이 다시 적용됐다. sticky canvas는 데스크톱 전 구간에서 유지됐고 ko/en 라벨·aria를 확인했다.
- **완료 검증·동반 영향**: `npm run build`(2,346 modules, Image Studio lazy chunk 402.23KB/125.51KB gzip, 정적 55페이지) · `npm run test:unit`(65/65) · `TEST_ONLY_IMAGE=1 npm run test:new-tools`(P4 1·2묶음과 DPR/effect 회귀 포함) · `npm run test:utilities` · `npm run test:static` 전부 통과했다. 크기·출력 기능은 ko/en UI와 이미지 가이드·도구 메타·SEO featureList를 함께 갱신했다. URL·사이트맵 구조·광고 위치·광고 제외 격리 경로·서버 전제는 바뀌지 않아 AdSense/GitHub Pages 계약에 추가 변경이 없다.

### 이미지 P4 착수 2묶음 — 편집 가능한 자르기 박스·비율 경계 판정 (Codx)

- **박스 편집 판정**: crop overlay만 selectable/evented인 전용 객체로 두고 코너4+변4 컨트롤을 구성했다. 회전·skew 컨트롤은 없고 flip lock을 고정했으며, 박스 위 좌클릭은 Fabric 이동/scale에 위임하고 밖 좌클릭만 한 개의 새 박스로 교체한다. 이동·scale 중 캔버스 경계를 넘지 않았고 scale 동안 패널/플로팅 px 라벨이 변한 뒤 `object:modified`가 정확히 1회 발생해 `scaleX=scaleY=1`·정수 width/height로 정규화됐다. 일반 선택·Delete·미니바·히스토리에는 잡히지 않았다.
- **비율 판정**: `cropTo`의 900px 캔버스 재구성을 폐기하고 1:1·4:3·3:4·16:9·9:16+자유를 박스 상태로 분리했다. 기존 박스는 `w'=min(w,h×r)` 축소 우선 뒤 중심 유지·경계 이동·최소 확대 순으로 바뀌고 모든 preset이 ±1px 비율 오차를 통과했다. preset에서는 코너 4개만, 자유에서는 8개가 노출됐다. 경계의 9:16 최소 결과는 `10×18px`, 10×10 캔버스에서는 9:16이 ko 사유 tooltip과 함께 비활성화됐다. 무박스 preset 드래그와 적용 뒤 비율 유지, 자유 상태 Shift 드래그/핸들 1:1, Alt 드래그/핸들 중심 유지도 통과했다. Fabric 전역 `uniformScaling=true`는 바꾸지 않았다.
- **입력·소유권·출력 판정**: 박스 안/밖 좌클릭과 안/밖 우클릭 네 분기, 단일 touch 드래그, 200% zoom+Space pan 후 핸들 적중, 두 손가락 pinch 뒤 박스 기하 동일을 실동작으로 검증했다. crop↔effect 전환 시 상대 overlay 수는 항상 0이었고, crop 박스를 직접 제거해 내보낸 결과는 박스 취소 뒤 결과와 byte-identical data URL이었다. 핸들 조정 뒤 적용 캔버스 치수는 선택 정수 치수와 정확히 같고 합성 fixture의 녹색 대조군 픽셀도 보존됐다.
- **회귀·완료 검증**: `npm run build`(TypeScript+Vite, 2,346 modules, 55 정적 페이지) · `npm run test:unit`(65/65) · `TEST_ONLY_IMAGE=1 npm run test:new-tools` · `npm run test:utilities` · `npm run test:static` 전부 통과. P4-0 합성 8조합도 표시/저장·적용 오차 `0px`, 저장 치수 오차 `0px`, 펜·지우개·녹색 대조군 보존을 유지했다. 최초 이미지 스모크 사전 시도 1회는 preview 미기동으로 `ERR_CONNECTION_REFUSED`가 나 검증 시작 전 중단됐고, 로컬 preview 기동 후 동일 명령을 재실행해 통과했다.
- **동반 영향 검토**: crop 조작 안내와 극단 비율 사유는 ko/en을 함께 갱신했다. 기능 URL·핵심 검색 의미·SEO 메타데이터·가이드 정적 페이지·광고 위치·광고 제외 격리 경로는 바뀌지 않아 추가 변경 불필요로 판정했다. P4-3 크기 도구와 P4-4 접이식 패널은 건드리지 않았다.

### 이미지 P4 착수 1묶음 — overlay 좌표·상태 의미·선택 UI 판정 (Codx)

- **P4-0 판정**: crop/effect `Rect`의 `originX/Y`를 `left/top`으로 고정하고 비선택·비이벤트·내보내기 제외 속성을 유지했다. effect anchor는 계속 원본 이미지 로컬 좌표이고 히스토리는 세션 메모리뿐이므로 마이그레이션은 불필요하다. 합성 fixture(600×400 회색 바탕+녹색 대조군, `dummyfortest` 미사용)에서 없음/이동+90° 회전+flip × crop zoom 100/200% × 지우개 유무 8조합 모두 stroke 제외 overlay 표시-저장·적용 최대 오차 `0px`, 박스 안 펜 보존, 대조군 보존을 통과했다.

| base 변형 | zoom | 지우개 | 펜 픽셀 적용 전→후 | 지우개 투명 픽셀 | 녹색 대조군 | 기하/저장 오차 |
|---|---:|---:|---:|---:|---:|---:|
| 없음 | 100% | 없음 | 5,563→5,560 | 0→0 | 2,400→2,360 | 0/0px |
| 없음 | 100% | 있음 | 3,987→3,981 | 1,962→1,944 | 2,400→2,360 | 0/0px |
| 없음 | 200% | 없음 | 5,554→5,560 | 0→0 | 2,400→2,399 | 0/0px |
| 없음 | 200% | 있음 | 4,030→4,033 | 1,962→1,973 | 2,400→2,399 | 0/0px |
| 이동+회전+flip | 100% | 없음 | 5,545→5,549 | 0→0 | 2,400→2,399 | 0/0px |
| 이동+회전+flip | 100% | 있음 | 3,984→3,980 | 1,962→1,944 | 2,400→2,399 | 0/0px |
| 이동+회전+flip | 200% | 없음 | 5,553→5,559 | 0→0 | 2,400→2,400 | 0/0px |
| 이동+회전+flip | 200% | 있음 | 4,026→4,024 | 1,962→1,973 | 2,400→2,400 | 0/0px |

- **P4-1 판정**: crop/effect overlay ref·selection·clear와 Escape 분기를 분리했다. 자르기는 버튼·Enter 적용 때만 interaction mode와 active panel이 함께 select로 바뀌며 취소·Escape는 박스만 지우고 crop을 유지했다. effect 취소·Escape도 박스만 지우고 effect 모드/패널을 유지했다. `cropTo`와 P4-2/3/4 표면은 변경하지 않았다.
- **P4-5 판정**: 자르기 적용 버튼을 항상 렌더하고 영역 전에는 disabled + 눈에 보이는 ko/en 사유 + `aria-describedby`를 연결했으며, 활성 상태는 기존 `accent-sky` gradient를 재사용했다. crop/effect 모두 드래그 중 패널 W×H와 박스 우하단 라벨이 갱신됐고 두 overlay 기하 오차는 각각 `0px`였다.
- **동반 영향 검토**: 사용자 문구는 ko/en 동시 반영했다. 기능 URL·의미·SEO 메타데이터·가이드·정적 페이지·광고 위치·광고 제외 격리 경로는 바뀌지 않아 추가 변경 불필요로 판정했다.

### Word 비교 후속(서식 위양성·작성자 통일) — 8왕복 계획·재현 판정 (Claude·Codx·Gemini)

- 위양성 기전: 서명이 런 경계를 `||`로 포함해 proofErr/rsid 분절이 서식 변경으로 오인 — Gemini 전수 분석(127건)·Claude 독립 재계산(124건)·Codex 기본 UI 실측(133건, 방법론 차 정정). 시각 서식 실차이는 highlight 4건뿐(당시 웹 미검출).
- 기각·정정: tracked_docx에 동일 병합 적용안은 문자 토큰 실측으로 기각(Claude 판정 오류 정정) / (작성자,본문) 집합 메모 매칭은 중복 반례로 기각 → durableId→paraId→one-to-one 소비 채택(실 DOCX 식별자 실측) / "생성기 미산출·운영 404" 가설 기각.
- 구현 재현: dummyfortest 계약서에서 웹 133→4, OFF 추적 DOCX cyan highlight 4건, ON 신규 리비전 10건 통일·기존 메모 6건 보존·SML 신규 2건 재작성, identity 3파트 바이트 동일, LibreOffice 변환 성공. 데스크톱판(../word-compare)의 AcceptAll+RevisedAuthor 선례와 의미론 일치.

### 비디오 A2 — 스레드 캡 상향 기각 (Codx)

MT 스레드 상향안 `min(8,max(4,hc-1))`을 실측 후 **기각**. Chrome 152/Linux/16 logical CPU·COI=true에서 배포 MT 코어 0.12.10의 1GiB 고정 힙 선언과 SHA-256(core `270a2e6f…0de`, wasm `be2c9760…c41a`, pthread worker `f77898d6…ca3`)을 검증하고, 기존 fixture `15115424…76c5`에서 만든 24-frame 1080p `0e12db4a…b268`(1,159,714B)·4K `bd5d66f8…e677`(3,303,654B)를 `node --experimental-strip-types scripts/benchmark-video-threads.mjs --output-dir /tmp/worklazy-video-thread-benchmark-a2 --runs 3 --browser-timeout-ms 180000 --vp9-timeout-ms 45000 --resume`로 warm-up 후 3회 측정.

- 브라우저 4→8스레드: H.264 1080p `1,560.385/1,569.560/1,640.370ms`(중앙값 1,569.560ms·143,819B·decode 0)에서 8스레드 warm-up 180초 timeout으로 퇴행. H.264 4K 양쪽 OOM, HEVC 1080p·4K 양쪽 warm-up timeout, VP9 1080p·4K 양쪽 OOM.
- host 격리 대체 측정 4→8스레드 중앙값(ms/bytes/peak RSS KiB): H.264 1080p `437.593/143886/402648 → 340.648/141747/484764`, 4K `1751.354/394724/1244604 → 1477.708/397404/1449180`; HEVC 1080p `725.026/159821/541552 → 657.139/159821/615800`, 4K `1666.618/312940/1732880 → 1535.939/312940/2018652`; VP9 1080p `1525.762/306592/462648 → 1289.052/306592/487816`, 4K `4154.374/568351/1437528 → 3232.429/568351/1462640`. 전부 decode 0·host OOM 0.
- **판정**: host 시간 7.84–22.19% 감소에도 RSS 전 조합 1.75–20.39% 증가, 4K는 4스레드부터 이미 1GiB 초과, 실제 브라우저 성공 경로가 후보에서 정지 → 속도 이득·힙 안전 게이트 미충족으로 기각. `multiThreaded` 배선은 무해·유용하여 유지.

### 이미지 Phase 2 — 스티커 후보 스파이크 (Codx)

Twemoji v17.0.3(4,009개, 10,121,593B, 개별 gzip 합 4,475,637B) vs Noto Emoji v2.051(3,731개, 32,128,362B, 11,225,395B)을 경로별 라이선스 원문까지 비교해 **Twemoji 채택, Noto는 원시 3.17배·gzip 2.51배 규모로 기각**. 상한 120종 중 7카테고리 112종을 코드포인트·바이트·SHA-256 manifest로 고정(실제 합계 142,436B/개별 gzip 71,573B). Image Studio lazy chunk 356.23→384.87KB(gzip 109.76→120.86KB), SVG 본문 미포함.

### XLS 보존 첫 진입 실패 — 기전 확정·가설 기각 (Codx)

전역 격리 헤더 없는 GitHub Pages 동형 서버 재현으로 기전 확정: 표준 Excel 화면의 전역 SW 제어 뒤 보존 화면 첫 이동 시 문서는 `COEP: require-corp`로 격리되지만 `/assets/excel.worker-*.js` 응답은 무헤더 → Chrome `ERR_BLOCKED_BY_RESPONSE` 차단 → 합성 4파일 전부 "파일 처리를 시작하지 못했습니다". ko·en 보존 정적 페이지는 `332d8f7`부터 생성·검증되고 착수 시 운영도 200이어서 **"생성기 상수만 존재·운영 404" 가설(Claude C1 일부)은 기각**. `credentialless` 비디오 문서에서 `require-corp` 워커 스크립트 호환은 실기동으로 확인.

### 이미지 I2 줌·팬 — 기각안 (Codx)

보기 변환(VPT)을 반응형 fit이나 편집 기록에 섞는 안, DPR을 재유입하는 `getTotalObjectScaling` 계산은 각각 의미 충돌·강도 회귀로 **기각**. 강도 계약은 `getObjectScaling()+getZoom()` 유지 — DPR 1·2 × 100·200%에서 같은 16px·8px 소스 블록 실측.

### 엑셀 위장 XLS — F0 판정·기각 (Codx)

실파일 4개 재현에서 고정 ZetaOffice는 두 SpreadsheetML을 모두 열고 변환·4파일 병합까지 성공 → **"ZetaOffice SpreadsheetML 미지원"·"전각 파일명 단독 원인" 가설(Claude C1·C3) 기각**. SheetJS 0.20.3은 `AC285_202606.xls` 성공·`AC285_20260８５８6.xls` 실패(XLML CDATA)로 파일별 지원 편차 판정. OLE 헤더만 붙인 빈 fixture는 ZetaOffice가 정상 변환해 실패 fixture로 기각(→ 이벤트 주입식 결정론 테스트로 대체). 모든 `.xls`에 문자열 파싱을 적용하는 안은 기존 OLE 경로 회귀 위험으로 기각.

### 이미지 I1+I3 — 기각안 (Codx)

광고 공간을 침범하는 뷰포트 전체 고정 레이아웃은 AdSense 정책 충돌로 기각(Gemini 검증)·sticky 캔버스 채택. `src/app/seo.ts`·ko/en `tools.json`·이미지 가이드는 기능 의미가 정확해 변경 불필요 판단.

### 비디오 A1·B1b — 실측·기각 (Codx)

- A1 VP9 `-deadline good -cpu-used 4`: host libvpx 3회 중앙값 7,882.015ms→2,462.353ms(68.76% 감소·3.201×), 출력 672,326→720,187B(+7.12%), SSIM 0.971567→0.971193·PSNR 28.713933→28.708202dB, 전체 디코드 통과. 브라우저 FFmpeg.wasm VP9은 작은 fixture도 메모리 오류 — 별도 런타임 결함으로 기록.
- B1b: zip.js 2.9.0 게이트 3항목(순차 Blob 스트림·강제 ZIP64·외부 unzip 왕복) 통과. **Mediabunny 1.55.5는 B-frame fixture trim duration이 FFmpeg보다 2프레임 길어(계획 허용치 1프레임 초과) B2 후보 기각** → mp4box.js+고정 mp4-muxer 대안 회귀.

### 앱 아이콘 — 기각안 (Codx)

그라데이션 미지원 래스터라이저 재사용(색상 소실), 투명 라운드 아이콘의 Apple·maskable 겸용(마스크 크롭 문제) 각각 기각 → Chrome 렌더링 생성기 + purpose 분리 채택.

### 2026-08-15–16 신뢰성 작업지시서 종결 검토 (Codx)

- 라운드 요약: 1차는 전 도구 영역 약 120항목 감사(P0 데이터 무결성·주요 P1 수정), 2차는 수정 회귀·부분 해결 재검증, 3차는 R1–R14 해결과 블러·비디오 회귀 S1–S14 추적, 4차는 S1–S14 해결 확인.
- 3차 이의 제기 판정 보존: 규칙 출처 표기 일부 수용 / `w:trackRevisions` 삭제 지시는 정식 OOXML 요소 증거로 기각(잘못된 `trackChanges`만 제거) / 오디오 워커 파일 전환 종료는 메모리 정리 정책상 유지 / Excel 끝단 트림 안전장치 완화는 불변식 검증 전까지 기각 / 비디오 memo 콜백 비교는 의도적 무시 계약을 주석·테스트로 확정.
- 4차 T1–T7 재검증(`72981cc` 기준): T1·T2·T3·T5·T6·T7 해결, T4 미해결(`resolveConcatFrameRate(..., fallback = 30)` 잔존 → `docs/backlog.md` 이관). 근거는 `rg` 실측 — T1 `getObjectScaling`·DPR 비의존 테스트, T2 유효 구간 export readiness·60초 probe timeout, T3 `frameRateProbeStatus` 1회 가드, T5 base 위 효과 재정렬·Safari 2–3 pass, T6 선택 영역 소스 픽셀 렌더, T7 주석·가이드·테스트·시트 참조 인덱스. FPS 필터 단순 생략안은 stream-copy 결합 호환성 상실로 기각.
- 종결 검증: `npm run build`(2,336 modules·55 pages) · `npm run test:unit`(15/15) · `npm run test:static` 통과.
