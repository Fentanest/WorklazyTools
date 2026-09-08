# Merge Gate Checklist

U4 PDF 마무리 브랜치의 병합·배포 전 최종 검증 목록이다. U4-7에서는 변경 표면 검증만 수행했고, 아래 항목은 정본 지시에 따라 U4-8 완료 뒤 한 번 실행한다.

## U4-7 완료

- [x] F4b 144셀 벤치와 별도 3파일 배치, 원자료·48행 표 보존
- [x] 동일 DPI Poppler 가독성 oracle 6/6
- [x] TypeScript, 전체 unit, production/local-QA build, static
- [x] PDF finish 묶음·공식 oracle·PDF 범위 browser·legacy oracle diff 0
- [x] F4b 영향 visual 9/9와 F4b+finish a11y 7상태
- [x] schema-v3 scoped PDF와 full 번들 5종

## U4-8 뒤 1회 실행

- [ ] 전체 `test:browser`
- [ ] `test:new-tools`, `test:utilities`, `test:office`
- [ ] QR 2종 검증
- [ ] recovery 검증
- [ ] Excel 2종 검증
- [ ] 전체 a11y
- [ ] 전체 visual
- [ ] 전체 rendering/CLS
- [ ] `css:orphans`
- [ ] `legacy:manifest`
- [ ] `tool-registry-routes`
- [ ] 성능 12입력
- [ ] 완료 기준 전부 통과 후 U4 PDF 배포 1회

U4-7에서는 main 병합·push·배포를 하지 않는다.
