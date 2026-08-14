import { Copy, KeyRound, RefreshCw, Shield, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ZxcvbnFactory } from "@zxcvbn-ts/core";

import { PageHeader, PrimaryButton, SectionCard, ToggleRow } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";

const SETS = { upper: "ABCDEFGHJKLMNPQRSTUVWXYZ", lower: "abcdefghijkmnopqrstuvwxyz", number: "23456789", symbol: "!@#$%^&*()-_=+[]{}?" };
const strengthChecker = new ZxcvbnFactory();

export function SecurityToolsPage() {
  const { t } = useTranslation("features");
  const [length, setLength] = useState(20); const [upper, setUpper] = useState(true); const [lower, setLower] = useState(true); const [number, setNumber] = useState(true); const [symbol, setSymbol] = useState(true);
  const [password, setPassword] = useState(() => generatePassword(20, Object.values(SETS)));
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
  return <div className="page tool-page page-enter utility-page security-page">
    <PageHeader eyebrow="PASSWORD GENERATOR" title={t("security.title")} description={t("security.description")} />
    <SectionCard title={t("security.generateTitle")}><div className="password-output"><KeyRound size={22} /><input value={password} onChange={(event) => setPassword(event.target.value)} aria-label={t("security.passwordLabel")} /><button type="button" aria-label={t("security.copyLabel")} onClick={() => void navigator.clipboard.writeText(password)}><Copy size={18} /></button></div><label className="range-control"><span>{t("security.length", { count: length })}</span><input type="range" min={8} max={64} value={length} onChange={(event) => setLength(Number(event.target.value))} /></label><div className="toggle-card-grid"><ToggleRow label={t("security.upper")} checked={upper} onChange={setUpper} /><ToggleRow label={t("security.lower")} checked={lower} onChange={setLower} /><ToggleRow label={t("security.number")} checked={number} onChange={setNumber} /><ToggleRow label={t("security.symbol")} checked={symbol} onChange={setSymbol} /></div><PrimaryButton accent="blue" disabled={!charsetSize} onClick={regenerate}><RefreshCw size={18} /> {t("security.regenerate")}</PrimaryButton></SectionCard>
    <SectionCard title={t("security.analysisTitle")} description={t("security.analysisDescription")}><div className={`strength-meter score-${strength.score}`}><div>{[0, 1, 2, 3, 4].map((score) => <i className={score <= strength.score ? "filled" : ""} key={score} />)}</div><strong>{strengthLevels[strength.score]}</strong></div><div className="metric-grid compact"><article><Shield /><span>{t("security.guessDifficulty")}</span><strong>{guessBits.toFixed(1)} bit</strong><small>{t("security.guessHelp")}</small></article><article><ShieldCheck /><span>{t("security.crackTime")}</span><strong>{formatCrackTime(strength.crackTimes.offlineFastHashingXPerSecond.seconds)}</strong><small>{t("security.crackHelp")}</small></article></div>{strengthAdvice && <p className="legal-note">{strengthAdvice}</p>}</SectionCard>
    <ToolGuide title={t("security.guide.title")} description={t("security.guide.description")} blocks={guideBlocks} faq={guideFaq} />
  </div>;
}

function generatePassword(length: number, groups: string[]) {
  if (!groups.length) return "";
  const all = groups.join(""); const output = groups.map((group) => secureCharacter(group));
  while (output.length < length) output.push(secureCharacter(all));
  for (let index = output.length - 1; index > 0; index -= 1) { const other = secureIndex(index + 1); [output[index], output[other]] = [output[other], output[index]]; }
  return output.slice(0, length).join("");
}
function secureCharacter(source: string) { return source[secureIndex(source.length)]; }
function secureIndex(max: number) { const limit = Math.floor(0x1_0000_0000 / max) * max; const array = new Uint32Array(1); do crypto.getRandomValues(array); while (array[0] >= limit); return array[0] % max; }
