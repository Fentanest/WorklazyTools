import { Check, LockKeyhole, ServerOff } from "lucide-react";

interface PrivacyBannerProps {
  compact?: boolean;
}

export function PrivacyBanner({ compact = false }: PrivacyBannerProps) {
  if (compact) {
    return (
      <div className="privacy-inline">
        <LockKeyhole size={15} />
        <span>파일과 암호는 이 브라우저 안에서만 처리됩니다.</span>
      </div>
    );
  }

  return (
    <section className="privacy-banner" aria-label="개인정보 보호 안내">
      <div className="privacy-icon"><ServerOff size={25} /></div>
      <div className="privacy-copy">
        <p className="eyebrow success">PRIVATE BY DESIGN</p>
        <h2>작업 파일을 서버에 업로드하지 않아요.</h2>
        <p>
          선택한 파일, 입력한 암호와 작업 결과는 사용 중인 브라우저 안에서만 처리됩니다.
          로그인이나 외부 업로드 없이 안심하고 사용하실 수 있습니다.
        </p>
      </div>
      <div className="privacy-points" aria-hidden="true">
        <span><Check size={14} /> 로컬 처리</span>
        <span><Check size={14} /> 탭 종료 시 삭제</span>
      </div>
    </section>
  );
}
