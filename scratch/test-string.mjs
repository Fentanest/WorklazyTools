const s = "지원 파일 한 개를 놓거나 선택하면 집중 작업 화면 이동, 편집기 준비와 문서 열기를 자동으로 이어서 실행합니다.";
console.log(s.indexOf("자동"));
console.log(s.includes("자동"));
for(let i=0; i<s.length; i++) {
  if (s[i] === '자') console.log('Found 자 at', i);
  if (s[i] === '동') console.log('Found 동 at', i);
}
