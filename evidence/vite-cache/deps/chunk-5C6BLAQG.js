// node_modules/@zip.js/zip.js/lib/core/constants.js
var MAX_32_BITS = 4294967295;
var MAX_16_BITS = 65535;
var MAX_8_BITS = 255;
var COMPRESSION_METHOD_DEFLATE = 8;
var COMPRESSION_METHOD_DEFLATE_64 = 9;
var COMPRESSION_METHOD_STORE = 0;
var COMPRESSION_METHOD_AES = 99;
var LOCAL_FILE_HEADER_SIGNATURE = 67324752;
var SPLIT_ZIP_FILE_SIGNATURE = 134695760;
var TEMPORARY_SPLIT_ZIP_FILE_SIGNATURE = 808471376;
var DATA_DESCRIPTOR_RECORD_SIGNATURE = SPLIT_ZIP_FILE_SIGNATURE;
var ARCHIVE_EXTRA_DATA_SIGNATURE = 134630224;
var DIGITAL_SIGNATURE_RECORD_SIGNATURE = 84233040;
var CENTRAL_FILE_HEADER_SIGNATURE = 33639248;
var END_OF_CENTRAL_DIR_SIGNATURE = 101010256;
var ZIP64_END_OF_CENTRAL_DIR_SIGNATURE = 101075792;
var ZIP64_END_OF_CENTRAL_DIR_LOCATOR_SIGNATURE = 117853008;
var CENTRAL_FILE_HEADER_LENGTH = 46;
var END_OF_CENTRAL_DIR_LENGTH = 22;
var ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH = 20;
var ZIP64_END_OF_CENTRAL_DIR_LENGTH = 56;
var ZIP64_END_OF_CENTRAL_DIR_TOTAL_LENGTH = END_OF_CENTRAL_DIR_LENGTH + ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH + ZIP64_END_OF_CENTRAL_DIR_LENGTH;
var DATA_DESCRIPTOR_RECORD_LENGTH = 12;
var DATA_DESCRIPTOR_RECORD_ZIP_64_LENGTH = 20;
var DATA_DESCRIPTOR_RECORD_SIGNATURE_LENGTH = 4;
var SPLIT_ZIP_FILE_SIGNATURE_LENGTH = 4;
var EXTRAFIELD_TYPE_ZIP64 = 1;
var EXTRAFIELD_TYPE_AES = 39169;
var EXTRAFIELD_TYPE_NTFS = 10;
var EXTRAFIELD_TYPE_NTFS_TAG1 = 1;
var EXTRAFIELD_TYPE_EXTENDED_TIMESTAMP = 21589;
var EXTRAFIELD_TYPE_UNICODE_PATH = 28789;
var EXTRAFIELD_TYPE_UNICODE_COMMENT = 25461;
var EXTRAFIELD_TYPE_USDZ = 6534;
var EXTRAFIELD_TYPE_INFOZIP = 30837;
var EXTRAFIELD_TYPE_UNIX = 30805;
var EXTRAFIELD_TYPE_UNIX_TYPE1 = 22613;
var EXTRAFIELD_TYPE_PKWARE_UNIX = 13;
var BITFLAG_ENCRYPTED = 1;
var BITFLAG_LEVEL = 6;
var BITFLAG_LEVEL_MAX_MASK = 2;
var BITFLAG_LEVEL_FAST_MASK = 4;
var BITFLAG_LEVEL_SUPER_FAST_MASK = 6;
var BITFLAG_DATA_DESCRIPTOR = 8;
var BITFLAG_COMPRESSED_PATCHED_DATA = 32;
var BITFLAG_STRONG_ENCRYPTION = 64;
var BITFLAG_LANG_ENCODING_FLAG = 2048;
var BITFLAG_MASKED_LOCAL_HEADERS = 8192;
var FILE_ATTR_MSDOS_DIR_MASK = 16;
var FILE_ATTR_MSDOS_READONLY_MASK = 1;
var FILE_ATTR_MSDOS_HIDDEN_MASK = 2;
var FILE_ATTR_MSDOS_SYSTEM_MASK = 4;
var FILE_ATTR_MSDOS_ARCHIVE_MASK = 32;
var FILE_ATTR_UNIX_TYPE_MASK = 61440;
var FILE_ATTR_UNIX_TYPE_DIR = 16384;
var FILE_ATTR_UNIX_TYPE_SYMLINK = 40960;
var FILE_ATTR_UNIX_TYPE_FILE = 32768;
var FILE_ATTR_UNIX_EXECUTABLE_MASK = 73;
var FILE_ATTR_UNIX_DEFAULT_MASK = 420;
var FILE_ATTR_UNIX_SETUID_MASK = 2048;
var FILE_ATTR_UNIX_SETGID_MASK = 1024;
var FILE_ATTR_UNIX_STICKY_MASK = 512;
var VERSION_STORE = 10;
var VERSION_DEFLATE = 20;
var VERSION_ZIP64 = 45;
var VERSION_AES = 51;
var VERSION_MADE_BY_MSDOS = 20;
var VERSION_MADE_BY_UNIX = 768;
var DIRECTORY_SIGNATURE = "/";
var HEADER_SIZE = 30;
var HEADER_OFFSET_VERSION = 0;
var HEADER_OFFSET_SIGNATURE = 10;
var HEADER_OFFSET_COMPRESSED_SIZE = 14;
var HEADER_OFFSET_UNCOMPRESSED_SIZE = 18;
var HEADER_OFFSET_FILENAME_LENGTH = 22;
var HEADER_OFFSET_EXTRAFIELD_LENGTH = 24;
var LOCAL_HEADER_COMMON_OFFSET = 4;
var MAX_DATE = new Date(2107, 11, 31, 23, 59, 58);
var MIN_DATE = new Date(1980, 0, 1);
var UNDEFINED_VALUE = void 0;
var INFINITY_VALUE = Infinity;
var UNDEFINED_TYPE = "undefined";
var FUNCTION_TYPE = "function";
var OBJECT_TYPE = "object";
var STRING_TYPE = "string";
var NUMBER_TYPE = "number";
var BOOLEAN_TYPE = "boolean";
var EMPTY_UINT8_ARRAY = new Uint8Array();

// node_modules/@zip.js/zip.js/lib/core/options.js
var OPTION_FILENAME_ENCODING = "filenameEncoding";
var OPTION_COMMENT_ENCODING = "commentEncoding";
var OPTION_DECODE_TEXT = "decodeText";
var OPTION_EXTRACT_PREPENDED_DATA = "extractPrependedData";
var OPTION_EXTRACT_APPENDED_DATA = "extractAppendedData";
var OPTION_PASSWORD = "password";
var OPTION_RAW_PASSWORD = "rawPassword";
var OPTION_PASS_THROUGH = "passThrough";
var OPTION_SIGNAL = "signal";
var OPTION_CHECK_PASSWORD_ONLY = "checkPasswordOnly";
var OPTION_CHECK_OVERLAPPING_ENTRY_ONLY = "checkOverlappingEntryOnly";
var OPTION_CHECK_OVERLAPPING_ENTRY = "checkOverlappingEntry";
var OPTION_CHECK_AMBIGUITY = "checkAmbiguity";
var OPTION_CHECK_LOCAL_DIRECTORY = "checkLocalDirectory";
var OPTION_CHECK_SIGNATURE = "checkSignature";
var OPTION_CHECK_CRC32 = "checkCrc32";
var OPTION_CHECK_AUTHENTICATION_CODE = "checkAuthenticationCode";
var OPTION_USE_WEB_WORKERS = "useWebWorkers";
var OPTION_USE_COMPRESSION_STREAM = "useCompressionStream";
var OPTION_TRANSFER_STREAMS = "transferStreams";
var OPTION_PREVENT_CLOSE = "preventClose";
var OPTION_ENCRYPTION_STRENGTH = "encryptionStrength";
var OPTION_EXTENDED_TIMESTAMP = "extendedTimestamp";
var OPTION_NTFS_TIMESTAMP = "ntfsTimestamp";
var OPTION_KEEP_ORDER = "keepOrder";
var OPTION_LEVEL = "level";
var OPTION_BUFFERED_WRITE = "bufferedWrite";
var OPTION_CREATE_TEMP_STREAM = "createTempStream";
var OPTION_DATA_DESCRIPTOR_SIGNATURE = "dataDescriptorSignature";
var OPTION_USE_UNICODE_FILE_NAMES = "useUnicodeFileNames";
var OPTION_DATA_DESCRIPTOR = "dataDescriptor";
var OPTION_SUPPORT_ZIP64_SPLIT_FILE = "supportZip64SplitFile";
var OPTION_ENCODE_TEXT = "encodeText";
var OPTION_OFFSET = "offset";
var OPTION_USDZ = "usdz";
var OPTION_UNIX_EXTRA_FIELD_TYPE = "unixExtraFieldType";
var OPTION_LOCAL_EXTRA_FIELD = "localExtraField";
var OPTION_CENTRAL_EXTRA_FIELD = "centralExtraField";
var OPTION_STRICTNESS = "strictness";
var OPTION_FILENAME_VALIDATION = "filenameValidation";
var OPTION_NORMALIZE_FILENAME = "normalizeFilename";
var OPTION_MAX_APPENDED_DATA_SIZE = "maxAppendedDataSize";
var OPTION_DECRYPT_CENTRAL_DIRECTORY = "decryptCentralDirectory";
var OPTION_SIGN_CENTRAL_DIRECTORY = "signCentralDirectory";
var TEXT_TYPE_FILENAME = "filename";
var TEXT_TYPE_COMMENT = "comment";
var STRICTNESS_STRICT = "strict";
var STRICTNESS_BALANCED = "balanced";
var STRICTNESS_TOLERANT = "tolerant";
var ERR_INVALID_FUNCTION_OPTION = "Invalid option (must be a function)";
var ERR_INVALID_SIGNAL = "Invalid signal (must be an AbortSignal instance)";
var ERR_INVALID_PASSWORD_TYPE = "Invalid password (password must be a string, rawPassword must be a Uint8Array)";
function checkFunctionOption(value) {
  if (value && typeof value != FUNCTION_TYPE) {
    throw new Error(ERR_INVALID_FUNCTION_OPTION);
  }
  return value;
}
function checkSignalOption(signal) {
  if (signal && (typeof signal.addEventListener != FUNCTION_TYPE || typeof signal.aborted != BOOLEAN_TYPE)) {
    throw new Error(ERR_INVALID_SIGNAL);
  }
  return signal || UNDEFINED_VALUE;
}
function checkPasswordOption(password, rawPassword) {
  if (password && typeof password != STRING_TYPE || rawPassword && !(rawPassword instanceof Uint8Array)) {
    throw new Error(ERR_INVALID_PASSWORD_TYPE);
  }
}
function checkInteger(value, maxValue, errorMessage) {
  if (!Number.isInteger(value) || value < 0 || value > maxValue) {
    throw new Error(errorMessage);
  }
}
function checkIntegerOption(value, maxValue, errorMessage) {
  if (value !== UNDEFINED_VALUE) {
    checkInteger(value, maxValue, errorMessage);
  }
}
function toNumber(value) {
  return typeof value == STRING_TYPE && value.trim() ? Number(value) : value;
}

// node_modules/@zip.js/zip.js/lib/core/configuration.js
var DEFAULT_CHUNK_SIZE = 64 * 1024;
var MINIMUM_CHUNK_SIZE = 64;
var MINIMUM_PROPERTY_VALUE = 1;
var ERR_INVALID_MAX_WORKERS = "Invalid maxWorkers (must be an integer greater than 0)";
var maxWorkers = 2;
try {
  if (typeof navigator != UNDEFINED_TYPE && navigator.hardwareConcurrency) {
    maxWorkers = navigator.hardwareConcurrency;
  }
} catch {
}
var DEFAULT_CONFIGURATION = {
  workerURI: "./core/web-worker-wasm.js",
  wasmURI: "./core/streams/zlib-wasm/zlib-streams.wasm",
  chunkSize: DEFAULT_CHUNK_SIZE,
  maxWorkers,
  terminateWorkerTimeout: 5e3,
  workerStarvationTimeout: 5e3,
  workerStartupTimeout: 5e3,
  useWebWorkers: true,
  useCompressionStream: true,
  transferStreams: true,
  CompressionStream: typeof CompressionStream != UNDEFINED_TYPE && CompressionStream,
  DecompressionStream: typeof DecompressionStream != UNDEFINED_TYPE && DecompressionStream
};
var PROPERTY_NAME_MAX_WORKERS = "maxWorkers";
var STRING_PROPERTY_NAMES = [
  "baseURI",
  "wasmURI",
  "workerURI"
];
var BOOLEAN_PROPERTY_NAMES = [
  "useCompressionStream",
  "useWebWorkers",
  "transferStreams"
];
var NUMBER_PROPERTY_NAMES = [
  "chunkSize",
  PROPERTY_NAME_MAX_WORKERS,
  "terminateWorkerTimeout",
  "workerStarvationTimeout",
  "workerStartupTimeout"
];
var FUNCTION_PROPERTY_NAMES = [
  "createWorker",
  "CompressionStream",
  "DecompressionStream",
  "CompressionStreamFallback",
  "DecompressionStreamFallback"
];
var CONFIGURABLE_PROPERTY_NAMES = [
  ...STRING_PROPERTY_NAMES,
  ...BOOLEAN_PROPERTY_NAMES,
  ...NUMBER_PROPERTY_NAMES,
  ...FUNCTION_PROPERTY_NAMES
];
var config = { ...DEFAULT_CONFIGURATION };
function getConfiguration() {
  return config;
}
function getChunkSize(config2) {
  return normalizeChunkSize(config2.chunkSize);
}
function normalizeChunkSize(chunkSize) {
  chunkSize = toNumber(chunkSize);
  return Number.isInteger(chunkSize) && chunkSize >= MINIMUM_PROPERTY_VALUE ? Math.max(chunkSize, MINIMUM_CHUNK_SIZE) : DEFAULT_CHUNK_SIZE;
}
function configure(configuration) {
  Object.assign(config, checkConfiguration(normalizeConfiguration(configuration)));
}
function checkConfiguration(configuration) {
  const checkedConfiguration = {};
  for (const propertyName of CONFIGURABLE_PROPERTY_NAMES) {
    const propertyValue = configuration[propertyName];
    if (propertyValue !== UNDEFINED_VALUE) {
      checkedConfiguration[propertyName] = checkPropertyValue(propertyName, propertyValue);
    }
  }
  return checkedConfiguration;
}
function checkPropertyValue(propertyName, propertyValue) {
  if (NUMBER_PROPERTY_NAMES.includes(propertyName)) {
    propertyValue = toNumber(propertyValue);
    if (propertyName == PROPERTY_NAME_MAX_WORKERS && (!Number.isInteger(propertyValue) || propertyValue < MINIMUM_PROPERTY_VALUE)) {
      throw new Error(ERR_INVALID_MAX_WORKERS);
    }
  } else if (FUNCTION_PROPERTY_NAMES.includes(propertyName)) {
    checkFunctionOption(propertyValue);
  }
  return propertyValue;
}
function normalizeConfiguration(configuration) {
  configuration = configuration || {};
  const { CompressionStreamZlib, DecompressionStreamZlib } = configuration;
  if (CompressionStreamZlib === UNDEFINED_VALUE && DecompressionStreamZlib === UNDEFINED_VALUE) {
    return configuration;
  }
  const normalizedConfiguration = Object.assign({}, configuration);
  if (normalizedConfiguration.CompressionStreamFallback === UNDEFINED_VALUE) {
    normalizedConfiguration.CompressionStreamFallback = CompressionStreamZlib;
  }
  if (normalizedConfiguration.DecompressionStreamFallback === UNDEFINED_VALUE) {
    normalizedConfiguration.DecompressionStreamFallback = DecompressionStreamZlib;
  }
  return normalizedConfiguration;
}
function setDefaultConfiguration(configuration) {
  const checkedConfiguration = checkConfiguration(normalizeConfiguration(configuration));
  Object.assign(DEFAULT_CONFIGURATION, checkedConfiguration);
  Object.assign(config, checkedConfiguration);
}
function resetConfiguration() {
  for (const propertyName of CONFIGURABLE_PROPERTY_NAMES) {
    delete config[propertyName];
  }
  Object.assign(config, DEFAULT_CONFIGURATION);
}

// node_modules/@zip.js/zip.js/lib/core/codec-registry.js
var ERR_INVALID_CODEC_DEFINITION = "Invalid codec definition";
var ERR_RESERVED_COMPRESSION_METHOD = "Reserved compression method";
var ERR_INVALID_CODEC_MODULE = "Invalid codec module";
var RESERVED_COMPRESSION_METHODS = [
  COMPRESSION_METHOD_STORE,
  COMPRESSION_METHOD_DEFLATE,
  COMPRESSION_METHOD_DEFLATE_64,
  COMPRESSION_METHOD_AES
];
var registeredCodecs = /* @__PURE__ */ new Map();
var codecStreams = /* @__PURE__ */ new Map();
function registerCodec(codec2 = {}) {
  const { compressionMethod, format, codecURI, CompressionStream: CompressionStream2, DecompressionStream: DecompressionStream2, versionNeeded } = codec2;
  if (!Number.isInteger(compressionMethod) || compressionMethod < 0 || compressionMethod > MAX_16_BITS || typeof format != STRING_TYPE || !format.length) {
    throw new Error(ERR_INVALID_CODEC_DEFINITION);
  }
  if (RESERVED_COMPRESSION_METHODS.includes(compressionMethod)) {
    throw new Error(ERR_RESERVED_COMPRESSION_METHOD);
  }
  const hasStreams = typeof CompressionStream2 == FUNCTION_TYPE || typeof DecompressionStream2 == FUNCTION_TYPE;
  if (!hasStreams && (typeof codecURI != STRING_TYPE || !codecURI.length)) {
    throw new Error(ERR_INVALID_CODEC_DEFINITION);
  }
  registeredCodecs.set(compressionMethod, { compressionMethod, format, codecURI, versionNeeded });
  if (hasStreams) {
    setCodecStreams(format, { CompressionStream: CompressionStream2, DecompressionStream: DecompressionStream2 });
  }
}
function unregisterCodec(compressionMethod) {
  const codec2 = registeredCodecs.get(compressionMethod);
  if (codec2) {
    registeredCodecs.delete(compressionMethod);
    let formatUsed;
    registeredCodecs.forEach((otherCodec) => formatUsed = formatUsed || otherCodec.format == codec2.format);
    if (!formatUsed) {
      codecStreams.delete(codec2.format);
    }
  }
}
function getRegisteredCodec(compressionMethod) {
  return registeredCodecs.get(compressionMethod);
}
function getRegisteredCodecs() {
  return Array.from(registeredCodecs.values(), (codec2) => Object.assign({}, codec2, codecStreams.get(codec2.format)));
}
function getCodecStreams(format) {
  return codecStreams.get(format);
}
function setCodecStreams(format, streams) {
  const { CompressionStream: CompressionStream2, DecompressionStream: DecompressionStream2 } = streams;
  if (typeof CompressionStream2 != FUNCTION_TYPE && typeof DecompressionStream2 != FUNCTION_TYPE) {
    throw new Error(ERR_INVALID_CODEC_MODULE);
  }
  codecStreams.set(format, { CompressionStream: CompressionStream2, DecompressionStream: DecompressionStream2 });
}
async function ensureCodecStreams(format, codecURI) {
  if (!codecStreams.has(format) && codecURI) {
    setCodecStreams(format, await import(
      /* webpackIgnore: true */
      /* @vite-ignore */
      codecURI
    ));
  }
}

// node_modules/@zip.js/zip.js/lib/core/streams/codecs/crc32.js
var T = [[], [], [], [], [], [], [], []];
for (let n = 0; n < 256; n++) {
  let t = n;
  for (let j = 0; j < 8; j++) {
    t = t & 1 ? t >>> 1 ^ 3988292384 : t >>> 1;
  }
  T[0][n] = t;
}
for (let n = 0; n < 256; n++) {
  for (let k = 1; k < 8; k++) {
    const previous = T[k - 1][n];
    T[k][n] = previous >>> 8 ^ T[0][previous & 255];
  }
}
var [T0, T1, T2, T3, T4, T5, T6, T7] = T;
var Crc32 = class {
  constructor(crc) {
    this.crc = crc || -1;
  }
  append(data) {
    let crc = this.crc | 0;
    const length = data.length | 0;
    let offset = 0;
    if (length >= 8 && data.buffer) {
      const view = new DataView(data.buffer, data.byteOffset, length);
      const end = length - 8;
      for (; offset <= end; offset += 8) {
        const a = crc ^ view.getInt32(offset, true);
        const b = view.getInt32(offset + 4, true);
        crc = T7[a & 255] ^ T6[a >>> 8 & 255] ^ T5[a >>> 16 & 255] ^ T4[a >>> 24 & 255] ^ T3[b & 255] ^ T2[b >>> 8 & 255] ^ T1[b >>> 16 & 255] ^ T0[b >>> 24 & 255];
      }
    }
    for (; offset < length; offset++) {
      crc = crc >>> 8 ^ T0[(crc ^ data[offset]) & 255];
    }
    this.crc = crc;
  }
  get() {
    return ~this.crc;
  }
};

// node_modules/@zip.js/zip.js/lib/core/streams/crc32-stream.js
var Crc32Stream = class extends TransformStream {
  constructor() {
    let stream;
    const crc32 = new Crc32();
    super({
      transform(chunk, controller) {
        crc32.append(chunk);
        controller.enqueue(chunk);
      },
      flush() {
        const value = new Uint8Array(4);
        const dataView = new DataView(value.buffer);
        dataView.setUint32(0, crc32.get());
        stream.value = value;
      }
    });
    stream = this;
  }
};

// node_modules/@zip.js/zip.js/lib/core/util/encode-text.js
function encodeText(value) {
  if (typeof TextEncoder == UNDEFINED_TYPE) {
    value = unescape(encodeURIComponent(value));
    const result = new Uint8Array(value.length);
    for (let i = 0; i < result.length; i++) {
      result[i] = value.charCodeAt(i);
    }
    return result;
  } else {
    return new TextEncoder().encode(value);
  }
}

// node_modules/@zip.js/zip.js/lib/core/util/array.js
function concat(first, second) {
  const result = new Uint8Array(first.length + second.length);
  result.set(first);
  result.set(second, first.length);
  return result;
}
function toExactUint8Array(array) {
  return array.byteOffset || array.byteLength != array.buffer.byteLength ? new Uint8Array(array) : array;
}
function getDataView(array) {
  return new DataView(array.buffer, array.byteOffset, array.byteLength);
}

// node_modules/@zip.js/zip.js/lib/core/streams/codecs/sjcl.js
var bitArray = {
  /**
   * Concatenate two bit arrays.
   * @param {bitArray} a1 The first array.
   * @param {bitArray} a2 The second array.
   * @return {bitArray} The concatenation of a1 and a2.
   */
  concat(a1, a2) {
    if (a1.length === 0 || a2.length === 0) {
      return a1.concat(a2);
    }
    const last = a1[a1.length - 1], shift = bitArray.getPartial(last);
    if (shift === 32) {
      return a1.concat(a2);
    } else {
      return bitArray._shiftRight(a2, shift, last | 0, a1.slice(0, a1.length - 1));
    }
  },
  /**
   * Find the length of an array of bits.
   * @param {bitArray} a The array.
   * @return {Number} The length of a, in bits.
   */
  bitLength(a) {
    const l = a.length;
    if (l === 0) {
      return 0;
    }
    const x = a[l - 1];
    return (l - 1) * 32 + bitArray.getPartial(x);
  },
  /**
   * Truncate an array.
   * @param {bitArray} a The array.
   * @param {Number} len The length to truncate to, in bits.
   * @return {bitArray} A new array, truncated to len bits.
   */
  clamp(a, len) {
    if (a.length * 32 < len) {
      return a;
    }
    a = a.slice(0, Math.ceil(len / 32));
    const l = a.length;
    len = len & 31;
    if (l > 0 && len) {
      a[l - 1] = bitArray.partial(len, a[l - 1] & 2147483648 >> len - 1, 1);
    }
    return a;
  },
  /**
   * Make a partial word for a bit array.
   * @param {Number} len The number of bits in the word.
   * @param {Number} x The bits.
   * @param {Number} [_end=0] Pass 1 if x has already been shifted to the high side.
   * @return {Number} The partial word.
   */
  partial(len, x, _end) {
    if (len === 32) {
      return x;
    }
    return (_end ? x | 0 : x << 32 - len) + len * 1099511627776;
  },
  /**
   * Get the number of bits used by a partial word.
   * @param {Number} x The partial word.
   * @return {Number} The number of bits used by the partial word.
   */
  getPartial(x) {
    return Math.round(x / 1099511627776) || 32;
  },
  /** Shift an array right.
   * @param {bitArray} a The array to shift.
   * @param {Number} shift The number of bits to shift.
   * @param {Number} [carry=0] A byte to carry in
   * @param {bitArray} [out=[]] An array to prepend to the output.
   * @private
   */
  _shiftRight(a, shift, carry, out) {
    if (out === void 0) {
      out = [];
    }
    for (; shift >= 32; shift -= 32) {
      out.push(carry);
      carry = 0;
    }
    if (shift === 0) {
      return out.concat(a);
    }
    for (let i = 0; i < a.length; i++) {
      out.push(carry | a[i] >>> shift);
      carry = a[i] << 32 - shift;
    }
    const last2 = a.length ? a[a.length - 1] : 0;
    const shift2 = bitArray.getPartial(last2);
    out.push(bitArray.partial(shift + shift2 & 31, shift + shift2 > 32 ? carry : out.pop(), 1));
    return out;
  }
};
var codec = {
  bytes: {
    /** Convert from a bitArray to an array of bytes. */
    fromBits(arr) {
      const bl = bitArray.bitLength(arr);
      const byteLength = bl / 8;
      const out = new Uint8Array(byteLength);
      let tmp;
      for (let i = 0; i < byteLength; i++) {
        if ((i & 3) === 0) {
          tmp = arr[i / 4];
        }
        out[i] = tmp >>> 24;
        tmp <<= 8;
      }
      return out;
    },
    /** Convert from an array of bytes to a bitArray. */
    toBits(bytes) {
      const out = [];
      let i;
      let tmp = 0;
      for (i = 0; i < bytes.length; i++) {
        tmp = tmp << 8 | bytes[i];
        if ((i & 3) === 3) {
          out.push(tmp);
          tmp = 0;
        }
      }
      if (i & 3) {
        out.push(bitArray.partial(8 * (i & 3), tmp));
      }
      return out;
    }
  }
};
var hash = {};
hash.sha1 = class {
  constructor(hash2) {
    const sha1 = this;
    sha1.blockSize = 512;
    sha1._init = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
    sha1._key = [1518500249, 1859775393, 2400959708, 3395469782];
    if (hash2) {
      sha1._h = hash2._h.slice(0);
      sha1._buffer = hash2._buffer.slice(0);
      sha1._length = hash2._length;
    } else {
      sha1.reset();
    }
  }
  /**
   * Reset the hash state.
   * @return this
   */
  reset() {
    const sha1 = this;
    sha1._h = sha1._init.slice(0);
    sha1._buffer = [];
    sha1._length = 0;
    return sha1;
  }
  /**
   * Input several words to the hash.
   * @param {bitArray|String} data the data to hash.
   * @return this
   */
  update(data) {
    const sha1 = this;
    if (typeof data === "string") {
      data = codec.utf8String.toBits(data);
    }
    const b = sha1._buffer = bitArray.concat(sha1._buffer, data);
    const ol = sha1._length;
    const nl = sha1._length = ol + bitArray.bitLength(data);
    if (nl > 9007199254740991) {
      throw new Error("Cannot hash more than 2^53 - 1 bits");
    }
    const c = new Uint32Array(b);
    let j = 0;
    for (let i = sha1.blockSize + ol - (sha1.blockSize + ol & sha1.blockSize - 1); i <= nl; i += sha1.blockSize) {
      sha1._block(c.subarray(16 * j, 16 * (j + 1)));
      j += 1;
    }
    b.splice(0, 16 * j);
    return sha1;
  }
  /**
   * Complete hashing and output the hash value.
   * @return {bitArray} The hash value, an array of 5 big-endian words. TODO
   */
  finalize() {
    const sha1 = this;
    let b = sha1._buffer;
    const h = sha1._h;
    b = bitArray.concat(b, [bitArray.partial(1, 1)]);
    for (let i = b.length + 2; i & 15; i++) {
      b.push(0);
    }
    b.push(Math.floor(sha1._length / 4294967296));
    b.push(sha1._length | 0);
    while (b.length) {
      sha1._block(b.splice(0, 16));
    }
    sha1.reset();
    return h;
  }
  /**
   * The SHA-1 logical functions f(0), f(1), ..., f(79).
   * @private
   */
  _f(t, b, c, d) {
    if (t <= 19) {
      return b & c | ~b & d;
    } else if (t <= 39) {
      return b ^ c ^ d;
    } else if (t <= 59) {
      return b & c | b & d | c & d;
    } else if (t <= 79) {
      return b ^ c ^ d;
    }
  }
  /**
   * Circular left-shift operator.
   * @private
   */
  _S(n, x) {
    return x << n | x >>> 32 - n;
  }
  /**
   * Perform one cycle of SHA-1.
   * @param {Uint32Array|bitArray} words one block of words.
   * @private
   */
  _block(words) {
    const sha1 = this;
    const h = sha1._h;
    const w = Array(80);
    for (let j = 0; j < 16; j++) {
      w[j] = words[j];
    }
    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    for (let t = 0; t <= 79; t++) {
      if (t >= 16) {
        w[t] = sha1._S(1, w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16]);
      }
      const tmp = sha1._S(5, a) + sha1._f(t, b, c, d) + e + w[t] + sha1._key[Math.floor(t / 20)] | 0;
      e = d;
      d = c;
      c = sha1._S(30, b);
      b = a;
      a = tmp;
    }
    h[0] = h[0] + a | 0;
    h[1] = h[1] + b | 0;
    h[2] = h[2] + c | 0;
    h[3] = h[3] + d | 0;
    h[4] = h[4] + e | 0;
  }
};
var cipher = {};
cipher.aes = class {
  constructor(key) {
    const aes = this;
    aes._tables = [[[], [], [], [], []], [[], [], [], [], []]];
    if (!aes._tables[0][0][0]) {
      aes._precompute();
    }
    const sbox = aes._tables[0][4];
    const decTable = aes._tables[1];
    const keyLen = key.length;
    let i, encKey, decKey, rcon = 1;
    if (keyLen !== 4 && keyLen !== 6 && keyLen !== 8) {
      throw new Error("invalid aes key size");
    }
    aes._key = [encKey = key.slice(0), decKey = []];
    for (i = keyLen; i < 4 * keyLen + 28; i++) {
      let tmp = encKey[i - 1];
      if (i % keyLen === 0 || keyLen === 8 && i % keyLen === 4) {
        tmp = sbox[tmp >>> 24] << 24 ^ sbox[tmp >> 16 & 255] << 16 ^ sbox[tmp >> 8 & 255] << 8 ^ sbox[tmp & 255];
        if (i % keyLen === 0) {
          tmp = tmp << 8 ^ tmp >>> 24 ^ rcon << 24;
          rcon = rcon << 1 ^ (rcon >> 7) * 283;
        }
      }
      encKey[i] = encKey[i - keyLen] ^ tmp;
    }
    for (let j = 0; i; j++, i--) {
      const tmp = encKey[j & 3 ? i : i - 4];
      if (i <= 4 || j < 4) {
        decKey[j] = tmp;
      } else {
        decKey[j] = decTable[0][sbox[tmp >>> 24]] ^ decTable[1][sbox[tmp >> 16 & 255]] ^ decTable[2][sbox[tmp >> 8 & 255]] ^ decTable[3][sbox[tmp & 255]];
      }
    }
  }
  // public
  /* Something like this might appear here eventually
  name: "AES",
  blockSize: 4,
  keySizes: [4,6,8],
  */
  /**
   * Encrypt an array of 4 big-endian words.
   * @param {Array} data The plaintext.
   * @return {Array} The ciphertext.
   */
  encrypt(data) {
    return this._crypt(data, 0);
  }
  /**
   * Decrypt an array of 4 big-endian words.
   * @param {Array} data The ciphertext.
   * @return {Array} The plaintext.
   */
  decrypt(data) {
    return this._crypt(data, 1);
  }
  /**
   * Expand the S-box tables.
   *
   * @private
   */
  _precompute() {
    const encTable = this._tables[0];
    const decTable = this._tables[1];
    const sbox = encTable[4];
    const sboxInv = decTable[4];
    const d = [];
    const th = [];
    let xInv, x2, x4, x8;
    for (let i = 0; i < 256; i++) {
      th[(d[i] = i << 1 ^ (i >> 7) * 283) ^ i] = i;
    }
    for (let x = xInv = 0; !sbox[x]; x ^= x2 || 1, xInv = th[xInv] || 1) {
      let s = xInv ^ xInv << 1 ^ xInv << 2 ^ xInv << 3 ^ xInv << 4;
      s = s >> 8 ^ s & 255 ^ 99;
      sbox[x] = s;
      sboxInv[s] = x;
      x8 = d[x4 = d[x2 = d[x]]];
      let tDec = x8 * 16843009 ^ x4 * 65537 ^ x2 * 257 ^ x * 16843008;
      let tEnc = d[s] * 257 ^ s * 16843008;
      for (let i = 0; i < 4; i++) {
        encTable[i][x] = tEnc = tEnc << 24 ^ tEnc >>> 8;
        decTable[i][s] = tDec = tDec << 24 ^ tDec >>> 8;
      }
    }
    for (let i = 0; i < 5; i++) {
      encTable[i] = encTable[i].slice(0);
      decTable[i] = decTable[i].slice(0);
    }
  }
  /**
   * Encryption and decryption core.
   * @param {Array} input Four words to be encrypted or decrypted.
   * @param dir The direction, 0 for encrypt and 1 for decrypt.
   * @return {Array} The four encrypted or decrypted words.
   * @private
   */
  _crypt(input, dir) {
    if (input.length !== 4) {
      throw new Error("invalid aes block size");
    }
    const key = this._key[dir];
    const nInnerRounds = key.length / 4 - 2;
    const out = [0, 0, 0, 0];
    const table = this._tables[dir];
    const t0 = table[0];
    const t1 = table[1];
    const t2 = table[2];
    const t3 = table[3];
    const sbox = table[4];
    let a = input[0] ^ key[0];
    let b = input[dir ? 3 : 1] ^ key[1];
    let c = input[2] ^ key[2];
    let d = input[dir ? 1 : 3] ^ key[3];
    let kIndex = 4;
    let a2, b2, c2;
    for (let i = 0; i < nInnerRounds; i++) {
      a2 = t0[a >>> 24] ^ t1[b >> 16 & 255] ^ t2[c >> 8 & 255] ^ t3[d & 255] ^ key[kIndex];
      b2 = t0[b >>> 24] ^ t1[c >> 16 & 255] ^ t2[d >> 8 & 255] ^ t3[a & 255] ^ key[kIndex + 1];
      c2 = t0[c >>> 24] ^ t1[d >> 16 & 255] ^ t2[a >> 8 & 255] ^ t3[b & 255] ^ key[kIndex + 2];
      d = t0[d >>> 24] ^ t1[a >> 16 & 255] ^ t2[b >> 8 & 255] ^ t3[c & 255] ^ key[kIndex + 3];
      kIndex += 4;
      a = a2;
      b = b2;
      c = c2;
    }
    for (let i = 0; i < 4; i++) {
      out[dir ? 3 & -i : i] = sbox[a >>> 24] << 24 ^ sbox[b >> 16 & 255] << 16 ^ sbox[c >> 8 & 255] << 8 ^ sbox[d & 255] ^ key[kIndex++];
      a2 = a;
      a = b;
      b = c;
      c = d;
      d = a2;
    }
    return out;
  }
};
var mode = {};
mode.ctrGladman = class {
  constructor(prf, iv) {
    this._prf = prf;
    this._initIv = iv;
    this._iv = iv;
  }
  reset() {
    this._iv = this._initIv;
  }
  /** Input some data to calculate.
   * @param {bitArray} data the data to process, it must be intergral multiple of 128 bits unless it's the last.
   */
  update(data) {
    return this.calculate(this._prf, data, this._iv);
  }
  incWord(word) {
    if ((word >> 24 & 255) === 255) {
      let b1 = word >> 16 & 255;
      let b2 = word >> 8 & 255;
      let b3 = word & 255;
      if (b1 === 255) {
        b1 = 0;
        if (b2 === 255) {
          b2 = 0;
          if (b3 === 255) {
            b3 = 0;
          } else {
            ++b3;
          }
        } else {
          ++b2;
        }
      } else {
        ++b1;
      }
      word = 0;
      word += b1 << 16;
      word += b2 << 8;
      word += b3;
    } else {
      word += 1 << 24;
    }
    return word;
  }
  incCounter(counter) {
    if ((counter[0] = this.incWord(counter[0])) === 0) {
      counter[1] = this.incWord(counter[1]);
    }
  }
  calculate(prf, data, iv) {
    let l;
    if (!(l = data.length)) {
      return [];
    }
    const bl = bitArray.bitLength(data);
    for (let i = 0; i < l; i += 4) {
      this.incCounter(iv);
      const e = prf.encrypt(iv);
      data[i] ^= e[0];
      data[i + 1] ^= e[1];
      data[i + 2] ^= e[2];
      data[i + 3] ^= e[3];
    }
    return bitArray.clamp(data, bl);
  }
};
var misc = {
  importKey(password) {
    return new misc.hmacSha1(codec.bytes.toBits(password));
  },
  pbkdf2(prf, salt, count, length) {
    count = count || 1e4;
    if (length < 0 || count < 0) {
      throw new Error("invalid params to pbkdf2");
    }
    const byteLength = (length >> 5) + 1 << 2;
    let u, ui, i, j, k;
    const arrayBuffer = new ArrayBuffer(byteLength);
    const out = new DataView(arrayBuffer);
    let outLength = 0;
    const b = bitArray;
    salt = codec.bytes.toBits(salt);
    for (k = 1; outLength < (byteLength || 1); k++) {
      u = ui = prf.encrypt(b.concat(salt, [k]));
      for (i = 1; i < count; i++) {
        ui = prf.encrypt(ui);
        for (j = 0; j < ui.length; j++) {
          u[j] ^= ui[j];
        }
      }
      for (i = 0; outLength < (byteLength || 1) && i < u.length; i++) {
        out.setInt32(outLength, u[i]);
        outLength += 4;
      }
    }
    return arrayBuffer.slice(0, length / 8);
  }
};
misc.hmacSha1 = class {
  constructor(key) {
    const hmac = this;
    const Hash = hmac._hash = hash.sha1;
    const exKey = [[], []];
    hmac._baseHash = [new Hash(), new Hash()];
    const bs = hmac._baseHash[0].blockSize / 32;
    if (key.length > bs) {
      key = new Hash().update(key).finalize();
    }
    for (let i = 0; i < bs; i++) {
      exKey[0][i] = key[i] ^ 909522486;
      exKey[1][i] = key[i] ^ 1549556828;
    }
    hmac._baseHash[0].update(exKey[0]);
    hmac._baseHash[1].update(exKey[1]);
    hmac._resultHash = new Hash(hmac._baseHash[0]);
  }
  reset() {
    const hmac = this;
    hmac._resultHash = new hmac._hash(hmac._baseHash[0]);
    hmac._updated = false;
  }
  update(data) {
    const hmac = this;
    hmac._updated = true;
    hmac._resultHash.update(data);
  }
  digest() {
    const hmac = this;
    const w = hmac._resultHash.finalize();
    const result = new hmac._hash(hmac._baseHash[1]).update(w).finalize();
    hmac.reset();
    return result;
  }
  encrypt(data) {
    if (!this._updated) {
      this.update(data);
      return this.digest(data);
    } else {
      throw new Error("encrypt on already updated hmac called!");
    }
  }
};

// node_modules/@zip.js/zip.js/lib/core/streams/common-crypto.js
var GET_RANDOM_VALUES_SUPPORTED = typeof crypto != UNDEFINED_TYPE && typeof crypto.getRandomValues == FUNCTION_TYPE;
var ERR_INVALID_PASSWORD = "Invalid password";
var ERR_INVALID_SIGNATURE = "Invalid signature";
var ERR_INVALID_AUTHENTICATION_CODE = ERR_INVALID_SIGNATURE;
var ERR_ABORT_CHECK_PASSWORD = "zipjs-abort-check-password";
var ERR_UNSUPPORTED_CRYPTO_API = "Crypto API not supported";
function getRandomValues(array) {
  if (GET_RANDOM_VALUES_SUPPORTED) {
    return crypto.getRandomValues(array);
  } else {
    throw new Error(ERR_UNSUPPORTED_CRYPTO_API);
  }
}

// node_modules/@zip.js/zip.js/lib/core/streams/aes-crypto-stream.js
var BLOCK_LENGTH = 16;
var RAW_FORMAT = "raw";
var PBKDF2_ALGORITHM = { name: "PBKDF2" };
var HASH_ALGORITHM = { name: "HMAC" };
var HASH_FUNCTION = "SHA-1";
var BASE_KEY_ALGORITHM = Object.assign({ hash: HASH_ALGORITHM }, PBKDF2_ALGORITHM);
var DERIVED_BITS_ALGORITHM = Object.assign({ iterations: 1e3, hash: { name: HASH_FUNCTION } }, PBKDF2_ALGORITHM);
var DERIVED_BITS_USAGE = ["deriveBits"];
var SALT_LENGTH = [8, 12, 16];
var KEY_LENGTH = [16, 24, 32];
var AUTHENTICATION_CODE_LENGTH = 10;
var COUNTER_DEFAULT_VALUE = [0, 0, 0, 0];
var CRYPTO_API_SUPPORTED = typeof crypto != UNDEFINED_TYPE;
var subtle = CRYPTO_API_SUPPORTED && crypto.subtle;
var SUBTLE_API_SUPPORTED = CRYPTO_API_SUPPORTED && typeof subtle != UNDEFINED_TYPE;
var codecBytes = codec.bytes;
var Aes = cipher.aes;
var CtrGladman = mode.ctrGladman;
var HmacSha1 = misc.hmacSha1;
var IMPORT_KEY_SUPPORTED = CRYPTO_API_SUPPORTED && SUBTLE_API_SUPPORTED && typeof subtle.importKey == FUNCTION_TYPE;
var DERIVE_BITS_SUPPORTED = CRYPTO_API_SUPPORTED && SUBTLE_API_SUPPORTED && typeof subtle.deriveBits == FUNCTION_TYPE;
var AESDecryptionStream = class extends TransformStream {
  constructor({ password, rawPassword, encryptionStrength, checkPasswordOnly, checkAuthenticationCode = true }) {
    super({
      start() {
        initAesCrypto(this, password, rawPassword, encryptionStrength);
      },
      async transform(chunk, controller) {
        const aesCrypto = this;
        const {
          password: password2,
          strength,
          resolveReady,
          ready
        } = aesCrypto;
        if (password2) {
          await createDecryptionKeys(aesCrypto, strength, password2, subarray(chunk, 0, SALT_LENGTH[strength] + 2));
          chunk = subarray(chunk, SALT_LENGTH[strength] + 2);
          if (checkPasswordOnly) {
            controller.error(new Error(ERR_ABORT_CHECK_PASSWORD));
          } else {
            resolveReady();
          }
        } else {
          await ready;
        }
        const output = new Uint8Array(chunk.length - AUTHENTICATION_CODE_LENGTH - (chunk.length - AUTHENTICATION_CODE_LENGTH) % BLOCK_LENGTH);
        controller.enqueue(append(aesCrypto, chunk, output, 0, AUTHENTICATION_CODE_LENGTH, true));
      },
      async flush(controller) {
        const {
          ctr,
          hmac,
          pendingInput,
          ready
        } = this;
        if (hmac && ctr) {
          await ready;
          const chunkToDecrypt = subarray(pendingInput, 0, pendingInput.length - AUTHENTICATION_CODE_LENGTH);
          const originalAuthenticationCode = subarray(pendingInput, pendingInput.length - AUTHENTICATION_CODE_LENGTH);
          let decryptedChunkArray = EMPTY_UINT8_ARRAY;
          if (chunkToDecrypt.length) {
            const encryptedChunk = toBits(codecBytes, chunkToDecrypt);
            hmac.update(encryptedChunk);
            const decryptedChunk = ctr.update(encryptedChunk);
            decryptedChunkArray = fromBits(codecBytes, decryptedChunk);
          }
          const authenticationCode = subarray(fromBits(codecBytes, hmac.digest()), 0, AUTHENTICATION_CODE_LENGTH);
          let invalidAuthenticationCode = pendingInput.length < AUTHENTICATION_CODE_LENGTH ? 1 : 0;
          for (let indexByte = 0; indexByte < AUTHENTICATION_CODE_LENGTH; indexByte++) {
            invalidAuthenticationCode |= authenticationCode[indexByte] ^ originalAuthenticationCode[indexByte];
          }
          if (invalidAuthenticationCode && checkAuthenticationCode) {
            throw new Error(ERR_INVALID_AUTHENTICATION_CODE);
          }
          controller.enqueue(decryptedChunkArray);
        }
      }
    });
  }
};
var AESEncryptionStream = class extends TransformStream {
  constructor({ password, rawPassword, encryptionStrength }) {
    super({
      start() {
        initAesCrypto(this, password, rawPassword, encryptionStrength);
      },
      async transform(chunk, controller) {
        const aesCrypto = this;
        const {
          password: password2,
          strength,
          resolveReady,
          ready
        } = aesCrypto;
        let preamble = EMPTY_UINT8_ARRAY;
        if (password2) {
          preamble = await createEncryptionKeys(aesCrypto, strength, password2);
          resolveReady();
        } else {
          await ready;
        }
        const output = new Uint8Array(preamble.length + chunk.length - chunk.length % BLOCK_LENGTH);
        output.set(preamble, 0);
        controller.enqueue(append(aesCrypto, chunk, output, preamble.length, 0));
      },
      async flush(controller) {
        const {
          ctr,
          hmac,
          pendingInput,
          ready
        } = this;
        if (hmac && ctr) {
          await ready;
          let encryptedChunkArray = EMPTY_UINT8_ARRAY;
          if (pendingInput.length) {
            const encryptedChunk = ctr.update(toBits(codecBytes, pendingInput));
            hmac.update(encryptedChunk);
            encryptedChunkArray = fromBits(codecBytes, encryptedChunk);
          }
          const authenticationCode = fromBits(codecBytes, hmac.digest()).slice(0, AUTHENTICATION_CODE_LENGTH);
          controller.enqueue(concat(encryptedChunkArray, authenticationCode));
        }
      }
    });
  }
};
function initAesCrypto(aesCrypto, password, rawPassword, encryptionStrength) {
  Object.assign(aesCrypto, {
    ready: new Promise((resolve) => aesCrypto.resolveReady = resolve),
    password: encodePassword(password, rawPassword),
    strength: encryptionStrength - 1,
    pendingInput: EMPTY_UINT8_ARRAY
  });
}
function append(aesCrypto, input, output, paddingStart, paddingEnd, verifyAuthenticationCode) {
  const {
    ctr,
    hmac,
    pendingInput
  } = aesCrypto;
  if (pendingInput.length) {
    input = concat(pendingInput, input);
  }
  const inputLength = input.length - paddingEnd;
  output = expand(output, paddingStart + (inputLength - inputLength % BLOCK_LENGTH));
  let offset;
  for (offset = 0; offset <= inputLength - BLOCK_LENGTH; offset += BLOCK_LENGTH) {
    const inputChunk = toBits(codecBytes, subarray(input, offset, offset + BLOCK_LENGTH));
    if (verifyAuthenticationCode) {
      hmac.update(inputChunk);
    }
    const outputChunk = ctr.update(inputChunk);
    if (!verifyAuthenticationCode) {
      hmac.update(outputChunk);
    }
    output.set(fromBits(codecBytes, outputChunk), offset + paddingStart);
  }
  aesCrypto.pendingInput = subarray(input, offset);
  return output;
}
async function createDecryptionKeys(decrypt2, strength, password, preamble) {
  const passwordVerificationKey = await createKeys(decrypt2, strength, password, subarray(preamble, 0, SALT_LENGTH[strength]));
  const passwordVerification = subarray(preamble, SALT_LENGTH[strength]);
  if (passwordVerificationKey[0] != passwordVerification[0] || passwordVerificationKey[1] != passwordVerification[1]) {
    throw new Error(ERR_INVALID_PASSWORD);
  }
}
async function createEncryptionKeys(encrypt2, strength, password) {
  const salt = getRandomValues(new Uint8Array(SALT_LENGTH[strength]));
  const passwordVerification = await createKeys(encrypt2, strength, password, salt);
  return concat(salt, passwordVerification);
}
async function createKeys(aesCrypto, strength, password, salt) {
  aesCrypto.password = null;
  const baseKey = await importKey(RAW_FORMAT, password, BASE_KEY_ALGORITHM, false, DERIVED_BITS_USAGE);
  const derivedBits = await deriveBits(Object.assign({ salt }, DERIVED_BITS_ALGORITHM), baseKey, 8 * (KEY_LENGTH[strength] * 2 + 2));
  const compositeKey = new Uint8Array(derivedBits);
  const key = toBits(codecBytes, subarray(compositeKey, 0, KEY_LENGTH[strength]));
  const authentication = toBits(codecBytes, subarray(compositeKey, KEY_LENGTH[strength], KEY_LENGTH[strength] * 2));
  const passwordVerification = subarray(compositeKey, KEY_LENGTH[strength] * 2);
  Object.assign(aesCrypto, {
    keys: {
      key,
      authentication,
      passwordVerification
    },
    ctr: new CtrGladman(new Aes(key), Array.from(COUNTER_DEFAULT_VALUE)),
    hmac: new HmacSha1(authentication)
  });
  return passwordVerification;
}
async function importKey(format, password, algorithm, extractable, keyUsages) {
  if (IMPORT_KEY_SUPPORTED) {
    try {
      return await subtle.importKey(format, password, algorithm, extractable, keyUsages);
    } catch {
      IMPORT_KEY_SUPPORTED = false;
      return misc.importKey(password);
    }
  } else {
    return misc.importKey(password);
  }
}
async function deriveBits(algorithm, baseKey, length) {
  if (DERIVE_BITS_SUPPORTED) {
    try {
      return await subtle.deriveBits(algorithm, baseKey, length);
    } catch {
      DERIVE_BITS_SUPPORTED = false;
      return misc.pbkdf2(baseKey, algorithm.salt, DERIVED_BITS_ALGORITHM.iterations, length);
    }
  } else {
    return misc.pbkdf2(baseKey, algorithm.salt, DERIVED_BITS_ALGORITHM.iterations, length);
  }
}
function encodePassword(password, rawPassword) {
  if (rawPassword === UNDEFINED_VALUE) {
    return encodeText(password);
  } else {
    return rawPassword;
  }
}
function expand(inputArray, length) {
  if (length && length > inputArray.length) {
    const array = inputArray;
    inputArray = new Uint8Array(length);
    inputArray.set(array, 0);
  }
  return inputArray;
}
function subarray(array, begin, end) {
  return array.subarray(begin, end);
}
function fromBits(codecBytes2, chunk) {
  return codecBytes2.fromBits(chunk);
}
function toBits(codecBytes2, chunk) {
  return codecBytes2.toBits(chunk);
}

// node_modules/@zip.js/zip.js/lib/core/streams/zip-crypto-stream.js
var HEADER_LENGTH = 12;
var ZipCryptoDecryptionStream = class extends TransformStream {
  constructor({ password, rawPassword, passwordVerification, checkPasswordOnly }) {
    super({
      start() {
        initZipCrypto(this, password, rawPassword, passwordVerification);
      },
      transform(chunk, controller) {
        const zipCrypto = this;
        if (zipCrypto.password || zipCrypto.rawPassword) {
          const decryptedHeader = decrypt(zipCrypto, chunk.subarray(0, HEADER_LENGTH));
          zipCrypto.password = zipCrypto.rawPassword = null;
          if ((decryptedHeader[HEADER_LENGTH - 1] ^ zipCrypto.passwordVerification) != 0) {
            throw new Error(ERR_INVALID_PASSWORD);
          }
          chunk = chunk.subarray(HEADER_LENGTH);
        }
        if (checkPasswordOnly) {
          controller.error(new Error(ERR_ABORT_CHECK_PASSWORD));
        } else {
          controller.enqueue(decrypt(zipCrypto, chunk));
        }
      }
    });
  }
};
var ZipCryptoEncryptionStream = class extends TransformStream {
  constructor({ password, rawPassword, passwordVerification }) {
    super({
      start() {
        initZipCrypto(this, password, rawPassword, passwordVerification);
      },
      transform(chunk, controller) {
        const zipCrypto = this;
        let output;
        let offset;
        if (zipCrypto.password || zipCrypto.rawPassword) {
          zipCrypto.password = zipCrypto.rawPassword = null;
          const header = getRandomValues(new Uint8Array(HEADER_LENGTH));
          header[HEADER_LENGTH - 1] = zipCrypto.passwordVerification;
          output = new Uint8Array(chunk.length + header.length);
          output.set(encrypt(zipCrypto, header), 0);
          offset = HEADER_LENGTH;
        } else {
          output = new Uint8Array(chunk.length);
          offset = 0;
        }
        output.set(encrypt(zipCrypto, chunk), offset);
        controller.enqueue(output);
      }
    });
  }
};
function initZipCrypto(zipCrypto, password, rawPassword, passwordVerification) {
  Object.assign(zipCrypto, {
    password,
    rawPassword,
    passwordVerification
  });
  createKeys2(zipCrypto, password, rawPassword);
}
function decrypt(target, input) {
  const output = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index++) {
    output[index] = getByte(target) ^ input[index];
    updateKeys(target, output[index]);
  }
  return output;
}
function encrypt(target, input) {
  const output = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index++) {
    output[index] = getByte(target) ^ input[index];
    updateKeys(target, input[index]);
  }
  return output;
}
function createKeys2(target, password, rawPassword) {
  const keys = [305419896, 591751049, 878082192];
  Object.assign(target, {
    keys,
    crcKey0: new Crc32(keys[0]),
    crcKey2: new Crc32(keys[2])
  });
  if (rawPassword) {
    for (let index = 0; index < rawPassword.length; index++) {
      updateKeys(target, rawPassword[index]);
    }
  } else {
    for (let index = 0; index < password.length; index++) {
      updateKeys(target, password.charCodeAt(index));
    }
  }
}
function updateKeys(target, byte) {
  let [, key1] = target.keys;
  target.crcKey0.append([byte]);
  const key0 = ~target.crcKey0.get();
  key1 = getInt32(Math.imul(getInt32(key1 + getInt8(key0)), 134775813) + 1);
  target.crcKey2.append([key1 >>> 24]);
  const key2 = ~target.crcKey2.get();
  target.keys = [key0, key1, key2];
}
function getByte(target) {
  const temp = target.keys[2] | 2;
  return getInt8(Math.imul(temp, temp ^ 1) >>> 8);
}
function getInt8(number) {
  return number & 255;
}
function getInt32(number) {
  return number & 4294967295;
}

// node_modules/@zip.js/zip.js/lib/core/util/compatible-streams.js
function toCompatibleReadable(readable) {
  if (readable instanceof ReadableStream) {
    return readable;
  }
  const reader = readable.getReader();
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    }
  });
}
function streamToBlob(readable, contentType) {
  readable = toCompatibleReadable(readable);
  const blobOptions = contentType ? { type: contentType } : {};
  if (responseSupportsGlobalReadable()) {
    return new Response(readable).blob().then((blob) => contentType ? new Blob([blob], blobOptions) : blob);
  }
  const chunks = [];
  return readable.pipeTo(new WritableStream({
    write(chunk) {
      chunks.push(chunk);
    }
  })).then(() => new Blob(chunks, blobOptions));
}
function responseSupportsGlobalReadable() {
  return typeof Blob.prototype.stream != FUNCTION_TYPE || new Blob([]).stream() instanceof ReadableStream;
}
function toCompatibleWritable(writable) {
  if (writable instanceof WritableStream) {
    return writable;
  }
  const writer = writable.getWriter();
  return new WritableStream({
    write(chunk) {
      return writer.write(chunk);
    },
    close() {
      return writer.close();
    },
    abort(reason) {
      return writer.abort(reason);
    }
  });
}

// node_modules/@zip.js/zip.js/lib/core/streams/zip-entry-stream.js
var ERR_INVALID_UNCOMPRESSED_SIZE = "Invalid uncompressed size";
var ERR_INVALID_COMPRESSED_DATA = "Invalid compressed data";
var ERR_INVALID_CRC32 = ERR_INVALID_SIGNATURE;
var ERR_UNSUPPORTED_COMPRESSION = "Compression method not supported";
var FORMAT_DEFLATE_RAW = "deflate-raw";
var FORMAT_DEFLATE64_RAW = "deflate64-raw";
var FORMAT_GZIP = "gzip";
var GZIP_HEADER_LENGTH = 10;
var GZIP_TRAILER_LENGTH = 8;
var GZIP_HEADER_BYTES = [31, 139, 8];
var GZIP_OUTPUT_STALL_TIMEOUT = 5e3;
var DeflateStream = class extends TransformStream {
  constructor(options, { chunkSize, CompressionStreamFallback, CompressionStream: CompressionStream2 }) {
    super({});
    const { compressed, encrypted, useCompressionStream, zipCrypto, computeCrc32, level, deflate64, format, compressionMethod, inputSize } = options;
    const stream = this;
    let crc32Stream, encryptionStream, gzipCrc32Stream;
    let readable = super.readable;
    const codecStreams2 = format && getCodecStreams(format);
    const useGzipCrc32 = computeCrc32 && compressed && !deflate64 && !codecStreams2 && (!encrypted || zipCrypto) && Boolean(useCompressionStream && CompressionStream2);
    if ((!encrypted || zipCrypto) && computeCrc32 && !useGzipCrc32) {
      crc32Stream = new Crc32Stream();
      readable = pipeThrough(readable, crc32Stream);
    }
    if (compressed) {
      if (codecStreams2) {
        readable = pipeThroughBackpressured(readable, createCodecStream(codecStreams2.CompressionStream, format, { level, chunkSize, compressionMethod, uncompressedSize: inputSize }));
      } else if (useGzipCrc32) {
        gzipCrc32Stream = new GzipToRawDeflateStream();
        readable = pipeThroughBackpressured(readable, new CompressionStream2(FORMAT_GZIP));
        readable = pipeThrough(readable, gzipCrc32Stream);
      } else {
        try {
          readable = pipeThroughCompressionStream(readable, useCompressionStream, { level, chunkSize }, CompressionStream2, CompressionStreamFallback);
        } catch (error) {
          let gzipStream;
          try {
            gzipStream = new CompressionStream2(FORMAT_GZIP);
          } catch {
            throw error;
          }
          readable = pipeThroughBackpressured(readable, gzipStream);
          readable = pipeThrough(readable, new GzipToRawDeflateStream());
        }
      }
    }
    if (encrypted) {
      if (zipCrypto) {
        readable = pipeThrough(readable, new ZipCryptoEncryptionStream(options));
      } else {
        encryptionStream = new AESEncryptionStream(options);
        readable = pipeThrough(readable, encryptionStream);
      }
    }
    setReadable(stream, readable, () => {
      if ((!encrypted || zipCrypto) && computeCrc32) {
        stream.crc32 = useGzipCrc32 ? gzipCrc32Stream.crc32 : new DataView(crc32Stream.value.buffer).getUint32(0);
      }
    });
  }
};
var GzipToRawDeflateStream = class extends TransformStream {
  constructor() {
    let stream;
    let headerBytesLeft = GZIP_HEADER_LENGTH;
    let trailerCandidate = new Uint8Array(0);
    super({
      transform(chunk, controller) {
        if (headerBytesLeft) {
          const droppedLength = Math.min(headerBytesLeft, chunk.length);
          headerBytesLeft -= droppedLength;
          chunk = chunk.subarray(droppedLength);
          if (!chunk.length) {
            return;
          }
        }
        const availableLength = trailerCandidate.length + chunk.length;
        if (availableLength <= GZIP_TRAILER_LENGTH) {
          trailerCandidate = concat(trailerCandidate, chunk);
          return;
        }
        const emitLength = availableLength - GZIP_TRAILER_LENGTH;
        const emittedFromTrailer = Math.min(emitLength, trailerCandidate.length);
        controller.enqueue(concat(
          trailerCandidate.subarray(0, emittedFromTrailer),
          chunk.subarray(0, emitLength - emittedFromTrailer)
        ));
        trailerCandidate = concat(
          trailerCandidate.subarray(emittedFromTrailer),
          chunk.subarray(emitLength - emittedFromTrailer)
        );
      },
      flush() {
        const dataView = getDataView(trailerCandidate);
        stream.crc32 = dataView.getUint32(0, true);
        stream.uncompressedSize = dataView.getUint32(4, true);
      }
    });
    stream = this;
  }
};
function pipeThroughGzipDecompressionStream(readable, gzipStream, outputSize) {
  const crc32 = new Crc32();
  let outputLength = 0;
  let inputDone = false;
  let watchdogTimeout;
  let resolveTrailerReady, rejectTrailerReady;
  const trailerReady = new Promise((resolve, reject) => {
    resolveTrailerReady = resolve;
    rejectTrailerReady = reject;
  });
  trailerReady.catch(() => {
  });
  if (!outputSize) {
    resolveTrailerReady();
  }
  const gzipWrapStream = new TransformStream({
    start(controller) {
      const header = new Uint8Array(GZIP_HEADER_LENGTH);
      header.set(GZIP_HEADER_BYTES);
      controller.enqueue(header);
    },
    transform(chunk, controller) {
      controller.enqueue(chunk);
    },
    async flush(controller) {
      inputDone = true;
      startWatchdog();
      try {
        await trailerReady;
      } finally {
        stopWatchdog();
      }
      const trailer = new Uint8Array(GZIP_TRAILER_LENGTH);
      const dataView = getDataView(trailer);
      dataView.setUint32(0, crc32.get(), true);
      dataView.setUint32(4, outputSize, true);
      controller.enqueue(trailer);
    },
    cancel(reason) {
      rejectTrailerReady(reason);
    }
  });
  const outputStream = new TransformStream({
    transform(chunk, controller) {
      crc32.append(chunk);
      outputLength += chunk.length;
      if (outputLength >= outputSize) {
        resolveTrailerReady();
      } else if (inputDone) {
        startWatchdog();
      }
      controller.enqueue(chunk);
    },
    cancel(reason) {
      rejectTrailerReady(reason);
    }
  });
  readable = pipeThrough(readable, gzipWrapStream);
  readable = pipeThroughBackpressured(readable, gzipStream);
  return pipeThrough(readable, outputStream);
  function startWatchdog() {
    stopWatchdog();
    watchdogTimeout = setTimeout(() => rejectTrailerReady(new Error(ERR_INVALID_UNCOMPRESSED_SIZE)), GZIP_OUTPUT_STALL_TIMEOUT);
  }
  function stopWatchdog() {
    clearTimeout(watchdogTimeout);
  }
}
var InflateStream = class extends TransformStream {
  constructor(options, { chunkSize, DecompressionStreamFallback, DecompressionStream: DecompressionStream2 }) {
    super({});
    const { zipCrypto, encrypted, checkCrc32, crc32, compressed, useCompressionStream, deflate64, format, compressionMethod, rawBitFlag, outputSize } = options;
    let crc32Stream, decryptionStream;
    let readable = super.readable;
    if (encrypted) {
      if (zipCrypto) {
        readable = pipeThrough(readable, new ZipCryptoDecryptionStream(options));
      } else {
        decryptionStream = new AESDecryptionStream(options);
        readable = pipeThrough(readable, decryptionStream);
      }
    }
    if (compressed) {
      const codecStreams2 = format && getCodecStreams(format);
      if (codecStreams2) {
        readable = pipeThroughBackpressured(readable, createCodecStream(codecStreams2.DecompressionStream, format, { chunkSize, compressionMethod, rawBitFlag, uncompressedSize: outputSize }));
      } else {
        try {
          readable = pipeThroughCompressionStream(readable, useCompressionStream, { chunkSize, deflate64 }, DecompressionStream2, DecompressionStreamFallback);
        } catch (error) {
          if (deflate64 || outputSize === UNDEFINED_VALUE) {
            throw error;
          }
          let gzipStream;
          try {
            gzipStream = new DecompressionStream2(FORMAT_GZIP);
          } catch {
            throw error;
          }
          readable = pipeThroughGzipDecompressionStream(readable, gzipStream, outputSize);
        }
      }
      readable = mapInflateStreamError(readable);
    }
    if (checkCrc32) {
      crc32Stream = new Crc32Stream();
      readable = pipeThrough(readable, crc32Stream);
    }
    setReadable(this, readable, () => {
      if (checkCrc32) {
        const computedCrc32View = new DataView(crc32Stream.value.buffer);
        if (crc32 != computedCrc32View.getUint32(0, false)) {
          throw new Error(ERR_INVALID_CRC32);
        }
      }
    });
  }
};
var formatSupportByStream = /* @__PURE__ */ new Map();
function supportsFormat(StreamClass, format) {
  if (!StreamClass) {
    return false;
  }
  let supportByFormat = formatSupportByStream.get(StreamClass);
  if (!supportByFormat) {
    supportByFormat = /* @__PURE__ */ new Map();
    formatSupportByStream.set(StreamClass, supportByFormat);
  }
  let supported = supportByFormat.get(format);
  if (supported === UNDEFINED_VALUE) {
    try {
      new StreamClass(format);
      supported = true;
    } catch {
      supported = false;
    }
    supportByFormat.set(format, supported);
  }
  return supported;
}
function supportsDeflateRaw(StreamClass) {
  return supportsFormat(StreamClass, FORMAT_DEFLATE_RAW);
}
function supportsGzip(StreamClass) {
  return supportsFormat(StreamClass, FORMAT_GZIP);
}
function setReadable(stream, readable, flush) {
  readable = pipeThrough(readable, new TransformStream({ flush }));
  Object.defineProperty(stream, "readable", {
    get() {
      return readable;
    }
  });
}
function createCodecStream(CodecStreamClass, format, options) {
  if (!CodecStreamClass) {
    throw new Error(ERR_UNSUPPORTED_COMPRESSION);
  }
  return new CodecStreamClass(format, options);
}
function pipeThroughCompressionStream(readable, useCompressionStream, options, CompressionStreamNative, CompressionStreamFallback) {
  const Stream2 = useCompressionStream && CompressionStreamNative ? CompressionStreamNative : CompressionStreamFallback || CompressionStreamNative;
  const format = options.deflate64 ? FORMAT_DEFLATE64_RAW : FORMAT_DEFLATE_RAW;
  let codecStream;
  try {
    codecStream = new Stream2(format, options);
  } catch (error) {
    if (useCompressionStream && CompressionStreamFallback && Stream2 != CompressionStreamFallback) {
      codecStream = new CompressionStreamFallback(format, options);
    } else {
      throw error;
    }
  }
  return pipeThroughBackpressured(readable, codecStream);
}
function pipeThrough(readable, transformStream) {
  return toCompatibleReadable(readable).pipeThrough(transformStream);
}
function pipeThroughBackpressured(readable, transformStream) {
  const writer = transformStream.writable.getWriter();
  const reader = readable.getReader();
  pump();
  return transformStream.readable;
  async function pump() {
    try {
      for (; ; ) {
        await writer.ready;
        const result = await reader.read();
        if (result.done) {
          await writer.close();
          break;
        }
        await writer.write(result.value);
      }
    } catch (error) {
      await abort(writer, error);
      await cancel(reader, error);
    }
  }
}
async function abort(writer, error) {
  try {
    await writer.abort(error);
  } catch {
  }
}
async function cancel(reader, error) {
  try {
    await reader.cancel(error);
  } catch {
  }
}
function mapInflateStreamError(readable) {
  const reader = readable.getReader();
  return new ReadableStream({
    async pull(controller) {
      let result;
      try {
        result = await reader.read();
      } catch (error) {
        if (error && error.message) {
          throw error;
        }
        const mappedError = new Error(ERR_INVALID_COMPRESSED_DATA);
        mappedError.cause = error;
        throw mappedError;
      }
      const { value, done } = result;
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    }
  });
}

// node_modules/@zip.js/zip.js/lib/core/streams/codec-stream.js
var DEFAULT_CHUNK_SIZE2 = 64 * 1024;
var MESSAGE_EVENT_TYPE = "message";
var MESSAGE_START = "start";
var MESSAGE_PULL = "pull";
var MESSAGE_DATA = "data";
var MESSAGE_ACK_DATA = "ack";
var MESSAGE_CLOSE = "close";
var CODEC_DEFLATE = "deflate";
var CODEC_INFLATE = "inflate";
var CodecStream = class extends TransformStream {
  constructor(options, config2) {
    super({});
    const codec2 = this;
    const { codecType } = options;
    let Stream2;
    if (codecType.startsWith(CODEC_DEFLATE)) {
      Stream2 = DeflateStream;
    } else if (codecType.startsWith(CODEC_INFLATE)) {
      Stream2 = InflateStream;
    }
    codec2.outputSize = 0;
    let inputSize = 0;
    const stream = new Stream2(options, config2);
    const readable = super.readable;
    const inputSizeStream = new TransformStream({
      transform(chunk, controller) {
        if (chunk && chunk.length) {
          inputSize += chunk.length;
          controller.enqueue(chunk);
        }
      },
      flush() {
        Object.assign(codec2, {
          inputSize
        });
      }
    });
    const outputSizeStream = new TransformStream({
      transform(chunk, controller) {
        if (chunk && chunk.length) {
          controller.enqueue(chunk);
          codec2.outputSize += chunk.length;
          if (options.outputSize !== UNDEFINED_VALUE && codec2.outputSize > options.outputSize) {
            throw new Error(ERR_INVALID_UNCOMPRESSED_SIZE);
          }
        }
      },
      flush() {
        const { crc32 } = stream;
        Object.assign(codec2, {
          crc32,
          inputSize
        });
      }
    });
    Object.defineProperty(codec2, "readable", {
      get() {
        return readable.pipeThrough(inputSizeStream).pipeThrough(stream).pipeThrough(outputSizeStream);
      }
    });
  }
};
var ChunkStream = class extends TransformStream {
  constructor(chunkSize) {
    const pendingChunks = [];
    let pendingLength = 0;
    if (!Number.isFinite(chunkSize) || chunkSize < 1) {
      chunkSize = DEFAULT_CHUNK_SIZE2;
    }
    super({
      transform(chunk, controller) {
        pendingChunks.push(chunk);
        pendingLength += chunk.length;
        while (pendingLength > chunkSize) {
          controller.enqueue(shiftChunk());
        }
      },
      flush(controller) {
        if (pendingLength) {
          controller.enqueue(concatChunks(pendingChunks, pendingLength));
        }
      }
    });
    function shiftChunk() {
      const result = new Uint8Array(chunkSize);
      let resultOffset = 0;
      while (resultOffset < chunkSize) {
        const firstChunk = pendingChunks[0];
        const remainingLength = chunkSize - resultOffset;
        if (firstChunk.length <= remainingLength) {
          result.set(firstChunk, resultOffset);
          resultOffset += firstChunk.length;
          pendingChunks.shift();
        } else {
          result.set(firstChunk.subarray(0, remainingLength), resultOffset);
          pendingChunks[0] = firstChunk.subarray(remainingLength);
          resultOffset += remainingLength;
        }
      }
      pendingLength -= chunkSize;
      return result;
    }
    function concatChunks(chunks, length) {
      const result = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    }
  }
};

// node_modules/@zip.js/zip.js/lib/core/codec-worker.js
var ERR_WORKER_STARTUP_TIMEOUT = "Worker startup timeout";
var webWorkerSupported;
var createWorkerFailed;
var webWorkerBackend;
var initModule = () => {
};
function configureWorker({ initModule: initModuleFunction }) {
  initModule = initModuleFunction;
}
function setWebWorkerBackend(backend) {
  webWorkerBackend = backend;
}
async function supportsDeflate(config2) {
  const { CompressionStream: NativeStream, CompressionStreamFallback: FallbackStream } = config2;
  if (FallbackStream && !FallbackStream.requiresModule) {
    return true;
  }
  if (supportsDeflateRaw(NativeStream) || supportsGzip(NativeStream)) {
    return true;
  }
  if (FallbackStream) {
    try {
      await initModule(config2);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
function resetWebWorkerSupport() {
  webWorkerSupported = UNDEFINED_VALUE;
  createWorkerFailed = false;
}
function disableWebWorker(workerData) {
  if (workerData.createWorker) {
    createWorkerFailed = true;
  } else {
    webWorkerSupported = false;
  }
}
var CodecWorker = class {
  constructor(workerData, { readable, writable }, { options, config: config2, streamOptions, useWebWorkers, transferStreams, workerURI, createWorker }, onTaskFinished) {
    const { signal } = streamOptions;
    if (createWorkerFailed) {
      createWorker = UNDEFINED_VALUE;
    }
    Object.assign(workerData, {
      busy: true,
      generation: (workerData.generation || 0) + 1,
      readable: readable.pipeThrough(new ChunkStream(getChunkSize(config2))).pipeThrough(new ProgressWatcherStream(streamOptions), { signal }),
      writable,
      options: Object.assign({}, options),
      workerURI,
      createWorker,
      transferStreams,
      terminate() {
        return new Promise((resolve) => {
          const { worker, busy } = workerData;
          if (worker) {
            if (busy) {
              workerData.resolveTerminated = resolve;
            } else {
              worker.terminate();
              resolve();
            }
            workerData.interface = null;
          } else {
            resolve();
          }
        });
      },
      onTaskFinished() {
        if (workerData.busy) {
          const { resolveTerminated } = workerData;
          if (resolveTerminated) {
            workerData.resolveTerminated = null;
            workerData.terminated = true;
            workerData.worker.terminate();
            resolveTerminated();
          }
          workerData.busy = false;
          onTaskFinished(workerData);
        }
      }
    });
    if (webWorkerSupported === UNDEFINED_VALUE) {
      webWorkerSupported = typeof Worker != UNDEFINED_TYPE;
    }
    return (useWebWorkers && webWorkerBackend && (webWorkerSupported && workerURI || createWorker) ? webWorkerBackend : createWorkerInterface)(workerData, config2);
  }
};
var ProgressWatcherStream = class extends TransformStream {
  constructor({ onstart, onprogress, size, onend }) {
    let chunkOffset = 0;
    super({
      async start() {
        if (onstart) {
          await callHandler(onstart, size);
        }
      },
      async transform(chunk, controller) {
        chunkOffset += chunk.length;
        if (onprogress) {
          await callHandler(onprogress, chunkOffset, size);
        }
        controller.enqueue(chunk);
      },
      async flush() {
        if (onend) {
          await callHandler(onend, chunkOffset);
        }
      }
    });
  }
};
async function callHandler(handler, ...parameters) {
  try {
    await handler(...parameters);
  } catch {
  }
}
function createWorkerInterface(workerData, config2) {
  return {
    run: () => runWorker(workerData, config2)
  };
}
async function runWorker({ options, readable, writable, onTaskFinished }, config2) {
  let codecStream;
  try {
    if (options.compressed && !options.format) {
      const deflate = options.codecType.startsWith(CODEC_DEFLATE);
      const FallbackStream = deflate ? config2.CompressionStreamFallback : config2.DecompressionStreamFallback;
      const NativeStream = deflate ? config2.CompressionStream : config2.DecompressionStream;
      if (!options.useCompressionStream) {
        try {
          await initModule(config2);
        } catch {
          if (!FallbackStream || FallbackStream.requiresModule) {
            options.useCompressionStream = true;
          }
        }
      } else if (FallbackStream && FallbackStream.requiresModule && !supportsDeflateRaw(NativeStream)) {
        try {
          await initModule(config2);
        } catch {
        }
      }
    }
    codecStream = new CodecStream(options, config2);
    await readable.pipeThrough(codecStream).pipeThrough(new ChunkStream(getChunkSize(config2))).pipeTo(writable, { preventClose: true, preventAbort: true });
    const {
      crc32,
      inputSize,
      outputSize
    } = codecStream;
    return {
      crc32,
      inputSize,
      outputSize
    };
  } catch (error) {
    if (codecStream) {
      error.outputSize = codecStream.outputSize;
    }
    throw error;
  } finally {
    onTaskFinished();
  }
}

// node_modules/@zip.js/zip.js/lib/core/codec-pool.js
var pool = [];
var pendingRequests = [];
var starvationTimeout;
var starvationDelay;
var indexWorker = 0;
async function runWorker2(stream, workerOptions) {
  const { options, config: config2 } = workerOptions;
  const { transferStreams, useWebWorkers, useCompressionStream, compressed, checkCrc32, computeCrc32, encrypted, format, codecURI } = options;
  const { workerURI, createWorker, maxWorkers: maxWorkers2 } = config2;
  if (format) {
    if (codecURI) {
      options.codecURI = resolveCodecURI(codecURI, config2.baseURI);
    }
    await ensureCodecStreams(format, options.codecURI);
  }
  workerOptions.transferStreams = !format && (transferStreams || transferStreams === UNDEFINED_VALUE && config2.transferStreams);
  const streamCopy = !compressed && !checkCrc32 && !computeCrc32 && !encrypted;
  const workerSupported = format === UNDEFINED_VALUE || Boolean(options.codecURI);
  workerOptions.useWebWorkers = !streamCopy && workerSupported && (useWebWorkers || useWebWorkers === UNDEFINED_VALUE && config2.useWebWorkers);
  workerOptions.workerURI = workerOptions.useWebWorkers && workerURI ? workerURI : UNDEFINED_VALUE;
  workerOptions.createWorker = workerOptions.useWebWorkers && createWorker ? createWorker : UNDEFINED_VALUE;
  options.useCompressionStream = useCompressionStream || useCompressionStream === UNDEFINED_VALUE && config2.useCompressionStream;
  return (await getWorker()).run();
  async function getWorker() {
    const workerData = pool.find((workerData2) => !workerData2.busy);
    if (workerData) {
      clearTerminateTimeout(workerData);
      return new CodecWorker(workerData, stream, workerOptions, onTaskFinished);
    } else if (pool.length < maxWorkers2) {
      const workerData2 = { indexWorker };
      indexWorker++;
      pool.push(workerData2);
      return new CodecWorker(workerData2, stream, workerOptions, onTaskFinished);
    } else {
      return new Promise((resolve) => {
        pendingRequests.push({ resolve, stream, workerOptions });
        starvationDelay = config2.workerStarvationTimeout;
        armStarvationTimeout();
      });
    }
  }
  function onTaskFinished(workerData) {
    clearStarvationTimeout();
    if (pendingRequests.length) {
      const [{ resolve, stream: stream2, workerOptions: workerOptions2 }] = pendingRequests.splice(0, 1);
      resolve(new CodecWorker(workerData, stream2, workerOptions2, onTaskFinished));
      armStarvationTimeout();
    } else if (workerData.worker) {
      clearTerminateTimeout(workerData);
      terminateWorker(workerData, workerOptions);
    } else {
      pool = pool.filter((data) => data != workerData);
    }
  }
}
function resolveCodecURI(codecURI, baseURI) {
  try {
    return new URL(codecURI, baseURI).toString();
  } catch {
    return codecURI;
  }
}
function armStarvationTimeout() {
  if (!starvationTimeout && pendingRequests.length && Number.isFinite(starvationDelay) && starvationDelay >= 0) {
    starvationTimeout = setTimeout(onWorkerStarvation, starvationDelay);
  }
}
function clearStarvationTimeout() {
  if (starvationTimeout) {
    clearTimeout(starvationTimeout);
    starvationTimeout = null;
  }
}
function onWorkerStarvation() {
  starvationTimeout = null;
  if (pendingRequests.length) {
    const [{ resolve, stream, workerOptions }] = pendingRequests.splice(0, 1);
    const inlineWorkerOptions = Object.assign({}, workerOptions, { useWebWorkers: false, workerURI: UNDEFINED_VALUE, createWorker: UNDEFINED_VALUE });
    resolve(new CodecWorker({}, stream, inlineWorkerOptions, onInlineTaskFinished));
    armStarvationTimeout();
  }
}
function onInlineTaskFinished() {
  clearStarvationTimeout();
  armStarvationTimeout();
}
function terminateWorker(workerData, workerOptions) {
  const { config: config2 } = workerOptions;
  const { terminateWorkerTimeout } = config2;
  if (Number.isFinite(terminateWorkerTimeout) && terminateWorkerTimeout >= 0) {
    if (workerData.terminated) {
      workerData.terminated = false;
    } else {
      workerData.terminateTimeout = setTimeout(async () => {
        pool = pool.filter((data) => data != workerData);
        try {
          await workerData.terminate();
        } catch {
        }
      }, terminateWorkerTimeout);
    }
  }
}
function clearTerminateTimeout(workerData) {
  const { terminateTimeout } = workerData;
  if (terminateTimeout) {
    clearTimeout(terminateTimeout);
    workerData.terminateTimeout = null;
  }
}
async function terminateWorkers() {
  await Promise.allSettled(pool.map((workerData) => {
    clearTerminateTimeout(workerData);
    return workerData.terminate();
  }));
  resetWebWorkerSupport();
}

// node_modules/@zip.js/zip.js/lib/core/util/decode-cp437.js
var CP437 = "\0☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ".split("");
var VALID_CP437 = CP437.length == 256;
function decodeCP437(stringValue) {
  if (VALID_CP437) {
    let result = "";
    for (let indexCharacter = 0; indexCharacter < stringValue.length; indexCharacter++) {
      result += CP437[stringValue[indexCharacter]];
    }
    return result;
  } else {
    return new TextDecoder().decode(stringValue);
  }
}

// node_modules/@zip.js/zip.js/lib/core/util/decode-text.js
function decodeText(value, encoding) {
  return decode(value, encoding, true);
}
function decodeTextRemovingBOM(value, encoding) {
  return decode(value, encoding, false);
}
function decode(value, encoding, ignoreBOM) {
  if (encoding && encoding.trim().toLowerCase() == "cp437") {
    return decodeCP437(value);
  } else {
    return new TextDecoder(encoding, { ignoreBOM }).decode(value);
  }
}

// node_modules/@zip.js/zip.js/lib/core/io.js
var ERR_HTTP_STATUS = "HTTP error ";
var ERR_HTTP_RANGE = "HTTP Range not supported";
var ERR_HTTP_RESOURCE_CHANGED = "HTTP resource changed";
var ERR_ITERATOR_COMPLETED_TOO_SOON = "Writer iterator completed too soon";
var ERR_WRITER_NOT_INITIALIZED = "Writer not initialized";
var CONTENT_TYPE_TEXT_PLAIN = "text/plain";
var HTTP_HEADER_CONTENT_LENGTH = "Content-Length";
var HTTP_HEADER_CONTENT_ENCODING = "Content-Encoding";
var HTTP_HEADER_CONTENT_RANGE = "Content-Range";
var HTTP_HEADER_ACCEPT_RANGES = "Accept-Ranges";
var HTTP_HEADER_RANGE = "Range";
var HTTP_HEADER_ETAG = "Etag";
var HTTP_HEADER_LAST_MODIFIED = "Last-Modified";
var HTTP_METHOD_HEAD = "HEAD";
var HTTP_METHOD_GET = "GET";
var HTTP_RANGE_UNIT = "bytes";
var DEFAULT_BUFFER_SIZE = 256 * 1024;
var DEFAULT_MAXIMUM_RANGE_SIZE = 16 * 1024 * 1024;
var PROPERTY_NAME_WRITABLE = "writable";
var DISK_BOUNDARY = Symbol();
var Stream = class {
  constructor() {
    this.size = 0;
  }
  init() {
    this.initialized = true;
  }
};
var Reader = class extends Stream {
  get readable() {
    return this.createReadable();
  }
  createReadable({ offset = 0, size, chunkSize = getChunkSize(getConfiguration()) } = {}) {
    const reader = this;
    let chunkOffset = 0;
    chunkSize = normalizeChunkSize(chunkSize);
    return new ReadableStream({
      async pull(controller) {
        const dataSize = size === UNDEFINED_VALUE ? chunkSize : Math.min(chunkSize, size - chunkOffset);
        const data = await readUint8Array(reader, offset + chunkOffset, dataSize);
        if (data.length) {
          controller.enqueue(data);
        }
        if (chunkOffset + chunkSize >= size || !data.length && dataSize) {
          controller.close();
        } else {
          chunkOffset += chunkSize;
        }
      }
    });
  }
};
var Writer = class extends Stream {
  constructor() {
    super();
    const writer = this;
    const writable = new WritableStream({
      write(chunk) {
        if (!writer.initialized) {
          throw new Error(ERR_WRITER_NOT_INITIALIZED);
        }
        return writer.writeUint8Array(toExactUint8Array(chunk));
      }
    });
    Object.defineProperty(writer, PROPERTY_NAME_WRITABLE, {
      get() {
        return writable;
      }
    });
  }
  writeUint8Array() {
  }
};
var Data64URIReader = class extends Reader {
  constructor(dataURI) {
    super();
    let dataEnd = dataURI.length;
    while (dataURI.charAt(dataEnd - 1) == "=") {
      dataEnd--;
    }
    const dataStart = dataURI.indexOf(",") + 1;
    Object.assign(this, {
      dataURI,
      dataStart,
      size: Math.floor((dataEnd - dataStart) * 0.75)
    });
  }
  readUint8Array(offset, length) {
    const {
      dataStart,
      dataURI
    } = this;
    const dataArray = new Uint8Array(length);
    const start = Math.floor(offset / 3) * 4;
    const bytes = atob(dataURI.substring(start + dataStart, Math.ceil((offset + length) / 3) * 4 + dataStart));
    const delta = offset - Math.floor(start / 4) * 3;
    let effectiveLength = 0;
    for (let indexByte = delta; indexByte < delta + length && indexByte < bytes.length; indexByte++) {
      dataArray[indexByte - delta] = bytes.charCodeAt(indexByte);
      effectiveLength++;
    }
    if (effectiveLength < dataArray.length) {
      return dataArray.subarray(0, effectiveLength);
    } else {
      return dataArray;
    }
  }
};
var Data64URIWriter = class extends Writer {
  constructor(contentType) {
    super();
    Object.assign(this, {
      contentType,
      data: "data:" + (contentType || "") + ";base64,",
      pendingCharacters: ""
    });
  }
  writeUint8Array(array) {
    const writer = this;
    let indexArray;
    let dataString = writer.pendingCharacters;
    const delta = writer.pendingCharacters.length;
    writer.pendingCharacters = "";
    for (indexArray = 0; indexArray < Math.floor((delta + array.length) / 3) * 3 - delta; indexArray++) {
      dataString += String.fromCharCode(array[indexArray]);
    }
    for (; indexArray < array.length; indexArray++) {
      writer.pendingCharacters += String.fromCharCode(array[indexArray]);
    }
    if (dataString.length > 2) {
      writer.data += btoa(dataString);
    } else {
      writer.pendingCharacters = dataString + writer.pendingCharacters;
    }
  }
  getData() {
    return this.data + btoa(this.pendingCharacters);
  }
};
var blobSliceReliable;
var blobSliceProbe;
function probeBlobSliceReliability() {
  blobSliceProbe = (async () => {
    try {
      const slicedBlob = new Blob([new Uint8Array(3)]).slice(1, 2);
      const streamReader = slicedBlob.stream().getReader();
      let streamedLength = 0;
      let result = await streamReader.read();
      while (!result.done) {
        streamedLength += result.value.length;
        result = await streamReader.read();
      }
      blobSliceReliable = streamedLength == 1;
    } catch {
      blobSliceReliable = false;
    }
  })();
}
var BlobReader = class extends Reader {
  constructor(blob) {
    super();
    Object.assign(this, {
      sourceBlob: blob,
      size: blob.size
    });
    if (!blobSliceProbe) {
      probeBlobSliceReliability();
    }
  }
  createReadable(options) {
    const reader = this;
    const { sourceBlob, size } = reader;
    const { offset = 0, size: readSize = size - offset } = options || {};
    if (!offset && readSize >= size) {
      return toCompatibleReadable(sourceBlob.stream());
    }
    if (blobSliceReliable) {
      return toCompatibleReadable(sourceBlob.slice(offset, offset + readSize).stream());
    }
    return super.createReadable(options);
  }
  async readUint8Array(offset, length) {
    const reader = this;
    const offsetEnd = offset + length;
    const readsWholeBlob = !offset && offsetEnd >= reader.size;
    const blob = readsWholeBlob ? reader.sourceBlob : reader.sourceBlob.slice(offset, offsetEnd);
    let arrayBuffer = await blob.arrayBuffer();
    const sliceIgnoredByBuggyImplementation = arrayBuffer.byteLength > length;
    if (sliceIgnoredByBuggyImplementation) {
      arrayBuffer = arrayBuffer.slice(offset, offsetEnd);
    }
    return new Uint8Array(arrayBuffer);
  }
};
var BlobWriter = class extends Stream {
  constructor(contentType) {
    super();
    const writer = this;
    const transformStream = new TransformStream();
    Object.defineProperty(writer, PROPERTY_NAME_WRITABLE, {
      get() {
        return transformStream.writable;
      }
    });
    writer.contentType = contentType;
    writer.blobPromise = streamToBlob(transformStream.readable, contentType);
    writer.blobPromise.catch(() => {
    });
  }
  getData() {
    return this.blobPromise;
  }
};
var TextReader = class extends BlobReader {
  constructor(text) {
    super(new Blob([text], { type: CONTENT_TYPE_TEXT_PLAIN }));
  }
};
function getTextSize(text) {
  let size = 0;
  for (let indexCharacter = 0; indexCharacter < text.length; indexCharacter++) {
    const characterCode = text.charCodeAt(indexCharacter);
    if (characterCode < 128) {
      size += 1;
    } else if (characterCode < 2048) {
      size += 2;
    } else if (characterCode < 55296 || characterCode >= 57344) {
      size += 3;
    } else if (characterCode < 56320 && (text.charCodeAt(indexCharacter + 1) & 64512) == 56320) {
      size += 4;
      indexCharacter++;
    } else {
      size += 3;
    }
  }
  return size;
}
var TextWriter = class extends BlobWriter {
  constructor(encoding) {
    super();
    Object.assign(this, {
      encoding,
      utf8: !encoding || encoding.toLowerCase() == "utf-8"
    });
  }
  async getData() {
    const {
      encoding,
      utf8
    } = this;
    const blob = await super.getData();
    if (blob.text && utf8) {
      return blob.text();
    } else {
      return decodeTextRemovingBOM(new Uint8Array(await blob.arrayBuffer()), encoding);
    }
  }
};
var FetchReader = class extends Reader {
  constructor(url, options) {
    super();
    createHttpReader(this, url, options);
  }
  async init() {
    await initHttpReader(this, sendFetchRequest, getFetchRequestData);
    super.init();
  }
  createReadable(options) {
    const reader = this;
    const { useRangeHeader, forceRangeRequests, size } = reader;
    if ((useRangeHeader || forceRangeRequests) && size !== UNDEFINED_VALUE) {
      const { offset = 0, size: readSize = size - offset } = options || {};
      if (readSize > 0 && offset < size) {
        return createRangeReadable(reader, offset, Math.min(readSize, size - offset));
      }
    }
    return super.createReadable(options);
  }
  readUint8Array(index, length) {
    return readUint8ArrayHttpReader(this, index, length, sendFetchRequest, getFetchRequestData);
  }
};
var XHRReader = class extends Reader {
  constructor(url, options) {
    super();
    createHttpReader(this, url, options);
  }
  async init() {
    await initHttpReader(this, sendXMLHttpRequest, getXMLHttpRequestData);
    super.init();
  }
  readUint8Array(index, length) {
    return readUint8ArrayHttpReader(this, index, length, sendXMLHttpRequest, getXMLHttpRequestData);
  }
};
function createHttpReader(httpReader, url, options) {
  const {
    preventHeadRequest,
    useRangeHeader,
    forceRangeRequests,
    combineSizeEocd,
    checkResourceChanges = true,
    maximumRangeSize = DEFAULT_MAXIMUM_RANGE_SIZE,
    fetch: fetch2
  } = options;
  options = Object.assign({}, options);
  delete options.preventHeadRequest;
  delete options.useRangeHeader;
  delete options.forceRangeRequests;
  delete options.combineSizeEocd;
  delete options.checkResourceChanges;
  delete options.maximumRangeSize;
  delete options.useXHR;
  delete options.fetch;
  Object.assign(httpReader, {
    url,
    options,
    preventHeadRequest,
    useRangeHeader,
    forceRangeRequests,
    combineSizeEocd,
    checkResourceChanges,
    maximumRangeSize,
    fetch: fetch2
  });
}
async function initHttpReader(httpReader, sendRequest, getRequestData2) {
  const {
    url,
    preventHeadRequest,
    useRangeHeader,
    forceRangeRequests,
    combineSizeEocd
  } = httpReader;
  if (isHttpFamily(url) && (useRangeHeader || forceRangeRequests) && (typeof preventHeadRequest == UNDEFINED_TYPE || preventHeadRequest)) {
    const response = await sendRequest(HTTP_METHOD_GET, httpReader, getRangeHeaders(httpReader, combineSizeEocd ? -END_OF_CENTRAL_DIR_LENGTH : void 0));
    const acceptRanges = response.headers.get(HTTP_HEADER_ACCEPT_RANGES);
    if (!forceRangeRequests && (!acceptRanges || acceptRanges.toLowerCase() != HTTP_RANGE_UNIT)) {
      throw new Error(ERR_HTTP_RANGE);
    } else {
      if (combineSizeEocd) {
        const eocdCache = new Uint8Array(await response.arrayBuffer());
        if (response.status == 206 && eocdCache.length == END_OF_CENTRAL_DIR_LENGTH) {
          httpReader.eocdCache = eocdCache;
        }
      }
      setResourceValidators(httpReader, response);
      const contentSize = getContentRangeSize(response);
      if (contentSize === UNDEFINED_VALUE) {
        await getContentLength(httpReader, sendRequest, getRequestData2);
      } else {
        httpReader.size = contentSize;
      }
    }
  } else {
    await getContentLength(httpReader, sendRequest, getRequestData2);
  }
}
async function readUint8ArrayHttpReader(httpReader, index, length, sendRequest, getRequestData2) {
  const {
    useRangeHeader,
    forceRangeRequests,
    eocdCache,
    size,
    options
  } = httpReader;
  if (useRangeHeader || forceRangeRequests) {
    if (eocdCache && index == size - END_OF_CENTRAL_DIR_LENGTH && length == END_OF_CENTRAL_DIR_LENGTH) {
      return eocdCache;
    }
    if (index >= size || length === 0) {
      return EMPTY_UINT8_ARRAY;
    } else {
      if (index + length > size) {
        length = size - index;
      }
      const response = await sendRequest(HTTP_METHOD_GET, httpReader, getRangeHeaders(httpReader, index, length));
      if (response.status != 206) {
        throw new Error(ERR_HTTP_RANGE);
      }
      const contentRangeHeader = response.headers.get(HTTP_HEADER_CONTENT_RANGE);
      if (contentRangeHeader) {
        const rangeStart = Number(contentRangeHeader.trim().split(/[\s-]+/)[1]);
        if (!Number.isNaN(rangeStart) && rangeStart != index) {
          throw new Error(ERR_HTTP_RANGE);
        }
      }
      checkResourceValidators(httpReader, response);
      setResourceValidators(httpReader, response);
      const data = new Uint8Array(await response.arrayBuffer());
      if (data.length != length) {
        throw new Error(ERR_HTTP_RANGE);
      }
      return data;
    }
  } else {
    const { data } = httpReader;
    if (!data) {
      await getRequestData2(httpReader, options);
    }
    return httpReader.data.subarray(index, index + length);
  }
}
function createRangeReadable(httpReader, offset, size) {
  let bodyReader;
  let windowOffset = offset;
  let windowRemainingLength = 0;
  let remainingLength = size;
  return new ReadableStream({
    start() {
      return openWindow();
    },
    async pull(controller) {
      if (!bodyReader) {
        await openWindow();
      }
      const { value, done } = await bodyReader.read();
      if (done) {
        throw new Error(ERR_HTTP_RANGE);
      }
      const chunk = value.length > windowRemainingLength ? value.subarray(0, windowRemainingLength) : value;
      windowRemainingLength -= chunk.length;
      remainingLength -= chunk.length;
      if (chunk.length) {
        controller.enqueue(chunk);
      }
      if (!windowRemainingLength) {
        await closeWindow();
        if (!remainingLength) {
          controller.close();
        }
      }
    },
    cancel(reason) {
      return bodyReader && bodyReader.cancel(reason);
    }
  });
  async function openWindow() {
    const windowLength = Math.min(httpReader.maximumRangeSize, remainingLength);
    const response = await sendFetchRequest(HTTP_METHOD_GET, httpReader, getRangeHeaders(httpReader, windowOffset, windowLength));
    if (response.status != 206) {
      throw new Error(ERR_HTTP_RANGE);
    }
    const contentRangeHeader = response.headers.get(HTTP_HEADER_CONTENT_RANGE);
    if (contentRangeHeader) {
      const rangeStart = Number(contentRangeHeader.trim().split(/[\s-]+/)[1]);
      if (!Number.isNaN(rangeStart) && rangeStart != windowOffset) {
        throw new Error(ERR_HTTP_RANGE);
      }
    }
    checkResourceValidators(httpReader, response);
    setResourceValidators(httpReader, response);
    windowOffset += windowLength;
    windowRemainingLength = windowLength;
    bodyReader = response.body.getReader();
  }
  async function closeWindow() {
    const currentBodyReader = bodyReader;
    bodyReader = UNDEFINED_VALUE;
    await currentBodyReader.cancel();
  }
}
function getContentRangeSize(response) {
  const contentRangeHeader = response.headers.get(HTTP_HEADER_CONTENT_RANGE);
  if (contentRangeHeader) {
    const headerValue = contentRangeHeader.trim().split(/\s*\/\s*/)[1];
    if (headerValue && headerValue != "*") {
      const contentSize = Number(headerValue);
      if (!Number.isNaN(contentSize)) {
        return contentSize;
      }
    }
  }
}
function getResourceValidators({ headers }) {
  return {
    etag: headers.get(HTTP_HEADER_ETAG) || UNDEFINED_VALUE,
    lastModified: headers.get(HTTP_HEADER_LAST_MODIFIED) || UNDEFINED_VALUE
  };
}
function setResourceValidators(httpReader, response) {
  const { checkResourceChanges, resourceValidators } = httpReader;
  if (checkResourceChanges && !resourceValidators && response.status == 206) {
    httpReader.resourceValidators = getResourceValidators(response);
  }
}
function checkResourceValidators(httpReader, response) {
  const { checkResourceChanges, resourceValidators, size } = httpReader;
  if (checkResourceChanges) {
    const contentRangeSize = getContentRangeSize(response);
    if (contentRangeSize !== UNDEFINED_VALUE && size !== UNDEFINED_VALUE && contentRangeSize != size) {
      throw new Error(ERR_HTTP_RESOURCE_CHANGED);
    }
    if (resourceValidators) {
      const validators = getResourceValidators(response);
      const changed = Object.entries(resourceValidators).some(([name, value]) => value !== UNDEFINED_VALUE && validators[name] !== UNDEFINED_VALUE && value != validators[name]);
      if (changed) {
        throw new Error(ERR_HTTP_RESOURCE_CHANGED);
      }
    }
  }
}
function getRangeHeaders(httpReader, index = 0, length = 1) {
  return Object.assign({}, getHeaders(httpReader), { [HTTP_HEADER_RANGE]: HTTP_RANGE_UNIT + "=" + (index < 0 ? index : index + "-" + (index + length - 1)) });
}
function getHeaders({ options }) {
  const { headers } = options;
  if (headers) {
    if (Symbol.iterator in headers) {
      return Object.fromEntries(headers);
    } else {
      return headers;
    }
  }
}
async function getFetchRequestData(httpReader) {
  await getRequestData(httpReader, sendFetchRequest);
}
async function getXMLHttpRequestData(httpReader) {
  await getRequestData(httpReader, sendXMLHttpRequest);
}
async function getRequestData(httpReader, sendRequest) {
  const response = await sendRequest(HTTP_METHOD_GET, httpReader, getHeaders(httpReader));
  httpReader.data = new Uint8Array(await response.arrayBuffer());
  httpReader.size = httpReader.data.length;
}
async function getContentLength(httpReader, sendRequest, getRequestData2) {
  if (httpReader.preventHeadRequest) {
    await getRequestData2(httpReader, httpReader.options);
  } else {
    const response = await sendRequest(HTTP_METHOD_HEAD, httpReader, getHeaders(httpReader));
    const contentLength = response.headers.get(HTTP_HEADER_CONTENT_LENGTH);
    if (contentLength && !response.headers.get(HTTP_HEADER_CONTENT_ENCODING)) {
      httpReader.size = Number(contentLength);
    } else {
      await getRequestData2(httpReader, httpReader.options);
    }
  }
}
async function sendFetchRequest(method, { fetch: fetchFunction = fetch, options, url }, headers) {
  const response = await fetchFunction(url, Object.assign({}, options, { method, headers }));
  if (response.status < 400) {
    return response;
  } else {
    throw response.status == 416 ? new Error(ERR_HTTP_RANGE) : new Error(ERR_HTTP_STATUS + (response.statusText || response.status));
  }
}
function sendXMLHttpRequest(method, { url }, headers) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.addEventListener("load", () => {
      if (request.status < 400) {
        const headers2 = [];
        request.getAllResponseHeaders().trim().split(/[\r\n]+/).forEach((header) => {
          const splitHeader = header.trim().split(/\s*:\s*/);
          splitHeader[0] = splitHeader[0].trim().replace(/^[a-z]|-[a-z]/g, (value) => value.toUpperCase());
          headers2.push(splitHeader);
        });
        resolve({
          status: request.status,
          arrayBuffer: () => request.response,
          headers: new Map(headers2)
        });
      } else {
        reject(request.status == 416 ? new Error(ERR_HTTP_RANGE) : new Error(ERR_HTTP_STATUS + (request.statusText || request.status)));
      }
    }, false);
    request.addEventListener("error", (event) => reject(event.detail ? event.detail.error : new Error("Network error")), false);
    request.open(method, url);
    if (headers) {
      for (const entry of Object.entries(headers)) {
        request.setRequestHeader(entry[0], entry[1]);
      }
    }
    request.responseType = "arraybuffer";
    request.send();
  });
}
var HttpReader = class extends Reader {
  constructor(url, options = {}) {
    super();
    Object.assign(this, {
      url,
      reader: options.useXHR && !options.fetch ? new XHRReader(url, options) : new FetchReader(url, options)
    });
  }
  set size(value) {
  }
  get size() {
    return this.reader.size;
  }
  async init() {
    await this.reader.init();
    super.init();
  }
  createReadable(options) {
    return this.reader.createReadable(options);
  }
  readUint8Array(index, length) {
    return this.reader.readUint8Array(index, length);
  }
};
var HttpRangeReader = class extends HttpReader {
  constructor(url, options = {}) {
    super(url, Object.assign({}, options, { useRangeHeader: true }));
  }
};
var Uint8ArrayReader = class extends Reader {
  constructor(array) {
    super();
    array = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    Object.assign(this, {
      array,
      size: array.length
    });
  }
  readUint8Array(index, length) {
    return this.array.slice(index, index + length);
  }
};
var Uint8ArrayWriter = class extends Writer {
  constructor(defaultBufferSize) {
    super();
    this.defaultBufferSize = defaultBufferSize || DEFAULT_BUFFER_SIZE;
  }
  init(initSize = 0) {
    Object.assign(this, {
      offset: 0,
      array: new Uint8Array(initSize > 0 ? initSize : this.defaultBufferSize)
    });
    super.init();
  }
  writeUint8Array(array) {
    const writer = this;
    const requiredLength = writer.offset + array.length;
    if (requiredLength > writer.array.length) {
      let newLength = writer.array.length ? writer.array.length * 2 : writer.defaultBufferSize;
      while (newLength < requiredLength) {
        newLength *= 2;
      }
      const previousArray = writer.array;
      writer.array = new Uint8Array(newLength);
      writer.array.set(previousArray);
    }
    writer.array.set(array, writer.offset);
    writer.offset += array.length;
  }
  getData() {
    if (this.offset === this.array.length) {
      return this.array;
    } else {
      return this.array.slice(0, this.offset);
    }
  }
};
var SplitDataReader = class extends Reader {
  constructor(readers) {
    super();
    this.readers = readers;
  }
  async init() {
    const reader = this;
    reader.lastDiskNumber = 0;
    const readers = reader.readers = await Promise.all(reader.readers.map(initDiskReader));
    reader.diskOffsets = readers.map((diskReader) => {
      const diskOffset = reader.size;
      reader.size += diskReader.size;
      return diskOffset;
    });
    super.init();
  }
  getDiskOffset(diskNumber) {
    const { diskOffsets, size } = this;
    const diskOffset = diskOffsets[diskNumber];
    return diskOffset === UNDEFINED_VALUE ? size : diskOffset;
  }
  async readUint8Array(offset, length) {
    const reader = this;
    const { readers } = this;
    let result;
    let currentDiskNumber = 0;
    let currentReaderOffset = offset;
    while (readers[currentDiskNumber] && currentReaderOffset >= readers[currentDiskNumber].size) {
      currentReaderOffset -= readers[currentDiskNumber].size;
      currentDiskNumber++;
    }
    const currentReader = readers[currentDiskNumber];
    if (currentReader) {
      const currentReaderSize = currentReader.size;
      if (currentReaderOffset + length <= currentReaderSize) {
        result = await readUint8Array(currentReader, currentReaderOffset, length);
      } else {
        const chunkLength = currentReaderSize - currentReaderOffset;
        const firstPart = await readUint8Array(currentReader, currentReaderOffset, chunkLength);
        const secondPart = await reader.readUint8Array(offset + chunkLength, length - chunkLength);
        result = concat(firstPart, secondPart);
      }
    } else {
      result = EMPTY_UINT8_ARRAY;
    }
    reader.lastDiskNumber = Math.max(currentDiskNumber, reader.lastDiskNumber);
    return result;
  }
};
var SplitDataWriter = class extends Stream {
  constructor(writerGenerator, maxSize = 4294967295) {
    super();
    const writer = this;
    Object.assign(writer, {
      diskNumber: 0,
      diskOffset: 0,
      size: 0,
      maxSize,
      availableSize: maxSize
    });
    let diskSourceWriter, diskWritable, diskWriter;
    const writable = new WritableStream({
      async write(chunk) {
        if (chunk === DISK_BOUNDARY) {
          if (diskWriter) {
            await endDisk();
          }
          return;
        }
        const { availableSize } = writer;
        if (!diskWriter) {
          const { value, done } = await writerGenerator.next();
          if (done && !value) {
            throw new Error(ERR_ITERATOR_COMPLETED_TOO_SOON);
          } else {
            diskSourceWriter = value;
            diskSourceWriter.size = 0;
            if (diskSourceWriter.maxSize) {
              writer.maxSize = diskSourceWriter.maxSize;
            }
            writer.availableSize = writer.maxSize;
            await initStream(diskSourceWriter);
            diskWritable = value.writable;
            diskWriter = diskWritable.getWriter();
          }
          await this.write(chunk);
        } else if (chunk.length >= availableSize) {
          await writeChunk(chunk.subarray(0, availableSize));
          await endDisk();
          if (chunk.length > availableSize) {
            await this.write(chunk.subarray(availableSize));
          }
        } else {
          await writeChunk(chunk);
        }
      },
      async close() {
        if (diskWriter) {
          await diskWriter.ready;
          await closeDiskWriter();
        }
      },
      async abort(reason) {
        if (diskWriter) {
          await diskWriter.abort(reason);
        }
      }
    });
    Object.defineProperty(writer, PROPERTY_NAME_WRITABLE, {
      get() {
        return writable;
      }
    });
    async function writeChunk(chunk) {
      const chunkLength = chunk.length;
      if (chunkLength) {
        await diskWriter.ready;
        await diskWriter.write(chunk);
        diskSourceWriter.size += chunkLength;
        writer.availableSize -= chunkLength;
      }
    }
    async function endDisk() {
      await closeDiskWriter();
      writer.diskOffset += diskSourceWriter.size;
      writer.diskNumber++;
      diskWriter = null;
      writer.availableSize = writer.maxSize;
    }
    async function closeDiskWriter() {
      await diskWriter.close();
    }
  }
  async closeDisk() {
    const streamWriter = this.writable.getWriter();
    try {
      await streamWriter.ready;
      await streamWriter.write(DISK_BOUNDARY);
    } finally {
      streamWriter.releaseLock();
    }
  }
};
var GenericReader = class {
  constructor(reader) {
    if (Array.isArray(reader)) {
      reader = new SplitDataReader(reader);
    }
    if (reader instanceof ReadableStream || typeof reader.getReader == FUNCTION_TYPE) {
      reader = {
        readable: toCompatibleReadable(reader)
      };
    }
    return reader;
  }
};
var GenericWriter = class {
  constructor(writer) {
    if (writer.writable === UNDEFINED_VALUE && typeof writer.next == FUNCTION_TYPE) {
      writer = new SplitDataWriter(writer);
    }
    if (writer instanceof WritableStream || typeof writer.getWriter == FUNCTION_TYPE) {
      writer = {
        writable: toCompatibleWritable(writer)
      };
    }
    if (writer.size === UNDEFINED_VALUE) {
      writer.size = 0;
    }
    return writer;
  }
};
function ownsWritable(writer) {
  return Boolean(writer && writer.getData);
}
function isHttpFamily(url) {
  const { baseURI } = getConfiguration();
  const { protocol } = new URL(url, baseURI);
  return protocol == "http:" || protocol == "https:";
}
async function initStream(stream, initSize) {
  if (stream.init && !stream.initialized) {
    await stream.init(initSize);
  } else {
    return Promise.resolve();
  }
}
async function initDiskReader(diskReader) {
  diskReader = new GenericReader(diskReader);
  await initStream(diskReader);
  if (diskReader.size === UNDEFINED_VALUE || !diskReader.readUint8Array) {
    diskReader = new BlobReader(await streamToBlob(diskReader.readable));
    await initStream(diskReader);
  }
  return diskReader;
}
function readUint8Array(reader, offset, size) {
  return reader.readUint8Array(offset, size);
}
function createReadable(reader, options) {
  if (reader.createReadable) {
    return reader.createReadable(options);
  } else if (reader.readUint8Array) {
    return Reader.prototype.createReadable.call(reader, options);
  } else {
    return reader.readable;
  }
}

// node_modules/@zip.js/zip.js/lib/core/zip-entry.js
var PROPERTY_NAME_FILENAME = "filename";
var PROPERTY_NAME_RAW_FILENAME = "rawFilename";
var PROPERTY_NAME_COMMENT = "comment";
var PROPERTY_NAME_RAW_COMMENT = "rawComment";
var PROPERTY_NAME_UNCOMPRESSED_SIZE = "uncompressedSize";
var PROPERTY_NAME_COMPRESSED_SIZE = "compressedSize";
var PROPERTY_NAME_OFFSET = "offset";
var PROPERTY_NAME_DISK_NUMBER_START = "diskNumberStart";
var PROPERTY_NAME_LAST_MODIFICATION_DATE = "lastModDate";
var PROPERTY_NAME_RAW_LAST_MODIFICATION_DATE = "rawLastModDate";
var PROPERTY_NAME_LAST_ACCESS_DATE = "lastAccessDate";
var PROPERTY_NAME_RAW_LAST_ACCESS_DATE = "rawLastAccessDate";
var PROPERTY_NAME_CREATION_DATE = "creationDate";
var PROPERTY_NAME_RAW_CREATION_DATE = "rawCreationDate";
var PROPERTY_NAME_INTERNAL_FILE_ATTRIBUTES = "internalFileAttributes";
var PROPERTY_NAME_EXTERNAL_FILE_ATTRIBUTES = "externalFileAttributes";
var PROPERTY_NAME_DEPRECATED_INTERNAL_FILE_ATTRIBUTES = "internalFileAttribute";
var PROPERTY_NAME_DEPRECATED_EXTERNAL_FILE_ATTRIBUTES = "externalFileAttribute";
var PROPERTY_NAME_MSDOS_ATTRIBUTES_RAW = "msdosAttributesRaw";
var PROPERTY_NAME_MSDOS_ATTRIBUTES = "msdosAttributes";
var PROPERTY_NAME_MS_DOS_COMPATIBLE = "msDosCompatible";
var PROPERTY_NAME_ZIP64 = "zip64";
var PROPERTY_NAME_ENCRYPTED = "encrypted";
var PROPERTY_NAME_VERSION = "version";
var PROPERTY_NAME_VERSION_MADE_BY = "versionMadeBy";
var PROPERTY_NAME_ZIPCRYPTO = "zipCrypto";
var PROPERTY_NAME_DIRECTORY = "directory";
var PROPERTY_NAME_EXECUTABLE = "executable";
var PROPERTY_NAME_SYMLINK = "symlink";
var PROPERTY_NAME_COMPRESSION_METHOD = "compressionMethod";
var PROPERTY_NAME_SIGNATURE = "signature";
var PROPERTY_NAME_CRC32 = "crc32";
var PROPERTY_NAME_EXTRA_FIELD = "extraField";
var PROPERTY_NAME_EXTRA_FIELD_INFOZIP = "extraFieldInfoZip";
var PROPERTY_NAME_EXTRA_FIELD_UNIX = "extraFieldUnix";
var PROPERTY_NAME_EXTRA_FIELD_UNIX_TYPE1 = "extraFieldUnixType1";
var PROPERTY_NAME_EXTRA_FIELD_PKWARE_UNIX = "extraFieldPkwareUnix";
var PROPERTY_NAME_UID = "uid";
var PROPERTY_NAME_GID = "gid";
var PROPERTY_NAME_UNIX_MODE = "unixMode";
var PROPERTY_NAME_SETUID = "setuid";
var PROPERTY_NAME_SETGID = "setgid";
var PROPERTY_NAME_STICKY = "sticky";
var PROPERTY_NAME_BITFLAG = "bitFlag";
var PROPERTY_NAME_RAW_BITFLAG = "rawBitFlag";
var PROPERTY_NAME_FILENAME_LENGTH = "filenameLength";
var PROPERTY_NAME_EXTRA_FIELD_LENGTH = "extraFieldLength";
var PROPERTY_NAME_UNIX_EXTERNAL_UPPER = "unixExternalUpper";
var PROPERTY_NAME_FILENAME_UTF8 = "filenameUTF8";
var PROPERTY_NAME_COMMENT_UTF8 = "commentUTF8";
var PROPERTY_NAME_RAW_EXTRA_FIELD = "rawExtraField";
var PROPERTY_NAME_EXTRA_FIELD_ZIP64 = "extraFieldZip64";
var PROPERTY_NAME_EXTRA_FIELD_UNICODE_PATH = "extraFieldUnicodePath";
var PROPERTY_NAME_EXTRA_FIELD_UNICODE_COMMENT = "extraFieldUnicodeComment";
var PROPERTY_NAME_EXTRA_FIELD_AES = "extraFieldAES";
var PROPERTY_NAME_EXTRA_FIELD_NTFS = "extraFieldNTFS";
var PROPERTY_NAME_EXTRA_FIELD_EXTENDED_TIMESTAMP = "extraFieldExtendedTimestamp";
var PROPERTY_NAME_EXTRA_FIELD_USDZ = "extraFieldUSDZ";
var PROPERTY_NAMES = [
  PROPERTY_NAME_FILENAME,
  PROPERTY_NAME_RAW_FILENAME,
  PROPERTY_NAME_UNCOMPRESSED_SIZE,
  PROPERTY_NAME_COMPRESSED_SIZE,
  PROPERTY_NAME_LAST_MODIFICATION_DATE,
  PROPERTY_NAME_RAW_LAST_MODIFICATION_DATE,
  PROPERTY_NAME_COMMENT,
  PROPERTY_NAME_RAW_COMMENT,
  PROPERTY_NAME_LAST_ACCESS_DATE,
  PROPERTY_NAME_RAW_LAST_ACCESS_DATE,
  PROPERTY_NAME_CREATION_DATE,
  PROPERTY_NAME_RAW_CREATION_DATE,
  PROPERTY_NAME_OFFSET,
  PROPERTY_NAME_DISK_NUMBER_START,
  PROPERTY_NAME_INTERNAL_FILE_ATTRIBUTES,
  PROPERTY_NAME_EXTERNAL_FILE_ATTRIBUTES,
  PROPERTY_NAME_DEPRECATED_INTERNAL_FILE_ATTRIBUTES,
  PROPERTY_NAME_DEPRECATED_EXTERNAL_FILE_ATTRIBUTES,
  PROPERTY_NAME_MSDOS_ATTRIBUTES_RAW,
  PROPERTY_NAME_MSDOS_ATTRIBUTES,
  PROPERTY_NAME_MS_DOS_COMPATIBLE,
  PROPERTY_NAME_ZIP64,
  PROPERTY_NAME_ENCRYPTED,
  PROPERTY_NAME_VERSION,
  PROPERTY_NAME_VERSION_MADE_BY,
  PROPERTY_NAME_ZIPCRYPTO,
  PROPERTY_NAME_DIRECTORY,
  PROPERTY_NAME_EXECUTABLE,
  PROPERTY_NAME_SYMLINK,
  PROPERTY_NAME_COMPRESSION_METHOD,
  PROPERTY_NAME_SIGNATURE,
  PROPERTY_NAME_CRC32,
  PROPERTY_NAME_EXTRA_FIELD,
  PROPERTY_NAME_EXTRA_FIELD_UNIX,
  PROPERTY_NAME_EXTRA_FIELD_INFOZIP,
  PROPERTY_NAME_EXTRA_FIELD_UNIX_TYPE1,
  PROPERTY_NAME_EXTRA_FIELD_PKWARE_UNIX,
  PROPERTY_NAME_UID,
  PROPERTY_NAME_GID,
  PROPERTY_NAME_UNIX_MODE,
  PROPERTY_NAME_UNIX_EXTERNAL_UPPER,
  PROPERTY_NAME_SETUID,
  PROPERTY_NAME_SETGID,
  PROPERTY_NAME_STICKY,
  PROPERTY_NAME_BITFLAG,
  PROPERTY_NAME_RAW_BITFLAG,
  PROPERTY_NAME_FILENAME_LENGTH,
  PROPERTY_NAME_EXTRA_FIELD_LENGTH,
  PROPERTY_NAME_FILENAME_UTF8,
  PROPERTY_NAME_COMMENT_UTF8,
  PROPERTY_NAME_RAW_EXTRA_FIELD,
  PROPERTY_NAME_EXTRA_FIELD_ZIP64,
  PROPERTY_NAME_EXTRA_FIELD_UNICODE_PATH,
  PROPERTY_NAME_EXTRA_FIELD_UNICODE_COMMENT,
  PROPERTY_NAME_EXTRA_FIELD_AES,
  PROPERTY_NAME_EXTRA_FIELD_NTFS,
  PROPERTY_NAME_EXTRA_FIELD_EXTENDED_TIMESTAMP,
  PROPERTY_NAME_EXTRA_FIELD_USDZ
];
var Entry = class {
  constructor(data) {
    PROPERTY_NAMES.forEach((name) => this[name] = data[name]);
  }
};

// node_modules/@zip.js/zip.js/lib/core/zip-reader.js
var ERR_BAD_FORMAT = "File format is not recognized";
var ERR_EOCDR_NOT_FOUND = "End of central directory not found";
var ERR_EOCDR_LOCATOR_ZIP64_NOT_FOUND = "End of Zip64 central directory locator not found";
var ERR_CENTRAL_DIRECTORY_NOT_FOUND = "Central directory header not found";
var ERR_LOCAL_FILE_HEADER_NOT_FOUND = "Local file header not found";
var ERR_EXTRAFIELD_ZIP64_NOT_FOUND = "Zip64 extra field not found";
var ERR_ENCRYPTED = "File contains encrypted entry";
var ERR_UNSUPPORTED_ENCRYPTION = "Encryption method not supported";
var ERR_UNSUPPORTED_COMPRESSION2 = "Compression method not supported";
var ERR_SPLIT_ZIP_FILE = "Split zip file";
var ERR_OVERLAPPING_ENTRY = "Overlapping entry found";
var ERR_ENTRY_DATA_OUT_OF_BOUNDS = "Entry data out of bounds";
var ERR_AMBIGUOUS_ARCHIVE = "Ambiguous archive";
var ERR_ENCRYPTED_CENTRAL_DIRECTORY = "Encrypted central directory is not supported";
var ERR_UNSAFE_FILENAME = "Unsafe filename";
var ERR_INVALID_STRICTNESS = "Invalid strictness (must be 'strict', 'balanced' or 'tolerant')";
var ERR_INVALID_FILENAME_VALIDATION = "Invalid filenameValidation (must be 'strict', 'balanced' or 'tolerant')";
var ERR_INVALID_MAX_APPENDED_DATA_SIZE = "Invalid maxAppendedDataSize (must be a number greater than or equal to 0)";
var ERR_UNSUPPORTED_UINT64 = "64-bit value exceeds Number.MAX_SAFE_INTEGER";
var WARNING_UNSORTED_CENTRAL_DIRECTORY = "unsorted central directory";
var WARNING_UNKNOWN_VERSION = "unknown version needed to extract";
var WARNING_COMPRESSED_PATCHED_DATA = "compressed patched data";
var WARNING_MALFORMED_EXTRA_FIELD = "malformed extra field";
var WARNING_UNKNOWN_ZIP64_EXTENSIBLE_DATA = "unknown zip64 extensible data";
var WARNING_WRAPPED_ENTRIES_COUNT = "wrapped entries count";
var WARNING_APPENDED_DATA = "appended data";
var WARNING_PREPENDED_DATA = "prepended data";
var WARNING_PREPENDED_CENTRAL_DIRECTORY = "prepended central directory";
var WARNING_TRAILING_CENTRAL_DIRECTORY_DATA = "trailing central directory data";
var WARNING_DUPLICATE_FILENAME = "duplicate filename";
var WARNING_MISMATCHED_ZIP64_END_OF_CENTRAL_DIRECTORY = "mismatched zip64 end of central directory record";
var WARNING_MISMATCHED_LOCAL_FILE_HEADER_BIT_FLAG = "mismatched local file header (general purpose bit flag)";
var WARNING_MISMATCHED_LOCAL_FILE_HEADER_COMPRESSION_METHOD = "mismatched local file header (compression method)";
var WARNING_MISMATCHED_LOCAL_FILE_HEADER_CRC32_OR_SIZES = "mismatched local file header (crc32 or sizes)";
var MAX_KNOWN_VERSION = 63;
var DRIVE_LETTER_REGEXP = /^[a-zA-Z]:/;
var CHARSET_UTF8 = "utf-8";
var PROPERTY_NAME_UTF8_SUFFIX = "UTF8";
var CHARSET_CP437 = "cp437";
var BITFLAG_AMBIGUITY_MASK = BITFLAG_ENCRYPTED | BITFLAG_DATA_DESCRIPTOR | BITFLAG_LANG_ENCODING_FLAG;
var VENDOR_VERSION_AE_1 = 1;
var ZIP64_PROPERTIES = [
  [PROPERTY_NAME_UNCOMPRESSED_SIZE, MAX_32_BITS],
  [PROPERTY_NAME_COMPRESSED_SIZE, MAX_32_BITS],
  [PROPERTY_NAME_OFFSET, MAX_32_BITS],
  [PROPERTY_NAME_DISK_NUMBER_START, MAX_16_BITS]
];
var ZIP64_EXTRACTION = {
  [MAX_16_BITS]: {
    getValue: getUint32,
    bytes: 4
  },
  [MAX_32_BITS]: {
    getValue: getBigUint64,
    bytes: 8
  }
};
var MAX_SAFE_UINT64 = BigInt(Number.MAX_SAFE_INTEGER);
var MAX_END_OF_CENTRAL_DIR_PROBES = 64;
var MAX_DEFLATE_EXPANSION_RATIO = 1032;
var CENTRAL_DIRECTORY_UNREACHABLE = 0;
var CENTRAL_DIRECTORY_PLAUSIBLE = 1;
var CENTRAL_DIRECTORY_REACHABLE = 2;
var ZipReader = class {
  constructor(reader, options = {}) {
    Object.assign(this, {
      reader: new GenericReader(reader),
      options,
      readRanges: /* @__PURE__ */ new Map()
    });
  }
  async *getEntriesGenerator(options = {}) {
    const zipReader = this;
    let { reader } = zipReader;
    await initStream(reader);
    if (reader.size === UNDEFINED_VALUE || !reader.readUint8Array) {
      reader = new BlobReader(await streamToBlob(reader.readable));
      await initStream(reader);
    }
    if (reader.size < END_OF_CENTRAL_DIR_LENGTH) {
      throw new Error(ERR_BAD_FORMAT);
    }
    const warnings = zipReader.warnings = [];
    const strictness = getStrictness(options, zipReader.options);
    const checkAmbiguity = strictness == STRICTNESS_STRICT;
    const rejectAmbiguousEndOfDirectory = strictness != STRICTNESS_TOLERANT;
    const maxAppendedDataSize = getMaxAppendedDataSize(getOptionValue(zipReader, options, OPTION_MAX_APPENDED_DATA_SIZE), strictness);
    const filenameValidation = getFilenameValidation(getOptionValue(zipReader, options, OPTION_FILENAME_VALIDATION), strictness);
    const normalizeFilename = getOptionValue(zipReader, options, OPTION_NORMALIZE_FILENAME);
    const { endOfDirectoryInfo, endOfDirectoryReachingEndCount } = await findEndOfCentralDirectory(reader, rejectAmbiguousEndOfDirectory, maxAppendedDataSize);
    if (!endOfDirectoryInfo) {
      if (await startsWithSplitZipSignature(reader)) {
        throw new Error(ERR_SPLIT_ZIP_FILE);
      } else {
        throw new Error(ERR_EOCDR_NOT_FOUND);
      }
    }
    if (rejectAmbiguousEndOfDirectory && endOfDirectoryReachingEndCount > 1) {
      throwAmbiguousArchive("multiple end of central directory records");
    }
    const endOfDirectoryView = getDataView(endOfDirectoryInfo);
    let directoryDataLength = getUint32(endOfDirectoryView, 12);
    let directoryDataOffset = getUint32(endOfDirectoryView, 16);
    const commentOffset = endOfDirectoryInfo.offset;
    const commentLength = getUint16(endOfDirectoryView, 20);
    const appendedDataOffset = commentOffset + END_OF_CENTRAL_DIR_LENGTH + commentLength;
    const appendedDataLength = reader.size - appendedDataOffset;
    if (appendedDataLength > maxAppendedDataSize) {
      throwAmbiguousArchive(WARNING_APPENDED_DATA);
    }
    if (appendedDataLength > 0) {
      addWarning(warnings, WARNING_APPENDED_DATA);
    }
    let lastDiskNumber = getUint16(endOfDirectoryView, 4);
    const expectedLastDiskNumber = reader.lastDiskNumber || 0;
    let diskNumber = getUint16(endOfDirectoryView, 6);
    let filesLength = getUint16(endOfDirectoryView, 10);
    let prependedDataLength = 0;
    let prependedCentralDirectory;
    let startOffset;
    let zip64EndOfDirectory;
    let zip64EndOfDirectoryVersion2;
    let zip64EndOfDirectoryLength = ZIP64_END_OF_CENTRAL_DIR_LENGTH;
    let directoryEncryptionInfo;
    const requiresZip64 = directoryDataOffset == MAX_32_BITS || directoryDataLength == MAX_32_BITS || filesLength == MAX_16_BITS || diskNumber == MAX_16_BITS;
    if (directoryDataOffset != MAX_32_BITS && diskNumber != MAX_16_BITS) {
      directoryDataOffset += getDiskOffset(reader, diskNumber);
    }
    if (requiresZip64) {
      const endOfDirectoryLocatorArray = endOfDirectoryInfo.offset >= ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH ? await readUint8Array(reader, endOfDirectoryInfo.offset - ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH, ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH) : EMPTY_UINT8_ARRAY;
      const endOfDirectoryLocatorView = getDataView(endOfDirectoryLocatorArray);
      if (endOfDirectoryLocatorArray.length == ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH && getUint32(endOfDirectoryLocatorView, 0) == ZIP64_END_OF_CENTRAL_DIR_LOCATOR_SIGNATURE) {
        directoryDataOffset = getDiskOffset(reader, getUint32(endOfDirectoryLocatorView, 4)) + getBigUint64(endOfDirectoryLocatorView, 8);
        let endOfDirectoryArray = await readUint8Array(reader, directoryDataOffset, ZIP64_END_OF_CENTRAL_DIR_LENGTH);
        let endOfDirectoryView2 = getDataView(endOfDirectoryArray);
        const expectedDirectoryDataOffset = endOfDirectoryInfo.offset - ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH - ZIP64_END_OF_CENTRAL_DIR_LENGTH;
        if ((endOfDirectoryArray.length < ZIP64_END_OF_CENTRAL_DIR_LENGTH || getUint32(endOfDirectoryView2, 0) != ZIP64_END_OF_CENTRAL_DIR_SIGNATURE) && directoryDataOffset != expectedDirectoryDataOffset && expectedDirectoryDataOffset >= 0) {
          const originalDirectoryDataOffset = directoryDataOffset;
          directoryDataOffset = expectedDirectoryDataOffset;
          if (directoryDataOffset > originalDirectoryDataOffset) {
            prependedDataLength = directoryDataOffset - originalDirectoryDataOffset;
          }
          endOfDirectoryArray = await readUint8Array(reader, directoryDataOffset, ZIP64_END_OF_CENTRAL_DIR_LENGTH);
          endOfDirectoryView2 = getDataView(endOfDirectoryArray);
        }
        if (endOfDirectoryArray.length < ZIP64_END_OF_CENTRAL_DIR_LENGTH || getUint32(endOfDirectoryView2, 0) != ZIP64_END_OF_CENTRAL_DIR_SIGNATURE) {
          throw new Error(ERR_EOCDR_LOCATOR_ZIP64_NOT_FOUND);
        }
        zip64EndOfDirectory = true;
        zip64EndOfDirectoryVersion2 = getBigUint64(endOfDirectoryView2, 4) > ZIP64_END_OF_CENTRAL_DIR_LENGTH - 12;
        if (zip64EndOfDirectoryVersion2) {
          const extensibleDataLength = Math.min(
            getBigUint64(endOfDirectoryView2, 4) - (ZIP64_END_OF_CENTRAL_DIR_LENGTH - 12),
            reader.size - directoryDataOffset - ZIP64_END_OF_CENTRAL_DIR_LENGTH
          );
          if (extensibleDataLength > 0) {
            zip64EndOfDirectoryLength += extensibleDataLength;
            const rawExtensibleData = await readUint8Array(reader, directoryDataOffset + ZIP64_END_OF_CENTRAL_DIR_LENGTH, extensibleDataLength);
            directoryEncryptionInfo = getDirectoryEncryptionInfo(rawExtensibleData);
          }
        }
        if (lastDiskNumber == MAX_16_BITS) {
          lastDiskNumber = getUint32(endOfDirectoryView2, 16);
        } else if (lastDiskNumber != getUint32(endOfDirectoryView2, 16)) {
          reportAmbiguity(checkAmbiguity, warnings, WARNING_MISMATCHED_ZIP64_END_OF_CENTRAL_DIRECTORY);
        }
        if (diskNumber == MAX_16_BITS) {
          diskNumber = getUint32(endOfDirectoryView2, 20);
        } else if (diskNumber != getUint32(endOfDirectoryView2, 20)) {
          reportAmbiguity(checkAmbiguity, warnings, WARNING_MISMATCHED_ZIP64_END_OF_CENTRAL_DIRECTORY);
        }
        if (filesLength == MAX_16_BITS) {
          filesLength = getBigUint64(endOfDirectoryView2, 32);
        } else if (filesLength != getBigUint64(endOfDirectoryView2, 32)) {
          reportAmbiguity(checkAmbiguity, warnings, WARNING_MISMATCHED_ZIP64_END_OF_CENTRAL_DIRECTORY);
        }
        if (directoryDataLength == MAX_32_BITS) {
          directoryDataLength = getBigUint64(endOfDirectoryView2, 40);
        } else if (directoryDataLength != getBigUint64(endOfDirectoryView2, 40)) {
          reportAmbiguity(checkAmbiguity, warnings, WARNING_MISMATCHED_ZIP64_END_OF_CENTRAL_DIRECTORY);
        }
        directoryDataOffset = getDiskOffset(reader, diskNumber) + getBigUint64(endOfDirectoryView2, 48) + prependedDataLength;
      }
    }
    let declaredDirectoryDataLength = directoryDataLength;
    const centralDirectoryEndOffset = endOfDirectoryInfo.offset - (zip64EndOfDirectory ? zip64EndOfDirectoryLength + ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH : 0);
    if (directoryDataOffset >= reader.size) {
      prependedDataLength = reader.size - directoryDataOffset - directoryDataLength - END_OF_CENTRAL_DIR_LENGTH;
      directoryDataOffset = reader.size - directoryDataLength - END_OF_CENTRAL_DIR_LENGTH;
    }
    if (expectedLastDiskNumber != lastDiskNumber) {
      throw new Error(ERR_SPLIT_ZIP_FILE);
    }
    if (directoryDataOffset < 0) {
      throw new Error(ERR_BAD_FORMAT);
    }
    let offset = 0;
    let directoryArray = await readUint8Array(reader, directoryDataOffset, directoryDataLength);
    let directoryView = getDataView(directoryArray);
    if (directoryDataLength) {
      if (directoryArray.length < 4) {
        throw new Error(ERR_BAD_FORMAT);
      }
      const expectedDirectoryDataOffset = centralDirectoryEndOffset - directoryDataLength;
      if (directoryDataOffset != expectedDirectoryDataOffset && diskNumber == lastDiskNumber) {
        const storedPointsAtDirectory = getUint32(directoryView, offset) == CENTRAL_FILE_HEADER_SIGNATURE || Boolean(directoryEncryptionInfo && directoryEncryptionInfo.compressedSize) || detectEncryptedCentralDirectory(directoryView);
        let reconcile = !storedPointsAtDirectory;
        if (!reconcile && expectedDirectoryDataOffset >= 0 && expectedDirectoryDataOffset + 4 <= reader.size) {
          const expectedSignatureArray = await readUint8Array(reader, expectedDirectoryDataOffset, 4);
          reconcile = getUint32(getDataView(expectedSignatureArray), 0) == CENTRAL_FILE_HEADER_SIGNATURE;
        }
        if (reconcile) {
          const originalDirectoryDataOffset = directoryDataOffset;
          directoryDataOffset = expectedDirectoryDataOffset;
          if (directoryDataOffset > originalDirectoryDataOffset) {
            prependedDataLength += directoryDataOffset - originalDirectoryDataOffset;
            prependedCentralDirectory = storedPointsAtDirectory;
          }
          directoryArray = await readUint8Array(reader, directoryDataOffset, directoryDataLength);
          directoryView = getDataView(directoryArray);
        }
      }
    }
    const expectedDirectoryDataLength = centralDirectoryEndOffset - directoryDataOffset;
    if (directoryDataLength != expectedDirectoryDataLength && expectedDirectoryDataLength >= 0 && diskNumber == lastDiskNumber) {
      directoryDataLength = expectedDirectoryDataLength;
      directoryArray = await readUint8Array(reader, directoryDataOffset, directoryDataLength);
      directoryView = getDataView(directoryArray);
    }
    if (directoryDataOffset < 0 || directoryDataOffset >= reader.size) {
      throw new Error(ERR_BAD_FORMAT);
    }
    zipReader.directoryOffset = directoryDataOffset;
    zipReader.directoryLength = declaredDirectoryDataLength;
    const decryptCentralDirectory = getFunctionOptionValue(zipReader, options, OPTION_DECRYPT_CENTRAL_DIRECTORY);
    let decryptedDirectory, dataAfterEncryptedDirectory;
    if (decryptCentralDirectory && filesLength && directoryArray.length >= 4 && getUint32(directoryView, 0) != CENTRAL_FILE_HEADER_SIGNATURE && (zip64EndOfDirectoryVersion2 || detectEncryptedCentralDirectory(directoryView))) {
      const encryptedDirectoryDataLength = getEncryptedDirectoryDataLength(directoryEncryptionInfo, declaredDirectoryDataLength, directoryArray.length);
      dataAfterEncryptedDirectory = directoryArray.subarray(encryptedDirectoryDataLength);
      directoryArray = await decryptCentralDirectory(directoryArray.subarray(0, encryptedDirectoryDataLength), directoryEncryptionInfo);
      directoryView = getDataView(directoryArray);
      declaredDirectoryDataLength = directoryArray.length;
      decryptedDirectory = true;
    }
    if (directoryEncryptionInfo && !decryptedDirectory && (directoryArray.length < 4 || getUint32(directoryView, 0) == CENTRAL_FILE_HEADER_SIGNATURE)) {
      addWarning(warnings, WARNING_UNKNOWN_ZIP64_EXTENSIBLE_DATA);
    }
    startOffset = directoryDataOffset;
    const filenameEncoding = getOptionValue(zipReader, options, OPTION_FILENAME_ENCODING);
    const commentEncoding = getOptionValue(zipReader, options, OPTION_COMMENT_ENCODING);
    const filenames = /* @__PURE__ */ new Set();
    let duplicateFilename;
    let previousEntryPosition = -1;
    const recoverWrappedFilesLength = !checkAmbiguity && !zip64EndOfDirectory;
    if (!filesLength && recoverWrappedFilesLength) {
      filesLength = getWrappedFilesLength(directoryView, directoryArray, offset);
      if (filesLength) {
        addWarning(warnings, WARNING_WRAPPED_ENTRIES_COUNT);
      }
    }
    for (let indexFile = 0; indexFile < filesLength; indexFile++) {
      const fileEntry = new ZipEntry(reader, zipReader.options);
      if (offset + CENTRAL_FILE_HEADER_LENGTH > directoryArray.length || getUint32(directoryView, offset) != CENTRAL_FILE_HEADER_SIGNATURE) {
        if (indexFile == 0 && !decryptedDirectory && (zip64EndOfDirectoryVersion2 || detectEncryptedCentralDirectory(directoryView))) {
          throw new Error(ERR_ENCRYPTED_CENTRAL_DIRECTORY);
        }
        throw new Error(ERR_CENTRAL_DIRECTORY_NOT_FOUND);
      }
      readCommonHeader(fileEntry, directoryView, offset + 6);
      const languageEncodingFlag = Boolean(fileEntry.bitFlag.languageEncodingFlag);
      const filenameOffset = offset + CENTRAL_FILE_HEADER_LENGTH;
      const extraFieldOffset = filenameOffset + fileEntry.filenameLength;
      const commentOffset2 = extraFieldOffset + fileEntry.extraFieldLength;
      const versionMadeBy = getUint16(directoryView, offset + 4);
      const msDosCompatible = versionMadeBy >> 8 == 0;
      const unixCompatible = versionMadeBy >> 8 == 3;
      const rawFilename = directoryArray.subarray(filenameOffset, extraFieldOffset);
      const commentLength2 = getUint16(directoryView, offset + 32);
      const endOffset = commentOffset2 + commentLength2;
      const rawComment = directoryArray.subarray(commentOffset2, endOffset);
      const filenameUTF8 = languageEncodingFlag;
      const commentUTF8 = languageEncodingFlag;
      const externalFileAttributes = getUint32(directoryView, offset + 38);
      const msdosAttributesRaw = externalFileAttributes & MAX_8_BITS;
      const msdosAttributes = {
        readOnly: Boolean(msdosAttributesRaw & FILE_ATTR_MSDOS_READONLY_MASK),
        hidden: Boolean(msdosAttributesRaw & FILE_ATTR_MSDOS_HIDDEN_MASK),
        system: Boolean(msdosAttributesRaw & FILE_ATTR_MSDOS_SYSTEM_MASK),
        directory: Boolean(msdosAttributesRaw & FILE_ATTR_MSDOS_DIR_MASK),
        archive: Boolean(msdosAttributesRaw & FILE_ATTR_MSDOS_ARCHIVE_MASK)
      };
      const offsetFileEntry = getUint32(directoryView, offset + 42);
      const decode2 = getFunctionOptionValue(zipReader, options, OPTION_DECODE_TEXT) || decodeText;
      const rawFilenameEncoding = filenameUTF8 ? CHARSET_UTF8 : filenameEncoding || CHARSET_CP437;
      const rawCommentEncoding = commentUTF8 ? CHARSET_UTF8 : commentEncoding || CHARSET_CP437;
      let filename = decode2(rawFilename, rawFilenameEncoding, TEXT_TYPE_FILENAME);
      if (filename === UNDEFINED_VALUE) {
        filename = decodeText(rawFilename, rawFilenameEncoding);
      }
      if (normalizeFilename) {
        const normalizedFilename = normalizeFilename(filename);
        if (normalizedFilename !== UNDEFINED_VALUE) {
          filename = normalizedFilename;
        }
      }
      if (isUnsafeFilename(filename, filenameValidation)) {
        const error = new Error(ERR_UNSAFE_FILENAME);
        error.filename = filename;
        throw error;
      }
      let comment = decode2(rawComment, rawCommentEncoding, TEXT_TYPE_COMMENT);
      if (comment === UNDEFINED_VALUE) {
        comment = decodeText(rawComment, rawCommentEncoding);
      }
      Object.assign(fileEntry, {
        index: indexFile,
        decryptedDirectory,
        versionMadeBy,
        msDosCompatible,
        zip64: false,
        compressedSize: 0,
        uncompressedSize: 0,
        commentLength: commentLength2,
        offset: offsetFileEntry,
        diskNumberStart: getUint16(directoryView, offset + 34),
        internalFileAttributes: getUint16(directoryView, offset + 36),
        externalFileAttributes,
        msdosAttributesRaw,
        msdosAttributes,
        rawFilename,
        filenameUTF8,
        commentUTF8,
        rawExtraField: directoryArray.subarray(extraFieldOffset, commentOffset2),
        rawComment,
        filename,
        comment
      });
      if (readCommonFooter(fileEntry, fileEntry, directoryView, offset + 6)) {
        addWarning(warnings, WARNING_MALFORMED_EXTRA_FIELD, filename);
      }
      fileEntry.offset += prependedDataLength;
      const entryPosition = getDiskOffset(reader, fileEntry.diskNumberStart) + fileEntry.offset;
      startOffset = Math.min(entryPosition, startOffset);
      if (entryPosition < previousEntryPosition) {
        addWarning(warnings, WARNING_UNSORTED_CENTRAL_DIRECTORY, filename);
      }
      previousEntryPosition = entryPosition;
      if ((fileEntry.version & MAX_8_BITS) > MAX_KNOWN_VERSION) {
        addWarning(warnings, WARNING_UNKNOWN_VERSION, filename);
      }
      if ((fileEntry.rawBitFlag & BITFLAG_COMPRESSED_PATCHED_DATA) == BITFLAG_COMPRESSED_PATCHED_DATA) {
        addWarning(warnings, WARNING_COMPRESSED_PATCHED_DATA, filename);
      }
      if (filenames.has(fileEntry.filename)) {
        duplicateFilename = true;
      }
      filenames.add(fileEntry.filename);
      const unixExternalUpper = fileEntry.externalFileAttributes >> 16 & MAX_16_BITS;
      if (fileEntry.unixMode === UNDEFINED_VALUE && (unixExternalUpper & (FILE_ATTR_UNIX_DEFAULT_MASK | FILE_ATTR_UNIX_EXECUTABLE_MASK | FILE_ATTR_UNIX_TYPE_DIR)) != 0) {
        fileEntry.unixMode = unixExternalUpper;
      }
      const setuid = Boolean(fileEntry.unixMode & FILE_ATTR_UNIX_SETUID_MASK);
      const setgid = Boolean(fileEntry.unixMode & FILE_ATTR_UNIX_SETGID_MASK);
      const sticky = Boolean(fileEntry.unixMode & FILE_ATTR_UNIX_STICKY_MASK);
      const unixType = fileEntry.unixMode === UNDEFINED_VALUE ? unixExternalUpper : fileEntry.unixMode;
      const symlink = (unixType & FILE_ATTR_UNIX_TYPE_MASK) == FILE_ATTR_UNIX_TYPE_SYMLINK;
      const executable = !symlink && (fileEntry.unixMode !== UNDEFINED_VALUE ? (fileEntry.unixMode & FILE_ATTR_UNIX_EXECUTABLE_MASK) != 0 : unixCompatible && (unixExternalUpper & FILE_ATTR_UNIX_EXECUTABLE_MASK) != 0);
      const modeIsDir = fileEntry.unixMode !== UNDEFINED_VALUE && (fileEntry.unixMode & FILE_ATTR_UNIX_TYPE_MASK) == FILE_ATTR_UNIX_TYPE_DIR;
      const upperIsDir = (unixExternalUpper & FILE_ATTR_UNIX_TYPE_MASK) == FILE_ATTR_UNIX_TYPE_DIR;
      Object.assign(fileEntry, {
        setuid,
        setgid,
        sticky,
        symlink,
        unixExternalUpper,
        internalFileAttribute: fileEntry.internalFileAttributes,
        externalFileAttribute: fileEntry.externalFileAttributes,
        executable,
        directory: modeIsDir || upperIsDir || msDosCompatible && msdosAttributes.directory || fileEntry.filename.endsWith(DIRECTORY_SIGNATURE),
        zipCrypto: fileEntry.encrypted && !fileEntry.extraFieldAES
      });
      const entry = new Entry(fileEntry);
      entry.getData = (writer, options2) => fileEntry.getData(writer, entry, zipReader.readRanges, options2);
      entry.arrayBuffer = async (options2) => {
        const writer = new TransformStream();
        const arrayBufferPromise = streamToBlob(writer.readable).then((blob) => blob.arrayBuffer());
        arrayBufferPromise.catch(() => {
        });
        await fileEntry.getData(writer, entry, zipReader.readRanges, options2);
        return arrayBufferPromise;
      };
      offset = endOffset;
      if (indexFile == filesLength - 1 && recoverWrappedFilesLength) {
        const wrappedFilesLength = getWrappedFilesLength(directoryView, directoryArray, offset);
        if (wrappedFilesLength) {
          filesLength += wrappedFilesLength;
          addWarning(warnings, WARNING_WRAPPED_ENTRIES_COUNT);
        }
      }
      const { onprogress } = options;
      if (onprogress) {
        try {
          await onprogress(indexFile + 1, filesLength, new Entry(fileEntry));
        } catch {
        }
      }
      yield entry;
    }
    let offsetAfterSignature = offset;
    let digitalSignature = readDigitalSignature(directoryArray.subarray(offset)) || (decryptedDirectory ? readDigitalSignature(dataAfterEncryptedDirectory) : UNDEFINED_VALUE);
    if (!digitalSignature && !decryptedDirectory) {
      const signatureRecordOffset = directoryDataOffset + offset;
      const signatureRecordLength = Math.min(centralDirectoryEndOffset - signatureRecordOffset, 6 + MAX_16_BITS);
      if (signatureRecordLength >= 6) {
        digitalSignature = readDigitalSignature(await readUint8Array(reader, signatureRecordOffset, signatureRecordLength));
      }
    }
    if (digitalSignature) {
      zipReader.digitalSignature = digitalSignature;
      offsetAfterSignature = offset + 6 + digitalSignature.length;
    }
    if (offset != declaredDirectoryDataLength && offsetAfterSignature != declaredDirectoryDataLength || !decryptedDirectory && offset != directoryDataLength && offsetAfterSignature != directoryDataLength) {
      reportAmbiguity(checkAmbiguity, warnings, WARNING_TRAILING_CENTRAL_DIRECTORY_DATA);
    }
    if (duplicateFilename) {
      reportAmbiguity(checkAmbiguity, warnings, WARNING_DUPLICATE_FILENAME);
    }
    const extractPrependedData = getOptionValue(zipReader, options, OPTION_EXTRACT_PREPENDED_DATA);
    const extractAppendedData = getOptionValue(zipReader, options, OPTION_EXTRACT_APPENDED_DATA);
    const splitZipSignatureLength = (checkAmbiguity || extractPrependedData) && filesLength && startOffset == SPLIT_ZIP_FILE_SIGNATURE_LENGTH && await startsWithSplitZipMarker(reader) ? SPLIT_ZIP_FILE_SIGNATURE_LENGTH : 0;
    if (checkAmbiguity && (prependedDataLength || filesLength && startOffset > splitZipSignatureLength)) {
      throwAmbiguousArchive(WARNING_PREPENDED_DATA);
    }
    if (prependedDataLength || filesLength && startOffset > SPLIT_ZIP_FILE_SIGNATURE_LENGTH) {
      addWarning(warnings, WARNING_PREPENDED_DATA);
    }
    if (prependedCentralDirectory) {
      addWarning(warnings, WARNING_PREPENDED_CENTRAL_DIRECTORY);
    }
    if (extractPrependedData) {
      zipReader.prependedData = startOffset > splitZipSignatureLength ? await readUint8Array(reader, splitZipSignatureLength, startOffset - splitZipSignatureLength) : EMPTY_UINT8_ARRAY;
    }
    zipReader.comment = commentLength ? await readUint8Array(reader, commentOffset + END_OF_CENTRAL_DIR_LENGTH, commentLength) : EMPTY_UINT8_ARRAY;
    if (extractAppendedData) {
      zipReader.appendedData = appendedDataOffset < reader.size ? await readUint8Array(reader, appendedDataOffset, reader.size - appendedDataOffset) : EMPTY_UINT8_ARRAY;
    }
    return true;
  }
  async getEntries(options = {}) {
    const entries = [];
    for await (const entry of this.getEntriesGenerator(options)) {
      entries.push(entry);
    }
    return entries;
  }
  async close() {
    const { reader } = this;
    if (!reader.readUint8Array && reader.readable && !reader.readable.locked) {
      await reader.readable.cancel();
    }
  }
};
var ZipReaderStream = class {
  constructor(options = {}) {
    const { readable, writable } = new TransformStream();
    const gen = new ZipReader(readable, options).getEntriesGenerator();
    this.readable = new ReadableStream({
      async pull(controller) {
        const { done, value } = await gen.next();
        if (done)
          return controller.close();
        const chunk = {
          ...value,
          readable: (function() {
            const { readable: readable2, writable: writable2 } = new TransformStream();
            if (value.getData) {
              getData();
              return readable2;
            }
            async function getData() {
              try {
                await value.getData(writable2);
              } catch (error) {
                try {
                  await writable2.abort(error);
                } catch {
                }
              }
            }
          })()
        };
        delete chunk.getData;
        controller.enqueue(chunk);
      }
    });
    this.writable = writable;
  }
};
async function isZipFile(reader, options = {}) {
  reader = new GenericReader(reader);
  await initStream(reader);
  if (reader.size === UNDEFINED_VALUE || !reader.readUint8Array) {
    reader = new BlobReader(await streamToBlob(reader.readable));
    await initStream(reader);
  }
  if (reader.size < END_OF_CENTRAL_DIR_LENGTH) {
    return false;
  }
  const strictness = getStrictness(options, {});
  const rejectAmbiguousEndOfDirectory = strictness != STRICTNESS_TOLERANT;
  const maxAppendedDataSize = getMaxAppendedDataSize(options[OPTION_MAX_APPENDED_DATA_SIZE], strictness);
  const { endOfDirectoryInfo, endOfDirectoryReachingEndCount } = await findEndOfCentralDirectory(reader, rejectAmbiguousEndOfDirectory, maxAppendedDataSize);
  if (!endOfDirectoryInfo || strictness == STRICTNESS_STRICT && endOfDirectoryReachingEndCount > 1) {
    return false;
  }
  const commentLength = getUint16(getDataView(endOfDirectoryInfo), 20);
  const appendedDataOffset = endOfDirectoryInfo.offset + END_OF_CENTRAL_DIR_LENGTH + commentLength;
  return reader.size - appendedDataOffset <= maxAppendedDataSize;
}
var ZipEntry = class {
  constructor(reader, options) {
    Object.assign(this, {
      reader,
      options
    });
  }
  async getData(writer, fileEntry, readRanges, options = {}) {
    const zipEntry = this;
    const config2 = getConfiguration();
    const {
      reader,
      index,
      offset,
      diskNumberStart,
      extraFieldAES,
      extraFieldZip64,
      compressionMethod,
      bitFlag,
      rawBitFlag,
      crc32,
      rawLastModDate,
      uncompressedSize,
      compressedSize
    } = zipEntry;
    const {
      dataDescriptor
    } = bitFlag;
    const localDirectory = fileEntry.localDirectory = {};
    const warnings = fileEntry.warnings = [];
    const localHeaderOffset = getDiskOffset(reader, diskNumberStart) + offset;
    const dataArray = await readUint8Array(reader, localHeaderOffset, HEADER_SIZE);
    const dataView = getDataView(dataArray);
    let password = getOptionValue(zipEntry, options, OPTION_PASSWORD);
    let rawPassword = getOptionValue(zipEntry, options, OPTION_RAW_PASSWORD);
    const passThrough = getOptionValue(zipEntry, options, OPTION_PASS_THROUGH);
    checkPasswordOption(password, rawPassword);
    password = password && password.length && password;
    rawPassword = rawPassword && rawPassword.length && rawPassword;
    if (extraFieldAES) {
      if (extraFieldAES.originalCompressionMethod != COMPRESSION_METHOD_AES) {
        throw new Error(ERR_UNSUPPORTED_COMPRESSION2);
      }
    }
    if (dataArray.length < HEADER_SIZE || getUint32(dataView, 0) != LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error(ERR_LOCAL_FILE_HEADER_NOT_FOUND);
    }
    readCommonHeader(localDirectory, dataView, 4);
    const {
      extraFieldLength,
      filenameLength
    } = localDirectory;
    const dataOffset = localDirectory.dataOffset = localHeaderOffset + HEADER_SIZE + filenameLength + extraFieldLength;
    const checkLocalDirectoryOption = getOptionValue(zipEntry, options, OPTION_CHECK_LOCAL_DIRECTORY);
    const entryStrictness = getStrictness(options, zipEntry.options);
    const checkLocalDirectory = getCheckLocalDirectory(checkLocalDirectoryOption, entryStrictness);
    const checkLocalFilename = getCheckLocalFilename(checkLocalDirectoryOption, entryStrictness);
    let rawLocalFilename = EMPTY_UINT8_ARRAY;
    if (checkLocalFilename && (filenameLength || extraFieldLength)) {
      const trailingDataArray = await readUint8Array(reader, localHeaderOffset + HEADER_SIZE, filenameLength + extraFieldLength);
      rawLocalFilename = trailingDataArray.subarray(0, filenameLength);
      localDirectory.rawExtraField = trailingDataArray.subarray(filenameLength);
    } else {
      localDirectory.rawExtraField = extraFieldLength ? await readUint8Array(reader, localHeaderOffset + HEADER_SIZE + filenameLength, extraFieldLength) : EMPTY_UINT8_ARRAY;
    }
    if (checkLocalFilename) {
      localDirectory.rawFilename = rawLocalFilename;
    }
    if (readCommonFooter(zipEntry, localDirectory, dataView, 4, true)) {
      addWarning(warnings, WARNING_MALFORMED_EXTRA_FIELD);
    }
    validateLocalDirectory(zipEntry, localDirectory, rawLocalFilename, checkLocalFilename, checkLocalDirectory ? UNDEFINED_VALUE : warnings);
    const { lastAccessDate, creationDate, uid, gid } = localDirectory;
    if (lastAccessDate) {
      fileEntry.lastAccessDate = lastAccessDate;
    }
    if (creationDate) {
      fileEntry.creationDate = creationDate;
    }
    if (uid !== UNDEFINED_VALUE && fileEntry.uid === UNDEFINED_VALUE) {
      fileEntry.uid = uid;
    }
    if (gid !== UNDEFINED_VALUE && fileEntry.gid === UNDEFINED_VALUE) {
      fileEntry.gid = gid;
    }
    const encrypted = zipEntry.encrypted && localDirectory.encrypted && !passThrough;
    const zipCrypto = encrypted && !extraFieldAES;
    if (!passThrough) {
      fileEntry.zipCrypto = zipCrypto;
    }
    if (encrypted && (localDirectory.rawBitFlag & BITFLAG_STRONG_ENCRYPTION) == BITFLAG_STRONG_ENCRYPTION) {
      throw new Error(ERR_UNSUPPORTED_ENCRYPTION);
    }
    const registeredCodec = passThrough ? UNDEFINED_VALUE : getRegisteredCodec(compressionMethod);
    if (compressionMethod != COMPRESSION_METHOD_STORE && compressionMethod != COMPRESSION_METHOD_DEFLATE && compressionMethod != COMPRESSION_METHOD_DEFLATE_64 && !registeredCodec && !passThrough) {
      throw new Error(ERR_UNSUPPORTED_COMPRESSION2);
    }
    if (encrypted) {
      if (!zipCrypto && (extraFieldAES.strength < 1 || extraFieldAES.strength > 3)) {
        throw new Error(ERR_UNSUPPORTED_ENCRYPTION);
      } else if (!password && !rawPassword) {
        throw new Error(ERR_ENCRYPTED);
      }
    }
    if (dataOffset + compressedSize > reader.size) {
      throw new Error(ERR_ENTRY_DATA_OUT_OF_BOUNDS);
    }
    const size = compressedSize;
    const readable = toCompatibleReadable(reader.createReadable({ offset: dataOffset, size }));
    const signal = checkSignalOption(getOptionValue(zipEntry, options, OPTION_SIGNAL));
    const checkPasswordOnly = getOptionValue(zipEntry, options, OPTION_CHECK_PASSWORD_ONLY);
    let checkOverlappingEntry = getOptionValue(zipEntry, options, OPTION_CHECK_OVERLAPPING_ENTRY);
    const checkOverlappingEntryOnly = getOptionValue(zipEntry, options, OPTION_CHECK_OVERLAPPING_ENTRY_ONLY);
    if (checkOverlappingEntryOnly) {
      checkOverlappingEntry = true;
    }
    const { onstart, onprogress, onend } = options;
    const compressed = compressionMethod != COMPRESSION_METHOD_STORE && !passThrough;
    const outputSize = passThrough ? compressedSize : uncompressedSize;
    const deflate64 = compressionMethod == COMPRESSION_METHOD_DEFLATE_64;
    let useCompressionStream = getOptionValue(zipEntry, options, OPTION_USE_COMPRESSION_STREAM);
    if (deflate64) {
      useCompressionStream = false;
    }
    const checkCrc32Option = getOptionValue(zipEntry, options, OPTION_CHECK_CRC32);
    const checkCrc32 = (checkCrc32Option === UNDEFINED_VALUE ? getOptionValue(zipEntry, options, OPTION_CHECK_SIGNATURE) : checkCrc32Option) && !passThrough && (!encrypted || zipCrypto || extraFieldAES && extraFieldAES.vendorVersion == VENDOR_VERSION_AE_1);
    const workerOptions = {
      options: {
        codecType: CODEC_INFLATE,
        password,
        rawPassword,
        zipCrypto,
        encryptionStrength: extraFieldAES && extraFieldAES.strength,
        checkCrc32,
        checkAuthenticationCode: getOptionValue(zipEntry, options, OPTION_CHECK_AUTHENTICATION_CODE),
        passwordVerification: zipCrypto && (dataDescriptor ? rawLastModDate >>> 8 & MAX_8_BITS : crc32 >>> 24 & MAX_8_BITS),
        outputSize,
        crc32,
        compressed,
        encrypted,
        useWebWorkers: getOptionValue(zipEntry, options, OPTION_USE_WEB_WORKERS),
        useCompressionStream,
        transferStreams: getOptionValue(zipEntry, options, OPTION_TRANSFER_STREAMS),
        deflate64,
        format: registeredCodec ? registeredCodec.format : UNDEFINED_VALUE,
        codecURI: registeredCodec ? registeredCodec.codecURI : UNDEFINED_VALUE,
        compressionMethod,
        rawBitFlag,
        checkPasswordOnly
      },
      config: config2,
      streamOptions: { signal, size, onstart, onprogress, onend }
    };
    if (checkOverlappingEntry) {
      await detectOverlappingEntry({
        reader,
        fileEntry,
        index,
        offset: localHeaderOffset,
        crc32,
        compressedSize,
        uncompressedSize,
        dataOffset,
        dataDescriptor: dataDescriptor || localDirectory.bitFlag.dataDescriptor,
        extraFieldZip64: extraFieldZip64 || localDirectory.extraFieldZip64,
        readRanges
      });
    }
    let writable, abortError;
    try {
      if (!checkOverlappingEntryOnly) {
        if (checkPasswordOnly) {
          writer = new WritableStream();
        }
        writer = new GenericWriter(writer);
        await initStream(writer, getDecodableOutputSize(outputSize, compressedSize, compressed));
        ({ writable } = writer);
        const { outputSize: writtenSize } = await runWorker2({ readable, writable }, workerOptions);
        writer.size += writtenSize;
        if (writtenSize != outputSize) {
          throw new Error(ERR_INVALID_UNCOMPRESSED_SIZE);
        }
      }
    } catch (error) {
      if (error.outputSize !== UNDEFINED_VALUE) {
        writer.size += error.outputSize;
      }
      if (!checkPasswordOnly || error.message != ERR_ABORT_CHECK_PASSWORD) {
        abortError = error;
        throw error;
      }
    } finally {
      const preventClose = !ownsWritable(writer) && getOptionValue(zipEntry, options, OPTION_PREVENT_CLOSE);
      if (!preventClose && writable && !writable.locked) {
        const writableWriter = writable.getWriter();
        if (abortError) {
          try {
            await writableWriter.abort(abortError);
          } catch {
          }
        } else {
          await writableWriter.close();
        }
      }
    }
    return checkPasswordOnly || checkOverlappingEntryOnly ? UNDEFINED_VALUE : writer.getData ? writer.getData() : writable;
  }
};
function detectEncryptedCentralDirectory(directoryView) {
  const maxOffset = Math.min(directoryView.byteLength, 1024) - 3;
  for (let offset = 0; offset < maxOffset; offset++) {
    if (getUint32(directoryView, offset) == ARCHIVE_EXTRA_DATA_SIGNATURE) {
      return true;
    }
  }
  return false;
}
function getWrappedFilesLength(directoryView, directoryArray, offset) {
  let wrappedFilesLength = 0;
  while (offset + CENTRAL_FILE_HEADER_LENGTH <= directoryArray.length && getUint32(directoryView, offset) == CENTRAL_FILE_HEADER_SIGNATURE) {
    offset += CENTRAL_FILE_HEADER_LENGTH + getUint16(directoryView, offset + 28) + getUint16(directoryView, offset + 30) + getUint16(directoryView, offset + 32);
    wrappedFilesLength++;
  }
  return wrappedFilesLength % (MAX_16_BITS + 1) ? 0 : wrappedFilesLength;
}
function readDigitalSignature(signatureRecordArray) {
  if (signatureRecordArray.length >= 6) {
    const signatureRecordView = getDataView(signatureRecordArray);
    if (getUint32(signatureRecordView, 0) == DIGITAL_SIGNATURE_RECORD_SIGNATURE) {
      const signatureDataLength = getUint16(signatureRecordView, 4);
      if (6 + signatureDataLength <= signatureRecordArray.length) {
        return signatureRecordArray.subarray(6, 6 + signatureDataLength);
      }
    }
  }
}
function getEncryptedDirectoryDataLength(directoryEncryptionInfo, declaredDirectoryDataLength, directoryDataLength) {
  const encryptedDirectoryDataLength = directoryEncryptionInfo && directoryEncryptionInfo.compressedSize ? directoryEncryptionInfo.compressedSize : declaredDirectoryDataLength;
  return encryptedDirectoryDataLength > 0 && encryptedDirectoryDataLength <= directoryDataLength ? encryptedDirectoryDataLength : directoryDataLength;
}
function getDirectoryEncryptionInfo(rawExtensibleData) {
  const directoryEncryptionInfo = { rawExtensibleData };
  if (rawExtensibleData.length >= 28) {
    const extensibleDataView = getDataView(rawExtensibleData);
    const hashDataLength = getUint16(extensibleDataView, 26);
    Object.assign(directoryEncryptionInfo, {
      compressionMethod: getUint16(extensibleDataView, 0),
      compressedSize: getBigUint64(extensibleDataView, 2),
      uncompressedSize: getBigUint64(extensibleDataView, 10),
      encryptionAlgorithm: getUint16(extensibleDataView, 18),
      bitLength: getUint16(extensibleDataView, 20),
      flags: getUint16(extensibleDataView, 22),
      hashAlgorithm: getUint16(extensibleDataView, 24),
      hashData: rawExtensibleData.subarray(28, 28 + hashDataLength)
    });
  }
  return directoryEncryptionInfo;
}
function readCommonHeader(directory, dataView, offset) {
  const rawBitFlag = directory.rawBitFlag = getUint16(dataView, offset + 2);
  const encrypted = (rawBitFlag & BITFLAG_ENCRYPTED) == BITFLAG_ENCRYPTED;
  const rawLastModDate = getUint32(dataView, offset + 6);
  Object.assign(directory, {
    encrypted,
    version: getUint16(dataView, offset),
    bitFlag: {
      level: (rawBitFlag & BITFLAG_LEVEL) >> 1,
      dataDescriptor: (rawBitFlag & BITFLAG_DATA_DESCRIPTOR) == BITFLAG_DATA_DESCRIPTOR,
      languageEncodingFlag: (rawBitFlag & BITFLAG_LANG_ENCODING_FLAG) == BITFLAG_LANG_ENCODING_FLAG
    },
    rawLastModDate,
    lastModDate: getDate(rawLastModDate),
    filenameLength: getUint16(dataView, offset + 22),
    extraFieldLength: getUint16(dataView, offset + 24)
  });
}
function readCommonFooter(fileEntry, directory, dataView, offset, localDirectory) {
  const { rawExtraField } = directory;
  const extraField = directory.extraField = /* @__PURE__ */ new Map();
  const rawExtraFieldView = getDataView(rawExtraField);
  let offsetExtraField = 0;
  let malformedExtraField = false;
  try {
    while (offsetExtraField < rawExtraField.length) {
      const type = getUint16(rawExtraFieldView, offsetExtraField);
      const size = getUint16(rawExtraFieldView, offsetExtraField + 2);
      extraField.set(type, {
        type,
        data: rawExtraField.slice(offsetExtraField + 4, offsetExtraField + 4 + size)
      });
      offsetExtraField += 4 + size;
    }
  } catch {
    malformedExtraField = true;
  }
  if (offsetExtraField > rawExtraField.length) {
    malformedExtraField = true;
  }
  const compressionMethod = getUint16(dataView, offset + 4);
  Object.assign(directory, {
    signature: getUint32(dataView, offset + HEADER_OFFSET_SIGNATURE),
    crc32: getUint32(dataView, offset + HEADER_OFFSET_SIGNATURE),
    compressedSize: getUint32(dataView, offset + HEADER_OFFSET_COMPRESSED_SIZE),
    uncompressedSize: getUint32(dataView, offset + HEADER_OFFSET_UNCOMPRESSED_SIZE)
  });
  const extraFieldZip64 = extraField.get(EXTRAFIELD_TYPE_ZIP64);
  if (extraFieldZip64) {
    readExtraFieldZip64(extraFieldZip64, directory);
    directory.extraFieldZip64 = extraFieldZip64;
  }
  const extraFieldUnicodePath = extraField.get(EXTRAFIELD_TYPE_UNICODE_PATH);
  if (extraFieldUnicodePath) {
    readExtraFieldUnicode(extraFieldUnicodePath, PROPERTY_NAME_FILENAME, PROPERTY_NAME_RAW_FILENAME, directory, fileEntry);
    directory.extraFieldUnicodePath = extraFieldUnicodePath;
  }
  const extraFieldUnicodeComment = extraField.get(EXTRAFIELD_TYPE_UNICODE_COMMENT);
  if (extraFieldUnicodeComment) {
    readExtraFieldUnicode(extraFieldUnicodeComment, PROPERTY_NAME_COMMENT, PROPERTY_NAME_RAW_COMMENT, directory, fileEntry);
    directory.extraFieldUnicodeComment = extraFieldUnicodeComment;
  }
  const extraFieldAES = extraField.get(EXTRAFIELD_TYPE_AES);
  if (extraFieldAES && extraFieldAES.data.length >= 7) {
    readExtraFieldAES(extraFieldAES, directory, compressionMethod);
    directory.extraFieldAES = extraFieldAES;
  } else {
    directory.compressionMethod = compressionMethod;
  }
  const extraFieldPkwareUnix = extraField.get(EXTRAFIELD_TYPE_PKWARE_UNIX);
  if (extraFieldPkwareUnix) {
    readExtraFieldUnixDates(extraFieldPkwareUnix, directory);
    directory.extraFieldPkwareUnix = extraFieldPkwareUnix;
  }
  const extraFieldUnixType1 = extraField.get(EXTRAFIELD_TYPE_UNIX_TYPE1);
  if (extraFieldUnixType1) {
    readExtraFieldUnixDates(extraFieldUnixType1, directory);
    directory.extraFieldUnixType1 = extraFieldUnixType1;
  }
  const extraFieldNTFS = extraField.get(EXTRAFIELD_TYPE_NTFS);
  if (extraFieldNTFS) {
    readExtraFieldNTFS(extraFieldNTFS, directory);
    directory.extraFieldNTFS = extraFieldNTFS;
  }
  const extraFieldUnix = extraField.get(EXTRAFIELD_TYPE_UNIX);
  let unixIdsRead;
  if (extraFieldUnix) {
    unixIdsRead = readExtraFieldUnix(extraFieldUnix, directory, false);
    directory.extraFieldUnix = extraFieldUnix;
  }
  if (!unixIdsRead) {
    const extraFieldInfoZip = extraField.get(EXTRAFIELD_TYPE_INFOZIP);
    if (extraFieldInfoZip) {
      readExtraFieldUnix(extraFieldInfoZip, directory, true);
      directory.extraFieldInfoZip = extraFieldInfoZip;
    }
  }
  const extraFieldExtendedTimestamp = extraField.get(EXTRAFIELD_TYPE_EXTENDED_TIMESTAMP);
  if (extraFieldExtendedTimestamp) {
    readExtraFieldExtendedTimestamp(extraFieldExtendedTimestamp, directory, localDirectory);
    directory.extraFieldExtendedTimestamp = extraFieldExtendedTimestamp;
  }
  const extraFieldUSDZ = extraField.get(EXTRAFIELD_TYPE_USDZ);
  if (extraFieldUSDZ) {
    directory.extraFieldUSDZ = extraFieldUSDZ;
  }
  return malformedExtraField;
}
function readExtraFieldZip64(extraFieldZip64, directory) {
  directory.zip64 = true;
  const extraFieldView = getDataView(extraFieldZip64.data);
  const missingProperties = ZIP64_PROPERTIES.filter(([propertyName, max]) => directory[propertyName] == max);
  const requiredLength = missingProperties.reduce((length, [, max]) => length + ZIP64_EXTRACTION[max].bytes, 0);
  if (extraFieldZip64.data.length < requiredLength) {
    throw new Error(ERR_EXTRAFIELD_ZIP64_NOT_FOUND);
  }
  for (let indexMissingProperty = 0, offset = 0; indexMissingProperty < missingProperties.length; indexMissingProperty++) {
    const [propertyName, max] = missingProperties[indexMissingProperty];
    const extraction = ZIP64_EXTRACTION[max];
    directory[propertyName] = extraFieldZip64[propertyName] = extraction.getValue(extraFieldView, offset);
    offset += extraction.bytes;
  }
}
function readExtraFieldUnicode(extraFieldUnicode, propertyName, rawPropertyName, directory, fileEntry) {
  if (extraFieldUnicode.data.length < 5) {
    extraFieldUnicode.valid = false;
    return;
  }
  const extraFieldView = getDataView(extraFieldUnicode.data);
  const computedCrc32 = new Crc32();
  computedCrc32.append(fileEntry[rawPropertyName]);
  const computedCrc32View = getDataView(new Uint8Array(4));
  computedCrc32View.setUint32(0, computedCrc32.get(), true);
  const nameCrc32 = getUint32(extraFieldView, 1);
  const version = getUint8(extraFieldView, 0);
  Object.assign(extraFieldUnicode, {
    version,
    [propertyName]: decodeText(extraFieldUnicode.data.subarray(5)),
    valid: version == 1 && !fileEntry.bitFlag.languageEncodingFlag && nameCrc32 == getUint32(computedCrc32View, 0)
  });
  if (extraFieldUnicode.valid) {
    directory[propertyName] = extraFieldUnicode[propertyName];
    directory[propertyName + PROPERTY_NAME_UTF8_SUFFIX] = true;
  }
}
function readExtraFieldAES(extraFieldAES, directory, compressionMethod) {
  const extraFieldView = getDataView(extraFieldAES.data);
  const strength = getUint8(extraFieldView, 4);
  Object.assign(extraFieldAES, {
    vendorVersion: getUint8(extraFieldView, 0),
    vendorId: getUint8(extraFieldView, 2),
    strength,
    originalCompressionMethod: compressionMethod,
    compressionMethod: getUint16(extraFieldView, 5)
  });
  directory.compressionMethod = extraFieldAES.compressionMethod;
  if (extraFieldAES.vendorVersion != VENDOR_VERSION_AE_1) {
    directory.crc32 = UNDEFINED_VALUE;
  }
}
function readExtraFieldNTFS(extraFieldNTFS, directory) {
  const extraFieldView = getDataView(extraFieldNTFS.data);
  let offsetExtraField = 4;
  let tag1Data;
  try {
    while (offsetExtraField < extraFieldNTFS.data.length && !tag1Data) {
      const tagValue = getUint16(extraFieldView, offsetExtraField);
      const attributeSize = getUint16(extraFieldView, offsetExtraField + 2);
      if (tagValue == EXTRAFIELD_TYPE_NTFS_TAG1) {
        tag1Data = extraFieldNTFS.data.slice(offsetExtraField + 4, offsetExtraField + 4 + attributeSize);
      }
      offsetExtraField += 4 + attributeSize;
    }
  } catch {
  }
  if (tag1Data && tag1Data.length == 24) {
    const tag1View = getDataView(tag1Data);
    const rawLastModDate = tag1View.getBigUint64(0, true);
    const rawLastAccessDate = tag1View.getBigUint64(8, true);
    const rawCreationDate = tag1View.getBigUint64(16, true);
    Object.assign(extraFieldNTFS, {
      rawLastModDate,
      rawLastAccessDate,
      rawCreationDate
    });
    const lastModDate = getDateNTFS(rawLastModDate);
    const lastAccessDate = getDateNTFS(rawLastAccessDate);
    const creationDate = getDateNTFS(rawCreationDate);
    const extraFieldData = { lastModDate, lastAccessDate, creationDate };
    Object.assign(extraFieldNTFS, extraFieldData);
    Object.assign(directory, extraFieldData, { rawLastAccessDate, rawCreationDate });
  }
}
function readExtraFieldUnixDates(extraField, directory) {
  if (extraField.data.length < 8) {
    return;
  }
  const extraFieldView = getDataView(extraField.data);
  const lastAccessDate = new Date((getUint32(extraFieldView, 0) | 0) * 1e3);
  const lastModDate = new Date((getUint32(extraFieldView, 4) | 0) * 1e3);
  const extraFieldData = { lastAccessDate, lastModDate };
  if (extraField.data.length >= 12) {
    extraFieldData.uid = getUint16(extraFieldView, 8);
    extraFieldData.gid = getUint16(extraFieldView, 10);
  }
  Object.assign(extraField, extraFieldData);
  Object.assign(directory, extraFieldData);
}
function readExtraFieldUnix(extraField, directory, isInfoZip) {
  try {
    const view = getDataView(extraField.data);
    let uid, gid;
    if (isInfoZip) {
      let offset = 0;
      const version = getUint8(view, offset++);
      const uidSize = getUint8(view, offset++);
      uid = unpackUnixId(extraField.data.subarray(offset, offset + uidSize));
      offset += uidSize;
      const gidSize = getUint8(view, offset++);
      gid = unpackUnixId(extraField.data.subarray(offset, offset + gidSize));
      Object.assign(extraField, { version, uid, gid });
    } else if (extraField.data.length >= 4) {
      uid = getUint16(view, 0);
      gid = getUint16(view, 2);
      Object.assign(extraField, { uid, gid });
    }
    if (uid !== UNDEFINED_VALUE) {
      directory.uid = uid;
    }
    if (gid !== UNDEFINED_VALUE) {
      directory.gid = gid;
    }
    return uid !== UNDEFINED_VALUE || gid !== UNDEFINED_VALUE;
  } catch {
  }
}
function unpackUnixId(bytes) {
  const buffer = new Uint8Array(4);
  buffer.set(bytes, 0);
  const view = new DataView(buffer.buffer, buffer.byteOffset, 4);
  return view.getUint32(0, true);
}
function readExtraFieldExtendedTimestamp(extraFieldExtendedTimestamp, directory, localDirectory) {
  if (!extraFieldExtendedTimestamp.data.length) {
    return;
  }
  const extraFieldView = getDataView(extraFieldExtendedTimestamp.data);
  const flags = getUint8(extraFieldView, 0);
  const timeProperties = [];
  const timeRawProperties = [];
  if (localDirectory) {
    if ((flags & 1) == 1) {
      timeProperties.push(PROPERTY_NAME_LAST_MODIFICATION_DATE);
      timeRawProperties.push(PROPERTY_NAME_RAW_LAST_MODIFICATION_DATE);
    }
    if ((flags & 2) == 2) {
      timeProperties.push(PROPERTY_NAME_LAST_ACCESS_DATE);
      timeRawProperties.push(PROPERTY_NAME_RAW_LAST_ACCESS_DATE);
    }
    if ((flags & 4) == 4) {
      timeProperties.push(PROPERTY_NAME_CREATION_DATE);
      timeRawProperties.push(PROPERTY_NAME_RAW_CREATION_DATE);
    }
  } else if (extraFieldExtendedTimestamp.data.length >= 5) {
    timeProperties.push(PROPERTY_NAME_LAST_MODIFICATION_DATE);
    timeRawProperties.push(PROPERTY_NAME_RAW_LAST_MODIFICATION_DATE);
  }
  let offset = 1;
  timeProperties.forEach((propertyName, indexProperty) => {
    if (extraFieldExtendedTimestamp.data.length >= offset + 4) {
      const time = getUint32(extraFieldView, offset);
      directory[propertyName] = extraFieldExtendedTimestamp[propertyName] = new Date((time | 0) * 1e3);
      const rawPropertyName = timeRawProperties[indexProperty];
      extraFieldExtendedTimestamp[rawPropertyName] = time;
    }
    offset += 4;
  });
}
async function detectOverlappingEntry({
  reader,
  fileEntry,
  index,
  offset,
  crc32,
  compressedSize,
  uncompressedSize,
  dataOffset,
  dataDescriptor,
  extraFieldZip64,
  readRanges
}) {
  let dataDescriptorLength = 0;
  if (dataDescriptor) {
    if (extraFieldZip64) {
      dataDescriptorLength = DATA_DESCRIPTOR_RECORD_ZIP_64_LENGTH;
    } else {
      dataDescriptorLength = DATA_DESCRIPTOR_RECORD_LENGTH;
    }
  }
  if (dataDescriptorLength) {
    const dataDescriptorArray = await readUint8Array(reader, dataOffset + compressedSize, dataDescriptorLength + DATA_DESCRIPTOR_RECORD_SIGNATURE_LENGTH);
    const dataDescriptorView = getDataView(dataDescriptorArray);
    let signature = dataDescriptorArray.length == dataDescriptorLength + DATA_DESCRIPTOR_RECORD_SIGNATURE_LENGTH && getUint32(dataDescriptorView, 0) == DATA_DESCRIPTOR_RECORD_SIGNATURE;
    if (signature) {
      const signedDataDescriptor = readDataDescriptor(dataDescriptorView, DATA_DESCRIPTOR_RECORD_SIGNATURE_LENGTH, extraFieldZip64);
      const matchCrc32 = fileEntry.encrypted && !fileEntry.zipCrypto || signedDataDescriptor.crc32 == crc32;
      if (matchCrc32 && signedDataDescriptor.compressedSize == compressedSize && signedDataDescriptor.uncompressedSize == uncompressedSize) {
        dataDescriptorLength += DATA_DESCRIPTOR_RECORD_SIGNATURE_LENGTH;
      } else {
        signature = false;
      }
    }
    if (dataDescriptorArray.length >= dataDescriptorLength) {
      const localDataDescriptor = readDataDescriptor(dataDescriptorView, signature ? DATA_DESCRIPTOR_RECORD_SIGNATURE_LENGTH : 0, extraFieldZip64);
      localDataDescriptor.signature = signature;
      fileEntry.localDirectory.dataDescriptor = localDataDescriptor;
    }
  }
  const range = {
    start: offset,
    end: dataOffset + compressedSize + dataDescriptorLength,
    fileEntry
  };
  for (const [otherIndex, otherRange] of readRanges) {
    if (otherIndex != index && range.start < otherRange.end && otherRange.start < range.end) {
      const error = new Error(ERR_OVERLAPPING_ENTRY);
      error.overlappingEntry = otherRange.fileEntry;
      throw error;
    }
  }
  readRanges.set(index, range);
}
function readDataDescriptor(dataDescriptorView, offset, extraFieldZip64) {
  const crc32 = getUint32(dataDescriptorView, offset);
  let compressedSize;
  let uncompressedSize;
  if (extraFieldZip64) {
    compressedSize = getBigUint64(dataDescriptorView, offset + 4);
    uncompressedSize = getBigUint64(dataDescriptorView, offset + 12);
  } else {
    compressedSize = getUint32(dataDescriptorView, offset + 4);
    uncompressedSize = getUint32(dataDescriptorView, offset + 8);
  }
  return { crc32, compressedSize, uncompressedSize };
}
function getDiskOffset(reader, diskNumber) {
  return reader.getDiskOffset ? reader.getDiskOffset(diskNumber) : 0;
}
async function startsWithSplitZipSignature(reader) {
  return await getFirstSignature(reader) == SPLIT_ZIP_FILE_SIGNATURE;
}
async function startsWithSplitZipMarker(reader) {
  const signature = await getFirstSignature(reader);
  return signature == SPLIT_ZIP_FILE_SIGNATURE || signature == TEMPORARY_SPLIT_ZIP_FILE_SIGNATURE;
}
async function getFirstSignature(reader) {
  const signatureArray = await readUint8Array(reader, 0, SPLIT_ZIP_FILE_SIGNATURE_LENGTH);
  return getUint32(getDataView(signatureArray));
}
function isStrictnessValue(value) {
  return value === STRICTNESS_STRICT || value === STRICTNESS_BALANCED || value === STRICTNESS_TOLERANT;
}
function getDecodableOutputSize(outputSize, compressedSize, compressed) {
  return Math.min(outputSize, compressed ? compressedSize * MAX_DEFLATE_EXPANSION_RATIO : compressedSize);
}
function getStrictness(options, inheritedOptions) {
  return resolveStrictness(options, resolveStrictness(inheritedOptions, STRICTNESS_BALANCED));
}
function resolveStrictness(options, inheritedStrictness) {
  const strictness = options[OPTION_STRICTNESS];
  if (strictness !== UNDEFINED_VALUE) {
    if (!isStrictnessValue(strictness)) {
      throw new Error(ERR_INVALID_STRICTNESS);
    }
    return strictness;
  }
  const checkAmbiguity = options[OPTION_CHECK_AMBIGUITY];
  if (checkAmbiguity === UNDEFINED_VALUE) {
    return inheritedStrictness;
  }
  if (checkAmbiguity) {
    return STRICTNESS_STRICT;
  }
  return inheritedStrictness == STRICTNESS_TOLERANT ? STRICTNESS_TOLERANT : STRICTNESS_BALANCED;
}
function getCheckLocalDirectory(checkLocalDirectory, strictness) {
  if (checkLocalDirectory === UNDEFINED_VALUE) {
    return strictness != STRICTNESS_TOLERANT;
  }
  return Boolean(checkLocalDirectory);
}
function getCheckLocalFilename(checkLocalFilename, strictness) {
  if (checkLocalFilename === UNDEFINED_VALUE) {
    return strictness == STRICTNESS_STRICT;
  }
  return Boolean(checkLocalFilename);
}
function getFilenameValidation(filenameValidation, strictness) {
  if (filenameValidation === UNDEFINED_VALUE) {
    return strictness;
  }
  if (!isStrictnessValue(filenameValidation)) {
    throw new Error(ERR_INVALID_FILENAME_VALIDATION);
  }
  return filenameValidation;
}
function isUnsafeFilename(filename, filenameValidation) {
  if (filenameValidation == STRICTNESS_TOLERANT) {
    return false;
  }
  const pathParts = filename.split("/");
  if (pathParts.length > 1 && pathParts[pathParts.length - 1] === "") {
    pathParts.pop();
  }
  if (pathParts.includes("..") || filename.startsWith("/") || filename.startsWith("\\\\") || DRIVE_LETTER_REGEXP.test(filename)) {
    return true;
  }
  return filenameValidation == STRICTNESS_STRICT && (pathParts.includes(".") || pathParts.includes(""));
}
function getMaxAppendedDataSize(maxAppendedDataSize, strictness) {
  if (maxAppendedDataSize !== UNDEFINED_VALUE) {
    const size = toNumber(maxAppendedDataSize);
    if (typeof size != NUMBER_TYPE || Number.isNaN(size) || size < 0) {
      throw new Error(ERR_INVALID_MAX_APPENDED_DATA_SIZE);
    }
    return size;
  }
  if (strictness == STRICTNESS_STRICT) {
    return 0;
  }
  if (strictness == STRICTNESS_TOLERANT) {
    return Infinity;
  }
  return MAX_16_BITS;
}
async function findEndOfCentralDirectory(reader, rejectAmbiguous, maxAppendedDataSize) {
  const { size } = reader;
  const anchoredLength = Math.min(size, END_OF_CENTRAL_DIR_LENGTH + MAX_16_BITS);
  const remoteProbeBudget = { count: MAX_END_OF_CENTRAL_DIR_PROBES };
  let endOfDirectoryInfo;
  let plausibleEndOfDirectoryInfo;
  let endOfDirectoryReachingEndCount = 0;
  for await (const [anchoredView, anchoredOffset, anchoredArray, indexByte, offset] of scanEndOfCentralDirectory(reader, anchoredLength)) {
    const commentLength = getUint16(anchoredView, indexByte + 20);
    if (offset + END_OF_CENTRAL_DIR_LENGTH + commentLength == size) {
      const reachability = await getCentralDirectoryReachability(reader, anchoredView, anchoredOffset, indexByte, offset, size, remoteProbeBudget);
      if (reachability == CENTRAL_DIRECTORY_REACHABLE) {
        if (!endOfDirectoryInfo) {
          endOfDirectoryInfo = getEndOfCentralDirectoryInfo(anchoredArray, indexByte, offset);
        }
        endOfDirectoryReachingEndCount++;
        if (!rejectAmbiguous || endOfDirectoryReachingEndCount > 1) {
          break;
        }
      } else if (reachability == CENTRAL_DIRECTORY_PLAUSIBLE && !plausibleEndOfDirectoryInfo) {
        plausibleEndOfDirectoryInfo = getEndOfCentralDirectoryInfo(anchoredArray, indexByte, offset);
      }
    }
  }
  if (!endOfDirectoryInfo) {
    endOfDirectoryInfo = plausibleEndOfDirectoryInfo;
  }
  if (!endOfDirectoryInfo) {
    endOfDirectoryInfo = await seekEndOfCentralDirectory(reader, maxAppendedDataSize, remoteProbeBudget);
  }
  return { endOfDirectoryInfo, endOfDirectoryReachingEndCount };
}
async function seekEndOfCentralDirectory(reader, maxAppendedDataSize, remoteProbeBudget) {
  const { size } = reader;
  const searchLength = Math.min(size, maxAppendedDataSize == Infinity ? size : END_OF_CENTRAL_DIR_LENGTH + MAX_16_BITS + maxAppendedDataSize);
  let firstSignatureInfo, plausibleInfo;
  for await (const [searchView, searchOffset, searchArray, indexByte, offset] of scanEndOfCentralDirectory(reader, searchLength)) {
    const record = getEndOfCentralDirectoryInfo(searchArray, indexByte, offset);
    if (!firstSignatureInfo) {
      firstSignatureInfo = record;
    }
    const reachability = await getCentralDirectoryReachability(reader, searchView, searchOffset, indexByte, offset, size, remoteProbeBudget);
    if (reachability == CENTRAL_DIRECTORY_REACHABLE) {
      return record;
    }
    if (reachability == CENTRAL_DIRECTORY_PLAUSIBLE && !plausibleInfo) {
      plausibleInfo = record;
    }
  }
  return plausibleInfo || firstSignatureInfo;
}
async function* scanEndOfCentralDirectory(reader, scanLength) {
  const scanOffset = reader.size - scanLength;
  const scanArray = await readUint8Array(reader, scanOffset, scanLength);
  const scanView = getDataView(scanArray);
  for (let indexByte = scanArray.length - END_OF_CENTRAL_DIR_LENGTH; indexByte >= 0; indexByte--) {
    if (getUint32(scanView, indexByte) == END_OF_CENTRAL_DIR_SIGNATURE) {
      yield [scanView, scanOffset, scanArray, indexByte, scanOffset + indexByte];
    }
  }
}
function getEndOfCentralDirectoryInfo(scanArray, indexByte, offset) {
  return { offset, buffer: scanArray.slice(indexByte, indexByte + END_OF_CENTRAL_DIR_LENGTH).buffer };
}
async function getCentralDirectoryReachability(reader, view, anchoredOffset, indexByte, offset, size, remoteProbeBudget) {
  const filesLength = getUint16(view, indexByte + 10);
  const directoryDataLength = getUint32(view, indexByte + 12);
  const directoryDataOffset = getUint32(view, indexByte + 16);
  if (filesLength == MAX_16_BITS || directoryDataLength == MAX_32_BITS || directoryDataOffset == MAX_32_BITS) {
    const locatorSignature = await readSignature(reader, view, anchoredOffset, offset - ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH, size, remoteProbeBudget);
    return locatorSignature == ZIP64_END_OF_CENTRAL_DIR_LOCATOR_SIGNATURE ? CENTRAL_DIRECTORY_REACHABLE : CENTRAL_DIRECTORY_UNREACHABLE;
  }
  if (!filesLength && !directoryDataLength) {
    return CENTRAL_DIRECTORY_PLAUSIBLE;
  }
  const directoryDiskNumber = getUint16(view, indexByte + 6);
  for (const centralDirectoryOffset of [offset - directoryDataLength, getDiskOffset(reader, directoryDiskNumber) + directoryDataOffset]) {
    if (await readSignature(reader, view, anchoredOffset, centralDirectoryOffset, size, remoteProbeBudget) == CENTRAL_FILE_HEADER_SIGNATURE) {
      return CENTRAL_DIRECTORY_REACHABLE;
    }
  }
  return CENTRAL_DIRECTORY_UNREACHABLE;
}
async function readSignature(reader, view, anchoredOffset, signatureOffset, size, remoteProbeBudget) {
  if (signatureOffset < 0 || signatureOffset + 4 > size) {
    return UNDEFINED_VALUE;
  }
  if (signatureOffset >= anchoredOffset) {
    return getUint32(view, signatureOffset - anchoredOffset);
  }
  if (remoteProbeBudget.count > 0) {
    remoteProbeBudget.count--;
    const signatureArray = await readUint8Array(reader, signatureOffset, 4);
    return getUint32(getDataView(signatureArray), 0);
  }
  return UNDEFINED_VALUE;
}
function validateLocalDirectory(zipEntry, localDirectory, rawLocalFilename, checkLocalFilename, warnings) {
  const { rawFilename } = zipEntry;
  const reject = !warnings;
  const maskedLocalDirectory = zipEntry.decryptedDirectory && (localDirectory.rawBitFlag & BITFLAG_MASKED_LOCAL_HEADERS) == BITFLAG_MASKED_LOCAL_HEADERS;
  if (checkLocalFilename && !maskedLocalDirectory && (rawLocalFilename.length != rawFilename.length || rawLocalFilename.some((byteValue, indexByte) => byteValue != rawFilename[indexByte]))) {
    reportAmbiguity(reject, warnings, "mismatched local file header (filename)");
  }
  if ((localDirectory.rawBitFlag & BITFLAG_AMBIGUITY_MASK) != (zipEntry.rawBitFlag & BITFLAG_AMBIGUITY_MASK)) {
    reportAmbiguity(reject, warnings, WARNING_MISMATCHED_LOCAL_FILE_HEADER_BIT_FLAG);
  }
  if (localDirectory.compressionMethod != zipEntry.compressionMethod) {
    reportAmbiguity(reject, warnings, WARNING_MISMATCHED_LOCAL_FILE_HEADER_COMPRESSION_METHOD);
  }
  if (!localDirectory.bitFlag.dataDescriptor && !maskedLocalDirectory && (localDirectory.crc32 || localDirectory.compressedSize || localDirectory.uncompressedSize) && (localDirectory.crc32 != zipEntry.crc32 || localDirectory.compressedSize != zipEntry.compressedSize || localDirectory.uncompressedSize != zipEntry.uncompressedSize)) {
    reportAmbiguity(reject, warnings, WARNING_MISMATCHED_LOCAL_FILE_HEADER_CRC32_OR_SIZES);
  }
}
function reportAmbiguity(reject, warnings, reason) {
  if (reject) {
    throwAmbiguousArchive(reason);
  } else {
    addWarning(warnings, reason);
  }
}
function addWarning(warnings, reason, filename) {
  if (!warnings.some((warning) => warning.reason == reason)) {
    const warning = { reason };
    if (filename !== UNDEFINED_VALUE) {
      warning.filename = filename;
    }
    warnings.push(warning);
  }
}
function throwAmbiguousArchive(reason) {
  const error = new Error(ERR_AMBIGUOUS_ARCHIVE);
  error.reason = reason;
  throw error;
}
function getOptionValue(zipReader, options, name) {
  return options[name] === UNDEFINED_VALUE ? zipReader.options[name] : options[name];
}
function getFunctionOptionValue(zipReader, options, name) {
  return checkFunctionOption(getOptionValue(zipReader, options, name));
}
function getDate(timeRaw) {
  const date = (timeRaw & 4294901760) >> 16, time = timeRaw & MAX_16_BITS;
  const result = new Date(1980 + ((date & 65024) >> 9), ((date & 480) >> 5) - 1, date & 31, (time & 63488) >> 11, (time & 2016) >> 5, (time & 31) * 2, 0);
  return result < MIN_DATE ? MIN_DATE : result;
}
function getDateNTFS(timeRaw) {
  return new Date(Number(timeRaw / BigInt(1e4) - BigInt(116444736e5)));
}
function getUint8(view, offset) {
  return view.getUint8(offset);
}
function getUint16(view, offset) {
  return view.getUint16(offset, true);
}
function getUint32(view, offset) {
  return view.getUint32(offset, true);
}
function getBigUint64(view, offset) {
  const value = view.getBigUint64(offset, true);
  if (value > MAX_SAFE_UINT64) {
    throw new Error(ERR_UNSUPPORTED_UINT64);
  }
  return Number(value);
}

export {
  MAX_32_BITS,
  MAX_16_BITS,
  MAX_8_BITS,
  COMPRESSION_METHOD_DEFLATE,
  COMPRESSION_METHOD_DEFLATE_64,
  COMPRESSION_METHOD_STORE,
  COMPRESSION_METHOD_AES,
  LOCAL_FILE_HEADER_SIGNATURE,
  SPLIT_ZIP_FILE_SIGNATURE,
  DATA_DESCRIPTOR_RECORD_SIGNATURE,
  DIGITAL_SIGNATURE_RECORD_SIGNATURE,
  CENTRAL_FILE_HEADER_SIGNATURE,
  END_OF_CENTRAL_DIR_SIGNATURE,
  ZIP64_END_OF_CENTRAL_DIR_SIGNATURE,
  ZIP64_END_OF_CENTRAL_DIR_LOCATOR_SIGNATURE,
  CENTRAL_FILE_HEADER_LENGTH,
  END_OF_CENTRAL_DIR_LENGTH,
  ZIP64_END_OF_CENTRAL_DIR_TOTAL_LENGTH,
  DATA_DESCRIPTOR_RECORD_LENGTH,
  DATA_DESCRIPTOR_RECORD_ZIP_64_LENGTH,
  DATA_DESCRIPTOR_RECORD_SIGNATURE_LENGTH,
  SPLIT_ZIP_FILE_SIGNATURE_LENGTH,
  EXTRAFIELD_TYPE_ZIP64,
  EXTRAFIELD_TYPE_AES,
  EXTRAFIELD_TYPE_NTFS,
  EXTRAFIELD_TYPE_NTFS_TAG1,
  EXTRAFIELD_TYPE_EXTENDED_TIMESTAMP,
  EXTRAFIELD_TYPE_UNICODE_PATH,
  EXTRAFIELD_TYPE_UNICODE_COMMENT,
  EXTRAFIELD_TYPE_USDZ,
  EXTRAFIELD_TYPE_INFOZIP,
  EXTRAFIELD_TYPE_UNIX,
  EXTRAFIELD_TYPE_UNIX_TYPE1,
  EXTRAFIELD_TYPE_PKWARE_UNIX,
  BITFLAG_ENCRYPTED,
  BITFLAG_LEVEL,
  BITFLAG_LEVEL_MAX_MASK,
  BITFLAG_LEVEL_FAST_MASK,
  BITFLAG_LEVEL_SUPER_FAST_MASK,
  BITFLAG_DATA_DESCRIPTOR,
  BITFLAG_LANG_ENCODING_FLAG,
  FILE_ATTR_MSDOS_DIR_MASK,
  FILE_ATTR_MSDOS_READONLY_MASK,
  FILE_ATTR_MSDOS_HIDDEN_MASK,
  FILE_ATTR_MSDOS_SYSTEM_MASK,
  FILE_ATTR_MSDOS_ARCHIVE_MASK,
  FILE_ATTR_UNIX_TYPE_MASK,
  FILE_ATTR_UNIX_TYPE_DIR,
  FILE_ATTR_UNIX_TYPE_SYMLINK,
  FILE_ATTR_UNIX_TYPE_FILE,
  FILE_ATTR_UNIX_EXECUTABLE_MASK,
  FILE_ATTR_UNIX_DEFAULT_MASK,
  FILE_ATTR_UNIX_SETUID_MASK,
  FILE_ATTR_UNIX_SETGID_MASK,
  FILE_ATTR_UNIX_STICKY_MASK,
  VERSION_STORE,
  VERSION_DEFLATE,
  VERSION_ZIP64,
  VERSION_AES,
  VERSION_MADE_BY_MSDOS,
  VERSION_MADE_BY_UNIX,
  DIRECTORY_SIGNATURE,
  HEADER_SIZE,
  HEADER_OFFSET_VERSION,
  HEADER_OFFSET_SIGNATURE,
  HEADER_OFFSET_COMPRESSED_SIZE,
  HEADER_OFFSET_UNCOMPRESSED_SIZE,
  HEADER_OFFSET_FILENAME_LENGTH,
  HEADER_OFFSET_EXTRAFIELD_LENGTH,
  LOCAL_HEADER_COMMON_OFFSET,
  MAX_DATE,
  MIN_DATE,
  UNDEFINED_VALUE,
  INFINITY_VALUE,
  FUNCTION_TYPE,
  OBJECT_TYPE,
  STRING_TYPE,
  EMPTY_UINT8_ARRAY,
  OPTION_PASSWORD,
  OPTION_RAW_PASSWORD,
  OPTION_PASS_THROUGH,
  OPTION_SIGNAL,
  OPTION_USE_WEB_WORKERS,
  OPTION_USE_COMPRESSION_STREAM,
  OPTION_TRANSFER_STREAMS,
  OPTION_PREVENT_CLOSE,
  OPTION_ENCRYPTION_STRENGTH,
  OPTION_EXTENDED_TIMESTAMP,
  OPTION_NTFS_TIMESTAMP,
  OPTION_KEEP_ORDER,
  OPTION_LEVEL,
  OPTION_BUFFERED_WRITE,
  OPTION_CREATE_TEMP_STREAM,
  OPTION_DATA_DESCRIPTOR_SIGNATURE,
  OPTION_USE_UNICODE_FILE_NAMES,
  OPTION_DATA_DESCRIPTOR,
  OPTION_SUPPORT_ZIP64_SPLIT_FILE,
  OPTION_ENCODE_TEXT,
  OPTION_OFFSET,
  OPTION_USDZ,
  OPTION_UNIX_EXTRA_FIELD_TYPE,
  OPTION_LOCAL_EXTRA_FIELD,
  OPTION_CENTRAL_EXTRA_FIELD,
  OPTION_SIGN_CENTRAL_DIRECTORY,
  TEXT_TYPE_FILENAME,
  TEXT_TYPE_COMMENT,
  ERR_INVALID_FUNCTION_OPTION,
  ERR_INVALID_SIGNAL,
  ERR_INVALID_PASSWORD_TYPE,
  checkFunctionOption,
  checkSignalOption,
  checkPasswordOption,
  checkInteger,
  checkIntegerOption,
  toNumber,
  ERR_INVALID_MAX_WORKERS,
  getConfiguration,
  configure,
  setDefaultConfiguration,
  resetConfiguration,
  concat,
  toExactUint8Array,
  getDataView,
  encodeText,
  ERR_INVALID_PASSWORD,
  ERR_INVALID_SIGNATURE,
  ERR_INVALID_AUTHENTICATION_CODE,
  ERR_UNSUPPORTED_CRYPTO_API,
  toCompatibleReadable,
  streamToBlob,
  toCompatibleWritable,
  ERR_INVALID_CODEC_DEFINITION,
  ERR_RESERVED_COMPRESSION_METHOD,
  ERR_INVALID_CODEC_MODULE,
  registerCodec,
  unregisterCodec,
  getRegisteredCodec,
  getRegisteredCodecs,
  getCodecStreams,
  ERR_INVALID_UNCOMPRESSED_SIZE,
  ERR_INVALID_COMPRESSED_DATA,
  ERR_INVALID_CRC32,
  FORMAT_DEFLATE_RAW,
  FORMAT_DEFLATE64_RAW,
  FORMAT_GZIP,
  supportsFormat,
  MESSAGE_EVENT_TYPE,
  MESSAGE_START,
  MESSAGE_PULL,
  MESSAGE_DATA,
  MESSAGE_ACK_DATA,
  MESSAGE_CLOSE,
  CODEC_DEFLATE,
  ERR_WORKER_STARTUP_TIMEOUT,
  configureWorker,
  setWebWorkerBackend,
  supportsDeflate,
  disableWebWorker,
  ProgressWatcherStream,
  callHandler,
  createWorkerInterface,
  runWorker,
  runWorker2,
  terminateWorkers,
  ERR_HTTP_RANGE,
  ERR_HTTP_RESOURCE_CHANGED,
  ERR_ITERATOR_COMPLETED_TOO_SOON,
  ERR_WRITER_NOT_INITIALIZED,
  Reader,
  Writer,
  Data64URIReader,
  Data64URIWriter,
  BlobReader,
  BlobWriter,
  TextReader,
  getTextSize,
  TextWriter,
  HttpReader,
  HttpRangeReader,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  SplitDataReader,
  SplitDataWriter,
  GenericReader,
  GenericWriter,
  ownsWritable,
  initStream,
  readUint8Array,
  createReadable,
  PROPERTY_NAME_COMMENT,
  PROPERTY_NAME_UNCOMPRESSED_SIZE,
  PROPERTY_NAME_LAST_MODIFICATION_DATE,
  PROPERTY_NAME_RAW_LAST_MODIFICATION_DATE,
  PROPERTY_NAME_LAST_ACCESS_DATE,
  PROPERTY_NAME_CREATION_DATE,
  PROPERTY_NAME_INTERNAL_FILE_ATTRIBUTES,
  PROPERTY_NAME_EXTERNAL_FILE_ATTRIBUTES,
  PROPERTY_NAME_DEPRECATED_INTERNAL_FILE_ATTRIBUTES,
  PROPERTY_NAME_DEPRECATED_EXTERNAL_FILE_ATTRIBUTES,
  PROPERTY_NAME_MSDOS_ATTRIBUTES_RAW,
  PROPERTY_NAME_MSDOS_ATTRIBUTES,
  PROPERTY_NAME_MS_DOS_COMPATIBLE,
  PROPERTY_NAME_ZIP64,
  PROPERTY_NAME_ENCRYPTED,
  PROPERTY_NAME_VERSION,
  PROPERTY_NAME_VERSION_MADE_BY,
  PROPERTY_NAME_ZIPCRYPTO,
  PROPERTY_NAME_DIRECTORY,
  PROPERTY_NAME_EXECUTABLE,
  PROPERTY_NAME_COMPRESSION_METHOD,
  PROPERTY_NAME_SIGNATURE,
  PROPERTY_NAME_EXTRA_FIELD,
  PROPERTY_NAME_UID,
  PROPERTY_NAME_GID,
  PROPERTY_NAME_UNIX_MODE,
  PROPERTY_NAME_SETUID,
  PROPERTY_NAME_SETGID,
  PROPERTY_NAME_STICKY,
  Entry,
  ERR_BAD_FORMAT,
  ERR_EOCDR_NOT_FOUND,
  ERR_EOCDR_LOCATOR_ZIP64_NOT_FOUND,
  ERR_CENTRAL_DIRECTORY_NOT_FOUND,
  ERR_LOCAL_FILE_HEADER_NOT_FOUND,
  ERR_EXTRAFIELD_ZIP64_NOT_FOUND,
  ERR_ENCRYPTED,
  ERR_UNSUPPORTED_ENCRYPTION,
  ERR_UNSUPPORTED_COMPRESSION2 as ERR_UNSUPPORTED_COMPRESSION,
  ERR_SPLIT_ZIP_FILE,
  ERR_OVERLAPPING_ENTRY,
  ERR_ENTRY_DATA_OUT_OF_BOUNDS,
  ERR_AMBIGUOUS_ARCHIVE,
  ERR_ENCRYPTED_CENTRAL_DIRECTORY,
  ERR_UNSAFE_FILENAME,
  ERR_INVALID_STRICTNESS,
  ERR_INVALID_FILENAME_VALIDATION,
  ERR_INVALID_MAX_APPENDED_DATA_SIZE,
  ERR_UNSUPPORTED_UINT64,
  WARNING_UNSORTED_CENTRAL_DIRECTORY,
  WARNING_UNKNOWN_VERSION,
  WARNING_COMPRESSED_PATCHED_DATA,
  WARNING_MALFORMED_EXTRA_FIELD,
  WARNING_UNKNOWN_ZIP64_EXTENSIBLE_DATA,
  WARNING_WRAPPED_ENTRIES_COUNT,
  WARNING_APPENDED_DATA,
  WARNING_PREPENDED_DATA,
  WARNING_PREPENDED_CENTRAL_DIRECTORY,
  WARNING_TRAILING_CENTRAL_DIRECTORY_DATA,
  WARNING_DUPLICATE_FILENAME,
  WARNING_MISMATCHED_ZIP64_END_OF_CENTRAL_DIRECTORY,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_BIT_FLAG,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_COMPRESSION_METHOD,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_CRC32_OR_SIZES,
  ZipReader,
  ZipReaderStream,
  isZipFile
};
//# sourceMappingURL=chunk-5C6BLAQG.js.map
