export const REPORT_LABELS = {
  en: { metadata:'Metadata',results:'Results',field:'Field',value:'Value',id:'ID',status:'Status',left:'Original',right:'Revised',leftLine:'Original line',rightLine:'Revised line',coordinates:'Coordinates',warning:'Warning',scope:'Scope',completion:'Completion',layout:'PDF layout: tabs use 4 spaces; line endings are visual line breaks. Raw TXT preserves the original records.' },
  ko: { metadata:'메타데이터',results:'비교 결과',field:'항목',value:'값',id:'ID',status:'상태',left:'원본',right:'수정본',leftLine:'원본 줄',rightLine:'수정본 줄',coordinates:'좌표',warning:'경고',scope:'범위',completion:'완료 상태',layout:'PDF 표시: 탭은 공백 4개이며 줄바꿈은 화면의 줄 구분으로 표시합니다. 원문 TXT는 원래 기록을 보존합니다.' }
} as const;
