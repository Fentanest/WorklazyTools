export interface DocumentCapabilities {
  format: 'docx'|'doc'|'hwp'|'hwpx';
  detailedFormattingMasks: boolean;
  sourceMapping: 'xml-child-path'|'native-body-coordinates';
  sourceCoverage: 'xml-inventory'|'partial-native-model';
  trackedExport: 'validated-docx-subset'|'unavailable';
  opaqueObjects: 'explicit-xml'|'may-be-omitted';
  metadataSourceMapping: 'xml-child-path'|'display-location-only';
  sourceLimits:string[];
  contentStatus: "text"|"structure-only"|"empty"|"unknown-native";
  emptyResultProvesEquality: false;
}
export function documentCapabilities(format:DocumentCapabilities['format'], model?: {blocks:Array<{text:string}>;sourceInventory?:Array<{kind?:string;opaqueSignature?:string;rawText?:string}>}):DocumentCapabilities {
  const xml=format==='docx';
  return {format,detailedFormattingMasks:xml,sourceMapping:xml?'xml-child-path':'native-body-coordinates',sourceCoverage:xml?'xml-inventory':'partial-native-model',trackedExport:xml?'validated-docx-subset':'unavailable',opaqueObjects:xml?'explicit-xml':'may-be-omitted',metadataSourceMapping:xml?'xml-child-path':'display-location-only',sourceLimits:xml?["relationship-header-footer-paths","unchanged-final-section-bindings","conventional-note-parts","validated-export-subset","cached-field-values"]:["partial-native-objects","metadata-display-locations",...(format==='doc'?[]:["sampled-long-paragraph-formatting"])],contentStatus:(model?.blocks.some(block=>block.text.trim()) || model?.sourceInventory?.some(source=>source.rawText?.trim()))?"text":xml?(model?.sourceInventory?.some(source=>source.opaqueSignature || source.kind==='tbl')?"structure-only":"empty"):"unknown-native",emptyResultProvesEquality:false};
}
export interface DocumentProvenance { rawSha256:string; comparisonSha256:string; revisionPolicy:'raw'|'accepted-with-revised-comments'; sourceBytes:'local-file'; }
export async function documentProvenance(raw:ArrayBuffer,comparison:ArrayBuffer,accepted=false):Promise<DocumentProvenance> {
  const sha=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
  return {rawSha256:await sha(raw),comparisonSha256:await sha(comparison),revisionPolicy:accepted?'accepted-with-revised-comments':'raw',sourceBytes:'local-file'};
}
