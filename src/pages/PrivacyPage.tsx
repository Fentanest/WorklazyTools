import { ExternalLink, FileLock2, Globe2, ShieldCheck } from "lucide-react";

import { PageHeader } from "../components/ui";

export function PrivacyPage() {
  return (
    <div className="page standard-page page-enter content-page">
      <PageHeader
        eyebrow="PRIVACY"
        title="개인정보처리방침"
        description="작업 파일의 로컬 처리와 사이트 운영 과정에서 발생하는 네트워크 요청을 구분해 안내합니다."
      />

      <div className="policy-summary">
        <ShieldCheck size={25} />
        <div><strong>핵심 원칙</strong><p>선택한 문서, 입력한 파일 암호와 생성된 결과 파일을 Worklazy Tools의 서버로 업로드하거나 저장하지 않습니다.</p></div>
      </div>

      <article className="prose-card">
        <p className="policy-date">시행일: 2026년 8월 13일</p>

        <h2>1. 브라우저에서 처리하는 정보</h2>
        <p>Excel 병합, Word·HWP 비교, HWP 편집, PDF 편집·변환·OCR, 비디오와 이미지 편집에 선택한 파일은 사용자의 브라우저 안에서 읽고 처리합니다. 파일 내용과 암호를 처리하기 위한 Worklazy Tools의 별도 업로드 기능은 운영하지 않습니다.</p>
        <ul>
          <li>입력 파일과 암호: 작업 중인 브라우저 메모리에서만 사용</li>
          <li>결과 파일: 브라우저가 생성한 임시 다운로드 주소로 제공</li>
          <li>보관 기간: 일반 작업 상태는 페이지를 새로고침하거나 탭을 닫으면 제거되며, 공식 rhwp 편집기는 미저장 문서 복구를 위해 브라우저 IndexedDB에 로컬 초안을 저장할 수 있음</li>
        </ul>

        <h2>2. 사이트 이용 시 발생하는 일반 네트워크 정보</h2>
        <p>사이트 화면을 불러오려면 GitHub Pages 등 정적 호스팅 제공자에게 IP 주소, 브라우저 종류, 요청 시각과 같은 일반 접속 정보가 전달될 수 있습니다. 이는 인터넷에서 웹페이지를 제공하기 위해 통상적으로 필요한 통신이며, 작업 파일의 내용과는 별개입니다.</p>

        <h2>3. HWP 편집기와 브라우저 실행 구성요소</h2>
        <p>HWP 편집 화면은 공식 rhwp 릴리스의 JavaScript, WebAssembly, 편집기 UI와 오픈소스 글꼴을 버전·커밋·파일 해시가 고정된 정적 자산으로 Worklazy Tools 배포물에 포함합니다. 실행할 때 외부 rhwp 사이트나 외부 웹폰트 제공자를 호출하지 않습니다.</p>
        <p>사용자가 선택한 HWP, HWPX 또는 HML 파일은 HTTP 업로드 요청이 아니라 같은 사이트 안의 편집기 iframe으로 브라우저 내부 MessageChannel을 통해 전달됩니다. 파일 열기, 암호 처리, 편집과 저장은 브라우저에서 수행되며 편집기 문서에는 외부 네트워크 연결을 제한하는 콘텐츠 보안 정책을 적용합니다.</p>

        <h2>4. 문서 비교 기능 준비</h2>
        <p>Word 비교를 처음 실행할 때 문서 분석에 필요한 실행 파일을 외부 콘텐츠 제공망에서 내려받습니다. 이 요청 과정에서 제공망에 IP 주소와 브라우저 정보가 전달될 수 있지만, 선택한 DOCX 파일은 외부로 전송하지 않습니다. 브라우저 캐시에 실행 파일이 저장될 수 있습니다.</p>

        <h2>5. PDF OCR 언어 모델</h2>
        <p>PDF OCR을 처음 실행할 때 한국어·영어 학습 모델과 실행 구성요소를 외부 콘텐츠 제공망에서 내려받습니다. 이 요청 과정에서 제공망에 IP 주소와 브라우저 정보가 전달될 수 있지만, 선택한 PDF 페이지와 인식 결과는 외부로 전송하지 않습니다. 학습 모델은 브라우저 캐시 정책에 따라 저장될 수 있습니다.</p>

        <h2>6. Google AdSense와 쿠키</h2>
        <p>사이트 운영을 위해 Google AdSense 광고를 사용할 수 있습니다. 광고가 활성화된 페이지에서는 Google과 광고 파트너가 쿠키를 저장하거나 읽고, 웹 비콘·IP 주소·기타 식별자를 이용해 광고 제공, 측정, 부정 사용 방지에 필요한 정보를 처리할 수 있습니다. 이 광고 데이터 처리는 문서 병합·비교 기능의 파일 처리와 구분됩니다.</p>
        <p><a href="https://policies.google.com/technologies/partner-sites?hl=ko" target="_blank" rel="noreferrer">Google이 파트너 사이트의 정보를 사용하는 방법 <ExternalLink size={13} /></a></p>

        <h2>7. 동의와 광고 개인정보 설정</h2>
        <p>유럽 경제 지역(EEA), 영국, 스위스 등 동의가 필요한 지역에는 Google에서 인증한 동의 관리 플랫폼(CMP)을 통해 선택 화면을 제공할 수 있습니다. 사용자는 브라우저 설정에서 쿠키를 삭제하거나 차단할 수 있으며, 이 경우 일부 광고 기능이 제한될 수 있습니다.</p>

        <h2>8. 제3자 제공과 판매</h2>
        <p>Worklazy Tools는 사용자가 선택한 작업 파일과 암호를 판매하거나 광고 사업자에게 제공하지 않습니다. 광고 서비스가 자체적으로 처리하는 일반 접속·광고 정보는 해당 서비스의 정책과 사용자의 동의 설정을 따르며, 문서 편집 iframe이나 파일 바이트에 접근하도록 전달하지 않습니다.</p>

        <h2>9. 아동의 개인정보</h2>
        <p>이 서비스는 일반 업무 사용자를 대상으로 하며, 만 14세 미만 아동의 개인정보를 의도적으로 수집하는 계정 기능이나 입력 양식을 제공하지 않습니다.</p>

        <h2>10. 방침 변경과 문의</h2>
        <p>기능, 광고 서비스 또는 관련 법령이 변경되면 이 방침을 수정하고 시행일을 갱신합니다. 개인정보 관련 문의는 문의 페이지에 안내된 공개 채널로 접수할 수 있습니다. 문의할 때 실제 업무 문서나 파일 암호를 첨부하지 마세요.</p>
      </article>

      <div className="content-callouts">
        <div><FileLock2 size={20} /><span><strong>문서·암호</strong><small>브라우저 로컬 처리</small></span></div>
        <div><Globe2 size={20} /><span><strong>웹·광고 요청</strong><small>정책에 따라 별도 고지</small></span></div>
      </div>
    </div>
  );
}
