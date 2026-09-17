const fs = require('fs');
let content = fs.readFileSync('src/features/office-editor/OfficeEditorAppPage.tsx', 'utf8');

// We need a state to track if runtime initialization was attempted
// so we know if a hard reload is required.
content = content.replace(
  'const runtimeRef = useRef<OfficeRuntime>();',
  `const runtimeRef = useRef<OfficeRuntime>();\n const runtimeTaintedRef = useRef(false);`
);

content = content.replace(
  'const runtime = await launchOfficeRuntime(',
  `runtimeTaintedRef.current = true;\n   const runtime = await launchOfficeRuntime(`
);

// In the Try again button, if runtimeTaintedRef.current is true and !runtimeRef.current, we must reload!
content = content.replace(
  'if (runtime) void openFile(file, runtime); else void start(file);',
  'if (runtime) void openFile(file, runtime); else if (runtimeTaintedRef.current) window.location.reload(); else void start(file);'
);

// Also change the Try again button to handle the case where `file` is missing (if they want to retry preparation)
// Wait, the prompt says "초기화 실패·취소에 파일이 없어도 재시도 제공."
content = content.replace(
  '{state === "error" && file ? <Button',
  '{state === "error" ? <Button'
);

content = content.replace(
  'onClick={() => { const runtime = runtimeRef.current; if (runtime) void openFile(file, runtime); else if (runtimeTaintedRef.current) window.location.reload(); else void start(file); }}',
  'onClick={() => { const runtime = runtimeRef.current; if (runtime && file) void openFile(file, runtime); else if (runtimeTaintedRef.current) window.location.reload(); else void start(file); }}'
);

// Update error text to mention reload if tainted.
// In `editorError`, let's not change it directly here. We can change the button text to "새로고침(Reload)" if tainted.
content = content.replace(
  '>{L("다시 시도", "Try again")}</Button>',
  '>{runtimeTaintedRef.current && !runtimeRef.current ? L("페이지 새로고침", "Reload Page") : L("다시 시도", "Try again")}</Button>'
);

fs.writeFileSync('src/features/office-editor/OfficeEditorAppPage.tsx', content);
