import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { AnalyticsLoader } from "../components/AnalyticsLoader";
import { withSiteBasePath } from "../app/siteBasePath";

/**
 * Dedicated error page for S5 (render error recovery).
 * Displayed outside AppShell without ad requests. A visitor may still
 * generate one safe, fixed-title error-page view.
 */
export function RouteErrorPage() {
  const { t } = useTranslation("common");
  const location = useLocation();

  const goHome = () => {
    const lang = document.documentElement.lang || "en";
    window.location.assign(withSiteBasePath(`/${lang}/`, import.meta.env.BASE_URL));
  };

  return (
    <>
    <AnalyticsLoader ready />
    <div className="page tool-page grid place-items-center min-h-screen px-4 py-8">
      <div className="max-w-sm text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {t("recovery.toolFailed")}
          </h1>
        </div>

        <div className="flex flex-col gap-3">
          <Button onClick={goHome} className="w-full">
            {t("recovery.goHome")}
          </Button>

          <Button
            onClick={() => window.location.assign(withSiteBasePath(location.pathname, import.meta.env.BASE_URL))}
            variant="outline"
            className="w-full"
          >
            {t("recovery.retry")}
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}
