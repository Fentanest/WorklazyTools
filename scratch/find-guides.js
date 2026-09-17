const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/locales/ko/features.json'));
function findGuides(obj, path) {
  if (typeof obj !== 'object' || obj === null) return;
  for (const k in obj) {
    if (k === 'guides' && typeof obj[k] === 'object') {
      console.log(path + '.' + k);
    } else {
      findGuides(obj[k], path ? path + '.' + k : k);
    }
  }
}
findGuides(data, '');
