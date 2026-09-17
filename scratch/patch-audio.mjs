import fs from "fs";

let content = fs.readFileSync("src/features/audio-studio/AudioStudioPage.tsx", "utf-8");

// Add imports
if (!content.includes("useAppliedTheme")) {
  content = content.replace(
    'import { useCallback',
    'import { useAppliedTheme, getSemanticColors } from "../../theme";\nimport { useCallback'
  );
}

// Add hook
if (!content.includes("const theme = useAppliedTheme()")) {
  content = content.replace(
    '  const [audioFailure, setAudioFailure] = useState("");',
    '  const theme = useAppliedTheme();\n  const [audioFailure, setAudioFailure] = useState("");'
  );
}

// Replace hardcoded waveColor, progressColor, cursorColor inside create
content = content.replace(/waveColor: "[^"]+"/, "waveColor: getSemanticColors().wave");
content = content.replace(/progressColor: "[^"]+"/, "progressColor: getSemanticColors().progress");
content = content.replace(/cursorColor: "[^"]+"/, "cursorColor: getSemanticColors().cursor");
content = content.replace(/color: "rgba\\([^)]+\\)"/g, "color: getSemanticColors().region");

// We need a ref for disableDragSelection to clean it up when theme changes
if (!content.includes("dragSelectionCleanupRef")) {
  content = content.replace(
    '  const regionsRef = useRef<RegionsPlugin | undefined>(undefined);',
    '  const regionsRef = useRef<RegionsPlugin | undefined>(undefined);\n  const dragSelectionCleanupRef = useRef<(() => void) | undefined>(undefined);'
  );
}

// Store dragSelectionCleanupRef in useEffect where regions are created
content = content.replace(
  'const disableDragSelection = regions.enableDragSelection({',
  'dragSelectionCleanupRef.current = regions.enableDragSelection({'
);
content = content.replace(
  'disableDragSelection();',
  'dragSelectionCleanupRef.current?.();'
);

// Add the theme change useEffect
const themeEffect = `
  useEffect(() => {
    const wavesurfer = wavesurferRef.current;
    const regions = regionsRef.current;
    if (!wavesurfer || !regions) return;
    const colors = getSemanticColors();
    wavesurfer.setOptions({ waveColor: colors.wave, progressColor: colors.progress, cursorColor: colors.cursor });
    
    // Update existing regions
    regions.getRegions().forEach(region => {
      region.setOptions({ color: colors.region });
    });
    
    // Update drag selection color
    dragSelectionCleanupRef.current?.();
    dragSelectionCleanupRef.current = regions.enableDragSelection({
      color: colors.region,
      drag: true,
      resize: true,
      minLength: MIN_SELECTION_SECONDS,
    }, 4);
  }, [theme]);
`;

if (!content.includes("wavesurfer.setOptions({ waveColor")) {
  content = content.replace(
    /  useEffect\(\(\) => \{\n    const container = waveformContainerRef\.current;/,
    themeEffect + "\n  useEffect(() => {\n    const container = waveformContainerRef.current;"
  );
}

fs.writeFileSync("src/features/audio-studio/AudioStudioPage.tsx", content);
