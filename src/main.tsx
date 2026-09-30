import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./app/App";
import { installRedactorNavigation, isRedactorDocument, isRedactorPath } from "./app/redactorIsolation";
import { installChunkRecovery } from "./app/chunkRecovery";
import { VIDEO_STUDIO_PUBLIC } from "./app/publicService";
import "./i18n/config";
import { registerServiceWorker } from "./pwa/registerServiceWorker";
import "./styles/tailwind.css";
import "./styles/global.css";
import "./styles/worklazy-theme.css";

const basePath = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");
installRedactorNavigation();
installChunkRecovery();
// Retire only the former video-scoped isolation workers; other tool/PWA workers stay intact.
if (!VIDEO_STUDIO_PUBLIC && "serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      if (/\/(?:ko\/|en\/)?tools\/video-studio\/$/.test(new URL(registration.scope).pathname)) {
        void registration.unregister();
      }
    }
  }).catch(() => {});
}

function MountedApp() {
  useEffect(() => { window.dispatchEvent(new Event("worklazy:mounted")); }, []);
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basePath}>
      <MountedApp />
    </BrowserRouter>
  </StrictMode>,
);

if (!isRedactorDocument() && !isRedactorPath(location.pathname, import.meta.env.BASE_URL)) registerServiceWorker();
