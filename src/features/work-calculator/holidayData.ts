/** Reviewed sources/effective dates: docs/work-calculator-rules.md. No runtime requests. */
export const HOLIDAY_DATA_VERSION = '2026-10-14.v1';
export const HOLIDAY_CHECKED_AT = '2026-10-14';
export const HOLIDAY_MIN_YEAR = 2000;
export const HOLIDAY_MAX_YEAR = 2050;
export const HOLIDAY_RECORDED_THROUGH = 2026;
export const HOLIDAY_SOURCES = {
  rules: 'https://www.law.go.kr/법령/관공서의공휴일에관한규정',
  history2013: 'https://www.law.go.kr/lsInfoP.do?lsiSeq=145846&efYd=20131105',
  mpm: 'https://www.mpm.go.kr/mpm/info/infoService/BizService02/',
  lunar: 'https://astro.kasi.re.kr/life/post/calendarData',
  elections: 'https://info.nec.go.kr/',
  temporary2002: 'https://www.korea.kr/news/interviewView.do?newsId=148798916',
  temporary2025: 'https://www.korea.kr/news/policyNewsView.do?newsId=148938559',
  election2025: 'https://www.korea.kr/news/policyNewsView.do?newsId=148941443',
} as const;
// Nationwide election dates; regional by-elections are not nationwide public holidays.
export const ELECTION_DATES: readonly [string, 'assembly' | 'president' | 'local'][] = [
  ['2000-04-13','assembly'],['2002-06-13','local'],['2002-12-19','president'],
  ['2004-04-15','assembly'],['2006-05-31','local'],['2007-12-19','president'],
  ['2008-04-09','assembly'],['2010-06-02','local'],['2012-04-11','assembly'],
  ['2012-12-19','president'],['2014-06-04','local'],['2016-04-13','assembly'],
  ['2017-05-09','president'],['2018-06-13','local'],['2020-04-15','assembly'],
  ['2022-03-09','president'],['2022-06-01','local'],['2024-04-10','assembly'],
  ['2025-06-03','president'],['2026-06-03','local'],
];
export const TEMPORARY_DATES = ['2002-07-01','2015-08-14','2016-05-06','2017-10-02','2020-08-17','2023-10-02','2024-10-01','2025-01-27'] as const;
