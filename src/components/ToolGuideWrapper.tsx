import React, { Component, type ReactNode } from "react";
import { ToolGuide } from "./ToolGuide";
import { useToolGuideData } from "../hooks/useToolGuideData";
import { Card } from "./ui/card";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

class GuideErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function InnerToolGuide({ slug, children }: { slug: string; children?: ReactNode }) {
  const data = useToolGuideData(slug);
  const location = useLocation();
  const { i18n } = useTranslation();
  
  let path = location.pathname.replace(new RegExp(`^/(${i18n.language}|en|ko)`), "");
  if (!path) path = "/";
  if (!path.startsWith("/")) path = "/" + path;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  let matchedPathFaqs = data.pathFaqs?.[path];
  if (!matchedPathFaqs) {
    // Try to match dynamic paths, e.g. /tools/document-compare/results/1 to /tools/document-compare/results/:pairNumber
    if (data.pathFaqs) {
      for (const p of Object.keys(data.pathFaqs)) {
        const regexStr = "^" + p.replace(/:[^/]+/g, "[^/]+") + "$";
        if (new RegExp(regexStr).test(path)) {
          matchedPathFaqs = data.pathFaqs[p];
          break;
        }
      }
    }
  }

  const faqs = matchedPathFaqs && matchedPathFaqs.length > 0
    ? matchedPathFaqs.map(id => {
        const item = data.faq[id];
        if (!item) throw new Error(`Missing FAQ ID '${id}' for path '${path}' in guide '${slug}'`);
        return { question: item.q, answer: item.a };
      })
    : Object.values(data.faq).map(item => ({ question: item.q, answer: item.a }));

  let matchedPathBlocks = data.pathBlocks?.[path] || [];
  if (!data.pathBlocks?.[path] && data.pathBlocks) {
    for (const p of Object.keys(data.pathBlocks)) {
      const regexStr = "^" + p.replace(/:[^/]+/g, "[^/]+") + "$";
      if (new RegExp(regexStr).test(path)) {
        matchedPathBlocks = data.pathBlocks[p] || [];
        break;
      }
    }
  }
  const combinedBlocks = [...data.blocks, ...matchedPathBlocks];
  
  return (
    <ToolGuide
      title={data.title}
      description={data.description}
      blocks={combinedBlocks}
      faq={faqs}
    >
      {children}
    </ToolGuide>
  );
}

export function ToolGuideWrapper({ slug, children }: { slug: string; children?: ReactNode }) {
  const { t } = useTranslation("common");
  return (
    <GuideErrorBoundary fallback={
      <Card as="section" className="ui-tool-guide gap-0 overflow-visible rounded-none bg-destructive/10 p-5 shadow-none ring-0">
        <p className="text-destructive font-bold">{t("errors.guideFailed", "가이드 정보를 불러올 수 없습니다. 작업을 중단합니다.")}</p>
      </Card>
    }>
      <InnerToolGuide slug={slug}>{children}</InnerToolGuide>
    </GuideErrorBoundary>
  );
}
