import re

with open("src/features/hwp-editor/HwpEditorPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add useFocusMode hook
hook_code = """
  const progress = useOperationProgress();
  const file = files[0];

  const setFocusMode = useFocusMode();
  useEffect(() => {
    setFocusMode(documentOpen ? "editor" : "standard");
    return () => setFocusMode("standard");
  }, [documentOpen, setFocusMode]);
"""
content = re.sub(
    r'const progress = useOperationProgress\(\);\s*const file = files\[0\];',
    hook_code.strip(),
    content
)

with open("src/features/hwp-editor/HwpEditorPage.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("HwpEditorPage patched")
