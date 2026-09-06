import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
} = require("pdf-lib");
const key = (name) => PDFName.of(name);
const lookup = (document, dictionary, name) => document.context.lookup(dictionary?.get(key(name)));
const nameOf = (object) => object?.toString();
const asArray = (object) => object instanceof PDFArray ? object.asArray() : [];
const hasRaw = (dictionary, name) => dictionary.keys().some((entry) => entry.decodeText() === name);
const decodeName = (value) => value?.replace(/#([0-9a-f]{2})/ig, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
const pathBuildingOperators = new Set(["m", "l", "c", "v", "y", "h", "re"]);
const pathEndingOperators = new Set(["S", "s", "f", "F", "f*", "B", "B*", "b", "b*", "n"]);
const textStateOperators = new Set(["Tf", "Tc", "Tw", "Tz", "TL", "Tr", "Ts"]);

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

function guardV10(document) {
  const seen = new Set();
  function walk(value) {
    const object = document.context.lookup(value);
    if (!object || seen.has(object)) return;
    seen.add(object);
    if (object instanceof PDFRawStream) { walk(object.dict); return; }
    if (object instanceof PDFArray) { for (const entry of object.asArray()) walk(entry); return; }
    if (!(object instanceof PDFDict)) return;
    if (nameOf(lookup(document, object, "Type")) === "/OCG") {
      if (hasRaw(object, "Usage")) throw new Error("v10-OCG-Usage-key");
      if (hasRaw(object, "Intent")) {
        const intent = lookup(document, object, "Intent");
        const valid = nameOf(intent) === "/View" || intent instanceof PDFArray && intent.size() > 0 && intent.asArray().every((entry) => nameOf(document.context.lookup(entry)) === "/View");
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

function prepare(document) {
  guardV10(document);
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
  for (const page of document.getPages()) {
    const resources = page.node.Resources();
    const properties = lookup(document, resources, "Properties");
    const xobjects = lookup(document, resources, "XObject");
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
    let active = null;
    for (const operator of operators(pageContent(page))) {
      if (["BDC", "BMC"].includes(operator.op)) {
        if (active) throw new Error("nested-marked-content-unsupported");
        if (operator.op === "BDC" && decodeName(operator.args[0]?.raw) === "/OC") {
          const property = operator.args[1]?.raw;
          if (!property?.startsWith("/") || !(properties instanceof PDFDict)) throw new Error("inline-or-missing-OC-property");
          active = { oc: true, on: visible(properties.get(key(decodeName(property.slice(1))))) };
        } else active = { oc: false };
      } else if (operator.op === "EMC") {
        if (!active) throw new Error("unbalanced-EMC");
        active = null;
      } else if (operator.op === "Do") {
        const reference = xobjects?.get(key(operator.args[0]?.raw.slice(1)));
        const object = document.context.lookup(reference);
        if (object instanceof PDFRawStream && object.dict.has(key("OC"))) visible(object.dict.get(key("OC")));
      }
    }
    if (active) throw new Error("unbalanced-BDC");
  }
  return { visible };
}

function classifyOff(ops) {
  let graphicsDepth = 0;
  let graphicsValid = true;
  let pathOpen = false;
  let textDepth = 0;
  let textValid = true;
  let marked = false;
  let inlineImage = false;
  for (const [index, operator] of ops.entries()) {
    if (operator.op === "q") graphicsDepth += 1;
    if (operator.op === "Q") graphicsDepth -= 1;
    if (graphicsDepth < 0 || graphicsDepth === 0 && index < ops.length - 1) graphicsValid = false;
    if (pathBuildingOperators.has(operator.op)) pathOpen = true;
    if (pathEndingOperators.has(operator.op)) pathOpen = false;
    if (operator.op === "BT") { if (textDepth !== 0) textValid = false; textDepth += 1; }
    if (operator.op === "ET") { textDepth -= 1; if (textDepth < 0) textValid = false; }
    if (textStateOperators.has(operator.op) && textDepth !== 1) textValid = false;
    if (["BDC", "BMC", "EMC"].includes(operator.op)) marked = true;
    if (["BI", "ID", "EI"].includes(operator.op)) inlineImage = true;
  }
  const conditions = {
    qWrapper: graphicsValid && graphicsDepth === 0 && ops[0]?.op === "q" && ops.at(-1)?.op === "Q",
    pathClosed: !pathOpen,
    textBalanced: textValid && textDepth === 0,
    depthOne: !marked,
    noInlineImage: !inlineImage,
  };
  return { allowed: Object.values(conditions).every(Boolean), conditions };
}

function classifyPage(ops, visibility) {
  const blocks = [];
  let active = null;
  let pathOpen = false;
  let textDepth = 0;
  let clippingPending = false;
  for (const operator of ops) {
    if (["BDC", "BMC"].includes(operator.op)) {
      if (active) return { allowed: false, reason: "nested-marked-content", blocks };
      const property = decodeName(operator.args[1]?.raw?.slice(1));
      active = {
        isOptionalContent: operator.op === "BDC" && decodeName(operator.args[0]?.raw) === "/OC",
        property,
        body: [],
        entryPathEmpty: !pathOpen && !clippingPending && textDepth === 0,
      };
    } else if (operator.op === "EMC") {
      if (!active) return { allowed: false, reason: "unbalanced-marked-content", blocks };
      if (active.isOptionalContent) {
        if (!Object.hasOwn(visibility, active.property)) return { allowed: false, reason: "unknown-visibility", blocks };
        if (!visibility[active.property]) {
          const block = classifyOff(active.body);
          block.conditions.entryPathEmpty = active.entryPathEmpty;
          block.allowed = Object.values(block.conditions).every(Boolean);
          blocks.push(block);
        }
      }
      active = null;
    } else if (active) active.body.push(operator);
    if (pathBuildingOperators.has(operator.op)) pathOpen = true;
    if (["W", "W*"].includes(operator.op)) clippingPending = true;
    if (pathEndingOperators.has(operator.op)) { pathOpen = false; clippingPending = false; }
    if (operator.op === "BT") textDepth += 1;
    if (operator.op === "ET") textDepth -= 1;
  }
  return { allowed: !active && blocks.every((block) => block.allowed), blocks };
}

async function classifyMarkedContent(bytes) {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const preflight = prepare(document);
  const pages = [];
  for (const page of document.getPages()) {
    const properties = page.node.Resources().lookupMaybe(key("Properties"), PDFDict);
    const visibility = {};
    for (const [property, reference] of properties?.entries() ?? []) visibility[property.decodeText()] = preflight.visible(reference);
    pages.push(classifyPage(operators(pageContent(page)), visibility));
  }
  return { allowed: pages.every((page) => page.allowed), pages };
}

async function candidate(bytes) {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const optionalContent = lookup(document, document.catalog, "OCProperties");
  if (optionalContent) {
    if (!(optionalContent instanceof PDFDict)) return { allowed: false, reason: "bad-OCProperties" };
    const registry = lookup(document, optionalContent, "OCGs");
    const registered = new Set();
    if (!(registry instanceof PDFArray) || !registry.size()) return { allowed: false, reason: "empty-or-bad-registry" };
    for (const reference of registry.asArray()) {
      const object = document.context.lookup(reference);
      if (!(reference instanceof PDFRef) || !(object instanceof PDFDict) || lookup(document, object, "Type")?.toString() !== "/OCG") return { allowed: false, reason: "registry-member-not-OCG-ref" };
      registered.add(reference.toString());
    }
    const configuration = lookup(document, optionalContent, "D");
    if (!(configuration instanceof PDFDict)) return { allowed: false, reason: "missing-default-config" };
    for (const name of ["ON", "OFF"]) if (hasRaw(configuration, name)) {
      const array = lookup(document, configuration, name);
      if (!(array instanceof PDFArray) || array.asArray().some((reference) => !(reference instanceof PDFRef) || !registered.has(reference.toString()))) return { allowed: false, reason: "ON-OFF-outside-registry-or-bad-array" };
    }
    const seen = new Set();
    let reason;
    function walk(value) {
      const object = document.context.lookup(value);
      if (!object || seen.has(object)) return;
      seen.add(object);
      if (object instanceof PDFRawStream) { walk(object.dict); return; }
      if (object instanceof PDFArray) { object.asArray().forEach(walk); return; }
      if (!(object instanceof PDFDict)) return;
      if (lookup(document, object, "Type")?.toString() === "/OCMD") {
        const policy = hasRaw(object, "P") ? lookup(document, object, "P")?.toString() : "/AnyOn";
        if (!["/AnyOn", "/AllOn", "/AnyOff", "/AllOff"].includes(policy)) reason ??= "invalid-policy";
        const rawMembers = object.get(key("OCGs"));
        if (rawMembers instanceof PDFArray) {
          if (!rawMembers.size() || rawMembers.asArray().some((reference) => !(reference instanceof PDFRef) || !registered.has(reference.toString()))) reason ??= "empty-or-non-OCG-members";
        } else if (rawMembers instanceof PDFRef && registered.has(rawMembers.toString())) {
          if (!["/AnyOn", "/AllOn"].includes(policy)) reason ??= "single-ref-negative-policy";
        } else reason ??= "indirect-array-or-unsupported-membership";
      }
      for (const [, entry] of object.entries()) walk(entry);
    }
    walk(document.catalog);
    for (const [, object] of document.context.enumerateIndirectObjects()) walk(object);
    if (reason) return { allowed: false, reason };
  }
  try { return await classifyMarkedContent(bytes); }
  catch (error) { return { allowed: false, reason: error.message }; }
}

async function literal(bytes) {
  try {
    const prior = await candidate(bytes);
    if (!prior.allowed) return prior;
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    const get = (dictionary, name) => lookup(document, dictionary, name);
    const typeName = (object) => object?.decodeText?.();
    const owners = new Set();
    const pageStreams = new Set();
    const characterProcedures = new Set();
    const forbiddenRoots = [];
    const witness = [];
    const preflight = prepare(document);
    for (const page of document.getPages()) {
      const resources = page.node.Resources();
      const xobjects = get(resources, "XObject");
      const properties = get(resources, "Properties");
      const rawContents = get(page.node, "Contents");
      for (const stream of rawContents instanceof PDFArray ? rawContents.asArray() : rawContents ? [rawContents] : []) pageStreams.add(document.context.lookup(stream));
      if (xobjects instanceof PDFDict) for (const [, value] of xobjects.entries()) {
        const xobject = document.context.lookup(value);
        if (xobject instanceof PDFRawStream && ["Form", "Image"].includes(typeName(get(xobject.dict, "Subtype")))) owners.add(xobject.dict);
      }
      for (const [resourceKey, value] of resources.entries()) if (!["XObject", "Properties"].includes(resourceKey.decodeText())) forbiddenRoots.push({ value, where: `page.Resources.${resourceKey.decodeText()}` });
      const annotations = get(page.node, "Annots");
      if (annotations) forbiddenRoots.push({ value: annotations, where: "page.Annots" });
      if (xobjects instanceof PDFDict) for (const [xobjectKey, value] of xobjects.entries()) {
        const xobject = document.context.lookup(value);
        if (xobject instanceof PDFRawStream) for (const [dictionaryKey, entry] of xobject.dict.entries()) if (!["OC", "Length", "Filter", "DecodeParms"].includes(dictionaryKey.decodeText())) forbiddenRoots.push({ value: entry, where: `page.XObject.${xobjectKey.decodeText()}.${dictionaryKey.decodeText()}` });
      }
      let textDepth = 0;
      let off = false;
      let pendingClip = false;
      for (const operator of operators(pageContent(page))) {
        if (operator.op === "BDC" && decodeName(operator.args[0]?.raw) === "/OC") {
          off = !preflight.visible(properties.get(key(decodeName(operator.args[1]?.raw).slice(1))));
          pendingClip = false;
        }
        if (off) {
          if (["W", "W*"].includes(operator.op)) pendingClip = true;
          else if (pathEndingOperators.has(operator.op)) pendingClip = false;
        }
        if (operator.op === "EMC") { if (off && pendingClip) witness.push("v12-7:pending-clipping-at-exit"); off = false; }
        if (operator.op === "BT") textDepth += 1;
        if (operator.op === "ET") textDepth -= 1;
        if (operator.op === "Do" && textDepth !== 0) {
          const xobject = get(xobjects, decodeName(operator.args[0]?.raw)?.slice(1));
          if (xobject instanceof PDFRawStream && hasRaw(xobject.dict, "OC") && !preflight.visible(xobject.dict.get(key("OC")))) witness.push("v12-8:OFF-Do-in-text");
        }
      }
    }
    const all = [];
    const seen = new Set();
    function collect(value) {
      const object = document.context.lookup(value);
      if (!object || seen.has(object)) return;
      seen.add(object);
      all.push(object);
      if (object instanceof PDFRawStream) { collect(object.dict); return; }
      if (object instanceof PDFArray) { object.asArray().forEach(collect); return; }
      if (object instanceof PDFDict) {
        const procedures = get(object, "CharProcs");
        if (procedures instanceof PDFDict) for (const [, entry] of procedures.entries()) characterProcedures.add(document.context.lookup(entry));
        for (const [, entry] of object.entries()) collect(entry);
      }
    }
    collect(document.catalog);
    for (const [, object] of document.context.enumerateIndirectObjects()) collect(object);
    const containsOptionalContent = (stream) => operators(Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1")).some((operator) => operator.op === "BDC" && decodeName(operator.args[0]?.raw) === "/OC");
    for (const object of all) {
      if (object instanceof PDFDict) {
        if (!get(document.catalog, "OCProperties") && ["OCG", "OCMD"].includes(typeName(get(object, "Type")))) witness.push("v12:OC-object-without-catalog");
        if (hasRaw(object, "OC") && !owners.has(object)) witness.push("v12:OC-outside-page-direct-XObject");
      }
      if (object instanceof PDFRawStream && !pageStreams.has(object) && (typeName(get(object.dict, "Subtype")) === "Form" || typeName(get(object.dict, "Type")) === "Pattern" || characterProcedures.has(object)) && containsOptionalContent(object)) witness.push("v12:non-page-content-OC");
    }
    for (const root of forbiddenRoots) {
      const visited = new Set();
      function walk(value) {
        const object = document.context.lookup(value);
        if (!object || visited.has(object)) return;
        visited.add(object);
        if (object instanceof PDFRawStream) {
          walk(object.dict);
          if ((typeName(get(object.dict, "Subtype")) === "Form" || typeName(get(object.dict, "Type")) === "Pattern" || characterProcedures.has(object)) && containsOptionalContent(object)) witness.push(`v12:${root.where}:content-OC`);
          return;
        }
        if (object instanceof PDFArray) { object.asArray().forEach(walk); return; }
        if (!(object instanceof PDFDict)) return;
        if (hasRaw(object, "OC")) witness.push(`v12:${root.where}:OC`);
        for (const [entryKey, entry] of object.entries()) if (entryKey.decodeText() !== "Parent" && !(entryKey.decodeText() === "P" && typeName(get(object, "Type")) === "Annot")) walk(entry);
      }
      walk(root.value);
    }
    return witness.length ? { allowed: false, reason: witness[0], witness: [...new Set(witness)] } : prior;
  } catch (error) {
    return { allowed: false, reason: error.message };
  }
}

async function type3Graph(bytes) {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const witness = [];
  let visitedObjects = 0;
  for (const [index, page] of document.getPages().entries()) {
    const seen = new Set();
    const stack = [{ value: page.node.Resources(), path: `page[${index}].Resources` }];
    while (stack.length) {
      const current = stack.pop();
      const object = document.context.lookup(current.value);
      if (!object || seen.has(object)) continue;
      seen.add(object);
      visitedObjects += 1;
      if (object instanceof PDFRawStream) { stack.push({ value: object.dict, path: `${current.path}.streamDict` }); continue; }
      if (object instanceof PDFArray) { object.asArray().forEach((value, childIndex) => stack.push({ value, path: `${current.path}[${childIndex}]` })); continue; }
      if (!(object instanceof PDFDict)) continue;
      if (lookup(document, object, "Subtype")?.decodeText?.() === "Type3") witness.push(current.path);
      for (const [entryKey, value] of object.entries()) stack.push({ value, path: `${current.path}.${entryKey.decodeText()}` });
    }
  }
  return { found: witness.length > 0, witness, visitedObjects };
}

export async function classifyOcgPreflight(bytes) {
  try {
    const type3 = await type3Graph(bytes);
    const v12 = await literal(bytes);
    return { allowed: v12.allowed && !type3.found, reason: type3.found ? "v13:reachable-Type3" : v12.reason ?? "allow", type3, v12 };
  } catch (error) {
    return { allowed: false, reason: `preflight-error:${error.message}` };
  }
}
