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
import { PageHeader, PrimaryButton, ToggleRow } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  UtilityField,
  UtilityInput,
  UtilityPage,
  UtilitySectionCard,
  UtilitySelect,
  UtilityTextarea,
} from "../../components/UtilitySurface";
import { cn } from "../../lib/utils";
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
    <UtilityPage toolId="text-merger">
      <PageHeader eyebrow="TEXT MERGER" title={t("features:textMerger.title")} description={t("features:textMerger.description")}><PrivacyBanner compact /></PageHeader>

      <UtilitySectionCard title={t("features:textMerger.sourcesTitle")} description={t("features:textMerger.sourcesDescription")}>
        <input ref={fileInputRef} className="sr-only" type="file" accept=".txt,text/plain" multiple onChange={(event) => void loadFiles(event)} />
        <div className="flex flex-wrap items-center gap-2" data-testid="text-merger-add-actions">
          <Button variant="secondary" size="lg" className="rounded-xl font-bold" type="button" onClick={addDirect}><Plus size={17} /> {t("features:textMerger.addDirect")}</Button>
          <Button variant="secondary" size="lg" className="rounded-xl font-bold" type="button" disabled={readingFiles} onClick={() => fileInputRef.current?.click()}><Upload size={17} /> {readingFiles ? t("features:textMerger.readingFiles") : t("features:textMerger.loadTxt")}</Button>
          <span className="ml-auto text-[13px] font-bold text-muted-foreground max-[620px]:ml-0 max-[620px]:w-full">{t("features:textMerger.sourceCount", { count: items.length })}</span>
        </div>

        {items.length ? (
          <div className="mt-[15px] grid gap-[9px]" data-testid="text-merger-list" aria-label={t("features:textMerger.orderLabel")}>
            {items.map((item, index) => {
              const expanded = expandedIds.has(item.id);
              const edited = item.source === "file" && item.content !== item.originalContent;
              return (
                <Card
                  as="article"
                  className={cn("gap-0 rounded-2xl border border-border bg-card/60 py-0 transition-[opacity,border-color,transform] dark:bg-card", draggedId === item.id && "scale-[.995] border-blue-500/40 opacity-50")}
                  data-testid="text-merger-item"
                  key={item.id}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                  onDrop={(event) => dropOnItem(event, item.id)}
                >
                  <header className="grid min-h-[58px] grid-cols-[auto_auto_auto_minmax(120px,1fr)_auto_auto] items-center gap-2 px-2.5 py-2 max-[620px]:grid-cols-[auto_auto_minmax(0,1fr)_auto] max-[620px]:gap-[7px]">
                    <span className="grid size-7 place-items-center rounded-lg bg-blue-500/10 text-[13px] font-extrabold text-blue-700 dark:text-blue-300">{index + 1}</span>
                    <Button
                      className="h-8 w-7 cursor-grab rounded-lg p-0 text-muted-foreground active:cursor-grabbing"
                      variant="ghost"
                      size="icon-xs"
                      type="button"
                      draggable
                      aria-label={t("features:textMerger.drag", { name: item.name })}
                      onDragStart={(event) => { setDraggedId(item.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); }}
                      onDragEnd={() => setDraggedId(null)}
                    ><GripVertical size={18} /></Button>
                    <span className={cn("inline-flex min-h-7 items-center gap-1 rounded-full px-2 text-xs font-extrabold whitespace-nowrap max-[620px]:col-start-3 max-[620px]:row-start-1 max-[620px]:justify-self-start", item.source === "direct" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "bg-violet-500/10 text-violet-700 dark:text-violet-300")} data-testid="text-merger-source"><FileText size={15} /> {t(`features:textMerger.${item.source === "direct" ? "directBadge" : "fileBadge"}`)}</span>
                    <label className="min-w-0 max-[620px]:col-span-full max-[620px]:row-start-2">
                      <span className="sr-only">{t("features:textMerger.nameLabel")}</span>
                      <UtilityInput className="h-[34px] border-transparent bg-transparent px-2 font-bold hover:border-border hover:bg-background focus-visible:bg-background" value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} />
                    </label>
                    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground max-[620px]:col-span-3 max-[620px]:row-start-3" data-testid="text-merger-meta">{edited && <b className="rounded-full bg-amber-500/10 px-1.5 py-[3px] text-[11px] text-amber-700 dark:text-amber-300">{t("features:textMerger.edited")}</b>}{t("features:textMerger.characters", { count: formatNumber(item.content.length) })}</span>
                    <div className="flex overflow-hidden rounded-lg border border-border max-[620px]:col-start-4 max-[620px]:row-span-3 max-[620px]:row-start-1 max-[620px]:flex-col max-[620px]:self-stretch" data-testid="text-merger-order-actions">
                      <Button className="size-[31px] rounded-none border-0 text-muted-foreground max-[620px]:h-9 max-[620px]:w-11" size="icon-xs" variant="ghost" type="button" disabled={index === 0} onClick={() => moveItem(index, index - 1)} aria-label={t("features:textMerger.moveUp", { name: item.name })}><ChevronUp size={17} /></Button>
                      <Button className="size-[31px] rounded-none border-l border-border text-muted-foreground max-[620px]:h-9 max-[620px]:w-11 max-[620px]:border-t max-[620px]:border-l-0" size="icon-xs" variant="ghost" type="button" disabled={index === items.length - 1} onClick={() => moveItem(index, index + 1)} aria-label={t("features:textMerger.moveDown", { name: item.name })}><ChevronDown size={17} /></Button>
                      <Button className="size-[31px] rounded-none border-l border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive max-[620px]:h-9 max-[620px]:w-11 max-[620px]:border-t max-[620px]:border-l-0" size="icon-xs" variant="ghost" type="button" onClick={() => removeItem(item.id)} aria-label={t("features:textMerger.remove", { name: item.name })}><Trash2 size={16} /></Button>
                    </div>
                  </header>
                  {expanded ? (
                    <div className="pr-2.5 pb-2.5 pl-[76px] max-[620px]:pr-[62px] max-[620px]:pl-2.5" data-testid="text-merger-editor">
                      <UtilityTextarea className="min-h-[135px] rounded-xl p-3 text-sm leading-relaxed" value={item.content} onChange={(event) => updateItem(item.id, { content: event.target.value })} placeholder={t("features:textMerger.inputPlaceholder")} aria-label={t("features:textMerger.contentLabel", { name: item.name })} />
                      <Button className="ml-auto mt-[7px] h-auto rounded-md p-0 text-[13px] font-bold text-blue-700 dark:text-blue-300" variant="link" type="button" onClick={() => toggleExpanded(item.id)}>{t("features:textMerger.collapse")}</Button>
                    </div>
                  ) : (
                    <Button className="mx-2.5 mb-2.5 ml-[76px] min-h-[46px] w-[calc(100%-86px)] justify-between rounded-xl px-3 py-2.5 text-left font-normal text-muted-foreground max-[620px]:mr-[62px] max-[620px]:ml-2.5 max-[620px]:w-[calc(100%-72px)]" variant="secondary" type="button" onClick={() => toggleExpanded(item.id)} data-testid="text-merger-preview">
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{preview(item.content) || t("features:textMerger.emptyPreview")}</span><b className="shrink-0 text-[13px] text-blue-700 dark:text-blue-300">{t("features:textMerger.editContent")}</b>
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        ) : <div className="mt-[15px] grid min-h-40 place-items-center content-center gap-[7px] rounded-2xl bg-muted text-center text-muted-foreground"><FileText size={24} /><strong className="text-[15px]">{t("features:textMerger.emptyTitle")}</strong><span className="text-[13px]">{t("features:textMerger.emptyDescription")}</span></div>}
        {message && <p className="mx-0.5 mt-[11px] flex items-center gap-1.5 text-[13px] font-bold text-green-700 dark:text-green-300" role="status"><Check size={16} /> {message}</p>}
      </UtilitySectionCard>

      <UtilitySectionCard title={t("features:textMerger.settingsTitle")} description={t("features:textMerger.settingsDescription")}>
        <div className="mb-[15px] grid grid-cols-2 gap-2.5 max-[620px]:grid-cols-1" data-testid="text-merger-settings">
          <UtilityField><span>{t("features:textMerger.separatorLabel")}</span><UtilitySelect data-testid="text-merger-separator" value={separatorPreset} onChange={(event) => { setSeparatorPreset(event.target.value as SeparatorPreset); setOutput(""); }}>{(["newline", "blank-line", "space", "comma", "custom"] as SeparatorPreset[]).map((value) => <option key={value} value={value}>{t(`features:textMerger.separators.${value}` as never)}</option>)}</UtilitySelect></UtilityField>
          {separatorPreset === "custom" && <UtilityField><span>{t("features:textMerger.customSeparatorLabel")}</span><UtilityInput value={customSeparator} onChange={(event) => { setCustomSeparator(event.target.value); setOutput(""); }} placeholder={t("features:textMerger.customSeparatorPlaceholder")} /></UtilityField>}
          <div className="col-span-full overflow-hidden rounded-xl border border-border bg-background max-[620px]:col-span-1">
            <ToggleRow label={t("features:textMerger.trimItems")} description={t("features:textMerger.trimItemsDescription")} checked={trimItems} onChange={(checked) => { setTrimItems(checked); setOutput(""); }} />
            <ToggleRow label={t("features:textMerger.excludeEmpty")} description={t("features:textMerger.excludeEmptyDescription")} checked={excludeEmpty} onChange={(checked) => { setExcludeEmpty(checked); setOutput(""); }} />
          </div>
        </div>
        <div className="w-full max-w-80"><PrimaryButton accent="blue" disabled={!canMerge} onClick={() => setOutput(mergeTextItems(items, { separator, trimItems, excludeEmpty }))}><Combine size={18} /> {t("features:textMerger.merge")}</PrimaryButton></div>
      </UtilitySectionCard>

      <UtilitySectionCard title={t("features:textMerger.resultTitle")} description={t("features:textMerger.resultDescription", { count: formatNumber(output.length) })}>
        <UtilityTextarea className="min-h-[260px]" data-testid="text-merger-result" value={output} readOnly placeholder={t("features:textMerger.resultPlaceholder")} />
        <div className="mt-[11px] flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="lg" className="rounded-xl font-bold" type="button" disabled={!output} onClick={() => void copyOutput()}><Copy size={16} /> {t("features:textMerger.copy")}</Button>
          <Button variant="secondary" size="lg" className="rounded-xl font-bold" type="button" disabled={!output} onClick={downloadOutput}><Download size={16} /> {t("features:textMerger.download")}</Button>
          <Button variant="secondary" size="lg" className="rounded-xl font-bold" type="button" onClick={clearAll}><Eraser size={16} /> {t("features:textMerger.clear")}</Button>
        </div>
      </UtilitySectionCard>

      <ToolGuide
        title={t("features:textMerger.guide.title")}
        description={t("features:textMerger.guide.description")}
        blocks={(t("features:textMerger.guide.blocks", { returnObjects: true }) as Array<{ title: string; text: string }>).map((item) => ({ title: item.title, paragraphs: [item.text] }))}
        faq={(t("features:textMerger.guide.faq", { returnObjects: true }) as Array<{ q: string; a: string }>).map((item) => ({ question: item.q, answer: item.a }))}
      />
    </UtilityPage>
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
