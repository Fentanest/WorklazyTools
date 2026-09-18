import {
  BITFLAG_DATA_DESCRIPTOR,
  BITFLAG_ENCRYPTED,
  BITFLAG_LANG_ENCODING_FLAG,
  BITFLAG_LEVEL,
  BITFLAG_LEVEL_FAST_MASK,
  BITFLAG_LEVEL_MAX_MASK,
  BITFLAG_LEVEL_SUPER_FAST_MASK,
  BlobReader,
  BlobWriter,
  CENTRAL_FILE_HEADER_LENGTH,
  CENTRAL_FILE_HEADER_SIGNATURE,
  CODEC_DEFLATE,
  COMPRESSION_METHOD_AES,
  COMPRESSION_METHOD_DEFLATE,
  COMPRESSION_METHOD_DEFLATE_64,
  COMPRESSION_METHOD_STORE,
  DATA_DESCRIPTOR_RECORD_LENGTH,
  DATA_DESCRIPTOR_RECORD_SIGNATURE,
  DATA_DESCRIPTOR_RECORD_SIGNATURE_LENGTH,
  DATA_DESCRIPTOR_RECORD_ZIP_64_LENGTH,
  DIGITAL_SIGNATURE_RECORD_SIGNATURE,
  DIRECTORY_SIGNATURE,
  Data64URIReader,
  Data64URIWriter,
  EMPTY_UINT8_ARRAY,
  END_OF_CENTRAL_DIR_LENGTH,
  END_OF_CENTRAL_DIR_SIGNATURE,
  ERR_AMBIGUOUS_ARCHIVE,
  ERR_BAD_FORMAT,
  ERR_CENTRAL_DIRECTORY_NOT_FOUND,
  ERR_ENCRYPTED,
  ERR_ENCRYPTED_CENTRAL_DIRECTORY,
  ERR_ENTRY_DATA_OUT_OF_BOUNDS,
  ERR_EOCDR_LOCATOR_ZIP64_NOT_FOUND,
  ERR_EOCDR_NOT_FOUND,
  ERR_EXTRAFIELD_ZIP64_NOT_FOUND,
  ERR_HTTP_RANGE,
  ERR_HTTP_RESOURCE_CHANGED,
  ERR_INVALID_AUTHENTICATION_CODE,
  ERR_INVALID_CODEC_DEFINITION,
  ERR_INVALID_CODEC_MODULE,
  ERR_INVALID_COMPRESSED_DATA,
  ERR_INVALID_CRC32,
  ERR_INVALID_FILENAME_VALIDATION,
  ERR_INVALID_FUNCTION_OPTION,
  ERR_INVALID_MAX_APPENDED_DATA_SIZE,
  ERR_INVALID_MAX_WORKERS,
  ERR_INVALID_PASSWORD,
  ERR_INVALID_PASSWORD_TYPE,
  ERR_INVALID_SIGNAL,
  ERR_INVALID_SIGNATURE,
  ERR_INVALID_STRICTNESS,
  ERR_INVALID_UNCOMPRESSED_SIZE,
  ERR_ITERATOR_COMPLETED_TOO_SOON,
  ERR_LOCAL_FILE_HEADER_NOT_FOUND,
  ERR_OVERLAPPING_ENTRY,
  ERR_RESERVED_COMPRESSION_METHOD,
  ERR_SPLIT_ZIP_FILE,
  ERR_UNSAFE_FILENAME,
  ERR_UNSUPPORTED_COMPRESSION,
  ERR_UNSUPPORTED_CRYPTO_API,
  ERR_UNSUPPORTED_ENCRYPTION,
  ERR_UNSUPPORTED_UINT64,
  ERR_WORKER_STARTUP_TIMEOUT,
  ERR_WRITER_NOT_INITIALIZED,
  EXTRAFIELD_TYPE_AES,
  EXTRAFIELD_TYPE_EXTENDED_TIMESTAMP,
  EXTRAFIELD_TYPE_INFOZIP,
  EXTRAFIELD_TYPE_NTFS,
  EXTRAFIELD_TYPE_NTFS_TAG1,
  EXTRAFIELD_TYPE_PKWARE_UNIX,
  EXTRAFIELD_TYPE_UNICODE_COMMENT,
  EXTRAFIELD_TYPE_UNICODE_PATH,
  EXTRAFIELD_TYPE_UNIX,
  EXTRAFIELD_TYPE_UNIX_TYPE1,
  EXTRAFIELD_TYPE_USDZ,
  EXTRAFIELD_TYPE_ZIP64,
  Entry,
  FILE_ATTR_MSDOS_ARCHIVE_MASK,
  FILE_ATTR_MSDOS_DIR_MASK,
  FILE_ATTR_MSDOS_HIDDEN_MASK,
  FILE_ATTR_MSDOS_READONLY_MASK,
  FILE_ATTR_MSDOS_SYSTEM_MASK,
  FILE_ATTR_UNIX_DEFAULT_MASK,
  FILE_ATTR_UNIX_EXECUTABLE_MASK,
  FILE_ATTR_UNIX_SETGID_MASK,
  FILE_ATTR_UNIX_SETUID_MASK,
  FILE_ATTR_UNIX_STICKY_MASK,
  FILE_ATTR_UNIX_TYPE_DIR,
  FILE_ATTR_UNIX_TYPE_FILE,
  FILE_ATTR_UNIX_TYPE_MASK,
  FILE_ATTR_UNIX_TYPE_SYMLINK,
  FORMAT_DEFLATE64_RAW,
  FORMAT_DEFLATE_RAW,
  FORMAT_GZIP,
  FUNCTION_TYPE,
  GenericReader,
  GenericWriter,
  HEADER_OFFSET_COMPRESSED_SIZE,
  HEADER_OFFSET_EXTRAFIELD_LENGTH,
  HEADER_OFFSET_FILENAME_LENGTH,
  HEADER_OFFSET_SIGNATURE,
  HEADER_OFFSET_UNCOMPRESSED_SIZE,
  HEADER_OFFSET_VERSION,
  HEADER_SIZE,
  HttpRangeReader,
  HttpReader,
  INFINITY_VALUE,
  LOCAL_FILE_HEADER_SIGNATURE,
  LOCAL_HEADER_COMMON_OFFSET,
  MAX_16_BITS,
  MAX_32_BITS,
  MAX_8_BITS,
  MAX_DATE,
  MESSAGE_ACK_DATA,
  MESSAGE_CLOSE,
  MESSAGE_DATA,
  MESSAGE_EVENT_TYPE,
  MESSAGE_PULL,
  MESSAGE_START,
  MIN_DATE,
  OBJECT_TYPE,
  OPTION_BUFFERED_WRITE,
  OPTION_CENTRAL_EXTRA_FIELD,
  OPTION_CREATE_TEMP_STREAM,
  OPTION_DATA_DESCRIPTOR,
  OPTION_DATA_DESCRIPTOR_SIGNATURE,
  OPTION_ENCODE_TEXT,
  OPTION_ENCRYPTION_STRENGTH,
  OPTION_EXTENDED_TIMESTAMP,
  OPTION_KEEP_ORDER,
  OPTION_LEVEL,
  OPTION_LOCAL_EXTRA_FIELD,
  OPTION_NTFS_TIMESTAMP,
  OPTION_OFFSET,
  OPTION_PASSWORD,
  OPTION_PASS_THROUGH,
  OPTION_PREVENT_CLOSE,
  OPTION_RAW_PASSWORD,
  OPTION_SIGNAL,
  OPTION_SIGN_CENTRAL_DIRECTORY,
  OPTION_SUPPORT_ZIP64_SPLIT_FILE,
  OPTION_TRANSFER_STREAMS,
  OPTION_UNIX_EXTRA_FIELD_TYPE,
  OPTION_USDZ,
  OPTION_USE_COMPRESSION_STREAM,
  OPTION_USE_UNICODE_FILE_NAMES,
  OPTION_USE_WEB_WORKERS,
  PROPERTY_NAME_COMMENT,
  PROPERTY_NAME_COMPRESSION_METHOD,
  PROPERTY_NAME_CREATION_DATE,
  PROPERTY_NAME_DEPRECATED_EXTERNAL_FILE_ATTRIBUTES,
  PROPERTY_NAME_DEPRECATED_INTERNAL_FILE_ATTRIBUTES,
  PROPERTY_NAME_DIRECTORY,
  PROPERTY_NAME_ENCRYPTED,
  PROPERTY_NAME_EXECUTABLE,
  PROPERTY_NAME_EXTERNAL_FILE_ATTRIBUTES,
  PROPERTY_NAME_EXTRA_FIELD,
  PROPERTY_NAME_GID,
  PROPERTY_NAME_INTERNAL_FILE_ATTRIBUTES,
  PROPERTY_NAME_LAST_ACCESS_DATE,
  PROPERTY_NAME_LAST_MODIFICATION_DATE,
  PROPERTY_NAME_MSDOS_ATTRIBUTES,
  PROPERTY_NAME_MSDOS_ATTRIBUTES_RAW,
  PROPERTY_NAME_MS_DOS_COMPATIBLE,
  PROPERTY_NAME_RAW_LAST_MODIFICATION_DATE,
  PROPERTY_NAME_SETGID,
  PROPERTY_NAME_SETUID,
  PROPERTY_NAME_SIGNATURE,
  PROPERTY_NAME_STICKY,
  PROPERTY_NAME_UID,
  PROPERTY_NAME_UNCOMPRESSED_SIZE,
  PROPERTY_NAME_UNIX_MODE,
  PROPERTY_NAME_VERSION,
  PROPERTY_NAME_VERSION_MADE_BY,
  PROPERTY_NAME_ZIP64,
  PROPERTY_NAME_ZIPCRYPTO,
  ProgressWatcherStream,
  Reader,
  SPLIT_ZIP_FILE_SIGNATURE,
  SPLIT_ZIP_FILE_SIGNATURE_LENGTH,
  STRING_TYPE,
  SplitDataReader,
  SplitDataWriter,
  TEXT_TYPE_COMMENT,
  TEXT_TYPE_FILENAME,
  TextReader,
  TextWriter,
  UNDEFINED_VALUE,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  VERSION_AES,
  VERSION_DEFLATE,
  VERSION_MADE_BY_MSDOS,
  VERSION_MADE_BY_UNIX,
  VERSION_STORE,
  VERSION_ZIP64,
  WARNING_APPENDED_DATA,
  WARNING_COMPRESSED_PATCHED_DATA,
  WARNING_DUPLICATE_FILENAME,
  WARNING_MALFORMED_EXTRA_FIELD,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_BIT_FLAG,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_COMPRESSION_METHOD,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_CRC32_OR_SIZES,
  WARNING_MISMATCHED_ZIP64_END_OF_CENTRAL_DIRECTORY,
  WARNING_PREPENDED_CENTRAL_DIRECTORY,
  WARNING_PREPENDED_DATA,
  WARNING_TRAILING_CENTRAL_DIRECTORY_DATA,
  WARNING_UNKNOWN_VERSION,
  WARNING_UNKNOWN_ZIP64_EXTENSIBLE_DATA,
  WARNING_UNSORTED_CENTRAL_DIRECTORY,
  WARNING_WRAPPED_ENTRIES_COUNT,
  Writer,
  ZIP64_END_OF_CENTRAL_DIR_LOCATOR_SIGNATURE,
  ZIP64_END_OF_CENTRAL_DIR_SIGNATURE,
  ZIP64_END_OF_CENTRAL_DIR_TOTAL_LENGTH,
  ZipReader,
  ZipReaderStream,
  callHandler,
  checkFunctionOption,
  checkInteger,
  checkIntegerOption,
  checkPasswordOption,
  checkSignalOption,
  concat,
  configure,
  configureWorker,
  createReadable,
  createWorkerInterface,
  disableWebWorker,
  encodeText,
  getCodecStreams,
  getConfiguration,
  getDataView,
  getRegisteredCodec,
  getRegisteredCodecs,
  getTextSize,
  initStream,
  isZipFile,
  ownsWritable,
  readUint8Array,
  registerCodec,
  resetConfiguration,
  runWorker,
  runWorker2,
  setDefaultConfiguration,
  setWebWorkerBackend,
  streamToBlob,
  supportsDeflate,
  supportsFormat,
  terminateWorkers,
  toCompatibleReadable,
  toCompatibleWritable,
  toExactUint8Array,
  toNumber,
  unregisterCodec
} from "./chunk-5C6BLAQG.js";
import "./chunk-VUNV25KB.js";

// node_modules/@zip.js/zip.js/lib/core/web-worker-inline-wasm.js
var t = new Uint8Array(288);
t.fill(8, 0, 144), t.fill(9, 144, 256), t.fill(7, 256, 280), t.fill(8, 280, 288), new Uint8Array(30).fill(5);
var e = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var n = (t3) => t3({ workerURI: (t4) => {
  const n3 = "text/javascript";
  let s2 = '!function(t){"function"==typeof define&&define.amd?define(t):t()}(function(){"use strict";const{Array:t,Object:n,Number:e,Math:s,Error:r,Uint8Array:o,Uint16Array:c,Uint32Array:i,Int32Array:a,Map:f,DataView:u,Promise:l,TextEncoder:w,crypto:h,postMessage:p,TransformStream:d,ReadableStream:y,WritableStream:m,CompressionStream:S,DecompressionStream:g}=self,v=void 0,b="undefined",k="function",z=new o,C=[[],[],[],[],[],[],[],[]];for(let t=0;t<256;t++){let n=t;for(let t=0;t<8;t++)n=1&n?n>>>1^3988292384:n>>>1;C[0][t]=n}for(let t=0;t<256;t++)for(let n=1;n<8;n++){const e=C[n-1][t];C[n][t]=e>>>8^C[0][255&e]}const[I,A,x,M,P,B,D,F]=C;class R{constructor(t){this.o=t||-1}append(t){let n=0|this.o;const e=0|t.length;let s=0;if(e>=8&&t.buffer){const r=new u(t.buffer,t.byteOffset,e),o=e-8;for(;s<=o;s+=8){const t=n^r.getInt32(s,!0),e=r.getInt32(s+4,!0);n=F[255&t]^D[t>>>8&255]^B[t>>>16&255]^P[t>>>24&255]^M[255&e]^x[e>>>8&255]^A[e>>>16&255]^I[e>>>24&255]}}for(;s<e;s++)n=n>>>8^I[255&(n^t[s])];this.o=n}get(){return~this.o}}class U extends d{constructor(){let t;const n=new R;super({transform(t,e){n.append(t),e.enqueue(t)},flush(){const e=new o(4);new u(e.buffer).setUint32(0,n.get()),t.value=e}}),t=this}}function W(t,n){const e=new o(t.length+n.length);return e.set(t),e.set(n,t.length),e}function _(t){return new u(t.buffer,t.byteOffset,t.byteLength)}const T={concat(t,n){if(0===t.length||0===n.length)return t.concat(n);const e=t[t.length-1],s=T.l(e);return 32===s?t.concat(n):T.h(n,s,0|e,t.slice(0,t.length-1))},bitLength(t){const n=t.length;if(0===n)return 0;const e=t[n-1];return 32*(n-1)+T.l(e)},m(t,n){if(32*t.length<n)return t;const e=(t=t.slice(0,s.ceil(n/32))).length;return n&=31,e>0&&n&&(t[e-1]=T.S(n,t[e-1]&2147483648>>n-1,1)),t},S:(t,n,e)=>32===t?n:(e?0|n:n<<32-t)+1099511627776*t,l:t=>s.round(t/1099511627776)||32,h(t,n,e,s){for(void 0===s&&(s=[]);n>=32;n-=32)s.push(e),e=0;if(0===n)return s.concat(t);for(let r=0;r<t.length;r++)s.push(e|t[r]>>>n),e=t[r]<<32-n;const r=t.length?t[t.length-1]:0,o=T.l(r);return s.push(T.S(n+o&31,n+o>32?e:s.pop(),1)),s}},V={bytes:{v(t){const n=T.bitLength(t)/8,e=new o(n);let s;for(let r=0;r<n;r++)3&r||(s=t[r/4]),e[r]=s>>>24,s<<=8;return e},C(t){const n=[];let e,s=0;for(e=0;e<t.length;e++)s=s<<8|t[e],3&~e||(n.push(s),s=0);return 3&e&&n.push(T.S(8*(3&e),s)),n}}},K=class{constructor(t){const n=this;n.blockSize=512,n.I=[1732584193,4023233417,2562383102,271733878,3285377520],n.A=[1518500249,1859775393,2400959708,3395469782],t?(n.M=t.M.slice(0),n.P=t.P.slice(0),n.B=t.B):n.reset()}reset(){const t=this;return t.M=t.I.slice(0),t.P=[],t.B=0,t}update(t){const n=this;"string"==typeof t&&(t=V.D.C(t));const e=n.P=T.concat(n.P,t),s=n.B,o=n.B=s+T.bitLength(t);if(o>9007199254740991)throw new r("Cannot hash more than 2^53 - 1 bits");const c=new i(e);let a=0;for(let t=n.blockSize+s-(n.blockSize+s&n.blockSize-1);t<=o;t+=n.blockSize)n.F(c.subarray(16*a,16*(a+1))),a+=1;return e.splice(0,16*a),n}R(){const t=this;let n=t.P;const e=t.M;n=T.concat(n,[T.S(1,1)]);for(let t=n.length+2;15&t;t++)n.push(0);for(n.push(s.floor(t.B/4294967296)),n.push(0|t.B);n.length;)t.F(n.splice(0,16));return t.reset(),e}U(t,n,e,s){return t<=19?n&e|~n&s:t<=39?n^e^s:t<=59?n&e|n&s|e&s:t<=79?n^e^s:void 0}W(t,n){return n<<t|n>>>32-t}F(n){const e=this,r=e.M,o=t(80);for(let t=0;t<16;t++)o[t]=n[t];let c=r[0],i=r[1],a=r[2],f=r[3],u=r[4];for(let t=0;t<=79;t++){t>=16&&(o[t]=e.W(1,o[t-3]^o[t-8]^o[t-14]^o[t-16]));const n=e.W(5,c)+e.U(t,i,a,f)+u+o[t]+e.A[s.floor(t/20)]|0;u=f,f=a,a=e.W(30,i),i=c,c=n}r[0]=r[0]+c|0,r[1]=r[1]+i|0,r[2]=r[2]+a|0,r[3]=r[3]+f|0,r[4]=r[4]+u|0}},E={importKey:t=>new E._(V.bytes.C(t)),T(t,n,e,s){if(e=e||1e4,s<0||e<0)throw new r("invalid params to pbkdf2");const o=1+(s>>5)<<2;let c,i,a,f,l;const w=new ArrayBuffer(o),h=new u(w);let p=0;const d=T;for(n=V.bytes.C(n),l=1;p<(o||1);l++){for(c=i=t.encrypt(d.concat(n,[l])),a=1;a<e;a++)for(i=t.encrypt(i),f=0;f<i.length;f++)c[f]^=i[f];for(a=0;p<(o||1)&&a<c.length;a++)h.setInt32(p,c[a]),p+=4}return w.slice(0,s/8)},_:class{constructor(t){const n=this,e=n.V=K,s=[[],[]];n.K=[new e,new e];const r=n.K[0].blockSize/32;t.length>r&&(t=(new e).update(t).R());for(let n=0;n<r;n++)s[0][n]=909522486^t[n],s[1][n]=1549556828^t[n];n.K[0].update(s[0]),n.K[1].update(s[1]),n.L=new e(n.K[0])}reset(){const t=this;t.L=new t.V(t.K[0]),t.O=!1}update(t){this.O=!0,this.L.update(t)}digest(){const t=this,n=t.L.R(),e=new t.V(t.K[1]).update(n).R();return t.reset(),e}encrypt(t){if(this.O)throw new r("encrypt on already updated hmac called!");return this.update(t),this.digest(t)}}},L=typeof h!=b&&typeof h.getRandomValues==k,O="Invalid password",j="Invalid signature",H=j,N="zipjs-abort-check-password";function q(t){if(L)return h.getRandomValues(t);throw new r("Crypto API not supported")}const G=16,J={name:"PBKDF2"},Q=n.assign({hash:{name:"HMAC"}},J),X=n.assign({iterations:1e3,hash:{name:"SHA-1"}},J),Y=["deriveBits"],Z=[8,12,16],$=[16,24,32],tt=10,nt=[0,0,0,0],et=typeof h!=b,st=et&&h.subtle,rt=et&&typeof st!=b,ot=V.bytes,ct=class{constructor(t){const n=this;n.j=[[[],[],[],[],[]],[[],[],[],[],[]]],n.j[0][0][0]||n.H();const e=n.j[0][4],s=n.j[1],o=t.length;let c,i,a,f=1;if(4!==o&&6!==o&&8!==o)throw new r("invalid aes key size");for(n.A=[i=t.slice(0),a=[]],c=o;c<4*o+28;c++){let t=i[c-1];(c%o===0||8===o&&c%o===4)&&(t=e[t>>>24]<<24^e[t>>16&255]<<16^e[t>>8&255]<<8^e[255&t],c%o===0&&(t=t<<8^t>>>24^f<<24,f=f<<1^283*(f>>7))),i[c]=i[c-o]^t}for(let t=0;c;t++,c--){const n=i[3&t?c:c-4];a[t]=c<=4||t<4?n:s[0][e[n>>>24]]^s[1][e[n>>16&255]]^s[2][e[n>>8&255]]^s[3][e[255&n]]}}encrypt(t){return this.N(t,0)}decrypt(t){return this.N(t,1)}H(){const t=this.j[0],n=this.j[1],e=t[4],s=n[4],r=[],o=[];let c,i,a,f;for(let t=0;t<256;t++)o[(r[t]=t<<1^283*(t>>7))^t]=t;for(let u=c=0;!e[u];u^=i||1,c=o[c]||1){let o=c^c<<1^c<<2^c<<3^c<<4;o=o>>8^255&o^99,e[u]=o,s[o]=u,f=r[a=r[i=r[u]]];let l=16843009*f^65537*a^257*i^16843008*u,w=257*r[o]^16843008*o;for(let e=0;e<4;e++)t[e][u]=w=w<<24^w>>>8,n[e][o]=l=l<<24^l>>>8}for(let e=0;e<5;e++)t[e]=t[e].slice(0),n[e]=n[e].slice(0)}N(t,n){if(4!==t.length)throw new r("invalid aes block size");const e=this.A[n],s=e.length/4-2,o=[0,0,0,0],c=this.j[n],i=c[0],a=c[1],f=c[2],u=c[3],l=c[4];let w,h,p,d=t[0]^e[0],y=t[n?3:1]^e[1],m=t[2]^e[2],S=t[n?1:3]^e[3],g=4;for(let t=0;t<s;t++)w=i[d>>>24]^a[y>>16&255]^f[m>>8&255]^u[255&S]^e[g],h=i[y>>>24]^a[m>>16&255]^f[S>>8&255]^u[255&d]^e[g+1],p=i[m>>>24]^a[S>>16&255]^f[d>>8&255]^u[255&y]^e[g+2],S=i[S>>>24]^a[d>>16&255]^f[y>>8&255]^u[255&m]^e[g+3],g+=4,d=w,y=h,m=p;for(let t=0;t<4;t++)o[n?3&-t:t]=l[d>>>24]<<24^l[y>>16&255]<<16^l[m>>8&255]<<8^l[255&S]^e[g++],w=d,d=y,y=m,m=S,S=w;return o}},it=class{constructor(t,n){this.G=t,this.J=n,this.X=n}reset(){this.X=this.J}update(t){return this.Y(this.G,t,this.X)}Z(t){if(255&~(t>>24))t+=1<<24;else{let n=t>>16&255,e=t>>8&255,s=255&t;255===n?(n=0,255===e?(e=0,255===s?s=0:++s):++e):++n,t=0,t+=n<<16,t+=e<<8,t+=s}return t}$(t){0===(t[0]=this.Z(t[0]))&&(t[1]=this.Z(t[1]))}Y(t,n,e){let s;if(!(s=n.length))return[];const r=T.bitLength(n);for(let r=0;r<s;r+=4){this.$(e);const s=t.encrypt(e);n[r]^=s[0],n[r+1]^=s[1],n[r+2]^=s[2],n[r+3]^=s[3]}return T.m(n,r)}},at=E._;let ft=et&&rt&&typeof st.importKey==k,ut=et&&rt&&typeof st.deriveBits==k;class lt extends d{constructor({password:t,rawPassword:n,encryptionStrength:e,checkPasswordOnly:s,checkAuthenticationCode:c=!0}){super({start(){ht(this,t,n,e)},async transform(t,n){const e=this,{password:c,strength:i,nt:a,ready:f}=e;c?(await async function(t,n,e,s){const o=await dt(t,n,e,mt(s,0,Z[n])),c=mt(s,Z[n]);if(o[0]!=c[0]||o[1]!=c[1])throw new r(O)}(e,i,c,mt(t,0,Z[i]+2)),t=mt(t,Z[i]+2),s?n.error(new r(N)):a()):await f;const u=new o(t.length-tt-(t.length-tt)%G);n.enqueue(pt(e,t,u,0,tt,!0))},async flush(t){const{et:n,st:e,ot:s,ready:o}=this;if(e&&n){await o;const i=mt(s,0,s.length-tt),a=mt(s,s.length-tt);let f=z;if(i.length){const t=gt(ot,i);e.update(t);const s=n.update(t);f=St(ot,s)}const u=mt(St(ot,e.digest()),0,tt);let l=s.length<tt?1:0;for(let t=0;t<tt;t++)l|=u[t]^a[t];if(l&&c)throw new r(H);t.enqueue(f)}}})}}class wt extends d{constructor({password:t,rawPassword:n,encryptionStrength:e}){super({start(){ht(this,t,n,e)},async transform(t,n){const e=this,{password:s,strength:r,nt:c,ready:i}=e;let a=z;s?(a=await async function(t,n,e){const s=q(new o(Z[n]));return W(s,await dt(t,n,e,s))}(e,r,s),c()):await i;const f=new o(a.length+t.length-t.length%G);f.set(a,0),n.enqueue(pt(e,t,f,a.length,0))},async flush(t){const{et:n,st:e,ot:s,ready:r}=this;if(e&&n){await r;let o=z;if(s.length){const t=n.update(gt(ot,s));e.update(t),o=St(ot,t)}const c=St(ot,e.digest()).slice(0,tt);t.enqueue(W(o,c))}}})}}function ht(t,e,s,r){n.assign(t,{ready:new l(n=>t.nt=n),password:yt(e,s),strength:r-1,ot:z})}function pt(t,n,e,s,r,c){const{et:i,st:a,ot:f}=t;f.length&&(n=W(f,n));const u=n.length-r;let l;for(e=function(t,n){if(n&&n>t.length){const e=t;(t=new o(n)).set(e,0)}return t}(e,s+(u-u%G)),l=0;l<=u-G;l+=G){const t=gt(ot,mt(n,l,l+G));c&&a.update(t);const r=i.update(t);c||a.update(r),e.set(St(ot,r),l+s)}return t.ot=mt(n,l),e}async function dt(e,s,r,c){e.password=null;const i=await async function(t,n,e,s,r){if(!ft)return E.importKey(n);try{return await st.importKey("raw",n,e,!1,r)}catch{return ft=!1,E.importKey(n)}}(0,r,Q,0,Y),a=await async function(t,n,e){if(!ut)return E.T(n,t.salt,X.iterations,e);try{return await st.deriveBits(t,n,e)}catch{return ut=!1,E.T(n,t.salt,X.iterations,e)}}(n.assign({salt:c},X),i,8*(2*$[s]+2)),f=new o(a),u=gt(ot,mt(f,0,$[s])),l=gt(ot,mt(f,$[s],2*$[s])),w=mt(f,2*$[s]);return n.assign(e,{keys:{key:u,ct:l,passwordVerification:w},et:new it(new ct(u),t.from(nt)),st:new at(l)}),w}function yt(t,n){return n===v?function(t){if(typeof w==b){t=unescape(encodeURIComponent(t));const n=new o(t.length);for(let e=0;e<n.length;e++)n[e]=t.charCodeAt(e);return n}return(new w).encode(t)}(t):n}function mt(t,n,e){return t.subarray(n,e)}function St(t,n){return t.v(n)}function gt(t,n){return t.C(n)}class vt extends d{constructor({password:t,rawPassword:n,passwordVerification:e,checkPasswordOnly:s}){super({start(){kt(this,t,n,e)},transform(t,n){const e=this;if(e.password||e.rawPassword){const n=zt(e,t.subarray(0,12));if(e.password=e.rawPassword=null,0!=(n[11]^e.passwordVerification))throw new r(O);t=t.subarray(12)}s?n.error(new r(N)):n.enqueue(zt(e,t))}})}}class bt extends d{constructor({password:t,rawPassword:n,passwordVerification:e}){super({start(){kt(this,t,n,e)},transform(t,n){const e=this;let s,r;if(e.password||e.rawPassword){e.password=e.rawPassword=null;const n=q(new o(12));n[11]=e.passwordVerification,s=new o(t.length+n.length),s.set(Ct(e,n),0),r=12}else s=new o(t.length),r=0;s.set(Ct(e,t),r),n.enqueue(s)}})}}function kt(t,e,s,r){n.assign(t,{password:e,rawPassword:s,passwordVerification:r}),function(t,e,s){const r=[305419896,591751049,878082192];if(n.assign(t,{keys:r,it:new R(r[0]),ft:new R(r[2])}),s)for(let n=0;n<s.length;n++)It(t,s[n]);else for(let n=0;n<e.length;n++)It(t,e.charCodeAt(n))}(t,e,s)}function zt(t,n){const e=new o(n.length);for(let s=0;s<n.length;s++)e[s]=At(t)^n[s],It(t,e[s]);return e}function Ct(t,n){const e=new o(n.length);for(let s=0;s<n.length;s++)e[s]=At(t)^n[s],It(t,n[s]);return e}function It(t,n){let[,e]=t.keys;t.it.append([n]);const r=~t.it.get();e=Mt(s.imul(Mt(e+xt(r)),134775813)+1),t.ft.append([e>>>24]);const o=~t.ft.get();t.keys=[r,e,o]}function At(t){const n=2|t.keys[2];return xt(s.imul(n,1^n)>>>8)}function xt(t){return 255&t}function Mt(t){return 4294967295&t}function Pt(t){if(t instanceof y)return t;const n=t.getReader();return new y({async pull(t){const{value:e,done:s}=await n.read();s?t.close():t.enqueue(e)},cancel:t=>n.cancel(t)})}const Bt=new f;function Dt(t){return Bt.get(t)}const Ft="Invalid uncompressed size",Rt=j,Ut="deflate-raw",Wt="gzip",_t=[31,139,8];class Tt extends d{constructor(t,{chunkSize:n,CompressionStreamFallback:e,CompressionStream:s}){super({});const{compressed:r,encrypted:o,useCompressionStream:c,zipCrypto:i,computeCrc32:a,level:f,deflate64:l,format:w,compressionMethod:h,inputSize:p}=t,d=this;let y,m,S,g=super.readable;const v=w&&Dt(w),b=a&&r&&!l&&!v&&(!o||i)&&Boolean(c&&s);if(o&&!i||!a||b||(y=new U,g=Ht(g,y)),r)if(v)g=Nt(g,Ot(v.CompressionStream,w,{level:f,chunkSize:n,compressionMethod:h,uncompressedSize:p}));else if(b)S=new Vt,g=Nt(g,new s(Wt)),g=Ht(g,S);else try{g=jt(g,c,{level:f,chunkSize:n},s,e)}catch(t){let n;try{n=new s(Wt)}catch{throw t}g=Nt(g,n),g=Ht(g,new Vt)}o&&(i?g=Ht(g,new bt(t)):(m=new wt(t),g=Ht(g,m))),Lt(d,g,()=>{o&&!i||!a||(d.crc32=b?S.crc32:new u(y.value.buffer).getUint32(0))})}}class Vt extends d{constructor(){let t,n=10,e=new o(0);super({transform(t,r){if(n){const e=s.min(n,t.length);if(n-=e,!(t=t.subarray(e)).length)return}const o=e.length+t.length;if(o<=8)return void(e=W(e,t));const c=o-8,i=s.min(c,e.length);r.enqueue(W(e.subarray(0,i),t.subarray(0,c-i))),e=W(e.subarray(i),t.subarray(c-i))},flush(){const n=_(e);t.crc32=n.getUint32(0,!0),t.uncompressedSize=n.getUint32(4,!0)}}),t=this}}class Kt extends d{constructor(t,{chunkSize:n,DecompressionStreamFallback:e,DecompressionStream:s}){super({});const{zipCrypto:c,encrypted:i,checkCrc32:a,crc32:f,compressed:w,useCompressionStream:h,deflate64:p,format:m,compressionMethod:S,rawBitFlag:g,outputSize:b}=t;let k,z,C=super.readable;if(i&&(c?C=Ht(C,new vt(t)):(z=new lt(t),C=Ht(C,z))),w){const t=m&&Dt(m);if(t)C=Nt(C,Ot(t.DecompressionStream,m,{chunkSize:n,compressionMethod:S,rawBitFlag:g,uncompressedSize:b}));else try{C=jt(C,h,{chunkSize:n,deflate64:p},s,e)}catch(t){if(p||b===v)throw t;let n;try{n=new s(Wt)}catch{throw t}C=function(t,n,e){const s=new R;let c,i,a,f=0,u=!1;const w=new l((t,n)=>{i=t,a=n});w.catch(()=>{}),e||i();const h=new d({start(t){const n=new o(10);n.set(_t),t.enqueue(n)},transform(t,n){n.enqueue(t)},async flush(t){u=!0,y();try{await w}finally{m()}const n=new o(8),r=_(n);r.setUint32(0,s.get(),!0),r.setUint32(4,e,!0),t.enqueue(n)},cancel(t){a(t)}}),p=new d({transform(t,n){s.append(t),f+=t.length,f>=e?i():u&&y(),n.enqueue(t)},cancel(t){a(t)}});return t=Ht(t,h),Ht(t=Nt(t,n),p);function y(){m(),c=setTimeout(()=>a(new r(Ft)),5e3)}function m(){clearTimeout(c)}}(C,n,b)}C=function(t){const n=t.getReader();return new y({async pull(t){let e;try{e=await n.read()}catch(t){if(t&&t.message)throw t;const n=new r("Invalid compressed data");throw n.cause=t,n}const{value:s,done:o}=e;o?t.close():t.enqueue(s)},cancel:t=>n.cancel(t)})}(C)}a&&(k=new U,C=Ht(C,k)),Lt(this,C,()=>{if(a){const t=new u(k.value.buffer);if(f!=t.getUint32(0,!1))throw new r(Rt)}})}}const Et=new f;function Lt(t,e,s){e=Ht(e,new d({flush:s})),n.defineProperty(t,"readable",{get:()=>e})}function Ot(t,n,e){if(!t)throw new r("Compression method not supported");return new t(n,e)}function jt(t,n,e,s,r){const o=n&&s?s:r||s,c=e.deflate64?"deflate64-raw":Ut;let i;try{i=new o(c,e)}catch(t){if(!n||!r||o==r)throw t;i=new r(c,e)}return Nt(t,i)}function Ht(t,n){return Pt(t).pipeThrough(n)}function Nt(t,n){const e=n.writable.getWriter(),s=t.getReader();return async function(){try{for(;;){await e.ready;const t=await s.read();if(t.done){await e.close();break}await e.write(t.value)}}catch(t){await async function(t,n){try{await t.abort(n)}catch{}}(e,t),await async function(t,n){try{await t.cancel(n)}catch{}}(s,t)}}(),n.readable}const qt="data",Gt="close",Jt="deflate";class Qt extends d{constructor(t,e){super({});const s=this,{codecType:o}=t;let c;o.startsWith(Jt)?c=Tt:o.startsWith("inflate")&&(c=Kt),s.outputSize=0;let i=0;const a=new c(t,e),f=super.readable,u=new d({transform(t,n){t&&t.length&&(i+=t.length,n.enqueue(t))},flush(){n.assign(s,{inputSize:i})}}),l=new d({transform(n,e){if(n&&n.length&&(e.enqueue(n),s.outputSize+=n.length,t.outputSize!==v&&s.outputSize>t.outputSize))throw new r(Ft)},flush(){const{crc32:t}=a;n.assign(s,{crc32:t,inputSize:i})}});n.defineProperty(s,"readable",{get:()=>f.pipeThrough(u).pipeThrough(a).pipeThrough(l)})}}class Xt extends d{constructor(t){const n=[];let s=0;function r(){const e=new o(t);let r=0;for(;r<t;){const s=n[0],o=t-r;s.length<=o?(e.set(s,r),r+=s.length,n.shift()):(e.set(s.subarray(0,o),r),n[0]=s.subarray(o),r+=o)}return s-=t,e}(!e.isFinite(t)||t<1)&&(t=65536),super({transform(e,o){for(n.push(e),s+=e.length;s>t;)o.enqueue(r())},flush(t){s&&t.enqueue(function(t,n){const e=new o(n);let s=0;for(const n of t)e.set(n,s),s+=n.length;return e}(n,s))}})}}let Yt=2;try{typeof navigator!=b&&navigator.hardwareConcurrency&&(Yt=navigator.hardwareConcurrency)}catch{}const Zt=new f,$t=new f;let tn,nn=0;async function en(t){let n,o;try{const{options:c,config:i}=t;if(c.format)try{await async function(t,n){!Bt.has(t)&&n&&function(t,n){const{CompressionStream:e,DecompressionStream:s}=n;if(typeof e!=k&&typeof s!=k)throw new r("Invalid codec module");Bt.set(t,{CompressionStream:e,DecompressionStream:s})}(t,await(import(n)))}(c.format,c.codecURI)}catch(t){throw t.codecImportFailed=!0,t}if(i.CompressionStream=self.CompressionStream,i.DecompressionStream=self.DecompressionStream,c.compressed&&!c.format)if(c.useCompressionStream){if(!function(t,n){if(!t)return!1;let e=Et.get(t);e||(e=new f,Et.set(t,e));let s=e.get(n);if(s===v){try{new t(n),s=!0}catch{s=!1}e.set(n,s)}return s}(c.codecType.startsWith(Jt)?i.CompressionStream:i.DecompressionStream,Ut))try{await self.initModule(t.config)}catch{}}else try{await self.initModule(t.config)}catch{c.useCompressionStream=!0}!i.CompressionStreamFallback&&i.CompressionStreamZlib&&(i.CompressionStreamFallback=i.CompressionStreamZlib),!i.DecompressionStreamFallback&&i.DecompressionStreamZlib&&(i.DecompressionStreamFallback=i.DecompressionStreamZlib);const a={highWaterMark:1},u=t.readable?Pt(t.readable):new y({async pull(t){const n=new l(t=>Zt.set(nn,t));sn({type:"pull",messageId:nn}),nn=(nn+1)%e.MAX_SAFE_INTEGER;const{value:s,done:r}=await n;t.enqueue(s),r&&t.close()}},a);o=t.writable?function(t){if(t instanceof m)return t;const n=t.getWriter();return new m({write:t=>n.write(t),close:()=>n.close(),abort:t=>n.abort(t)})}(t.writable):new m({async write(t){let n;const s=new l(t=>n=t);$t.set(nn,n),sn({type:qt,value:t,messageId:nn}),nn=(nn+1)%e.MAX_SAFE_INTEGER,await s}},a),n=new Qt(c,i),tn=new AbortController;const{signal:w}=tn;await u.pipeThrough(n).pipeThrough(new Xt(function(t){return r="string"==typeof(n=r=t.chunkSize)&&n.trim()?e(n):n,e.isInteger(r)&&r>=1?s.max(r,64):65536;var n,r}(i))).pipeTo(o,{signal:w,preventClose:!0,preventAbort:!0}),await o.getWriter().close();const{crc32:h,inputSize:p,outputSize:d}=n;sn({type:Gt,result:{crc32:h,inputSize:p,outputSize:d}})}catch(t){if(t.outputSize=n?n.outputSize:0,o&&!o.locked)try{await o.getWriter().close()}catch{}rn(t)}}function sn(t){const{value:n}=t;if(n)if(n.length)try{t.value=(e=n,e.byteOffset||e.byteLength!=e.buffer.byteLength?new o(e):e).buffer,p(t,[t.value])}catch{p(t)}else p(t);else p(t);var e}function rn(t=new r("Unknown error")){const{message:n,stack:e,code:s,name:o,outputSize:c,cause:i,codecImportFailed:a}=t,f={message:n,stack:e,code:s,name:o,outputSize:c};i&&(f.cause={name:i.name,message:i.message}),a&&(f.codecImportFailed=!0),p({error:f})}addEventListener("message",({data:t})=>{const{type:n,messageId:e,value:s,done:r}=t;try{if("start"==n&&en(t),n==qt){const t=Zt.get(e);Zt.delete(e),t({value:s||new o,done:r})}if("ack"==n){const t=$t.get(e);$t.delete(e),t()}n==Gt&&tn.abort()}catch(t){rn(t)}}),p({type:"ready"});const on="deflate",cn="deflate-raw",an="deflate64-raw",fn="gzip";let un,ln,wn,hn,pn;function dn(t,n,e={}){if(!un){const t=new r("WASM module not loaded");throw t.cause=pn,t}const c="number"==typeof e.level?e.level:-1,i="number"==typeof e.outBuffer?e.outBuffer:65536,a="number"==typeof e.inBufferSize?e.inBufferSize:65536;return new d({start(){try{let e;if(this.ut=ln(i),this.in=ln(a),this.inBufferSize=a,!this.ut||!this.in)throw new r("allocation failed");if(this.lt=new o(i),t?(this.wt=un.deflate_process,this.ht=un.deflate_last_consumed,this.yt=un.deflate_end,this.St=un.deflate_new(),e=n===fn?un.deflate_init_gzip(this.St,c):n===cn?un.deflate_init_raw(this.St,c):un.deflate_init(this.St,c)):n===an?(this.wt=un.inflate9_process,this.ht=un.inflate9_last_consumed,this.yt=un.inflate9_end,this.St=un.inflate9_new(),e=un.inflate9_init_raw(this.St)):(this.wt=un.inflate_process,this.ht=un.inflate_last_consumed,this.yt=un.inflate_end,this.St=un.inflate_new(),e=n===cn?un.inflate_init_raw(this.St):n===fn?un.inflate_init_gzip(this.St):un.inflate_init(this.St)),0!==e)throw new r("init failed:"+e)}catch(t){throw f(this),t}},transform(n,e){try{const c=n,a=new o(hn.buffer),f=this.wt,u=this.ht,l=this.ut,w=this.lt;let h=0;for(;h<c.length;){const n=s.min(c.length-h,32768);if((!this.in||this.inBufferSize<n)&&(this.in&&wn&&(wn(this.in),this.in=0),this.in=ln(n),this.inBufferSize=n,!this.in))throw new r("allocation failed");a.set(c.subarray(h,h+n),this.in);const o=f(this.St,this.in,n,l,i,0),p=16777215&o;if(p&&(w.set(a.subarray(l,l+p),0),e.enqueue(w.slice(0,p))),!t){const t=o>>24&255,n=128&t?t-256:t;if(n<0)throw new r("process error:"+n)}const d=u(this.St);if(0===d)break;h+=d}}catch(t){f(this),e.error(t)}},flush(n){try{const e=new o(hn.buffer),s=this.wt,c=this.ut,a=this.lt;for(;;){const o=s(this.St,0,0,c,i,4),f=16777215&o,u=o>>24&255;if(!t){const t=128&u?u-256:u;if(t<0)throw new r("process error:"+t)}if(f&&(a.set(e.subarray(c,c+f),0),n.enqueue(a.slice(0,f))),1===u||0===f)break}}catch(t){n.error(t)}finally{const t=f(this);0!==t&&n.error(new r("end error:"+t))}},cancel(){f(this)}});function f(t){let n=0;return t.St&&t.yt&&(n=t.yt(t.St)),t.St=0,t.in&&wn&&wn(t.in),t.in=0,t.ut&&wn&&wn(t.ut),t.ut=0,n}}class yn{constructor(t=on,n){return dn(!0,t,n)}}class mn{constructor(t=on,n){return dn(!1,t,n)}}yn.gt=!0,mn.gt=!0,yn.vt=[on,cn,fn],mn.vt=[on,cn,fn,an];let Sn=!1;!function(t={}){const{init:n}=t,e=t.CompressionStreamFallback||t.CompressionStreamZlib,s=t.DecompressionStreamFallback||t.DecompressionStreamZlib;self.initModule=async t=>{n&&await n(t),e&&(t.CompressionStreamFallback=e),s&&(t.DecompressionStreamFallback=s)}}({CompressionStreamFallback:yn,DecompressionStreamFallback:mn,init:t=>async function(t,{baseURI:n}){if(!Sn)try{await async function(t,n){let e,s;try{try{s=new URL(t,n)}catch{}const r=await fetch(s);e=await r.arrayBuffer()}catch(n){if(!t.startsWith("data:application/wasm;base64,"))throw n;e=function(t){const n=t.split(",")[1],e=atob(n),s=e.length,r=new o(s);for(let t=0;t<s;++t)r[t]=e.charCodeAt(t);return r.buffer}(t)}!function(t){if(un=t,({malloc:ln,free:wn,memory:hn}=un),"function"!=typeof ln||"function"!=typeof wn||!hn)throw un=ln=wn=hn=null,new r("Invalid WASM module")}((await WebAssembly.instantiate(e)).instance.exports)}(t,n),Sn=!0}catch(t){throw function(t){pn=t}(t),t}}(t.wasmURI,t)})});\n';
  if ("string" == typeof s2 && (s2 = new TextEncoder().encode(s2)), t4) {
    const t5 = new Blob([s2], { type: n3 });
    return URL.createObjectURL(t5);
  }
  return "data:" + n3 + ";base64," + (function(t5) {
    let n4 = "";
    const s3 = t5.length;
    let r2 = 0;
    for (; r2 + 2 < s3; r2 += 3) {
      const s4 = t5[r2] << 16 | t5[r2 + 1] << 8 | t5[r2 + 2];
      n4 += e[s4 >> 18 & 63] + e[s4 >> 12 & 63] + e[s4 >> 6 & 63] + e[63 & s4];
    }
    const o = s3 - r2;
    if (1 === o) {
      const s4 = t5[r2] << 16;
      n4 += e[s4 >> 18 & 63] + e[s4 >> 12 & 63] + "==";
    } else if (2 === o) {
      const s4 = t5[r2] << 16 | t5[r2 + 1] << 8;
      n4 += e[s4 >> 18 & 63] + e[s4 >> 12 & 63] + e[s4 >> 6 & 63] + "=";
    }
    return n4;
  })(s2);
} });

// node_modules/@zip.js/zip.js/lib/core/codec-worker-web.js
var MODULE_WORKER_OPTIONS = { type: "module" };
var ERROR_EVENT_TYPE = "error";
var MESSAGE_ERROR_EVENT_TYPE = "messageerror";
var webWorkerSource;
var webWorkerURI;
var webWorkerOptions;
var transferStreamsSupported = true;
try {
  transferStreamsSupported = typeof structuredClone == FUNCTION_TYPE && structuredClone(new DOMException("", "AbortError")).code !== UNDEFINED_VALUE;
} catch {
}
setWebWorkerBackend(createWebWorkerInterface);
function createWebWorkerInterface(workerData, config) {
  const { baseURI, chunkSize, workerStartupTimeout } = config;
  let { wasmURI } = config;
  if (!workerData.interface) {
    if (typeof wasmURI == FUNCTION_TYPE) {
      wasmURI = wasmURI();
    }
    let worker;
    try {
      worker = getWebWorker(workerData.workerURI, baseURI, workerData);
    } catch {
      disableWebWorker(workerData);
      return createWorkerInterface(workerData, config);
    }
    Object.assign(workerData, {
      worker,
      workerAlive: false,
      terminated: false,
      startupError: null,
      interface: {
        run: async () => {
          try {
            return await runWebWorker(workerData, { chunkSize, wasmURI, baseURI, workerStartupTimeout });
          } catch (error) {
            if (error && error.workerStartupFailed) {
              disableWebWorker(workerData);
              releaseWorkerStreams(workerData);
              return runWorker(workerData, config);
            }
            if (error && error.codecImportFailed) {
              if (workerData.reader) {
                releaseWorkerStreams(workerData);
                return runWorker(workerData, config);
              }
              workerData.onTaskFinished();
            }
            throw error;
          }
        }
      }
    });
  }
  return workerData.interface;
}
async function runWebWorker(workerData, config) {
  if (!workerData.worker) {
    const { startupError } = workerData;
    workerData.startupError = null;
    const error = startupError || new Error(ERR_WORKER_STARTUP_TIMEOUT);
    error.workerStartupFailed = true;
    throw error;
  }
  let resolveResult, rejectResult;
  const result = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  Object.assign(workerData, {
    reader: null,
    writer: null,
    resolveResult,
    rejectResult,
    result
  });
  const { readable, options } = workerData;
  const { writable, closed, abortPipe } = watchClosedStream(workerData.writable);
  let streamsTransferred;
  try {
    streamsTransferred = sendMessage({
      type: MESSAGE_START,
      options,
      config,
      readable,
      writable
    }, workerData);
  } catch (error) {
    abortPipe();
    try {
      await closed;
    } catch {
    }
    workerData.onTaskFinished();
    throw error;
  }
  if (!streamsTransferred) {
    Object.assign(workerData, {
      reader: readable.getReader(),
      writer: writable.getWriter()
    });
  }
  const { workerStartupTimeout } = config;
  if (!workerData.workerAlive && Number.isFinite(workerStartupTimeout) && workerStartupTimeout >= 0) {
    workerData.startupTimeout = setTimeout(() => onStartupTimeout(workerData), workerStartupTimeout);
  }
  try {
    const resultValue = await result;
    await closeWritable();
    await closed;
    return resultValue;
  } catch (error) {
    await closeWritable();
    abortPipe();
    try {
      await closed;
    } catch {
    }
    throw error;
  }
  async function closeWritable() {
    if (!streamsTransferred && !writable.locked) {
      try {
        await writable.getWriter().close();
      } catch {
      }
    }
  }
}
function watchClosedStream(writableSource) {
  const abortController = new AbortController();
  const { writable, readable } = new TransformStream();
  const closed = readable.pipeTo(writableSource, { preventClose: true, preventAbort: true, signal: abortController.signal });
  closed.catch(() => {
  });
  return { writable, closed, abortPipe: () => abortController.abort() };
}
function releaseWorkerStreams(workerData) {
  const { reader } = workerData;
  if (reader) {
    reader.releaseLock();
  }
  workerData.reader = null;
  workerData.writer = null;
}
function terminateWorker(workerData) {
  const { worker } = workerData;
  if (worker) {
    try {
      worker.terminate();
    } catch {
    }
  }
  workerData.interface = null;
}
function getWebWorker(url, baseURI, workerData, isModuleType, useBlobURI = true) {
  const { createWorker } = workerData;
  let worker, resolvedURI, resolvedOptions;
  if (createWorker) {
    worker = createWorker();
  } else if (webWorkerURI === UNDEFINED_VALUE || webWorkerSource !== url) {
    const isFunctionURI = typeof url == FUNCTION_TYPE;
    if (isFunctionURI) {
      resolvedURI = url(useBlobURI);
    } else {
      resolvedURI = url;
    }
    const isDataURI = resolvedURI.startsWith("data:");
    const isBlobURI = resolvedURI.startsWith("blob:");
    if (isDataURI || isBlobURI) {
      if (isModuleType === UNDEFINED_VALUE) {
        isModuleType = false;
      }
      if (isModuleType) {
        resolvedOptions = MODULE_WORKER_OPTIONS;
      }
      try {
        worker = new Worker(resolvedURI, resolvedOptions);
      } catch (error) {
        if (isBlobURI) {
          try {
            URL.revokeObjectURL(resolvedURI);
          } catch {
          }
        }
        if (isFunctionURI && isBlobURI) {
          return getWebWorker(url, baseURI, workerData, isModuleType, false);
        } else if (!isModuleType) {
          return getWebWorker(url, baseURI, workerData, true, false);
        } else {
          throw error;
        }
      }
    } else {
      if (isModuleType === UNDEFINED_VALUE) {
        isModuleType = true;
      }
      if (isModuleType) {
        resolvedOptions = MODULE_WORKER_OPTIONS;
      }
      try {
        resolvedURI = new URL(resolvedURI, baseURI);
      } catch {
      }
      try {
        worker = new Worker(resolvedURI, resolvedOptions);
      } catch (error) {
        if (isModuleType) {
          return getWebWorker(url, baseURI, workerData, false, useBlobURI);
        } else {
          throw error;
        }
      }
    }
    webWorkerSource = url;
    webWorkerURI = resolvedURI;
    webWorkerOptions = resolvedOptions;
  } else {
    worker = new Worker(webWorkerURI, webWorkerOptions);
  }
  worker.addEventListener(MESSAGE_EVENT_TYPE, (event) => {
    workerData.workerAlive = true;
    clearStartupTimeout(workerData);
    onMessage(event, workerData);
  });
  worker.addEventListener(ERROR_EVENT_TYPE, (event) => onWorkerError(event, workerData));
  worker.addEventListener(MESSAGE_ERROR_EVENT_TYPE, (event) => onWorkerError(event, workerData));
  return worker;
}
function onStartupTimeout(workerData) {
  workerData.startupTimeout = null;
  if (workerData.workerAlive) {
    return;
  }
  const { rejectResult, writer } = workerData;
  terminateWorker(workerData);
  workerData.worker = null;
  if (rejectResult) {
    const error = new Error(ERR_WORKER_STARTUP_TIMEOUT);
    error.workerStartupFailed = true;
    rejectResult(error);
    if (writer) {
      writer.releaseLock();
    }
  }
}
function clearStartupTimeout(workerData) {
  const { startupTimeout } = workerData;
  if (startupTimeout) {
    clearTimeout(startupTimeout);
    workerData.startupTimeout = null;
  }
}
function onWorkerError(event, workerData) {
  if (event.preventDefault) {
    event.preventDefault();
  }
  clearStartupTimeout(workerData);
  const { workerAlive, rejectResult, writer, onTaskFinished } = workerData;
  terminateWorker(workerData);
  if (!workerAlive) {
    workerData.worker = null;
  }
  let error = event.error || new Error(event.message || ERROR_EVENT_TYPE);
  if (!workerAlive) {
    error = Object.assign(new Error(error.message || ERROR_EVENT_TYPE), { workerStartupFailed: true });
    workerData.startupError = error;
  }
  if (rejectResult) {
    rejectResult(error);
    if (writer) {
      writer.releaseLock();
    }
    if (workerAlive) {
      onTaskFinished();
    }
  }
}
function sendMessage(message, { worker, writer, transferStreams, workerAlive }) {
  try {
    const { value, readable, writable } = message;
    const transferables = [];
    if (value) {
      message.value = toExactUint8Array(value);
      transferables.push(message.value.buffer);
    }
    if (transferStreams && transferStreamsSupported && workerAlive) {
      if (readable) {
        transferables.push(readable);
      }
      if (writable) {
        transferables.push(writable);
      }
    } else {
      message.readable = message.writable = null;
    }
    if (transferables.length) {
      try {
        worker.postMessage(message, transferables);
        return true;
      } catch {
        transferStreamsSupported = false;
        message.readable = message.writable = null;
        worker.postMessage(message);
      }
    } else {
      worker.postMessage(message);
    }
  } catch (error) {
    if (writer) {
      writer.releaseLock();
    }
    throw error;
  }
}
async function onMessage({ data }, workerData) {
  const { type, value, messageId, result, error } = data;
  const { reader, writer, resolveResult, rejectResult, onTaskFinished, generation } = workerData;
  const stale = () => workerData.generation != generation;
  try {
    if (error) {
      const { message, stack, code, name, outputSize, cause, codecImportFailed } = error;
      const responseError = new Error(message);
      Object.assign(responseError, { stack, code, name, outputSize });
      if (cause) {
        responseError.cause = Object.assign(new Error(cause.message), { name: cause.name });
      }
      if (codecImportFailed) {
        responseError.codecImportFailed = true;
      }
      close(responseError);
    } else {
      if (type == MESSAGE_PULL) {
        const { value: value2, done } = await reader.read();
        if (!stale()) {
          sendMessage({ type: MESSAGE_DATA, value: value2, done, messageId }, workerData);
        }
      }
      if (type == MESSAGE_DATA) {
        await writer.ready;
        await writer.write(new Uint8Array(value));
        if (!stale()) {
          sendMessage({ type: MESSAGE_ACK_DATA, messageId }, workerData);
        }
      }
      if (type == MESSAGE_CLOSE) {
        close(null, result);
      }
    }
  } catch (error2) {
    if (!stale()) {
      terminateWorker(workerData);
      close(error2);
    }
  }
  function close(error2, result2) {
    if (stale()) {
      return;
    }
    if (error2) {
      rejectResult(error2);
    } else {
      resolveResult(result2);
    }
    if (writer) {
      writer.releaseLock();
    }
    if (!(error2 && error2.codecImportFailed)) {
      onTaskFinished();
    }
  }
}

// node_modules/@zip.js/zip.js/lib/core/zip-writer.js
var ERR_DUPLICATED_NAME = "File already exists";
var ERR_INVALID_COMMENT = "Zip file comment exceeds 64KB";
var ERR_INVALID_COMMENT_TYPE = "Invalid zip file comment (must be a Uint8Array)";
var ERR_INVALID_ENTRY_COMMENT = "File entry comment exceeds 64KB";
var ERR_INVALID_ENTRY_COMMENT_TYPE = "Invalid file entry comment (must be a string)";
var ERR_INVALID_DATE = "Invalid date (must be a valid Date instance)";
var ERR_INVALID_ENTRY_NAME = "File entry name exceeds 64KB";
var ERR_INVALID_VERSION = "Version exceeds 65535";
var ERR_INVALID_ENCRYPTION_STRENGTH = "The strength must equal 1, 2, or 3";
var ERR_UNSUPPORTED_ENCRYPTION_USDZ = "Encryption is not supported in USDZ files";
var ERR_UNSUPPORTED_ENCRYPTION_PASS_THROUGH = "Encryption is not supported when the 'passThrough' option is set";
var ERR_INVALID_EXTRAFIELD = "Invalid extra field (must be a Map)";
var ERR_INVALID_EXTRAFIELD_TYPE = "Invalid extra field type (must be integer 0..65535)";
var ERR_INVALID_EXTRAFIELD_DATA_TYPE = "Invalid extra field data (must be a Uint8Array)";
var ERR_INVALID_EXTRAFIELD_DATA = "Extra field data exceeds 64KB";
var ERR_UNSUPPORTED_COMPRESSION2 = "Compression method not supported";
var MIN_UNIX_TIME = -2147483648;
var MAX_UNIX_TIME = 2147483647;
var MIN_NTFS_TIME = BigInt(0);
var MAX_NTFS_TIME = BigInt("0x7fffffffffffffff");
var ERR_UNSUPPORTED_FORMAT = "Zip64 is not supported (set the 'zip64' option to 'true')";
var ERR_UNDEFINED_UNCOMPRESSED_SIZE = "Undefined uncompressed size";
var ERR_UNDEFINED_COMPRESSION_METHOD = "Undefined compression method";
var ERR_UNDETERMINED_SIZE = "Undetermined size";
var ERR_UNDEFINED_READER = "Undefined reader";
var ERR_ZIP_NOT_EMPTY = "Zip file not empty";
var ERR_INVALID_UID = "Invalid uid (must be integer 0..2^32-1)";
var ERR_INVALID_GID = "Invalid gid (must be integer 0..2^32-1)";
var ERR_INVALID_UNIX_MODE = "Invalid UNIX mode (must be integer 0..65535)";
var ERR_INVALID_UNIX_EXTRA_FIELD_TYPE = "Invalid unixExtraFieldType (must be 'infozip' or 'unix')";
var ERR_INVALID_UNIX_ID_SIZE = "uid/gid must be 0..65535 for unixExtraFieldType 'unix' (use 'infozip' for larger ids)";
var ERR_INVALID_MSDOS_ATTRIBUTES = "Invalid msdosAttributesRaw (must be integer 0..255)";
var ERR_INVALID_MSDOS_DATA = "Invalid msdosAttributes (must be an object with boolean flags)";
var ERR_INVALID_LEVEL = "Invalid level (must be integer 0..9)";
var ERR_INVALID_SIGNATURE_DATA = "Signature data exceeds 64KB";
var EXTRAFIELD_DATA_AES = new Uint8Array([7, 0, 2, 0, 65, 69, 3, 0, 0]);
var EXTRAFIELD_OFFSET_AES_VENDOR_VERSION = 4;
var EXTRAFIELD_OFFSET_AES_COMPRESSION_METHOD = 9;
var EXTRAFIELD_USDZ_MAX_LENGTH = 67;
var VENDOR_VERSION_AE_1 = 1;
var INFOZIP_EXTRA_FIELD_TYPE = "infozip";
var UNIX_EXTRA_FIELD_TYPE = "unix";
var MAX_LEVEL = 9;
var workers = 0;
var pendingEntries = [];
var ZipWriter = class {
  constructor(writer, options = {}) {
    writer = new GenericWriter(writer);
    const { availableSize = INFINITY_VALUE, maxSize = INFINITY_VALUE } = writer;
    const addSplitZipSignature = availableSize > 0 && availableSize !== INFINITY_VALUE && maxSize > 0 && maxSize !== INFINITY_VALUE;
    Object.assign(this, {
      writer,
      addSplitZipSignature,
      options,
      fileEntries: /* @__PURE__ */ new Map(),
      filenames: /* @__PURE__ */ new Set(),
      offset: options[OPTION_OFFSET] === UNDEFINED_VALUE ? writer.size || writer.writable.size || 0 : options[OPTION_OFFSET],
      initialOffset: options[OPTION_OFFSET] === UNDEFINED_VALUE ? 0 : options[OPTION_OFFSET] - (writer.size || writer.writable.size || 0),
      pendingAddFileCalls: /* @__PURE__ */ new Set(),
      pendingErrors: [],
      bufferedWrites: 0,
      lastFileEntry: UNDEFINED_VALUE
    });
  }
  prependZip(reader) {
    return watchPromiseError(this, prependZipEntries(this, reader));
  }
  appendZip(reader) {
    return watchPromiseError(this, this.appendZipEntries(reader));
  }
  async appendZipEntries(reader) {
    const zipWriter = this;
    const { pendingAddFileCalls, filenames, fileEntries } = zipWriter;
    while (pendingAddFileCalls.size) {
      await Promise.allSettled(Array.from(pendingAddFileCalls));
    }
    let resolveAppendZip;
    const promiseAppendZip = new Promise((resolve) => resolveAppendZip = resolve);
    pendingAddFileCalls.add(promiseAppendZip);
    const appendedFilenames = [];
    let releaseLockWriter;
    try {
      reader = new GenericReader(reader);
      await initStream(reader);
      if (reader.size === UNDEFINED_VALUE || !reader.readUint8Array) {
        reader = new BlobReader(await streamToBlob(reader.readable));
        await initStream(reader);
      }
      const { ZipReader: ZipReader2 } = await import("./zip-reader-YA4FT6BJ.js");
      const zipReader = new ZipReader2(reader);
      const entries = await zipReader.getEntries();
      await zipReader.close();
      await initStream(zipWriter.writer);
      const { directoryOffset } = zipReader;
      entries.forEach(({ filename }) => {
        if (filenames.has(filename)) {
          throw new Error(ERR_DUPLICATED_NAME);
        }
        filenames.add(filename);
        appendedFilenames.push(filename);
      });
      zipWriter.writerLocked = true;
      const { lockWriter } = zipWriter;
      zipWriter.lockWriter = new Promise((resolve) => releaseLockWriter = () => {
        zipWriter.writerLocked = false;
        resolve();
      });
      await lockWriter;
      if (zipWriter.addSplitZipSignature) {
        delete zipWriter.addSplitZipSignature;
        if (!await startsWithSplitZipSignature(reader)) {
          await writeData(zipWriter.writer, getSplitZipSignatureArray());
          zipWriter.offset += SPLIT_ZIP_FILE_SIGNATURE_LENGTH;
        }
      }
      const entryPositions = await copyZipData(zipWriter, reader, entries, directoryOffset);
      entries.forEach((entry) => {
        const {
          version,
          rawLastModDate,
          rawFilename,
          bitFlag,
          encrypted,
          uncompressedSize,
          compressedSize,
          extraFieldZip64
        } = entry;
        let {
          compressionMethod,
          rawExtraField
        } = entry;
        const { level, languageEncodingFlag, dataDescriptor } = bitFlag;
        rawExtraField = removeExtraFieldZip64(rawExtraField || EMPTY_UINT8_ARRAY);
        if (entry.extraFieldAES) {
          compressionMethod = COMPRESSION_METHOD_AES;
        }
        const extraFieldLength = getLength(rawExtraField);
        const zip64UncompressedSize = Boolean(extraFieldZip64) && extraFieldZip64.uncompressedSize !== UNDEFINED_VALUE;
        const zip64CompressedSize = Boolean(extraFieldZip64) && extraFieldZip64.compressedSize !== UNDEFINED_VALUE;
        const bitFlagValue = getBitFlag(level, languageEncodingFlag, dataDescriptor, encrypted, compressionMethod) & ~BITFLAG_LEVEL | level << 1;
        const {
          headerArray,
          headerView
        } = getHeaderArrayData({
          version,
          bitFlag: bitFlagValue,
          compressionMethod,
          uncompressedSize,
          compressedSize,
          rawLastModDate,
          rawFilename,
          zip64CompressedSize,
          zip64UncompressedSize,
          extraFieldLength
        });
        const { crc32 } = entry;
        if (crc32 !== UNDEFINED_VALUE) {
          setUint32(headerView, HEADER_OFFSET_SIGNATURE, crc32);
        }
        const { offset, diskNumberStart } = entryPositions.get(entry);
        Object.assign(entry, {
          zip64UncompressedSize,
          zip64CompressedSize,
          offset,
          diskNumberStart,
          zip64DiskNumberStart: false,
          rawExtraFieldZip64: EMPTY_UINT8_ARRAY,
          rawExtraFieldAES: EMPTY_UINT8_ARRAY,
          rawExtraFieldExtendedTimestamp: EMPTY_UINT8_ARRAY,
          rawExtraFieldNTFS: EMPTY_UINT8_ARRAY,
          rawExtraFieldUnix: EMPTY_UINT8_ARRAY,
          rawExtraField,
          rawCentralExtraField: EMPTY_UINT8_ARRAY,
          extendedTimestamp: false,
          headerArray,
          headerView
        });
        fileEntries.set(entry.filename, entry);
      });
    } catch (error) {
      appendedFilenames.forEach((filename) => filenames.delete(filename));
      throw error;
    } finally {
      resolveAppendZip();
      pendingAddFileCalls.delete(promiseAppendZip);
      if (releaseLockWriter) {
        releaseLockWriter();
      }
    }
  }
  add(name = "", reader, options = {}) {
    const zipWriter = this;
    const { pendingAddFileCalls } = zipWriter;
    const promiseAddFile = addFileEntry(zipWriter, name, reader, options);
    pendingAddFileCalls.add(promiseAddFile);
    const deletePendingAddFileCall = () => pendingAddFileCalls.delete(promiseAddFile);
    Promise.prototype.then.call(promiseAddFile, deletePendingAddFileCall, deletePendingAddFileCall);
    return watchPromiseError(zipWriter, promiseAddFile);
  }
  remove(entry) {
    const { filenames, fileEntries } = this;
    if (typeof entry == STRING_TYPE) {
      entry = fileEntries.get(entry);
    }
    if (entry && entry.filename !== UNDEFINED_VALUE) {
      const { filename } = entry;
      if (filenames.has(filename) && fileEntries.has(filename)) {
        filenames.delete(filename);
        fileEntries.delete(filename);
        return true;
      }
    }
    return false;
  }
  async close(comment = EMPTY_UINT8_ARRAY, options = {}) {
    const zipWriter = this;
    const { pendingAddFileCalls, writer } = this;
    const { writable } = writer;
    if (!(comment instanceof Uint8Array)) {
      throw new Error(ERR_INVALID_COMMENT_TYPE);
    }
    if (getLength(comment) > MAX_16_BITS) {
      throw new Error(ERR_INVALID_COMMENT);
    }
    while (pendingAddFileCalls.size) {
      await Promise.allSettled(Array.from(pendingAddFileCalls));
    }
    await Promise.allSettled(zipWriter.pendingErrors.map((watcher) => watcher.recorded));
    const unobservedWatchers = zipWriter.pendingErrors.filter((watcher) => watcher.error && !watcher.observed);
    if (unobservedWatchers.length) {
      const unobservedErrors = unobservedWatchers.map((watcher) => watcher.error);
      unobservedWatchers.forEach((watcher) => watcher.observed = true);
      const [error] = unobservedErrors;
      try {
        error.entryErrors = unobservedErrors;
      } catch {
      }
      throw error;
    }
    await closeFile(zipWriter, comment, options);
    const preventClose = !ownsWritable(writer) && getOptionValue(zipWriter, options, OPTION_PREVENT_CLOSE);
    if (!preventClose) {
      await writable.getWriter().close();
    }
    return writer.getData ? writer.getData() : writable;
  }
};
var ZipWriterStream = class {
  constructor(options = {}) {
    const { readable, writable } = new TransformStream();
    this.readable = readable;
    this.zipWriter = new ZipWriter(writable, options);
    this.pendingAddFileCalls = /* @__PURE__ */ new Set();
  }
  transform(path) {
    const zipWriter = this.zipWriter;
    let streamController;
    const { readable, writable } = new TransformStream({
      start(controller) {
        streamController = controller;
      },
      flush: () => void closeArchive()
    });
    watchAddFileCall(this, this.zipWriter.add(path, readable), (error) => streamController.error(error));
    return { readable: this.readable, writable };
    async function closeArchive() {
      try {
        await zipWriter.close();
      } catch (error) {
        await abortWritable(zipWriter, error);
      }
    }
  }
  writable(path) {
    let streamController;
    const { readable, writable } = new TransformStream({
      start(controller) {
        streamController = controller;
      }
    });
    watchAddFileCall(this, this.zipWriter.add(path, readable), (error) => streamController.error(error));
    return writable;
  }
  async close(comment = UNDEFINED_VALUE, options = {}) {
    const { zipWriter } = this;
    const results = await Promise.allSettled(Array.from(this.pendingAddFileCalls));
    const entryErrors = results.filter((result) => result.status == "rejected").map((result) => result.reason);
    if (entryErrors.length) {
      const [error] = entryErrors;
      try {
        error.entryErrors = entryErrors;
      } catch {
      }
      await abortWritable(zipWriter, error);
      throw error;
    }
    try {
      return await zipWriter.close(comment, options);
    } catch (error) {
      await abortWritable(zipWriter, error);
      throw error;
    }
  }
};
var WatchedPromise = class extends Promise {
  then(onFulfilled, onRejected) {
    const { watcher } = this;
    if (watcher) {
      watcher.observed = true;
    }
    return super.then(onFulfilled, onRejected);
  }
};
function watchPromiseError(zipWriter, promise) {
  const watchedPromise = new WatchedPromise((resolve, reject) => Promise.prototype.then.call(promise, resolve, reject));
  const watcher = {};
  watchedPromise.watcher = watcher;
  watcher.recorded = Promise.prototype.then.call(watchedPromise, UNDEFINED_VALUE, (error) => watcher.error = error);
  zipWriter.pendingErrors.push(watcher);
  return watchedPromise;
}
async function prependZipEntries(zipWriter, reader) {
  if (zipWriter.filenames.size) {
    throw new Error(ERR_ZIP_NOT_EMPTY);
  }
  await zipWriter.appendZipEntries(reader);
}
async function addFileEntry(zipWriter, name, reader, options) {
  options = Object.assign({}, options);
  if (getOptionValue(zipWriter, options, PROPERTY_NAME_DIRECTORY) && !name.endsWith(DIRECTORY_SIGNATURE)) {
    name += DIRECTORY_SIGNATURE;
  }
  if (zipWriter.filenames.has(name)) {
    throw new Error(ERR_DUPLICATED_NAME);
  }
  zipWriter.filenames.add(name);
  if (workers < getConfiguration().maxWorkers) {
    workers++;
  } else {
    await new Promise((resolve) => pendingEntries.push(resolve));
  }
  try {
    return await addFile(zipWriter, name, reader, options);
  } catch (error) {
    zipWriter.filenames.delete(name);
    throw error;
  } finally {
    const pendingEntry = pendingEntries.shift();
    if (pendingEntry) {
      pendingEntry();
    } else {
      workers--;
    }
  }
}
async function abortWritable(zipWriter, error) {
  try {
    await zipWriter.writer.writable.abort(error);
  } catch {
  }
}
function watchAddFileCall(zipWriterStream, promiseAddFile, onerror) {
  zipWriterStream.pendingAddFileCalls.add(promiseAddFile);
  promiseAddFile.catch((error) => {
    try {
      onerror(error);
    } catch {
    }
  });
}
async function addFile(zipWriter, name, reader, options) {
  const attributesInfo = resolveAttributes(zipWriter, name, options);
  ({ name } = attributesInfo);
  const metadataInfo = resolveMetadata(zipWriter, name, options);
  const { comment } = metadataInfo;
  const extraField = options[PROPERTY_NAME_EXTRA_FIELD];
  zipWriter.fileEntries.set(name, UNDEFINED_VALUE);
  const previousFileEntry = zipWriter.lastFileEntry;
  const pendingFileEntry = {};
  let releaseLockFileEntry;
  if (metadataInfo.resolvedOptions.keepOrder) {
    pendingFileEntry.lockFileEntry = new Promise((resolve) => releaseLockFileEntry = resolve);
  }
  zipWriter.lastFileEntry = pendingFileEntry;
  let fileEntry;
  try {
    const { resolvedOptions } = metadataInfo;
    if (resolvedOptions.level != 0 && resolvedOptions.compressionMethod === UNDEFINED_VALUE && !resolvedOptions.passThrough && !await supportsDeflate(getConfiguration())) {
      resolvedOptions.level = 0;
    }
    const sizesInfo = await resolveSizes(zipWriter, reader, metadataInfo, options);
    ({ reader } = sizesInfo);
    const diskOffset = getDiskOffset(zipWriter.writer);
    const diskNumber = getDiskNumber(zipWriter.writer);
    options = Object.assign({}, options, attributesInfo.resolvedOptions, metadataInfo.resolvedOptions, sizesInfo.resolvedOptions, {
      signature: options[PROPERTY_NAME_SIGNATURE],
      crc32: options.crc32 === UNDEFINED_VALUE ? options[PROPERTY_NAME_SIGNATURE] : options.crc32,
      offset: zipWriter.offset - diskOffset,
      diskNumberStart: diskNumber,
      [OPTION_USDZ]: zipWriter.options[OPTION_USDZ]
    });
    const headerInfo = getHeaderInfo(options);
    const dataDescriptorInfo = getDataDescriptorInfo(options);
    const metadataSize = getLength(headerInfo.localHeaderArray, dataDescriptorInfo.dataDescriptorArray);
    fileEntry = await getFileEntry(zipWriter, name, reader, {
      headerInfo,
      dataDescriptorInfo,
      metadataSize,
      fileEntry: pendingFileEntry,
      previousFileEntry,
      releaseLockFileEntry
    }, options);
  } catch (error) {
    zipWriter.fileEntries.delete(name);
    throw error;
  } finally {
    if (releaseLockFileEntry) {
      releaseLockFileEntry(previousFileEntry && previousFileEntry.lockFileEntry);
    }
  }
  Object.assign(fileEntry, {
    name,
    comment,
    extraField,
    [PROPERTY_NAME_DEPRECATED_INTERNAL_FILE_ATTRIBUTES]: fileEntry.internalFileAttributes,
    [PROPERTY_NAME_DEPRECATED_EXTERNAL_FILE_ATTRIBUTES]: fileEntry.externalFileAttributes
  });
  return new Entry(fileEntry);
}
function resolveAttributes(zipWriter, name, options) {
  let msDosCompatible = getOptionValue(zipWriter, options, PROPERTY_NAME_MS_DOS_COMPATIBLE);
  let versionMadeBy = getOptionValue(zipWriter, options, PROPERTY_NAME_VERSION_MADE_BY, msDosCompatible ? VERSION_MADE_BY_MSDOS : VERSION_MADE_BY_UNIX);
  const executable = getOptionValue(zipWriter, options, PROPERTY_NAME_EXECUTABLE);
  const uid = getNumberOptionValue(zipWriter, options, PROPERTY_NAME_UID);
  const gid = getNumberOptionValue(zipWriter, options, PROPERTY_NAME_GID);
  let unixMode = getNumberOptionValue(zipWriter, options, PROPERTY_NAME_UNIX_MODE);
  let unixExtraFieldType = getOptionValue(zipWriter, options, OPTION_UNIX_EXTRA_FIELD_TYPE);
  let setuid = getOptionValue(zipWriter, options, PROPERTY_NAME_SETUID);
  let setgid = getOptionValue(zipWriter, options, PROPERTY_NAME_SETGID);
  let sticky = getOptionValue(zipWriter, options, PROPERTY_NAME_STICKY);
  checkIntegerOption(uid, MAX_32_BITS, ERR_INVALID_UID);
  checkIntegerOption(gid, MAX_32_BITS, ERR_INVALID_GID);
  checkIntegerOption(unixMode, MAX_16_BITS, ERR_INVALID_UNIX_MODE);
  if (unixExtraFieldType !== UNDEFINED_VALUE && unixExtraFieldType !== INFOZIP_EXTRA_FIELD_TYPE && unixExtraFieldType !== UNIX_EXTRA_FIELD_TYPE) {
    throw new Error(ERR_INVALID_UNIX_EXTRA_FIELD_TYPE);
  }
  if (unixExtraFieldType === UNIX_EXTRA_FIELD_TYPE && (uid !== UNDEFINED_VALUE && uid > MAX_16_BITS || gid !== UNDEFINED_VALUE && gid > MAX_16_BITS)) {
    throw new Error(ERR_INVALID_UNIX_ID_SIZE);
  }
  if (unixExtraFieldType === UNDEFINED_VALUE && (uid !== UNDEFINED_VALUE || gid !== UNDEFINED_VALUE)) {
    unixExtraFieldType = INFOZIP_EXTRA_FIELD_TYPE;
  }
  let msdosAttributesRaw = getNumberOptionValue(zipWriter, options, PROPERTY_NAME_MSDOS_ATTRIBUTES_RAW);
  let msdosAttributes = getOptionValue(zipWriter, options, PROPERTY_NAME_MSDOS_ATTRIBUTES);
  const hasUnixMetadata = uid !== UNDEFINED_VALUE || gid !== UNDEFINED_VALUE || unixMode !== UNDEFINED_VALUE || unixExtraFieldType || executable;
  const hasMsDosProvided = msdosAttributesRaw !== UNDEFINED_VALUE || msdosAttributes !== UNDEFINED_VALUE;
  if (hasUnixMetadata) {
    msDosCompatible = false;
    versionMadeBy = versionMadeBy & MAX_8_BITS | VERSION_MADE_BY_UNIX;
  } else if (hasMsDosProvided) {
    msDosCompatible = true;
    versionMadeBy = versionMadeBy & MAX_8_BITS;
  }
  checkIntegerOption(msdosAttributesRaw, MAX_8_BITS, ERR_INVALID_MSDOS_ATTRIBUTES);
  if (msdosAttributes && (typeof msdosAttributes !== OBJECT_TYPE || Array.isArray(msdosAttributes))) {
    throw new Error(ERR_INVALID_MSDOS_DATA);
  }
  if (versionMadeBy > MAX_16_BITS) {
    throw new Error(ERR_INVALID_VERSION);
  }
  let externalFileAttributes = getAliasedOptionValue(zipWriter, options, PROPERTY_NAME_EXTERNAL_FILE_ATTRIBUTES, PROPERTY_NAME_DEPRECATED_EXTERNAL_FILE_ATTRIBUTES);
  const externalFileAttributesProvided = externalFileAttributes !== UNDEFINED_VALUE;
  if (!externalFileAttributesProvided) {
    externalFileAttributes = 0;
  }
  if (!options[PROPERTY_NAME_DIRECTORY] && name.endsWith(DIRECTORY_SIGNATURE)) {
    options[PROPERTY_NAME_DIRECTORY] = true;
  }
  const directory = getOptionValue(zipWriter, options, PROPERTY_NAME_DIRECTORY);
  if (directory) {
    if (!name.endsWith(DIRECTORY_SIGNATURE)) {
      name += DIRECTORY_SIGNATURE;
    }
    if (!externalFileAttributesProvided) {
      externalFileAttributes = FILE_ATTR_MSDOS_DIR_MASK;
      if (!msDosCompatible) {
        externalFileAttributes |= (FILE_ATTR_UNIX_TYPE_DIR | FILE_ATTR_UNIX_EXECUTABLE_MASK | FILE_ATTR_UNIX_DEFAULT_MASK) << 16;
      }
    }
  } else if (!msDosCompatible && !externalFileAttributesProvided) {
    if (executable) {
      externalFileAttributes = (FILE_ATTR_UNIX_EXECUTABLE_MASK | FILE_ATTR_UNIX_DEFAULT_MASK) << 16;
    } else {
      externalFileAttributes = FILE_ATTR_UNIX_DEFAULT_MASK << 16;
    }
  }
  if (!msDosCompatible) {
    const unixModeProvided = unixMode !== UNDEFINED_VALUE || Boolean(setuid || setgid || sticky);
    const defaultUnixMode = externalFileAttributes >> 16 & MAX_16_BITS;
    unixMode = unixMode === UNDEFINED_VALUE ? defaultUnixMode : unixMode & MAX_16_BITS;
    if (setuid) {
      unixMode |= FILE_ATTR_UNIX_SETUID_MASK;
    } else {
      setuid = Boolean(unixMode & FILE_ATTR_UNIX_SETUID_MASK);
    }
    if (setgid) {
      unixMode |= FILE_ATTR_UNIX_SETGID_MASK;
    } else {
      setgid = Boolean(unixMode & FILE_ATTR_UNIX_SETGID_MASK);
    }
    if (sticky) {
      unixMode |= FILE_ATTR_UNIX_STICKY_MASK;
    } else {
      sticky = Boolean(unixMode & FILE_ATTR_UNIX_STICKY_MASK);
    }
    if (!externalFileAttributesProvided || unixModeProvided) {
      if (directory) {
        unixMode = unixMode & ~FILE_ATTR_UNIX_TYPE_MASK | FILE_ATTR_UNIX_TYPE_DIR;
      } else if (!(unixMode & FILE_ATTR_UNIX_TYPE_MASK)) {
        unixMode |= FILE_ATTR_UNIX_TYPE_FILE;
      }
      externalFileAttributes = (unixMode & MAX_16_BITS) << 16 | externalFileAttributes & MAX_16_BITS;
    }
  }
  ({ msdosAttributesRaw, msdosAttributes } = normalizeMsdosAttributes(msdosAttributesRaw, msdosAttributes));
  if (hasMsDosProvided) {
    externalFileAttributes = externalFileAttributes & MAX_32_BITS | msdosAttributesRaw & MAX_8_BITS;
  }
  const unixExternalUpper = externalFileAttributes >> 16 & MAX_16_BITS;
  const symlink = unixMode !== UNDEFINED_VALUE && (unixMode & FILE_ATTR_UNIX_TYPE_MASK) == FILE_ATTR_UNIX_TYPE_SYMLINK;
  return {
    name,
    resolvedOptions: {
      versionMadeBy,
      msDosCompatible: Boolean(msDosCompatible),
      externalFileAttributes,
      unixExternalUpper,
      uid,
      gid,
      unixMode,
      unixExtraFieldType,
      symlink,
      setuid,
      setgid,
      sticky,
      msdosAttributesRaw,
      msdosAttributes
    }
  };
}
function resolveMetadata(zipWriter, name, options) {
  const encode = getFunctionOptionValue(zipWriter, options, OPTION_ENCODE_TEXT) || encodeText;
  let rawFilename = encode(name, TEXT_TYPE_FILENAME);
  if (rawFilename === UNDEFINED_VALUE) {
    rawFilename = encodeText(name);
  }
  if (getLength(rawFilename) > MAX_16_BITS) {
    throw new Error(ERR_INVALID_ENTRY_NAME);
  }
  const comment = options[PROPERTY_NAME_COMMENT] || "";
  if (typeof comment != STRING_TYPE) {
    throw new Error(ERR_INVALID_ENTRY_COMMENT_TYPE);
  }
  let rawComment = encode(comment, TEXT_TYPE_COMMENT);
  if (rawComment === UNDEFINED_VALUE) {
    rawComment = encodeText(comment);
  }
  if (getLength(rawComment) > MAX_16_BITS) {
    throw new Error(ERR_INVALID_ENTRY_COMMENT);
  }
  const version = getOptionValue(zipWriter, options, PROPERTY_NAME_VERSION);
  if (version !== UNDEFINED_VALUE && version > MAX_16_BITS) {
    throw new Error(ERR_INVALID_VERSION);
  }
  const lastModDate = getDateOptionValue(zipWriter, options, PROPERTY_NAME_LAST_MODIFICATION_DATE, /* @__PURE__ */ new Date());
  const rawLastModDate = getOptionValue(zipWriter, options, PROPERTY_NAME_RAW_LAST_MODIFICATION_DATE);
  const lastAccessDate = getDateOptionValue(zipWriter, options, PROPERTY_NAME_LAST_ACCESS_DATE);
  const creationDate = getDateOptionValue(zipWriter, options, PROPERTY_NAME_CREATION_DATE);
  const internalFileAttributes = getAliasedOptionValue(zipWriter, options, PROPERTY_NAME_INTERNAL_FILE_ATTRIBUTES, PROPERTY_NAME_DEPRECATED_INTERNAL_FILE_ATTRIBUTES, 0);
  const passThrough = getOptionValue(zipWriter, options, OPTION_PASS_THROUGH);
  const password = getOptionValue(zipWriter, options, OPTION_PASSWORD);
  const rawPassword = getOptionValue(zipWriter, options, OPTION_RAW_PASSWORD);
  checkPasswordOption(password, rawPassword);
  const encryptionStrength = getNumberOptionValue(zipWriter, options, OPTION_ENCRYPTION_STRENGTH, 3);
  const zipCrypto = getOptionValue(zipWriter, options, PROPERTY_NAME_ZIPCRYPTO);
  const extendedTimestamp = getOptionValue(zipWriter, options, OPTION_EXTENDED_TIMESTAMP, true);
  const ntfsTimestamp = getOptionValue(zipWriter, options, OPTION_NTFS_TIMESTAMP);
  const keepOrder = getOptionValue(zipWriter, options, OPTION_KEEP_ORDER, true);
  const useWebWorkers = getOptionValue(zipWriter, options, OPTION_USE_WEB_WORKERS);
  const transferStreams = getOptionValue(zipWriter, options, OPTION_TRANSFER_STREAMS);
  const bufferedWrite = getOptionValue(zipWriter, options, OPTION_BUFFERED_WRITE);
  const createTempStream = getFunctionOptionValue(zipWriter, options, OPTION_CREATE_TEMP_STREAM);
  const dataDescriptorSignature = getOptionValue(zipWriter, options, OPTION_DATA_DESCRIPTOR_SIGNATURE, true);
  const signal = checkSignalOption(getOptionValue(zipWriter, options, OPTION_SIGNAL));
  const useUnicodeFileNames = getOptionValue(zipWriter, options, OPTION_USE_UNICODE_FILE_NAMES, true);
  const compressionMethod = getOptionValue(zipWriter, options, PROPERTY_NAME_COMPRESSION_METHOD);
  const registeredCodec = passThrough || compressionMethod === UNDEFINED_VALUE ? UNDEFINED_VALUE : getRegisteredCodec(compressionMethod);
  if (!passThrough && compressionMethod !== UNDEFINED_VALUE && compressionMethod !== COMPRESSION_METHOD_STORE && compressionMethod !== COMPRESSION_METHOD_DEFLATE && !registeredCodec) {
    throw new Error(ERR_UNSUPPORTED_COMPRESSION2);
  }
  let level = getNumberOptionValue(zipWriter, options, OPTION_LEVEL);
  checkIntegerOption(level, MAX_LEVEL, ERR_INVALID_LEVEL);
  if (zipWriter.options[OPTION_USDZ]) {
    if (password !== UNDEFINED_VALUE || rawPassword !== UNDEFINED_VALUE) {
      throw new Error(ERR_UNSUPPORTED_ENCRYPTION_USDZ);
    }
    if (level === UNDEFINED_VALUE && compressionMethod === UNDEFINED_VALUE) {
      level = 0;
    }
  }
  if (passThrough) {
    level = UNDEFINED_VALUE;
  }
  let useCompressionStream = getOptionValue(zipWriter, options, OPTION_USE_COMPRESSION_STREAM);
  let dataDescriptor = getOptionValue(zipWriter, options, OPTION_DATA_DESCRIPTOR);
  if (bufferedWrite && dataDescriptor === UNDEFINED_VALUE) {
    dataDescriptor = false;
  }
  if (dataDescriptor === UNDEFINED_VALUE || zipCrypto && !passThrough) {
    dataDescriptor = true;
  }
  if (level !== UNDEFINED_VALUE && level != 6) {
    useCompressionStream = false;
  }
  const zip64 = getOptionValue(zipWriter, options, PROPERTY_NAME_ZIP64);
  if (!zipCrypto && (password !== UNDEFINED_VALUE || rawPassword !== UNDEFINED_VALUE) && !(Number.isInteger(encryptionStrength) && encryptionStrength >= 1 && encryptionStrength <= 3)) {
    throw new Error(ERR_INVALID_ENCRYPTION_STRENGTH);
  }
  const rawExtraField = serializeExtraField(options[PROPERTY_NAME_EXTRA_FIELD]);
  const rawLocalExtraField = serializeExtraField(options[OPTION_LOCAL_EXTRA_FIELD]);
  const rawCentralExtraField = serializeExtraField(options[OPTION_CENTRAL_EXTRA_FIELD]);
  return {
    comment,
    resolvedOptions: {
      rawFilename,
      rawComment,
      version,
      lastModDate,
      rawLastModDate,
      lastAccessDate,
      creationDate,
      internalFileAttributes,
      passThrough,
      password,
      rawPassword,
      encryptionStrength,
      zipCrypto,
      extendedTimestamp,
      ntfsTimestamp,
      keepOrder,
      useWebWorkers,
      transferStreams,
      bufferedWrite,
      createTempStream,
      dataDescriptorSignature,
      signal,
      useUnicodeFileNames,
      compressionMethod,
      format: registeredCodec ? registeredCodec.format : UNDEFINED_VALUE,
      codecURI: registeredCodec ? registeredCodec.codecURI : UNDEFINED_VALUE,
      codecVersionNeeded: registeredCodec ? registeredCodec.versionNeeded : UNDEFINED_VALUE,
      level,
      useCompressionStream,
      dataDescriptor,
      zip64,
      rawExtraField,
      rawLocalExtraField,
      rawCentralExtraField
    }
  };
}
function serializeExtraField(extraField) {
  if (!extraField) {
    return EMPTY_UINT8_ARRAY;
  }
  if (!(extraField instanceof Map)) {
    throw new Error(ERR_INVALID_EXTRAFIELD);
  }
  let extraFieldSize = 0;
  let offset = 0;
  extraField.forEach((data, type) => {
    checkInteger(type, MAX_16_BITS, ERR_INVALID_EXTRAFIELD_TYPE);
    if (!(data instanceof Uint8Array)) {
      throw new Error(ERR_INVALID_EXTRAFIELD_DATA_TYPE);
    }
    if (getLength(data) > MAX_16_BITS) {
      throw new Error(ERR_INVALID_EXTRAFIELD_DATA);
    }
    extraFieldSize += 4 + getLength(data);
  });
  const rawExtraField = new Uint8Array(extraFieldSize);
  const rawExtraFieldView = getDataView(rawExtraField);
  extraField.forEach((data, type) => {
    setUint16(rawExtraFieldView, offset, type);
    setUint16(rawExtraFieldView, offset + 2, getLength(data));
    arraySet(rawExtraField, data, offset + 4);
    offset += 4 + getLength(data);
  });
  return rawExtraField;
}
async function resolveSizes(zipWriter, reader, { resolvedOptions: metadata }, options) {
  if (metadata.passThrough && !reader && !getOptionValue(zipWriter, options, PROPERTY_NAME_DIRECTORY)) {
    throw new Error(ERR_UNDEFINED_READER);
  }
  let contentSize;
  if (reader) {
    reader = new GenericReader(reader);
    await initStream(reader);
    ({ size: contentSize } = reader);
  }
  return Object.assign({ reader }, resolveEntrySizes(zipWriter, Boolean(reader), contentSize, metadata, options));
}
function resolveEntrySizes(zipWriter, hasContent, contentSize, metadata, options) {
  const { passThrough, zipCrypto, password, rawPassword, encryptionStrength } = metadata;
  let { dataDescriptor, zip64, level, compressionMethod } = metadata;
  let maximumCompressedSize = 0;
  let uncompressedSize = 0;
  if (passThrough && hasContent) {
    uncompressedSize = options[PROPERTY_NAME_UNCOMPRESSED_SIZE];
    if (uncompressedSize === UNDEFINED_VALUE) {
      throw new Error(ERR_UNDEFINED_UNCOMPRESSED_SIZE);
    }
    if (compressionMethod === UNDEFINED_VALUE) {
      throw new Error(ERR_UNDEFINED_COMPRESSION_METHOD);
    }
  }
  const zip64Enabled = zip64 === true;
  const encrypted = getOptionValue(zipWriter, options, PROPERTY_NAME_ENCRYPTED);
  if (hasContent && passThrough && !encrypted && getLength(password, rawPassword)) {
    throw new Error(ERR_UNSUPPORTED_ENCRYPTION_PASS_THROUGH);
  }
  const encryptedEntry = hasContent && (Boolean(password && getLength(password) || rawPassword && getLength(rawPassword)) || passThrough && encrypted);
  if (!hasContent) {
    level = 0;
    compressionMethod = COMPRESSION_METHOD_STORE;
  }
  const encryptionOverhead = encryptedEntry ? zipCrypto ? 12 : 16 + encryptionStrength * 4 : 0;
  if (hasContent) {
    if (!passThrough) {
      if (contentSize === UNDEFINED_VALUE) {
        dataDescriptor = true;
        if (zip64 || zip64 === UNDEFINED_VALUE) {
          zip64 = true;
          uncompressedSize = maximumCompressedSize = MAX_32_BITS + 1;
        }
      } else {
        options.uncompressedSize = uncompressedSize = contentSize;
        maximumCompressedSize = (isCompressed(compressionMethod, level) ? getMaximumCompressedSize(uncompressedSize) : uncompressedSize) + encryptionOverhead;
      }
    } else {
      options.uncompressedSize = uncompressedSize;
      maximumCompressedSize = contentSize === UNDEFINED_VALUE ? getMaximumCompressedSize(uncompressedSize) + encryptionOverhead : contentSize;
    }
  }
  const emptyEntry = !encryptedEntry && (!hasContent || contentSize === 0 && !passThrough) && !isCompressed(compressionMethod, level);
  if (emptyEntry && !zipCrypto && getOptionValue(zipWriter, options, OPTION_DATA_DESCRIPTOR) === UNDEFINED_VALUE) {
    dataDescriptor = false;
  }
  const zip64UncompressedSize = zip64Enabled || uncompressedSize >= MAX_32_BITS;
  const zip64CompressedSize = zip64Enabled || maximumCompressedSize >= MAX_32_BITS;
  if (zip64UncompressedSize || zip64CompressedSize) {
    if (zip64 === false) {
      throw new Error(ERR_UNSUPPORTED_FORMAT);
    } else {
      zip64 = true;
    }
  }
  zip64 = zip64 || false;
  return {
    maximumCompressedSize,
    resolvedOptions: {
      dataDescriptor,
      emptyEntry,
      zip64,
      zip64UncompressedSize,
      zip64CompressedSize,
      uncompressedSize,
      level,
      compressionMethod,
      encrypted: encryptedEntry
    }
  };
}
async function getEntriesSize(writerOptions, entries, writeOrderGuaranteed, comment) {
  const zipWriter = { options: writerOptions };
  if (checkFunctionOption(writerOptions[OPTION_SIGN_CENTRAL_DIRECTORY])) {
    throw new Error(ERR_UNDETERMINED_SIZE);
  }
  if (comment !== UNDEFINED_VALUE && !(comment instanceof Uint8Array)) {
    throw new Error(ERR_INVALID_COMMENT_TYPE);
  }
  const commentLength = getLength(comment);
  if (commentLength > MAX_16_BITS) {
    throw new Error(ERR_INVALID_COMMENT);
  }
  const usdz = writerOptions[OPTION_USDZ];
  const files = /* @__PURE__ */ new Map();
  const initialOffset = writerOptions[OPTION_OFFSET] === UNDEFINED_VALUE ? 0 : writerOptions[OPTION_OFFSET];
  let offset = initialOffset;
  let minimumEntrySize = INFINITY_VALUE;
  for (const entry of entries) {
    let { name } = entry;
    const { size } = entry;
    const options = Object.assign({}, entry.options);
    if (getOptionValue(zipWriter, options, PROPERTY_NAME_DIRECTORY) && !name.endsWith(DIRECTORY_SIGNATURE)) {
      name += DIRECTORY_SIGNATURE;
    }
    const attributesInfo = resolveAttributes(zipWriter, name, options);
    ({ name } = attributesInfo);
    const { resolvedOptions: metadata } = resolveMetadata(zipWriter, name, options);
    if (metadata.level != 0 && metadata.compressionMethod === UNDEFINED_VALUE && !metadata.passThrough && !await supportsDeflate(getConfiguration())) {
      metadata.level = 0;
    }
    const hasContent = !getOptionValue(zipWriter, options, PROPERTY_NAME_DIRECTORY);
    if (hasContent && size === UNDEFINED_VALUE) {
      throw new Error(ERR_UNDETERMINED_SIZE);
    }
    const { maximumCompressedSize, resolvedOptions: sizes } = resolveEntrySizes(zipWriter, hasContent, size, metadata, options);
    if (hasContent && !metadata.passThrough && isCompressed(sizes.compressionMethod, sizes.level)) {
      throw new Error(ERR_UNDETERMINED_SIZE);
    }
    const entryOptions = Object.assign({}, options, attributesInfo.resolvedOptions, metadata, sizes, { [OPTION_USDZ]: usdz });
    const headerInfo = getHeaderInfo(entryOptions);
    const dataDescriptorInfo = getDataDescriptorInfo(entryOptions);
    const entryInfo = {
      headerInfo,
      metadataSize: getLength(headerInfo.localHeaderArray, dataDescriptorInfo.dataDescriptorArray)
    };
    if (usdz) {
      appendExtraFieldUSDZ(entryInfo, offset);
    }
    const compressedSize = hasContent ? maximumCompressedSize : 0;
    files.set(name, Object.assign({}, entryOptions, headerInfo, {
      offset,
      diskNumberStart: 0,
      compressedSize
    }));
    const entrySize = entryInfo.metadataSize + compressedSize;
    minimumEntrySize = Math.min(minimumEntrySize, entrySize);
    offset += entrySize;
  }
  const layoutDependsOnWriteOrder = files.size > 1 && (usdz || offset - minimumEntrySize >= MAX_32_BITS);
  if (layoutDependsOnWriteOrder && !writeOrderGuaranteed) {
    throw new Error(ERR_UNDETERMINED_SIZE);
  }
  const directoryDataLength = createDirectoryRecords(files);
  let zip64 = getOptionValue(zipWriter, writerOptions, PROPERTY_NAME_ZIP64);
  if (offset >= MAX_32_BITS || directoryDataLength >= MAX_32_BITS || files.size >= MAX_16_BITS) {
    if (zip64 === false) {
      throw new Error(ERR_UNSUPPORTED_FORMAT);
    } else {
      zip64 = true;
    }
  }
  return offset - initialOffset + directoryDataLength + commentLength + (zip64 ? ZIP64_END_OF_CENTRAL_DIR_TOTAL_LENGTH : END_OF_CENTRAL_DIR_LENGTH);
}
async function getFileEntry(zipWriter, name, reader, entryInfo, options) {
  const {
    fileEntries,
    writer
  } = zipWriter;
  const {
    keepOrder,
    dataDescriptor,
    emptyEntry,
    signal
  } = options;
  const {
    headerInfo,
    fileEntry: pendingFileEntry,
    previousFileEntry,
    releaseLockFileEntry
  } = entryInfo;
  const usdz = zipWriter.options[OPTION_USDZ];
  let fileEntry = pendingFileEntry;
  let bufferedWrite;
  let releaseLockWriter;
  let writingBufferedEntryData;
  let writingEntryData;
  let writerSizeBeforeEntry;
  let flushedBufferedSize = 0;
  let fileWriter;
  const lockPreviousFileEntry = keepOrder && previousFileEntry ? previousFileEntry.lockFileEntry : UNDEFINED_VALUE;
  fileEntries.set(name, fileEntry);
  try {
    if (options.bufferedWrite || !keepOrder || zipWriter.writerLocked || zipWriter.bufferedWrites || !dataDescriptor && !emptyEntry) {
      bufferedWrite = true;
      zipWriter.bufferedWrites++;
      if (options.createTempStream) {
        fileWriter = await options.createTempStream();
      } else {
        fileWriter = new TransformStream(UNDEFINED_VALUE, UNDEFINED_VALUE, { highWaterMark: INFINITY_VALUE });
      }
      fileWriter.size = 0;
      await initStream(writer);
    } else {
      fileWriter = writer;
      await lockPreviousFileEntry;
      await requestLockWriter();
    }
    await initStream(fileWriter);
    const diskOffset = getDiskOffset(writer);
    if (zipWriter.addSplitZipSignature && !bufferedWrite) {
      await writeSplitZipSignature(zipWriter, writer);
    }
    if (usdz && !bufferedWrite) {
      appendExtraFieldUSDZ(entryInfo, zipWriter.offset - diskOffset);
    }
    const { localHeaderArray } = headerInfo;
    if (!bufferedWrite) {
      await skipDiskIfNeeded();
    }
    const diskNumberStart = getDiskNumber(writer);
    const entryOffset = getSegmentOffset(zipWriter, writer);
    fileEntry.diskNumberStart = diskNumberStart;
    if (!bufferedWrite) {
      writingEntryData = true;
      writerSizeBeforeEntry = writer.size;
      await writeData(fileWriter, localHeaderArray);
    }
    fileEntry = await createFileEntry(reader, fileWriter, fileEntry, entryInfo, getConfiguration(), options);
    if (!bufferedWrite) {
      writingEntryData = false;
    }
    fileEntries.set(name, fileEntry);
    fileEntry.filename = name;
    if (bufferedWrite) {
      await Promise.all([fileWriter.writable.getWriter().close(), lockPreviousFileEntry]);
      await requestLockWriter();
      if (zipWriter.addSplitZipSignature) {
        await writeSplitZipSignature(zipWriter, writer);
      }
      writingBufferedEntryData = true;
      writerSizeBeforeEntry = writer.size;
      await skipDiskIfNeeded();
      fileEntry.diskNumberStart = getDiskNumber(writer);
      fileEntry.offset = getSegmentOffset(zipWriter, writer);
      if (usdz) {
        const previousMetadataSize = entryInfo.metadataSize;
        appendExtraFieldUSDZ(entryInfo, zipWriter.offset - getDiskOffset(writer));
        fileEntry.size += entryInfo.metadataSize - previousMetadataSize;
      }
      updateLocalHeader(fileEntry, headerInfo.localHeaderView, options);
      await writeData(writer, headerInfo.localHeaderArray);
      await flushBufferedData(fileWriter.readable, writer, signal, (chunkLength) => flushedBufferedSize += chunkLength);
      writer.size += fileWriter.size;
      writingBufferedEntryData = false;
    } else {
      fileEntry.diskNumberStart = diskNumberStart;
      fileEntry.offset = entryOffset;
    }
    zipWriter.offset += fileEntry.size;
    return fileEntry;
  } catch (error) {
    if (writingBufferedEntryData || writingEntryData) {
      zipWriter.hasCorruptedEntries = true;
      if (error) {
        try {
          error.corruptedEntry = true;
        } catch {
        }
      }
      zipWriter.offset += writer.size - writerSizeBeforeEntry;
      if (bufferedWrite) {
        zipWriter.offset += flushedBufferedSize;
      }
    }
    fileEntries.delete(name);
    throw error;
  } finally {
    if (bufferedWrite) {
      zipWriter.bufferedWrites--;
    }
    if (releaseLockFileEntry) {
      releaseLockFileEntry(lockPreviousFileEntry);
    }
    if (releaseLockWriter) {
      releaseLockWriter();
    }
    if (bufferedWrite && fileWriter && fileWriter.dispose) {
      try {
        await fileWriter.dispose();
      } catch {
      }
    }
  }
  async function requestLockWriter() {
    zipWriter.writerLocked = true;
    const { lockWriter } = zipWriter;
    zipWriter.lockWriter = new Promise((resolve) => releaseLockWriter = () => {
      zipWriter.writerLocked = false;
      resolve();
    });
    await lockWriter;
  }
  async function skipDiskIfNeeded() {
    if (exceedsAvailableSize(writer, getLength(headerInfo.localHeaderArray))) {
      await writer.closeDisk();
    }
  }
}
async function createFileEntry(reader, writer, { diskNumberStart, lockFileEntry }, entryInfo, config, options) {
  const {
    headerInfo,
    dataDescriptorInfo,
    metadataSize
  } = entryInfo;
  const {
    headerArray,
    headerView,
    lastModDate,
    rawLastModDate,
    encrypted,
    compressed,
    version,
    compressionMethod,
    rawExtraFieldZip64,
    localExtraFieldZip64Length,
    rawExtraFieldExtendedTimestamp,
    extraFieldExtendedTimestampFlag,
    rawExtraFieldNTFS,
    rawExtraFieldUnix,
    rawExtraFieldAES
  } = headerInfo;
  const { dataDescriptorArray } = dataDescriptorInfo;
  const {
    rawFilename,
    lastAccessDate,
    creationDate,
    password,
    rawPassword,
    level,
    zip64,
    zip64UncompressedSize,
    zip64CompressedSize,
    zipCrypto,
    dataDescriptor,
    directory,
    executable,
    versionMadeBy,
    rawComment,
    rawExtraField,
    rawCentralExtraField,
    useWebWorkers,
    transferStreams,
    onstart,
    onprogress,
    onend,
    signal,
    encryptionStrength,
    extendedTimestamp,
    msDosCompatible,
    internalFileAttributes,
    externalFileAttributes,
    uid,
    gid,
    unixMode,
    symlink,
    setuid,
    setgid,
    sticky,
    unixExternalUpper,
    msdosAttributesRaw,
    msdosAttributes,
    useCompressionStream,
    passThrough,
    format,
    codecURI
  } = options;
  const fileEntry = {
    lockFileEntry,
    versionMadeBy,
    zip64,
    directory: Boolean(directory),
    executable: Boolean(executable),
    filenameUTF8: true,
    rawFilename,
    commentUTF8: true,
    rawComment,
    rawExtraFieldZip64,
    localExtraFieldZip64Length,
    rawExtraFieldExtendedTimestamp,
    rawExtraFieldNTFS,
    rawExtraFieldUnix,
    rawExtraFieldAES,
    rawExtraField,
    rawCentralExtraField,
    extendedTimestamp,
    msDosCompatible,
    internalFileAttributes,
    externalFileAttributes,
    diskNumberStart,
    uid,
    gid,
    unixMode,
    symlink: Boolean(symlink),
    setuid,
    setgid,
    sticky,
    unixExternalUpper,
    msdosAttributesRaw,
    msdosAttributes
  };
  let {
    crc32,
    uncompressedSize
  } = options;
  let compressedSize = 0;
  if (!passThrough) {
    uncompressedSize = 0;
  }
  const { writable } = writer;
  if (reader) {
    const readable = toCompatibleReadable(createReadable(reader));
    const size = reader.size;
    const workerOptions = {
      options: {
        codecType: CODEC_DEFLATE,
        inputSize: size,
        level,
        rawPassword,
        password,
        encryptionStrength,
        zipCrypto: encrypted && zipCrypto,
        passwordVerification: encrypted && zipCrypto && rawLastModDate >> 8 & MAX_8_BITS,
        computeCrc32: !passThrough,
        compressed: compressed && !passThrough,
        encrypted: encrypted && !passThrough,
        useWebWorkers,
        useCompressionStream,
        transferStreams,
        format,
        codecURI,
        compressionMethod
      },
      config,
      streamOptions: { signal, size, onstart, onprogress, onend }
    };
    try {
      const result = await runWorker2({ readable, writable }, workerOptions);
      compressedSize = result.outputSize;
      writer.size += compressedSize;
      if (!passThrough) {
        uncompressedSize = result.inputSize;
        if (!encrypted || zipCrypto) {
          crc32 = result.crc32;
        }
      }
      if (!zip64CompressedSize && compressedSize >= MAX_32_BITS || !zip64UncompressedSize && uncompressedSize >= MAX_32_BITS) {
        throw new Error(ERR_UNSUPPORTED_FORMAT);
      }
    } catch (error) {
      if (error.outputSize !== UNDEFINED_VALUE) {
        writer.size += error.outputSize;
      }
      throw error;
    }
  }
  setEntryInfo({
    crc32,
    compressedSize,
    uncompressedSize,
    headerInfo,
    dataDescriptorInfo
  }, options);
  if (dataDescriptor) {
    await writeData(writer, dataDescriptorArray);
  }
  Object.assign(fileEntry, {
    uncompressedSize,
    compressedSize,
    lastModDate,
    rawLastModDate,
    creationDate,
    lastAccessDate,
    encrypted: Boolean(encrypted),
    zipCrypto: Boolean(zipCrypto),
    size: metadataSize + compressedSize,
    compressionMethod,
    version,
    headerArray,
    headerView,
    signature: crc32,
    crc32: encrypted && !zipCrypto && !passThrough ? UNDEFINED_VALUE : crc32,
    extraFieldExtendedTimestampFlag,
    zip64UncompressedSize,
    zip64CompressedSize
  });
  return fileEntry;
}
function getHeaderInfo(options) {
  const {
    rawFilename,
    lastModDate,
    rawLastModDate: rawLastModDateOption,
    lastAccessDate,
    creationDate,
    level,
    zip64,
    zipCrypto,
    useUnicodeFileNames,
    dataDescriptor,
    directory,
    rawExtraField,
    rawLocalExtraField,
    encryptionStrength,
    extendedTimestamp,
    ntfsTimestamp,
    passThrough,
    encrypted,
    zip64UncompressedSize,
    zip64CompressedSize,
    uncompressedSize,
    crc32
  } = options;
  let { version, compressionMethod } = options;
  const compressed = !directory && isCompressed(compressionMethod, level);
  let rawLocalExtraFieldZip64;
  const uncompressedFile = passThrough || !compressed;
  const zip64ExtraFieldComplete = zip64 && (options.bufferedWrite || !dataDescriptor || (!zip64UncompressedSize && !zip64CompressedSize || uncompressedFile));
  const writeLocalExtraFieldZip64 = zip64ExtraFieldComplete || zip64 && dataDescriptor && (zip64UncompressedSize || zip64CompressedSize);
  if (zip64 && (zip64UncompressedSize || zip64CompressedSize)) {
    const length = 4 + 16;
    const extraFieldZip64 = createRecordWriter(length);
    extraFieldZip64.writeUint16(EXTRAFIELD_TYPE_ZIP64);
    extraFieldZip64.writeUint16(length - 4);
    rawLocalExtraFieldZip64 = extraFieldZip64.array;
    if (zip64ExtraFieldComplete) {
      extraFieldZip64.writeUint64(uncompressedSize);
      if (uncompressedFile) {
        const encryptionOverhead = encrypted ? zipCrypto ? 12 : 16 + encryptionStrength * 4 : 0;
        extraFieldZip64.writeUint64(passThrough ? 0 : uncompressedSize + encryptionOverhead);
      }
    }
  } else {
    rawLocalExtraFieldZip64 = EMPTY_UINT8_ARRAY;
  }
  let rawExtraFieldAES;
  if (encrypted && !zipCrypto) {
    const extraFieldAES = createRecordWriter(getLength(EXTRAFIELD_DATA_AES) + 2);
    extraFieldAES.writeUint16(EXTRAFIELD_TYPE_AES);
    extraFieldAES.writeBytes(EXTRAFIELD_DATA_AES);
    rawExtraFieldAES = extraFieldAES.array;
    rawExtraFieldAES[8] = encryptionStrength;
  } else {
    rawExtraFieldAES = EMPTY_UINT8_ARRAY;
  }
  let rawExtraFieldNTFS;
  let rawExtraFieldExtendedTimestamp;
  let extraFieldExtendedTimestampFlag;
  if (extendedTimestamp) {
    const lastModTimeUnix = getTimeUnix(lastModDate);
    const lastModTimeUnixInRange = inUnixTimeRange(lastModTimeUnix);
    if (lastModTimeUnixInRange) {
      const extraFieldTimestampLength = 9 + (lastAccessDate ? 4 : 0) + (creationDate ? 4 : 0);
      const extraFieldTimestamp = createRecordWriter(extraFieldTimestampLength);
      extraFieldExtendedTimestampFlag = 1 + (lastAccessDate ? 2 : 0) + (creationDate ? 4 : 0);
      extraFieldTimestamp.writeUint16(EXTRAFIELD_TYPE_EXTENDED_TIMESTAMP);
      extraFieldTimestamp.writeUint16(extraFieldTimestampLength - 4);
      extraFieldTimestamp.writeUint8(extraFieldExtendedTimestampFlag);
      extraFieldTimestamp.writeUint32(lastModTimeUnix);
      if (lastAccessDate) {
        extraFieldTimestamp.writeUint32(clampUnixTime(getTimeUnix(lastAccessDate)));
      }
      if (creationDate) {
        extraFieldTimestamp.writeUint32(clampUnixTime(getTimeUnix(creationDate)));
      }
      rawExtraFieldExtendedTimestamp = extraFieldTimestamp.array;
    } else {
      rawExtraFieldExtendedTimestamp = EMPTY_UINT8_ARRAY;
    }
    const writeExtraFieldNTFS = ntfsTimestamp === UNDEFINED_VALUE ? !lastModTimeUnixInRange || Boolean(lastAccessDate || creationDate) : ntfsTimestamp;
    if (writeExtraFieldNTFS) {
      try {
        const lastModTimeNTFS = getTimeNTFS(lastModDate);
        const extraFieldNTFS = createRecordWriter(36);
        extraFieldNTFS.writeUint16(EXTRAFIELD_TYPE_NTFS);
        extraFieldNTFS.writeUint16(32);
        extraFieldNTFS.skip(4);
        extraFieldNTFS.writeUint16(EXTRAFIELD_TYPE_NTFS_TAG1);
        extraFieldNTFS.writeUint16(24);
        extraFieldNTFS.writeUint64(lastModTimeNTFS);
        extraFieldNTFS.writeUint64(lastAccessDate ? getTimeNTFS(lastAccessDate) : lastModTimeNTFS);
        extraFieldNTFS.writeUint64(creationDate ? getTimeNTFS(creationDate) : lastModTimeNTFS);
        rawExtraFieldNTFS = extraFieldNTFS.array;
      } catch {
        rawExtraFieldNTFS = EMPTY_UINT8_ARRAY;
      }
    } else {
      rawExtraFieldNTFS = EMPTY_UINT8_ARRAY;
    }
  } else {
    rawExtraFieldNTFS = rawExtraFieldExtendedTimestamp = EMPTY_UINT8_ARRAY;
  }
  let rawExtraFieldUnix;
  try {
    const { uid, gid, unixExtraFieldType } = options;
    if (unixExtraFieldType == INFOZIP_EXTRA_FIELD_TYPE && (uid !== UNDEFINED_VALUE || gid !== UNDEFINED_VALUE)) {
      const uidBytes = packUnixId(uid === UNDEFINED_VALUE ? 0 : uid);
      const gidBytes = packUnixId(gid === UNDEFINED_VALUE ? 0 : gid);
      const payloadLength = 3 + uidBytes.length + gidBytes.length;
      const extraFieldUnix = createRecordWriter(4 + payloadLength);
      extraFieldUnix.writeUint16(EXTRAFIELD_TYPE_INFOZIP);
      extraFieldUnix.writeUint16(payloadLength);
      extraFieldUnix.writeUint8(1);
      extraFieldUnix.writeUint8(uidBytes.length);
      extraFieldUnix.writeBytes(uidBytes);
      extraFieldUnix.writeUint8(gidBytes.length);
      extraFieldUnix.writeBytes(gidBytes);
      rawExtraFieldUnix = extraFieldUnix.array;
    } else if (unixExtraFieldType == UNIX_EXTRA_FIELD_TYPE && (uid !== UNDEFINED_VALUE || gid !== UNDEFINED_VALUE)) {
      const extraFieldUnix = createRecordWriter(8);
      extraFieldUnix.writeUint16(EXTRAFIELD_TYPE_UNIX);
      extraFieldUnix.writeUint16(4);
      extraFieldUnix.writeUint16((uid === UNDEFINED_VALUE ? 0 : uid) & MAX_16_BITS);
      extraFieldUnix.writeUint16((gid === UNDEFINED_VALUE ? 0 : gid) & MAX_16_BITS);
      rawExtraFieldUnix = extraFieldUnix.array;
    } else {
      rawExtraFieldUnix = EMPTY_UINT8_ARRAY;
    }
  } catch {
    rawExtraFieldUnix = EMPTY_UINT8_ARRAY;
  }
  if (compressionMethod === UNDEFINED_VALUE) {
    compressionMethod = compressed ? COMPRESSION_METHOD_DEFLATE : COMPRESSION_METHOD_STORE;
  }
  if (version === UNDEFINED_VALUE) {
    version = compressionMethod == COMPRESSION_METHOD_STORE && !directory && !encrypted ? VERSION_STORE : VERSION_DEFLATE;
  }
  const { codecVersionNeeded } = options;
  if (compressed && codecVersionNeeded !== UNDEFINED_VALUE) {
    version = version > codecVersionNeeded ? version : codecVersionNeeded;
  }
  if (zip64) {
    version = version > VERSION_ZIP64 ? version : VERSION_ZIP64;
  }
  if (encrypted && !zipCrypto) {
    version = version > VERSION_AES ? version : VERSION_AES;
    if (passThrough && crc32 !== UNDEFINED_VALUE) {
      rawExtraFieldAES[EXTRAFIELD_OFFSET_AES_VENDOR_VERSION] = VENDOR_VERSION_AE_1;
    }
    setUint16(getDataView(rawExtraFieldAES), EXTRAFIELD_OFFSET_AES_COMPRESSION_METHOD, compressionMethod);
    compressionMethod = COMPRESSION_METHOD_AES;
  }
  const localExtraFieldZip64Length = writeLocalExtraFieldZip64 ? getLength(rawLocalExtraFieldZip64) : 0;
  const extraFieldLength = localExtraFieldZip64Length + getLength(rawExtraFieldAES, rawExtraFieldExtendedTimestamp, rawExtraFieldNTFS, rawExtraFieldUnix, rawExtraField, rawLocalExtraField);
  const maximumUsdzExtraFieldLength = options[OPTION_USDZ] ? EXTRAFIELD_USDZ_MAX_LENGTH : 0;
  if (extraFieldLength + maximumUsdzExtraFieldLength > MAX_16_BITS) {
    throw new Error(ERR_INVALID_EXTRAFIELD_DATA);
  }
  const dosLastModDate = new Date(Math.ceil(Math.floor(lastModDate.getTime() / 1e3) / 2) * 2e3);
  const {
    headerArray,
    headerView,
    rawLastModDate
  } = getHeaderArrayData({
    version,
    bitFlag: getBitFlag(level, useUnicodeFileNames, dataDescriptor, encrypted, compressionMethod),
    compressionMethod,
    uncompressedSize,
    lastModDate: dosLastModDate < MIN_DATE ? MIN_DATE : dosLastModDate > MAX_DATE ? MAX_DATE : dosLastModDate,
    rawLastModDate: rawLastModDateOption,
    rawFilename,
    zip64CompressedSize,
    zip64UncompressedSize,
    extraFieldLength
  });
  const localHeader = createRecordWriter(HEADER_SIZE + getLength(rawFilename) + extraFieldLength);
  const localHeaderArray = localHeader.array;
  const localHeaderView = getDataView(localHeaderArray);
  localHeader.writeUint32(LOCAL_FILE_HEADER_SIGNATURE);
  localHeader.writeBytes(headerArray);
  localHeader.writeBytes(rawFilename);
  if (writeLocalExtraFieldZip64) {
    localHeader.writeBytes(rawLocalExtraFieldZip64);
  }
  localHeader.writeBytes(rawExtraFieldAES);
  localHeader.writeBytes(rawExtraFieldExtendedTimestamp);
  localHeader.writeBytes(rawExtraFieldNTFS);
  localHeader.writeBytes(rawExtraFieldUnix);
  localHeader.writeBytes(rawExtraField);
  localHeader.writeBytes(rawLocalExtraField);
  if (dataDescriptor) {
    if (!zip64CompressedSize) {
      setUint32(localHeaderView, HEADER_OFFSET_COMPRESSED_SIZE + LOCAL_HEADER_COMMON_OFFSET, 0);
    }
    if (!zip64UncompressedSize) {
      setUint32(localHeaderView, HEADER_OFFSET_UNCOMPRESSED_SIZE + LOCAL_HEADER_COMMON_OFFSET, 0);
    }
  }
  return {
    localHeaderArray,
    localHeaderView,
    headerArray,
    headerView,
    lastModDate,
    rawLastModDate,
    encrypted,
    compressed,
    version,
    compressionMethod,
    extraFieldExtendedTimestampFlag,
    rawExtraFieldZip64: EMPTY_UINT8_ARRAY,
    localExtraFieldZip64Length,
    rawExtraFieldExtendedTimestamp,
    rawExtraFieldNTFS,
    rawExtraFieldUnix,
    rawExtraFieldAES,
    extraFieldLength
  };
}
function appendExtraFieldUSDZ(entryInfo, zipWriterOffset) {
  const { headerInfo } = entryInfo;
  let { localHeaderArray, extraFieldLength } = headerInfo;
  let extraBytesLength = 64 - (zipWriterOffset + getLength(localHeaderArray)) % 64;
  if (extraBytesLength < 4) {
    extraBytesLength += 64;
  }
  const rawExtraFieldUSDZ = new Uint8Array(extraBytesLength);
  const extraFieldUSDZView = getDataView(rawExtraFieldUSDZ);
  setUint16(extraFieldUSDZView, 0, EXTRAFIELD_TYPE_USDZ);
  setUint16(extraFieldUSDZView, 2, extraBytesLength - 4);
  const previousLocalHeaderArray = localHeaderArray;
  headerInfo.localHeaderArray = localHeaderArray = new Uint8Array(getLength(previousLocalHeaderArray) + extraBytesLength);
  arraySet(localHeaderArray, previousLocalHeaderArray);
  arraySet(localHeaderArray, rawExtraFieldUSDZ, getLength(previousLocalHeaderArray));
  const localHeaderArrayView = getDataView(localHeaderArray);
  setUint16(localHeaderArrayView, 28, extraFieldLength + extraBytesLength);
  headerInfo.localHeaderView = localHeaderArrayView;
  entryInfo.metadataSize += extraBytesLength;
}
function packUnixId(id) {
  const dataArray = new Uint8Array(4);
  const dataView = getDataView(dataArray);
  dataView.setUint32(0, id, true);
  let length = 4;
  while (length > 1 && dataArray[length - 1] === 0) {
    length--;
  }
  return dataArray.subarray(0, length);
}
function normalizeMsdosAttributes(msdosAttributesRaw, msdosAttributes) {
  if (msdosAttributesRaw !== UNDEFINED_VALUE) {
    msdosAttributesRaw = msdosAttributesRaw & MAX_8_BITS;
  } else if (msdosAttributes !== UNDEFINED_VALUE) {
    const { readOnly, hidden, system, directory: msdDir, archive } = msdosAttributes;
    let raw = 0;
    if (readOnly) raw |= FILE_ATTR_MSDOS_READONLY_MASK;
    if (hidden) raw |= FILE_ATTR_MSDOS_HIDDEN_MASK;
    if (system) raw |= FILE_ATTR_MSDOS_SYSTEM_MASK;
    if (msdDir) raw |= FILE_ATTR_MSDOS_DIR_MASK;
    if (archive) raw |= FILE_ATTR_MSDOS_ARCHIVE_MASK;
    msdosAttributesRaw = raw & MAX_8_BITS;
  }
  if (msdosAttributes === UNDEFINED_VALUE) {
    msdosAttributes = {
      readOnly: Boolean(msdosAttributesRaw & FILE_ATTR_MSDOS_READONLY_MASK),
      hidden: Boolean(msdosAttributesRaw & FILE_ATTR_MSDOS_HIDDEN_MASK),
      system: Boolean(msdosAttributesRaw & FILE_ATTR_MSDOS_SYSTEM_MASK),
      directory: Boolean(msdosAttributesRaw & FILE_ATTR_MSDOS_DIR_MASK),
      archive: Boolean(msdosAttributesRaw & FILE_ATTR_MSDOS_ARCHIVE_MASK)
    };
  }
  return { msdosAttributesRaw, msdosAttributes };
}
function getDataDescriptorInfo({
  zip64,
  dataDescriptor,
  dataDescriptorSignature
}) {
  let dataDescriptorArray = EMPTY_UINT8_ARRAY;
  let dataDescriptorView, dataDescriptorOffset = 0;
  let dataDescriptorLength = zip64 ? DATA_DESCRIPTOR_RECORD_ZIP_64_LENGTH : DATA_DESCRIPTOR_RECORD_LENGTH;
  if (dataDescriptorSignature) {
    dataDescriptorLength += DATA_DESCRIPTOR_RECORD_SIGNATURE_LENGTH;
  }
  if (dataDescriptor) {
    dataDescriptorArray = new Uint8Array(dataDescriptorLength);
    dataDescriptorView = getDataView(dataDescriptorArray);
    if (dataDescriptorSignature) {
      dataDescriptorOffset = DATA_DESCRIPTOR_RECORD_SIGNATURE_LENGTH;
      setUint32(dataDescriptorView, 0, DATA_DESCRIPTOR_RECORD_SIGNATURE);
    }
  }
  return {
    dataDescriptorArray,
    dataDescriptorView,
    dataDescriptorOffset
  };
}
function setEntryInfo({
  crc32,
  compressedSize,
  uncompressedSize,
  headerInfo,
  dataDescriptorInfo
}, {
  zip64,
  zipCrypto,
  passThrough,
  dataDescriptor
}) {
  const {
    headerView,
    encrypted
  } = headerInfo;
  const {
    dataDescriptorView,
    dataDescriptorOffset
  } = dataDescriptorInfo;
  if ((!encrypted || zipCrypto || passThrough) && crc32 !== UNDEFINED_VALUE) {
    setUint32(headerView, HEADER_OFFSET_SIGNATURE, crc32);
    if (dataDescriptor) {
      setUint32(dataDescriptorView, dataDescriptorOffset, crc32);
    }
  }
  if (zip64) {
    if (dataDescriptor) {
      setBigUint64(dataDescriptorView, dataDescriptorOffset + 4, BigInt(compressedSize));
      setBigUint64(dataDescriptorView, dataDescriptorOffset + 12, BigInt(uncompressedSize));
    }
  } else {
    setUint32(headerView, HEADER_OFFSET_COMPRESSED_SIZE, compressedSize);
    setUint32(headerView, HEADER_OFFSET_UNCOMPRESSED_SIZE, uncompressedSize);
    if (dataDescriptor) {
      setUint32(dataDescriptorView, dataDescriptorOffset + 4, compressedSize);
      setUint32(dataDescriptorView, dataDescriptorOffset + 8, uncompressedSize);
    }
  }
}
function updateLocalHeader({
  rawFilename,
  encrypted,
  zip64,
  localExtraFieldZip64Length,
  crc32,
  compressedSize,
  uncompressedSize,
  zip64UncompressedSize,
  zip64CompressedSize
}, localHeaderView, { dataDescriptor, passThrough }) {
  if (!dataDescriptor) {
    if (!encrypted || passThrough && crc32 !== UNDEFINED_VALUE) {
      setUint32(localHeaderView, HEADER_OFFSET_SIGNATURE + LOCAL_HEADER_COMMON_OFFSET, crc32);
    }
    if (!zip64CompressedSize) {
      setUint32(localHeaderView, HEADER_OFFSET_COMPRESSED_SIZE + LOCAL_HEADER_COMMON_OFFSET, compressedSize);
    }
    if (!zip64UncompressedSize) {
      setUint32(localHeaderView, HEADER_OFFSET_UNCOMPRESSED_SIZE + LOCAL_HEADER_COMMON_OFFSET, uncompressedSize);
    }
  }
  if (zip64 && localExtraFieldZip64Length) {
    const localHeaderOffset = HEADER_SIZE + getLength(rawFilename) + 4;
    setBigUint64(localHeaderView, localHeaderOffset, BigInt(uncompressedSize));
    setBigUint64(localHeaderView, localHeaderOffset + 8, BigInt(compressedSize));
  }
}
async function closeFile(zipWriter, comment, options) {
  const directoryDataLength = createDirectoryRecords(zipWriter.fileEntries);
  const { directoryStart, directoryEnd, directoryArray } = await writeDirectoryRecords(zipWriter, directoryDataLength, options);
  const signatureLength = await writeDigitalSignatureRecord(zipWriter, directoryArray, options);
  await writeEndOfDirectoryRecord(zipWriter, comment, options, { directoryStart, directoryEnd, directoryDataLength, signatureLength });
}
function createDirectoryRecords(files) {
  let directoryDataLength = 0;
  for (const [, fileEntry] of files) {
    const {
      rawFilename,
      rawExtraFieldAES,
      rawComment,
      rawExtraFieldNTFS,
      rawExtraFieldUnix,
      rawExtraField,
      rawCentralExtraField,
      extendedTimestamp,
      extraFieldExtendedTimestampFlag,
      lastModDate,
      zip64UncompressedSize,
      zip64CompressedSize,
      uncompressedSize,
      compressedSize
    } = fileEntry;
    const zip64Offset = fileEntry.offset >= MAX_32_BITS;
    const zip64DiskNumberStart = fileEntry.diskNumberStart >= MAX_16_BITS;
    let rawExtraFieldZip64;
    if (zip64Offset || zip64DiskNumberStart || zip64UncompressedSize || zip64CompressedSize) {
      const length = 4 + (zip64UncompressedSize ? 8 : 0) + (zip64CompressedSize ? 8 : 0) + (zip64Offset ? 8 : 0) + (zip64DiskNumberStart ? 4 : 0);
      const extraFieldZip64 = createRecordWriter(length);
      extraFieldZip64.writeUint16(EXTRAFIELD_TYPE_ZIP64);
      extraFieldZip64.writeUint16(length - 4);
      if (zip64UncompressedSize) {
        extraFieldZip64.writeUint64(uncompressedSize);
      }
      if (zip64CompressedSize) {
        extraFieldZip64.writeUint64(compressedSize);
      }
      if (zip64Offset) {
        extraFieldZip64.writeUint64(fileEntry.offset);
      }
      if (zip64DiskNumberStart) {
        extraFieldZip64.writeUint32(fileEntry.diskNumberStart);
      }
      rawExtraFieldZip64 = extraFieldZip64.array;
    } else {
      rawExtraFieldZip64 = EMPTY_UINT8_ARRAY;
    }
    fileEntry.rawExtraFieldZip64 = rawExtraFieldZip64;
    fileEntry.zip64Offset = zip64Offset;
    fileEntry.zip64DiskNumberStart = zip64DiskNumberStart;
    let rawExtraFieldTimestamp;
    const lastModTimeUnix = getTimeUnix(lastModDate);
    if (extendedTimestamp && inUnixTimeRange(lastModTimeUnix)) {
      const extraFieldTimestamp = createRecordWriter(9);
      extraFieldTimestamp.writeUint16(EXTRAFIELD_TYPE_EXTENDED_TIMESTAMP);
      extraFieldTimestamp.writeUint16(5);
      extraFieldTimestamp.writeUint8(extraFieldExtendedTimestampFlag);
      extraFieldTimestamp.writeUint32(lastModTimeUnix);
      rawExtraFieldTimestamp = extraFieldTimestamp.array;
    } else {
      rawExtraFieldTimestamp = EMPTY_UINT8_ARRAY;
    }
    fileEntry.rawExtraFieldExtendedTimestamp = rawExtraFieldTimestamp;
    const extraFieldLength = getLength(
      rawExtraFieldZip64,
      rawExtraFieldAES,
      rawExtraFieldNTFS,
      rawExtraFieldUnix,
      rawExtraFieldTimestamp,
      rawExtraField,
      rawCentralExtraField
    );
    if (extraFieldLength > MAX_16_BITS) {
      throw new Error(ERR_INVALID_EXTRAFIELD_DATA);
    }
    directoryDataLength += CENTRAL_FILE_HEADER_LENGTH + getLength(rawFilename, rawComment) + extraFieldLength;
  }
  return directoryDataLength;
}
async function writeDirectoryRecords(zipWriter, directoryDataLength, options) {
  const { fileEntries, writer } = zipWriter;
  const directoryArray = new Uint8Array(directoryDataLength);
  await initStream(writer);
  let offset = 0;
  let directoryDiskOffset = 0;
  let directoryStartDiskNumber = getDiskNumber(writer);
  let directoryStartDiskOffset = getDiskOffset(writer);
  let directoryEndDiskEntriesLength = 0;
  for (const [indexFileEntry, fileEntry] of Array.from(fileEntries.values()).entries()) {
    const {
      offset: fileEntryOffset,
      rawFilename,
      rawExtraFieldZip64,
      rawExtraFieldAES,
      rawExtraFieldExtendedTimestamp,
      rawExtraFieldNTFS,
      rawExtraFieldUnix,
      rawExtraField,
      rawCentralExtraField,
      rawComment,
      versionMadeBy,
      headerArray,
      headerView,
      zip64UncompressedSize,
      zip64CompressedSize,
      zip64DiskNumberStart,
      zip64Offset,
      internalFileAttributes,
      externalFileAttributes,
      diskNumberStart,
      uncompressedSize,
      compressedSize
    } = fileEntry;
    const extraFieldLength = getLength(rawExtraFieldZip64, rawExtraFieldAES, rawExtraFieldExtendedTimestamp, rawExtraFieldNTFS, rawExtraFieldUnix, rawExtraField, rawCentralExtraField);
    const directoryRecordLength = CENTRAL_FILE_HEADER_LENGTH + getLength(rawFilename, rawComment) + extraFieldLength;
    if (exceedsAvailableSize(writer, offset + directoryRecordLength - directoryDiskOffset)) {
      await writeData(writer, directoryArray.slice(directoryDiskOffset, offset));
      directoryDiskOffset = offset;
      directoryEndDiskEntriesLength = 0;
      await writer.closeDisk();
    }
    if (indexFileEntry == 0) {
      directoryStartDiskNumber = getDiskNumber(writer);
      directoryStartDiskOffset = getDiskOffset(writer);
    }
    if (!zip64UncompressedSize) {
      setUint32(headerView, HEADER_OFFSET_UNCOMPRESSED_SIZE, uncompressedSize);
    }
    if (!zip64CompressedSize) {
      setUint32(headerView, HEADER_OFFSET_COMPRESSED_SIZE, compressedSize);
    }
    if ((zip64Offset || zip64DiskNumberStart) && fileEntry.version < VERSION_ZIP64) {
      setUint16(headerView, HEADER_OFFSET_VERSION, VERSION_ZIP64);
    }
    const directoryRecord = createRecordWriter(directoryRecordLength);
    directoryRecord.writeUint32(CENTRAL_FILE_HEADER_SIGNATURE);
    directoryRecord.writeUint16(versionMadeBy);
    directoryRecord.writeBytes(headerArray.subarray(0, HEADER_SIZE - 4 - 2));
    directoryRecord.writeUint16(extraFieldLength);
    directoryRecord.writeUint16(getLength(rawComment));
    directoryRecord.writeUint16(zip64DiskNumberStart ? MAX_16_BITS : diskNumberStart);
    directoryRecord.writeUint16(internalFileAttributes);
    directoryRecord.writeUint32(externalFileAttributes);
    directoryRecord.writeUint32(zip64Offset ? MAX_32_BITS : fileEntryOffset);
    directoryRecord.writeBytes(rawFilename);
    directoryRecord.writeBytes(rawExtraFieldZip64);
    directoryRecord.writeBytes(rawExtraFieldAES);
    directoryRecord.writeBytes(rawExtraFieldExtendedTimestamp);
    directoryRecord.writeBytes(rawExtraFieldNTFS);
    directoryRecord.writeBytes(rawExtraFieldUnix);
    directoryRecord.writeBytes(rawExtraField);
    directoryRecord.writeBytes(rawCentralExtraField);
    directoryRecord.writeBytes(rawComment);
    arraySet(directoryArray, directoryRecord.array, offset);
    offset += directoryRecordLength;
    directoryEndDiskEntriesLength++;
    if (options.onprogress) {
      try {
        await options.onprogress(indexFileEntry + 1, fileEntries.size, new Entry(fileEntry));
      } catch {
      }
    }
  }
  await writeData(writer, directoryDiskOffset ? directoryArray.slice(directoryDiskOffset) : directoryArray);
  return {
    directoryStart: { diskNumber: directoryStartDiskNumber, diskOffset: directoryStartDiskOffset },
    directoryEnd: { diskNumber: getDiskNumber(writer), entriesLength: directoryEndDiskEntriesLength },
    directoryArray
  };
}
async function writeDigitalSignatureRecord(zipWriter, directoryArray, options) {
  const signCentralDirectory = getFunctionOptionValue(zipWriter, options, OPTION_SIGN_CENTRAL_DIRECTORY);
  if (signCentralDirectory) {
    const signatureData = await signCentralDirectory(directoryArray);
    const signatureDataLength = getLength(signatureData);
    if (signatureDataLength > MAX_16_BITS) {
      throw new Error(ERR_INVALID_SIGNATURE_DATA);
    }
    const signatureRecord = createRecordWriter(6 + signatureDataLength);
    signatureRecord.writeUint32(DIGITAL_SIGNATURE_RECORD_SIGNATURE);
    signatureRecord.writeUint16(signatureDataLength);
    signatureRecord.writeBytes(signatureData);
    const { writer } = zipWriter;
    if (exceedsAvailableSize(writer, getLength(signatureRecord.array))) {
      await writer.closeDisk();
    }
    await writeData(writer, signatureRecord.array);
    return 6 + signatureDataLength;
  }
  return 0;
}
async function writeEndOfDirectoryRecord(zipWriter, comment, options, cdInfo) {
  const { writer } = zipWriter;
  const { directoryStart, directoryEnd, signatureLength } = cdInfo;
  let { directoryDataLength } = cdInfo;
  let fileEntriesLength = zipWriter.fileEntries.size;
  let diskNumber = directoryStart.diskNumber;
  let directoryOffset = getSegmentOffset(zipWriter, directoryStart);
  const commentLength = getLength(comment);
  if (commentLength > MAX_16_BITS) {
    throw new Error(ERR_INVALID_COMMENT);
  }
  let zip64 = getOptionValue(zipWriter, options, PROPERTY_NAME_ZIP64);
  let lastDiskNumber = getDiskNumber(writer);
  if (exceedsAvailableSize(writer, (zip64 ? ZIP64_END_OF_CENTRAL_DIR_TOTAL_LENGTH : END_OF_CENTRAL_DIR_LENGTH) + commentLength)) {
    lastDiskNumber++;
  }
  if (directoryOffset >= MAX_32_BITS || directoryDataLength >= MAX_32_BITS || fileEntriesLength >= MAX_16_BITS || lastDiskNumber >= MAX_16_BITS) {
    if (zip64 === false) {
      throw new Error(ERR_UNSUPPORTED_FORMAT);
    } else {
      zip64 = true;
    }
  }
  const endOfdirectoryRecord = createRecordWriter(zip64 ? ZIP64_END_OF_CENTRAL_DIR_TOTAL_LENGTH : END_OF_CENTRAL_DIR_LENGTH);
  if (exceedsAvailableSize(writer, getLength(endOfdirectoryRecord.array) + commentLength)) {
    await writer.closeDisk();
  }
  lastDiskNumber = getDiskNumber(writer);
  let diskFileEntriesLength = lastDiskNumber == directoryEnd.diskNumber ? directoryEnd.entriesLength : 0;
  if (zip64) {
    endOfdirectoryRecord.writeUint32(ZIP64_END_OF_CENTRAL_DIR_SIGNATURE);
    endOfdirectoryRecord.writeUint64(44);
    endOfdirectoryRecord.writeUint16(45);
    endOfdirectoryRecord.writeUint16(45);
    endOfdirectoryRecord.writeUint32(lastDiskNumber);
    endOfdirectoryRecord.writeUint32(diskNumber);
    endOfdirectoryRecord.writeUint64(diskFileEntriesLength);
    endOfdirectoryRecord.writeUint64(fileEntriesLength);
    endOfdirectoryRecord.writeUint64(directoryDataLength);
    endOfdirectoryRecord.writeUint64(directoryOffset);
    endOfdirectoryRecord.writeUint32(ZIP64_END_OF_CENTRAL_DIR_LOCATOR_SIGNATURE);
    endOfdirectoryRecord.writeUint32(lastDiskNumber);
    endOfdirectoryRecord.writeUint64(BigInt(getSegmentOffset(zipWriter, writer)) + BigInt(directoryDataLength) + BigInt(signatureLength));
    endOfdirectoryRecord.writeUint32(lastDiskNumber + 1);
    const supportZip64SplitFile = getOptionValue(zipWriter, options, OPTION_SUPPORT_ZIP64_SPLIT_FILE, true);
    if (supportZip64SplitFile) {
      lastDiskNumber = MAX_16_BITS;
      diskNumber = MAX_16_BITS;
    }
    diskFileEntriesLength = MAX_16_BITS;
    fileEntriesLength = MAX_16_BITS;
    directoryOffset = MAX_32_BITS;
    directoryDataLength = MAX_32_BITS;
  }
  endOfdirectoryRecord.writeUint32(END_OF_CENTRAL_DIR_SIGNATURE);
  endOfdirectoryRecord.writeUint16(lastDiskNumber);
  endOfdirectoryRecord.writeUint16(diskNumber);
  endOfdirectoryRecord.writeUint16(diskFileEntriesLength);
  endOfdirectoryRecord.writeUint16(fileEntriesLength);
  endOfdirectoryRecord.writeUint32(directoryDataLength);
  endOfdirectoryRecord.writeUint32(directoryOffset);
  endOfdirectoryRecord.writeUint16(commentLength);
  await writeData(writer, endOfdirectoryRecord.array);
  if (commentLength) {
    await writeData(writer, comment);
  }
}
function createRecordWriter(length) {
  const array = new Uint8Array(length);
  const view = getDataView(array);
  let offset = 0;
  return {
    array,
    writeUint8: (value) => {
      setUint8(view, offset, value);
      offset += 1;
    },
    writeUint16: (value) => {
      setUint16(view, offset, value);
      offset += 2;
    },
    writeUint32: (value) => {
      setUint32(view, offset, value);
      offset += 4;
    },
    writeUint64: (value) => {
      setBigUint64(view, offset, BigInt(value));
      offset += 8;
    },
    writeBytes: (value) => {
      arraySet(array, value, offset);
      offset += getLength(value);
    },
    skip: (count) => offset += count
  };
}
function getDiskNumber(writer) {
  const { diskNumber = 0 } = writer;
  return diskNumber;
}
function getDiskOffset(writer) {
  const { diskOffset = 0 } = writer;
  return diskOffset;
}
function exceedsAvailableSize(writer, length) {
  const { availableSize = INFINITY_VALUE } = writer;
  return length > availableSize;
}
function getSegmentOffset(zipWriter, { diskNumber = 0, diskOffset = 0 }) {
  return zipWriter.offset - diskOffset - (diskNumber ? zipWriter.initialOffset : 0);
}
async function startsWithSplitZipSignature(reader) {
  const signatureArray = await readUint8Array(reader, 0, SPLIT_ZIP_FILE_SIGNATURE_LENGTH);
  return getUint32(getDataView(signatureArray), 0) == SPLIT_ZIP_FILE_SIGNATURE;
}
function removeExtraFieldZip64(rawExtraField) {
  const rawExtraFieldView = getDataView(rawExtraField);
  let offsetExtraField = 0;
  while (offsetExtraField + 4 <= getLength(rawExtraField)) {
    const size = 4 + getUint16(rawExtraFieldView, offsetExtraField + 2);
    if (getUint16(rawExtraFieldView, offsetExtraField) == EXTRAFIELD_TYPE_ZIP64) {
      return removeExtraFieldZip64(concat(
        rawExtraField.subarray(0, offsetExtraField),
        rawExtraField.subarray(Math.min(offsetExtraField + size, getLength(rawExtraField)))
      ));
    }
    offsetExtraField += size;
  }
  return rawExtraField;
}
async function copyZipData(zipWriter, reader, entries, directoryOffset) {
  const { writer } = zipWriter;
  const entryPositions = /* @__PURE__ */ new Map();
  if (writer.closeDisk) {
    const sortedEntries = Array.from(entries).sort((firstEntry, secondEntry) => getSourceOffset(reader, firstEntry) - getSourceOffset(reader, secondEntry));
    let copiedLength = 0;
    for (const entry of sortedEntries) {
      const sourceOffset = getSourceOffset(reader, entry);
      await copyData(zipWriter, reader, copiedLength, sourceOffset - copiedLength);
      if (exceedsAvailableSize(writer, await getLocalHeaderLength(reader, sourceOffset))) {
        await writer.closeDisk();
      }
      entryPositions.set(entry, {
        offset: getSegmentOffset(zipWriter, writer),
        diskNumberStart: getDiskNumber(writer)
      });
      copiedLength = sourceOffset;
    }
    await copyData(zipWriter, reader, copiedLength, directoryOffset - copiedLength);
  } else {
    const baseOffset = zipWriter.offset;
    await copyData(zipWriter, reader, 0, directoryOffset);
    entries.forEach((entry) => entryPositions.set(entry, {
      offset: baseOffset + getSourceOffset(reader, entry),
      diskNumberStart: 0
    }));
  }
  return entryPositions;
}
async function copyData(zipWriter, reader, offset, size) {
  if (size > 0) {
    const { writer } = zipWriter;
    let copiedLength = 0;
    try {
      await flushBufferedData(createReadable(reader, { offset, size }), writer, UNDEFINED_VALUE, (chunkLength) => copiedLength += chunkLength);
    } catch (error) {
      zipWriter.hasCorruptedEntries = true;
      try {
        error.corruptedEntry = true;
      } catch {
      }
      throw error;
    } finally {
      writer.size += copiedLength;
      zipWriter.offset += copiedLength;
    }
  }
}
async function getLocalHeaderLength(reader, offset) {
  const headerArray = await readUint8Array(reader, offset, HEADER_SIZE);
  if (getLength(headerArray) < HEADER_SIZE) {
    return HEADER_SIZE;
  }
  const headerView = getDataView(headerArray);
  return HEADER_SIZE + getUint16(headerView, HEADER_OFFSET_FILENAME_LENGTH + LOCAL_HEADER_COMMON_OFFSET) + getUint16(headerView, HEADER_OFFSET_EXTRAFIELD_LENGTH + LOCAL_HEADER_COMMON_OFFSET);
}
function getSourceOffset(reader, { offset, diskNumberStart }) {
  return offset + (reader.getDiskOffset ? reader.getDiskOffset(diskNumberStart) : 0);
}
function getSplitZipSignatureArray() {
  const signatureArray = new Uint8Array(SPLIT_ZIP_FILE_SIGNATURE_LENGTH);
  setUint32(getDataView(signatureArray), 0, SPLIT_ZIP_FILE_SIGNATURE);
  return signatureArray;
}
async function writeSplitZipSignature(zipWriter, writer) {
  delete zipWriter.addSplitZipSignature;
  await writeData(writer, getSplitZipSignatureArray());
  zipWriter.offset += SPLIT_ZIP_FILE_SIGNATURE_LENGTH;
}
async function writeData(writer, array) {
  const { writable } = writer;
  const streamWriter = writable.getWriter();
  try {
    await streamWriter.ready;
    writer.size += getLength(array);
    await streamWriter.write(array);
  } finally {
    streamWriter.releaseLock();
  }
}
async function flushBufferedData(readable, writer, signal, onChunkWritten) {
  const streamWriter = writer.writable.getWriter();
  try {
    await readable.pipeTo(new WritableStream({
      async write(chunk) {
        await streamWriter.ready;
        await streamWriter.write(chunk);
        onChunkWritten(getLength(chunk));
      }
    }), { preventClose: true, preventAbort: true, signal });
  } finally {
    streamWriter.releaseLock();
  }
}
function getTimeNTFS(date) {
  if (date) {
    const timeNTFS = (BigInt(date.getTime()) + BigInt(116444736e5)) * BigInt(1e4);
    return timeNTFS < MIN_NTFS_TIME ? MIN_NTFS_TIME : timeNTFS > MAX_NTFS_TIME ? MAX_NTFS_TIME : timeNTFS;
  }
}
function getTimeUnix(date) {
  return Math.floor(date.getTime() / 1e3);
}
function inUnixTimeRange(timeUnix) {
  return timeUnix >= MIN_UNIX_TIME && timeUnix <= MAX_UNIX_TIME;
}
function clampUnixTime(timeUnix) {
  return Math.min(MAX_UNIX_TIME, Math.max(MIN_UNIX_TIME, timeUnix));
}
function getOptionValue(zipWriter, options, name, defaultValue) {
  const result = options[name] === UNDEFINED_VALUE ? zipWriter.options[name] : options[name];
  return result === UNDEFINED_VALUE ? defaultValue : result;
}
function getDateOptionValue(zipWriter, options, name, defaultValue) {
  const date = getOptionValue(zipWriter, options, name, defaultValue);
  if (date === null) {
    return defaultValue;
  }
  if (date !== UNDEFINED_VALUE && (typeof date.getTime != FUNCTION_TYPE || Number.isNaN(date.getTime()))) {
    throw new Error(ERR_INVALID_DATE);
  }
  return date;
}
function getFunctionOptionValue(zipWriter, options, name) {
  return checkFunctionOption(getOptionValue(zipWriter, options, name));
}
function getAliasedOptionValue(zipWriter, options, name, deprecatedName, defaultValue) {
  const value = getAliasedValue(options, name, deprecatedName);
  const result = value === UNDEFINED_VALUE ? getAliasedValue(zipWriter.options, name, deprecatedName) : value;
  return result === UNDEFINED_VALUE ? defaultValue : result;
}
function getAliasedValue(options, name, deprecatedName) {
  return options[name] === UNDEFINED_VALUE ? options[deprecatedName] : options[name];
}
function getNumberOptionValue(zipWriter, options, name, defaultValue) {
  return toNumber(getOptionValue(zipWriter, options, name, defaultValue));
}
function getMaximumCompressedSize(uncompressedSize) {
  return uncompressedSize + 5 * (Math.floor(uncompressedSize / 16383) + 1);
}
function isCompressed(compressionMethod, level) {
  return compressionMethod === UNDEFINED_VALUE ? level === UNDEFINED_VALUE || level > 0 : compressionMethod !== COMPRESSION_METHOD_STORE;
}
function getUint16(view, offset) {
  return view.getUint16(offset, true);
}
function getUint32(view, offset) {
  return view.getUint32(offset, true);
}
function setUint8(view, offset, value) {
  view.setUint8(offset, value);
}
function setUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}
function setUint32(view, offset, value) {
  view.setUint32(offset, value, true);
}
function setBigUint64(view, offset, value) {
  view.setBigUint64(offset, value, true);
}
function arraySet(array, typedArray, offset) {
  array.set(typedArray, offset);
}
function getLength(...arrayLikes) {
  let result = 0;
  arrayLikes.forEach((arrayLike) => arrayLike && (result += arrayLike.length));
  return result;
}
function getHeaderArrayData({
  version,
  bitFlag,
  compressionMethod,
  uncompressedSize,
  compressedSize,
  lastModDate,
  rawLastModDate,
  rawFilename,
  zip64CompressedSize,
  zip64UncompressedSize,
  extraFieldLength
}) {
  const headerRecord = createRecordWriter(HEADER_SIZE - 4);
  const headerArray = headerRecord.array;
  const headerView = getDataView(headerArray);
  headerRecord.writeUint16(version);
  headerRecord.writeUint16(bitFlag);
  headerRecord.writeUint16(compressionMethod);
  if (rawLastModDate === UNDEFINED_VALUE) {
    const dateArray = new Uint32Array(1);
    const dateView = getDataView(dateArray);
    setUint16(dateView, 0, (lastModDate.getHours() << 6 | lastModDate.getMinutes()) << 5 | lastModDate.getSeconds() / 2);
    setUint16(dateView, 2, (lastModDate.getFullYear() - 1980 << 4 | lastModDate.getMonth() + 1) << 5 | lastModDate.getDate());
    rawLastModDate = dateArray[0];
  }
  headerRecord.writeUint32(rawLastModDate);
  headerRecord.skip(4);
  if (zip64CompressedSize || compressedSize !== UNDEFINED_VALUE) {
    headerRecord.writeUint32(zip64CompressedSize ? MAX_32_BITS : compressedSize);
  } else {
    headerRecord.skip(4);
  }
  if (zip64UncompressedSize || uncompressedSize !== UNDEFINED_VALUE) {
    headerRecord.writeUint32(zip64UncompressedSize ? MAX_32_BITS : uncompressedSize);
  } else {
    headerRecord.skip(4);
  }
  headerRecord.writeUint16(getLength(rawFilename));
  headerRecord.writeUint16(extraFieldLength);
  return {
    headerArray,
    headerView,
    rawLastModDate
  };
}
function getBitFlag(level, useUnicodeFileNames, dataDescriptor, encrypted, compressionMethod) {
  let bitFlag = 0;
  if (useUnicodeFileNames) {
    bitFlag = bitFlag | BITFLAG_LANG_ENCODING_FLAG;
  }
  if (dataDescriptor) {
    bitFlag = bitFlag | BITFLAG_DATA_DESCRIPTOR;
  }
  if (compressionMethod == COMPRESSION_METHOD_DEFLATE || compressionMethod == COMPRESSION_METHOD_DEFLATE_64) {
    if (level >= 0 && level <= 3) {
      bitFlag = bitFlag | BITFLAG_LEVEL_SUPER_FAST_MASK;
    }
    if (level > 3 && level <= 5) {
      bitFlag = bitFlag | BITFLAG_LEVEL_FAST_MASK;
    }
    if (level == 9) {
      bitFlag = bitFlag | BITFLAG_LEVEL_MAX_MASK;
    }
  }
  if (encrypted) {
    bitFlag = bitFlag | BITFLAG_ENCRYPTED;
  }
  return bitFlag;
}

// node_modules/@zip.js/zip.js/lib/core/util/default-mime-type.js
function getMimeType() {
  return "application/octet-stream";
}

// node_modules/@zip.js/zip.js/lib/core/compression-methods.js
function getSupportedCompressionMethods() {
  const { CompressionStream, DecompressionStream, CompressionStreamFallback, DecompressionStreamFallback } = getConfiguration();
  const supportedMethods = [{
    compressionMethod: COMPRESSION_METHOD_STORE,
    compression: true,
    decompression: true,
    registered: false
  }, {
    compressionMethod: COMPRESSION_METHOD_DEFLATE,
    compression: formatSupported(CompressionStreamFallback, FORMAT_DEFLATE_RAW) || formatSupported(CompressionStream, FORMAT_DEFLATE_RAW) || formatSupported(CompressionStream, FORMAT_GZIP),
    decompression: formatSupported(DecompressionStreamFallback, FORMAT_DEFLATE_RAW) || formatSupported(DecompressionStream, FORMAT_DEFLATE_RAW) || formatSupported(DecompressionStream, FORMAT_GZIP),
    registered: false
  }, {
    compressionMethod: COMPRESSION_METHOD_DEFLATE_64,
    compression: false,
    decompression: formatSupported(DecompressionStreamFallback, FORMAT_DEFLATE64_RAW) || formatSupported(DecompressionStream, FORMAT_DEFLATE64_RAW),
    registered: false
  }];
  for (const codec of getRegisteredCodecs()) {
    const codecStreams = getCodecStreams(codec.format);
    supportedMethods.push({
      compressionMethod: codec.compressionMethod,
      // deno-lint-ignore valid-typeof
      compression: codecStreams ? typeof codecStreams.CompressionStream == FUNCTION_TYPE : UNDEFINED_VALUE,
      // deno-lint-ignore valid-typeof
      decompression: codecStreams ? typeof codecStreams.DecompressionStream == FUNCTION_TYPE : UNDEFINED_VALUE,
      registered: true
    });
  }
  return supportedMethods;
}
function formatSupported(StreamClass, format) {
  if (!StreamClass) {
    return false;
  }
  const { supportedFormats } = StreamClass;
  if (supportedFormats) {
    return supportedFormats.includes(format);
  }
  return supportsFormat(StreamClass, format);
}

// node_modules/@zip.js/zip.js/lib/core/version.js
var VERSION = "2.9.0";

// node_modules/@zip.js/zip.js/lib/core/util/opfs-temp-stream.js
var DEFAULT_THRESHOLD = 1024 * 1024;
var DEFAULT_DIRECTORY_NAME = ".zip.js-temp";
function createOPFSTempStream(options = {}) {
  const {
    thresholdBytes = DEFAULT_THRESHOLD,
    directoryName = DEFAULT_DIRECTORY_NAME,
    getDirectory = () => navigator.storage.getDirectory()
  } = options;
  let directoryHandlePromise;
  function getTempDirectory() {
    if (!directoryHandlePromise) {
      directoryHandlePromise = Promise.resolve(getDirectory()).then((root) => root.getDirectoryHandle(directoryName, { create: true }));
    }
    return directoryHandlePromise;
  }
  return function() {
    const memoryChunks = [];
    let bufferedSize = 0;
    let spilled = false;
    let fileName, fileHandle, fileWriter, fileReader;
    async function spillToFile() {
      const directoryHandle = await getTempDirectory();
      fileName = getRandomFileName();
      fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
      fileWriter = (await fileHandle.createWritable()).getWriter();
      spilled = true;
      for (const chunk of memoryChunks) {
        await fileWriter.write(chunk);
      }
      memoryChunks.length = 0;
    }
    const writable = new WritableStream({
      async write(chunk) {
        if (spilled) {
          await fileWriter.write(chunk);
        } else {
          memoryChunks.push(chunk);
          bufferedSize += chunk.length;
          if (bufferedSize > thresholdBytes) {
            await spillToFile();
          }
        }
      },
      async close() {
        if (fileWriter) {
          await fileWriter.close();
          fileWriter = null;
        }
      }
    });
    let memoryIndex = 0;
    const readable = new ReadableStream({
      async pull(controller) {
        if (spilled) {
          if (!fileReader) {
            const file = await fileHandle.getFile();
            fileReader = file.stream().getReader();
          }
          const { value, done } = await fileReader.read();
          if (done) {
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } else if (memoryIndex < memoryChunks.length) {
          controller.enqueue(memoryChunks[memoryIndex++]);
        } else {
          controller.close();
        }
      },
      async cancel(reason) {
        if (fileReader) {
          await fileReader.cancel(reason);
        }
      }
    }, { highWaterMark: 0 });
    async function dispose() {
      if (fileWriter) {
        try {
          await fileWriter.close();
        } catch {
        }
        fileWriter = null;
      }
      if (fileName) {
        try {
          const directoryHandle = await getTempDirectory();
          await directoryHandle.removeEntry(fileName);
        } catch {
        }
        fileHandle = fileName = null;
      }
      memoryChunks.length = 0;
    }
    return { writable, readable, dispose };
  };
}
function getRandomFileName() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byteValue) => byteValue.toString(16).padStart(2, "0")).join("");
}

// node_modules/@zip.js/zip.js/lib/core/util/blob-temp-stream.js
var DEFAULT_THRESHOLD2 = 1024 * 1024;
function createBlobTempStream(options = {}) {
  const {
    thresholdBytes = DEFAULT_THRESHOLD2
  } = options;
  return function() {
    const memoryChunks = [];
    let bufferedSize = 0;
    let spilled = false;
    let blobWriter, blobPromise, blobReader;
    async function spillToBlob() {
      const transformStream = new TransformStream();
      blobPromise = streamToBlob(transformStream.readable);
      blobWriter = transformStream.writable.getWriter();
      spilled = true;
      for (const chunk of memoryChunks) {
        await blobWriter.write(chunk);
      }
      memoryChunks.length = 0;
    }
    const writable = new WritableStream({
      async write(chunk) {
        if (spilled) {
          await blobWriter.write(chunk);
        } else {
          memoryChunks.push(chunk);
          bufferedSize += chunk.length;
          if (bufferedSize > thresholdBytes) {
            await spillToBlob();
          }
        }
      },
      async close() {
        if (blobWriter) {
          await blobWriter.close();
          blobWriter = null;
        }
      }
    });
    let memoryIndex = 0;
    const readable = new ReadableStream({
      async pull(controller) {
        if (spilled) {
          if (!blobReader) {
            const blob = await blobPromise;
            blobReader = blob.stream().getReader();
          }
          const { value, done } = await blobReader.read();
          if (done) {
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } else if (memoryIndex < memoryChunks.length) {
          controller.enqueue(memoryChunks[memoryIndex++]);
        } else {
          controller.close();
        }
      },
      async cancel(reason) {
        if (blobReader) {
          await blobReader.cancel(reason);
        }
      }
    }, { highWaterMark: 0 });
    async function dispose() {
      if (blobWriter) {
        try {
          await blobWriter.abort();
        } catch {
        }
        blobWriter = null;
      }
      if (blobPromise) {
        blobPromise.catch(() => {
        });
        blobPromise = null;
      }
      memoryChunks.length = 0;
    }
    return { writable, readable, dispose };
  };
}

// node_modules/@zip.js/zip.js/lib/core/util/sync-access-handle-temp-stream.js
var DEFAULT_THRESHOLD3 = 1024 * 1024;
var DEFAULT_DIRECTORY_NAME2 = ".zip.js-temp";
var READ_CHUNK_SIZE = 512 * 1024;
var ERR_UNSUPPORTED_CONTEXT = "createSyncAccessHandle is only available in dedicated workers";
function createSyncAccessHandleTempStream(options = {}) {
  const {
    thresholdBytes = DEFAULT_THRESHOLD3,
    directoryName = DEFAULT_DIRECTORY_NAME2,
    getDirectory
  } = options;
  if (!getDirectory && (typeof FileSystemFileHandle == "undefined" || !FileSystemFileHandle.prototype.createSyncAccessHandle)) {
    throw new Error(ERR_UNSUPPORTED_CONTEXT);
  }
  const getRootDirectory = getDirectory || (() => navigator.storage.getDirectory());
  let directoryHandlePromise;
  function getTempDirectory() {
    if (!directoryHandlePromise) {
      directoryHandlePromise = Promise.resolve(getRootDirectory()).then((root) => root.getDirectoryHandle(directoryName, { create: true }));
    }
    return directoryHandlePromise;
  }
  return function() {
    const memoryChunks = [];
    let bufferedSize = 0;
    let spilled = false;
    let fileName, accessHandle;
    let writeOffset = 0;
    let readOffset = 0;
    async function spillToFile() {
      const directoryHandle = await getTempDirectory();
      fileName = getRandomFileName2();
      const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
      accessHandle = await fileHandle.createSyncAccessHandle();
      spilled = true;
      for (const chunk of memoryChunks) {
        accessHandle.write(chunk, { at: writeOffset });
        writeOffset += chunk.length;
      }
      memoryChunks.length = 0;
    }
    const writable = new WritableStream({
      async write(chunk) {
        if (spilled) {
          accessHandle.write(chunk, { at: writeOffset });
          writeOffset += chunk.length;
        } else {
          memoryChunks.push(chunk);
          bufferedSize += chunk.length;
          if (bufferedSize > thresholdBytes) {
            await spillToFile();
          }
        }
      },
      close() {
        if (accessHandle) {
          accessHandle.flush();
        }
      }
    });
    let memoryIndex = 0;
    const readable = new ReadableStream({
      pull(controller) {
        if (spilled) {
          const remaining = writeOffset - readOffset;
          if (remaining <= 0) {
            controller.close();
            return;
          }
          const buffer = new Uint8Array(Math.min(READ_CHUNK_SIZE, remaining));
          const read = accessHandle.read(buffer, { at: readOffset });
          if (read) {
            readOffset += read;
            controller.enqueue(buffer.subarray(0, read));
          } else {
            controller.close();
          }
        } else if (memoryIndex < memoryChunks.length) {
          controller.enqueue(memoryChunks[memoryIndex++]);
        } else {
          controller.close();
        }
      }
    }, { highWaterMark: 0 });
    async function dispose() {
      if (accessHandle) {
        try {
          accessHandle.close();
        } catch {
        }
        accessHandle = null;
      }
      if (fileName) {
        try {
          const directoryHandle = await getTempDirectory();
          await directoryHandle.removeEntry(fileName);
        } catch {
        }
        fileName = null;
      }
      memoryChunks.length = 0;
    }
    return { writable, readable, dispose };
  };
}
function getRandomFileName2() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byteValue) => byteValue.toString(16).padStart(2, "0")).join("");
}

// node_modules/@zip.js/zip.js/lib/zip-core-base.js
try {
  setDefaultConfiguration({ baseURI: import.meta.url });
} catch {
}

// node_modules/@zip.js/zip.js/lib/core/zlib-streams-inline.js
var n2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
var c = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
var f = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
var s = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
var t2 = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
var u = new Uint8Array(288);
u.fill(8, 0, 144), u.fill(9, 144, 256), u.fill(7, 256, 280), u.fill(8, 280, 288);
var z = new Uint8Array(30).fill(5);
function r(n3) {
  const c2 = new Uint16Array(16);
  for (const f3 of n3) c2[f3]++;
  c2[0] = 0;
  const f2 = new Uint16Array(17);
  for (let n4 = 1; n4 <= 15; n4++) f2[n4 + 1] = f2[n4] + c2[n4];
  const s2 = new Uint16Array(n3.length);
  for (let c3 = 0; c3 < n3.length; c3++) n3[c3] && (s2[f2[n3[c3]]++] = c3);
  return { l: c2, symbols: s2 };
}
var e2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function l(l2) {
  let U;
  l2({ wasmURI: () => (U || (U = "data:application/wasm;base64," + (function(n3) {
    let c2 = "";
    const f2 = n3.length;
    let s2 = 0;
    for (; s2 + 2 < f2; s2 += 3) {
      const f3 = n3[s2] << 16 | n3[s2 + 1] << 8 | n3[s2 + 2];
      c2 += e2[f3 >> 18 & 63] + e2[f3 >> 12 & 63] + e2[f3 >> 6 & 63] + e2[63 & f3];
    }
    const t3 = f2 - s2;
    if (1 === t3) {
      const f3 = n3[s2] << 16;
      c2 += e2[f3 >> 18 & 63] + e2[f3 >> 12 & 63] + "==";
    } else if (2 === t3) {
      const f3 = n3[s2] << 16 | n3[s2 + 1] << 8;
      c2 += e2[f3 >> 18 & 63] + e2[f3 >> 12 & 63] + e2[f3 >> 6 & 63] + "=";
    }
    return c2;
  })((function(e3) {
    let l3 = 0, U2 = 0, o = 0, i = new Uint8Array(1024), a = 0, y = 0;
    for (; !y; ) {
      y = w(1);
      const n3 = w(2);
      if (0 == n3) V();
      else if (1 == n3) j(r(u), r(z));
      else {
        if (2 != n3) throw new Error("invalid deflate block type");
        j(...m());
      }
    }
    return i.subarray(0, a);
    function b() {
      if (l3 >= e3.length) throw new Error("unexpected end of deflate data");
      return e3[l3++];
    }
    function w(n3) {
      for (; o < n3; ) U2 |= b() << o, o += 8;
      const c2 = U2 & (1 << n3) - 1;
      return U2 >>>= n3, o -= n3, c2;
    }
    function V() {
      U2 = 0, o = 0;
      const n3 = b() | b() << 8;
      l3 += 2, L(a + n3);
      for (let c2 = 0; c2 < n3; c2++) i[a++] = b();
    }
    function j(t3, u2) {
      let z2 = q(t3);
      for (; 256 != z2; ) {
        if (z2 < 256) L(a + 1), i[a++] = z2;
        else {
          const t4 = z2 - 257, r2 = n2[t4] + w(c[t4]), e4 = q(u2), l4 = f[e4] + w(s[e4]);
          L(a + r2);
          const U3 = a - l4;
          for (let n3 = 0; n3 < r2; n3++) i[a++] = i[U3 + n3];
        }
        z2 = q(t3);
      }
    }
    function m() {
      const n3 = w(5) + 257, c2 = w(5) + 1, f2 = w(4) + 4, s2 = new Uint8Array(19);
      for (let n4 = 0; n4 < f2; n4++) s2[t2[n4]] = w(3);
      const u2 = r(s2), z2 = new Uint8Array(n3 + c2);
      let e4 = 0;
      for (; e4 < z2.length; ) {
        const n4 = q(u2);
        if (n4 < 16) z2[e4++] = n4;
        else if (16 == n4) {
          const n5 = z2[e4 - 1];
          let c3 = w(2) + 3;
          for (; c3--; ) z2[e4++] = n5;
        } else e4 += 17 == n4 ? w(3) + 3 : w(7) + 11;
      }
      return [r(z2.subarray(0, n3)), r(z2.subarray(n3))];
    }
    function q(n3) {
      const { l: c2, symbols: f2 } = n3;
      let s2 = 0, t3 = 0, u2 = 0;
      for (let n4 = 1; n4 <= 15; n4++) {
        s2 |= w(1);
        const z2 = c2[n4];
        if (s2 - t3 < z2) return f2[u2 + (s2 - t3)];
        u2 += z2, t3 = t3 + z2 << 1, s2 <<= 1;
      }
      throw new Error("invalid huffman code");
    }
    function L(n3) {
      if (i.length < n3) {
        let c2 = 2 * i.length;
        for (; c2 < n3; ) c2 *= 2;
        const f2 = new Uint8Array(c2);
        f2.set(i.subarray(0, a)), i = f2;
      }
    }
  })((function(n3) {
    const c2 = (n3 = String(n3).replace(/[^A-Za-z0-9+/=]/g, "")).length, f2 = [];
    for (let s2 = 0; s2 < c2; s2 += 4) {
      const c3 = e2.indexOf(n3[s2]) << 18 | e2.indexOf(n3[s2 + 1]) << 12 | (63 & e2.indexOf(n3[s2 + 2])) << 6 | 63 & e2.indexOf(n3[s2 + 3]);
      f2.push(c3 >> 16 & 255), "=" !== n3[s2 + 2] && f2.push(c3 >> 8 & 255), "=" !== n3[s2 + 3] && f2.push(255 & c3);
    }
    return new Uint8Array(f2);
  })("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")))), U) });
}

// node_modules/@zip.js/zip.js/lib/core/streams/zlib-wasm/zlib-streams.js
var FORMAT_DEFLATE = "deflate";
var FORMAT_DEFLATE_RAW2 = "deflate-raw";
var FORMAT_DEFLATE64_RAW2 = "deflate64-raw";
var FORMAT_GZIP2 = "gzip";
var wasm;
var malloc;
var free;
var memory;
var initError;
function setWasmExports(wasmAPI) {
  wasm = wasmAPI;
  ({ malloc, free, memory } = wasm);
  if (typeof malloc !== "function" || typeof free !== "function" || !memory) {
    wasm = malloc = free = memory = null;
    throw new Error("Invalid WASM module");
  }
}
function setInitError(error) {
  initError = error;
}
function resetWasmExports() {
  wasm = malloc = free = memory = initError = null;
}
function _make(isCompress, type, options = {}) {
  if (!wasm) {
    const error = new Error("WASM module not loaded");
    error.cause = initError;
    throw error;
  }
  const level = typeof options.level === "number" ? options.level : -1;
  const outBufferSize = typeof options.outBuffer === "number" ? options.outBuffer : 64 * 1024;
  const inBufferSize = typeof options.inBufferSize === "number" ? options.inBufferSize : 64 * 1024;
  return new TransformStream({
    start() {
      try {
        let result;
        this.out = malloc(outBufferSize);
        this.in = malloc(inBufferSize);
        this.inBufferSize = inBufferSize;
        if (!this.out || !this.in) {
          throw new Error("allocation failed");
        }
        this._scratch = new Uint8Array(outBufferSize);
        if (isCompress) {
          this._process = wasm.deflate_process;
          this._last_consumed = wasm.deflate_last_consumed;
          this._end = wasm.deflate_end;
          this.streamHandle = wasm.deflate_new();
          if (type === FORMAT_GZIP2) {
            result = wasm.deflate_init_gzip(this.streamHandle, level);
          } else if (type === FORMAT_DEFLATE_RAW2) {
            result = wasm.deflate_init_raw(this.streamHandle, level);
          } else {
            result = wasm.deflate_init(this.streamHandle, level);
          }
        } else {
          if (type === FORMAT_DEFLATE64_RAW2) {
            this._process = wasm.inflate9_process;
            this._last_consumed = wasm.inflate9_last_consumed;
            this._end = wasm.inflate9_end;
            this.streamHandle = wasm.inflate9_new();
            result = wasm.inflate9_init_raw(this.streamHandle);
          } else {
            this._process = wasm.inflate_process;
            this._last_consumed = wasm.inflate_last_consumed;
            this._end = wasm.inflate_end;
            this.streamHandle = wasm.inflate_new();
            if (type === FORMAT_DEFLATE_RAW2) {
              result = wasm.inflate_init_raw(this.streamHandle);
            } else if (type === FORMAT_GZIP2) {
              result = wasm.inflate_init_gzip(this.streamHandle);
            } else {
              result = wasm.inflate_init(this.streamHandle);
            }
          }
        }
        if (result !== 0) {
          throw new Error("init failed:" + result);
        }
      } catch (error) {
        disposeStream(this);
        throw error;
      }
    },
    transform(chunk, controller) {
      try {
        const buffer = chunk;
        const heap = new Uint8Array(memory.buffer);
        const process = this._process;
        const last_consumed = this._last_consumed;
        const out = this.out;
        const scratch = this._scratch;
        let offset = 0;
        while (offset < buffer.length) {
          const toRead = Math.min(buffer.length - offset, 32 * 1024);
          if (!this.in || this.inBufferSize < toRead) {
            if (this.in && free) {
              free(this.in);
              this.in = 0;
            }
            this.in = malloc(toRead);
            this.inBufferSize = toRead;
            if (!this.in) {
              throw new Error("allocation failed");
            }
          }
          heap.set(buffer.subarray(offset, offset + toRead), this.in);
          const result = process(this.streamHandle, this.in, toRead, out, outBufferSize, 0);
          const prod = result & 16777215;
          if (prod) {
            scratch.set(heap.subarray(out, out + prod), 0);
            controller.enqueue(scratch.slice(0, prod));
          }
          if (!isCompress) {
            const code = result >> 24 & 255;
            const signedCode = code & 128 ? code - 256 : code;
            if (signedCode < 0) {
              throw new Error("process error:" + signedCode);
            }
          }
          const consumed = last_consumed(this.streamHandle);
          if (consumed === 0) {
            break;
          }
          offset += consumed;
        }
      } catch (error) {
        disposeStream(this);
        controller.error(error);
      }
    },
    flush(controller) {
      try {
        const heap = new Uint8Array(memory.buffer);
        const process = this._process;
        const out = this.out;
        const scratch = this._scratch;
        while (true) {
          const result = process(this.streamHandle, 0, 0, out, outBufferSize, 4);
          const produced = result & 16777215;
          const code = result >> 24 & 255;
          if (!isCompress) {
            const signedCode = code & 128 ? code - 256 : code;
            if (signedCode < 0) {
              throw new Error("process error:" + signedCode);
            }
          }
          if (produced) {
            scratch.set(heap.subarray(out, out + produced), 0);
            controller.enqueue(scratch.slice(0, produced));
          }
          if (code === 1 || produced === 0) {
            break;
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        const result = disposeStream(this);
        if (result !== 0) {
          controller.error(new Error("end error:" + result));
        }
      }
    },
    cancel() {
      disposeStream(this);
    }
  });
  function disposeStream(state) {
    let endResult = 0;
    if (state.streamHandle && state._end) {
      endResult = state._end(state.streamHandle);
    }
    state.streamHandle = 0;
    if (state.in && free) {
      free(state.in);
    }
    state.in = 0;
    if (state.out && free) {
      free(state.out);
    }
    state.out = 0;
    return endResult;
  }
}
var CompressionStreamZlib = class {
  constructor(type = FORMAT_DEFLATE, options) {
    return _make(true, type, options);
  }
};
var DecompressionStreamZlib = class {
  constructor(type = FORMAT_DEFLATE, options) {
    return _make(false, type, options);
  }
};
CompressionStreamZlib.requiresModule = true;
DecompressionStreamZlib.requiresModule = true;
CompressionStreamZlib.supportedFormats = [FORMAT_DEFLATE, FORMAT_DEFLATE_RAW2, FORMAT_GZIP2];
DecompressionStreamZlib.supportedFormats = [FORMAT_DEFLATE, FORMAT_DEFLATE_RAW2, FORMAT_GZIP2, FORMAT_DEFLATE64_RAW2];

// node_modules/@zip.js/zip.js/lib/core/streams/zlib-wasm/zlib-streams-loader.js
var initializedModule = false;
async function initModule(wasmURI, { baseURI }) {
  if (!initializedModule) {
    try {
      await instantiateModule(wasmURI, baseURI);
      initializedModule = true;
    } catch (error) {
      setInitError(error);
      throw error;
    }
  }
}
async function instantiateModule(wasmURI, baseURI) {
  let arrayBuffer, uri;
  try {
    try {
      uri = new URL(wasmURI, baseURI);
    } catch {
    }
    const response = await fetch(uri);
    arrayBuffer = await response.arrayBuffer();
  } catch (error) {
    if (wasmURI.startsWith("data:application/wasm;base64,")) {
      arrayBuffer = arrayBufferFromDataURI(wasmURI);
    } else {
      throw error;
    }
  }
  const wasmInstance = await WebAssembly.instantiate(arrayBuffer);
  setWasmExports(wasmInstance.instance.exports);
}
function resetWasmModule() {
  initializedModule = false;
  resetWasmExports();
}
function arrayBufferFromDataURI(dataURI) {
  const base64 = dataURI.split(",")[1];
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; ++i) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// node_modules/@zip.js/zip.js/lib/zip-module-wasm-base.js
var modulePromise;
configureWorker({
  initModule: (config) => {
    if (!modulePromise) {
      let { wasmURI } = config;
      if (typeof wasmURI == FUNCTION_TYPE) {
        wasmURI = wasmURI();
      }
      modulePromise = initModule(wasmURI, config).catch((error) => {
        modulePromise = null;
        throw error;
      });
    }
    return modulePromise;
  }
});
setDefaultConfiguration({
  CompressionStreamFallback: CompressionStreamZlib,
  DecompressionStreamFallback: DecompressionStreamZlib
});
function terminateWorkersAndModule() {
  modulePromise = null;
  terminateWorkers();
  resetWasmModule();
}

// node_modules/@zip.js/zip.js/lib/zip-module-wasm.js
l(setDefaultConfiguration);

// node_modules/@zip.js/zip.js/lib/core/zip-fs.js
var ERR_ENTRY_EXISTS = "Entry filename already exists";
var ERR_READABLE_CONSUMED = "Readable stream already consumed";
var ERR_INVALID_PASS_THROUGH = "Invalid passThrough option (use readerOptions.passThrough or set uncompressedSize for each entry)";
var ERR_INVALID_READER_OPTIONS = "Invalid readerOptions (must be an object)";
var ERR_ZIP_CRYPTO_LAST_MOD_DATE = "The last modification date of an entry encrypted with ZipCrypto cannot be changed when passThrough is set";
var ERR_ABORT_EXPORT = "zipjs-abort-export";
var ERR_ABORTED = "The operation was aborted";
var ABORT_ERROR_NAME = "AbortError";
var INFOZIP_EXTRA_FIELD_TYPE2 = "infozip";
var INTERPRETED_EXTRA_FIELD_TYPES = /* @__PURE__ */ new Set([
  EXTRAFIELD_TYPE_ZIP64,
  EXTRAFIELD_TYPE_AES,
  EXTRAFIELD_TYPE_NTFS,
  EXTRAFIELD_TYPE_EXTENDED_TIMESTAMP,
  EXTRAFIELD_TYPE_UNICODE_PATH,
  EXTRAFIELD_TYPE_UNICODE_COMMENT,
  EXTRAFIELD_TYPE_USDZ,
  EXTRAFIELD_TYPE_INFOZIP,
  EXTRAFIELD_TYPE_UNIX,
  EXTRAFIELD_TYPE_UNIX_TYPE1,
  EXTRAFIELD_TYPE_PKWARE_UNIX
]);
var ZipEntry = class {
  constructor(fs2, name, params, parent) {
    const zipEntry = this;
    if (fs2.root && parent && parent.getChildByName(name)) {
      throw new Error(ERR_ENTRY_EXISTS);
    }
    if (!params) {
      params = {};
    }
    Object.assign(zipEntry, {
      fs: fs2,
      name,
      data: params.data,
      options: params.options && Object.assign({}, params.options),
      id: fs2.entryIdCounter++,
      parent,
      children: [],
      uncompressedSize: params.uncompressedSize || 0,
      undeterminedSize: params.undeterminedSize || params.uncompressedSize === UNDEFINED_VALUE,
      passThrough: params.passThrough,
      defaultLastModDate: params.defaultLastModDate || /* @__PURE__ */ new Date()
    });
    if (parent || !fs2.root) {
      fs2.entries[zipEntry.id] = zipEntry;
    }
    if (parent) {
      zipEntry.parent.children.push(zipEntry);
    }
  }
  getFullname() {
    return this.getRelativeName();
  }
  getRelativeName(ancestor = this.fs.root) {
    const zipEntry = this;
    let relativeName = zipEntry.name;
    let entry = zipEntry.parent;
    while (entry && entry != ancestor) {
      relativeName = (entry.name ? entry.name + "/" : "") + relativeName;
      entry = entry.parent;
    }
    return relativeName;
  }
  isDescendantOf(ancestor) {
    let entry = this.parent;
    while (entry && entry.id != ancestor.id) {
      entry = entry.parent;
    }
    return Boolean(entry);
  }
  rename(name) {
    const parent = this.parent;
    if (parent && parent.getChildByName(name)) {
      throw new Error(ERR_ENTRY_EXISTS);
    } else {
      this.name = name;
    }
  }
  setOptions(options) {
    const entryOptions = Object.assign({}, this.options, options);
    this.options = Object.fromEntries(Object.entries(entryOptions).filter(([, value]) => value !== UNDEFINED_VALUE));
  }
};
var ZipFileEntry = class _ZipFileEntry extends ZipEntry {
  constructor(fs2, name, params, parent) {
    super(fs2, name, params, parent);
    const zipEntry = this;
    zipEntry.Reader = params.Reader;
    zipEntry.Writer = params.Writer;
    if (params.getData) {
      zipEntry.getData = params.getData;
    }
  }
  clone() {
    return new _ZipFileEntry(this.fs, this.name, this);
  }
  async getData(writer, options = {}) {
    const zipEntry = this;
    if (!writer || writer.constructor == zipEntry.Writer && zipEntry.data && keepsContentType(writer, zipEntry.data)) {
      return zipEntry.data;
    } else {
      const reader = zipEntry.reader = createReader(zipEntry.Reader, zipEntry.data, options);
      const dataSize = zipEntry.uncompressedSize || reader.size;
      await Promise.all([initStream(reader), initStream(writer, dataSize)]);
      const signal = checkSignalOption(options.signal);
      const readable = createProgressReadable(zipEntry, reader, options, signal);
      const preventClose = !ownsWritable(writer) && Boolean(options.preventClose);
      zipEntry.uncompressedSize = reader.size;
      await toCompatibleReadable(readable).pipeTo(toCompatibleWritable(writer.writable), { signal, preventClose, preventAbort: preventClose });
      return writer.getData ? writer.getData() : writer.writable;
    }
  }
  isPasswordProtected() {
    return Boolean(this.data && this.data.encrypted);
  }
  async checkPassword(password, options = {}) {
    const zipEntry = this;
    if (zipEntry.isPasswordProtected()) {
      try {
        await zipEntry.data.getData(null, Object.assign({}, options, {
          password,
          checkPasswordOnly: true
        }));
        return true;
      } catch (error) {
        if (error.message == ERR_INVALID_PASSWORD) {
          return false;
        } else {
          throw error;
        }
      }
    } else {
      return true;
    }
  }
  getText(encoding, options) {
    return this.getData(new TextWriter(encoding), options);
  }
  getBlob(mimeType, options) {
    return this.getData(new BlobWriter(mimeType), options);
  }
  getData64URI(mimeType, options) {
    return this.getData(new Data64URIWriter(mimeType), options);
  }
  getUint8Array(options) {
    return this.getData(new Uint8ArrayWriter(), options);
  }
  getWritable(writable = new WritableStream(), options) {
    return this.getData({ writable }, options);
  }
  async getArrayBuffer(options) {
    const array = await this.getUint8Array(options);
    return toExactUint8Array(array).buffer;
  }
  replaceBlob(blob) {
    Object.assign(this, {
      data: blob,
      Reader: BlobReader,
      Writer: BlobWriter,
      reader: null
    });
  }
  replaceText(text) {
    Object.assign(this, {
      data: text,
      Reader: TextReader,
      Writer: TextWriter,
      reader: null
    });
  }
  replaceData64URI(dataURI) {
    Object.assign(this, {
      data: dataURI,
      Reader: Data64URIReader,
      Writer: Data64URIWriter,
      reader: null
    });
  }
  replaceUint8Array(array) {
    Object.assign(this, {
      data: array,
      Reader: Uint8ArrayReader,
      Writer: Uint8ArrayWriter,
      reader: null
    });
  }
  replaceReadable(readable) {
    Object.assign(this, {
      data: null,
      Reader: getReadableReader(readable),
      Writer: null,
      reader: null
    });
  }
};
var ZipDirectoryEntry = class _ZipDirectoryEntry extends ZipEntry {
  constructor(fs2, name, params, parent) {
    super(fs2, name, params, parent);
    this.directory = true;
  }
  clone(deepClone) {
    const zipEntry = this;
    const clonedEntry = new _ZipDirectoryEntry(zipEntry.fs, zipEntry.name, zipEntry);
    if (deepClone) {
      clonedEntry.children = zipEntry.children.map((child) => {
        const childClone = child.clone(deepClone);
        childClone.parent = clonedEntry;
        return childClone;
      });
    }
    return clonedEntry;
  }
  addDirectory(name, options) {
    return addChild(this, name, { options }, true);
  }
  addText(name, text, options = {}) {
    return addChild(this, name, {
      data: text,
      Reader: TextReader,
      Writer: TextWriter,
      options,
      uncompressedSize: getTextSize(text)
    });
  }
  addBlob(name, blob, options = {}) {
    return addChild(this, name, {
      data: blob,
      Reader: BlobReader,
      Writer: BlobWriter,
      options,
      uncompressedSize: blob.size
    });
  }
  addData64URI(name, dataURI, options = {}) {
    let dataEnd = dataURI.length;
    while (dataURI.charAt(dataEnd - 1) == "=") {
      dataEnd--;
    }
    const dataStart = dataURI.indexOf(",") + 1;
    return addChild(this, name, {
      data: dataURI,
      Reader: Data64URIReader,
      Writer: Data64URIWriter,
      options,
      uncompressedSize: Math.floor((dataEnd - dataStart) * 0.75)
    });
  }
  addUint8Array(name, array, options = {}) {
    return addChild(this, name, {
      data: array,
      Reader: Uint8ArrayReader,
      Writer: Uint8ArrayWriter,
      options,
      uncompressedSize: array.length
    });
  }
  addHttpContent(name, url, options = {}) {
    return addChild(this, name, {
      data: url,
      Reader: class extends HttpReader {
        constructor(url2) {
          super(url2, options);
        }
      },
      options
    });
  }
  addReadable(name, readable, options = {}) {
    return addChild(this, name, {
      Reader: getReadableReader(readable),
      options
    });
  }
  addFileSystemEntry(fileSystemEntry, options = {}) {
    return addFileSystemHandle(this, fileSystemEntry, options);
  }
  addFileSystemHandle(handle, options = {}) {
    return addFileSystemHandle(this, handle, options);
  }
  addFile(file, options = {}) {
    options = Object.assign({}, options);
    if (!options.lastModDate) {
      options.lastModDate = new Date(file.lastModified);
    }
    return addChild(this, file.name, {
      data: file,
      Reader: function() {
        const readable = file.stream();
        const size = file.size;
        return { readable, size };
      },
      options,
      uncompressedSize: file.size
    });
  }
  importBlob(blob, options) {
    return this.importZip(new BlobReader(blob), options);
  }
  importData64URI(dataURI, options) {
    return this.importZip(new Data64URIReader(dataURI), options);
  }
  importUint8Array(array, options) {
    return this.importZip(new Uint8ArrayReader(array), options);
  }
  importHttpContent(url, options) {
    return this.importZip(new HttpReader(url, options), options);
  }
  importReadable(readable, options) {
    return this.importZip({ readable }, options);
  }
  exportBlob(options = {}) {
    return this.exportZip(new BlobWriter(options.mimeType || "application/zip"), options);
  }
  exportData64URI(options = {}) {
    return this.exportZip(new Data64URIWriter(options.mimeType || "application/zip"), options);
  }
  exportUint8Array(options = {}) {
    return this.exportZip(new Uint8ArrayWriter(), options);
  }
  async exportWritable(writable = new WritableStream(), options = {}) {
    await this.exportZip({ writable }, options);
    return writable;
  }
  exportFileSystemHandle(handle, options = {}) {
    return exportFileSystemHandle(this, handle, options);
  }
  async importZip(reader, options = {}) {
    let zipReader;
    if (reader && typeof reader.getEntries == FUNCTION_TYPE) {
      zipReader = reader;
      options = Object.assign({}, zipReader.options, options);
    } else {
      await initStream(reader);
      zipReader = new ZipReader(reader, options);
    }
    const importedEntries = [];
    const entries = await zipReader.getEntries(options);
    for (const entry of entries) {
      let parent = this;
      try {
        const path = entry.filename.split("/").filter((pathPart) => pathPart != "" && pathPart != ".");
        const name = path.pop();
        path.forEach((pathPart) => {
          const previousParent = parent;
          parent = parent.getChildByName(pathPart);
          if (parent) {
            if (!parent.directory) {
              throw new Error(ERR_ENTRY_EXISTS);
            }
          } else {
            parent = new _ZipDirectoryEntry(this.fs, pathPart, { data: null }, previousParent);
            importedEntries.push(parent);
          }
        });
        if (!entry.directory) {
          importedEntries.push(addChild(parent, name, {
            data: entry,
            Reader: getZipBlobReader(Object.assign({}, options)),
            uncompressedSize: options.passThrough ? entry.compressedSize : entry.uncompressedSize,
            passThrough: options.passThrough
          }));
        } else {
          let directoryEntry = parent;
          if (name) {
            directoryEntry = parent.getChildByName(name);
            if (directoryEntry) {
              if (!directoryEntry.directory) {
                throw new Error(ERR_ENTRY_EXISTS);
              }
            } else {
              directoryEntry = new _ZipDirectoryEntry(this.fs, name, { data: null }, parent);
              importedEntries.push(directoryEntry);
            }
          }
          if (directoryEntry != this && !directoryEntry.data) {
            directoryEntry.data = entry;
          }
        }
      } catch (error) {
        try {
          error.cause = {
            entry
          };
        } catch {
        }
        throw error;
      }
    }
    return importedEntries;
  }
  async exportZip(writer, options = {}) {
    const zipEntry = this;
    options = Object.assign({}, options);
    if (options.bufferedWrite === UNDEFINED_VALUE) {
      options.bufferedWrite = true;
    }
    const [readers] = await Promise.all([initReaders(zipEntry, checkReaderOptions(options.readerOptions)), initStream(writer)]);
    const zipWriter = new ZipWriter(writer, options);
    await exportZip(zipWriter, zipEntry, getTotalSize([zipEntry], getUncompressedSize), options, readers);
    await zipWriter.close(options.globalComment);
    return writer.getData ? writer.getData() : writer.writable;
  }
  getExportedSize(options = {}) {
    const zipEntry = this;
    options = Object.assign({}, options);
    checkReaderOptions(options.readerOptions);
    if (options.bufferedWrite === UNDEFINED_VALUE) {
      options.bufferedWrite = true;
    }
    const entries = zipEntry.getChildren({ recursive: true }).filter((child) => !isImplicitDirectory(child)).map((child) => {
      const { name, entryOptions } = getChildEntryOptions(child, zipEntry, options);
      return { name, size: child.directory ? 0 : getDeterminedSize(child, isPassThrough(child, options)), options: entryOptions };
    });
    const writeOrderGuaranteed = !options.bufferedWrite || entries.every((entry) => entry.options.keepOrder !== false) && zipEntry.children.every((child) => !child.children.length);
    return getEntriesSize(options, entries, writeOrderGuaranteed, options.globalComment);
  }
  getChildByName(name) {
    const children = this.children;
    for (let childIndex = 0; childIndex < children.length; childIndex++) {
      const child = children[childIndex];
      if (child.name == name) {
        return child;
      }
    }
  }
  getChildren(options = {}) {
    return collectChildren(this, options.recursive);
  }
  isPasswordProtected() {
    const children = this.children;
    for (let childIndex = 0; childIndex < children.length; childIndex++) {
      const child = children[childIndex];
      if (child.isPasswordProtected()) {
        return true;
      }
    }
    return false;
  }
  async checkPassword(password, options = {}) {
    const children = this.children;
    const result = await Promise.all(children.map((child) => child.checkPassword(password, options)));
    return !result.includes(false);
  }
};
var ZipFS = class {
  constructor() {
    resetFS(this);
  }
  get children() {
    return this.root.children;
  }
  remove(entry) {
    detach(entry);
    const removedEntries = [entry];
    while (removedEntries.length) {
      const removedEntry = removedEntries.pop();
      this.entries[removedEntry.id] = null;
      for (const child of removedEntry.children) {
        removedEntries.push(child);
      }
    }
    entry.parent = UNDEFINED_VALUE;
  }
  move(entry, destination) {
    if (entry == this.root) {
      throw new Error("Root directory cannot be moved");
    } else {
      if (destination.directory) {
        if (!destination.isDescendantOf(entry)) {
          if (entry != destination) {
            const existingChild = destination.getChildByName(entry.name);
            if (existingChild) {
              if (existingChild != entry) {
                throw new Error(ERR_ENTRY_EXISTS);
              }
            } else {
              detach(entry);
              entry.parent = destination;
              destination.children.push(entry);
              registerEntries(this, entry);
            }
          }
        } else {
          throw new Error("Entry is a ancestor of target entry");
        }
      } else {
        throw new Error("Target entry is not a directory");
      }
    }
  }
  find(fullname) {
    const path = fullname.split("/");
    let node = this.root;
    for (let index = 0; node && index < path.length; index++) {
      node = node.getChildByName(path[index]);
    }
    if (!node) {
      node = this.entries.find((entry) => entry && (entry == this.root || entry.isDescendantOf(this.root)) && entry.getRelativeName() == fullname);
    }
    return node;
  }
  getById(id) {
    return this.entries[id];
  }
  getChildByName(name) {
    return this.root.getChildByName(name);
  }
  getChildren(options) {
    return this.root.getChildren(options);
  }
  addDirectory(name, options) {
    return this.root.addDirectory(name, options);
  }
  addText(name, text, options) {
    return this.root.addText(name, text, options);
  }
  addBlob(name, blob, options) {
    return this.root.addBlob(name, blob, options);
  }
  addData64URI(name, dataURI, options) {
    return this.root.addData64URI(name, dataURI, options);
  }
  addUint8Array(name, array, options) {
    return this.root.addUint8Array(name, array, options);
  }
  addHttpContent(name, url, options) {
    return this.root.addHttpContent(name, url, options);
  }
  addReadable(name, readable, options) {
    return this.root.addReadable(name, readable, options);
  }
  addFileSystemEntry(fileSystemEntry, options) {
    return this.root.addFileSystemEntry(fileSystemEntry, options);
  }
  addFileSystemHandle(handle, options) {
    return this.root.addFileSystemHandle(handle, options);
  }
  addFile(file, options) {
    return this.root.addFile(file, options);
  }
  importBlob(blob, options) {
    resetFS(this);
    return this.root.importBlob(blob, options);
  }
  importData64URI(dataURI, options) {
    resetFS(this);
    return this.root.importData64URI(dataURI, options);
  }
  importUint8Array(array, options) {
    resetFS(this);
    return this.root.importUint8Array(array, options);
  }
  importHttpContent(url, options) {
    resetFS(this);
    return this.root.importHttpContent(url, options);
  }
  importReadable(readable, options) {
    resetFS(this);
    return this.root.importReadable(readable, options);
  }
  importZip(reader, options) {
    resetFS(this);
    return this.root.importZip(reader, options);
  }
  exportBlob(options) {
    return this.root.exportBlob(options);
  }
  exportData64URI(options) {
    return this.root.exportData64URI(options);
  }
  exportUint8Array(options) {
    return this.root.exportUint8Array(options);
  }
  exportWritable(writable, options) {
    return this.root.exportWritable(writable, options);
  }
  exportFileSystemHandle(handle, options) {
    return this.root.exportFileSystemHandle(handle, options);
  }
  exportZip(writer, options) {
    return this.root.exportZip(writer, options);
  }
  getExportedSize(options) {
    return this.root.getExportedSize(options);
  }
  isPasswordProtected() {
    return this.root.isPasswordProtected();
  }
  checkPassword(password, options) {
    return this.root.checkPassword(password, options);
  }
};
var fs = { FS: ZipFS, ZipDirectoryEntry, ZipFileEntry };
function getTotalSize(entries, getEntrySize) {
  let size = 0;
  const pendingEntries2 = Array.from(entries);
  while (pendingEntries2.length) {
    const entry = pendingEntries2.pop();
    size += getEntrySize(entry) || 0;
    for (const child of entry.children) {
      pendingEntries2.push(child);
    }
  }
  return size;
}
function getUncompressedSize(entry) {
  return entry.uncompressedSize;
}
function getExtractedSize(entry, passThrough) {
  const { data } = entry;
  return passThrough && data instanceof Entry ? data.compressedSize : entry.uncompressedSize;
}
function getReadableReader(readable) {
  let consumed;
  return function() {
    if (consumed) {
      throw new Error(ERR_READABLE_CONSUMED);
    }
    consumed = true;
    return { readable };
  };
}
function getZipBlobReader(options) {
  return class extends Reader {
    constructor(entry, options2 = {}) {
      super();
      this.entry = entry;
      this.options = options2;
    }
    async init() {
      const zipBlobReader = this;
      const readerOptions = Object.assign({}, options, zipBlobReader.options);
      const { checkOverlappingEntry, checkOverlappingEntryOnly } = readerOptions;
      const data = await zipBlobReader.entry.getData(new BlobWriter(), Object.assign(readerOptions, {
        checkPasswordOnly: false,
        checkOverlappingEntry: checkOverlappingEntryOnly || checkOverlappingEntry,
        checkOverlappingEntryOnly: false,
        preventClose: false
      }));
      zipBlobReader.data = data;
      zipBlobReader.blobReader = new BlobReader(data);
      zipBlobReader.size = data.size;
      super.init();
    }
    readUint8Array(index, length) {
      return this.blobReader.readUint8Array(index, length);
    }
  };
}
function createReader(Reader2, data, options) {
  return Reader2.prototype ? new Reader2(data, options) : Reader2(data, options);
}
function keepsContentType(writer, data) {
  const { contentType } = writer;
  if (contentType === UNDEFINED_VALUE) {
    return true;
  } else if (writer.constructor == BlobWriter) {
    return data.type == contentType;
  } else if (writer.constructor == Data64URIWriter) {
    return data.startsWith("data:" + (contentType || "") + ";base64,");
  } else {
    return true;
  }
}
function createProgressReadable(zipEntry, reader, options, signal) {
  const { onstart, onprogress, onend } = options;
  const { readable } = reader;
  const coreReaderReportsProgress = zipEntry.data instanceof Entry;
  if (coreReaderReportsProgress || !onstart && !onprogress && !onend) {
    return readable;
  } else {
    return toCompatibleReadable(readable).pipeThrough(new ProgressWatcherStream({ onstart, onprogress, onend, size: reader.size }), { signal });
  }
}
async function initReaders(entry, options) {
  const fileEntries = [];
  const pendingEntries2 = [entry];
  const readers = /* @__PURE__ */ new Map();
  while (pendingEntries2.length) {
    const pendingEntry = pendingEntries2.pop();
    for (const child of pendingEntry.children) {
      if (child.directory) {
        pendingEntries2.push(child);
      } else {
        fileEntries.push(child);
      }
    }
  }
  await Promise.all(fileEntries.map(async (child) => {
    const reader = child.reader = createReader(child.Reader, child.data, options);
    readers.set(child, reader);
    try {
      await initStream(reader);
    } catch (error) {
      try {
        error.entryId = child.id;
        error.cause = {
          entry: child
        };
      } catch {
      }
      throw error;
    }
    if (reader.size !== UNDEFINED_VALUE) {
      child.uncompressedSize = reader.size;
      child.undeterminedSize = false;
    }
  }));
  return readers;
}
function detach(entry) {
  if (entry.parent) {
    const children = entry.parent.children;
    children.forEach((child, index) => {
      if (child.id == entry.id) {
        children.splice(index, 1);
      }
    });
  }
}
function forwardAbort(signal, abortController) {
  if (!checkSignalOption(signal)) {
    return () => {
    };
  }
  if (signal.aborted) {
    abortController.abort(signal.reason);
    return () => {
    };
  }
  const abort = () => abortController.abort(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  return () => signal.removeEventListener("abort", abort);
}
function isExportAborted(error) {
  return Boolean(error) && error.message == ERR_ABORT_EXPORT;
}
function aggregateEntryErrors(errors) {
  const [error] = errors;
  const otherErrors = errors.slice(1).flatMap((otherError) => [otherError, ...otherError && otherError.entryErrors || []]).filter((otherError) => otherError !== error);
  if (otherErrors.length) {
    try {
      error.entryErrors = [...error.entryErrors || [], ...otherErrors];
    } catch {
    }
  }
  return error;
}
function getChildEntryOptions(child, selectedEntry, options) {
  const name = options.relativePath ? child.getRelativeName(selectedEntry) : child.getFullname();
  const childOptions = child.options || {};
  let zipEntryMetadata = {};
  let passThroughOptions = {};
  if (child.data instanceof Entry) {
    const {
      externalFileAttributes,
      versionMadeBy,
      comment,
      lastModDate,
      rawLastModDate,
      creationDate,
      lastAccessDate,
      uncompressedSize,
      encrypted,
      zipCrypto,
      crc32,
      compressionMethod,
      extraFieldAES,
      internalFileAttributes,
      extraField,
      bitFlag,
      uid,
      gid
    } = child.data;
    zipEntryMetadata = {
      externalFileAttributes,
      versionMadeBy,
      comment,
      lastModDate,
      creationDate,
      lastAccessDate,
      internalFileAttributes
    };
    const userExtraField = getUserExtraField(extraField);
    if (userExtraField) {
      zipEntryMetadata.extraField = userExtraField;
    }
    if (uid !== UNDEFINED_VALUE || gid !== UNDEFINED_VALUE) {
      Object.assign(zipEntryMetadata, {
        uid,
        gid,
        unixExtraFieldType: INFOZIP_EXTRA_FIELD_TYPE2
      });
    }
    if (isPassThrough(child, options)) {
      let encryptionStrength;
      if (extraFieldAES) {
        encryptionStrength = extraFieldAES.strength;
      }
      passThroughOptions = {
        passThrough: true,
        encrypted,
        zipCrypto,
        crc32,
        uncompressedSize,
        encryptionStrength,
        compressionMethod
      };
      if (bitFlag) {
        passThroughOptions.dataDescriptor = bitFlag.dataDescriptor;
      }
      const lastModDateOverride = childOptions.lastModDate === UNDEFINED_VALUE ? options.lastModDate : childOptions.lastModDate;
      if (lastModDateOverride === UNDEFINED_VALUE) {
        passThroughOptions.rawLastModDate = rawLastModDate;
      } else if (zipCrypto && (!bitFlag || bitFlag.dataDescriptor) && lastModDateOverride instanceof Date && getDosTimeHighByte(lastModDateOverride) != (rawLastModDate >>> 8 & MAX_8_BITS)) {
        throw new Error(ERR_ZIP_CRYPTO_LAST_MOD_DATE);
      }
    }
  }
  const entryOptions = Object.assign({ lastModDate: child.defaultLastModDate }, zipEntryMetadata, options, childOptions, passThroughOptions, { directory: child.directory });
  if (!child.directory && entryOptions.passThrough && entryOptions.uncompressedSize === UNDEFINED_VALUE) {
    throw new Error(ERR_INVALID_PASS_THROUGH);
  }
  return { name, entryOptions };
}
function getDosTimeHighByte(lastModDate) {
  let dosLastModDate = new Date(Math.ceil(Math.floor(lastModDate.getTime() / 1e3) / 2) * 2e3);
  if (dosLastModDate < MIN_DATE) {
    dosLastModDate = MIN_DATE;
  } else if (dosLastModDate > MAX_DATE) {
    dosLastModDate = MAX_DATE;
  }
  return (dosLastModDate.getHours() << 3 | dosLastModDate.getMinutes() >> 3) & MAX_8_BITS;
}
function getDeterminedSize(child, passThrough) {
  const { reader } = child;
  if (reader && reader.size !== UNDEFINED_VALUE) {
    return reader.size;
  }
  return child.undeterminedSize ? UNDEFINED_VALUE : getExtractedSize(child, passThrough);
}
function checkReaderOptions(readerOptions) {
  if (readerOptions && (typeof readerOptions != OBJECT_TYPE || Array.isArray(readerOptions))) {
    throw new Error(ERR_INVALID_READER_OPTIONS);
  }
  return readerOptions;
}
function isPassThrough(child, options) {
  const { readerOptions } = options;
  return Boolean(!child.directory && (child.passThrough || readerOptions && readerOptions.passThrough));
}
function isImplicitDirectory(child) {
  return child.directory && child.data === null;
}
function getUserExtraField(extraField) {
  if (extraField) {
    const userExtraField = /* @__PURE__ */ new Map();
    extraField.forEach((field, type) => {
      if (!INTERPRETED_EXTRA_FIELD_TYPES.has(type)) {
        userExtraField.set(type, field.data);
      }
    });
    if (userExtraField.size) {
      return userExtraField;
    }
  }
}
async function exportZip(zipWriter, entry, totalSize, options, readers) {
  const { onstart, onprogress, onend, onentryprogress } = options;
  const selectedEntry = entry;
  const totalEntries = getTotalSize(entry.children, (child) => isImplicitDirectory(child) ? 0 : 1);
  let writtenSize = 0;
  let writtenEntries = 0;
  if (onstart) {
    await callHandler(onstart, totalSize);
  }
  if (options.bufferedWrite) {
    await processChildren(entry);
  } else {
    for (const child of entry.getChildren({ recursive: true })) {
      await addChild2(child);
    }
  }
  if (onend) {
    await callHandler(onend, writtenSize);
  }
  async function processChildren(entry2) {
    const results = await Promise.allSettled(entry2.children.map(async (child) => {
      await addChild2(child);
      await processChildren(child);
    }));
    const errorResult = results.find((result) => result.status == "rejected");
    if (errorResult) {
      throw errorResult.reason;
    }
  }
  async function addChild2(child) {
    if (isImplicitDirectory(child)) {
      return;
    }
    const { name, entryOptions } = getChildEntryOptions(child, selectedEntry, options);
    let entryWrittenSize = 0;
    const entryMetadata = await zipWriter.add(name, readers.get(child), Object.assign(entryOptions, {
      onstart: UNDEFINED_VALUE,
      onend: UNDEFINED_VALUE,
      onprogress: async (indexProgress) => {
        writtenSize += indexProgress - entryWrittenSize;
        entryWrittenSize = indexProgress;
        if (onprogress) {
          await callHandler(onprogress, writtenSize, totalSize);
        }
      }
    }));
    writtenEntries++;
    if (onentryprogress) {
      await callHandler(onentryprogress, writtenEntries, totalEntries, entryMetadata);
    }
  }
}
function addFileSystemHandle(zipEntry, handle, options) {
  return addFile2(zipEntry, handle, []);
  async function addFile2(parentEntry, handle2, addedEntries, parentName = "") {
    if (handle2) {
      const entryName = parentName ? parentName + "/" + handle2.name : handle2.name;
      try {
        if (handle2.isFile || handle2.isDirectory) {
          handle2 = await transformToFileSystemhandle(handle2);
        }
        if (handle2.kind == "file") {
          const file = await handle2.getFile();
          addedEntries.push(
            addChild(parentEntry, file.name, {
              Reader: function() {
                const readable = file.stream();
                const size = file.size;
                return { readable, size };
              },
              options: Object.assign({}, { lastModDate: new Date(file.lastModified) }, options),
              uncompressedSize: file.size
            })
          );
        } else if (handle2.kind == "directory") {
          const directoryEntry = parentEntry.addDirectory(handle2.name, options);
          addedEntries.push(directoryEntry);
          for await (const childHandle of handle2.values()) {
            await addFile2(directoryEntry, childHandle, addedEntries, entryName);
          }
        }
      } catch (error) {
        try {
          if (error.entryName === UNDEFINED_VALUE) {
            error.entryName = entryName;
          }
        } catch {
        }
        throw error;
      }
    }
    return addedEntries;
  }
}
async function exportFileSystemHandle(zipEntry, directoryHandle, options) {
  const { onstart, onprogress, onend } = options;
  const readerOptions = checkReaderOptions(options.readerOptions);
  const abortController = new AbortController();
  const { signal } = abortController;
  const releaseSignal = forwardAbort(options.signal, abortController);
  const getDataOptions = Object.assign({}, options, readerOptions, {
    signal,
    onstart: UNDEFINED_VALUE,
    onprogress: UNDEFINED_VALUE,
    onend: UNDEFINED_VALUE,
    preventClose: false
  });
  const totalSize = getTotalSize([zipEntry], (entry) => getExtractedSize(entry, getDataOptions.passThrough));
  const exportedEntryNames = [];
  let exportAborted = false;
  let writtenSize = 0;
  try {
    if (onstart) {
      await callHandler(onstart, totalSize);
    }
    await exportChildren(zipEntry, directoryHandle);
    if (onend) {
      await callHandler(onend, writtenSize);
    }
  } catch (error) {
    try {
      error.exportedEntryNames = exportedEntryNames;
    } catch {
    }
    throw error;
  } finally {
    releaseSignal();
  }
  return directoryHandle;
  function createProgressWritable(writable) {
    const writer = writable.getWriter();
    return new WritableStream({
      async write(chunk) {
        await writer.write(chunk);
        writtenSize += chunk.length;
        if (onprogress) {
          await callHandler(onprogress, writtenSize, totalSize);
        }
      },
      close() {
        return writer.close();
      },
      abort(reason) {
        return writer.abort(reason);
      }
    });
  }
  async function exportChildren(entry, parentHandle) {
    if (options.concurrent) {
      const results = await Promise.allSettled(entry.children.map((child) => exportChild(child, parentHandle)));
      const rejectedResults = results.filter((result) => result.status == "rejected");
      if (rejectedResults.length) {
        const failedResults = rejectedResults.filter((result) => !isExportAborted(result.reason));
        const reportedResults = failedResults.length ? failedResults : rejectedResults;
        throw aggregateEntryErrors(reportedResults.map((result) => result.reason));
      }
    } else {
      for (const child of entry.children) {
        await exportChild(child, parentHandle);
      }
    }
  }
  async function exportChild(child, parentHandle) {
    if (signal.aborted) {
      if (exportAborted || isExportAborted(signal.reason)) {
        return;
      }
      throw signal.reason === UNDEFINED_VALUE ? new DOMException(ERR_ABORTED, ABORT_ERROR_NAME) : signal.reason;
    }
    try {
      if (child.directory) {
        const childDirectoryHandle = await parentHandle.getDirectoryHandle(child.name, { create: true });
        await exportChildren(child, childDirectoryHandle);
      } else {
        const fileHandle = await parentHandle.getFileHandle(child.name, { create: true });
        const writable = await fileHandle.createWritable();
        try {
          await child.getData({ writable: createProgressWritable(writable) }, getDataOptions);
        } catch (error) {
          throw exportAborted ? new Error(ERR_ABORT_EXPORT) : error;
        }
        exportedEntryNames.push(child.getRelativeName(zipEntry));
      }
    } catch (error) {
      exportAborted = true;
      abortController.abort(new Error(ERR_ABORT_EXPORT));
      try {
        if (error.entryName === UNDEFINED_VALUE) {
          error.entryName = child.getRelativeName(zipEntry);
          error.entryId = child.id;
        }
      } catch {
      }
      throw error;
    }
  }
}
async function transformToFileSystemhandle(entry) {
  const handle = {
    name: entry.name
  };
  if (entry.isFile) {
    handle.kind = "file";
    handle.getFile = () => new Promise((resolve, reject) => entry.file(resolve, reject));
  }
  if (entry.isDirectory) {
    handle.kind = "directory";
    const handles = await transformToFileSystemhandles(entry);
    handle.values = () => handles;
  }
  return handle;
}
async function transformToFileSystemhandles(entry) {
  const entries = [];
  function readEntries(directoryReader, resolve, reject) {
    directoryReader.readEntries(async (entriesPart) => {
      if (!entriesPart.length) {
        resolve(entries);
      } else {
        for (const entry2 of entriesPart) {
          entries.push(await transformToFileSystemhandle(entry2));
        }
        readEntries(directoryReader, resolve, reject);
      }
    }, reject);
  }
  await new Promise(
    (resolve, reject) => readEntries(entry.createReader(), resolve, reject)
  );
  return {
    [Symbol.iterator]() {
      let entryIndex = 0;
      return {
        next() {
          const result = {
            value: entries[entryIndex],
            done: entryIndex == entries.length
          };
          entryIndex++;
          return result;
        }
      };
    }
  };
}
function resetFS(fs2) {
  fs2.entries = [];
  fs2.entryIdCounter = 0;
  fs2.root = new ZipDirectoryEntry(fs2);
}
function collectChildren(directory, recursive) {
  const children = [];
  const pendingDirectories = [directory];
  let directoryIndex = 0;
  while (directoryIndex < pendingDirectories.length) {
    for (const child of pendingDirectories[directoryIndex++].children) {
      children.push(child);
      if (recursive) {
        pendingDirectories.push(child);
      }
    }
  }
  return children;
}
function registerEntries(fs2, entry) {
  const pendingEntries2 = [entry];
  while (pendingEntries2.length) {
    const pendingEntry = pendingEntries2.pop();
    fs2.entries[pendingEntry.id] = pendingEntry;
    for (const child of pendingEntry.children) {
      pendingEntries2.push(child);
    }
  }
}
function addChild(parent, name, params, directory) {
  if (parent.directory) {
    return directory ? new ZipDirectoryEntry(parent.fs, name, params, parent) : new ZipFileEntry(parent.fs, name, params, parent);
  } else {
    throw new Error("Parent entry is not a directory");
  }
}

// node_modules/@zip.js/zip.js/lib/core/util/mime-type-data.js
var encodedMimeTypes = "application:0andrew-inset ez,2nodex anx,1pplixware aw,1tom!,4cat!,4serv! atomsrv,5vc!,0bbolin lin,0ccxml!,1dmi-capability cdmia,6ontainer cdmic,5domain cdmid,5object cdmio,5queue cdmiq,1u-seeme cu,0davmount!,1ocbook! dbk,1sptype tsp,2sc+der,4! xdssc,0ecmascript es ecma,1mma!,1nvoy evy,1pub+zip,1xi,0font-tdpfr pfr,1ractals fif,1uturesplash spl,0gml!,1px!,1xf,1zip gz tgz,0hta,1yperstudio stk,0inkml! ink inkml,2ternet-property-stream acx,1pfix,0java-archive jar,5serialized-object ser,5vm class,1sonml+json,0lost! lostxml,0m3g,1ac-binhex40 hqx,2ds!,2rc mrc,4xml! mrcx,2thematica nb ma mb,4ml! mathml mml,1box,1ediaservercontrol! mscml,2talink!,84! meta4,3s!,1ods!,1p21 m21 mp21,24 mp4s,1saccess mdb,2word doc dot wiz,1xf,0oda,1ebps-package! opf,1gg ogx,1lescript axs,1mdoc!,1nenote onetoc onetoc2 onetmp onepkg,1xps,0patch-ops-error! xer,1df,1gp-encrypted pgp,4keys key,4signature asc sig,1ics-rules prf,1kcs10 p10,47-mime p7m p7c,6signature p7s,48 p8,2ix-attr-cert ac,5crl crl,5pkipath pkipath,4cmp pki,1ls!,1ostscript ps ai eps epsi epsf eps2 eps3,1rs.cww cww,1skc! pskcxml,0rar,1df!,1eginfo! rif,2lax-ng-compact-syntax rnc,2source-lists! rl,e-diff! rld,1ls-services! rs,1pki-ghostbusters gbr,5manifest mft,5roa roa,1sd!,2s!,1tf,0sbml!,1cvp-cv-request scq,asponse scs,5vp-request spq,asponse spp,1dp,1et-payment-initiation setpay,4registration-initiation setreg,1hf!,1mil! smi smil,1parql-query rq,7results! srx,1rgs gram,4! grxml,2u!,1sdl!,2ml!,0tei! tei teicorpus,1hraud! tfi,1imestamped-data tsd,0vnd.3gpp.pic-bw-large plb,gsmall psb,gvar pvb,82.tcap tcap,5m.post-it-notes pwn,4accpac.simply.aso aso,iimp imp,6ucobol acu,9rp atc acutc,5dobe.air-application-installer-package+zip air,aformscentral.fcdt fcdt,bxp fxp fxpl,axdp! xdp,bfdf xfdf,5head.space ahead,5irzip.filesecure.azf azf,os azs,5mazon.ebook azw,6ericandynamics.acc acc,6iga.ami ami,5ndroid.package-archive apk,6ser-web-certificate-issue-initiation cii,efunds-transfer-initiation fti,6tix.game-component atx,5pple.installer! mpkg,ampegurl m3u8,5ristanetworks.swi swi,5straea-software.iota iota,5udiograph aep,4blueice.multipass mpm,5mi bmi,5usinessobjects rep,4chemdraw! cdxml,6ipnuts.karaoke-mmd mmd,5inderella cdy,5laymore cla,6oanto.rp9 rp9,7nk.c4group c4g c4d c4f c4p c4u,6uetrust.cartomobile-config c11amc,w-pkg c11amz,5ommonspace csp,6ntact.cmsg cdbcmsg,6smocaller cmc,5rick.clicker clkx,h.keyboard clkk,ipalette clkp,itemplate clkt,iwordbank clkw,7ticaltools.wbs! wbs,5tc-posml pml,5ups-ppd ppd,6rl.car car,9pcurl pcurl,4dart dart,6ta-vision.rdz rdz,5ebian.binary-package deb udeb,6ce.data uvf uvvf uvd uvvd,9ttml! uvt uvvt,9unspecified uvx uvvx,9zip uvz uvvz,6novo.fcselayout-link fe_launch,5na dna,5olby.mlp mlp,5pgraph dpg,5reamfactory dfac,5s-keypoint kpxx,5vb.ait ait,8service svc,5ynageo geo,4ecowin.chart mag,5nliven nml,5pson.esf esf,amsf msf,aquickanime qam,asalt slt,bsf ssf,5szigno3! es3 et3,5zpix-album ez2,apackage ez3,4fdf fdf,6sn.mseed mseed,9seed seed dataless,5lographit gph,6uxtime.clip ftc,5ramemaker fm frame maker book,6ogans.fnc fnc,cltf ltf,5sc.weblaunch fsc,5ujitsu.oasys oas,h2 oa2,h3 oa3,hgp fg5,hprs bh2,8xerox.ddd ddd,focuworks xdw,n.binder xbd,6zzysheet fzs,4genomatix.tuxedo txd,6ogebra.file ggb,dtool ggt,7metry-explorer gex gre,7next gxt,7plan g2w,7space g3w,5mx gmx,5oogle-earth.kml! kml,jz kmz,5rafeq gqf gqs,6oove-account gac,bhelp ghf,bidentity-message gim,cnjector grv,btool-message gtm,gtemplate tpl,bvcard vcg,4hal! hal,6ndheld-entertainment! zmm,5bci hbci,5he.lesson-player les,5p-hpgl hpgl,9id hpid,9s hps,7jlyt jlt,7pcl pcl,axl pclxl,5ydrostatix.sof-data sfd-hdstx,5zn-3d-crossword x3d,4ibm.minipay mpy,9odcap afp listafp list3820,8rights-management irm,8secure-container sc,5ccprofile icc icm,5gloader igl,5mmervision-ivp ivp,iu ivu,5nsors.igm igm,6tercon.formnet xpw xpx,9geo i2g,7u.qbo qbo,afx qfx,5punplugged.rcprofile rcprofile,5repository.package! irp,5s-xpr xpr,6ac.fcs fcs,4jam jam,5cp.javame.midlet-rms rms,5isp jisp,5oost.joda-archive joda,4kahootz ktz ktr,5de.karbon karbon,9chart chrt,9formula kfo,9ivio flw,9ontour kon,9presenter kpr kpt,9spread ksp,9word kwd kwt,5enameaapp htke,5idspiration kia,6nar kne knp,5oan skp skd skt skm,6dak-descriptor sse,4las.las! lasxml,5lamagraphics.life-balance.desktop lbd,vexchange! lbe,5otus-1-2-3 123,aapproach apr,afreelance pre,anotes nsf,aorganizer org,ascreencam scm,awordpro lwp,4macports.portpkg portpkg,5cd mcd,5edcalcdata mc1,7iastation.cdkey cdkey,5fer mwf,6mp mfm,5icrografx.flo flo,figx igx,6f mif,5obius.daf daf,cis dis,bmbk mbk,cqy mqy,csl msl,bplc plc,btxf txf,6phun.application mpn,bcertificate mpc,6zilla.xul! xul,5s-artgalry cil,7cab-compressed cab,7excel xls xlb xlt xlm xla xlc xlw,c.addin.macroenabled.12 xlam,dsheet.binary.macroenabled.12 xlsb,jmacroenabled.12 xlsm,dtemplate.macroenabled.12 xltm,7fontobject eot,7htmlhelp chm,7ims ims,7lrm lrm,7officetheme thmx,8utlook msg,7pki.seccat cat,ctl stl,acertstore sst,8owerpoint ppt pps pot ppa pwz,h.addin.macroenabled.12 ppam,ipresentation.macroenabled.12 pptm,islide.macroenabled.12 sldm,nshow.macroenabled.12 ppsm,itemplate.macroenabled.12 potm,8roject mpp mpt,7word.document.macroenabled.12 docm,ctemplate.macroenabled.12 dotm,aks wps wks wcm wdb,8pl wpl,7xpsdocument xps,6eq mseq,5usician mus,6vee.style msty,5ynfc taglet,4neurolanguage.nlu nlu,5itf ntf nitf,5oblenet-directory nnd,dsealer nns,dweb nnw,6kia.n-gage.data ngdat,hsymbian.install n-gage,aradio-preset rpst,ms rpss,6vadigm.edm edm,fx edx,ext ext,4oasis.opendocument.chart odc,s-template otc,ndatabase odb,nformula odf,u-template odft,ngraphics odg,v-template otg,nimage odi,s-template oti,npresentation odp,z-template otp,nspreadsheet ods,y-template ots,ntext odt,r-master odm otm,stemplate ott,sweb oth,5lpc-sugar xo,5ma.dd2! dd2,5penofficeorg.extension oxt,8xmlformats-officedocument.presentationml.presentation pptx,zresentationml.slide sldx,zresentationml.slideshow ppsx,zresentationml.template potx,yspreadsheetml.sheet xlsx,zpreadsheetml.template xltx,ywordprocessingml.document docx,zordprocessingml.template dotx,5sgeo.mapguide.package mgp,7i.dp dp,9subsystem esa,4palm pdb pqa oprc,6waafile paw,5g.format str,7osasli ei6,5icsel efif,5mi.widget wg,5ocketlearn plf,6werbuilder6 pbd,5reviewsystems.box box,6oteus.magazine mgz,5ublishare-delta-tree qps,5vi.ptid1 ptid,4quark.quarkxpress qxd qxt qwd qwt qxl qxb,4realvnc.bed bed,6cordare.musicxml mxl,m! musicxml,5ig.cryptonote cryptonote,5n-realmedia rm,g-vbr rmvb,5oute66.link66! link66,4sailingtracker.track st,5eemail see,6ma sema,7d semd,7f semf,5hana.informed.formdata ifm,ntemplate itp,jinterchange iif,jpackage ipk,5imtech-mindmapper twd twds,5maf mmf,7rt.teacher teacher,5olent.sdkm! sdkm sdkd,5potfire.dxp dxp,dsfs sfs,5qlite3 db sqlite sqlite3 db-wal sqlite-wal db-shm sqlite-shm,5tardivision.calc sdc,ihart sds,hdraw sda,himpress sdd,hmath sdf smf,hwriter sdw vor,n-global sgl,6epmania.package smzip,estepchart sm,5un.xml.calc sxc,g.template stc,cdraw sxd,g.template std,cimpress sxi,j.template sti,cmath sxm,cwriter sxw,i.global sxg,jtemplate stw,6s-calendar sus susp,5vd svd,5ymbian.install sis sisx,6ncml! xsm,a.dm+wbxml bdm,d! xdm,4tao.intent-module-archive tao,5cpdump.pcap pcap cap dmp,5mobile-livetv tmo,5rid.tpt tpt,7scape.mxs mxs,6ueapp tra,4ufdl ufd ufdl,5iq.theme utz,5majin umj,5nity unityweb,5oml! uoml,4vcx vcx,5isio vsd vst vss vsw vsdx vssx vstx vssm vstm,9nary vis,5sf vsf,4wap.sic sic,9lc slc,8wbxml wbxml,9mlc wmlc,bscriptc wmlsc,5ebturbo wtb,5olfram.player nbp,6rdperfect wpd,f5.1 wp5,5qd wqd,5t.stf stf,4xara xar,5fdl xfdl,4yamaha.hv-dic hvd,escript hvs,evoice hvp,bopenscoreformat osf,q.osfpvg! osfpvg,bsmaf-audio saf,gphrase spf,5ellowriver-custom-menu cmp,4zul zir zirz,5zazz.deck! zaz,1oicexml! vxml,0widget wgt,2nhlp hlp,1sdl!,2policy!,0x-123 wk,27z-compressed 7z,2abiword abw,3ce-compressed ace,3pple-diskimage dmg,3uthorware-bin aab x32 u32 vox,dmap aam,dseg aas,2bcpio bcpio,3ittorrent torrent,3lorb blb blorb,3zip bz,62 bz2 boz,2cbr cbr cba cbt cb7,4z cbz,3df cdf cda,4link vcd,3fs-compressed cfs,3hat chat,4ess-pgn pgn,3ompress z,4nference nsc,3pio cpio,3sh csh,2dgc-compressed dgc,3irector dir dxr cst cct cxt w3d fgd swa,3ms dms,3oom wad,3tbncx! ncx,5ook! dtb,5resource! res,3vi dvi,2eva eva,2font-bdf bdf,7ghostscript gsf,7linux-psf psf,7pcf pcf,7snf snf,7ttf ttf ttc,8ype1 pfa pfb pfm afm,3reearc arc,6mind mm,2gca-compressed gca,3lulx ulx,3numeric gnumeric,3o-sgf sgf,3ramps-xml gramps,5phing-calculator gcf,3tar gtar taz,2hdf hdf,3ttpd-eruby rhtml,8php phtml pht php,b-source phps,b3 php3,c-preprocessed php3p,b4 php4,b5 php5,2ica ica,3nfo info,4stall-instructions install,4ternet-signup ins isp,3phone iii,3so9660-image iso,2java-jnlp-file jnlp,3mol jmz,2killustrator kil,3rita kra krz,2latex latex,3yx lyx,3zh-compressed lzh lha,4x lzx,2maker frm fb fbdoc,3ie mie,3obipocket-ebook prc mobi,3s-application application,5installer msi,5shortcut lnk,5wmd wmd,5xbap xbap,4binder obd,4cardfile crd,5lip clp,4dos-program com exe bat dll,4mediaview mvb m13 m14,6tafile wmf wmz emf emz,5oney mny,4publisher pub,4schedule scd,4terminal trm,4write wri,2netcdf nc,3s-proxy-autoconfig pac dat,3wc nwc,3zb nzb,2object o,3z-application oza,2perfmon pma pmc pmr pmw,5l pm pl,3kcs12 p12 pfx,67-certificates p7b spc,creqresp p7r,3ython-code pyc pyo,2qgis qgs shp shx,3uicktimeplayer qtl,2redhat-package-manager rpm rpa,4search-info-systems ris,3uby rb,2sh sh,4ar shar,4ockwave-flash swf swfl,3ilverlight scr,d-app xap,3ql sql,3tuffit sit,9x sitx,3ubrip srt,3v4cpio sv4cpio,6rc sv4crc,2t3vm-image t3,3ar tar,3ex-gf gf,6pk pk,6tfm tfm,5info texinfo texi,3gif obj,3rash ~ % bak old sik,2ustar ustar,2wais-source src,3ingz wz,2x509-ca-cert crt der cer,3cf xcf,3fig fig,3liff! xlf,3pinstall xpi,3z xz,2zmachine z1 z2 z3 z4 z5 z6 z7 z8,1aml!,1cap-diff! xdf,1enc!,1html! xhtml xht,1ml xml xsl xsd xpdl,3-dtd dtd,1op!,1proc! xpl,1slt!,2pf!,1v! mxml xhvml xvml xvm,0yaml yaml yml,2ng,1in!,1nd.ms-pkipko pko,0zip;audio:0aac,1dpcm adp,1iff aiff aif aff,1mr,3-wb awb,1nnodex axa,0basic au snd,0flac,0midi mid midi kar rmi,1p4 mp4a,2eg mpga mpega mp3 m4a mp2a m2a m3a,4url m3u,0ogg oga ogg spx,1pus,0prs.sid sid,0s3m,1ilk sil,0vnd.dece.audio uva uvva,5igital-winds eol,5ra dra,5ts dts,7.hd dtshd,4lucent.voice lvp,4ms-playready.media.pya pya,4nuera.ecelp4800 ecelp4800,f7470 ecelp7470,f9600 ecelp9600,4rip rip,0wav,1ebm weba,0x-aiff aifc,2caf caf,2gsm gsm,2matroska mka,3s-wax wax,6ma wma,2pn-realaudio ram,e-plugin rmp,2realaudio ra,2sd2 sd2,1m;chemical:0x-alchemy alc,2cache cac cache,7-csf csf,5tvs-binary cbin cascii ctab,3dx cdx,3hem3d c3d,3if cif,3mdf cmdf,4l cml,3ompass cpa,3rossfire bsd,3sml csml csm,3tx ctx,3xf cxf cef,2embl-dl-nucleotide emb embl,2gamess-input inp gam gamin,4ussian-checkpoint fch fchk,cube cub,binput gau gjc gjf,blog gal,3cg8-sequence gcg,3enbank gen,2hin hin,2isostar istr ist,2jcamp-dx jdx dx,2kinemage kin,2macmolecule mcm,5romodel-input mmod,3dl-molfile mol,6rdfile rd,7xnfile rxn,6sdfile sd,6tgf tgf,3mcif mcif,3ol2 mol2,5conn-Z b,4pac-graph gpt,8input mop mopcrt zmt,8out moo,2ncbi-asn1 asn,b-ascii prt ent,cbinary val,2rosdal ros,2swissprot sw,2vamas-iso14976 vms,3md vmd,2xtel xtel,3yz xyz;font:0otf,0woff,42;image:0avif avif avifs,0bmp,0cgm,1is-cod cod,0g3fax g3,1if,0heic heif heic,0ief,0jpeg jpeg jpg jpe jfif jfif-tbnl jif,0ktx,0pcx,1jpeg pjpg,1ng,1rs.btif btif,0sgi,1vg! svg svgz,0tiff tiff tif,0vnd.adobe.photoshop psd,4dece.graphic uvi uvvi uvg uvvg,5jvu djvu djv,5wg dwg,5xf dxf,4fastbidsheet fbs,5px fpx,5st fst,5ujixerox.edmics-mmr mmr,lrlc rlc,4ms-modi mdi,7photo wdp,4net-fpx npx,4wap.wbmp wbmp,4xiff xif,0webp,0x-3ds 3ds,2adobe-dng dng,2canon-cr2 cr2,aw crw,3mu-raster ras,4x cmx,3oreldraw cdr,bpattern pat,btemplate cdt,7photopaint cpt,2epson-erf erf,2freehand fh fhc fh4 fh5 fh7,3uji-raf raf,2icns icns,4on ico,2jg art,3ng jng,2kodak-dcr dcr,8k25 k25,9dc kdc,2minolta-mrw mrw,2nikon-nef nef,2olympus-orf orf,2panasonic-raw raw rw2 rwl,3entax-pef pef ptx,3ict pic pct,3ortable-anymap pnm,bbitmap pbm,bgraymap pgm,bpixmap ppm,2rgb rgb,2sigma-x3f x3f,3ony-arw arw,7sr2 sr2,9f srf,2tga tga,2xbitmap xbm,3pixmap xpm,3windowdump xwd;message:0rfc822 eml mime mht mhtml nws;model:0iges igs iges,0mesh msh mesh silo,0vnd.collada! dae,4dwf dwf,4gdl gdl,5tw gtw,4mts mts,4usdz+zip usdz,4vtu vtu,1rml wrl vrml,0x3d+binary x3db x3dbz,4vrml x3dv x3dvz,3! x3dz;text:0cache-manifest manifest appcache,2lendar ics icz ifb,1ss,2v,0h323 323,1tml html htm shtml stm,0iuls uls,0javascript js,1son,0markdown md markdown mdown markdn,0n3,0plain txt text brf conf def list log in bas diff ksh,1rs.lines.tag dsc,0richtext rtx,0scriptlet sct wsc,1gml sgml sgm,0tab-separated-values tsv,1exmacs tm,1roff t tr roff man me ms,1urtle ttl,0uri-list uri uris urls,0vcard,1nd.curl curl,8.dcurl dcurl,9mcurl mcurl,9scurl scurl,4dvb.subtitle sub,4fly fly,5mi.flexstor flx,4graphviz gv,4in3d.3dml 3dml,9spot spot,4sun.j2me.app-descriptor jad,4wap.si si,9l sl,8wml wml,bscript wmls,0webviewhtml htt,0x-asm s asm,2bibtex bib,3oo boo,2c c h dic,3++hdr h++ hpp hxx hh,5src c++ cpp cxx cc,3omponent htc,2diff patch,3src d,2fortran f for f77 f90,2haskell hs,2java java,2literate-haskell lhs,2moc moc,2nfo nfo,2opml opml,2pascal p pas pp inc,3cs-gcd gcd,3ython py,2scala scala,3etext etx,3fv sfv,2tcl tcl tk,3ex tex ltx sty cls,2uuencode uu,2vcalendar vcs,5rd vcf;video:03gpp 3gp,42 3g2,0annodex axv,0dl,1v dif dv,0fli,0gl,0h261,33,34,0jpeg jpgv,2m jpm jpgm,0mj2 mj2 mjp2,1p2t ts,24 mp4 mp4v mpg4,2eg mpeg mpg mpe m1v m2v mp2 mpa mpv2,0ogg ogv,0quicktime qt mov,0vnd.dece.hd uvh uvvh,9mobile uvm uvvm,9pd uvp uvvp,9sd uvs uvvs,9video uvv uvvv,5vb.file dvb,4fvt fvt,4mpegurl mxu m4u,5s-playready.media.pyv pyv,4uvvu.mp4 uvu uvvu,4vivo viv,0webm,0x-f4v f4v,3lv flv,2la-asf lsf lsx,2m4v m4v,3atroska mpv mkv mk3d mks,3ng mng,3s-asf asf asx asr,5vob vob,5wm wm,7v wmv,7x wmx,6vx wvx,4video avi,2sgi-movie movie,3mv smv;x-conference:0x-cooltalk ice;x-world:0x-vrml vrm flr wrz xaf xof";

// node_modules/@zip.js/zip.js/lib/core/util/mime-type.js
var mimeTypes;
function getMimeType2(filename) {
  return filename && getMimeTypes()[filename.split(".").pop().toLowerCase()] || getMimeType();
}
function getMimeTypes() {
  if (!mimeTypes) {
    mimeTypes = decodeMimeTypes(encodedMimeTypes);
  }
  return mimeTypes;
}
function decodeMimeTypes(data) {
  const mimeTypes2 = /* @__PURE__ */ Object.create(null);
  for (const block of data.split(";")) {
    const colonIndex = block.indexOf(":");
    const type = block.slice(0, colonIndex);
    let previousSubtype = "";
    for (const entry of block.slice(colonIndex + 1).split(",")) {
      const tokens = entry.split(" ");
      const subtype = previousSubtype.slice(0, Number.parseInt(tokens[0][0], 36)) + tokens[0].slice(1);
      previousSubtype = subtype;
      const expandedSubtype = subtype.replace(/!/g, "+xml");
      const extensions = tokens.length > 1 ? tokens.slice(1) : [expandedSubtype.split("+")[0]];
      for (const extension of extensions) {
        mimeTypes2[extension] = type + "/" + expandedSubtype;
      }
    }
  }
  return mimeTypes2;
}

// node_modules/@zip.js/zip.js/lib/zip-fs-wasm.js
n(setDefaultConfiguration);
export {
  BlobReader,
  BlobWriter,
  Data64URIReader,
  Data64URIWriter,
  ERR_ABORTED,
  ERR_AMBIGUOUS_ARCHIVE,
  ERR_BAD_FORMAT,
  ERR_CENTRAL_DIRECTORY_NOT_FOUND,
  ERR_DUPLICATED_NAME,
  ERR_ENCRYPTED,
  ERR_ENCRYPTED_CENTRAL_DIRECTORY,
  ERR_ENTRY_DATA_OUT_OF_BOUNDS,
  ERR_ENTRY_EXISTS,
  ERR_EOCDR_LOCATOR_ZIP64_NOT_FOUND,
  ERR_EOCDR_NOT_FOUND,
  ERR_EXTRAFIELD_ZIP64_NOT_FOUND,
  ERR_HTTP_RANGE,
  ERR_HTTP_RESOURCE_CHANGED,
  ERR_INVALID_AUTHENTICATION_CODE,
  ERR_INVALID_CODEC_DEFINITION,
  ERR_INVALID_CODEC_MODULE,
  ERR_INVALID_COMMENT,
  ERR_INVALID_COMMENT_TYPE,
  ERR_INVALID_COMPRESSED_DATA,
  ERR_INVALID_CRC32,
  ERR_INVALID_DATE,
  ERR_INVALID_ENCRYPTION_STRENGTH,
  ERR_INVALID_ENTRY_COMMENT,
  ERR_INVALID_ENTRY_COMMENT_TYPE,
  ERR_INVALID_ENTRY_NAME,
  ERR_INVALID_EXTRAFIELD,
  ERR_INVALID_EXTRAFIELD_DATA,
  ERR_INVALID_EXTRAFIELD_DATA_TYPE,
  ERR_INVALID_EXTRAFIELD_TYPE,
  ERR_INVALID_FILENAME_VALIDATION,
  ERR_INVALID_FUNCTION_OPTION,
  ERR_INVALID_GID,
  ERR_INVALID_LEVEL,
  ERR_INVALID_MAX_APPENDED_DATA_SIZE,
  ERR_INVALID_MAX_WORKERS,
  ERR_INVALID_MSDOS_ATTRIBUTES,
  ERR_INVALID_MSDOS_DATA,
  ERR_INVALID_PASSWORD,
  ERR_INVALID_PASSWORD_TYPE,
  ERR_INVALID_PASS_THROUGH,
  ERR_INVALID_READER_OPTIONS,
  ERR_INVALID_SIGNAL,
  ERR_INVALID_SIGNATURE,
  ERR_INVALID_SIGNATURE_DATA,
  ERR_INVALID_STRICTNESS,
  ERR_INVALID_UID,
  ERR_INVALID_UNCOMPRESSED_SIZE,
  ERR_INVALID_UNIX_EXTRA_FIELD_TYPE,
  ERR_INVALID_UNIX_ID_SIZE,
  ERR_INVALID_UNIX_MODE,
  ERR_INVALID_VERSION,
  ERR_ITERATOR_COMPLETED_TOO_SOON,
  ERR_LOCAL_FILE_HEADER_NOT_FOUND,
  ERR_OVERLAPPING_ENTRY,
  ERR_READABLE_CONSUMED,
  ERR_RESERVED_COMPRESSION_METHOD,
  ERR_SPLIT_ZIP_FILE,
  ERR_UNDEFINED_COMPRESSION_METHOD,
  ERR_UNDEFINED_READER,
  ERR_UNDEFINED_UNCOMPRESSED_SIZE,
  ERR_UNDETERMINED_SIZE,
  ERR_UNSAFE_FILENAME,
  ERR_UNSUPPORTED_COMPRESSION,
  ERR_UNSUPPORTED_CONTEXT,
  ERR_UNSUPPORTED_CRYPTO_API,
  ERR_UNSUPPORTED_ENCRYPTION,
  ERR_UNSUPPORTED_ENCRYPTION_PASS_THROUGH,
  ERR_UNSUPPORTED_ENCRYPTION_USDZ,
  ERR_UNSUPPORTED_FORMAT,
  ERR_UNSUPPORTED_UINT64,
  ERR_WORKER_STARTUP_TIMEOUT,
  ERR_WRITER_NOT_INITIALIZED,
  ERR_ZIP_CRYPTO_LAST_MOD_DATE,
  ERR_ZIP_NOT_EMPTY,
  HttpRangeReader,
  HttpReader,
  Reader,
  SplitDataReader,
  SplitDataWriter,
  TextReader,
  TextWriter,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  VERSION,
  WARNING_APPENDED_DATA,
  WARNING_COMPRESSED_PATCHED_DATA,
  WARNING_DUPLICATE_FILENAME,
  WARNING_MALFORMED_EXTRA_FIELD,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_BIT_FLAG,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_COMPRESSION_METHOD,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_CRC32_OR_SIZES,
  WARNING_MISMATCHED_ZIP64_END_OF_CENTRAL_DIRECTORY,
  WARNING_PREPENDED_CENTRAL_DIRECTORY,
  WARNING_PREPENDED_DATA,
  WARNING_TRAILING_CENTRAL_DIRECTORY_DATA,
  WARNING_UNKNOWN_VERSION,
  WARNING_UNKNOWN_ZIP64_EXTENSIBLE_DATA,
  WARNING_UNSORTED_CENTRAL_DIRECTORY,
  WARNING_WRAPPED_ENTRIES_COUNT,
  Writer,
  ZipDirectoryEntry,
  ZipEntry,
  ZipFS,
  ZipFileEntry,
  ZipReader,
  ZipReaderStream,
  ZipWriter,
  ZipWriterStream,
  configure,
  createBlobTempStream,
  createOPFSTempStream,
  createSyncAccessHandleTempStream,
  fs,
  getMimeType2 as getMimeType,
  getRegisteredCodecs,
  getSupportedCompressionMethods,
  isZipFile,
  registerCodec,
  resetConfiguration,
  terminateWorkersAndModule as terminateWorkers,
  unregisterCodec
};
//# sourceMappingURL=@zip__js_zip__js.js.map
