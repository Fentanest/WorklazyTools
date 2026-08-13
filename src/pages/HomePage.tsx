import { ArrowRight, Download, FileUp, LockKeyhole, ScanSearch, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { tools } from "../app/toolRegistry";
import { PrivacyBanner } from "../components/PrivacyBanner";
import { ToolCard } from "../components/ToolCard";

export function HomePage() {
  return (
    <div className="page home-page page-enter">
      <section className="hero compact-home-hero">
        <div className="hero-content">
          <div className="hero-kicker"><Sparkles size={16} /> 작지만 유용한 업무 도구</div>
          <h1>귀찮은 파일 작업은 <span>도구에게 맡기세요.</span></h1>
          <p>
            문서와 미디어부터 텍스트·계산·보안 도구까지, 설치도 로그인도 필요 없습니다. 필요한 도구를 고르면
            나머지는 브라우저 안에서 안전하게 처리됩니다.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" to="/tools">도구 둘러보기 <ArrowRight size={18} /></Link>
            <div className="hero-trust"><LockKeyhole size={16} /> 작업 파일 업로드 없음</div>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="content-heading">
          <div><p className="eyebrow">TOOLS</p><h2>지금 바로 사용할 도구</h2></div>
          <Link to="/tools">전체 보기 <ArrowRight size={16} /></Link>
        </div>
        <div className="tool-grid">
          {tools.map((tool) => <ToolCard key={tool.id} tool={tool} featured />)}
        </div>
      </section>

      <PrivacyBanner />

      <section className="home-how">
        <div className="content-heading"><div><p className="eyebrow">HOW IT WORKS</p><h2>파일은 이렇게 처리됩니다</h2></div></div>
        <div className="home-how-grid">
          <div><span><FileUp size={20} /></span><strong>1. 파일 선택</strong><p>브라우저의 파일 선택 창에서 작업할 문서를 고릅니다.</p></div>
          <div><span><ScanSearch size={20} /></span><strong>2. 안전하게 처리</strong><p>작업 파일을 외부로 보내지 않고 진행률과 처리 로그를 보여줍니다.</p></div>
          <div><span><Download size={20} /></span><strong>3. 결과 저장</strong><p>브라우저가 만든 결과를 확인하고 내 기기로 내려받습니다.</p></div>
        </div>
      </section>

    </div>
  );
}
