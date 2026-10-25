/**
 * Public DART viewer link for a filing receipt, same shape loadSnapshot accepts for `filingUrl`.
 * Lives in the data layer because the UI source guard (foliotrace-ui.test.ts) forbids absolute URLs in UI files.
 */
export function dartFilingUrl(receiptNo: string): string {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${receiptNo}`
}
