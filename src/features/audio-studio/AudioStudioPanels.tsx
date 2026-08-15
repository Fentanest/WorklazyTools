import { AlertTriangle, Bot, Download, Headphones, SlidersHorizontal, WandSparkles } from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";

import { PrimaryButton, SectionCard, SegmentedControl, ToggleRow } from "../../components/ui";
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
    <div className="audio-voice-effect-panel">
      <div className="audio-voice-effect-heading">
        <span><WandSparkles size={19} /><span><strong>{t("audio.voice.title")}</strong><small>{t("audio.voice.description")}</small></span></span>
        <b>{voicePreset === "robot" ? t("audio.voice.robotValue") : t("audio.voice.semitones", { count: effectivePitch })}</b>
      </div>
      <div className="audio-voice-presets" role="radiogroup" aria-label={t("audio.voice.presetsLabel")}>
        {(["low", "high", "child", "robot", "custom"] as const).map((preset) => (
          <button key={preset} type="button" role="radio" aria-checked={voicePreset === preset} className={voicePreset === preset ? "active" : ""} disabled={busy} onClick={() => onPreset(preset)}>
            {preset === "robot" && <Bot size={17} />}{t(`audio.voice.presets.${preset}`)}
          </button>
        ))}
      </div>
      <label className={`audio-pitch-control${voicePreset === "robot" ? " is-disabled" : ""}`}>
        <span><SlidersHorizontal size={17} /> {t("audio.voice.pitch")}</span>
        <input type="range" min={-12} max={12} step={1} disabled={busy || voicePreset === "robot"} value={effectivePitch} onChange={(event) => onPitch(Number(event.target.value))} />
        <output>{voicePreset === "robot" ? "—" : `${effectivePitch > 0 ? "+" : ""}${effectivePitch}`}</output>
      </label>
      <div className="inline-notice"><AlertTriangle size={16} /><span>{t("audio.voice.notice")}</span></div>
      <div className="audio-voice-effect-actions">
        <button type="button" className="secondary-button" disabled={busy || !selectionAvailable} onClick={onPreview}><Headphones size={17} /> {t("audio.voice.preview")}</button>
        <PrimaryButton accent="violet" disabled={busy || !selectionAvailable} loading={busy} onClick={onApply}><WandSparkles size={17} /> {t("audio.voice.apply")}</PrimaryButton>
      </div>
      {previewUrl && <div className="audio-effect-preview"><span>{t("audio.voice.previewPlayer")}</span><audio ref={audioRef} src={previewUrl} controls preload="auto" /></div>}
    </div>
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
    <SectionCard step={3} title={t("audio.exportTitle")} description={t("audio.exportHelp")}>
      <div className="audio-export-settings">
        <SegmentedControl value={format} options={[{ value: "wav", label: t("audio.wav") }, { value: "mp3", label: t("audio.mp3") }]} onChange={onFormat} label={t("audio.format")} />
        {format === "mp3" && <label><span>{t("audio.bitrate")}</span><select value={bitrate} onChange={(event) => onBitrate(Number(event.target.value) as 128 | 192 | 256 | 320)}><option value={128}>128 kbps</option><option value={192}>192 kbps · {t("audio.recommended")}</option><option value={256}>256 kbps</option><option value={320}>320 kbps</option></select></label>}
      </div>
      <ToggleRow label={t("audio.selectionOnly")} description={selectionDuration === undefined ? undefined : formatAudioTime(selectionDuration)} checked={exportSelection} onChange={onExportSelection} disabled={selectionDuration === undefined} />
      {format === "mp3" && <div className="inline-notice warning"><AlertTriangle size={16} /><span>{t("audio.offline")}</span></div>}
      <div className="section-actions"><PrimaryButton accent="violet" disabled={busy} loading={busy} onClick={onExport}><Download size={18} /> {t("audio.export", { format: format.toUpperCase() })}</PrimaryButton></div>
    </SectionCard>
  );
}
