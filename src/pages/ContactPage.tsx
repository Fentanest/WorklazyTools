import { Bug, ExternalLink, Lightbulb, ShieldCheck } from "lucide-react";

import { PageHeader } from "../components/ui";

const GITHUB_ISSUES = "https://github.com/Fentanest/WorklazyTools/issues";

export function ContactPage() {
  return (
    <div className="page standard-page page-enter content-page">
      <PageHeader eyebrow="CONTACT" title="문의하기" description="오류 제보와 기능 제안은 공개 개발자 채널에서 확인합니다." />

      <section className="contact-card">
        <div className="contact-icon"><Bug size={27} /></div>
        <div>
          <p className="eyebrow">GITHUB</p>
          <h2>오류와 개선 의견을 알려주세요.</h2>
          <p>재현 순서, 사용한 브라우저, 파일 형식과 화면에 표시된 오류 문구를 함께 적으면 확인에 도움이 됩니다.</p>
          <a className="secondary-button" href={GITHUB_ISSUES} target="_blank" rel="noreferrer">GitHub Issues에 문의·건의 <ExternalLink size={15} /></a>
        </div>
      </section>

      <div className="contact-grid">
        <section className="prose-card compact-prose">
          <Lightbulb size={21} />
          <h2>기능 제안</h2>
          <p>어떤 파일 작업을 반복하고 있는지, 원하는 입력과 결과 형식을 알려주세요. 개인정보나 회사 기밀은 예시 데이터로 바꿔 작성해 주세요.</p>
        </section>
        <section className="prose-card compact-prose">
          <ShieldCheck size={21} />
          <h2>개인정보 문의</h2>
          <p>파일 이름, 문서 원본, 실제 암호를 문의 내용에 포함하지 마세요. 민감한 화면은 내용을 가린 뒤 공유해 주세요.</p>
        </section>
      </div>

      <article className="prose-card">
        <h2>오류 제보에 포함하면 좋은 내용</h2>
        <ol>
          <li>사용한 운영체제와 브라우저 이름·버전</li>
          <li>XLSX, XLS, XLSB, XLSM, CSV, DOCX, HWP, HWPX, PDF, 비디오 또는 이미지 중 문제가 발생한 파일 형식</li>
          <li>선택한 병합·비교·변환·인코딩·이미지 편집 방식과 적용 범위</li>
          <li>진행 로그의 마지막 단계와 오류 문구</li>
          <li>민감한 내용을 제거한 최소 재현 파일(공유 가능한 경우에만)</li>
        </ol>
      </article>
    </div>
  );
}
