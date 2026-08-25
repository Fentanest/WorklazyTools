declare module "legacy-word-doc-reader" {
  export interface LegacyWordRun {
    text?: string;
    comRef?: number;
    [key: string]: unknown;
  }

  export interface LegacyWordParagraph {
    runs?: LegacyWordRun[];
    kind?: "p" | "cell" | "rowEnd";
    align?: number;
    list?: { marker?: string; [key: string]: unknown } | null;
    pp?: Record<string, unknown> | null;
    [key: string]: unknown;
  }

  export interface LegacyWordModel {
    body?: LegacyWordParagraph[];
    footnotes?: LegacyWordParagraph[];
    endnotes?: LegacyWordParagraph[];
    annotations?: LegacyWordParagraph[];
    header?: LegacyWordParagraph[];
    footer?: LegacyWordParagraph[];
  }

  export interface LegacyWordReader {
    (input: ArrayBuffer | Uint8Array): string | null;
    model(input: ArrayBuffer | Uint8Array): LegacyWordModel | null;
  }

  const docToText: LegacyWordReader;
  export default docToText;
}
