import { useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppLanguage } from "../../i18n/routing";
import { directEntryRouteKey, restoreDirectEntryLocation, type DirectEntryLocation } from "../../utils/directEntryLocation";
import type { PdfConvertPreset } from "./pdfConvertDirect";
export function usePdfConvert(preset: PdfConvertPreset | undefined, dirty: boolean, apply: (preset: PdfConvertPreset | undefined) => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const language = useAppLanguage();
  const lastAppliedRouteKeyRef = useRef<string | null>(null);
  const approvedLocationRef = useRef<DirectEntryLocation>(location);
  const [acceptedPreset, setAcceptedPreset] = useState(preset);
  const [pendingPreset, setPendingPreset] = useState<{ preset: PdfConvertPreset | undefined; location: DirectEntryLocation }>();
  const latest = useRef({ preset, dirty, apply });
  latest.current = { preset, dirty, apply };
  useLayoutEffect(() => {
    const key = directEntryRouteKey(location.pathname);
    if (key === lastAppliedRouteKeyRef.current) {
      approvedLocationRef.current = location;
      setPendingPreset(undefined);
      return;
    }
    if (lastAppliedRouteKeyRef.current !== null && latest.current.dirty) {
      setPendingPreset({ preset: latest.current.preset, location });
      return;
    }
    lastAppliedRouteKeyRef.current = key;
    approvedLocationRef.current = location;
    setPendingPreset(undefined);
    setAcceptedPreset(latest.current.preset);
    latest.current.apply(latest.current.preset);
  }, [location.pathname, location.search, location.hash]);
  const accept = () => {
    if (!pendingPreset) return;
    lastAppliedRouteKeyRef.current = directEntryRouteKey(pendingPreset.location.pathname);
    approvedLocationRef.current = pendingPreset.location;
    setAcceptedPreset(pendingPreset.preset);
    latest.current.apply(pendingPreset.preset);
    setPendingPreset(undefined);
  };
  const reject = () => {
    // Keep the dialog until the restored router location commits.
    navigate(restoreDirectEntryLocation(approvedLocationRef.current, language), { replace: true });
  };
  return { acceptedPreset, pending: Boolean(pendingPreset), accept, reject };
}
