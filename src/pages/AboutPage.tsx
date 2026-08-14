import { Github, Heart, LockKeyhole, Moon, ShieldCheck, Sun } from "lucide-react";

import { PageHeader, SectionCard } from "../components/ui";

export function AboutPage() {
  return (
    <div className="page standard-page page-enter">
      <PageHeader eyebrow="ABOUT" title="안심하고 쓰는 작은 도구" description="문서부터 비디오·오디오·이미지까지 복잡한 파일 작업을 쉽고 안전하게 처리하는 것을 가장 중요하게 생각합니다." />

      <div className="about-grid">
        <section className="about-hero-card">
          <span className="about-icon"><ShieldCheck size={32} /></span>
          <div><p className="eyebrow success">LOCAL FIRST</p><h2>파일은 내 기기에 그대로</h2><p>선택한 파일, 입력한 암호와 작업 결과는 외부 서버로 전송되지 않습니다. 브라우저 탭을 닫으면 작업 중 데이터도 함께 사라집니다.</p></div>
        </section>
        <SectionCard title="개인정보 보호">
          <div className="about-list">
            <div><LockKeyhole size={20} /><span><strong>업로드하지 않음</strong><small>파일과 암호 처리는 브라우저 내부에서만 진행됩니다.</small></span></div>
            <div><Heart size={20} /><span><strong>계정이 필요 없음</strong><small>로그인하거나 개인정보를 입력할 필요가 없습니다.</small></span></div>
            <div><Github size={20} /><span><strong>투명한 도구</strong><small>각 처리 단계와 지원 범위를 명확하게 안내합니다.</small></span></div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="화면 스타일" description="운영체제 설정에 맞춰 라이트 모드와 다크 모드가 자동 적용됩니다.">
        <div className="appearance-preview">
          <span><Sun size={18} /> 라이트</span><i /><span><Moon size={18} /> 다크</span>
        </div>
      </SectionCard>
    </div>
  );
}
