const camelCase = (str) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
console.log(camelCase('document-redactor'));
console.log(camelCase('documentRedactor'));
