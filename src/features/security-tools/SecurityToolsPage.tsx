import { Copy, KeyRound, RefreshCw, Shield, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader, PrimaryButton, ToggleRow } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { ToolGuide } from "../../components/ToolGuide";
import { UtilityInput, UtilityPage, UtilitySectionCard } from "../../components/UtilitySurface";
import { generatePassword } from "./securityPassword";
import { strengthChecker } from "./securityStrength";

const SETS = { upper: "ABCDEFGHJKLMNPQRSTUVWXYZ", lower: "abcdefghijkmnopqrstuvwxyz", number: "23456789", symbol: "!@#$%^&*()-_=+[]{}?" };
export function SecurityToolsPage() {
  const { t } = useTranslation("features");
  const [length, setLength] = useState(20); const [upper, setUpper] = useState(true); const [lower, setLower] = useState(true); const [number, setNumber] = useState(true); const [symbol, setSymbol] = useState(true);
  const [password, setPassword] = useState(() => generatePassword(20, Object.values(SETS)));
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => { if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current); }, []);
  const strength = useMemo(() => strengthChecker.check(password), [password]);
  const charsetSize = (upper ? SETS.upper.length : 0) + (lower ? SETS.lower.length : 0) + (number ? SETS.number.length : 0) + (symbol ? SETS.symbol.length : 0);
  const guessBits = password ? Math.log2(Math.max(1, strength.guesses)) : 0;
  const strengthAdvice = password && strength.score <= 2
    ? strength.score <= 1
      ? t("security.adviceWeak")
      : t("security.adviceMedium")
    : "";
  const strengthLevels = t("security.levels", { returnObjects: true }) as string[];
  const guideBlocks = (t("security.guide.blocks", { returnObjects: true }) as Array<{ title: string; text: string }>).map((block) => ({ title: block.title, paragraphs: [block.text] }));
  const guideFaq = (t("security.guide.faq", { returnObjects: true }) as Array<{ q: string; a: string }>).map((item) => ({ question: item.q, answer: item.a }));
  const formatCrackTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds >= 100 * 365 * 24 * 60 * 60) return t("security.time.century");
    if (seconds < 1) return t("security.time.underSecond");
    if (seconds < 60) return t("security.time.seconds", { count: Math.max(1, Math.round(seconds)) });
    if (seconds < 60 * 60) return t("security.time.minutes", { count: Math.round(seconds / 60) });
    if (seconds < 24 * 60 * 60) return t("security.time.hours", { count: Math.round(seconds / (60 * 60)) });
    if (seconds < 365 * 24 * 60 * 60) return t("security.time.days", { count: Math.round(seconds / (24 * 60 * 60)) });
    return t("security.time.years", { count: Math.round(seconds / (365 * 24 * 60 * 60)) });
  };
  const regenerate = () => { const selected = [upper && SETS.upper, lower && SETS.lower, number && SETS.number, symbol && SETS.symbol].filter(Boolean) as string[]; if (selected.length) setPassword(generatePassword(length, selected)); };
  const copyPassword = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 1_500);
  };
  const meterColors = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-green-600", "bg-blue-600"];
  return <UtilityPage toolId="security-tools">
    <PageHeader eyebrow="PASSWORD GENERATOR" title={t("security.title")} description={t("security.description")} />
    <UtilitySectionCard title={t("security.generateTitle")}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-2xl border border-input bg-muted p-2.5 text-violet-700 dark:text-violet-300" data-testid="password-output"><KeyRound size={22} /><UtilityInput className="border-0 bg-transparent px-2 font-mono text-base ring-0 focus-visible:ring-0" value={password} onChange={(event) => setPassword(event.target.value)} aria-label={t("security.passwordLabel")} /><Button variant="secondary" size="icon" className="rounded-xl text-violet-700 dark:text-violet-300" type="button" aria-label={t("security.copyLabel")} onClick={() => void copyPassword()}><Copy size={18} /></Button></div>
      <span className="sr-only" aria-live="polite">{copied ? t("security.copied") : ""}</span>
      <label className="my-[15px] flex flex-col gap-2 text-[13px] text-muted-foreground"><span>{t("security.length", { count: length })}</span><input className="accent-violet-700" type="range" min={8} max={64} value={length} onChange={(event) => setLength(Number(event.target.value))} /></label>
      <div className="mb-3.5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border p-px max-[620px]:grid-cols-1" data-testid="password-options"><ToggleRow label={t("security.upper")} checked={upper} onChange={setUpper} /><ToggleRow label={t("security.lower")} checked={lower} onChange={setLower} /><ToggleRow label={t("security.number")} checked={number} onChange={setNumber} /><ToggleRow label={t("security.symbol")} checked={symbol} onChange={setSymbol} /></div>
      <PrimaryButton accent="blue" disabled={!charsetSize} onClick={regenerate}><RefreshCw size={18} /> {t("security.regenerate")}</PrimaryButton>
    </UtilitySectionCard>
    <UtilitySectionCard title={t("security.analysisTitle")} description={t("security.analysisDescription")}>
      <div className="flex items-center justify-between gap-3" role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={strength.score} aria-valuetext={strengthLevels[strength.score]} data-testid="password-strength"><div className="grid flex-1 grid-cols-5 gap-1.5">{[0, 1, 2, 3, 4].map((score) => <i className={`h-[7px] rounded-full ${score <= strength.score ? meterColors[strength.score] : "bg-muted"}`} key={score} />)}</div><strong className="min-w-[70px] text-right text-sm">{strengthLevels[strength.score]}</strong></div>
      <div className="mt-3.5 grid grid-cols-2 gap-2.5 max-[620px]:grid-cols-1"><Metric icon={<Shield />} label={t("security.guessDifficulty")} value={`${guessBits.toFixed(1)} bit`} help={t("security.guessHelp")} /><Metric icon={<ShieldCheck />} label={t("security.crackTime")} value={formatCrackTime(strength.crackTimes.offlineFastHashingXPerSecond.seconds)} help={t("security.crackHelp")} /></div>
      {strengthAdvice && <p className="mt-3 rounded-xl bg-amber-500/10 px-3.5 py-3 text-[13px] leading-relaxed text-amber-800 dark:text-amber-300">{strengthAdvice}</p>}
    </UtilitySectionCard>
    <ToolGuide title={t("security.guide.title")} description={t("security.guide.description")} blocks={guideBlocks} faq={guideFaq} />
  </UtilityPage>;
}

function Metric({ icon, label, value, help }: { icon: React.ReactNode; label: string; value: string; help: string }) {
  return <article className="min-w-0 rounded-2xl bg-blue-50 p-[15px] text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{icon}<span className="mt-3 block text-[13px] font-bold text-muted-foreground">{label}</span><strong className="mt-1 block [overflow-wrap:anywhere] text-xl tracking-[-.04em] text-foreground">{value}</strong><small className="mt-2 block text-xs font-medium leading-relaxed text-muted-foreground">{help}</small></article>;
}
