const fs = require('fs');
let content = fs.readFileSync('src/features/office-editor/officeRuntime.ts', 'utf8');

// Add timeout to loadClassicScript
content = content.replace(
  'function loadClassicScript(url: string) {',
  `function loadClassicScript(url: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    let timer = setTimeout(() => reject(new Error("office-operation-timeout")), 30000);
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); reject(new Error("office-start-failed")); };
    document.body.appendChild(script);
  });
}
function loadClassicScript_old(url: string) {`
);
content = content.replace(/function loadClassicScript_old[\s\S]+?\}\n/, '');

// Add timeout to uno_main
content = content.replace(
  'const port = await globalThis.Module.uno_main;',
  `const port = await Promise.race([
    globalThis.Module.uno_main,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("office-operation-timeout")), 30000))
  ]);`
);

// We should also allow aborting launchOfficeRuntime
content = content.replace(
  'export async function launchOfficeRuntime(',
  `export async function launchOfficeRuntime(`
);

fs.writeFileSync('src/features/office-editor/officeRuntime.ts', content);
