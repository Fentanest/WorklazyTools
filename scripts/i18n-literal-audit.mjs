import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import allowlist from './i18n-literal-allowlist.json' with { type: 'json' };

const hangul = /[가-힣ㄱ-ㅎ]/u;
const languageCondition = /\b(?:ko|en|korean|english|isKo|isKorean|lang|language|locale|currentLanguage|resolvedLanguage)\b/u;
const pairedCalls = new Set(['L', 'local', 'localized', 'localize']);

function symbolName(node, source) {
  return (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name
    ? node.name.getText(source) : undefined;
}

function exemption(node, source, file, rules) {
  if (/^https?:\/\//u.test(node.text || '')) return 'Non-display URL';
  for (let current = node; current.parent; current = current.parent) {
    const parent = current.parent;
    if (ts.isCallExpression(parent)) {
      const name = parent.expression.getText(source);
      if ((name === 't' || name.endsWith('.t')) && parent.arguments[0] === current) return 'Translation key';
      if (pairedCalls.has(name) && parent.arguments[0] === current && parent.arguments.length >= 2
          && !hangul.test(parent.arguments[1].getText(source))) return 'Korean/English call pair';
    }
    if (ts.isConditionalExpression(parent) && languageCondition.test(parent.condition.getText(source))) {
      const other = parent.whenTrue === current ? parent.whenFalse : parent.whenFalse === current ? parent.whenTrue : undefined;
      if (other && !hangul.test(other.getText(source))) return 'Language-selected pair';
    }
    if (ts.isPropertyAssignment(parent) && parent.name.getText(source) === 'ko'
        && ts.isObjectLiteralExpression(parent.parent)
        && parent.parent.properties.some(p => p.name?.getText(source) === 'en')) return 'Korean locale member';
    const symbol = symbolName(parent, source);
    const rule = symbol && rules.find(rule => rule.file === file && rule.symbol === symbol
      && (rule.text === undefined || rule.text === node.text));
    if (rule) return rule.reason;
  }
  return undefined;
}

export function auditTsxSource(text, file = 'fixture.tsx', rules = allowlist) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [], excluded = [];
  function visit(node) {
    if ((ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateHead(node)
        || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && hangul.test(node.text || '')) {
      const reason = exemption(node, source, file, rules);
      const entry = { file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        kind: ts.SyntaxKind[node.kind], text: node.text };
      if (reason) excluded.push({ ...entry, reason });
      else findings.push(entry);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { findings, excluded };
}

export function auditTsxTree(root = 'src') {
  const files = [];
  function walk(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name);
      if (item.isDirectory()) walk(file);
      else if (file.endsWith('.tsx')) files.push(file);
    }
  }
  walk(root);
  if (!files.length) throw new Error('i18n literal audit selected zero TSX files');
  const results = files.sort().map(file => auditTsxSource(fs.readFileSync(file, 'utf8'), file.replaceAll(path.sep, '/')));
  return { files: files.length, findings: results.flatMap(r => r.findings), excluded: results.flatMap(r => r.excluded) };
}
