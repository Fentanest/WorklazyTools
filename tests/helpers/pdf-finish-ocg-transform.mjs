import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
} = require("pdf-lib");

const key = (name) => PDFName.of(name);
const lookup = (document, dictionary, name) => document.context.lookup(dictionary?.get(key(name)));
const nameOf = (object) => object?.toString();
const asArray = (object) => object instanceof PDFArray ? object.asArray() : [];
const hasRaw = (dictionary, name) => dictionary.keys().some((entry) => entry.decodeText() === name);
const decodeName = (value) => value?.replace(/#([0-9a-f]{2})/ig, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));

function contentTokens(source) {
  let index = 0;
  const result = [];
  const whitespace = (character) => /[\x00\t\n\f\r ]/.test(character || "");
  const delimiter = (character) => !character || whitespace(character) || "()<>[]{}/%".includes(character);
  function skip() {
    while (index < source.length) {
      if (whitespace(source[index])) index += 1;
      else if (source[index] === "%") while (index < source.length && !/[\r\n]/.test(source[index])) index += 1;
      else break;
    }
  }
  function readOne() {
    skip();
    const start = index;
    const character = source[index];
    if (character === "(") {
      index += 1;
      let depth = 1;
      while (index < source.length && depth) {
        if (source[index] === "\\") { index += 2; continue; }
        if (source[index] === "(") depth += 1;
        if (source[index] === ")") depth -= 1;
        index += 1;
      }
      if (depth) throw new Error("bad-string");
    } else if (source.slice(index, index + 2) === "<<") {
      index += 2;
      while (true) {
        skip();
        if (source.slice(index, index + 2) === ">>") { index += 2; break; }
        if (index >= source.length) throw new Error("bad-dict");
        readOne();
      }
    } else if (character === "[") {
      index += 1;
      while (true) {
        skip();
        if (source[index] === "]") { index += 1; break; }
        if (index >= source.length) throw new Error("bad-array");
        readOne();
      }
    } else if (character === "<") {
      index += 1;
      while (index < source.length && source[index] !== ">") index += 1;
      if (source[index++] !== ">") throw new Error("bad-hex");
    } else if (character === "/") {
      index += 1;
      while (index < source.length && !delimiter(source[index])) index += 1;
    } else {
      while (index < source.length && !delimiter(source[index])) index += 1;
      if (index === start) throw new Error("bad-token");
    }
    return { start, end: index, raw: source.slice(start, index) };
  }
  while (true) {
    skip();
    if (index >= source.length) break;
    result.push(readOne());
  }
  return result;
}

function operators(source) {
  const result = [];
  let operands = [];
  for (const token of contentTokens(source)) {
    if (/^[A-Za-z*'"]/.test(token.raw) && !["true", "false", "null"].includes(token.raw)) {
      if (token.raw === "BI") throw new Error("inline-image-unsupported");
      result.push({ op: token.raw, args: operands, start: operands[0]?.start ?? token.start, end: token.end });
      operands = [];
    } else operands.push(token);
  }
  if (operands.length) throw new Error("dangling-operands");
  return result;
}

function pageContent(page) {
  const document = page.doc;
  const raw = document.context.lookup(page.node.get(key("Contents")));
  return (raw instanceof PDFArray ? raw.asArray() : raw ? [raw] : []).map((reference) => {
    const stream = document.context.lookup(reference);
    if (!(stream instanceof PDFRawStream)) throw new Error("bad-content");
    return Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
  }).join("\n");
}

function guardOptionalContentSyntax(document) {
  const seen = new Set();
  function walk(value) {
    const object = document.context.lookup(value);
    if (!object || seen.has(object)) return;
    seen.add(object);
    if (object instanceof PDFRawStream) { walk(object.dict); return; }
    if (object instanceof PDFArray) { object.asArray().forEach(walk); return; }
    if (!(object instanceof PDFDict)) return;
    if (nameOf(lookup(document, object, "Type")) === "/OCG") {
      if (hasRaw(object, "Usage")) throw new Error("v10-OCG-Usage-key");
      if (hasRaw(object, "Intent")) {
        const intent = lookup(document, object, "Intent");
        const valid = nameOf(intent) === "/View"
          || intent instanceof PDFArray && intent.size() > 0 && intent.asArray().every((entry) => nameOf(document.context.lookup(entry)) === "/View");
        if (!valid) throw new Error("v10-OCG-Intent");
      }
    }
    if (nameOf(lookup(document, object, "Type")) === "/OCMD" && hasRaw(object, "VE")) throw new Error("OCMD-VE-unsupported");
    for (const [, entry] of object.entries()) walk(entry);
  }
  walk(document.catalog);
  for (const [, object] of document.context.enumerateIndirectObjects()) walk(object);
  const optionalContent = lookup(document, document.catalog, "OCProperties");
  if (optionalContent instanceof PDFDict) {
    if (hasRaw(optionalContent, "Configs")) throw new Error("v10-Configs-key");
    const configuration = lookup(document, optionalContent, "D");
    if (configuration instanceof PDFDict && hasRaw(configuration, "AS")) throw new Error("v10-AS-key");
  }
}

function prepareTransform(document) {
  guardOptionalContentSyntax(document);
  const optionalContent = lookup(document, document.catalog, "OCProperties");
  const configuration = optionalContent ? lookup(document, optionalContent, "D") : undefined;
  const state = new Map();
  if (optionalContent) {
    if (!(configuration instanceof PDFDict)) throw new Error("missing-default-config");
    if (asArray(lookup(document, configuration, "AS")).length) throw new Error("usage-AS-unsupported");
    const baseState = nameOf(lookup(document, configuration, "BaseState")) ?? "/ON";
    if (!["/ON", "/OFF"].includes(baseState)) throw new Error("BaseState-unsupported");
    for (const reference of asArray(lookup(document, optionalContent, "OCGs"))) state.set(reference.toString(), baseState === "/ON");
    for (const reference of asArray(lookup(document, configuration, "ON"))) state.set(reference.toString(), true);
    for (const reference of asArray(lookup(document, configuration, "OFF"))) state.set(reference.toString(), false);
  }
  function visible(reference) {
    const object = document.context.lookup(reference);
    if (!(object instanceof PDFDict)) throw new Error("missing-OC");
    if (nameOf(lookup(document, object, "Type")) === "/OCG") {
      if (!state.has(reference.toString())) throw new Error("unlisted-OCG");
      return state.get(reference.toString());
    }
    if (nameOf(lookup(document, object, "Type")) === "/OCMD") {
      if (object.has(key("VE"))) throw new Error("OCMD-VE-unsupported");
      const groups = lookup(document, object, "OCGs");
      const states = (groups instanceof PDFArray ? groups.asArray() : [object.get(key("OCGs"))]).map(visible);
      const policy = nameOf(lookup(document, object, "P")) ?? "/AnyOn";
      const result = { "/AnyOn": states.some(Boolean), "/AllOn": states.every(Boolean), "/AnyOff": states.some((entry) => !entry), "/AllOff": states.every((entry) => !entry) }[policy];
      if (result === undefined) throw new Error("OCMD-policy-unsupported");
      return result;
    }
    throw new Error("unknown-OC-type");
  }

  const plans = [];
  for (const page of document.getPages()) {
    const source = pageContent(page);
    const pageOperators = operators(source);
    const resources = page.node.Resources();
    const properties = lookup(document, resources, "Properties");
    const xobjects = lookup(document, resources, "XObject");
    const edits = [];
    let active = null;
    const seenForms = new Set();
    function inspectForms(formResources, depth = 0) {
      const forms = lookup(document, formResources, "XObject");
      if (!(forms instanceof PDFDict)) return;
      for (const [, reference] of forms.entries()) {
        const object = document.context.lookup(reference);
        if (!(object instanceof PDFRawStream)) continue;
        const signature = reference.toString();
        if (seenForms.has(signature)) continue;
        seenForms.add(signature);
        if (depth > 0 && object.dict.has(key("OC"))) throw new Error("form-internal-OC-unsupported");
        if (nameOf(lookup(document, object.dict, "Subtype")) === "/Form") {
          const body = Buffer.from(decodePDFRawStream(object).decode()).toString("latin1");
          if (operators(body).some((operator) => operator.op === "BDC" && decodeName(operator.args[0]?.raw) === "/OC")) throw new Error("form-internal-OC-unsupported");
          const childResources = lookup(document, object.dict, "Resources");
          if (childResources instanceof PDFDict) inspectForms(childResources, depth + 1);
        }
      }
    }
    inspectForms(resources);
    for (const operator of pageOperators) {
      if (["BDC", "BMC"].includes(operator.op)) {
        if (active) throw new Error("nested-marked-content-unsupported");
        if (operator.op === "BDC" && decodeName(operator.args[0]?.raw) === "/OC") {
          const property = operator.args[1]?.raw;
          if (!property?.startsWith("/") || !(properties instanceof PDFDict)) throw new Error("inline-or-missing-OC-property");
          const decoded = decodeName(property.slice(1));
          active = { start: operator.start, markEnd: operator.end, optional: true, on: visible(properties.get(key(decoded))) };
        } else active = { optional: false };
      } else if (operator.op === "EMC") {
        if (!active) throw new Error("unbalanced-EMC");
        if (active.optional) {
          if (active.on) edits.push([active.start, active.markEnd, ""], [operator.start, operator.end, ""]);
          else edits.push([active.start, operator.end, ""]);
        }
        active = null;
      } else if (operator.op === "Do") {
        const reference = xobjects?.get(key(operator.args[0]?.raw.slice(1)));
        const object = document.context.lookup(reference);
        if (object instanceof PDFRawStream && object.dict.has(key("OC")) && !visible(object.dict.get(key("OC"))) && !active?.optional) {
          edits.push([operator.start, operator.end, ""]);
        }
      }
    }
    if (active) throw new Error("unbalanced-BDC");
    let transformed = source;
    for (const [start, end, replacement] of edits.sort((left, right) => right[0] - left[0])) {
      transformed = transformed.slice(0, start) + replacement + transformed.slice(end);
    }
    plans.push({ page, transformed });
  }
  return { plans, visible };
}

export async function flattenOptionalContent(bytes) {
  const source = await PDFDocument.load(bytes, { updateMetadata: false });
  const { plans, visible } = prepareTransform(source);
  for (const { page, transformed } of plans) {
    page.node.set(key("Contents"), source.context.register(source.context.flateStream(Buffer.from(transformed, "latin1"))));
    const resources = page.node.Resources();
    resources.delete(key("Properties"));
    const xobjects = lookup(source, resources, "XObject");
    if (xobjects instanceof PDFDict) for (const [entry, reference] of xobjects.entries()) {
      const object = source.context.lookup(reference);
      if (object instanceof PDFRawStream && object.dict.has(key("OC"))) {
        if (!visible(object.dict.get(key("OC")))) xobjects.delete(entry);
        else object.dict.delete(key("OC"));
      }
    }
  }
  source.catalog.delete(key("OCProperties"));
  const result = await PDFDocument.create({ updateMetadata: false });
  for (const page of await result.copyPages(source, source.getPageIndices())) result.addPage(page);
  return Buffer.from(await result.save({ updateFieldAppearances: false }));
}

export async function findOptionalContentResiduals(bytes) {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const allObjects = [];
  const seen = new Set();
  const characterProcedures = new Set();
  function collect(value) {
    const object = document.context.lookup(value);
    if (!object || seen.has(object)) return;
    seen.add(object);
    allObjects.push(object);
    if (object instanceof PDFRawStream) { collect(object.dict); return; }
    if (object instanceof PDFArray) { object.asArray().forEach(collect); return; }
    if (object instanceof PDFDict) {
      const procedures = lookup(document, object, "CharProcs");
      if (procedures instanceof PDFDict) for (const [, entry] of procedures.entries()) characterProcedures.add(document.context.lookup(entry));
      for (const [, entry] of object.entries()) collect(entry);
    }
  }
  collect(document.catalog);
  for (const [, object] of document.context.enumerateIndirectObjects()) collect(object);
  const residuals = [];
  const containsOptionalContent = (source) => operators(source).some((operator) => operator.op === "BDC" && decodeName(operator.args[0]?.raw) === "/OC");
  for (const object of allObjects) {
    if (object instanceof PDFDict) {
      for (const dictionaryKey of object.keys()) if (["OC", "OCProperties"].includes(dictionaryKey.decodeText())) residuals.push(`key:${dictionaryKey.decodeText()}`);
      if (["/OCG", "/OCMD"].includes(nameOf(lookup(document, object, "Type")))) residuals.push(`type:${nameOf(lookup(document, object, "Type"))}`);
    }
    if (object instanceof PDFRawStream
        && (nameOf(lookup(document, object.dict, "Subtype")) === "/Form"
          || nameOf(lookup(document, object.dict, "Type")) === "/Pattern"
          || characterProcedures.has(object))
        && containsOptionalContent(Buffer.from(decodePDFRawStream(object).decode()).toString("latin1"))) {
      residuals.push("non-page-content:/OC");
    }
  }
  for (const page of document.getPages()) if (containsOptionalContent(pageContent(page))) residuals.push("page-content:/OC");
  return residuals;
}

export async function emptyFirstPageContent(bytes) {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const [page] = document.getPages();
  if (!page) throw new Error("negative control requires one page");
  page.node.set(key("Contents"), document.context.register(document.context.flateStream(Buffer.alloc(0))));
  return Buffer.from(await document.save({ updateFieldAppearances: false }));
}
