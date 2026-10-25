import hashlib
import io
import json
import re
import zipfile
import xml.etree.ElementTree as ET


W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
LANGUAGE = "ko"


def _l(korean, english):
    return english if LANGUAGE == "en" else korean


def _word_attribute(element, name, default=None):
    return element.attrib.get(W + name, default) if element is not None else default


def _to_roman(value):
    if value <= 0:
        return str(value)
    result = []
    for number, symbol in (
        (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
        (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
        (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
    ):
        while value >= number:
            result.append(symbol)
            value -= number
    return "".join(result)


def _alphabetic_number(value, alphabet):
    if value <= 0:
        return str(value)
    result = []
    base = len(alphabet)
    while value:
        value -= 1
        result.append(alphabet[value % base])
        value //= base
    return "".join(reversed(result))


def _format_list_number(value, number_format):
    if number_format == "decimalZero":
        return f"{value:02d}"
    if number_format == "upperRoman":
        return _to_roman(value)
    if number_format == "lowerRoman":
        return _to_roman(value).lower()
    if number_format == "upperLetter":
        return _alphabetic_number(value, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    if number_format == "lowerLetter":
        return _alphabetic_number(value, "abcdefghijklmnopqrstuvwxyz")
    if number_format in ("ganada", "koreanDigital"):
        return _alphabetic_number(value, "가나다라마바사아자차카타파하")
    if number_format == "chosung":
        return _alphabetic_number(value, "ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ")
    if number_format == "decimalEnclosedCircle":
        if value == 0:
            return "⓪"
        if 1 <= value <= 20:
            return chr(0x2460 + value - 1)
        return f"({value})"
    return str(value)


class _NumberingResolver:
    """Resolve Word's calculated list labels without modifying the source text."""

    def __init__(self, archive=None):
        self.abstract_levels = {}
        self.numbers = {}
        self.styles = {}
        self.counters = {}
        self.unresolved = 0
        if archive is not None:
            self._read(archive)

    def _read(self, archive):
        if "word/numbering.xml" in archive.namelist():
            root = ET.fromstring(archive.read("word/numbering.xml"))
            for abstract in root.findall(W + "abstractNum"):
                abstract_id = _word_attribute(abstract, "abstractNumId")
                if abstract_id is None:
                    continue
                self.abstract_levels[abstract_id] = {
                    _word_attribute(level, "ilvl", "0"): level
                    for level in abstract.findall(W + "lvl")
                }
            for number in root.findall(W + "num"):
                number_id = _word_attribute(number, "numId")
                abstract_id = _word_attribute(number.find(W + "abstractNumId"), "val")
                if number_id is None or abstract_id is None:
                    continue
                overrides = {
                    _word_attribute(override, "ilvl", "0"): override
                    for override in number.findall(W + "lvlOverride")
                }
                self.numbers[number_id] = (abstract_id, overrides)

        if "word/styles.xml" in archive.namelist():
            root = ET.fromstring(archive.read("word/styles.xml"))
            for style in root.findall(W + "style"):
                style_id = _word_attribute(style, "styleId")
                if not style_id:
                    continue
                paragraph_properties = style.find(W + "pPr")
                numbering = paragraph_properties.find(W + "numPr") if paragraph_properties is not None else None
                number_id = _word_attribute(numbering.find(W + "numId"), "val") if numbering is not None else None
                level = _word_attribute(numbering.find(W + "ilvl"), "val") if numbering is not None else None
                based_on = _word_attribute(style.find(W + "basedOn"), "val")
                self.styles[style_id] = (number_id, level, based_on)

    def fresh(self):
        resolver = _NumberingResolver()
        resolver.abstract_levels = self.abstract_levels
        resolver.numbers = self.numbers
        resolver.styles = self.styles
        return resolver

    def _style_numbering(self, style_id, visited=None):
        if not style_id or style_id not in self.styles:
            return None, None
        visited = visited or set()
        if style_id in visited:
            return None, None
        visited.add(style_id)
        number_id, level, based_on = self.styles[style_id]
        inherited_number, inherited_level = self._style_numbering(based_on, visited)
        return number_id or inherited_number, level if level is not None else inherited_level

    def _paragraph_numbering(self, paragraph):
        paragraph_properties = paragraph.find(W + "pPr")
        if paragraph_properties is None:
            return None
        style = paragraph_properties.find(W + "pStyle")
        style_number, style_level = self._style_numbering(_word_attribute(style, "val"))
        numbering = paragraph_properties.find(W + "numPr")
        number_id = _word_attribute(numbering.find(W + "numId"), "val") if numbering is not None else None
        level = _word_attribute(numbering.find(W + "ilvl"), "val") if numbering is not None else None
        number_id = number_id if number_id is not None else style_number
        level = level if level is not None else style_level
        if number_id in (None, "0"):
            return None
        try:
            return number_id, int(level or 0)
        except ValueError:
            return None

    def _level(self, number_id, level_index):
        number = self.numbers.get(str(number_id))
        if number is None:
            return None, None
        abstract_id, overrides = number
        override = overrides.get(str(level_index))
        override_level = override.find(W + "lvl") if override is not None else None
        level = override_level or self.abstract_levels.get(abstract_id, {}).get(str(level_index))
        return level, override

    def _start(self, number_id, level_index):
        level, override = self._level(number_id, level_index)
        start_override = override.find(W + "startOverride") if override is not None else None
        raw = _word_attribute(start_override, "val") or _word_attribute(level.find(W + "start"), "val", "1") if level is not None else "1"
        try:
            return int(raw)
        except (TypeError, ValueError):
            return 1

    def label(self, paragraph):
        numbering = self._paragraph_numbering(paragraph)
        if numbering is None:
            return ""
        number_id, level_index = numbering
        level, _ = self._level(number_id, level_index)
        if level is None:
            self.unresolved += 1
            return ""

        counters = self.counters.setdefault(str(number_id), {})
        for parent_level in range(level_index):
            counters.setdefault(parent_level, self._start(number_id, parent_level))
        counters[level_index] = counters.get(level_index, self._start(number_id, level_index) - 1) + 1
        for deeper_level in list(counters):
            if deeper_level > level_index:
                counters.pop(deeper_level, None)

        pattern = _word_attribute(level.find(W + "lvlText"), "val", "")
        legal = level.find(W + "isLgl") is not None
        for referenced_level in range(9, 0, -1):
            placeholder = f"%{referenced_level}"
            if placeholder not in pattern:
                continue
            value_index = referenced_level - 1
            value = counters.get(value_index, self._start(number_id, value_index))
            referenced, _ = self._level(number_id, value_index)
            number_format = "decimal" if legal else _word_attribute(
                referenced.find(W + "numFmt") if referenced is not None else None,
                "val",
                "decimal",
            )
            pattern = pattern.replace(placeholder, _format_list_number(value, number_format))
        return pattern


# Text the accepted view does not show: existing deletions, and property elements (a tab stop
# in paragraph properties is also a w:tab).
TEXT_SKIPPED_TAGS = {W + "del", W + "moveFrom", W + "pPr", W + "rPr", W + "sectPr", W + "tblPr", W + "trPr", W + "tcPr"}


def _text(node):
    parts = []
    stack = [node]
    while stack:
        item = stack.pop()
        if item.tag in TEXT_SKIPPED_TAGS:
            continue
        if item.tag == W + "t":
            parts.append(item.text or "")
        elif item.tag == W + "tab":
            parts.append("\t")
        elif item.tag in (W + "br", W + "cr"):
            parts.append("\n")
        else:
            stack.extend(reversed(list(item)))
    return "".join(parts)


def _run_style(run):
    props = run.find(W + "rPr")
    if props is None:
        return ""
    values = []
    for name in ("b", "i", "u", "strike"):
        item = props.find(W + name)
        if item is not None:
            values.append(name + ":" + item.attrib.get(W + "val", "1"))
    for name in ("color", "highlight", "sz", "rFonts"):
        item = props.find(W + name)
        if item is not None:
            values.append(name + ":" + json.dumps(item.attrib, sort_keys=True))
    return "|".join(values)


def _normalized_property_fact(tree, property_name, policy):
    """Normalize one source snapshot; never compare documents or choose edits."""
    return _normalized_property_node(_PropertyTreeNode(tree) if tree else None, property_name, policy)


class _PropertyTreeNode:
    """Element-like view over a property_tree dict so both inputs share one normalizer."""
    __slots__ = ("tag", "attrib", "text", "_children")
    def __init__(self, tree):
        self.tag, self.attrib, self.text, self._children = tree["name"], tree["attributes"], tree["text"], tree["children"]
    def __iter__(self):
        return (_PropertyTreeNode(child) for child in self._children)


_POLICY_SETS = {}


def _policy_sets(policy):
    cached = _POLICY_SETS.get(id(policy))
    if cached is None or cached[0] is not policy:
        enabled = policy.get("enabled", {})
        cached = (policy, set(policy.get("toggles", [])), set(policy.get("noiseAttributes", [])), {W + name + "Change" for name in enabled}, enabled)
        _POLICY_SETS[id(policy)] = cached
    return cached[1:]


_FACT_MEMO = {"facts": None}


def _element_key(node):
    return (node.tag, tuple(node.attrib.items()), node.text, tuple(_element_key(child) for child in node))


def _normalized_property_node(node, property_name, policy):
    """`_normalized_property_fact` over an XML element (or None), memoized per distinct element
    within one extraction (runs and paragraphs repeat the same few property sets)."""
    memo = _FACT_MEMO["facts"]
    if memo is None or node is None or not isinstance(node, ET.Element):
        return _normalized_property_node_uncached(node, property_name, policy)
    key = (id(policy), property_name, _element_key(node))
    fact = memo.get(key)
    if fact is None:
        fact = memo[key] = _normalized_property_node_uncached(node, property_name, policy)
    return fact


def _normalized_property_node_uncached(node, property_name, policy):
    """`_normalized_property_fact` over an XML element (or None), without building a snapshot tree."""
    supported, unsupported = {}, {}
    history = False
    toggles, noise_attributes, change_names, enabled = _policy_sets(policy)
    if node is None:
        return {"supported": supported, "unsupported": unsupported, "history": history}
    for name, value in node.attrib.items():
        if name not in noise_attributes:
            unsupported["@" + name] = [json.dumps(value, ensure_ascii=False)]
    def canonical(item):
        attributes = sorted((name, value) for name, value in item.attrib.items() if name not in noise_attributes)
        local = item.tag[len(W):] if item.tag.startswith(W) else item.tag
        if item.tag.startswith(W) and local in toggles:
            value = item.attrib.get(W + "val", "true").lower()
            if value in {"false", "off", "0"}:
                return None
            return [item.tag, [(name, value) for name, value in attributes if name != W + "val"], "on", [canonical(child) for child in item]]
        children = [canonical(child) for child in item if child.tag not in change_names]
        text = item.text or ""
        return [item.tag, attributes, text if text.strip() else "", children]
    enabled_here = enabled.get(property_name, [])
    for child in node:
        if child.tag == W + property_name + "Change":
            history = True
            continue
        if property_name=="sectPr" and child.tag in {W+"headerReference",W+"footerReference"} or property_name=="pPr" and child.tag==W+"sectPr":continue
        value = canonical(child)
        child_text = child.text or ""
        grid_leaf = property_name!='tblGrid' or child.tag!=W+'gridCol' or (not len(list(child)) and not child_text.strip() and set(child.attrib)-noise_attributes <= {W+'w'} and (W+'w' not in child.attrib or re.fullmatch(r'(?:[+]?[0-9]+|[0-9]+(?:\.[0-9]+)?(?:mm|cm|in|pt|pc|pi))',child.attrib[W+'w'])))
        if property_name=='tblGrid' and grid_leaf and value is not None:
            value[1]=[(name,str(int(v)) if name==W+'w' and re.fullmatch(r'[+]?[0-9]+',v) else v) for name,v in value[1]]
        if value is None:
            continue
        local = child.tag[len(W):] if child.tag.startswith(W) else child.tag
        target = supported if child.tag.startswith(W) and local in enabled_here and grid_leaf else unsupported
        target.setdefault(child.tag, []).append(_COMPACT_JSON.encode(value))
    return {"supported": supported, "unsupported": unsupported, "history": history}


def _simple_vml_picture(node, archive=None, part=None):
    """Bounded inline image shape (no controls, OLE, textbox or nested graph)."""
    v='{urn:schemas-microsoft-com:vml}';o='{urn:schemas-microsoft-com:office:office}'
    r='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
    if node.tag!=W+'pict' or node.attrib or [n.tag for n in node]!=[v+'shapetype',v+'shape']:return False
    definition,shape=list(node);type_id=definition.get('id','');shape_id=shape.get('id','')
    if not all(re.fullmatch(r'[A-Za-z_][A-Za-z0-9_.-]*',value) for value in (type_id,shape_id)) or type_id==shape_id:return False
    if definition.attrib!={'id':type_id,'coordsize':'21600,21600',o+'spt':'75','path':'m0,0l21600,0,21600,21600,0,21600xe'} or len(definition):return False
    if set(shape.attrib)!={'id','type','style'} or shape.get('type')!='#'+type_id or [n.tag for n in shape]!=[v+'imagedata']:return False
    styles={}
    for declaration in shape.get('style','').strip().strip(';').split(';'):
        pair=declaration.split(':')
        if len(pair)!=2:return False
        key,value=(p.strip() for p in pair)
        if key in styles or key not in {'width','height'} or not re.fullmatch(r'(?:[0-9]+(?:\.[0-9]+)?)pt',value) or not 0<float(value[:-2])<10000:return False
        styles[key]=value
    if set(styles)!={'width','height'}:return False
    image=shape[0]
    if len(image) or set(image.attrib)-{r+'id',o+'title'} or not image.get(r+'id'):return False
    if any((n.text or '').strip() or (n.tail or '').strip() for n in node.iter()):return False
    if archive is None:return True
    import posixpath
    rel_path=posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels')
    if rel_path not in archive.namelist() or '[Content_Types].xml' not in archive.namelist():return False
    relationships=[n for n in ET.fromstring(archive.read(rel_path)) if n.get('Id')==image.get(r+'id')]
    if len(relationships)!=1:return False
    rel=relationships[0];target=rel.get('Target','')
    if rel.get('Type')!=r[1:-1]+'/image' or rel.get('TargetMode','') not in ('','Internal') or not target or any(c in target for c in "\\:#?%"):return False
    path=target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(part),target))
    if path.startswith('../') or archive.namelist().count(path)!=1 or posixpath.join(posixpath.dirname(path),'_rels',posixpath.basename(path)+'.rels') in archive.namelist():return False
    ct='{http://schemas.openxmlformats.org/package/2006/content-types}';types=ET.fromstring(archive.read('[Content_Types].xml'))
    overrides=[n.get('ContentType') for n in types if n.tag==ct+'Override' and n.get('PartName')=='/'+path]
    defaults=[n.get('ContentType') for n in types if n.tag==ct+'Default' and n.get('Extension','').lower()==posixpath.splitext(path)[1].lstrip('.').lower()]
    if (overrides or defaults)!=['image/png']:return False
    data=archive.read(path)
    if len(data)<24 or data[:8]!=b'\x89PNG\r\n\x1a\n' or data[12:16]!=b'IHDR' or int.from_bytes(data[16:20],'big')==0 or int.from_bytes(data[20:24],'big')==0:return False
    root=ET.fromstring(archive.read(part));ids=[n.get('id') for n in root.iter() if n.tag in {v+'shape',v+'shapetype'}]
    pictures=[p for p in root.iter(W+'pict') if any(n.tag==v+'shape' and n.get('id')==shape_id for n in p)]
    if len(pictures)!=1:return False
    parents={child:parent for parent in root.iter() for child in parent};run=parents.get(pictures[0]);paragraph=parents.get(run)
    return ids.count(type_id)==ids.count(shape_id)==1 and run is not None and run.tag==W+'r' and paragraph is not None and paragraph.tag==W+'p'


def _stable_named_bookmark_context(root, part):
    """Source-only shape check; correspondence is owned by existing decisions."""
    if part!='word/document.xml':return None
    starts=list(root.iter(W+'bookmarkStart'));ends=list(root.iter(W+'bookmarkEnd'))
    links=[n for n in root.iter(W+'hyperlink') if n.get(W+'anchor') is not None]
    if len(starts)!=1 or len(ends)!=1 or len(links)!=1:return None
    start,end,link=starts[0],ends[0],links[0];name=start.get(W+'name','');ident=start.get(W+'id','')
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,39}',name) or not re.fullmatch(r'[0-9]+',ident):return None
    if start.attrib!={W+'id':ident,W+'name':name} or end.attrib!={W+'id':ident} or len(start) or len(end):return None
    if link.attrib!={W+'anchor':name}:return None
    parents={child:parent for parent in root.iter() for child in parent};body=root.find(W+'body');host=parents.get(start);jump=parents.get(link)
    if host is None or jump is None or host is jump or parents.get(host) is not body or parents.get(jump) is not body:return None
    if any((n.text or '').strip() or (n.tail or '').strip() for n in (start,end,host,jump,link)):return None
    if host.attrib or jump.attrib or not len(host) or host[0] is not start or host[-1] is not end or list(jump)!=[link]:return None
    def plain_runs(nodes):
        return bool(nodes) and all(n.tag==W+'r' and not n.attrib and not (n.text or '').strip() and not (n.tail or '').strip() and len(n)>0 and all(t.tag==W+'t' and not len(t) and not (t.tail or '').strip() and not set(t.attrib)-{'{http://www.w3.org/XML/1998/namespace}space'} and t.get('{http://www.w3.org/XML/1998/namespace}space','default') in ('default','preserve') for t in n) for n in nodes)
    if not plain_runs(list(host)[1:-1]) or not plain_runs(list(link)) or not _text(host).strip() or not _text(link).strip():return None
    return {'name':name,'host':host,'jump':jump,'link':link,'start':start,'end':end}


# Property elements are facts of the paragraph, run, table, row, cell or style that owns them
# (normalizedProperties), not sources of their own. A section break inside a paragraph's
# properties is a source.
PROPERTY_CONTAINER_TAGS = {W + name for name in ("pPr", "rPr", "tblPr", "trPr", "tcPr", "tblGrid", "tblPrEx")}


_SOURCE_FACTS = {"cache": None}
_PARSED_PARTS = {"parts": None}


def _parsed_part(archive, part):
    """(root, source map) of `part` from this extraction's inventory pass, parsing it only when
    the inventory did not cover it."""
    parsed = _PARSED_PARTS["parts"]
    if parsed is not None and part in parsed:
        return parsed[part]
    root = ET.fromstring(archive.read(part))
    return root, _source_paths(root, part, archive)
_COMPACT_JSON = json.JSONEncoder(ensure_ascii=False, separators=(",", ":"))


def _source_paths(root, part, archive=None):
    result = {}
    offsets = {}
    invalid_qname = False
    rewrite = None
    normalized_root = root
    if archive is not None and "_qname_safe_parse" in globals():
        data = archive.read(part)
        try:
            # Namespace-normalized attribute values for event identities: rewritten in place when
            # every declaration is on the root, else from a namespace-aware parse.
            rewrite = _qname_rewriter(data, root) if "_qname_rewriter" in globals() else None
            if rewrite is None:
                normalized_root = _qname_safe_parse(data, False)
        except ValueError:
            normalized_root = root; invalid_qname = True; rewrite = None
    policy = json.loads(globals().get("WORKLAZY_FORMATTING_POLICY_JSON", "{}"))
    def property_tree(node):
        if node is None:
            return None
        return {"name": node.tag, "attributes": dict(node.attrib), "text": node.text or "", "children": [property_tree(child) for child in node]}
    def visit(node, path, paragraph=None):
        if node.tag in PROPERTY_CONTAINER_TAGS:
            for index, child in enumerate(node):
                if child.tag == W + "sectPr":
                    visit(child, path + [index], paragraph)
            return
        reference = {"part": part, "path": path, "kind": node.tag.rsplit("}", 1)[-1]}
        property_names = {"p": ("pPr",), "r": ("rPr",), "tbl": ("tblPr", "tblGrid"), "tr": ("trPr",), "tc": ("tcPr",), "body": ("sectPr",), "style": ("pPr", "rPr")}.get(reference["kind"], ())
        facts = _SOURCE_FACTS["cache"]
        fact_key = (part, tuple(path))
        cached = facts.get(fact_key) if facts is not None else None
        if cached is not None:
            reference["normalizedProperties"] = cached
        elif node.tag==W+"sectPr":
            reference["normalizedProperties"]={"sectPr":_normalized_property_node(node,"sectPr",policy)}
        if property_names:
            # Raw snapshots are consumed only for table grids; every other property ships its normalized fact.
            if reference["kind"] == "tbl":
                reference["propertySnapshots"] = {"tblGrid": property_tree(node.find(W + "tblGrid"))}
            if cached is None:
                reference["normalizedProperties"] = {name: _normalized_property_node(node.find(W + name), name, policy) for name in property_names}
        if facts is not None and cached is None and "normalizedProperties" in reference:
            facts[fact_key] = reference["normalizedProperties"]
        if node.tag == W + "style":
            reference["attributes"] = dict(node.attrib)
            name = node.find(W + "name")
            reference["label"] = name.get(W + "val", "") if name is not None else ""
        if node.tag == W + "p":
            paragraph = path
            offsets[tuple(path)] = 0
        if node.tag == W + "r" and paragraph is not None:
            start = offsets[tuple(paragraph)]
            offsets[tuple(paragraph)] += len(_text(node))
            reference["paragraphPath"] = paragraph
            reference["textRange"] = [start, offsets[tuple(paragraph)]]
        if node.tag == W + "p":
            reference["rawText"] = _text(node)
            opaque = [item for item in node.iter() if item.tag in {W + "drawing", W + "pict", W + "object", W + "hyperlink", W + "fldChar", W + "fldSimple", W + "instrText", W + "footnoteReference", W + "endnoteReference"}]
            if opaque:
                def canonical(item):
                    if item.tag in {W + "hyperlink", W + "fldSimple"}:
                        return (item.tag, sorted(item.attrib.items()), _text(item))
                    return (item.tag, sorted(item.attrib.items()), item.text or "", [canonical(child) for child in item])
                payload = json.dumps([canonical(item) for item in opaque], ensure_ascii=False).encode("utf-8")
                if archive is not None:
                    import posixpath
                    relationship_path = posixpath.join(posixpath.dirname(part), "_rels", posixpath.basename(part) + ".rels")
                    if relationship_path in archive.namelist():
                        relationship_root = ET.fromstring(archive.read(relationship_path))
                        relationships = {item.get("Id"): item for item in relationship_root}
                        for item in opaque:
                            for descendant in item.iter():
                                for attribute, value in descendant.attrib.items():
                                    if attribute.startswith("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}") and value in relationships:
                                        relationship = relationships[value]
                                        payload += json.dumps(canonical(relationship), ensure_ascii=False).encode("utf-8")
                                        if relationship.get("TargetMode") != "External":
                                            target = relationship.get("Target", "")
                                            target_path = target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join(posixpath.dirname(part), target))
                                            if target_path in archive.namelist():
                                                payload += archive.read(target_path)
                reference["opaqueSignature"] = hashlib.sha256(payload).hexdigest()
                property_runs = [(character, canonical(run.find(W + "rPr")) if run.find(W + "rPr") is not None else None) for run in node.iter(W + "r") for character in _text(run)]
                properties = node.find(W + "pPr")
                copy_payload = (canonical(properties) if properties is not None else None, property_runs)
                reference["copySignature"] = hashlib.sha256(json.dumps(copy_payload, ensure_ascii=False).encode("utf-8")).hexdigest()
        result[id(node)] = reference
        for index, child in enumerate(node):
            visit(child, path + [index], paragraph)
    visit(root, [])
    # XML positions and relationship identities are extraction facts, not pairs.
    def event_identity(node):
        import posixpath
        relationship_base="http://schemas.openxmlformats.org/officeDocument/2006/relationships/"
        rels = {}
        if archive is not None:
            rel_path = posixpath.join(posixpath.dirname(part), "_rels", posixpath.basename(part) + ".rels")
            if rel_path in archive.namelist(): rels = {item.get("Id"): item for item in ET.fromstring(archive.read(rel_path))}
        def leaf_hyperlink(destination):
            if not destination or any(c in destination for c in "\\:#?%") or archive is None:return None
            path=destination.lstrip('/') if destination.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(part),destination))
            if path.startswith('../') or archive.namelist().count(path)!=1:return None
            if posixpath.join(posixpath.dirname(path),'_rels',posixpath.basename(path)+'.rels') in archive.namelist():return None
            if '[Content_Types].xml' not in archive.namelist():return None
            types=ET.fromstring(archive.read('[Content_Types].xml'));ct='{http://schemas.openxmlformats.org/package/2006/content-types}'
            overrides=[n.get('ContentType') for n in types if n.tag==ct+'Override' and n.get('PartName')=='/'+path]
            defaults=[n.get('ContentType') for n in types if n.tag==ct+'Default' and n.get('Extension','').lower()==posixpath.splitext(path)[1].lstrip('.').lower()]
            if (overrides or defaults)!=['application/xml']:return None
            data=archive.read(path)
            try:root=ET.fromstring(data)
            except ET.ParseError:return None
            office=('http://schemas.openxmlformats.org/','urn:schemas-microsoft-com:','http://schemas.microsoft.com/office/')
            if any(n.tag.startswith(tuple('{'+uri for uri in office)) or any(a.startswith('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}') for a in n.attrib) for n in root.iter()):return None
            return data
        named_anchor=node.tag==W+"hyperlink" and node.get(W+"anchor") is not None
        named_context=_stable_named_bookmark_context(root,part) if named_anchor else None
        supported = (not named_anchor or named_context is not None and named_context["link"] is node) and (node.tag!=W+"pict" or _simple_vml_picture(node,archive,part))
        vml_picture=node.tag==W+"pict" and supported
        has_image = False
        target = node.get(W+"anchor","") if named_anchor else ""
        def canonical_event(item):
            nonlocal supported, target, has_image
            attrs = []
            for name, value in sorted(item.attrib.items()):
                if rewrite is not None: value = rewrite(item, name, value)
                if item.tag == "{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}docPr" and name == "id": continue
                if name.startswith("xmlns:"):continue
                if vml_picture and item.tag in {"{urn:schemas-microsoft-com:vml}shape","{urn:schemas-microsoft-com:vml}shapetype"}:
                    if name=="id":continue
                    if name=="type":value="#picture-type"
                if name.startswith("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"):
                    relationship = rels.get(value)
                    if relationship is None: supported = False
                    else:
                        kind, mode, destination = relationship.get("Type", ""), relationship.get("TargetMode", ""), relationship.get("Target", "")
                        if item.tag==W+"hyperlink" and kind!=relationship_base+"hyperlink":supported=False
                        if item.tag in {"{http://schemas.openxmlformats.org/drawingml/2006/main}blip","{urn:schemas-microsoft-com:vml}imagedata"} and kind!=relationship_base+"image":supported=False
                        if kind==relationship_base+"image":has_image=True
                        if kind not in {relationship_base+"image",relationship_base+"hyperlink"}: supported = False
                        if mode == "External": value = json.dumps([kind, mode, destination]); target = destination
                        else:
                            path = destination.lstrip("/") if destination.startswith("/") else posixpath.normpath(posixpath.join(posixpath.dirname(part), destination))
                            if kind==relationship_base+"hyperlink":
                                unique=sum(1 for rel in ET.fromstring(archive.read(rel_path)) if rel.get('Id')==value)==1
                                data=leaf_hyperlink(destination) if mode in ('','Internal') and unique else None
                                if data is None:supported=False
                                else:value=json.dumps([kind,hashlib.sha256(data).hexdigest(),'application/xml'])
                            elif archive is None or path not in archive.namelist():supported=False
                            else:value=json.dumps([kind,hashlib.sha256(archive.read(path)).hexdigest()])
                attrs.append((name, value))
            return (item.tag, attrs) if item.tag == W + "hyperlink" else (item.tag, attrs, item.text or "", [canonical_event(child) for child in item])
        normalized = normalized_root
        for index in result[id(node)]["path"]: normalized = list(normalized)[index]
        value = canonical_event(normalized)
        if node.tag == W + "hyperlink" and (named_anchor and not supported or node.find('.//' + W + 'drawing') is not None or any(child.tag!=W+"r" for child in node)): supported = False
        if node.tag != W + "hyperlink" and not has_image:supported=False
        if node.tag!=W+'pict' and node.find('.//'+W+'pict') is not None:supported=False
        return hashlib.sha256(json.dumps(value, ensure_ascii=False).encode()).hexdigest(), supported, target
    for paragraph in root.iter(W + "p"):
        cursor = [0]; events = []
        def event_walk(node):
            if node is not paragraph and node.tag == W + "p": return
            # Positions count the text `_text` reads: no property elements or existing deletions.
            if node.tag in TEXT_SKIPPED_TAGS: return
            if node.tag in {W+"footnoteReference",W+"endnoteReference"}:
                kind="footnote" if node.tag==W+"footnoteReference" else "endnote"
                if archive is None or not any(owner['kind']==kind for owner in _note_part_owners(archive)[0]):return
                event={"kind":"note","start":cursor[0],"end":cursor[0],"signature":kind,"supported":True,"target":node.get(W+"id",""),"paragraphPath":result[id(paragraph)]["path"],"runPath":result[id(node)]["path"][:-1]}
                result[id(node)]["objectEvent"]=event;events.append(event);return
            if node.tag in {W + "drawing", W + "pict", W + "hyperlink", "{http://schemas.openxmlformats.org/markup-compatibility/2006}AlternateContent"}:
                start = cursor[0]
                if node.tag == W + "hyperlink":
                    for child in node: event_walk(child)
                signature, supported, target = event_identity(node)
                event = {"kind": "hyperlink" if node.tag == W + "hyperlink" else "drawing", "start": start, "end": cursor[0], "signature": signature, "supported": supported, "target": target, "paragraphPath": result[id(paragraph)]["path"], "runPath": result[id(node)]["path"][:-1]}
                result[id(node)]["objectEvent"] = event; events.append(event)
                return
            if node.tag == W + "t": cursor[0] += len(node.text or "")
            elif node.tag in {W + "tab", W + "br", W + "cr"}: cursor[0] += 1
            else:
                for child in node: event_walk(child)
        event_walk(paragraph)
        event_paths=[result[id(node)]["path"] for node in paragraph.iter() if "objectEvent" in result.get(id(node), ())]
        # A legal property-history snapshot on an image run is preserved with
        # that revised run. Content/revision wrappers remain unsupported.
        history_tags={W+name for name in policy.get("enabled",{}).get("rPr",[])+["rPr","lang","rStyle","szCs"]}
        run_histories={id(change) for run in paragraph.iter(W+"r") for change in run.findall(W+"rPr/"+W+"rPrChange") if len(change)==1 and change[0].tag==W+"rPr" and all(child.tag in history_tags and not (child.text or "").strip() and not (child.tail or "").strip() for child in change[0].iter())}
        unsupported = any(node.tag in {W + "object", W + "fldChar", W + "fldSimple", W + "instrText", W + "ins", W + "del", W + "moveFrom", W + "moveTo", W + "pPrChange", W + "sectPrChange"} or (node.tag in {W+"footnoteReference",W+"endnoteReference"} and "objectEvent" not in result[id(node)]) or (node.tag==W+"rPrChange" and id(node) not in run_histories) or (node.tag==W+"pict" and not any(result[id(node)]["path"][:len(path)]==path for path in event_paths)) for node in paragraph.iter())
        if invalid_qname: result[id(paragraph)]["unsupportedObjectQName"] = True
        if events: result[id(paragraph)]["objectEventsSupported"] = not unsupported and not invalid_qname and all(event["supported"] for event in events)
    def classify(instruction):
        command = instruction.strip().split(None, 1)[0].upper() if instruction.strip() else ""
        if command in {"PAGE", "NUMPAGES", "SECTIONPAGES"}: return "pagination"
        if command in {"DATE", "TIME", "CREATEDATE", "SAVEDATE", "PRINTDATE"}: return "automatic-date"
        if command in {"TOC", "TOA", "INDEX"}: return "table-of-contents"
        if command in {"REF", "PAGEREF", "SEQ", "LISTNUM"}: return "reference-numbering"
        if command in {"DOCPROPERTY", "DOCVARIABLE", "MERGEFIELD"}: return "value"
        return "other"
    def reference(node):
        return {"part": part, "path": result[id(node)]["path"]}
    stack = []
    for node in root.iter():
        if node.tag == W + "fldSimple":
            instruction = node.get(W + "instr", "")
            result[id(node)]["field"] = {"kind": classify(instruction), "instruction": instruction, "cachedText": _text(node), "sources": [reference(node)]}
        if node.tag == W + "fldChar":
            kind = node.get(W + "fldCharType")
            if kind == "begin": stack.append({"node": node, "instruction": "", "cachedText": "", "sources": [reference(node)], "separated": False})
            elif kind == "separate" and stack: stack[-1]["separated"] = True
            elif kind == "end" and stack:
                field = stack.pop()
                result[id(field["node"])]["field"] = {key: field[key] for key in ("instruction", "cachedText", "sources")}
                result[id(field["node"])]["field"]["kind"] = classify(field["instruction"])
        elif node.tag == W + "instrText" and stack and not stack[-1]["separated"]:
            stack[-1]["instruction"] += node.text or ""
            stack[-1]["sources"].append(reference(node))
        elif node.tag == W + "t":
            for field in stack:
                if field["separated"]: field["cachedText"] += node.text or ""
    for field in stack:
        result[id(field["node"])]["field"] = {**{key: field[key] for key in ("instruction", "cachedText", "sources")}, "kind": "incomplete"}
    return result


def _paragraph_record(paragraph, section, location, numbering=None):
    text = _text(paragraph)
    list_label = numbering.label(paragraph) if numbering is not None else ""
    formats = []
    pending_text = ""
    pending_style = None

    def flush():
        nonlocal pending_text, pending_style
        if pending_text:
            formats.append(pending_text + "=" + (pending_style or ""))
            format_runs.append({"text": pending_text, "style": pending_style or ""})
        pending_text = ""
        pending_style = None

    def append_text(value, style):
        nonlocal pending_text, pending_style
        if not value:
            return
        if pending_text and pending_style == style:
            pending_text += value
        else:
            flush()
            pending_text = value
            pending_style = style

    def visit_run(run):
        style = _run_style(run)
        for child in run:
            if child.tag == W + "rPr":
                continue
            if child.tag == W + "t":
                append_text(child.text or "", style)
            elif child.tag == W + "tab":
                flush()
                append_text("\t", style)
                flush()
            elif child.tag in (W + "br", W + "cr"):
                flush()
                append_text("\n", style)
                flush()
            else:
                # Field instructions, note references, drawings and every other
                # non-text run child are semantic boundaries. Equal formatting
                # on either side must not collapse across them.
                flush()

    def visit_container(container):
        for child in container:
            if child.tag == W + "r":
                visit_run(child)
                continue
            if child.tag in {
                W + "pPr",
                W + "proofErr",
                W + "bookmarkStart",
                W + "bookmarkEnd",
                W + "commentRangeStart",
                W + "commentRangeEnd",
                W + "permStart",
                W + "permEnd",
            }:
                # Proofing, bookmark, comment and permission markers do not
                # introduce visible formatting boundaries.
                continue
            # Hyperlinks, revision wrappers, fields and other run containers
            # delimit independent runs. Merge inside a container, never across
            # its entry or exit boundary.
            flush()
            if child.find(".//" + W + "r") is not None:
                visit_container(child)
            flush()

    format_runs = []
    visit_container(paragraph)
    flush()
    return {
        "section": section,
        "location": location,
        "text": text,
        "displayText": f"{list_label} {text}" if list_label and text else list_label or text,
        "listLabel": list_label,
        "format": "||".join(formats),
        "formatRuns": format_runs,
    }


def _display_format_runs(record):
    runs = record.get("formatRuns", [])
    if "".join(run["text"] for run in runs) == record.get("displayText", ""):
        return runs
    text = record.get("text", "")
    list_label = record.get("listLabel", "")
    run_text = "".join(run["text"] for run in runs)
    position = text.find(run_text)
    if position < 0:
        return []
    body_runs = []
    if position:
        body_runs.append({"text": text[:position], "style": "__structure__"})
    body_runs.extend(runs)
    if position + len(run_text) < len(text):
        body_runs.append({"text": text[position + len(run_text):], "style": "__structure__"})
    prefix = f"{list_label} " if list_label and text else list_label
    result = ([{"text": prefix, "style": "__list-label__"}] if prefix else []) + body_runs
    return result if "".join(run["text"] for run in result) == record.get("displayText", "") else []


def _read_comments(archive, numbering):
    if "word/comments.xml" not in archive.namelist():
        return {}

    comments_root, sources = _parsed_part(archive, "word/comments.xml")
    comments = {}
    for comment_index, comment in enumerate(comments_root.findall(W + "comment"), 1):
        comment_id = comment.attrib.get(W + "id", str(comment_index))
        paragraphs = list(comment.iter(W + "p"))
        paragraph_records = [{**_paragraph_record(paragraph, "comment", "", numbering), "source": sources[id(paragraph)]} for paragraph in paragraphs]
        format_runs = []
        for index, record in enumerate(paragraph_records):
            if index:
                format_runs.append({"text": "\n", "style": "__paragraph-break__"})
            format_runs.extend(_display_format_runs(record))
        comments[comment_id] = {
            "source": sources[id(comment)],
            "paragraphs": paragraph_records,
            "id": comment_id,
            "author": comment.attrib.get(W + "author", "").strip(),
            "text": "\n".join(_text(paragraph) for paragraph in paragraphs).strip(),
            "format": "||".join(record["format"] for record in paragraph_records),
            "formatRuns": format_runs,
        }
    return comments


def _paragraph_comment_ids(paragraph):
    result = []
    for element_name in ("commentRangeStart", "commentReference"):
        for item in paragraph.iter(W + element_name):
            comment_id = item.attrib.get(W + "id")
            if comment_id is not None and comment_id not in result:
                result.append(comment_id)
    return result


def _iter_story_blocks(container):
    for child in container:
        if child.tag in (W + "p", W + "tbl"):
            yield child
        elif child.tag == W + "sdt":
            content = child.find(W + "sdtContent")
            if content is not None:
                yield from _iter_story_blocks(content)


def _note_part_owners(archive):
    import posixpath
    owners=[];errors=[];names=archive.namelist();base='http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
    rels=list(ET.fromstring(archive.read('word/_rels/document.xml.rels'))) if 'word/_rels/document.xml.rels' in names else []
    types=list(ET.fromstring(archive.read('[Content_Types].xml'))) if '[Content_Types].xml' in names else []
    for kind in ('footnote','endnote'):
        refs=[rel for rel in rels if rel.get('Type')==base+kind+'s'];fallback='word/'+kind+'s.xml'
        if not refs:
            if fallback in names:owners.append({'kind':kind,'part':fallback}) # legacy unreferenced fixtures
            continue
        if len(refs)!=1:errors.append('unsupported-note-part-path');continue
        rel=refs[0];target=rel.get('Target','');part=target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join('word',target))
        mime='application/vnd.openxmlformats-officedocument.wordprocessingml.'+kind+'s+xml'
        declarations=[n.get('ContentType') for n in types if n.get('PartName')=='/'+part]
        if not rel.get('Id') or not target or not target.isascii() or any(c.isspace() for c in target) or any(c in target for c in '\\:#?%') or rel.get('TargetMode','') not in ('','Internal') or not part.startswith('word/') or names.count(part)!=1 or declarations!=[mime] or sum(r.get('Id')==rel.get('Id') for r in rels)!=1:
            errors.append('unsupported-note-part-path');continue
        if ET.fromstring(archive.read(part)).tag!=W+kind+'s':errors.append('unsupported-note-part-path');continue
        owners.append({'kind':kind,'part':part,'rId':rel.get('Id'),'rawTarget':target})
    if len({owner['part'] for owner in owners})!=len(owners):errors.append('unsupported-note-part-path')
    return owners,errors

def _note_package_facts(archive,inventory):
    containers=[];owners,errors=_note_part_owners(archive)
    main='word/_rels/document.xml.rels';relationships=ET.fromstring(archive.read(main)) if main in archive.namelist() else []
    def content_signature(node,part):
        import posixpath
        relpath=posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels')
        rels={rel.get('Id'):rel for rel in ET.fromstring(archive.read(relpath))} if relpath in archive.namelist() else {}
        def canonical(item,root=False):
            attrs=[]
            for name,value in sorted(item.attrib.items()):
                if root and name==W+'id' or name.startswith(W+'rsid') or item.tag.endswith('}docPr') and name=='id':continue
                if name.startswith('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'):
                    rel=rels.get(value)
                    if rel is not None:
                        target=rel.get('Target','');path=target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(part),target))
                        value=[rel.get('Type'),rel.get('TargetMode',''),target if rel.get('TargetMode')=='External' else hashlib.sha256(archive.read(path)).hexdigest() if path in archive.namelist() else 'missing-target']
                attrs.append([name,value])
            return [item.tag,attrs,item.text or '',[canonical(child) for child in item if child.tag not in {W+name for name in ('pPr','rPr','tblPr','trPr','tcPr','sectPr')}]]
        return hashlib.sha256(json.dumps(canonical(node,True),ensure_ascii=False).encode()).hexdigest()
    for owner in owners:
        kind,part=owner['kind'],owner['part']
        ids=set()
        for index,node in enumerate(ET.fromstring(archive.read(part))):
            if node.tag!=W+kind:continue
            identity=node.get(W+'id','');type_name=node.get(W+'type','normal')
            if type_name=='normal' and (identity in ids or not identity.lstrip('-').isdigit()):errors.append('invalid-note-id')
            if type_name=='normal':ids.add(identity)
            containers.append({'source':{'part':part,'path':[index]},'kind':kind,'id':identity,'type':type_name})
            if type_name!='normal':
                containers[-1]['contentSignature']=content_signature(node,part)
                # Finite text/property redline shape: one plain paragraph with
                # unchanged isolated terminal special-control runs.
                paragraphs=list(node);controls=[];valid=len(paragraphs)==1 and paragraphs[0].tag==W+'p' and not paragraphs[0].attrib and set(node.attrib)<={W+'id',W+'type'}
                if valid:
                    seen_control=False
                    for run in paragraphs[0]:
                        if run.tag==W+'pPr':continue
                        if run.tag!=W+'r' or run.attrib:valid=False;break
                        children=[child for child in run if child.tag!=W+'rPr']
                        if len(children)==1 and children[0].tag in {W+'separator',W+'continuationSeparator',W+'continuationNotice'} and not children[0].attrib and not list(children[0]) and not (children[0].text or '').strip():
                            if run.find(W+'rPr') is not None:valid=False;break
                            seen_control=True;controls.append(children[0].tag)
                        elif seen_control or any(child.tag!=W+'t' for child in children):valid=False;break
                if valid and identity.lstrip('-').isdigit() and type_name in {'separator','continuationSeparator'} and _text(node).strip() and controls==[W+type_name]:containers[-1]['specialRevisionShape']=controls

    references=[{'source':source,'kind':source['objectEvent']['signature'],'id':source['objectEvent']['target']} for source in inventory if source.get('objectEvent',{}).get('kind')=='note']
    for kind in ('footnote','endnote'):
        if any(ref['kind']==kind for ref in references) and sum(rel.get('Type')=='http://schemas.openxmlformats.org/officeDocument/2006/relationships/'+kind+'s' for rel in relationships)!=1:errors.append('unsupported-note-part-path')
    for ref in references:
        if not any(note['kind']==ref['kind'] and note['id']==ref['id'] and note['type']=='normal' for note in containers):errors.append('missing-note-target')
    return {'policy':'worklazy-note-facts-1','containers':containers,'references':references,'errors':sorted(set(errors)), 'parts':[owner['part'] for owner in owners],'owners':owners}

def _story_package_facts(archive):
    import posixpath
    relns='http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
    r='{'+relns[:-1]+'}';ct='{http://schemas.openxmlformats.org/package/2006/content-types}'
    names=set(archive.namelist());errors=[];relationships={}
    path='word/_rels/document.xml.rels'
    if path in names:
        for node in ET.fromstring(archive.read(path)):
            rid=node.get('Id','')
            if rid in relationships:errors.append('duplicate-main-relationship')
            relationships[rid]=node
    types=ET.fromstring(archive.read('[Content_Types].xml')) if '[Content_Types].xml' in names else []
    def content_type(part):
        return next((node.get('ContentType') for node in types if node.tag==ct+'Override' and node.get('PartName')=='/'+part),None)
    parts={}
    for rid,node in relationships.items():
        kind=node.get('Type','').removeprefix(relns)
        if node.get('Type')!=relns+kind or kind not in ('header','footer'):continue
        target=node.get('Target','');resolved=target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join('word',target))
        if node.get('TargetMode')=='External' or resolved not in names:errors.append('unresolved-story-target');continue
        root=ET.fromstring(archive.read(resolved))
        if root.tag!=W+('hdr' if kind=='header' else 'ftr'):errors.append('invalid-story-root')
        expected='application/vnd.openxmlformats-officedocument.wordprocessingml.'+kind+'+xml'
        mime=content_type(resolved)
        if mime!=expected:errors.append('invalid-story-content-type')
        parts[resolved]={'part':resolved,'kind':kind,'sha256':hashlib.sha256(archive.read(resolved)).hexdigest(),'contentType':mime,'active':False}
    # Keep conventional orphan parts as legacy comparison inputs; their source
    # identity is never rewritten to an output/imported name.
    for name in names:
        match=re.fullmatch(r'word/(header|footer)\d+\.xml',name)
        if match and name not in parts:parts[name]={'part':name,'kind':match.group(1),'sha256':hashlib.sha256(archive.read(name)).hexdigest(),'contentType':content_type(name),'active':False}
    sections=[];bindings=[]
    root=ET.fromstring(archive.read('word/document.xml'))
    def visit(node,path,ancestors):
        if node.tag==W+'sectPr' and not any(parent.tag in (W+'sectPrChange',W+'pPrChange') for parent in ancestors):
            section={'part':'word/document.xml','path':path};sections.append({'source':section,'final':bool(ancestors and ancestors[-1].tag==W+'body'),'history':node.find(W+'sectPrChange') is not None,'activation':{'type':node.find(W+'type').get(W+'val','nextPage') if node.find(W+'type') is not None else 'nextPage','titlePage':node.find(W+'titlePg') is not None and node.find(W+'titlePg').get(W+'val','true').lower() not in ('false','off','0')}})
            slots=set()
            for index,child in enumerate(node):
                if child.tag not in (W+'headerReference',W+'footerReference'):continue
                kind='header' if child.tag==W+'headerReference' else 'footer';variant=child.get(W+'type','default');
                if variant not in ('default','first','even'):errors.append('invalid-story-variant')
                rid=child.get(r+'id','');rel=relationships.get(rid)
                if (kind,variant) in slots:errors.append('duplicate-story-binding')
                slots.add((kind,variant))
                if rel is None or rel.get('Type')!=relns+kind or rel.get('TargetMode')=='External':errors.append('invalid-story-binding');continue
                target=rel.get('Target','');part=target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join('word',target))
                if part not in parts:errors.append('unresolved-story-binding');continue
                parts[part]['active']=True
                bindings.append({'section':section,'reference':{'part':'word/document.xml','path':path+[index]},'kind':kind,'variant':variant,'ownerPart':'word/document.xml','rId':rid,'type':rel.get('Type'),'rawTarget':target,'targetMode':rel.get('TargetMode',''),'targetPart':part})
        for index,child in enumerate(node):visit(child,path+[index],ancestors+[node])
    visit(root,[],[])
    settings=ET.fromstring(archive.read('word/settings.xml')) if 'word/settings.xml' in names else ET.Element(W+'settings')
    even=settings.find(W+'evenAndOddHeaders')
    return {'policy':'worklazy-story-facts-1','parts':sorted(parts.values(),key=lambda item:item['part']),'sections':sections,'bindings':bindings,'settings':{'evenAndOddHeaders':even is not None and even.get(W+'val','true').lower() not in ('false','off','0')},'errors':sorted(set(errors))}

def _parse_document(data, include_tables, include_metadata):
    records = {
        "body": [],
        "table": [],
        "headerFooter": [],
        "comment": [],
        "note": [],
        "document": [],
        "documentBlocks": [],
        "tables": [],
        "sourceInventory": [],
    }
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        records["storyFacts"]=_story_package_facts(archive)
        story_kinds={item["part"]:item["kind"] for item in records["storyFacts"]["parts"]}
        note_parts={owner['part'] for owner in _note_part_owners(archive)[0]}
        for part in archive.namelist():
            if part in note_parts or part in story_kinds or re.fullmatch(r"word/(document|header\d+|footer\d+|footnotes|endnotes|comments|styles)\.xml", part):
                part_root = ET.fromstring(archive.read(part))
                part_sources = _source_paths(part_root, part, archive)
                if _PARSED_PARTS["parts"] is not None:
                    _PARSED_PARTS["parts"][part] = (part_root, part_sources)
                records["sourceInventory"].extend(part_sources.values())
        numbering = _NumberingResolver(archive)
        comments = _read_comments(archive, numbering.fresh()) if include_metadata else {}
        comment_locations = {}
        root, sources = _parsed_part(archive, "word/document.xml")
        if root.tag != W + "document":
            raise ValueError(_l("지원하지 않는 Word 문서 형식입니다. 일반 DOCX로 다시 저장한 뒤 비교해 주세요.", "This Word XML format is not supported. Save it as a standard DOCX and compare again."))
        body = root.find(W + "body")
        paragraph_index = 0
        table_index = 0
        if body is not None:
            for child in _iter_story_blocks(body):
                if child.tag == W + "p":
                    paragraph_index += 1
                    record = _paragraph_record(child, "body", _l(f"본문 {paragraph_index}번째 문단", f"Body paragraph {paragraph_index}"), numbering)
                    record["source"] = sources[id(child)]
                    comment_ids = _paragraph_comment_ids(child)
                    record["comments"] = [comments[item] for item in comment_ids if item in comments]
                    for comment_id in comment_ids:
                        comment_locations.setdefault(comment_id, record["location"])
                    if record["text"] or record["format"] or record["comments"] or record.get("source", {}).get("opaqueSignature"):
                        records["body"].append(record)
                        records["document"].append(record)
                    records["documentBlocks"].append({"type": "paragraph", "record": record})
                elif child.tag == W + "tbl" and include_tables:
                    table_index += 1
                    table_grid = []
                    for row_index, row in enumerate(child.findall(W + "tr"), 1):
                        row_records = []
                        for cell_index, cell in enumerate(row.findall(W + "tc"), 1):
                            paragraphs = cell.findall(".//" + W + "p")
                            paragraph_records = [{**_paragraph_record(p, "table", "", numbering), "source": sources[id(p)]} for p in paragraphs]
                            text = "\n".join(record["text"] for record in paragraph_records)
                            display_text = "\n".join(record["displayText"] for record in paragraph_records)
                            list_labels = "\n".join(record["listLabel"] for record in paragraph_records)
                            formatting = "||".join(record["format"] for record in paragraph_records)
                            format_runs = []
                            for paragraph_record_index, paragraph_record in enumerate(paragraph_records):
                                if paragraph_record_index:
                                    format_runs.append({"text": "\n", "style": "__paragraph-break__"})
                                format_runs.extend(_display_format_runs(paragraph_record))
                            comment_ids = []
                            for paragraph in paragraphs:
                                for comment_id in _paragraph_comment_ids(paragraph):
                                    if comment_id not in comment_ids:
                                        comment_ids.append(comment_id)
                            record = {
                                "source": sources[id(cell)],
                                "paragraphs": paragraph_records,
                                "section": "table",
                                "location": _l(f"표 {table_index} · {row_index}행 {cell_index}열", f"Table {table_index} · row {row_index}, column {cell_index}"),
                                "text": text,
                                "displayText": display_text,
                                "listLabel": list_labels,
                                "format": formatting,
                                "formatRuns": format_runs,
                                "comments": [comments[item] for item in comment_ids if item in comments],
                                "tableIndex": table_index - 1,
                                "rowIndex": row_index - 1,
                                "columnIndex": cell_index - 1,
                            }
                            for comment_id in comment_ids:
                                comment_locations.setdefault(comment_id, record["location"])
                            if record["text"] or record["format"] or record["comments"] or record.get("source", {}).get("opaqueSignature"):
                                records["table"].append(record)
                            row_records.append(record)
                        table_grid.append(row_records)
                    records["tables"].append(table_grid)
                    records["documentBlocks"].append({
                        "type": "table",
                        "tableIndex": table_index - 1,
                        "source": sources[id(child)],
                    })
                elif child.tag == W + "tbl":
                    for paragraph in child.iter(W + "p"):
                        numbering.label(paragraph)

        if include_metadata:
            header_footer_paths = sorted(story_kinds)
            for path in header_footer_paths:
                story_numbering = numbering.fresh()
                metadata_root, metadata_sources = _parsed_part(archive, path)
                file_name = path.split("/")[-1]
                area = _l("머리말", "Header") if story_kinds[path]=="header" else _l("꼬리말", "Footer")
                area_number = re.search(r"\d+", file_name)
                label = f"{area} {area_number.group(0)}" if area_number else area
                for index, paragraph in enumerate(metadata_root.iter(W + "p"), 1):
                    record = _paragraph_record(
                        paragraph,
                        "headerFooter",
                        _l(f"{label} · {index}번째 문단", f"{label} · paragraph {index}"),
                        story_numbering,
                    )
                    record["source"] = metadata_sources[id(paragraph)]
                    records["headerFooter"].append(record)

            for comment_id, comment in comments.items():
                author_label = f" · {comment['author']}" if comment["author"] else ""
                anchor_location = comment_locations.get(comment_id, _l("연결 위치를 찾지 못한 문단", "Paragraph with unknown anchor"))
                records["comment"].append({
                    "commentId": comment_id,
                    "source": comment.get("source"),
                    "paragraphs": comment.get("paragraphs", []),
                    "section": "comment",
                    "location": _l(f"{anchor_location} · 메모 {comment_id}{author_label}", f"{anchor_location} · comment {comment_id}{author_label}"),
                    "text": comment["text"],
                    "format": comment["format"],
                })

            for owner in _note_part_owners(archive)[0]:
                path=owner['part'];element_name=owner['kind'];note_name=_l('각주','Footnote') if element_name=='footnote' else _l('미주','Endnote')
                if path not in archive.namelist():
                    continue
                notes_root, note_sources = _parsed_part(archive, path)
                story_numbering = numbering.fresh()
                for note_index, note in enumerate(notes_root.findall(W + element_name), 1):
                    note_id = note.attrib.get(W + "id", str(note_index))
                    if note.get(W+"type","normal")!="normal" and not any(_text(p).strip() for p in note.iter(W+"p")):continue
                    try:
                        if int(note_id) < 0 and note.get(W+"type","normal")=="normal":
                            continue
                    except ValueError:
                        pass
                    role=note.get(W+'type','normal')
                    special_label={'separator':_l('구분선','separator'),'continuationSeparator':_l('연속 구분선','continuation separator'),'continuationNotice':_l('연속 알림','continuation notice')}.get(role)
                    display_id=special_label or note_id
                    for paragraph_index, paragraph in enumerate(note.iter(W + "p"), 1):
                        record = _paragraph_record(
                            paragraph,
                            "note",
                            _l(f"{note_name} {display_id} · {paragraph_index}번째 문단", f"{note_name} {display_id} · paragraph {paragraph_index}"),
                            story_numbering,
                        )
                        record["source"] = note_sources[id(paragraph)]
                        records["note"].append(record)
        records["noteFacts"]=_note_package_facts(archive,records["sourceInventory"])
        records["warnings"] = numbering.unresolved
    return records


def _display_text(record):
    if not record:
        return ""
    return record.get("displayText", record.get("text", ""))


def _cell_payload(cell):
    return {
        "source": cell.get("source"),
        "paragraphs": [{**record, "rawText": record["text"], "text": _display_text(record)} for record in cell.get("paragraphs", [])],
        "text": _display_text(cell),
        "format": cell.get("format", ""),
        "formatRuns": _display_format_runs(cell),
        "location": cell.get("location", ""),
        "segments": [],
        "comments": [
            {
                "id": comment.get("id", ""),
                "author": comment.get("author", ""),
                "text": comment.get("text", ""),
            }
            for comment in cell.get("comments", [])
        ],
    }


_EXTRACT_CACHE = []


# Transport form of the model: the WordprocessingML namespace (in most property names) as one
# control character, which JSON text never contains unescaped; the worker restores it before
# parsing. See compactModelJson / restoreModelJson in word.worker.ts.
MODEL_NAMESPACE_TOKEN = "\x01"


def extract_document_model_compact(document_bytes, include_tables, include_metadata, language="ko"):
    """UTF-8 bytes of the model in transport form: bytes cross into JavaScript far faster than a
    long string does."""
    return extract_document_model(document_bytes, include_tables, include_metadata, language).replace(W, MODEL_NAMESPACE_TOKEN).encode("utf-8")


def extract_document_model(document_bytes, include_tables, include_metadata, language="ko"):
    """Memoized `_extract_document_model`: the tracked-DOCX validator re-reads the same
    input bytes the screen comparison just extracted, so the last two results are reused."""
    return _extract_document_model_entry(document_bytes, include_tables, include_metadata, language)[1]


def extract_document_model_parsed(document_bytes, include_tables, include_metadata, language="ko"):
    """The memoized model decoded once (read-only: shared by every caller)."""
    entry = _extract_document_model_entry(document_bytes, include_tables, include_metadata, language)
    if entry[2] is None:
        entry[2] = json.loads(entry[1])
    return entry[2]


def _extract_document_model_entry(document_bytes, include_tables, include_metadata, language):
    data = bytes(document_bytes)
    key = (hashlib.sha256(data).hexdigest(), bool(include_tables), bool(include_metadata), "en" if language == "en" else "ko")
    for entry in _EXTRACT_CACHE:
        if entry[0] == key:
            global LANGUAGE
            LANGUAGE = key[3]
            return entry
    entry = [key, _extract_document_model(data, include_tables, include_metadata, language), None]
    _EXTRACT_CACHE.append(entry)
    del _EXTRACT_CACHE[:-2]
    return entry


def _extract_document_model(document_bytes, include_tables, include_metadata, language="ko"):
    """Return only the format-specific extraction model.

    Paragraph matching and result generation live in the shared TypeScript
    comparison engine so Word and HWP/HWPX use exactly the same rules.
    """
    global LANGUAGE
    LANGUAGE = "en" if language == "en" else "ko"
    _SOURCE_FACTS["cache"] = {}
    _PARSED_PARTS["parts"] = {}
    _FACT_MEMO["facts"] = {}
    try:
        records = _parse_document(bytes(document_bytes), include_tables, include_metadata)
    finally:
        _SOURCE_FACTS["cache"] = None
        _PARSED_PARTS["parts"] = None
        _FACT_MEMO["facts"] = None

    def comments_of(record):
        return [
            {
                "id": comment.get("id", ""),
                "author": comment.get("author", ""),
                "text": comment.get("text", ""),
            }
            for comment in record.get("comments", [])
        ]

    def record_of(record):
        return {
            **({"commentId": record["commentId"]} if "commentId" in record else {}),
            "source": record.get("source"),
            "rawText": record.get("text", ""),
            "paragraphs": [{**item, "rawText": item["text"], "text": _display_text(item)} for item in record.get("paragraphs", [])],
            "text": _display_text(record),
            "format": record.get("format", ""),
            "formatRuns": _display_format_runs(record),
            "location": record.get("location", ""),
            "comments": comments_of(record),
        }

    tables = []
    for table_index, table in enumerate(records["tables"]):
        tables.append({
            "location": _l(f"표 {table_index + 1}", f"Table {table_index + 1}"),
            "sourceIndex": table_index,
            "grid": [[_cell_payload(cell) for cell in row] for row in table],
        })

    blocks = []
    for block in records["documentBlocks"]:
        if block["type"] == "paragraph":
            record = record_of(block["record"])
            blocks.append({
                "type": "paragraph",
                **record,
            })
            continue
        table_index = block["tableIndex"]
        table = tables[table_index]
        blocks.append({
            "type": "table",
            "source": block.get("source"),
            "text": " | ".join(
                "\u241f".join(cell.get("text", "") for cell in row)
                for row in table["grid"]
                if any(cell.get("text", "") for cell in row)
            ),
            "format": "",
            "formatRuns": [],
            "location": table["location"],
            "table": table,
        })

    warnings = [_l(
        "필드 계산 결과, 도형과 일부 고급 레이아웃은 Microsoft Word의 표시와 차이가 날 수 있습니다.",
        "Calculated fields, shapes, and some advanced layouts may differ from Microsoft Word's display.",
    )]
    if records.get("warnings", 0):
        unresolved = records["warnings"]
        warnings.append(_l(
            f"정의를 찾지 못한 자동 번호 {unresolved}개는 번호 없이 표시했습니다.",
            f"Displayed {unresolved} automatic numbers without labels because their definitions were unavailable.",
        ))

    model = {
        "fields": [source["field"] for source in records["sourceInventory"] if "field" in source],
        "sourceRevision": hashlib.sha256(bytes(document_bytes)).hexdigest(),
        "sourceInventory": records["sourceInventory"],
        "storyFacts": records["storyFacts"],
        "noteFacts": records["noteFacts"],
        "blocks": blocks,
        "headerFooter": [record_of(record) for record in records["headerFooter"]],
        "notes": [record_of(record) for record in records["note"]],
        "comments": [record_of(record) for record in records["comment"]],
        "warnings": warnings,
    }
    return json.dumps(model, ensure_ascii=False)
