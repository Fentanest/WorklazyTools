import { Link } from "react-router-dom";
import { useAppLanguage } from "../i18n/routing";

export function UnavailableToolPage() {
  const language = useAppLanguage();
  const ko = language === "ko";
  return <div className="page tool-page grid min-h-[60vh] place-items-center px-4 py-12" role="status">
    <div className="max-w-md text-center">
      <h1 className="text-2xl font-semibold">{ko ? "현재 제공하지 않는 도구입니다" : "This tool is currently unavailable"}</h1>
      <p className="mt-3 text-muted-foreground">{ko ? "동영상 편집기는 잠시 공개를 중단했습니다. 다른 도구는 계속 사용할 수 있습니다." : "Video Studio is temporarily unavailable. Other tools remain available."}</p>
      <Link className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" to={`/${language}/tools/`}>
        {ko ? "다른 도구 보기" : "Browse other tools"}
      </Link>
    </div>
  </div>;
}
