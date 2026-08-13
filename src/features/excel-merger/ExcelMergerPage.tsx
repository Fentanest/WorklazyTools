import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileLock2,
  FileSpreadsheet,
  Info,
  LoaderCircle,
  LockKeyhole,
  LockOpen,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { FileShareButton } from "../../components/FileShareButton";
import { OperationProgress } from "../../components/OperationProgress";
import { ToolGuide } from "../../components/ToolGuide";
import {
  FileDropZone,
  formatBytes,
  PageHeader,
  PrimaryButton,
  ResultCard,
  SectionCard,
  SegmentedControl,
  ToggleRow,
} from "../../components/ui";
import { inspectExcelFiles, mergeExcelFiles } from "./excelWorkerClient";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import type { ExcelMergeResult, MergeMode, SheetNameRule, SheetSelectionMode } from "./types";

type InspectionState = "checking" | "ready" | "error";

interface ExcelFileEntry {
  id: string;
  file: File;
  inspection: InspectionState;
  encrypted: boolean;
  password: string;
  sheetNames: string[];
  selectedSheetNames: string[];
  error?: string;
}

interface DownloadResult extends Omit<ExcelMergeResult, "buffer"> {
  url: string;
  fileName: string;
  size: number;
}

const SUPPORTED_EXTENSIONS = new Set(["xlsx", "xls", "xlsb", "xlsm", "csv"]);
let fileIdSequence = 0;

export function ExcelMergerPage() {
  const [entries, setEntries] = useState<ExcelFileEntry[]>([]);
  const [mergeMode, setMergeMode] = useState<MergeMode>("sheets");
  const [onlyValues, setOnlyValues] = useState(false);
  const [trimEmptyEdges, setTrimEmptyEdges] = useState(true);
  const [sheetTrimRows, setSheetTrimRows] = useState(false);
  const [sheetTrimColumns, setSheetTrimColumns] = useState(false);
  const [sheetTrimThreshold, setSheetTrimThreshold] = useState(3);
  const [sheetNameRule, setSheetNameRule] = useState<SheetNameRule>("file-sheet");
  const [sheetSelectionMode, setSheetSelectionMode] = useState<SheetSelectionMode>("all");
  const [sheetPositionPattern, setSheetPositionPattern] = useState("1");
  const [protectOutput, setProtectOutput] = useState(false);
  const [outputPassword, setOutputPassword] = useState("");
  const [outputPasswordConfirm, setOutputPasswordConfirm] = useState("");
  const [showOutputPassword, setShowOutputPassword] = useState(false);
  const [outputName, setOutputName] = useState("merged_result.xlsx");
  const [loading, setLoading] = useState(false);
  const operation = useOperationProgress();
  const [error, setError] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [result, setResult] = useState<DownloadResult | null>(null);

  useEffect(() => () => {
    if (result?.url) URL.revokeObjectURL(result.url);
  }, [result?.url]);

  const encryptedCount = entries.filter((entry) => entry.encrypted).length;
  const inspecting = entries.some((entry) => entry.inspection === "checking");
  const inspectionFailed = entries.some((entry) => entry.inspection === "error");
  const missingInputPassword = entries.some((entry) => entry.encrypted && !entry.password);
  const outputPasswordMismatch = protectOutput && outputPassword !== outputPasswordConfirm;
  const outputPasswordMissing = protectOutput && !outputPassword;
  const selectedSheetsByFile = useMemo(() => entries.map((entry) => ({
    id: entry.id,
    names: resolveSelectedSheetNames(entry, sheetSelectionMode, sheetPositionPattern),
  })), [entries, sheetSelectionMode, sheetPositionPattern]);
  const selectedSheetCount = selectedSheetsByFile.reduce((total, item) => total + item.names.length, 0);
  const ready = entries.length > 0
    && !inspecting
    && !inspectionFailed
    && !missingInputPassword
    && selectedSheetCount > 0
    && !outputPasswordMissing
    && !outputPasswordMismatch;

  const mergeModeLabel = mergeMode === "sheets" ? "시트별" : mergeMode === "vertical" ? "세로" : "가로";
  const formulaLabel = onlyValues ? "값만 복사" : "수식 유지";
  const visibleFiles = useMemo(() => entries.map((entry) => entry.file), [entries]);

  const handleFiles = (nextFiles: File[]) => {
    const accepted: File[] = [];
    const rejected: string[] = [];
    const existingKeys = new Set(entries.map((entry) => fileKey(entry.file)));

    nextFiles.forEach((file) => {
      if (existingKeys.has(fileKey(file))) return;
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        rejected.push(file.name);
        return;
      }
      existingKeys.add(fileKey(file));
      accepted.push(file);
    });

    if (rejected.length) setFileNotice(`지원하지 않는 파일을 제외했습니다: ${rejected.join(", ")}`);
    else setFileNotice(null);
    if (!accepted.length) return;

    const additions = accepted.map((file) => ({
      id: createFileId(),
      file,
      inspection: "checking" as const,
      encrypted: false,
      password: "",
      sheetNames: [],
      selectedSheetNames: [],
    }));
    setEntries((current) => [...current, ...additions]);
    clearResult();
    setError(null);

    void inspectExcelFiles(additions.map(({ id, file }) => ({ id, file })))
      .then((inspectionResults) => {
        const byId = new Map(inspectionResults.map((item) => [item.id, item]));
        setEntries((current) => current.map((entry) => {
          const inspectionResult = byId.get(entry.id);
          if (!inspectionResult) return entry;
          return {
            ...entry,
            inspection: inspectionResult.error ? "error" : "ready",
            encrypted: inspectionResult.encrypted,
            sheetNames: inspectionResult.sheetNames,
            selectedSheetNames: inspectionResult.sheetNames,
            error: inspectionResult.error,
          };
        }));
      })
      .catch((inspectionError: Error) => {
        setEntries((current) => current.map((entry) => additions.some((item) => item.id === entry.id)
          ? { ...entry, inspection: "error", error: inspectionError.message }
          : entry));
      });
  };

  const removeFile = (id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    clearResult();
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= entries.length) return;
    setEntries((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    clearResult();
  };

  const updateInputPassword = (id: string, password: string) => {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, password, error: undefined, inspection: "ready" } : entry));
    setError(null);
  };

  const inspectProtectedFile = (id: string, password: string) => {
    const entry = entries.find((item) => item.id === id);
    if (!entry || !password) return;
    setEntries((current) => current.map((item) => item.id === id ? { ...item, inspection: "checking", error: undefined } : item));
    void inspectExcelFiles([{ id, file: entry.file, password }]).then(([inspectionResult]) => {
      setEntries((current) => current.map((item) => item.id === id ? {
        ...item,
        inspection: inspectionResult.error ? "error" : "ready",
        encrypted: inspectionResult.encrypted,
        sheetNames: inspectionResult.sheetNames,
        selectedSheetNames: inspectionResult.sheetNames,
        error: inspectionResult.error,
      } : item));
    }).catch((inspectionError: Error) => {
      setEntries((current) => current.map((item) => item.id === id
        ? { ...item, inspection: "error", error: inspectionError.message }
        : item));
    });
  };

  const toggleSheet = (id: string, sheetName: string) => {
    setEntries((current) => current.map((entry) => {
      if (entry.id !== id) return entry;
      const selected = new Set(entry.selectedSheetNames);
      if (selected.has(sheetName)) selected.delete(sheetName);
      else selected.add(sheetName);
      return { ...entry, selectedSheetNames: entry.sheetNames.filter((name) => selected.has(name)) };
    }));
    clearResult();
  };

  const setAllSheetsForFile = (id: string, selected: boolean) => {
    setEntries((current) => current.map((entry) => entry.id === id
      ? { ...entry, selectedSheetNames: selected ? entry.sheetNames : [] }
      : entry));
    clearResult();
  };

  const runMerge = async () => {
    if (!ready) return;
    clearResult();
    setLoading(true);
    operation.start(`${entries.length}개 파일 병합을 준비하고 있습니다.`);
    setError(null);

    try {
      const mergeEntries = entries.map((entry) => ({
        entry,
        selectedSheetNames: resolveSelectedSheetNames(entry, sheetSelectionMode, sheetPositionPattern),
      })).filter((item) => item.selectedSheetNames.length > 0);
      const merged = await mergeExcelFiles(
        mergeEntries.map(({ entry, selectedSheetNames }) => ({
          id: entry.id,
          file: entry.file,
          password: entry.password || undefined,
          selectedSheetNames,
        })),
        {
          mergeMode,
          onlyValues,
          trimEmptyEdges,
          sheetTrimRows,
          sheetTrimColumns,
          sheetTrimThreshold,
          sheetNameRule,
          outputPassword: protectOutput ? outputPassword : undefined,
        },
        (nextProgress, message) => {
          operation.update(nextProgress, message);
        },
      );

      const fileName = normalizeOutputName(outputName);
      const blob = new Blob([merged.buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      setResult({
        url,
        fileName,
        size: blob.size,
        fileCount: merged.fileCount,
        sheetCount: merged.sheetCount,
        outputSheetCount: merged.outputSheetCount,
        encrypted: merged.encrypted,
        warnings: merged.warnings,
      });

      // Passwords should not remain in React state after the operation is complete.
      setEntries((current) => current.map((entry) => ({ ...entry, password: "" })));
      setOutputPassword("");
      setOutputPasswordConfirm("");
      operation.succeed("출력 XLSX 파일 생성을 완료했습니다.");
    } catch (mergeError) {
      const normalized = mergeError as Error & { code?: string; fileName?: string };
      setError(normalized.message);
      operation.fail(normalized.message);
      if (normalized.code === "PASSWORD_REQUIRED" && normalized.fileName) {
        setEntries((current) => current.map((entry) => entry.file.name === normalized.fileName
          ? { ...entry, encrypted: true, inspection: "ready" }
          : entry));
      }
    } finally {
      setLoading(false);
    }
  };

  const clearResult = () => {
    setResult((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  return (
    <div className="page tool-page page-enter accent-context-green">
      <PageHeader eyebrow="SPREADSHEET TOOL" title="Excel Merger" description="여러 Excel 파일과 CSV를 브라우저 안에서 하나의 XLSX로 안전하게 합치세요.">
        <div className="header-status ready"><span className="status-dot" /> 브라우저에서 바로 사용</div>
      </PageHeader>
      <PrivacyBanner compact />

      <div className="workflow-grid">
        <div className="workflow-main">
          <SectionCard step={1} title="파일 선택" description="XLSX, XLS, XLSB, XLSM, CSV 파일을 여러 개 선택할 수 있습니다.">
            <FileDropZone
              accept=".xlsx,.xls,.xlsb,.xlsm,.csv"
              hint="XLSX, XLS, XLSB, XLSM, CSV · 출력은 XLSX"
              multiple
              files={visibleFiles}
              onFiles={handleFiles}
              accent="green"
            />
            <div className="inline-notice"><Info size={15} /><span>출력은 XLSX로 생성됩니다. 수식과 서식 보존은 XLSX 입력만 지원하며, XLSM 매크로는 보존되지 않습니다.</span></div>
            {fileNotice && <div className="inline-notice warning"><AlertCircle size={15} /><span>{fileNotice}</span></div>}
            <ExcelFileList
              entries={entries}
              onRemove={removeFile}
              onMove={moveFile}
              onPasswordChange={updateInputPassword}
              onPasswordInspect={inspectProtectedFile}
            />
          </SectionCard>

          <SectionCard step={2} title="포함할 시트" description="파일 안의 시트명을 확인하고 병합에 포함할 시트만 고르세요.">
            <SegmentedControl
              label="시트 선택 방식"
              value={sheetSelectionMode}
              onChange={(value) => { setSheetSelectionMode(value); clearResult(); }}
              options={[
                { value: "all", label: "모든 시트" },
                { value: "positions", label: "순번 선택" },
                { value: "custom", label: "직접 선택" },
              ]}
            />
            {sheetSelectionMode === "positions" && (
              <div className="sheet-position-input">
                <label htmlFor="sheet-position-pattern">포함할 시트 순번</label>
                <input
                  id="sheet-position-pattern"
                  value={sheetPositionPattern}
                  onChange={(event) => { setSheetPositionPattern(event.target.value); clearResult(); }}
                  placeholder="예: 2 또는 1,3 또는 1-3"
                />
                <small><b>2</b>는 2번째만 · <b>-3</b>은 3번까지 · <b>3-</b>은 3번부터 · <b>1,3,5</b>와 <b>2-4</b>도 사용할 수 있습니다.</small>
              </div>
            )}
            <ExcelSheetSelector
              entries={entries}
              mode={sheetSelectionMode}
              pattern={sheetPositionPattern}
              onToggle={toggleSheet}
              onSetAll={setAllSheetsForFile}
            />
            {entries.length > 0 && !inspecting && selectedSheetCount === 0 && <div className="inline-notice warning"><AlertCircle size={15} /><span>병합에 포함할 시트를 하나 이상 선택해 주세요.</span></div>}
          </SectionCard>

          <SectionCard step={3} title="병합 방식" description="선택한 시트를 파일 순서대로 처리합니다.">
            <SegmentedControl
              label="병합 방식"
              value={mergeMode}
              onChange={(value) => { setMergeMode(value); clearResult(); }}
              options={[
                { value: "sheets", label: "시트별" },
                { value: "vertical", label: "세로" },
                { value: "horizontal", label: "가로" },
              ]}
            />
            <div className="mode-explainer">
              <Info size={17} />
              <span>{mergeMode === "sheets" ? "각 시트를 결과 파일의 개별 시트로 모읍니다." : mergeMode === "vertical" ? "모든 시트의 데이터를 위아래로 이어 붙이고 수식 참조 행을 보정합니다." : "모든 시트의 데이터를 좌우로 이어 붙이고 수식 참조 열을 보정합니다."}</span>
            </div>
          </SectionCard>

          <SectionCard step={4} title="출력 설정" description="결과는 호환성이 높은 XLSX 형식으로 생성됩니다.">
            <div className="settings-list">
              <ToggleRow
                label="값만 복사"
                description={onlyValues ? "수식의 현재 계산 결과만 저장합니다." : "꺼짐: 수식과 저장된 계산 결과를 함께 유지합니다."}
                checked={onlyValues}
                onChange={(checked) => { setOnlyValues(checked); clearResult(); }}
              />
              <ToggleRow
                label="끝의 빈 행·열 정리"
                description="내용 뒤에 남은 불필요한 빈 영역을 제외합니다."
                checked={trimEmptyEdges}
                onChange={(checked) => { setTrimEmptyEdges(checked); clearResult(); }}
              />
              <ToggleRow
                label="연속 빈 행 정리 (SheetTrim)"
                description="시트 중간을 포함해 기준 개수 이상 연속된 빈 행을 삭제합니다."
                checked={sheetTrimRows}
                onChange={(checked) => { setSheetTrimRows(checked); clearResult(); }}
              />
              <ToggleRow
                label="연속 빈 열 정리 (SheetTrim)"
                description="시트 중간을 포함해 기준 개수 이상 연속된 빈 열을 삭제합니다."
                checked={sheetTrimColumns}
                onChange={(checked) => { setSheetTrimColumns(checked); clearResult(); }}
              />
              <label className="settings-row select-row sheet-trim-threshold">
                <span><strong>SheetTrim 삭제 기준</strong><small>연속된 빈 행·열이 이 개수 이상일 때 해당 묶음 전체를 삭제합니다.</small></span>
                <span className="number-input-with-unit">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={sheetTrimThreshold}
                    disabled={!sheetTrimRows && !sheetTrimColumns}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isFinite(next)) setSheetTrimThreshold(Math.max(1, Math.floor(next)));
                      clearResult();
                    }}
                    aria-label="SheetTrim 최소 연속 빈 행 또는 열 개수"
                  />
                  <small>개 이상</small>
                </span>
              </label>
              <label className="settings-row select-row">
                <span><strong>시트 이름 규칙</strong><small>시트별 병합에 적용됩니다.</small></span>
                <select value={sheetNameRule} disabled={mergeMode !== "sheets"} onChange={(event) => setSheetNameRule(event.target.value as SheetNameRule)}>
                  <option value="file-sheet">파일명 + 시트명</option>
                  <option value="sheet-file">시트명 + 파일명</option>
                  <option value="sheet">원본 시트명</option>
                </select>
              </label>
            </div>

            <div className="output-name-field">
              <label htmlFor="output-file-name">출력 파일명</label>
              <div><FileSpreadsheet size={17} /><input id="output-file-name" value={outputName} onChange={(event) => setOutputName(event.target.value)} /></div>
            </div>
          </SectionCard>

          <SectionCard step={5} title="출력 파일 보호" description="선택 사항 · 파일을 열 때 필요한 암호를 설정합니다.">
            <div className="settings-list">
              <ToggleRow
                label="출력 파일에 암호 설정"
                description="수식과 서식을 포함한 XLSX 전체를 암호화합니다."
                checked={protectOutput}
                onChange={(checked) => {
                  setProtectOutput(checked);
                  if (!checked) {
                    setOutputPassword("");
                    setOutputPasswordConfirm("");
                  }
                  clearResult();
                }}
              />
            </div>
            {protectOutput && (
              <div className="password-form output-password-form">
                <PasswordField label="파일 암호" value={outputPassword} onChange={setOutputPassword} visible={showOutputPassword} onVisibilityChange={setShowOutputPassword} />
                <PasswordField label="암호 확인" value={outputPasswordConfirm} onChange={setOutputPasswordConfirm} visible={showOutputPassword} />
                {outputPasswordConfirm && outputPasswordMismatch && <p className="field-error">두 암호가 일치하지 않습니다.</p>}
                <p className="field-help"><LockKeyhole size={13} /> 암호를 잊으면 복구할 수 없습니다. 암호는 작업 직후 메모리에서 지워집니다.</p>
              </div>
            )}
          </SectionCard>
        </div>

        <aside className="workflow-summary">
          <div className="summary-card">
            <div className="summary-title"><SlidersHorizontal size={19} /><h2>병합 요약</h2></div>
            <dl>
              <div><dt>선택한 파일</dt><dd>{entries.length}개</dd></div>
              <div><dt>포함할 시트</dt><dd>{selectedSheetCount}개</dd></div>
              <div><dt>암호화 입력</dt><dd>{encryptedCount}개</dd></div>
              <div><dt>병합 방식</dt><dd>{mergeModeLabel}</dd></div>
              <div><dt>셀 출력</dt><dd>{formulaLabel}</dd></div>
              <div><dt>SheetTrim</dt><dd>{sheetTrimRows || sheetTrimColumns ? `${sheetTrimRows ? "행" : ""}${sheetTrimRows && sheetTrimColumns ? "·" : ""}${sheetTrimColumns ? "열" : ""} ${sheetTrimThreshold}개 이상` : "사용 안 함"}</dd></div>
              <div><dt>결과 형식</dt><dd>암호{protectOutput ? " 적용" : " 없음"} XLSX</dd></div>
            </dl>
            <PrimaryButton accent="green" disabled={!ready} loading={loading} onClick={() => void runMerge()}>
              {loading ? `${operation.progress}% 처리 중` : "Excel 파일 병합"}
            </PrimaryButton>
            {!loading && inspecting && <p className="prototype-note">파일 보호 여부와 시트 목록을 확인하고 있습니다.</p>}
            {!loading && inspectionFailed && <p className="prototype-note error-text">읽지 못한 파일의 암호 또는 형식을 확인해 주세요.</p>}
            {!loading && missingInputPassword && <p className="prototype-note error-text">암호화된 입력 파일의 비밀번호가 필요합니다.</p>}
            {!loading && entries.length > 0 && selectedSheetCount === 0 && <p className="prototype-note error-text">포함할 시트를 선택해 주세요.</p>}
            {!loading && outputPasswordMissing && <p className="prototype-note error-text">출력 파일 암호를 입력해 주세요.</p>}
          </div>
          <OperationProgress
            status={operation.status}
            progress={operation.progress}
            message={operation.message}
            logs={operation.logs}
            accent="green"
            title="Excel 병합 진행 상황"
          />
        </aside>
      </div>

      {error && <div className="error-banner" role="alert"><AlertCircle size={19} /><div><strong>병합하지 못했습니다.</strong><span>{error}</span></div></div>}

      {result && (
        <ResultCard
          accent="green"
          title="Excel 파일을 만들었습니다."
          message={`${result.fileCount}개 파일의 ${result.sheetCount}개 시트를 ${result.outputSheetCount}개 시트로 정리했습니다.${result.encrypted ? " 출력 파일 암호도 적용했습니다." : ""}`}
        >
          <div className="result-file-actions"><a className="result-download" href={result.url} download={result.fileName}><Download size={17} /> {result.fileName}<small>{formatBytes(result.size)}</small></a><FileShareButton url={result.url} fileName={result.fileName} mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /></div>
          {result.warnings.length > 0 && (
            <div className="result-warnings">{result.warnings.map((warning) => <p key={warning}><Info size={13} /> {warning}</p>)}</div>
          )}
        </ResultCard>
      )}

      <ToolGuide
        title="Excel 병합 사용 안내"
        description="파일 형식과 병합 방식의 차이를 확인하면 원하는 결과를 더 정확하게 만들 수 있습니다."
        blocks={[
          {
            title: "지원하는 파일 형식",
            paragraphs: ["XLSX, XLS, XLSB, XLSM, CSV 파일을 함께 선택할 수 있으며, 병합 결과는 항상 XLSX 파일로 만들어집니다."],
            items: ["XLSX: 수식·일반 셀 서식 보존 지원", "XLS·XLSB·XLSM: 값과 기본 시트 구조를 XLSX로 변환", "CSV: 한 개의 표 형태 데이터로 처리", "XLSM 매크로는 출력 파일에 보존되지 않음"],
          },
          {
            title: "포함할 시트 고르기",
            paragraphs: ["파일을 추가하면 내부 시트명을 순서대로 읽습니다. 모든 시트, 공통 순번 규칙, 파일별 직접 선택 중 원하는 방식을 사용할 수 있습니다."],
            items: ["2: 각 파일의 2번째 시트만", "-3: 각 파일의 1~3번째 시트", "3-: 각 파일의 3번째부터 마지막 시트", "1,3,5 또는 2-4: 여러 순번과 범위"],
          },
          {
            title: "병합 방식 고르기",
            paragraphs: ["시트별은 원본 시트를 각각 보관합니다. 세로는 행을 아래로 이어 붙이고, 가로는 열을 오른쪽으로 이어 붙입니다."],
            items: ["구조가 다른 파일: 시트별 병합", "열 구성이 같은 월별 자료: 세로 병합", "행 구성이 같은 항목별 자료: 가로 병합"],
          },
          {
            title: "수식·서식과 암호",
            paragraphs: ["수식과 서식 보존은 XLSX 입력 파일에서만 지원합니다. 값만 복사를 끄면 XLSX의 수식과 저장된 계산 결과를 유지하고, 위치가 바뀌는 세로·가로 병합에서는 상대 참조를 보정합니다. 입력 암호와 출력 암호는 작업 중 브라우저 메모리에서만 사용합니다."],
          },
          {
            title: "빈 영역 정리 방식",
            paragraphs: ["끝의 빈 행·열 정리는 각 입력 시트의 마지막 내용 뒤쪽 여백만 복사에서 제외합니다. SheetTrim은 병합이 끝난 결과 시트에서 중간을 포함해 지정한 개수 이상 연속된 빈 행 또는 빈 열 묶음을 삭제합니다."],
            items: ["행과 열을 서로 독립적으로 선택", "공백 문자만 들어 있는 셀도 빈 셀로 판단", "기준보다 짧은 빈 행·열 묶음은 그대로 유지"],
          },
          {
            title: "결과 확인이 필요한 항목",
            paragraphs: ["출력은 XLSX만 지원하며 XLSM의 매크로는 보존되지 않습니다. 이미지, 외부 데이터 연결, 피벗과 일부 고급 표 개체도 제외되거나 단순화될 수 있으므로 중요한 결과는 Excel에서 직접 확인하세요."],
          },
        ]}
        faq={[
          { question: "CSV 파일의 수식과 서식도 유지되나요?", answer: "CSV는 셀 값만 담는 텍스트 형식이므로 수식, 서식, 여러 시트를 저장하지 않습니다. 병합 결과는 이런 기능을 담을 수 있는 XLSX로 생성합니다." },
          { question: "XLSB와 XLSM도 병합할 수 있나요?", answer: "입력할 수 있지만 값과 기본 시트 구조를 읽어 XLSX로 변환합니다. 수식과 서식 보존은 XLSX 입력에서만 지원하며 XLSM의 매크로는 결과에 포함되지 않습니다." },
          { question: "여러 파일에서 같은 순번의 시트만 고를 수 있나요?", answer: "순번 선택에서 2처럼 입력하면 각 파일의 2번째 시트만 포함합니다. -3, 3-, 1,3,5, 2-4 같은 범위도 사용할 수 있습니다." },
          { question: "끝 여백 정리와 SheetTrim은 무엇이 다른가요?", answer: "끝 여백 정리는 데이터 뒤쪽의 빈 범위를 복사하지 않습니다. SheetTrim은 결과 시트 전체를 검사해 중간에 있는 빈 행·열도 지정한 연속 개수 이상이면 묶음 전체를 삭제합니다." },
          { question: "암호가 걸린 Excel 파일도 합칠 수 있나요?", answer: "지원되는 Office 암호화 방식이면 파일별 암호를 입력해 브라우저에서 해제할 수 있습니다. 손상된 파일이나 일부 오래된 암호화 방식은 열지 못할 수 있습니다." },
          { question: "출력 파일 암호를 잊으면 복구할 수 있나요?", answer: "복구할 수 없습니다. 암호는 서버에 저장하지 않고 작업 후 메모리에서도 제거하므로 안전한 곳에 따로 기록해 주세요." },
        ]}
      />
    </div>
  );
}

function ExcelSheetSelector({ entries, mode, pattern, onToggle, onSetAll }: {
  entries: ExcelFileEntry[];
  mode: SheetSelectionMode;
  pattern: string;
  onToggle: (id: string, sheetName: string) => void;
  onSetAll: (id: string, selected: boolean) => void;
}) {
  if (!entries.length) return <div className="sheet-selector-empty">파일을 추가하면 내부 시트명이 여기에 표시됩니다.</div>;

  return (
    <div className="excel-sheet-selector">
      {entries.map((entry) => {
        const selectedNames = new Set(resolveSelectedSheetNames(entry, mode, pattern));
        return (
          <section className="sheet-file-group" key={entry.id}>
            <div className="sheet-file-heading">
              <span><strong>{entry.file.name}</strong><small>{entry.sheetNames.length ? `${selectedNames.size}/${entry.sheetNames.length}개 시트 포함` : "시트 확인 필요"}</small></span>
              {mode === "custom" && entry.sheetNames.length > 0 && (
                <span className="sheet-select-actions">
                  <button type="button" onClick={() => onSetAll(entry.id, true)}>모두</button>
                  <button type="button" onClick={() => onSetAll(entry.id, false)}>해제</button>
                </span>
              )}
            </div>
            {entry.inspection === "checking" ? (
              <div className="sheet-loading"><LoaderCircle className="spin" size={14} /> 시트명 읽는 중…</div>
            ) : entry.encrypted && !entry.sheetNames.length && !entry.error ? (
              <div className="sheet-loading"><FileLock2 size={14} /> 파일 암호를 입력하면 시트명을 확인합니다.</div>
            ) : entry.error ? (
              <div className="sheet-loading error-text"><AlertCircle size={14} /> {entry.error}</div>
            ) : (
              <ol className={`sheet-name-list mode-${mode}`}>
                {entry.sheetNames.map((sheetName, index) => {
                  const selected = selectedNames.has(sheetName);
                  return (
                    <li className={selected ? "selected" : ""} key={sheetName}>
                      {mode === "custom" ? (
                        <label>
                          <input type="checkbox" checked={selected} onChange={() => onToggle(entry.id, sheetName)} />
                          <b>{index + 1}</b><span>{sheetName}</span>
                        </label>
                      ) : <><b>{index + 1}</b><span>{sheetName}</span>{selected && <small>포함</small>}</>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ExcelFileList({ entries, onRemove, onMove, onPasswordChange, onPasswordInspect }: {
  entries: ExcelFileEntry[];
  onRemove: (id: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onPasswordChange: (id: string, password: string) => void;
  onPasswordInspect: (id: string, password: string) => void;
}) {
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  if (!entries.length) return null;

  const togglePassword = (id: string) => setVisiblePasswords((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <div className="excel-file-list">
      {entries.map((entry, index) => (
        <div className={`excel-file-item${entry.encrypted ? " encrypted" : ""}`} key={entry.id}>
          <div className="file-row">
            <span className="file-type accent-green">{entry.file.name.split(".").pop()?.slice(0, 4).toUpperCase()}</span>
            <span className="file-meta"><strong>{entry.file.name}</strong><small>{formatBytes(entry.file.size)}</small></span>
            <span className={`file-security-status ${entry.inspection}`}>
              {entry.inspection === "checking"
                ? <><LoaderCircle className="spin" size={14} /> 확인 중</>
                : entry.encrypted
                  ? <><FileLock2 size={14} /> 암호화됨</>
                  : entry.inspection === "error"
                    ? <><AlertCircle size={14} /> 확인 필요</>
                    : <><CheckCircle2 size={14} /> 사용 가능</>}
            </span>
            <span className="file-order-actions">
              <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={`${entry.file.name} 위로 이동`}><ArrowUp size={15} /></button>
              <button type="button" onClick={() => onMove(index, 1)} disabled={index === entries.length - 1} aria-label={`${entry.file.name} 아래로 이동`}><ArrowDown size={15} /></button>
            </span>
            <button className="remove-button" type="button" onClick={() => onRemove(entry.id)} aria-label={`${entry.file.name} 제거`}><X size={17} /></button>
          </div>
          {entry.encrypted && (
            <div className="input-password-row">
              <LockKeyhole size={16} />
              <label htmlFor={`password-${entry.id}`}>파일 암호</label>
              <div className="password-input compact">
                <input
                  id={`password-${entry.id}`}
                  type={visiblePasswords.has(entry.id) ? "text" : "password"}
                  value={entry.password}
                  onChange={(event) => onPasswordChange(entry.id, event.target.value)}
                  onBlur={(event) => onPasswordInspect(entry.id, event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                  placeholder="암호 입력"
                  autoComplete="off"
                />
                <button type="button" onClick={() => togglePassword(entry.id)} aria-label="암호 표시 전환">
                  {visiblePasswords.has(entry.id) ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <small>입력 후 시트 목록 자동 확인</small>
            </div>
          )}
          {entry.error && <p className="file-item-error"><AlertCircle size={13} /> {entry.error}</p>}
        </div>
      ))}
    </div>
  );
}

function PasswordField({ label, value, onChange, visible, onVisibilityChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}) {
  return (
    <label className="password-field">
      <span>{label}</span>
      <div className="password-input">
        {value ? <ShieldCheck size={17} /> : <LockOpen size={17} />}
        <input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" />
        {onVisibilityChange && <button type="button" onClick={() => onVisibilityChange(!visible)} aria-label="암호 표시 전환">{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>}
      </div>
    </label>
  );
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function resolveSelectedSheetNames(entry: ExcelFileEntry, mode: SheetSelectionMode, pattern: string) {
  if (mode === "all") return entry.sheetNames;
  if (mode === "custom") return entry.sheetNames.filter((name) => entry.selectedSheetNames.includes(name));
  return parseSheetPositions(pattern, entry.sheetNames.length).map((index) => entry.sheetNames[index]);
}

function parseSheetPositions(value: string, sheetCount: number) {
  const positions: number[] = [];
  const add = (oneBasedIndex: number) => {
    const index = oneBasedIndex - 1;
    if (index >= 0 && index < sheetCount && !positions.includes(index)) positions.push(index);
  };

  value.split(",").map((token) => token.trim()).filter(Boolean).forEach((token) => {
    if (/^\d+$/.test(token)) {
      add(Number(token));
      return;
    }
    const until = token.match(/^-(\d+)$/);
    if (until) {
      for (let index = 1; index <= Number(until[1]); index += 1) add(index);
      return;
    }
    const from = token.match(/^(\d+)-$/);
    if (from) {
      for (let index = Number(from[1]); index <= sheetCount; index += 1) add(index);
      return;
    }
    const range = token.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      const direction = start <= end ? 1 : -1;
      for (let index = start; direction > 0 ? index <= end : index >= end; index += direction) add(index);
    }
  });
  return positions;
}

function createFileId() {
  fileIdSequence += 1;
  return `excel-file-${Date.now().toString(36)}-${fileIdSequence.toString(36)}`;
}

function normalizeOutputName(name: string) {
  const sanitized = name.trim().replace(/[\\/:*?"<>|]/g, "_") || "merged_result.xlsx";
  return sanitized.toLowerCase().endsWith(".xlsx") ? sanitized : `${sanitized}.xlsx`;
}
