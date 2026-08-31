import {
  Check,
  ChevronDown,
  ChevronUp,
  Combine,
  Copy,
  Download,
  Eraser,
  FileText,
  GripVertical,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { type ChangeEvent, type DragEvent, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { PageHeader, PrimaryButton, SectionCard, ToggleRow } from "../../components/ui";
import { mergeTextItems, moveTextItem, type TextMergeItem } from "./textMerger";

type SeparatorPreset = "newline" | "blank-line" | "space" | "comma" | "custom";

const SEPARATORS: Record<Exclude<SeparatorPreset, "custom">, string> = {
  newline: "\n",
  "blank-line": "\n\n",
  space: " ",
  comma: ", ",
};

export function TextMergerPage() {
  const { t, i18n } = useTranslation(["features", "common"]);
  const directSequence = useRef(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<TextMergeItem[]>(() => [createDirectItem(1, t("features:textMerger.directName", { count: 1 }))]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(items.map((item) => item.id)));
  const [separatorPreset, setSeparatorPreset] = useState<SeparatorPreset>("newline");
  const [customSeparator, setCustomSeparator] = useState("");
  const [trimItems, setTrimItems] = useState(false);
  const [excludeEmpty, setExcludeEmpty] = useState(true);
  const [output, setOutput] = useState("");
  const [readingFiles, setReadingFiles] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const separator = separatorPreset === "custom" ? customSeparator : SEPARATORS[separatorPreset];
  const canMerge = items.some((item) => item.content.trim().length > 0);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const formatNumber = (value: number) => numberFormatter.format(value);

  const addDirect = () => {
    const count = ++directSequence.current;
    const item = createDirectItem(count, t("features:textMerger.directName", { count }));
    setItems((current) => [...current, item]);
    setExpandedIds((current) => new Set(current).add(item.id));
    setOutput("");
    setMessage("");
  };

  const loadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (!files.length) return;
    setReadingFiles(true);
    setMessage("");
    const results = await Promise.all(files.map(async (file): Promise<TextMergeItem | null> => {
      if (!file.name.toLowerCase().endsWith(".txt")) return null;
      try {
        const content = (await file.text()).replace(/^\uFEFF/, "");
        return {
          id: createId(),
          source: "file" as const,
          name: file.name,
          content,
          originalContent: content,
        };
      } catch {
        return null;
      }
    }));
    const added = results.filter((item): item is TextMergeItem => item !== null);
    if (added.length) {
      setItems((current) => [...current, ...added]);
      setOutput("");
    }
    setMessage(added.length === files.length
      ? t("features:textMerger.filesAdded", { count: added.length })
      : t("features:textMerger.filesSkipped", { added: added.length, skipped: files.length - added.length }));
    setReadingFiles(false);
  };

  const updateItem = (id: string, patch: Partial<Pick<TextMergeItem, "name" | "content">>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    if (patch.content !== undefined) setOutput("");
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setOutput("");
    setExpandedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const moveItem = (index: number, target: number) => {
    setItems((current) => moveTextItem(current, index, target));
    setOutput("");
  };

  const toggleExpanded = (id: string) => setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const dropOnItem = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    const sourceId = draggedId || event.dataTransfer.getData("text/plain");
    setDraggedId(null);
    if (!sourceId || sourceId === targetId) return;
    setItems((current) => moveTextItem(current, current.findIndex((item) => item.id === sourceId), current.findIndex((item) => item.id === targetId)));
    setOutput("");
  };

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setMessage(t("features:textMerger.copied"));
    } catch {
      setMessage(t("features:textMerger.copyFailed"));
    }
  };

  const downloadOutput = () => {
    const url = URL.createObjectURL(new Blob([output], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = t("features:textMerger.downloadName");
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const clearAll = () => {
    directSequence.current = 1;
    const item = createDirectItem(1, t("features:textMerger.directName", { count: 1 }));
    setItems([item]);
    setExpandedIds(new Set([item.id]));
    setSeparatorPreset("newline");
    setCustomSeparator("");
    setTrimItems(false);
    setExcludeEmpty(true);
    setOutput("");
    setMessage("");
  };

  return (
    <div className="page tool-page page-enter utility-page text-merger-page">
      <PageHeader eyebrow="TEXT MERGER" title={t("features:textMerger.title")} description={t("features:textMerger.description")}><PrivacyBanner compact /></PageHeader>

      <SectionCard title={t("features:textMerger.sourcesTitle")} description={t("features:textMerger.sourcesDescription")}>
        <input ref={fileInputRef} className="visually-hidden" type="file" accept=".txt,text/plain" multiple onChange={(event) => void loadFiles(event)} />
        <div className="text-merger-add-actions">
          <button className="secondary-button" type="button" onClick={addDirect}><Plus size={17} /> {t("features:textMerger.addDirect")}</button>
          <button className="secondary-button" type="button" disabled={readingFiles} onClick={() => fileInputRef.current?.click()}><Upload size={17} /> {readingFiles ? t("features:textMerger.readingFiles") : t("features:textMerger.loadTxt")}</button>
          <span>{t("features:textMerger.sourceCount", { count: items.length })}</span>
        </div>

        {items.length ? (
          <div className="text-merge-list" aria-label={t("features:textMerger.orderLabel")}>
            {items.map((item, index) => {
              const expanded = expandedIds.has(item.id);
              const edited = item.source === "file" && item.content !== item.originalContent;
              return (
                <article
                  className={`text-merge-item${draggedId === item.id ? " dragging" : ""}`}
                  key={item.id}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                  onDrop={(event) => dropOnItem(event, item.id)}
                >
                  <header>
                    <span className="text-merge-order">{index + 1}</span>
                    <button
                      className="text-merge-drag"
                      type="button"
                      draggable
                      aria-label={t("features:textMerger.drag", { name: item.name })}
                      onDragStart={(event) => { setDraggedId(item.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); }}
                      onDragEnd={() => setDraggedId(null)}
                    ><GripVertical size={18} /></button>
                    <span className={`text-merge-source ${item.source}`}><FileText size={15} /> {t(`features:textMerger.${item.source === "direct" ? "directBadge" : "fileBadge"}`)}</span>
                    <label className="text-merge-name">
                      <span className="visually-hidden">{t("features:textMerger.nameLabel")}</span>
                      <input value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} />
                    </label>
                    <span className="text-merge-meta">{edited && <b>{t("features:textMerger.edited")}</b>}{t("features:textMerger.characters", { count: formatNumber(item.content.length) })}</span>
                    <div className="text-merge-order-actions">
                      <button type="button" disabled={index === 0} onClick={() => moveItem(index, index - 1)} aria-label={t("features:textMerger.moveUp", { name: item.name })}><ChevronUp size={17} /></button>
                      <button type="button" disabled={index === items.length - 1} onClick={() => moveItem(index, index + 1)} aria-label={t("features:textMerger.moveDown", { name: item.name })}><ChevronDown size={17} /></button>
                      <button type="button" className="danger" onClick={() => removeItem(item.id)} aria-label={t("features:textMerger.remove", { name: item.name })}><Trash2 size={16} /></button>
                    </div>
                  </header>
                  {expanded ? (
                    <div className="text-merge-editor">
                      <textarea value={item.content} onChange={(event) => updateItem(item.id, { content: event.target.value })} placeholder={t("features:textMerger.inputPlaceholder")} aria-label={t("features:textMerger.contentLabel", { name: item.name })} />
                      <button type="button" onClick={() => toggleExpanded(item.id)}>{t("features:textMerger.collapse")}</button>
                    </div>
                  ) : (
                    <button className="text-merge-preview" type="button" onClick={() => toggleExpanded(item.id)}>
                      <span>{preview(item.content) || t("features:textMerger.emptyPreview")}</span><b>{t("features:textMerger.editContent")}</b>
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        ) : <div className="text-merge-empty"><FileText size={24} /><strong>{t("features:textMerger.emptyTitle")}</strong><span>{t("features:textMerger.emptyDescription")}</span></div>}
        {message && <p className="text-merge-message" role="status"><Check size={16} /> {message}</p>}
      </SectionCard>

      <SectionCard title={t("features:textMerger.settingsTitle")} description={t("features:textMerger.settingsDescription")}>
        <div className="text-merge-settings-grid">
          <label><span>{t("features:textMerger.separatorLabel")}</span><select value={separatorPreset} onChange={(event) => { setSeparatorPreset(event.target.value as SeparatorPreset); setOutput(""); }}>{(["newline", "blank-line", "space", "comma", "custom"] as SeparatorPreset[]).map((value) => <option key={value} value={value}>{t(`features:textMerger.separators.${value}` as never)}</option>)}</select></label>
          {separatorPreset === "custom" && <label><span>{t("features:textMerger.customSeparatorLabel")}</span><input value={customSeparator} onChange={(event) => { setCustomSeparator(event.target.value); setOutput(""); }} placeholder={t("features:textMerger.customSeparatorPlaceholder")} /></label>}
          <div className="text-merge-toggles">
            <ToggleRow label={t("features:textMerger.trimItems")} description={t("features:textMerger.trimItemsDescription")} checked={trimItems} onChange={(checked) => { setTrimItems(checked); setOutput(""); }} />
            <ToggleRow label={t("features:textMerger.excludeEmpty")} description={t("features:textMerger.excludeEmptyDescription")} checked={excludeEmpty} onChange={(checked) => { setExcludeEmpty(checked); setOutput(""); }} />
          </div>
        </div>
        <PrimaryButton accent="blue" disabled={!canMerge} onClick={() => setOutput(mergeTextItems(items, { separator, trimItems, excludeEmpty }))}><Combine size={18} /> {t("features:textMerger.merge")}</PrimaryButton>
      </SectionCard>

      <SectionCard title={t("features:textMerger.resultTitle")} description={t("features:textMerger.resultDescription", { count: formatNumber(output.length) })}>
        <textarea className="utility-textarea text-merge-result" value={output} readOnly placeholder={t("features:textMerger.resultPlaceholder")} />
        <div className="utility-inline-actions">
          <button className="secondary-button" type="button" disabled={!output} onClick={() => void copyOutput()}><Copy size={16} /> {t("features:textMerger.copy")}</button>
          <button className="secondary-button" type="button" disabled={!output} onClick={downloadOutput}><Download size={16} /> {t("features:textMerger.download")}</button>
          <button className="secondary-button" type="button" onClick={clearAll}><Eraser size={16} /> {t("features:textMerger.clear")}</button>
        </div>
      </SectionCard>

      <ToolGuide
        title={t("features:textMerger.guide.title")}
        description={t("features:textMerger.guide.description")}
        blocks={(t("features:textMerger.guide.blocks", { returnObjects: true }) as Array<{ title: string; text: string }>).map((item) => ({ title: item.title, paragraphs: [item.text] }))}
        faq={(t("features:textMerger.guide.faq", { returnObjects: true }) as Array<{ q: string; a: string }>).map((item) => ({ question: item.q, answer: item.a }))}
      />
    </div>
  );
}

function createDirectItem(sequence: number, name: string): TextMergeItem {
  return { id: createId(), source: "direct", name: name || `Text ${sequence}`, content: "" };
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `text-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function preview(content: string) {
  return content.trim().replace(/\s+/g, " ").slice(0, 180);
}
