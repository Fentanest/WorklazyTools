import type { DocumentSourceReference } from "./comparisonManifest.ts";
import policy from '../word-compare/formatting-policy.json' with { type: 'json' };
export const formattingGroups = ['fontFamily','size','style','color','paragraph','numbering'] as const;
export type FormattingGroup = typeof formattingGroups[number];
export type FormattingMask = Record<FormattingGroup, boolean>;
export const defaultFormattingMask: FormattingMask = Object.fromEntries(formattingGroups.map(group=>[group,true])) as FormattingMask;
export function normalizeFormattingMask(mask?: Partial<FormattingMask>): FormattingMask {
  if (mask && (Object.keys(mask).some(key=>!formattingGroups.includes(key as FormattingGroup)) || Object.values(mask).some(value=>typeof value!=='boolean'))) throw new Error('Invalid formatting selection');
  return {...defaultFormattingMask,...mask};
}
export function formattingGroup(property: string, name: string): FormattingGroup {
  const local=name.replace(/^\{[^}]+\}/,'');
  return (policy.maskGroups as Record<string, Record<string,string>>)[property]?.[local] as FormattingGroup ?? (property==='rPr'?'style':'paragraph');
}
export const maskPolicyVersion='worklazy-formatting-mask-1';
export const maskLabels: Record<FormattingGroup,[string,string]>={fontFamily:['글꼴','Font family'],size:['글꼴 크기','Font size'],style:['글자 스타일','Text style'],color:['색상','Color'],paragraph:['문단·배치','Paragraph and layout'],numbering:['번호','Numbering']};

export function maskedSourceFormatting(sources:DocumentSourceReference[], parent:DocumentSourceReference|undefined, mask:FormattingMask) {
  if(!parent)return "";
  const selected=sources.filter(ref=>ref.part===parent.part && parent.path.every((index,depth)=>ref.path[depth]===index));
  return JSON.stringify(selected.flatMap(ref=>Object.entries(ref.normalizedProperties??{}).map(([property,fact])=>Object.fromEntries(Object.entries(fact.supported).filter(([name])=>mask[formattingGroup(property,name)])))).filter(fact=>Object.keys(fact).length));
}
