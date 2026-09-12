import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import {DOMParser, XMLSerializer} from '@xmldom/xmldom';
import { GeneratorError } from './errors.ts';
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const control = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u;
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const CT='http://schemas.openxmlformats.org/package/2006/content-types';
const REL='http://schemas.openxmlformats.org/package/2006/relationships';
const wordPartRoots = new Map([
  ['document.main','document'], ['template.main','document'],
  ['header','hdr'], ['footer','ftr'], ['footnotes','footnotes'],
  ['endnotes','endnotes'], ['comments','comments'], ['settings','settings'],
].map(([kind,root])=>['application/vnd.openxmlformats-officedocument.wordprocessingml.'+kind+'+xml',root]));
function validatePartRoot(zip: PizZip, name: string, contentType: string) {
  const expectedRoot=wordPartRoots.get(contentType);
  if(!expectedRoot)return; // Core common properties are not WordprocessingML parts.
  const root=parse(zip.file(name)!.asText()).documentElement;
  if(!root || root.namespaceURI!==W || root.localName!==expectedRoot)throw Error('XML_PART_ROOT');
}

function parse(xml: string){return new DOMParser({onError:()=>{throw Error('XML_INVALID');}}).parseFromString(xml,'application/xml');}
function normalize(zip: PizZip, name: string, namespace: string, prefix: string, expectedRoot?: string) {
  const source=zip.file(name); if(!source)throw Error('MISSING_PART');
  const dom=parse(source.asText());const root=dom.documentElement;
  if(!root)throw Error('XML_INVALID');
  if(expectedRoot&&(root.namespaceURI!==namespace||root.localName!==expectedRoot))throw Error('XML_NAMESPACE');
  let changed=false;
  for(const node of Array.from(dom.getElementsByTagName('*'))) {
    if(expectedRoot && node.namespaceURI!==namespace)throw Error('XML_NAMESPACE');
    if(prefix && node.prefix===prefix && node.namespaceURI!==namespace)throw Error('XML_NAMESPACE');
    if(node.namespaceURI!==namespace)continue;
    const qname=prefix?prefix+':'+node.localName:node.localName;
    if(node.nodeName===qname)continue;
    const replacement=dom.createElementNS(namespace,qname!);
    for(const attribute of Array.from(node.attributes))replacement.setAttributeNS(attribute.namespaceURI,attribute.name,attribute.value);
    while(node.firstChild)replacement.appendChild(node.firstChild);
    node.parentNode!.replaceChild(replacement,node);changed=true;
  }
  if(changed){dom.documentElement!.setAttributeNS('http://www.w3.org/2000/xmlns/',prefix?'xmlns:'+prefix:'xmlns',namespace);zip.file(name,new XMLSerializer().serializeToString(dom));}
  return dom;
}
function validateKey(key: string) {
  if (!key || forbidden.has(key) || /^[#\/@%^!:?=]/.test(key) || key==='.')throw Error('UNSUPPORTED_TAG');
}
function compileTemplate(bytes: Uint8Array) {
  const zip=new PizZip(bytes);const names=Object.keys(zip.files);
  if(!zip.file('[Content_Types].xml'))throw Error('UNSUPPORTED_CONTAINER');
  if(names.some(n=>/vbaProject|activeX/i.test(n))||/macroEnabled/i.test(zip.file('[Content_Types].xml')!.asText()))throw Error('UNSUPPORTED_CONTAINER');
  normalize(zip,'[Content_Types].xml',CT,'','Types');
  for(const name of names.filter(n=>n.endsWith('.rels')))normalize(zip,name,REL,'','Relationships');
  const keys = new Set<string>();
  const targets = new Set<string>();
  const guard: Docxtemplater.DXT.Module = {
    name:'U7ScalarOnlyPreflight',
    getFileType({doc}: {doc: {targets: string[]; filesContentTypes: Record<string, string>}}) {
      // Core Common runs first and resolves its exact targets from content types
      // and relationships. No assumption about header/footer filenames.
      for(const name of doc.targets){
        targets.add(name);
        validatePartRoot(zip,name,doc.filesContentTypes[name]);
        const dom=normalize(zip,name,W,'w');
        for(const p of Array.from(dom.getElementsByTagNameNS(W,'p'))){
          const text=Array.from(p.getElementsByTagNameNS(W,'t')).map(n=>n.textContent).join('');
          const stripped=text.replace(/\{([^{}]*)\}/g,(_,key)=>{validateKey(key);return '';});
          if(/[{}]/.test(stripped))throw Error('UNSUPPORTED_TAG');
        }
      }
    },
    postparse(parts) {
      for(const part of parts){
        if(part.type==='placeholder'&&part.module)throw Error('UNSUPPORTED_TAG');
        if(part.subparsed)throw Error('UNSUPPORTED_TAG');
      }
      return parts;
    },
  };
  const doc=new Docxtemplater(zip,{
    paragraphLoop:false,linebreaks:true,errorLogging:false,modules:[guard],
    parser(tag){validateKey(tag);keys.add(tag);return {get(scope){if(!Object.hasOwn(scope,tag))throw Error('MISSING');return scope[tag];}};},
    nullGetter(){throw Error('MISSING');},
  });
  const internal = doc as Docxtemplater<PizZip> & {fileType: string; templatedFiles: string[]};
  if(internal.fileType!=='docx')throw Error('UNSUPPORTED_CONTAINER');
  // Actual compiled files are mandatory coverage, including Core common parts.
  for(const name of internal.templatedFiles)if(!targets.has(name))throw Error('UNCOVERED_PART');
  return {doc, keys, targets: [...targets]};
}

function templateError(error: unknown): GeneratorError {
  if (error instanceof GeneratorError) return error;
  const message = error instanceof Error ? error.message : '';
  return new GeneratorError(message === 'UNSUPPORTED_TAG' ? 'UNSUPPORTED_TAG'
    : message === 'UNSUPPORTED_CONTAINER' ? 'UNSUPPORTED_TEMPLATE' : 'DAMAGED_TEMPLATE');
}
export function inspectGeneratorTemplate(bytes: Uint8Array): string[] {
  try { return [...compileTemplate(bytes).keys]; }
  catch (error) { throw templateError(error); }
}
export function renderGeneratorDocument(bytes: Uint8Array, values: Readonly<Record<string, string>>): Uint8Array {
  try {
    const {doc, keys} = compileTemplate(bytes);
    const data: Record<string, string> = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(values, key);
      if (!descriptor || !('value' in descriptor)) throw new GeneratorError('MISSING_MAPPING', {variables: [key]});
      if (typeof descriptor.value !== 'string') throw new GeneratorError('INVALID_VALUE');
      const value = descriptor.value;
      if (control.test(value) || /[\uD800-\uDFFF]/u.test(value.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''))) throw new GeneratorError('INVALID_VALUE');
      data[key] = value;
    }
    doc.render(data);
    return doc.getZip().generate({type: 'uint8array', compression: 'DEFLATE'});
  } catch (error) { throw templateError(error); }
}
