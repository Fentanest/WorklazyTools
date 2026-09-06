import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./app/App";
import { installChunkRecovery } from "./app/chunkRecovery";
import "./i18n/config";
import { registerServiceWorker } from "./pwa/registerServiceWorker";
import "./styles/tailwind.css";
import "./styles/global.css";

const basePath = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");
installChunkRecovery();

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

registerServiceWorker();
