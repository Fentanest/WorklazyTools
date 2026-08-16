import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type StandaloneNavigator = Navigator & { standalone?: boolean };

export function AppInstallControl() {
  const { t } = useTranslation("common");
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 820px)").matches);
  const [installed, setInstalled] = useState(isInstalled);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent>();
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 820px)");
    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    const updateMobile = () => setMobile(mobileQuery.matches);
    const updateInstalled = () => setInstalled(isInstalled());
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setInstallPrompt(undefined);
      setInstructionsOpen(false);
    };

    mobileQuery.addEventListener("change", updateMobile);
    displayModeQuery.addEventListener("change", updateInstalled);
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      mobileQuery.removeEventListener("change", updateMobile);
      displayModeQuery.removeEventListener("change", updateInstalled);
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  if (!mobile || installed) return null;

  const requestInstall = async () => {
    if (!installPrompt) {
      setInstructionsOpen(true);
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(undefined);
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      setInstallPrompt(undefined);
      setInstructionsOpen(true);
    }
  };

  return (
    <>
      <button className="icon-button app-install-button" type="button" aria-label={t("install.action")} title={t("install.action")} onClick={() => void requestInstall()}>
        <Download size={20} />
      </button>
      {instructionsOpen && (
        <div className="sheet-backdrop install-sheet-backdrop" role="presentation" onMouseDown={() => setInstructionsOpen(false)}>
          <section className="mobile-sheet install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-sheet-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sheet-grabber" />
            <div className="sheet-header">
              <div><p className="eyebrow">WORKLAZY TOOLS</p><h2 id="install-sheet-title">{t("install.title")}</h2></div>
              <button className="icon-button subtle" type="button" onClick={() => setInstructionsOpen(false)} aria-label={t("actions.close")}><X size={20} /></button>
            </div>
            <p>{isIosDevice() ? t("install.iosInstructions") : t("install.browserInstructions")}</p>
            <button className="secondary-button" type="button" onClick={() => setInstructionsOpen(false)}>{t("actions.close")}</button>
          </section>
        </div>
      )}
    </>
  );
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as StandaloneNavigator).standalone);
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
