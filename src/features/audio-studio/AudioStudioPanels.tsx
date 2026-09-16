import { AlertTriangle, Bot, Download, Headphones, SlidersHorizontal, WandSparkles } from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";

import { UtilityField, UtilityNotice, UtilitySectionCard, UtilitySelect } from "../../components/UtilitySurface";
import { PrimaryButton, SegmentedControl, ToggleRow } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import { formatAudioTime } from "./audioHelpers";

export type AudioExportFormat = "wav" | "mp3";
export type VoicePreset = "low" | "high" | "child" | "robot" | "custom";

export function VoiceEffectPanel({ busy, selectionAvailable, voicePreset, effectivePitch, onPreset, onPitch, onPreview, onApply, previewUrl, audioRef }: {
 busy: boolean;
 selectionAvailable: boolean;
 voicePreset: VoicePreset;
 effectivePitch: number;
 onPreset: (preset: VoicePreset) => void;
 onPitch: (value: number) => void;
 onPreview: () => void;
 onApply: () => void;
 previewUrl: string;
 audioRef: RefObject<HTMLAudioElement | null>;
}) {
 const { t } = useTranslation("features");
 return (
  <Card className="audio-voice-effect-panel mt-3 gap-0 overflow-visible rounded-2xl border border-primary/20 bg-gradient-to-br bg-primary/5 p-3.5 py-3.5 shadow-none ring-0 ">
   <div className="audio-voice-effect-heading flex items-center justify-between gap-3.5 max-[620px]:flex-col max-[620px]:items-start max-[620px]:gap-2">
    <span className="flex min-w-0 items-start gap-2 text-primary dark:text-primary"><WandSparkles className="shrink-0" size={19} /><span className="flex min-w-0 flex-col gap-1"><strong className="text-[15px] text-foreground">{t("audio.voice.title")}</strong><small className="text-[13px] leading-relaxed text-muted-foreground">{t("audio.voice.description")}</small></span></span>
    <b className="shrink-0 rounded-lg bg-card px-2.5 py-1.5 text-[13px] font-bold text-primary tabular-nums dark:text-primary">{voicePreset === "robot" ? t("audio.voice.robotValue") : t("audio.voice.semitones", { count: effectivePitch })}</b>
   </div>
   <div className="audio-voice-presets mt-3 grid grid-cols-5 gap-1.5 max-[620px]:grid-cols-2" data-testid="audio-voice-presets" role="radiogroup" aria-label={t("audio.voice.presetsLabel")}>
    {(["low", "high", "child", "robot", "custom"] as const).map((preset) => { const selected = voicePreset === preset; return (
     <Button key={preset} type="button" role="radio" aria-checked={selected} data-active={selected || undefined} className={cn("min-h-[42px] rounded-xl border px-2 text-[13px] font-bold", selected ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground")} variant="outline" disabled={busy} onClick={() => onPreset(preset)}>
      {preset === "robot" && <Bot size={17} />}{t(`audio.voice.presets.${preset}`)}
     </Button>
    ); })}
   </div>
   <label className={cn("audio-pitch-control mt-3 grid grid-cols-[minmax(180px,auto)_minmax(160px,1fr)_36px] items-center gap-3 text-[13px] font-bold text-muted-foreground max-[620px]:grid-cols-[1fr_36px]", voicePreset === "robot" && "opacity-50")}>
    <span className="flex items-center gap-1.5 max-[620px]:col-span-2"><SlidersHorizontal size={17} /> {t("audio.voice.pitch")}</span>
    <input className="w-full [accent-color:var(--color-violet-700)]" type="range" min={-12} max={12} step={1} disabled={busy || voicePreset === "robot"} value={effectivePitch} onChange={(event) => onPitch(Number(event.target.value))} />
    <output className="text-right text-primary tabular-nums dark:text-primary">{voicePreset === "robot" ? "—" : `${effectivePitch> 0 ? "+" : ""}${effectivePitch}`}</output>
   </label>
   <UtilityNotice className="mt-3 bg-primary/10 text-muted-foreground"><AlertTriangle className="mt-0.5 shrink-0 text-primary dark:text-primary" size={16} /><span>{t("audio.voice.notice")}</span></UtilityNotice>
   <div className="audio-voice-effect-actions mt-3 flex justify-end gap-2 max-[620px]:grid max-[620px]:grid-cols-1">
    <Button type="button" className="audio-effect-preview-button min-h-[42px] rounded-xl max-[620px]:w-full" variant="secondary" size="lg" disabled={busy || !selectionAvailable} onClick={onPreview}><Headphones size={17} /> {t("audio.voice.preview")}</Button>
    <div className="min-w-[190px] max-[620px]:w-full"><PrimaryButton accent="violet" disabled={busy || !selectionAvailable} loading={busy} onClick={onApply}><WandSparkles size={17} /> {t("audio.voice.apply")}</PrimaryButton></div>
   </div>
   {previewUrl && <div className="audio-effect-preview mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-xl bg-card p-2.5 text-[13px] font-bold text-primary max-[620px]:grid-cols-1 dark:text-primary"><span>{t("audio.voice.previewPlayer")}</span><audio className="h-[38px] w-full" ref={audioRef} src={previewUrl} controls preload="auto" /></div>}
  </Card>
 );
}

export function AudioExportPanel({ format, bitrate, busy, selectionDuration, exportSelection, onFormat, onBitrate, onExportSelection, onExport }: {
 format: AudioExportFormat;
 bitrate: 128 | 192 | 256 | 320;
 busy: boolean;
 selectionDuration?: number;
 exportSelection: boolean;
 onFormat: (format: AudioExportFormat) => void;
 onBitrate: (bitrate: 128 | 192 | 256 | 320) => void;
 onExportSelection: (checked: boolean) => void;
 onExport: () => void;
}) {
 const { t } = useTranslation("features");
 return (
  <UtilitySectionCard step={3} title={t("audio.exportTitle")} description={t("audio.exportHelp")} className=" ">
   <div className="audio-export-settings grid grid-cols-[minmax(260px,1fr)_minmax(220px,1fr)] items-end gap-3 max-[620px]:grid-cols-1">
    <SegmentedControl value={format} options={[{ value: "wav", label: t("audio.wav") }, { value: "mp3", label: t("audio.mp3") }]} onChange={onFormat} label={t("audio.format")} />
    {format === "mp3" && <UtilityField><span>{t("audio.bitrate")}</span><UtilitySelect className="h-[42px]" value={bitrate} onChange={(event) => onBitrate(Number(event.target.value) as 128 | 192 | 256 | 320)}><option value={128}>128 kbps</option><option value={192}>192 kbps · {t("audio.recommended")}</option><option value={256}>256 kbps</option><option value={320}>320 kbps</option></UtilitySelect></UtilityField>}
   </div>
   <ToggleRow label={t("audio.selectionOnly")} description={selectionDuration === undefined ? undefined : formatAudioTime(selectionDuration)} checked={exportSelection} onChange={onExportSelection} disabled={selectionDuration === undefined} />
   {format === "mp3" && <UtilityNotice className="mt-3"><AlertTriangle className="mt-0.5 shrink-0" size={16} /><span>{t("audio.offline")}</span></UtilityNotice>}
   <div className="mt-4 flex justify-end max-[620px]:[&_[data-ui-component=primary-button]]:w-full" data-testid="audio-export-actions"><PrimaryButton accent="violet" disabled={busy} loading={busy} onClick={onExport}><Download size={18} /> {t("audio.export", { format: format.toUpperCase() })}</PrimaryButton></div>
  </UtilitySectionCard>
 );
}
