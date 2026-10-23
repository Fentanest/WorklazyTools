import copy
import bisect
import datetime
import hashlib
import io
import json
import re
import zipfile
import xml.etree.ElementTree as ET

from js import worklazyDiffJson, worklazyComparisonManifestJson


WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = "{" + WORD_NS + "}"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"
CONTENT_CONTROL_TAG = W + "sdt"
CONTENT_CONTROL_BODY_TAG = W + "sdtContent"
BLOCK_TAGS = {W + "p", W + "tbl", CONTENT_CONTROL_TAG}
PROPERTY_CHANGE_TAGS = {
    W + "rPrChange",
    W + "pPrChange",
    W + "tblPrChange",
    W + "trPrChange",
    W + "tcPrChange",
    W + "sectPrChange",
}
TRACK_CHANGE_TAGS = PROPERTY_CHANGE_TAGS | {
    W + "ins",
    W + "del",
    W + "moveFrom",
    W + "moveTo",
    W + "cellIns",
    W + "cellDel",
}
DELETED_CONTENT_TAGS = {W + "del", W + "moveFrom"}
INSERTED_CONTENT_TAGS = {W + "ins", W + "moveTo"}
COMMENT_MARKER_TAGS = {W + "commentRangeStart", W + "commentRangeEnd"}


# Package copying is keyed by (source side, owner part, relationship id).
# External targets are copied as declarations and are never fetched.
import posixpath
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PR = "{http://schemas.openxmlformats.org/package/2006/relationships}"
CT = "{http://schemas.openxmlformats.org/package/2006/content-types}"
class _PackageGraph:
    def __init__(self, before, after):
        self.before, self.after = before, after
        self.roots, self.additions, self.ids, self.media = {}, {}, {}, {}
        self.types = ET.fromstring(after.read('[Content_Types].xml')) if '[Content_Types].xml' in after.namelist() else ET.Element(CT+'Types')
        self.before_types = ET.fromstring(before.read('[Content_Types].xml')) if '[Content_Types].xml' in before.namelist() else ET.Element(CT+'Types')
        self.names = set(after.namelist()); self.next_drawing_id = 1
        for part in after.namelist():
            if part.startswith('word/media/'):
                self.media[(hashlib.sha256(after.read(part)).hexdigest(),self.mime(part,self.types))] = part
            if re.fullmatch(r'word/(document|header[0-9]+|footer[0-9]+|footnotes|endnotes|comments)\.xml',part):
                for node in ET.fromstring(after.read(part)).iter():
                    if node.tag=='{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}docPr' and node.get('id','').isdigit(): self.next_drawing_id = max(self.next_drawing_id,int(node.get('id'))+1)
    def mime(self, part, types):
        content=next((node.get('ContentType') for node in types if node.tag==CT+'Override' and node.get('PartName')=='/'+part),None)
        return content or next((node.get('ContentType') for node in types if node.tag==CT+'Default' and node.get('Extension','').lower()==posixpath.splitext(part)[1].lstrip('.').lower()),None)
    def rel_path(self, part):
        return posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels')
    def relationship(self, part, rid):
        key=('before',part,rid)
        if key in self.ids: return self.ids[key]
        path=self.rel_path(part)
        if path not in self.before.namelist(): raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
        candidates=[node for node in ET.fromstring(self.before.read(path)) if node.get('Id')==rid]
        if len(candidates)!=1: raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
        old=candidates[0]; kind=old.get('Type',''); target=old.get('Target','')
        if not kind.endswith(('/image','/hyperlink')): raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
        root=self.roots.get(path)
        if root is None:root=ET.fromstring(self.after.read(path)) if path in self.after.namelist() else ET.Element(PR+'Relationships')
        if old.get('TargetMode')!='External':
            source=target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(part),target))
            if source not in self.before.namelist() or not kind.endswith('/image'): raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
            data=self.before.read(source); digest=hashlib.sha256(data).hexdigest()
            content=self.mime(source,self.before_types)
            if content is None: raise ValueError('UNSUPPORTED_TRACKED_SOURCE_CONTENT_TYPE')
            destination=self.media.get((digest,content))
            if destination is None:
                extension=posixpath.splitext(source)[1]
                destination='word/media/worklazy-'+digest+extension
                suffix=0
                while destination in self.names:
                    suffix+=1; destination='word/media/worklazy-'+digest+'-'+str(suffix)+extension
                self.names.add(destination);self.media[(digest,content)]=destination;self.additions[destination]=data
                ET.SubElement(self.types,CT+'Override',{'PartName':'/'+destination,'ContentType':content})
            target=posixpath.relpath(destination,posixpath.dirname(part))
        for existing in root:
            if existing.get('Type')==kind and existing.get('TargetMode','')==old.get('TargetMode','') and existing.get('Target')==target:
                self.ids[key]=existing.get('Id');return existing.get('Id')
        self.roots[path]=root
        number=1;used={node.get('Id') for node in root}
        while 'rIdWorklazy'+str(number) in used:number+=1
        rid='rIdWorklazy'+str(number);attrs=dict(old.attrib);attrs.update(Id=rid,Target=target)
        ET.SubElement(root,PR+'Relationship',attrs);self.ids[key]=rid
        return rid
    def copy(self, source, part):
        result=copy.deepcopy(source)
        for node in result.iter():
            for name,value in list(node.attrib.items()):
                if name.startswith(R):node.set(name,self.relationship(part,value))
            if node.tag=='{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}docPr':
                node.set('id',str(self.next_drawing_id));self.next_drawing_id+=1
        return result
    def validate(self, replacements, additions):
        names=self.names | set(additions)
        types=ET.fromstring(replacements.get('[Content_Types].xml',self.after.read('[Content_Types].xml'))) if '[Content_Types].xml' in self.after.namelist() else self.types
        for part,data in replacements.items():
            if not re.fullmatch(r'word/(document|header[0-9]+|footer[0-9]+|footnotes|endnotes)\.xml',part):continue
            root=_qname_safe_parse(data);path=self.rel_path(part)
            raw=additions.get(path,replacements.get(path))
            rels=ET.fromstring(raw) if raw is not None else ET.fromstring(self.after.read(path)) if path in self.after.namelist() else ET.Element(PR+'Relationships')
            for node in root.iter():
                if node.tag not in {W+'hyperlink','{http://schemas.openxmlformats.org/drawingml/2006/main}blip','{urn:schemas-microsoft-com:vml}imagedata','{http://schemas.openxmlformats.org/drawingml/2006/main}hlinkClick'}:continue
                for name,rid in node.attrib.items():
                    if not name.startswith(R):continue
                    matches=[rel for rel in rels if rel.get('Id')==rid]
                    if len(matches)!=1:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
                    rel=matches[0]
                    expected='/hyperlink' if node.tag in {W+'hyperlink','{http://schemas.openxmlformats.org/drawingml/2006/main}hlinkClick'} else '/image'
                    if not rel.get('Type','').endswith(expected):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
                    if rel.get('TargetMode')=='External':continue
                    target=rel.get('Target','');target=target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(part),target))
                    if target not in names or self.mime(target,types) is None:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_CONTENT_TYPE')
    def finish(self, replacements, additions):
        for path,root in self.roots.items():
            current=replacements.get(path,additions.get(path))
            if current is not None:
                merged=ET.fromstring(current);by_id={node.get('Id'):node for node in merged}
                for node in root:
                    existing=by_id.get(node.get('Id'))
                    if existing is not None and existing.attrib!=node.attrib:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP_COLLISION')
                    if existing is None:merged.append(copy.deepcopy(node))
                root=merged
            (replacements if path in self.after.namelist() else additions)[path]=_serialize_xml(root)
        additions.update(self.additions)
        if self.additions:
            merged=ET.fromstring(replacements.get('[Content_Types].xml',self.after.read('[Content_Types].xml')))
            present={node.get('PartName') for node in merged if node.tag==CT+'Override'}
            for node in self.types:
                if node.tag==CT+'Override' and node.get('PartName','').lstrip('/') in self.additions and node.get('PartName') not in present:merged.append(copy.deepcopy(node))
            replacements['[Content_Types].xml']=_serialize_xml(merged)

_PACKAGE_GRAPH = None

def _inherit_mc_context(result, source):
    origin=_MANIFEST_NODE_KEYS.get(source)
    if origin is None or origin[0]!="before":return result
    side,(part,path)=origin;directives={};declarations={}
    for depth in range(len(path)+1):
        ancestor=_MANIFEST_SOURCE_NODES.get((side,(part,path[:depth])))
        if ancestor is None:continue
        for name,value in ancestor.attrib.items():
            if name in {"{http://schemas.openxmlformats.org/markup-compatibility/2006}"+local for local in ("Ignorable","MustUnderstand","ProcessContent","PreserveElements","PreserveAttributes")}:
                directives[name]=list(dict.fromkeys(directives.get(name,[])+value.split()))
            elif name.startswith("xmlns:wltq"):declarations[name]=value
    for name,words in directives.items():result.set(name," ".join(words))
    for name,value in declarations.items():result.set(name,value)
    return result


def _source_copy(source):
    origin = _MANIFEST_NODE_KEYS.get(source)
    result=_PACKAGE_GRAPH.copy(source, origin[1][0]) if _PACKAGE_GRAPH is not None and origin and origin[0] == "before" else copy.deepcopy(source)
    return _inherit_mc_context(result,source)


class _RevisionWriter:
    def __init__(self, author, start_id=1):
        self.author = (author or "Worklazy Tools").strip() or "Worklazy Tools"
        self.date = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        self.next_id = start_id
        self.count = 0

    def attributes(self):
        revision_id = self.next_id
        self.next_id += 1
        self.count += 1
        return {
            W + "id": str(revision_id),
            W + "author": self.author,
            W + "date": self.date,
        }


def _qname_safe_parse(data):
    pending = {}; contexts = []; root = None
    for event, value in ET.iterparse(io.BytesIO(data), events=("start-ns", "start", "end")):
        if event == "start-ns":
            prefix, uri = value; pending[prefix or ""] = uri
            if prefix and not prefix.startswith("wltq"):
                try: ET.register_namespace(prefix or "", uri)
                except ValueError: pass
        elif event == "start":
            context = dict(contexts[-1]) if contexts else {}; context.update(pending); pending.clear(); contexts.append(context)
            if root is None: root = value
            if value.tag == "{http://schemas.openxmlformats.org/markup-compatibility/2006}Choice" and not value.get("Requires", "").split():raise ValueError("UNSUPPORTED_TRACKED_SOURCE_QNAME")
            for name, raw in list(value.attrib.items()):
                prefixes = name in {"{http://schemas.openxmlformats.org/markup-compatibility/2006}Ignorable", "{http://schemas.openxmlformats.org/markup-compatibility/2006}MustUnderstand"} or (name == "Requires" and value.tag == "{http://schemas.openxmlformats.org/markup-compatibility/2006}Choice")
                typed = name == "{http://www.w3.org/2001/XMLSchema-instance}type"
                qnames = name in {"{http://schemas.openxmlformats.org/markup-compatibility/2006}ProcessContent", "{http://schemas.openxmlformats.org/markup-compatibility/2006}PreserveElements", "{http://schemas.openxmlformats.org/markup-compatibility/2006}PreserveAttributes"}
                if not prefixes and not typed and not qnames: continue
                if typed and len(raw.split())!=1:raise ValueError("UNSUPPORTED_TRACKED_SOURCE_QNAME")
                words = []
                for word in raw.split():
                    prefix, local = (word, "") if prefixes else word.split(":", 1) if ":" in word else ("", word)
                    uri = context.get(prefix)
                    if uri is None: raise ValueError("UNSUPPORTED_TRACKED_SOURCE_QNAME")
                    token = "wltq" + hashlib.sha256(uri.encode()).hexdigest()
                    value.set("xmlns:" + token, uri)
                    # Element names use another prefix; value-only declarations
                    # must survive even when their namespace has no elements.
                    ET.register_namespace("wltn" + hashlib.sha256(uri.encode()).hexdigest(), uri)
                    words.append(token if prefixes else token + ":" + local)
                value.set(name, " ".join(words))
        else: contexts.pop()
    return root


def _parse_xml(data):
    return _qname_safe_parse(data)


def _serialize_xml(root):
    if root.tag in {PR+"Relationships",CT+"Types"}:ET.register_namespace("",root.tag[1:].split("}",1)[0])
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _effective_properties(properties):
    if properties is None:
        return None
    result = copy.deepcopy(properties)
    for parent in result.iter():
        for child in list(parent):
            if child.tag in TRACK_CHANGE_TAGS:
                parent.remove(child)
    return result


def _properties_signature(properties):
    effective = _effective_properties(properties)
    return ET.tostring(effective, encoding="unicode") if effective is not None else ""


def _local_name(tag):
    return tag.rsplit("}", 1)[-1]








def _property_revision(after_properties, before_properties, property_tag, change_tag, writer, families=(), preserve_history=False):
    if after_properties is None and not families:
        return None
    result = copy.deepcopy(after_properties) if after_properties is not None else ET.Element(property_tag)
    if not families or preserve_history:
        return result
    if result.find(change_tag) is not None:
        raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_HISTORY")
    # Reject restores only TS-declared supported families. Unsupported children
    # retain their revised values rather than being smuggled into a change.
    previous = _effective_properties(after_properties) if after_properties is not None else ET.Element(property_tag)
    for child in list(previous):
        if child.tag in families:
            previous.remove(child)
    if before_properties is not None:
        for child in before_properties:
            if child.tag in families:
                previous.append(_effective_properties(child))
    order = [child.tag for child in before_properties] if before_properties is not None else []
    order.extend(child.tag for child in previous if child.tag not in order)
    previous[:] = sorted(list(previous), key=lambda child: order.index(child.tag))
    change = ET.SubElement(result, change_tag, writer.attributes())
    change.append(previous)
    return result


def _property_action(before, after, property_tag):
    left = _MANIFEST_NODE_KEYS.get(before)
    right = _MANIFEST_NODE_KEYS.get(after)
    if left is None or right is None or left[0] != "before" or right[0] != "after":
        raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_SOURCE")
    for action in _MANIFEST["propertyActions"]:
        if _manifest_key(action["before"]) == left[1] and _manifest_key(action["after"]) == right[1] and action["property"] == _local_name(property_tag):
            if action["id"] in _MANIFEST_PROPERTY_USED:
                raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_DUPLICATE")
            _MANIFEST_PROPERTY_USED.add(action["id"])
            return action
    return None


def _apply_property_revision(result, before, property_tag, change_tag, writer, after_source=None):
    action = _property_action(before, after_source if after_source is not None else result, property_tag)
    if action is None:
        return
    current = result.find(property_tag)
    previous = before.find(property_tag)
    revised = _property_revision(current, previous, property_tag, change_tag, writer, action["families"], action["representation"] == "preserve-after-history")
    children = list(result)
    if current is not None:
        index = children.index(current)
        result.remove(current)
        result.insert(index, revised)
    else:
        result.insert(0, revised)


def _accepted_copy(source, preserve_comments=False):
    result = _source_copy(source)

    def clean(parent):
        index = 0
        while index < len(parent):
            child = parent[index]
            if child.tag in DELETED_CONTENT_TAGS or child.tag in PROPERTY_CHANGE_TAGS:
                parent.remove(child)
                continue
            if child.tag in INSERTED_CONTENT_TAGS:
                children = list(child)
                parent.remove(child)
                for offset, nested in enumerate(children):
                    parent.insert(index + offset, nested)
                continue
            if child.tag in (W + "cellDel", W + "cellIns"):
                parent.remove(child)
                continue
            if not preserve_comments and child.tag in COMMENT_MARKER_TAGS:
                parent.remove(child)
                continue
            if not preserve_comments and child.tag == W + "r" and child.find(W + "commentReference") is not None:
                parent.remove(child)
                continue
            clean(child)
            index += 1

    clean(result)
    return result


def _element_text(node):
    parts = []
    for item in node.iter():
        if item.tag in (W + "t", W + "delText"):
            parts.append(item.text or "")
        elif item.tag == W + "tab":
            parts.append("\t")
        elif item.tag in (W + "br", W + "cr"):
            parts.append("\n")
    return "".join(parts)


def _comparison_text(node):
    parts = []

    def visit(item):
        if item.tag in DELETED_CONTENT_TAGS:
            return
        if item.tag == W + "t":
            parts.append(item.text or "")
            return
        if item.tag == W + "tab":
            parts.append("\t")
            return
        if item.tag in (W + "br", W + "cr"):
            parts.append("\n")
            return
        for child in item:
            visit(child)

    visit(node)
    return "".join(parts)






def _content_control_blocks(content_control):
    content = content_control.find(CONTENT_CONTROL_BODY_TAG)
    if content is None:
        return []
    return [child for child in content if child.tag in BLOCK_TAGS]


def _block_kind(element):
    if element.tag != CONTENT_CONTROL_TAG:
        return element.tag
    nested = _content_control_blocks(element)
    if len(nested) == 1:
        return _block_kind(nested[0])
    return CONTENT_CONTROL_TAG






















def _is_drawing_event(node):
    if node.tag == W + "drawing":return True
    if node.tag!="{http://schemas.openxmlformats.org/markup-compatibility/2006}AlternateContent":return False
    origin=_MANIFEST_NODE_KEYS.get(node)
    if origin is None:return False
    source=next((ref for ref in _MANIFEST["sources"][origin[0]] if _manifest_key(ref)==origin[1]),None)
    return source is not None and (source.get("objectEvent") or {}).get("kind")=="drawing"


def _styled_tokens(paragraph, collect_events=False):
    tokens = []
    events = {}
    next_wrapper_id = 1

    def add_event(element):
        events.setdefault(len(tokens), []).append(copy.deepcopy(element))

    def visit(node, wrapper=None, inside_preserved_wrapper=False, link=None):
        nonlocal next_wrapper_id
        if node.tag in DELETED_CONTENT_TAGS:
            if collect_events and not inside_preserved_wrapper:
                add_event(node)
            return
        if node.tag in INSERTED_CONTENT_TAGS:
            token_count = len(tokens)
            wrapper_value = (next_wrapper_id, copy.deepcopy(node))
            next_wrapper_id += 1
            for child in node:
                visit(child, wrapper_value, True)
            if collect_events and not inside_preserved_wrapper and len(tokens) == token_count:
                add_event(node)
            return
        if node.tag in COMMENT_MARKER_TAGS:
            if collect_events and not inside_preserved_wrapper:
                add_event(node)
            return
        if node.tag == W + "hyperlink":
            for child in node:visit(child,wrapper,inside_preserved_wrapper,node)
            return
        if node.tag == W + "r":
            text = _element_text(node)
            if not text:
                if collect_events and not inside_preserved_wrapper:
                    drawings=[child for child in node if _is_drawing_event(child)]
                    if drawings:
                        for drawing in drawings:events.setdefault(len(tokens),[]).append(drawing)
                    else:add_event(node)
                return
            run_properties = node.find(W + "rPr")
            # Word may split one visible word across several runs for reasons
            # unrelated to the document text (proofing, fields, formatting, or
            # prior revisions). Character tokens keep the text alignment
            # independent from those arbitrary run boundaries. Output runs are
            # coalesced again by _revision_container and emit_equal.
            for child in node:
                value = child.text or "" if child.tag == W + "t" else "\t" if child.tag == W + "tab" else "\n" if child.tag in (W + "br", W + "cr") else ""
                if _is_drawing_event(child) and collect_events and not inside_preserved_wrapper: events.setdefault(len(tokens),[]).append(child)
                for token in value:tokens.append({"text":token,"properties":copy.deepcopy(run_properties) if run_properties is not None else None,"wrapper":wrapper,"link":link})
            return
        for child in node:
            if child.tag != W + "pPr":
                visit(child, wrapper, inside_preserved_wrapper, link)

    visit(paragraph)
    return (tokens, events) if collect_events else tokens


def _has_visible_text_revision(paragraph):
    for element in paragraph.iter():
        if element.tag not in DELETED_CONTENT_TAGS | INSERTED_CONTENT_TAGS:
            continue
        if any(item.tag in (W + "t", W + "delText") and (item.text or "") for item in element.iter()):
            return True
    return False


def _append_text_nodes(run, text, deleted=False):
    text_tag = W + ("delText" if deleted else "t")
    cursor = 0
    for match in re.finditer(r"[\t\n]", text):
        if match.start() > cursor:
            node = ET.SubElement(run, text_tag)
            chunk = text[cursor:match.start()]
            node.text = chunk
            if chunk[:1].isspace() or chunk[-1:].isspace():
                node.set(XML_SPACE, "preserve")
        character = match.group(0)
        ET.SubElement(run, W + ("tab" if character == "\t" else "br"))
        cursor = match.end()
    if cursor < len(text) or not text:
        node = ET.SubElement(run, text_tag)
        chunk = text[cursor:]
        node.text = chunk
        if chunk[:1].isspace() or chunk[-1:].isspace():
            node.set(XML_SPACE, "preserve")


def _token_run(token, run_properties, deleted=False):
    run = ET.Element(W + "r")
    if run_properties is not None:
        run.append(copy.deepcopy(run_properties))
    _append_text_nodes(run, token, deleted)
    return run


def _revision_containers(kind, tokens, writer, strip_history=False):
    # Hyperlink is paragraph content, not a RunTrackChange child. Revisions
    # belong inside its envelope (CT_Hyperlink accepts inserted/deleted runs).
    results=[];start=0
    while start<len(tokens):
        link=tokens[start].get("link");end=start+1
        while end<len(tokens) and tokens[end].get("link") is link:end+=1
        revision=ET.Element(W+kind,writer.attributes());groups=[]
        for token in tokens[start:end]:
            properties=_effective_properties(token["properties"]) if strip_history else token["properties"]
            signature=_properties_signature(properties)
            if groups and groups[-1][0]==signature:groups[-1][1]+=token["text"]
            else:groups.append([signature,token["text"],properties])
        for _,text,properties in groups:revision.append(_token_run(text,properties,kind=="del"))
        if link is None:results.append(revision)
        else:
            hyperlink=_source_copy(link);hyperlink[:]=[];hyperlink.append(revision);results.append(hyperlink)
        start=end
    return results


def _mark_paragraph_end(paragraph, kind, writer):
    paragraph_properties = paragraph.find(W + "pPr")
    if paragraph_properties is None:
        paragraph_properties = ET.Element(W + "pPr")
        paragraph.insert(0, paragraph_properties)
    run_properties = paragraph_properties.find(W + "rPr")
    if run_properties is None:
        run_properties = ET.SubElement(paragraph_properties, W + "rPr")
    marker = ET.Element(W + kind, writer.attributes())
    run_properties.insert(0, marker)


def _plain_paragraph_from_tokens(source, tokens):
    """Create a comparison-only paragraph while retaining character formatting."""
    paragraph = _inherit_mc_context(ET.Element(W + "p", dict(source.attrib)),source)
    paragraph_properties = source.find(W + "pPr")
    if paragraph_properties is not None:
        paragraph.append(copy.deepcopy(paragraph_properties))
    groups = []
    for token in tokens:
        signature = _properties_signature(token["properties"])
        if groups and groups[-1][0] == signature:
            groups[-1][1] += token["text"]
        else:
            groups.append([signature, token["text"], token["properties"]])
    for _, text, properties in groups:
        paragraph.append(_token_run(text, properties))
    return paragraph


def _paragraph_split_revision(before, first_after, second_after, include_formatting, writer):
    global _MANIFEST_ACTIVE_COMPARISON
    before_text = _comparison_text(before)
    slices = _MANIFEST_ACTIVE_DECISION["splitSlices"]
    boundary = slices[0][1]
    # TypeScript owns the exact source slices; XML only renders those slices.
    before_tokens = _styled_tokens(before)
    first_before = _plain_paragraph_from_tokens(before, before_tokens[:boundary])
    second_before = _plain_paragraph_from_tokens(before, before_tokens[boundary:])
    _MANIFEST_ACTIVE_COMPARISON = _MANIFEST_ACTIVE_DECISION["comparisons"][1]
    revised_first = _paragraph_revision(first_before, first_after, include_formatting, writer)
    paragraph_properties = revised_first.find(W + "pPr")
    existing_break_revision = paragraph_properties.find(".//" + W + "ins") if paragraph_properties is not None else None
    if existing_break_revision is None:
        _mark_paragraph_end(revised_first, "ins", writer)
    _MANIFEST_ACTIVE_COMPARISON = _MANIFEST_ACTIVE_DECISION["comparisons"][2]
    revised_second = _paragraph_revision(second_before, second_after, include_formatting, writer)
    return [revised_first, revised_second]


def _paragraph_merge_revision(first_before, second_before, after, include_formatting, writer):
    global _MANIFEST_ACTIVE_COMPARISON
    combined_tokens = _styled_tokens(first_before) + _styled_tokens(second_before)
    combined_before = _plain_paragraph_from_tokens(first_before, combined_tokens)
    _MANIFEST_ACTIVE_COMPARISON = _MANIFEST_ACTIVE_DECISION["comparisons"][1]
    revised_after = _paragraph_revision(combined_before, after, include_formatting, writer)
    # A deleted empty paragraph mark records the structural merge. Accepting the
    # revision removes that boundary while leaving the after paragraph intact.
    deleted_boundary = ET.Element(W + "p", dict(first_before.attrib))
    paragraph_properties = _project_properties(first_before.find(W + "pPr"), after.find(W + "pPr"), "pPr")
    if paragraph_properties is not None:
        deleted_boundary.append(_accepted_copy(paragraph_properties))
    _mark_paragraph_end(deleted_boundary, "del", writer)
    return [deleted_boundary, revised_after]


def _project_properties(before, after, property_name):
    if not _MANIFEST["options"]["formatting"]:
        return copy.deepcopy(after) if after is not None else None
    allowed = _MANIFEST_ALLOWED_PROPERTIES[property_name]
    result = _effective_properties(after) if after is not None else ET.Element(W + property_name)
    for child in list(result):
        if child.tag in allowed: result.remove(child)
    if before is not None:
        for child in before:
            if child.tag in allowed: result.append(_effective_properties(child))
    order = [child.tag for child in before] if before is not None else []
    order.extend(child.tag for child in result if child.tag not in order)
    result[:] = sorted(list(result), key=lambda child: order.index(child.tag))
    return result if len(result) or result.attrib else None


def _restore_projected_tokens(tokens, before_start, projections):
    result = []
    ordered = sorted(projections, key=lambda item: item["beforeStart"])
    cursor = bisect.bisect_right([item["beforeStart"] for item in ordered], before_start) - 1
    for offset, token in enumerate(tokens):
        position = before_start + offset
        while cursor >= 0 and cursor < len(ordered) and ordered[cursor]["beforeStart"] + ordered[cursor]["length"] <= position: cursor += 1
        if cursor < 0 or cursor >= len(ordered) or not ordered[cursor]["beforeStart"] <= position < ordered[cursor]["beforeStart"] + ordered[cursor]["length"]: raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_PROJECTION")
        projection = ordered[cursor]
        after_properties = None
        if projection["policy"] == "copy-revised-run":
            source = _MANIFEST_SOURCE_NODES.get(("after", _manifest_key(projection["source"])))
            if source is None: raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_SOURCE")
            after_properties = source.find(W + "rPr")
        revised = dict(token)
        revised["properties"] = _project_properties(token["properties"], after_properties, "rPr")
        result.append(revised)
    return result


def _restore_whole_properties(result, source, property_name):
    origin = _MANIFEST_NODE_KEYS.get(source)
    if origin is None: raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_SOURCE")
    pairs = [pair for pair in _MANIFEST["restorePropertyPairs"] if pair["property"] == property_name and _manifest_key(pair["before"]) == origin[1]]
    if not pairs: return
    if len(pairs) != 1: raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_SOURCE")
    after = _MANIFEST_SOURCE_NODES.get(("after", _manifest_key(pairs[0]["after"])))
    if after is None: raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_SOURCE")
    action = _property_action(source, after, W + property_name) if _MANIFEST["options"]["formatting"] else None
    properties = _project_properties(source.find(W + property_name), after.find(W + property_name), property_name)
    current = result.find(W + property_name)
    if current is not None: result.remove(current)
    if properties is not None: result.insert(0, properties)


def _whole_paragraph_revision(source, kind, writer):
    paragraph = _inherit_mc_context(ET.Element(W + "p", dict(source.attrib)),source)
    paragraph_properties = source.find(W + "pPr")
    restoration = None
    if kind == "del" and source in _MANIFEST_NODE_KEYS:
        origin = _MANIFEST_NODE_KEYS[source][1]
        matches = [entry for decision in _MANIFEST_DECISIONS if decision.get("deletedFormattingPolicy") == "paired-revised" and decision["before"] and decision["after"] for entry in decision.get("wholeRestoreStyles", []) if _manifest_key(entry["before"]) == origin]
        if len(matches) > 1: raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_SOURCE")
        restoration = matches[0] if matches else None
        if restoration is not None:
            after = _MANIFEST_SOURCE_NODES.get(("after", _manifest_key(restoration["afterParagraph"])))
            if after is None: raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_SOURCE")
            paragraph_properties = _project_properties(paragraph_properties, after.find(W + "pPr"), "pPr")
    if paragraph_properties is not None:
        paragraph.append(copy.deepcopy(paragraph_properties) if kind == "ins" else _accepted_copy(paragraph_properties))
    _mark_paragraph_end(paragraph, kind, writer)
    if kind == "ins":
        tokens, events = _styled_tokens(source, collect_events=True)
    else:
        tokens, events = _styled_tokens(source, collect_events=True)
        if restoration is not None: tokens = _restore_projected_tokens(tokens, 0, restoration["projections"])
    if kind == "del":
        cursor=0
        for position in sorted(set(events)|{len(tokens)}):
            if position>cursor:paragraph.extend(_revision_containers(kind,tokens[cursor:position],writer,strip_history=True))
            for event in events.get(position,[]):
                if _is_drawing_event(event):paragraph.append(_drawing_revision(event,"del",writer))
            cursor=position
        return paragraph

    emitted_wrappers = set()
    position = 0
    while position <= len(tokens):
        for event in events.get(position, []):
            if _is_drawing_event(event):paragraph.append(_drawing_revision(event,"ins",writer))
            else:paragraph.append(copy.deepcopy(event))
        if position == len(tokens):
            break
        wrapper = tokens[position].get("wrapper")
        if wrapper is not None:
            wrapper_id, wrapper_element = wrapper
            if wrapper_id not in emitted_wrappers:
                paragraph.append(copy.deepcopy(wrapper_element))
                emitted_wrappers.add(wrapper_id)
            position += 1
            continue
        end = position + 1
        signature = _properties_signature(tokens[position]["properties"])
        while end < len(tokens) and end not in events and tokens[end].get("wrapper") is None:
            if _properties_signature(tokens[end]["properties"]) != signature:
                break
            end += 1
        paragraph.extend(_revision_containers(kind, tokens[position:end], writer))
        position = end
    return paragraph


def _shared_text_opcodes(before, after):
    """Adapt shared TypeScript diff segments to code-point token ranges."""
    try:
        if _MANIFEST is not None:
            if _MANIFEST_ACTIVE_DECISION is None:
                raise ValueError("MISSING_COMPARISON_DECISION")
            comparison = _MANIFEST_ACTIVE_COMPARISON
            if comparison is None or comparison["before"] != before or comparison["after"] != after:
                raise ValueError("MISSING_COMPARISON_DECISION_TEXT")
            encoded = json.dumps(comparison["segments"])
        else:
            encoded = worklazyDiffJson(before, after)
    except Exception as error:
        raise ValueError("SHARED_DIFF_CALL_FAILED") from error
    if not isinstance(encoded, str):
        raise TypeError("SHARED_DIFF_RESULT_NOT_JSON")
    try:
        segments = json.loads(encoded)
    except (TypeError, ValueError) as error:
        raise ValueError("SHARED_DIFF_RESULT_NOT_JSON") from error
    if not isinstance(segments, list):
        raise TypeError("SHARED_DIFF_RESULT_NOT_LIST")

    before_cursor = 0
    after_cursor = 0
    for segment in segments:
        if not isinstance(segment, dict):
            raise TypeError("SHARED_DIFF_SEGMENT_NOT_OBJECT")
        kind = segment.get("type")
        text = segment.get("text")
        if kind not in ("equal", "deleted", "added") or not isinstance(text, str):
            raise TypeError("SHARED_DIFF_SEGMENT_INVALID")

        # Python len/slices count Unicode code points. JavaScript UTF-16 length
        # must never be used to address the character-token arrays below.
        size = len(text)
        before_end = before_cursor + (size if kind != "added" else 0)
        after_end = after_cursor + (size if kind != "deleted" else 0)
        if kind != "added" and before[before_cursor:before_end] != text:
            raise ValueError("SHARED_DIFF_BEFORE_RECONSTRUCTION_FAILED")
        if kind != "deleted" and after[after_cursor:after_end] != text:
            raise ValueError("SHARED_DIFF_AFTER_RECONSTRUCTION_FAILED")
        if size:
            opcode = "equal" if kind == "equal" else "delete" if kind == "deleted" else "insert"
            yield opcode, before_cursor, before_end, after_cursor, after_end
        before_cursor = before_end
        after_cursor = after_end

    if before_cursor != len(before) or after_cursor != len(after):
        raise ValueError("SHARED_DIFF_OFFSET_MISMATCH")


def _append_link_run(parent, run, token):
    link=token.get("link")
    if link is None:parent.append(run)
    else:
        hyperlink=_source_copy(link);hyperlink[:]=[];hyperlink.append(run);parent.append(hyperlink)


def _link_identity(token):
    link=token.get("link")
    if link is None:return None
    origin=_MANIFEST_NODE_KEYS.get(link)
    if origin is None:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_SOURCE")
    side,key=origin
    entry=next((source for source in _MANIFEST_ACTIVE_DECISION.get("objectEvents",{}).get(side,[]) if _manifest_key(source)==key),None)
    if entry is None:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_SOURCE")
    return entry["objectEvent"]["signature"]


def _drawing_revision(source, kind, writer):
    run=ET.Element(W+"r")
    origin=_MANIFEST_NODE_KEYS.get(source)
    parent=_MANIFEST_SOURCE_NODES.get((origin[0],(origin[1][0],origin[1][1][:-1]))) if origin else None
    properties=parent.find(W+"rPr") if parent is not None and parent.tag==W+"r" else None
    if properties is not None:run.append(_effective_properties(properties) if kind=="del" else copy.deepcopy(properties))
    run.append(_source_copy(source))
    revision=ET.Element(W+kind,writer.attributes());revision.append(run)
    return revision


def _paragraph_revision(before, after, include_formatting, writer):
    before_text = _comparison_text(before)
    after_text = _comparison_text(after)
    # Source revisions cannot be nested safely inside a second insertion or
    # deletion. Keep the after-document author's text revision intact and let
    # that existing revision explain the visible change. This avoids producing
    # a mixed reject state such as "동의 없는금을" when revisions overlap.
    if before_text != after_text and _has_visible_text_revision(after):
        return copy.deepcopy(after)
    before_tokens, before_events = _styled_tokens(before,collect_events=True)
    after_tokens, after_events = _styled_tokens(after, collect_events=True)
    before_values = [token["text"] for token in before_tokens]
    after_values = [token["text"] for token in after_tokens]
    before_paragraph_properties = before.find(W + "pPr")
    paragraph_properties = after.find(W + "pPr")
    formatting = (_MANIFEST_ACTIVE_COMPARISON or {}).get("formatting", {})
    paragraph_families = formatting.get("paragraphFamilies", []) if include_formatting else []
    spans = formatting.get("spans", []) if include_formatting else []
    format_changed = bool(paragraph_families or spans)
    object_changed=((_MANIFEST_ACTIVE_DECISION or {}).get("objectEvents") or {}).get("changed",False)
    if before_text == after_text and not format_changed and not object_changed:
        return copy.deepcopy(after)

    paragraph = ET.Element(W + "p", dict(after.attrib))
    revised_paragraph_properties = (
        _property_revision(paragraph_properties, before_paragraph_properties, W + "pPr", W + "pPrChange", writer, paragraph_families, formatting.get("paragraphHistory", False))
        if include_formatting
        else copy.deepcopy(paragraph_properties) if paragraph_properties is not None else None
    )
    if revised_paragraph_properties is not None:
        paragraph.append(revised_paragraph_properties)

    emitted_event_positions = set()
    emitted_wrappers = set()

    def emit_events(position):
        if position in emitted_event_positions:
            return
        emitted_event_positions.add(position)
        for event in after_events.get(position, []):
            if _is_drawing_event(event):paragraph.append(_drawing_revision(event,"ins",writer))
            else:paragraph.append(copy.deepcopy(event))

    emitted_before_events=set()
    def emit_before_events(position):
        if position in emitted_before_events:return
        emitted_before_events.add(position)
        for event in before_events.get(position,[]):
            if _is_drawing_event(event):paragraph.append(_drawing_revision(event,"del",writer))

    def emit_deleted(start,end):
        cursor=start
        for position in sorted({value for value in before_events if start<=value<=end}|{end}):
            if cursor<position:paragraph.extend(_revision_containers("del",(_restore_projected_tokens(before_tokens[cursor:position],cursor,_MANIFEST_ACTIVE_COMPARISON["restoreStyles"]) if _MANIFEST is not None else before_tokens[cursor:position]),writer,strip_history=True))
            emit_before_events(position);cursor=position

    def emit_existing_wrapper(token):
        wrapper = token.get("wrapper")
        if wrapper is None:
            return False
        wrapper_id, wrapper_element = wrapper
        if wrapper_id not in emitted_wrappers:
            paragraph.append(copy.deepcopy(wrapper_element))
            emitted_wrappers.add(wrapper_id)
        return True

    def emit_equal(i1, j1, j2):
        position = j1
        while position < j2:
            emit_before_events(i1 + position-j1)
            emit_events(position)
            token = after_tokens[position]
            if emit_existing_wrapper(token):
                position += 1
                continue
            before_position = i1 + (position - j1)
            before_properties = before_tokens[before_position]["properties"]
            after_properties = token["properties"]
            def declared(position_before, position_after):
                for span in spans:
                    offset = position_before - span["beforeStart"]
                    if 0 <= offset < span["length"] and position_after == span["afterStart"] + offset:
                        return span["families"], span.get("history", False), span["scopeId"]
                return [], False, None
            families, preserve_history, scope_id = declared(before_position, position)
            link_pair=(_link_identity(before_tokens[before_position]),_link_identity(token))
            pair = (scope_id, families, preserve_history, _properties_signature(after_properties),link_pair)
            end = position + 1
            while end < j2 and end not in after_events and after_tokens[end].get("wrapper") is None:
                next_families, next_history, next_scope_id = declared(i1 + (end - j1), end)
                if (next_scope_id, next_families, next_history, _properties_signature(after_tokens[end]["properties"]),(_link_identity(before_tokens[i1+end-j1]),_link_identity(after_tokens[end]))) != pair:
                    break
                end += 1
            text = "".join(item["text"] for item in after_tokens[position:end])
            revised_properties = _property_revision(after_properties, before_properties, W + "rPr", W + "rPrChange", writer, families, preserve_history) if families else after_properties
            if link_pair[0]!=link_pair[1]:
                paragraph.extend(_revision_containers("del",_restore_projected_tokens(before_tokens[before_position:before_position+end-position],before_position,_MANIFEST_ACTIVE_COMPARISON["restoreStyles"]),writer,strip_history=True))
                paragraph.extend(_revision_containers("ins",after_tokens[position:end],writer))
            else:_append_link_run(paragraph,_token_run(text,revised_properties),token)
            position = end
        emit_before_events(i1+j2-j1)
        emit_events(j2)

    def emit_inserted(j1, j2):
        position = j1
        while position < j2:
            emit_events(position)
            token = after_tokens[position]
            if emit_existing_wrapper(token):
                position += 1
                continue
            signature = _properties_signature(token["properties"])
            end = position + 1
            while end < j2 and end not in after_events and after_tokens[end].get("wrapper") is None:
                if _properties_signature(after_tokens[end]["properties"]) != signature or _link_identity(after_tokens[end])!=_link_identity(token):
                    break
                end += 1
            paragraph.extend(_revision_containers("ins", after_tokens[position:end], writer))
            position = end
        emit_events(j2)

    for tag, i1, i2, j1, j2 in _shared_text_opcodes("".join(before_values), "".join(after_values)):
        if tag == "equal":
            emit_equal(i1, j1, j2)
        else:
            emit_events(j1)
            if i1 < i2:
                emit_deleted(i1,i2)
            if j1 < j2:
                emit_inserted(j1, j2)
    emit_before_events(len(before_tokens))
    emit_events(len(after_tokens))
    return paragraph








def _mark_row(row, kind, writer):
    row_properties = row.find(W + "trPr")
    if row_properties is None:
        row_properties = ET.Element(W + "trPr")
        row.insert(0, row_properties)
    marker = ET.Element(W + kind, writer.attributes())
    change = row_properties.find(W + "trPrChange")
    if change is None:
        row_properties.append(marker)
    else:
        row_properties.insert(list(row_properties).index(change), marker)


def _mark_cell(cell, kind, writer):
    cell_properties = cell.find(W + "tcPr")
    if cell_properties is None:
        cell_properties = ET.Element(W + "tcPr")
        cell.insert(0, cell_properties)
    marker = ET.Element(W + kind, writer.attributes())
    change = cell_properties.find(W + "tcPrChange")
    if change is None:
        cell_properties.append(marker)
    else:
        cell_properties.insert(list(cell_properties).index(change), marker)


def _replace_direct_children(container, tag, replacements):
    children = list(container)
    positions = [index for index, child in enumerate(children) if child.tag == tag]
    insertion_index = positions[0] if positions else len(children)
    for child in children:
        if child.tag == tag:
            container.remove(child)
    for offset, replacement in enumerate(replacements):
        container.insert(insertion_index + offset, replacement)


def _cell_revision(before, after, include_formatting, writer):
    cell = copy.deepcopy(after)
    before_blocks = [child for child in before if child.tag in BLOCK_TAGS]
    after_blocks = [child for child in after if child.tag in BLOCK_TAGS]
    revised_blocks = _revision_blocks(before_blocks, after_blocks, include_formatting, writer)
    _replace_blocks(cell, revised_blocks)
    if include_formatting:
        _apply_property_revision(cell, before, W + "tcPr", W + "tcPrChange", writer, after)
    return cell


def _table_revision(before, after, include_formatting, writer):
    before_rows = before.findall(W + "tr")
    after_rows = after.findall(W + "tr")
    decision = _manifest_decision(before, after)
    row_pairs = [(pair["beforeIndex"], pair["afterIndex"]) for pair in decision["rows"]]
    column_pairs = [(pair["beforeIndex"], pair["afterIndex"]) for pair in decision["columns"]]

    table = copy.deepcopy(after)
    revised_rows = []
    for before_row_index, after_row_index in row_pairs:
        if before_row_index is None:
            _consume_manifest_subtree("after", after_rows[after_row_index])
            row = copy.deepcopy(after_rows[after_row_index])
            _mark_row(row, "ins", writer)
            revised_rows.append(row)
            continue
        if after_row_index is None:
            _consume_manifest_subtree("before", before_rows[before_row_index])
            row = _accepted_copy(before_rows[before_row_index])
            _mark_row(row, "del", writer)
            _revisionize_deleted_row(row, writer, before_rows[before_row_index])
            revised_rows.append(row)
            continue

        before_row = before_rows[before_row_index]
        after_row = after_rows[after_row_index]
        before_cells = before_row.findall(W + "tc")
        after_cells = after_row.findall(W + "tc")
        row = copy.deepcopy(after_row)
        revised_cells = []
        for before_column_index, after_column_index in column_pairs:
            before_cell = before_cells[before_column_index] if before_column_index is not None and before_column_index < len(before_cells) else None
            after_cell = after_cells[after_column_index] if after_column_index is not None and after_column_index < len(after_cells) else None
            if before_cell is None and after_cell is not None:
                _consume_manifest_subtree("after", after_cell)
                cell = copy.deepcopy(after_cell)
                _mark_cell(cell, "cellIns", writer)
            elif after_cell is None and before_cell is not None:
                _consume_manifest_subtree("before", before_cell)
                cell = _accepted_copy(before_cell)
                _mark_cell(cell, "cellDel", writer)
            elif before_cell is not None and after_cell is not None:
                cell = _cell_revision(before_cell, after_cell, include_formatting, writer)
            else:
                continue
            revised_cells.append(cell)
        _replace_direct_children(row, W + "tc", revised_cells)
        if include_formatting:
            _apply_property_revision(row, before_row, W + "trPr", W + "trPrChange", writer, after_row)
        revised_rows.append(row)

    _replace_direct_children(table, W + "tr", revised_rows)
    if include_formatting:
        _apply_property_revision(table, before, W + "tblPr", W + "tblPrChange", writer, after)
    return table


def _whole_table_revision(source, kind, writer):
    _consume_manifest_subtree("after" if kind == "ins" else "before", source)
    table = copy.deepcopy(source) if kind == "ins" else _accepted_copy(source)
    if kind == "del": _restore_whole_properties(table, source, "tblPr")
    for index, row in enumerate(table.findall(W + "tr")):
        original = source.findall(W + "tr")[index]
        if kind == "del":
            _restore_whole_properties(row, original, "trPr")
            _revisionize_deleted_row(row, writer, original)
        _mark_row(row, kind, writer)
    return table


def _revisionize_deleted_row(row, writer, source_row=None):
    originals = list(source_row.iter(W + "p")) if source_row is not None else None
    paragraphs = list(row.iter(W + "p"))
    if originals is not None and len(originals) != len(paragraphs): raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
    if source_row is not None:
        for cell, original in zip(row.findall(W + "tc"), source_row.findall(W + "tc")):
            _restore_whole_properties(cell, original, "tcPr")
    parents = {child: parent for parent in row.iter() for child in parent}
    for index, paragraph in enumerate(paragraphs):
        parent = parents[paragraph]
        position = list(parent).index(paragraph)
        parent.remove(paragraph)
        parent.insert(position, _whole_paragraph_revision(originals[index] if originals is not None else paragraph, "del", writer))


def _whole_content_control_revision(source, kind, writer, include_formatting, include_tables):
    result = copy.deepcopy(source)
    content = result.find(CONTENT_CONTROL_BODY_TAG)
    source_content = source.find(CONTENT_CONTROL_BODY_TAG)
    if content is None or source_content is None:
        return result
    source_blocks = [child for child in source_content if child.tag in BLOCK_TAGS]
    revised_blocks = _revision_blocks(
        [] if kind == "ins" else source_blocks,
        source_blocks if kind == "ins" else [],
        include_formatting,
        writer,
        include_tables,
    )
    _replace_blocks(content, revised_blocks)
    return result


def _content_control_revision(before, after, include_formatting, writer, include_tables):
    if after.tag == CONTENT_CONTROL_TAG:
        result = copy.deepcopy(after)
        result_content = result.find(CONTENT_CONTROL_BODY_TAG)
        after_content = after.find(CONTENT_CONTROL_BODY_TAG)
        if result_content is None or after_content is None:
            return [result]
        before_blocks = (
            _content_control_blocks(before)
            if before.tag == CONTENT_CONTROL_TAG
            else [before]
        )
        after_blocks = [child for child in after_content if child.tag in BLOCK_TAGS]
        _replace_blocks(
            result_content,
            _revision_blocks(before_blocks, after_blocks, include_formatting, writer, include_tables),
        )
        return [result]

    before_blocks = _content_control_blocks(before)
    return _revision_blocks(before_blocks, [after], include_formatting, writer, include_tables)


# The TypeScript comparison result is the sole source of pairing decisions.
# XML paths are registered against each parsed part before any node is copied.
_MANIFEST = None
_MANIFEST_NODE_KEYS = {}
_MANIFEST_DECISIONS = []
_MANIFEST_USED = set()
_MANIFEST_CONSUMED = {}
_MANIFEST_ACTIVE_DECISION = None
_MANIFEST_ACTIVE_COMPARISON = None
_MANIFEST_PROPERTY_USED = set()
_MANIFEST_SOURCE_NODES = {}
_MANIFEST_ALLOWED_PROPERTIES = {}


def _manifest_key(source):
    if not isinstance(source, dict) or not isinstance(source.get("part"), str) or not isinstance(source.get("path"), list) or any(type(index) is not int or index < 0 for index in source["path"]):
        raise ValueError("INVALID_COMPARISON_MANIFEST_SOURCE_REF")
    return (source["part"], tuple(source["path"]))


def _validate_manifest(before_path, after_path):
    """Validate ownership against raw input, without choosing correspondences."""
    actual = {}
    nodes = {}
    for side, path in (("before", before_path), ("after", after_path)):
        with open(path, "rb") as source:
            model = json.loads(extract_document_model(source.read(), True, True, "en"))
        if _MANIFEST.get("fields", {}).get(side) != model.get("fields", []):
            raise ValueError("INVALID_COMPARISON_MANIFEST_FIELD_ANNOTATIONS")
        provenance = _MANIFEST.get("provenance", {}).get(side)
        if provenance is not None and provenance.get("comparisonSha256") != model["sourceRevision"]:
            raise ValueError("STALE_COMPARISON_MANIFEST_PROVENANCE")
        inventory = model["sourceInventory"]
        entries = {_manifest_key(ref): ref for ref in inventory}
        supplied = _MANIFEST["sources"][side]
        if len(supplied) != len(entries) or {_manifest_key(ref): ref for ref in supplied} != entries:
            raise ValueError("INVALID_COMPARISON_MANIFEST_SOURCE_INVENTORY")
        actual[side] = entries
        nodes[side] = {}
        with zipfile.ZipFile(path) as archive:
            for part in {ref[0] for ref in entries}:
                root = _parse_xml(archive.read(part))
                def visit(node, path):
                    nodes[side][(part, tuple(path))] = node
                    for index, child in enumerate(node):
                        visit(child, path + [index])
                visit(root, [])

    ids = set()
    owners = {"before": {}, "after": {}}
    for decision in _MANIFEST_DECISIONS:
        decision_id = decision.get("id")
        if not isinstance(decision_id, str) or decision_id in ids:
            raise ValueError("INVALID_COMPARISON_MANIFEST_DUPLICATE_DECISION")
        ids.add(decision_id)
        representation = decision.get("trackedRepresentation")
        reason = decision.get("trackedReason")
        if representation not in {"revision", "preserve-after"}:
            raise ValueError("INVALID_COMPARISON_MANIFEST_REPRESENTATION")
        if representation == "preserve-after":
            refs = decision["before"] + decision["after"]
            if reason != "existing-comment-contract" or not refs or any(ref["part"] != "word/comments.xml" for ref in refs):
                raise ValueError("INVALID_COMPARISON_MANIFEST_REPRESENTATION")
        elif reason is not None:
            raise ValueError("INVALID_COMPARISON_MANIFEST_REPRESENTATION")
        before_refs, after_refs = decision["before"], decision["after"]
        shape = (len(before_refs), len(after_refs))
        if shape not in {(1, 0), (0, 1), (1, 1), (1, 2), (2, 1)}:
            raise ValueError("INVALID_COMPARISON_MANIFEST_GROUP")
        for side in ("before", "after"):
            for ref in decision[side]:
                key = _manifest_key(ref)
                if key not in actual[side] or key in owners[side]:
                    raise ValueError("INVALID_COMPARISON_MANIFEST_SOURCE_OWNERSHIP")
                kind = actual[side][key]["kind"]
                if representation == "preserve-after" and kind != "comment":
                    if kind != "p" or not any(actual[side].get((key[0], key[1][:length]), {}).get("kind") == "comment" for length in range(len(key[1]))):
                        raise ValueError("INVALID_COMPARISON_MANIFEST_REPRESENTATION")
                expected_kind = "tbl" if decision["type"] == "table" else "p"
                if kind != expected_kind and not (kind == "comment" and decision.get("trackedReason") == "existing-comment-contract"):
                    raise ValueError("INVALID_COMPARISON_MANIFEST_NODE_KIND")
                owners[side][key] = decision
            if decision["type"] == "paragraph" and not any(actual[side][_manifest_key(ref)]["kind"] == "comment" for ref in decision[side]):
                raw = "\n".join(actual[side][_manifest_key(ref)].get("rawText", "") for ref in decision[side])
                if raw != decision[side + "Text"]:
                    raise ValueError("INVALID_COMPARISON_MANIFEST_TEXT_BOUNDS")
        allowed_pairs = {(decision["beforeText"], decision["afterText"])}
        if shape == (1, 2):
            slices = decision.get("splitSlices", [])
            if len(slices) == 2 and all(isinstance(pair, list) and len(pair) == 2 and all(type(value) is int for value in pair) for pair in slices):
                allowed_pairs.update((decision["beforeText"][start:end], actual["after"][_manifest_key(after_refs[index])].get("rawText", "")) for index, (start, end) in enumerate(slices))
        if shape == (2, 1):
            allowed_pairs.add(("".join(actual["before"][_manifest_key(ref)].get("rawText", "") for ref in before_refs), decision["afterText"]))
        comparisons = decision.get("comparisons", [])
        if {(item["before"], item["after"]) for item in comparisons} != allowed_pairs:
            raise ValueError("INVALID_COMPARISON_MANIFEST_COMPARISON_CONTEXT")
        for comparison in comparisons:
            _validate_segments(comparison["segments"], comparison["before"], comparison["after"])
        for side in ("before", "after"):
            if decision.get("trackedRepresentation") != "preserve-after":
                opposite_parts = {key[0] for key in actual["after" if side == "before" else "before"]}
                if any(ref["part"] not in opposite_parts for ref in decision[side]):
                    raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
        _validate_segments(decision["textSegments"], decision["beforeText"], decision["afterText"])
        if shape == (1, 2):
            slices = decision.get("splitSlices")
            size = len(decision["beforeText"])
            if not isinstance(slices, list) or len(slices) != 2 or slices[0][0] != 0 or slices[0][1] != slices[1][0] or slices[1][1] != size or not 0 <= slices[0][1] <= size:
                raise ValueError("INVALID_COMPARISON_MANIFEST_SPLIT_SLICES")
            for index, (start, end) in enumerate(slices):
                old = decision["beforeText"][start:end]
                new = _comparison_text(nodes["after"][_manifest_key(after_refs[index])])
                if not any(item["before"] == old and item["after"] == new for item in decision["comparisons"]):
                    raise ValueError("INVALID_COMPARISON_MANIFEST_SPLIT_TEXT")
        if decision["type"] == "table":
            if shape not in {(1, 0), (0, 1), (1, 1)}:
                raise ValueError("INVALID_COMPARISON_MANIFEST_TABLE_GROUP")
            for axis, tag in (("rows", "tr"), ("columns", "tc")):
                for side in ("before", "after"):
                    table = nodes[side][_manifest_key(decision[side][0])] if decision[side] else None
                    rows = table.findall(W + "tr") if table is not None else []
                    size = len(rows) if axis == "rows" else max((len(row.findall(W + "tc")) for row in rows), default=0)
                    indices = [pair[side + "Index"] for pair in decision[axis] if pair[side + "Index"] is not None]
                    if any(type(index) is not int for index in indices) or indices != list(range(size)):
                        raise ValueError("INVALID_COMPARISON_MANIFEST_TABLE_AXIS")
                if any(pair["beforeIndex"] is None and pair["afterIndex"] is None for pair in decision[axis]):
                    raise ValueError("INVALID_COMPARISON_MANIFEST_TABLE_AXIS")

    _validate_restore_styles(actual)
    _validate_formatting_manifest(actual, json.loads(WORKLAZY_FORMATTING_POLICY_JSON))

    note_mappings = {}
    note_contexts = {"before": set(), "after": set()}
    for decision in _MANIFEST_DECISIONS:
        contexts = {}
        for side in ("before", "after"):
            contexts[side] = {(ref["part"], tuple(ref["path"][:1])) for ref in decision[side] if ref["part"] in {"word/footnotes.xml", "word/endnotes.xml"}}
            note_contexts[side].update(contexts[side])
        if contexts["before"] and contexts["after"]:
            if len(contexts["before"]) != 1 or len(contexts["after"]) != 1:
                raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
            before_context = next(iter(contexts["before"]))
            after_context = next(iter(contexts["after"]))
            if before_context != after_context or nodes["before"][before_context].get(W + "id") != nodes["after"][after_context].get(W + "id"):
                raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
            note_mappings[before_context] = after_context
    if note_contexts["before"] != set(note_mappings) or note_contexts["after"] != set(note_mappings.values()):
        raise ValueError("UNSUPPORTED_TRACKED_SOURCE")

    for side in ("before", "after"):
        structural = {key: ref for key, ref in actual[side].items() if ref["kind"] in {"p", "tbl"}}
        coverage = _MANIFEST.get("coverage", {}).get(side, [])
        if len(coverage) != len(structural) or len({_manifest_key(item["source"]) for item in coverage}) != len(coverage):
            raise ValueError("INVALID_COMPARISON_MANIFEST_COVERAGE")
        tables = [key for key, ref in actual[side].items() if ref["kind"] == "tbl"]
        for item in coverage:
            key = _manifest_key(item["source"])
            if key not in structural:
                raise ValueError("INVALID_COMPARISON_MANIFEST_COVERAGE")
            ref = structural[key]
            owner = owners[side].get(key)
            excluded_metadata = not _MANIFEST["options"]["metadata"] and key[0] != "word/document.xml"
            excluded_table = not _MANIFEST["options"]["tables"] and any(key[0] == part and key[1][:len(path)] == path for part, path in tables)
            if excluded_metadata or excluded_table:
                if item["disposition"] != "preserve-after":
                    raise ValueError("INVALID_COMPARISON_MANIFEST_EXCLUSION")
                continue
            comment_owner = next((candidate for candidate in _MANIFEST_DECISIONS if candidate.get("trackedReason") == "existing-comment-contract" and any(parent["part"] == key[0] and key[1][:len(parent["path"])] == tuple(parent["path"]) for parent in candidate[side])), None)
            if comment_owner is not None:
                if owner is not None:
                    if item["disposition"] != "decision" or item.get("decisionId") != owner["id"]:
                        raise ValueError("INVALID_COMPARISON_MANIFEST_COVERAGE")
                elif item["disposition"] != "preserve-after" or item.get("decisionId") != comment_owner["id"] or item.get("reason") != "existing-comment-contract":
                    raise ValueError("INVALID_COMPARISON_MANIFEST_COVERAGE")
                continue
            if ref.get("unsupportedObjectQName"):raise ValueError("UNSUPPORTED_TRACKED_SOURCE_QNAME")
            event_owner = owner if owner and ref.get("objectEventsSupported") else None
            if event_owner is not None:
                if any(parent["type"]=="table" and (parent.get("moved") or len(parent["before"])!=1 or len(parent["after"])!=1) and any(ref["part"]==key[0] and key[1][:len(ref["path"])]==tuple(ref["path"]) for ref in parent[side]) for parent in _MANIFEST_DECISIONS):raise ValueError("UNSUPPORTED_TRACKED_SOURCE_TABLE_OBJECT_AXIS")
                declared = event_owner.get("objectEvents", {}).get(side)
                expected = [source for source in actual[side].values() if source.get("objectEvent") and source["part"] == key[0] and source["objectEvent"]["paragraphPath"] == list(key[1])]
                # Current event codec handles whole paragraphs and paired 1:1;
                # split/merge object boundaries remain a distinct next stage.
                if len(owner["before"]) > 1 or len(owner["after"]) > 1 or declared is None or len(declared) != len(expected) or {_manifest_key(source): source for source in declared} != {_manifest_key(source): source for source in expected}:
                    raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_EVENTS")
            if ref.get("opaqueSignature") and event_owner is None:
                if owner is None or len(owner["before"]) != 1 or len(owner["after"]) != 1:
                    raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
                unsafe_parent = any(parent["type"] == "table" and (parent.get("moved") or len(parent["before"]) != 1 or len(parent["after"]) != 1) and any(ref["part"] == key[0] and key[1][:len(ref["path"])] == tuple(ref["path"]) for ref in parent[side]) for parent in _MANIFEST_DECISIONS)
                if unsafe_parent or owner.get("moved") or owner["beforeText"] != owner["afterText"]:
                    raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
                before_copy = actual["before"][_manifest_key(owner["before"][0])].get("copySignature")
                after_copy = actual["after"][_manifest_key(owner["after"][0])].get("copySignature")
                if before_copy != after_copy:
                    raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
                old = actual["before"][_manifest_key(owner["before"][0])].get("opaqueSignature")
                new = actual["after"][_manifest_key(owner["after"][0])].get("opaqueSignature")
                if old != new:
                    raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
            if owner is not None:
                if item["disposition"] != "decision" or item.get("decisionId") != owner["id"]:
                    raise ValueError("INVALID_COMPARISON_MANIFEST_COVERAGE")
            elif ref["kind"] == "p" and not ref.get("rawText", "").strip() and not ref.get("opaqueSignature"):
                if item["disposition"] != "preserve-after" or item.get("reason") != "blank-paragraph":
                    raise ValueError("INVALID_COMPARISON_MANIFEST_BLANK_POLICY")
            else:
                raise ValueError("UNSUPPORTED_TRACKED_SOURCE")


def _validate_restore_styles(actual):
    if _MANIFEST.get("restoreStylePolicyVersion") != "worklazy-restore-style-1": raise ValueError("STALE_COMPARISON_MANIFEST")
    def children(side, parent, kind):
        part, path = parent
        return sorted(key for key, source in actual[side].items() if key[0] == part and source["kind"] == kind and len(key[1]) == len(path) + 1 and key[1][:len(path)] == path)
    expected_pairs = set()
    for decision in _MANIFEST_DECISIONS:
        if any(field in decision for field in ("sourceSlices", "restoreStyles")) or any(any(field in comparison for field in ("wholeRestoreStyles", "deletedFormattingPolicy")) for comparison in decision.get("comparisons", [])):
            raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_POLICY")
        if decision["type"] != "paragraph" or decision.get("trackedRepresentation") != "revision":
            if "wholeRestoreStyles" in decision or "deletedFormattingPolicy" in decision or any("sourceSlices" in comparison or "restoreStyles" in comparison for comparison in decision.get("comparisons", [])):
                raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_POLICY")
        if decision["type"] == "table" and len(decision["before"]) == len(decision["after"]) == 1:
            before, after = _manifest_key(decision["before"][0]), _manifest_key(decision["after"][0])
            expected_pairs.add((before, after, "tblPr"))
            left, right = children("before", before, "tr"), children("after", after, "tr")
            for row in decision["rows"]:
                if row["beforeIndex"] is None or row["afterIndex"] is None: continue
                a, b = left[row["beforeIndex"]], right[row["afterIndex"]]
                expected_pairs.add((a, b, "trPr"))
                old_cells, new_cells = children("before", a, "tc"), children("after", b, "tc")
                for column in decision["columns"]:
                    x, y = column["beforeIndex"], column["afterIndex"]
                    if x is not None and y is not None and x < len(old_cells) and y < len(new_cells): expected_pairs.add((old_cells[x], new_cells[y], "tcPr"))
    pairs = _MANIFEST.get("restorePropertyPairs", [])
    if len(pairs) != len(expected_pairs) or {(_manifest_key(pair["before"]), _manifest_key(pair["after"]), pair["property"]) for pair in pairs} != expected_pairs:
        raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_PROPERTY_PAIRS")
    for decision in _MANIFEST_DECISIONS:
        expected = {side:[source for ref in decision[side] for source in actual[side].values() if source.get("objectEvent") and source["part"] == ref["part"] and source["objectEvent"]["paragraphPath"] == ref["path"]] for side in ("before","after")} if decision["type"] == "paragraph" and decision.get("trackedRepresentation") == "revision" else {"before":[],"after":[]}
        events=decision.get("objectEvents")
        if not any(expected.values()):
            if events is not None:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_EVENTS")
            continue
        if events is None or events.get("policy") != "worklazy-source-events-1":raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_EVENTS")
        for side in ("before","after"):
            if events[side] != expected[side]:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_EVENTS")
        def run_fact(side,ref):return actual[side].get((ref["part"],tuple(ref["objectEvent"]["runPath"])),{}).get("normalizedProperties",{}).get("rPr",{"supported":{},"unsupported":{},"history":False})
        def compatible(a,b):
            old,next=run_fact("before",a),run_fact("after",b)
            return not old["history"] and not next["history"] and all(old["unsupported"].get(name,[])==next["unsupported"].get(name,[]) for name in set(old["unsupported"])|set(next["unsupported"])) and all(old["supported"].get(name,[])==next["supported"].get(name,[]) or _mask_enabled("rPr",name) for name in set(old["supported"])|set(next["supported"]))
        supported=all(compatible(a,b) for a in expected["before"] if a["objectEvent"]["kind"]=="drawing" for b in expected["after"] if b["objectEvent"]["kind"]=="drawing")
        if type(events.get("propertiesSupported")) is not bool or events["propertiesSupported"]!=supported:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_PROPERTIES")
        if not supported:raise ValueError("UNSUPPORTED_TRACKED_SOURCE_OBJECT_PROPERTIES")
        def boundary(position):
            if position==len(decision["beforeText"]):return len(decision["afterText"])
            old=new=0
            for segment in decision["comparisons"][0]["segments"]:
                size=len(segment["text"])
                if segment["type"]=="equal" and old<=position<=old+size:return new+position-old
                if segment["type"]=="deleted" and old<=position<old+size:return new
                if segment["type"]!="added":old+=size
                if segment["type"]!="deleted":new+=size
            return new
        facts=lambda side:[(source["objectEvent"]["kind"],boundary(source["objectEvent"]["start"]) if side=="before" else source["objectEvent"]["start"],boundary(source["objectEvent"]["end"]) if side=="before" else source["objectEvent"]["end"],source["objectEvent"]["signature"]) for source in expected[side]]
        if type(events.get("changed")) is not bool or events["changed"] != (facts("before") != facts("after")):raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_EVENTS")
    for decision in _MANIFEST_DECISIONS:
        if decision["type"] != "paragraph" or decision.get("trackedRepresentation") != "revision": continue
        has_comparison_projection = any("sourceSlices" in comparison or "restoreStyles" in comparison for comparison in decision.get("comparisons", []))
        if not decision["before"] or not decision["after"]:
            if "wholeRestoreStyles" in decision or has_comparison_projection or (not decision["before"] and "deletedFormattingPolicy" in decision):
                raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_POLICY")
        if not decision["after"]:
            if decision.get("deletedFormattingPolicy") != "restore-before-unpaired": raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_POLICY")
            continue
        if not decision["before"]: continue
        if decision.get("deletedFormattingPolicy") != "paired-revised": raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_POLICY")
        shape = (len(decision["before"]), len(decision["after"]))
        emitted = [0] if shape == (1, 1) else [1, 2] if shape == (1, 2) else [1]
        for index, comparison in enumerate(decision["comparisons"]):
            if index not in emitted and ("sourceSlices" in comparison or "restoreStyles" in comparison): raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_POLICY")
        whole_expected = {_manifest_key(ref): {} for ref in decision["before"]}
        for index in emitted:
            comparison = decision["comparisons"][index]
            source_slices = comparison.get("sourceSlices")
            if source_slices is None: raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_SLICES")
            owners = []
            for side in ("before", "after"):
                expected = [{"source": ref, "range": [0, len(actual[side][_manifest_key(ref)].get("rawText", ""))]} for ref in decision[side]]
                if shape == (1, 2): expected = [{"source": decision["before"][0], "range": decision["splitSlices"][index - 1]}] if side == "before" else [expected[index - 1]]
                slices = source_slices[side]
                if [(_manifest_key(item["source"]), item["range"]) for item in slices] != [(_manifest_key(item["source"]), item["range"]) for item in expected]: raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_SLICES")
                raw = "".join(actual[side][_manifest_key(item["source"])]["rawText"][item["range"][0]:item["range"][1]] for item in slices)
                if raw != comparison[side]: raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_SLICES")
                if side == "after":
                    for item in slices:
                        ref = item["source"]; start, end = item["range"]
                        runs = [(key, source["textRange"]) for key, source in actual[side].items() if key[0] == ref["part"] and source.get("paragraphPath") == ref["path"] and "textRange" in source]
                        runs.sort(key=lambda pair: pair[1]); cursor = 0
                        for offset in range(start, end):
                            while cursor < len(runs) and runs[cursor][1][1] <= offset: cursor += 1
                            if cursor >= len(runs) or not runs[cursor][1][0] <= offset < runs[cursor][1][1]: raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
                            owners.append(runs[cursor][0])
            expected = {}; before = after = 0
            for segment in comparison["segments"]:
                size = len(segment["text"])
                if segment["type"] != "added":
                    for offset in range(size):
                        cursor = after + (offset if segment["type"] == "equal" else 0)
                        owner = owners[min(cursor, len(owners) - 1)] if owners else None
                        expected[before + offset] = (segment["type"], cursor, owner)
                if segment["type"] != "added": before += size
                if segment["type"] != "deleted": after += size
            covered = set()
            for projection in comparison.get("restoreStyles", []):
                start, size = projection["beforeStart"], projection["length"]
                if type(start) is not int or type(size) is not int or size <= 0: raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_PROJECTION")
                for offset in range(size):
                    position = start + offset
                    owner = _manifest_key(projection["source"]) if projection.get("source") else None
                    value = (projection["kind"], projection["afterStart"] + (offset if projection["kind"] == "equal" else 0), owner)
                    if position in covered or expected.get(position) != value or projection["policy"] != ("copy-revised-run" if owner is not None else "inherit-after-default"): raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_PROJECTION")
                    covered.add(position)
            if covered != set(expected): raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_COVERAGE")
            offset = 0
            for item in source_slices["before"]:
                for local in range(item["range"][1] - item["range"][0]): whole_expected[_manifest_key(item["source"])][item["range"][0] + local] = expected[offset + local]
                offset += item["range"][1] - item["range"][0]
        entries = decision.get("wholeRestoreStyles", [])
        if len(entries) != len(whole_expected) or {_manifest_key(entry["before"]) for entry in entries} != set(whole_expected): raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_COVERAGE")
        for entry in entries:
            if _manifest_key(entry["afterParagraph"]) != _manifest_key(decision["after"][0]): raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_SOURCE")
            expected = whole_expected[_manifest_key(entry["before"])]; covered = set()
            for projection in entry["projections"]:
                if any(type(projection[field]) is not int for field in ("beforeStart", "afterStart", "length")) or projection["beforeStart"] < 0 or projection["afterStart"] < 0 or projection["length"] <= 0: raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_PROJECTION")
                for offset in range(projection["length"]):
                    position = projection["beforeStart"] + offset
                    owner = _manifest_key(projection["source"]) if projection.get("source") else None
                    value = (projection["kind"], projection["afterStart"] + (offset if projection["kind"] == "equal" else 0), owner)
                    if position in covered or expected.get(position) != value or projection["policy"] != ("copy-revised-run" if owner is not None else "inherit-after-default"): raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_PROJECTION")
                    covered.add(position)
            if covered != set(expected): raise ValueError("INVALID_COMPARISON_MANIFEST_STYLE_COVERAGE")


def _mask_enabled(property_name, name):
    group = json.loads(WORKLAZY_FORMATTING_POLICY_JSON).get("maskGroups", {}).get(property_name, {}).get(name.rsplit("}", 1)[-1], "style" if property_name == "rPr" else "paragraph")
    return _MANIFEST["formattingMask"]["effective"][group]


def _validate_formatting_manifest(actual, policy):
    if _MANIFEST.get("formattingPolicyVersion") != policy["version"]:
        raise ValueError("STALE_COMPARISON_MANIFEST")
    mask = _MANIFEST.get("formattingMask", {})
    groups = {"fontFamily", "size", "style", "color", "paragraph", "numbering"}
    if mask.get("version") != "worklazy-formatting-mask-1" or any(set(mask.get(field, {})) != groups or any(type(value) is not bool for value in mask[field].values()) for field in ("requested", "effective")) or mask["effective"] != {group: mask["requested"][group] and _MANIFEST["options"]["formatting"] for group in groups}:
        raise ValueError("INVALID_COMPARISON_MANIFEST_FORMATTING_MASK")
    run_index = {}
    for side in ("before", "after"):
        for key, source in actual[side].items():
            if "paragraphPath" in source and "textRange" in source and source["textRange"][0] < source["textRange"][1]:
                run_index.setdefault((side, key[0], tuple(source["paragraphPath"])), []).append((key, source["textRange"]))
    for runs in run_index.values():
        runs.sort(key=lambda item: item[1])
    scopes = _MANIFEST.get("formattingScopes", [])
    scope_by_id = {}
    direct_pairs = set()
    for scope in scopes:
        if not _MANIFEST["options"]["formatting"] or scope["id"] in scope_by_id or any(scope["id"] == decision["id"] for decision in _MANIFEST_DECISIONS):
            raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_SCOPE")
        scope_by_id[scope["id"]] = scope
        property_name = scope["property"]
        if property_name not in policy["enabled"]:
            raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY")
        for side in ("before", "after"):
            source = actual[side].get(_manifest_key(scope[side]))
            if source is None or property_name not in source.get("normalizedProperties", {}) or scope[side + "Fact"] != source["normalizedProperties"][property_name]:
                raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_FACT")
        for category, field in (("supported", "families"), ("unsupported", "excludedFamilies")):
            before, after = scope["beforeFact"][category], scope["afterFact"][category]
            required = {name for name in set(before) | set(after) if before.get(name, []) != after.get(name, [])}
            supported_before, supported_after = scope["beforeFact"]["supported"], scope["afterFact"]["supported"]
            disabled = {name for name in set(supported_before) | set(supported_after) if supported_before.get(name, []) != supported_after.get(name, []) and not _mask_enabled(property_name, name)}
            required = required - disabled if category == "supported" else required | disabled
            if len(set(scope[field])) != len(scope[field]) or set(scope[field]) != required:
                raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_DECLARATION")
        if "comparisonId" not in scope:
            pair = (_manifest_key(scope["before"]), _manifest_key(scope["after"]), property_name)
            if pair in direct_pairs:
                raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_DUPLICATE")
            direct_pairs.add(pair)
    actions = _MANIFEST.get("propertyActions", [])
    action_scopes, action_ids = set(), set()
    for action in actions:
        scope = scope_by_id.get(action.get("scopeId"))
        if scope is None or "comparisonId" in scope or not scope["families"] or action["scopeId"] in action_scopes or action["id"] in action_ids or action["id"] in scope_by_id or any(action["id"] == decision["id"] for decision in _MANIFEST_DECISIONS):
            raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_ACTION")
        action_scopes.add(action["scopeId"]); action_ids.add(action["id"])
        if action["families"] != scope["families"] or action["property"] != scope["property"] or any(_manifest_key(action[side]) != _manifest_key(scope[side]) for side in ("before", "after")):
            raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_ACTION")
        if action["representation"] != ("preserve-after-history" if scope["afterFact"]["history"] else "whole-node-revision" if any(decision["id"] == action.get("decisionId") and decision.get("moved") for decision in _MANIFEST_DECISIONS) else "revision"):
            raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_HISTORY")
    if action_scopes != {scope["id"] for scope in scopes if "comparisonId" not in scope and scope["families"]}:
        raise ValueError("INVALID_COMPARISON_MANIFEST_MISSING_PROPERTY_ACTION")

    def children(side, parent, kind):
        part, path = parent
        return sorted(key for key, source in actual[side].items() if source["kind"] == kind and key[0] == part and len(key[1]) == len(path) + 1 and key[1][:len(path)] == path)
    expected_pairs = set()
    def expect(before, after, property_name):
        if before is not None and after is not None:
            expected_pairs.add((before, after, property_name))
    if _MANIFEST["options"]["formatting"]:
        expect(next((key for key, source in actual["before"].items() if source["kind"] == "body"), None), next((key for key, source in actual["after"].items() if source["kind"] == "body"), None), "sectPr")
        for decision in _MANIFEST_DECISIONS:
            if decision["type"] != "table" or len(decision["before"]) != 1 or len(decision["after"]) != 1:
                continue
            before, after = _manifest_key(decision["before"][0]), _manifest_key(decision["after"][0])
            expect(before, after, "tblPr")
            left, right = children("before", before, "tr"), children("after", after, "tr")
            for row in decision["rows"]:
                if row["beforeIndex"] is None or row["afterIndex"] is None: continue
                a, b = left[row["beforeIndex"]], right[row["afterIndex"]]
                expect(a, b, "trPr")
                old_cells, new_cells = children("before", a, "tc"), children("after", b, "tc")
                for column in decision["columns"]:
                    x, y = column["beforeIndex"], column["afterIndex"]
                    if x is not None and y is not None and x < len(old_cells) and y < len(new_cells): expect(old_cells[x], new_cells[y], "tcPr")
        for after, source in actual["after"].items():
            if source["kind"] != "style": continue
            style_id = source.get("attributes", {}).get(W + "styleId")
            matches = [key for key, old in actual["before"].items() if old["kind"] == "style" and old.get("attributes", {}).get(W + "styleId") == style_id]
            if len(matches) > 1: raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
            if matches:
                expect(matches[0], after, "pPr"); expect(matches[0], after, "rPr")
    expected_exclusions = set()
    if _MANIFEST["options"]["formatting"]:
        for side in ("before", "after"):
            for key, source in actual[side].items():
                if source["kind"] == "style" and not any(other["kind"] == "style" and other.get("attributes", {}).get(W + "styleId") == source.get("attributes", {}).get(W + "styleId") for other in actual["after" if side == "before" else "before"].values()):
                    expected_exclusions.update((side, key, name) for name in ("pPr", "rPr"))
    exclusions = _MANIFEST.get("propertyExclusions", [])
    if len(exclusions) != len(expected_exclusions) or {(item["side"], _manifest_key(item["source"]), item["property"]) for item in exclusions if item["reason"] == "unpaired-style"} != expected_exclusions:
        raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_EXCLUSION")
    if direct_pairs != expected_pairs:
        raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_SCOPE_COVERAGE")

    used_scopes = {scope["id"] for scope in scopes if "comparisonId" not in scope}
    for decision in _MANIFEST_DECISIONS:
        if decision["type"] != "paragraph" or decision.get("trackedRepresentation") != "revision" or not decision["before"] or not decision["after"]: continue
        shape = (len(decision["before"]), len(decision["after"]))
        emitted = [0] if shape == (1, 1) else [1, 2] if shape == (1, 2) else [1]
        for index in emitted:
            comparison = decision["comparisons"][index]
            formatting = comparison.get("formatting")
            if not _MANIFEST["options"]["formatting"]:
                if formatting is not None: raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_SCOPE")
                continue
            if formatting is None: raise ValueError("INVALID_COMPARISON_MANIFEST_MISSING_PROPERTY_SCOPE")
            comparison_id = decision["id"] + ":comparison:" + str(index)
            positions = {}
            for side in ("before", "after"):
                slices = formatting[side + "Slices"]
                refs = decision[side]
                expected = [{"source": ref, "range": [0, len(actual[side][_manifest_key(ref)].get("rawText", ""))]} for ref in refs]
                if shape == (1, 2):
                    expected = [{"source": decision["before"][0], "range": decision["splitSlices"][index - 1]}] if side == "before" else [expected[index - 1]]
                if [(_manifest_key(item["source"]), item["range"]) for item in slices] != [(_manifest_key(item["source"]), item["range"]) for item in expected]:
                    raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_SLICES")
                entries = []
                for item in slices:
                    ref = item["source"]; start, end = item["range"]
                    runs = run_index.get((side, ref["part"], tuple(ref["path"])), [])
                    cursor = 0
                    for offset in range(start, end):
                        while cursor < len(runs) and runs[cursor][1][1] <= offset: cursor += 1
                        if cursor >= len(runs) or not runs[cursor][1][0] <= offset < runs[cursor][1][1]: raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
                        entries.append(runs[cursor][0])
                positions[side] = entries
            paragraph = scope_by_id.get(formatting["paragraphScopeId"])
            if paragraph is None or paragraph.get("comparisonId") != comparison_id or paragraph["property"] != "pPr" or any(_manifest_key(paragraph[side]) != _manifest_key(formatting[side + "Slices"][0]["source"]) for side in ("before", "after")) or paragraph["families"] != formatting["paragraphFamilies"] or paragraph["afterFact"]["history"] != formatting["paragraphHistory"]:
                raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_SCOPE")
            used_scopes.add(paragraph["id"])
            expected_chars = set(); before = after = 0
            for segment in comparison["segments"]:
                size = len(segment["text"])
                if segment["type"] == "equal": expected_chars.update((before + offset, after + offset) for offset in range(size))
                if segment["type"] != "added": before += size
                if segment["type"] != "deleted": after += size
            covered = set()
            runs = [scope for scope in scopes if scope.get("comparisonId") == comparison_id and scope["property"] == "rPr"]
            spans = {span["scopeId"]: span for span in formatting["spans"]}
            if len(spans) != len(formatting["spans"]): raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_DUPLICATE")
            for scope in runs:
                x, y, size = scope["beforeStart"], scope["afterStart"], scope["length"]
                if any(type(value) is not int for value in (x, y, size)) or size <= 0: raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_BOUNDS")
                for offset in range(size):
                    pair = (x + offset, y + offset)
                    if pair not in expected_chars or pair in covered or positions["before"][pair[0]] != _manifest_key(scope["before"]) or positions["after"][pair[1]] != _manifest_key(scope["after"]): raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_BOUNDS")
                    covered.add(pair)
                span = spans.get(scope["id"])
                if bool(span) != bool(scope["families"]) or span and (span["families"] != scope["families"] or span["history"] != scope["afterFact"]["history"] or (span["beforeStart"], span["afterStart"], span["length"]) != (x, y, size)):
                    raise ValueError("INVALID_COMPARISON_MANIFEST_MISSING_PROPERTY_ACTION")
                used_scopes.add(scope["id"])
            if covered != expected_chars or set(spans) != {scope["id"] for scope in runs if scope["families"]}:
                raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_SCOPE_COVERAGE")
    if used_scopes != set(scope_by_id):
        raise ValueError("INVALID_COMPARISON_MANIFEST_PROPERTY_SCOPE_COVERAGE")


def _validate_segments(segments, before, after):
    if not isinstance(segments, list) or any(not isinstance(segment, dict) or segment.get("type") not in {"equal", "added", "deleted"} or not isinstance(segment.get("text"), str) for segment in segments):
        raise ValueError("INVALID_COMPARISON_MANIFEST_SEGMENTS")
    if "".join(segment["text"] for segment in segments if segment["type"] != "added") != before or "".join(segment["text"] for segment in segments if segment["type"] != "deleted") != after:
        raise ValueError("INVALID_COMPARISON_MANIFEST_TEXT_BOUNDS")


def _consume_manifest_refs(side, refs):
    for ref in refs:
        key = (side, _manifest_key(ref))
        _MANIFEST_CONSUMED[key] = _MANIFEST_CONSUMED.get(key, 0) + 1
        if _MANIFEST_CONSUMED[key] != 1:
            raise ValueError("INVALID_COMPARISON_MANIFEST_DUPLICATE_CONSUMPTION")


def _consume_manifest_subtree(side, node):
    origin = _MANIFEST_NODE_KEYS.get(node)
    if origin is None:
        raise ValueError("INVALID_COMPARISON_MANIFEST_SOURCE")
    part, path = origin[1]
    for decision in _MANIFEST_DECISIONS:
        refs = [ref for ref in decision[side] if ref["part"] == part and tuple(ref["path"][:len(path)]) == path]
        if refs:
            refs = [ref for ref in refs if tuple(ref["path"]) != path]
        if refs:
            _consume_manifest_refs(side, refs)
            _MANIFEST_USED.add(decision["id"])


def _install_manifest(manifest):
    global _MANIFEST, _MANIFEST_NODE_KEYS, _MANIFEST_DECISIONS, _MANIFEST_USED, _MANIFEST_CONSUMED, _MANIFEST_ACTIVE_DECISION, _MANIFEST_ACTIVE_COMPARISON, _MANIFEST_PROPERTY_USED, _MANIFEST_SOURCE_NODES, _MANIFEST_ALLOWED_PROPERTIES
    if not isinstance(manifest, dict) or manifest.get("version") != 1:
        raise ValueError("INVALID_COMPARISON_MANIFEST")
    _MANIFEST = manifest
    _MANIFEST_USED = set()
    _MANIFEST_CONSUMED = {}
    _MANIFEST_ACTIVE_DECISION = None
    _MANIFEST_ACTIVE_COMPARISON = None
    _MANIFEST_PROPERTY_USED = set()
    _MANIFEST_SOURCE_NODES = {}
    _MANIFEST_ALLOWED_PROPERTIES = {name: {W + family for family in families if _mask_enabled(name, family)} for name, families in json.loads(WORKLAZY_FORMATTING_POLICY_JSON)["enabled"].items()}
    _MANIFEST_NODE_KEYS = {}
    _MANIFEST_DECISIONS = []
    def visit(decisions):
        for decision in decisions:
            _MANIFEST_DECISIONS.append(decision)
            visit(decision.get("children", []))
    visit(manifest["decisions"])


def _register_manifest_root(root, part, side):
    def visit(node, path):
        _MANIFEST_NODE_KEYS[node] = (side, (part, tuple(path)))
        _MANIFEST_SOURCE_NODES[(side, (part, tuple(path)))] = node
        for index, child in enumerate(node):
            visit(child, path + [index])
    visit(root, [])


def _manifest_decision(before, after):
    left = _MANIFEST_NODE_KEYS.get(before) if before is not None else None
    right = _MANIFEST_NODE_KEYS.get(after) if after is not None else None
    for decision in _MANIFEST_DECISIONS:
        if left and any(_manifest_key(ref) == left[1] for ref in decision["before"]):
            _MANIFEST_USED.add(decision["id"])
            return decision
        if right and any(_manifest_key(ref) == right[1] for ref in decision["after"]):
            _MANIFEST_USED.add(decision["id"])
            return decision
    raise ValueError("MISSING_COMPARISON_DECISION")


def _manifest_block_groups(before, after, include_tables=True):
    left = {_MANIFEST_NODE_KEYS.get(node, (None, None))[1]: index for index, node in enumerate(before)}
    right = {_MANIFEST_NODE_KEYS.get(node, (None, None))[1]: index for index, node in enumerate(after)}
    result = []
    for decision in _MANIFEST_DECISIONS:
        a = [left[_manifest_key(ref)] for ref in decision["before"] if _manifest_key(ref) in left]
        b = [right[_manifest_key(ref)] for ref in decision["after"] if _manifest_key(ref) in right]
        if a or b:
            if len(a) != len(decision["before"]) or len(b) != len(decision["after"]):
                raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
            _consume_manifest_refs("before", decision["before"])
            _consume_manifest_refs("after", decision["after"])
            _MANIFEST_USED.add(decision["id"])
            if decision.get("moved") and a and b:
                result.append((a, [], decision))
                result.append(([], b, decision))
            else:
                result.append((a, b, decision))
    # Screen intentionally suppresses empty paragraphs. Preserve their after
    # XML without inventing a pairing or a visible revision.
    covered = {index for _, indexes, _ in result for index in indexes}
    for index, node in enumerate(after):
        if index not in covered:
            if node.tag == W + "tbl" and not include_tables:
                result.append(([], [index], {"untracked": True}))
                continue
            if _comparison_text(node).strip():
                raise ValueError("UNMAPPED_VISIBLE_XML_NODE")
            result.append(([], [index], {"untracked": True}))
    # Keep after order. Deletions remain at the source boundary preceding their
    # next matched source node, rather than being collected at document end.
    def position(item):
        a, b, _ = item
        if b:
            return (b[0], 1)
        next_positions = [ys[0] for xs, ys, _ in result if xs and ys and a and xs[0] > a[-1]]
        return (min(next_positions) if next_positions else len(after), 0)
    return sorted(result, key=position)


def _manifest_flat_blocks(blocks):
    result = []
    for block in blocks:
        if block.tag == CONTENT_CONTROL_TAG:
            result.extend(_manifest_flat_blocks(_content_control_blocks(block)))
        else:
            result.append(block)
    return result


def _manifest_rewrap(after_blocks, emitted):
    """Rebuild existing content-control envelopes around their emitted leaves."""
    leaf_owner = {}
    def assign(node, top):
        if node.tag == CONTENT_CONTROL_TAG:
            for child in _content_control_blocks(node):
                assign(child, top)
        else:
            leaf_owner[id(node)] = top
    for block in after_blocks:
        assign(block, block)
    replacements = {}
    for source, nodes in emitted:
        if source is not None:
            replacements.setdefault(id(source), []).extend(nodes)
    def rebuild(source):
        if source.tag != CONTENT_CONTROL_TAG:
            return replacements.get(id(source), [])
        result = copy.deepcopy(source)
        content = result.find(CONTENT_CONTROL_BODY_TAG)
        if content is not None:
            children = []
            for child in _content_control_blocks(source):
                children.extend(rebuild(child))
            _replace_blocks(content, children)
        return [result]
    output = []
    seen = set()
    for source, nodes in emitted:
        owner = leaf_owner.get(id(source)) if source is not None else None
        if owner is None or owner.tag != CONTENT_CONTROL_TAG:
            output.extend(nodes)
        elif id(owner) not in seen:
            output.extend(rebuild(owner))
            seen.add(id(owner))
    return output



def _revision_blocks_impl(before_blocks, after_blocks, include_formatting, writer, include_tables=True):
    global _MANIFEST_ACTIVE_DECISION, _MANIFEST_ACTIVE_COMPARISON
    original_after_blocks = after_blocks
    before_blocks = _manifest_flat_blocks(before_blocks)
    after_blocks = _manifest_flat_blocks(after_blocks)
    emitted = []
    alignment = _manifest_block_groups(before_blocks, after_blocks, include_tables)
    for before_indexes, after_indexes, decision in alignment:
        _MANIFEST_ACTIVE_DECISION = decision
        _MANIFEST_ACTIVE_COMPARISON = decision.get("comparisons", [None])[0]
        revised = []
        target = after_blocks[after_indexes[0]] if after_indexes else None
        emitted.append((target, revised))
        if decision.get("untracked"):
            revised.extend(copy.deepcopy(after_blocks[index]) for index in after_indexes)
            continue
        if len(before_indexes) == 1 and len(after_indexes) == 2:
            before = before_blocks[before_indexes[0]]
            first_after = after_blocks[after_indexes[0]]
            second_after = after_blocks[after_indexes[1]]
            if before.tag == first_after.tag == second_after.tag == W + "p":
                revised.extend(_paragraph_split_revision(before, first_after, second_after, include_formatting, writer))
                continue
        if len(before_indexes) == 2 and len(after_indexes) == 1:
            first_before = before_blocks[before_indexes[0]]
            second_before = before_blocks[before_indexes[1]]
            after = after_blocks[after_indexes[0]]
            if first_before.tag == second_before.tag == after.tag == W + "p":
                revised.extend(_paragraph_merge_revision(first_before, second_before, after, include_formatting, writer))
                continue

        before_index = before_indexes[0] if before_indexes else None
        after_index = after_indexes[0] if after_indexes else None
        before = before_blocks[before_index] if before_index is not None else None
        after = after_blocks[after_index] if after_index is not None else None
        if not include_tables and (
            (before is not None and _block_kind(before) == W + "tbl")
            or (after is not None and _block_kind(after) == W + "tbl")
        ):
            if after is not None:
                revised.append(copy.deepcopy(after))
            continue
        if before is None:
            if after.tag == W + "p":
                revised.append(_whole_paragraph_revision(after, "ins", writer))
            elif after.tag == W + "tbl":
                revised.append(_whole_table_revision(after, "ins", writer))
            else:
                revised.append(_whole_content_control_revision(after, "ins", writer, include_formatting, include_tables))
        elif after is None:
            if before.tag == W + "p":
                revised.append(_whole_paragraph_revision(before, "del", writer))
            elif before.tag == W + "tbl":
                revised.append(_whole_table_revision(before, "del", writer))
            else:
                revised.append(_whole_content_control_revision(before, "del", writer, include_formatting, include_tables))
        elif before.tag == CONTENT_CONTROL_TAG or after.tag == CONTENT_CONTROL_TAG:
            revised.extend(_content_control_revision(before, after, include_formatting, writer, include_tables))
        elif before.tag == W + "p" and after.tag == W + "p":
            revised.append(_paragraph_revision(before, after, include_formatting, writer))
        elif before.tag == W + "tbl" and after.tag == W + "tbl":
            revised.append(_table_revision(before, after, include_formatting, writer))
        else:
            revised.append(copy.deepcopy(after))
    return _manifest_rewrap(original_after_blocks, emitted)


def _revision_blocks(before_blocks, after_blocks, include_formatting, writer, include_tables=True):
    global _MANIFEST_ACTIVE_DECISION, _MANIFEST_ACTIVE_COMPARISON
    previous = _MANIFEST_ACTIVE_DECISION
    previous_comparison = _MANIFEST_ACTIVE_COMPARISON
    try:
        return _revision_blocks_impl(before_blocks, after_blocks, include_formatting, writer, include_tables)
    finally:
        _MANIFEST_ACTIVE_DECISION = previous
        _MANIFEST_ACTIVE_COMPARISON = previous_comparison


def _replace_blocks(container, replacements):
    children = list(container)
    positions = [index for index, child in enumerate(children) if child.tag in BLOCK_TAGS]
    insertion_index = positions[0] if positions else next(
        (index for index, child in enumerate(children) if child.tag == W + "sectPr"),
        len(children),
    )
    for child in children:
        if child.tag in BLOCK_TAGS:
            container.remove(child)
    for offset, replacement in enumerate(replacements):
        container.insert(insertion_index + offset, replacement)


def _revisionize_xml_part(before_data, after_data, include_formatting, writer, container_tag=None, include_tables=True, part="word/document.xml"):
    before_root = _parse_xml(before_data)
    after_root = _parse_xml(after_data)
    _register_manifest_root(before_root, part, "before")
    _register_manifest_root(after_root, part, "after")
    before_container = before_root.find(W + container_tag) if container_tag else before_root
    after_container = after_root.find(W + container_tag) if container_tag else after_root
    if before_container is None or after_container is None:
        return after_data
    before_blocks = [child for child in before_container if child.tag in BLOCK_TAGS]
    after_blocks = [child for child in after_container if child.tag in BLOCK_TAGS]
    _replace_blocks(
        after_container,
        _revision_blocks(before_blocks, after_blocks, include_formatting, writer, include_tables),
    )
    if include_formatting and container_tag == "body":
        _apply_property_revision(after_container, before_container, W + "sectPr", W + "sectPrChange", writer)
    return _serialize_xml(after_root)


def _revisionize_notes(before_data, after_data, include_formatting, writer, note_tag, include_tables=True):
    before_root = _parse_xml(before_data)
    after_root = _parse_xml(after_data)
    part = "word/footnotes.xml" if note_tag == "footnote" else "word/endnotes.xml"
    _register_manifest_root(before_root, part, "before")
    _register_manifest_root(after_root, part, "after")
    before_children = list(before_root)
    after_children = list(after_root)
    for after_index, after_note in enumerate(after_children):
        if after_note.tag != W + note_tag:
            continue
        candidates = set()
        for decision in _MANIFEST_DECISIONS:
            relevant = [ref for ref in decision["after"] if ref["part"] == part and ref["path"] and ref["path"][0] == after_index]
            if relevant:
                if any(ref["part"] != part or not ref["path"] for ref in decision["before"]):
                    raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
                candidates.update(ref["path"][0] for ref in decision["before"])
        if not candidates:
            # Empty separator records are explicitly preserved; added visible
            # note containers need package-reference support in P.
            if _comparison_text(after_note).strip():
                raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
            continue
        if len(candidates) != 1:
            raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
        before_index = next(iter(candidates))
        before_note = before_children[before_index]
        if before_index != after_index or before_note.get(W + "id") != after_note.get(W + "id"):
            raise ValueError("UNSUPPORTED_TRACKED_SOURCE")
        if before_note.tag != W + note_tag:
            raise ValueError("INVALID_COMPARISON_MANIFEST_NOTE_CONTEXT")
        before_blocks = [child for child in before_note if child.tag in BLOCK_TAGS]
        after_blocks = [child for child in after_note if child.tag in BLOCK_TAGS]
        _replace_blocks(after_note, _revision_blocks(before_blocks, after_blocks, include_formatting, writer, include_tables))
    return _serialize_xml(after_root)


def _revisionize_comments(before_data, after_data, include_formatting, writer):
    before_root = _parse_xml(before_data)
    after_root = _parse_xml(after_data)
    _register_manifest_root(before_root, "word/comments.xml", "before")
    _register_manifest_root(after_root, "word/comments.xml", "after")
    before_comments = {comment.get(W + "id", ""): comment for comment in before_root.findall(W + "comment")}
    for after_comment in after_root.findall(W + "comment"):
        before_comment = before_comments.get(after_comment.get(W + "id", ""))
        if before_comment is None:
            continue
        before_blocks = [child for child in before_comment if child.tag in BLOCK_TAGS]
        after_blocks = [child for child in after_comment if child.tag in BLOCK_TAGS]
        _replace_blocks(after_comment, _revision_blocks(before_blocks, after_blocks, include_formatting, writer, False))
    return _serialize_xml(after_root)


def _revisionize_styles(before_data, after_data, writer):
    before_root = _parse_xml(before_data)
    after_root = _parse_xml(after_data)
    _register_manifest_root(before_root, "word/styles.xml", "before")
    _register_manifest_root(after_root, "word/styles.xml", "after")
    def resolve(root, path):
        for index in path:
            root = root[index]
        return root
    for action in _MANIFEST["propertyActions"]:
        if action["after"]["part"] == "word/styles.xml":
            before = resolve(before_root, action["before"]["path"])
            after = resolve(after_root, action["after"]["path"])
            property_tag = W + action["property"]
            _apply_property_revision(after, before, property_tag, property_tag + "Change", writer)
    return _serialize_xml(after_root)


SETTINGS_CHILD_ORDER = (
    "writeProtection", "view", "zoom", "removePersonalInformation", "removeDateAndTime",
    "doNotDisplayPageBoundaries", "displayBackgroundShape", "printPostScriptOverText",
    "printFractionalCharacterWidth", "printFormsData", "embedTrueTypeFonts", "embedSystemFonts",
    "saveSubsetFonts", "saveFormsData", "mirrorMargins", "alignBordersAndEdges",
    "bordersDoNotSurroundHeader", "bordersDoNotSurroundFooter", "gutterAtTop",
    "hideSpellingErrors", "hideGrammaticalErrors", "activeWritingStyle", "proofState",
    "formsDesign", "attachedTemplate", "linkStyles", "stylePaneFormatFilter", "stylePaneSortMethod",
    "documentType", "mailMerge", "revisionView", "trackRevisions",
    "doNotTrackMoves", "doNotTrackFormatting", "documentProtection", "autoFormatOverride",
    "styleLockTheme", "styleLockQFSet", "defaultTabStop", "autoHyphenation",
    "consecutiveHyphenLimit", "hyphenationZone", "doNotHyphenateCaps", "showEnvelope",
    "summaryLength", "clickAndTypeStyle", "defaultTableStyle", "evenAndOddHeaders",
    "bookFoldRevPrinting", "bookFoldPrinting", "bookFoldPrintingSheets",
    "drawingGridHorizontalSpacing", "drawingGridVerticalSpacing", "displayHorizontalDrawingGridEvery",
    "displayVerticalDrawingGridEvery", "doNotUseMarginsForDrawingGridOrigin",
    "drawingGridHorizontalOrigin", "drawingGridVerticalOrigin", "doNotShadeFormData",
    "noPunctuationKerning", "characterSpacingControl", "printTwoOnOne", "strictFirstAndLastChars",
    "noLineBreaksAfter", "noLineBreaksBefore", "savePreviewPicture", "doNotValidateAgainstSchema",
    "saveInvalidXml", "ignoreMixedContent", "alwaysShowPlaceholderText", "doNotDemarcateInvalidXml",
    "saveXmlDataOnly", "useXSLTWhenSaving", "saveThroughXslt", "showXMLTags",
    "alwaysMergeEmptyNamespace", "updateFields", "hdrShapeDefaults", "footnotePr", "endnotePr",
    "compat", "docVars", "rsids", "mathPr", "uiCompat97To2003", "attachedSchema",
    "themeFontLang", "clrSchemeMapping", "doNotIncludeSubdocsInStats", "doNotAutoCompressPictures",
    "forceUpgrade", "captions", "readModeInkLockDown", "smartTagType", "schemaLibrary",
    "shapeDefaults", "doNotEmbedSmartTags", "decimalSymbol", "listSeparator",
)


def _settings_insert_index(root, child_name):
    order = {name: index for index, name in enumerate(SETTINGS_CHILD_ORDER)}
    target_order = order[child_name]
    for index, child in enumerate(root):
        local_name = child.tag.rsplit("}", 1)[-1]
        if order.get(local_name, -1) > target_order:
            return index
    return len(root)


def _enable_revision_display(settings_data):
    root = _parse_xml(settings_data)
    revision_view = root.find(W + "revisionView")
    if revision_view is None:
        revision_view = ET.Element(W + "revisionView", {
            W + "markup": "true",
            W + "comments": "true",
            W + "insDel": "true",
            W + "formatting": "true",
        })
        root.insert(_settings_insert_index(root, "revisionView"), revision_view)
    return _serialize_xml(root)


def _integer_ids(elements, attribute):
    values = []
    for element in elements:
        try:
            values.append(int(element.get(attribute, "-1")))
        except ValueError:
            continue
    return values


def _next_revision_id(*archives):
    maximum = 0
    for archive in archives:
        for name in archive.namelist():
            if not name.startswith("word/") or not name.endswith(".xml"):
                continue
            try:
                root = ET.fromstring(archive.read(name))
            except ET.ParseError:
                continue
            for element in root.iter():
                if element.tag not in TRACK_CHANGE_TAGS:
                    continue
                try:
                    maximum = max(maximum, int(element.get(W + "id", "0")))
                except ValueError:
                    continue
    return maximum + 1


def _merge_numbering(before_data, after_data, referenced_number_ids):
    before_root = _parse_xml(before_data)
    referenced_number_ids = {str(value) for value in referenced_number_ids if str(value) != "0"}
    referenced_numbers = [
        number for number in before_root.findall(W + "num")
        if number.get(W + "numId") in referenced_number_ids
    ]
    referenced_abstract_ids = {
        abstract_id.get(W + "val")
        for number in referenced_numbers
        for abstract_id in [number.find(W + "abstractNumId")]
        if abstract_id is not None and abstract_id.get(W + "val") is not None
    }
    if after_data is None:
        for abstract in list(before_root.findall(W + "abstractNum")):
            if abstract.get(W + "abstractNumId") not in referenced_abstract_ids:
                before_root.remove(abstract)
        for number in list(before_root.findall(W + "num")):
            if number.get(W + "numId") not in referenced_number_ids:
                before_root.remove(number)
        mapping = {
            number.get(W + "numId"): number.get(W + "numId")
            for number in referenced_numbers
            if number.get(W + "numId") not in (None, "0")
        }
        return _serialize_xml(before_root), mapping

    after_root = _parse_xml(after_data)
    next_abstract_id = max(
        _integer_ids(after_root.findall(W + "abstractNum"), W + "abstractNumId"),
        default=-1,
    ) + 1
    abstract_mapping = {}
    copied_abstracts = []
    for abstract in before_root.findall(W + "abstractNum"):
        old_id = abstract.get(W + "abstractNumId")
        if old_id is None or old_id not in referenced_abstract_ids:
            continue
        new_id = str(next_abstract_id)
        next_abstract_id += 1
        abstract_mapping[old_id] = new_id
        copied = copy.deepcopy(abstract)
        copied.set(W + "abstractNumId", new_id)
        copied_abstracts.append(copied)

    next_number_id = max(
        _integer_ids(after_root.findall(W + "num"), W + "numId"),
        default=0,
    ) + 1
    number_mapping = {}
    copied_numbers = []
    for number in referenced_numbers:
        old_id = number.get(W + "numId")
        if old_id in (None, "0"):
            continue
        new_id = str(next_number_id)
        next_number_id += 1
        number_mapping[old_id] = new_id
        copied = copy.deepcopy(number)
        copied.set(W + "numId", new_id)
        abstract_id = copied.find(W + "abstractNumId")
        if abstract_id is not None:
            old_abstract_id = abstract_id.get(W + "val")
            if old_abstract_id in abstract_mapping:
                abstract_id.set(W + "val", abstract_mapping[old_abstract_id])
        copied_numbers.append(copied)

    children = list(after_root)
    abstract_insert_index = next(
        (index for index, child in enumerate(children) if child.tag in (W + "num", W + "numIdMacAtCleanup")),
        len(children),
    )
    for offset, copied in enumerate(copied_abstracts):
        after_root.insert(abstract_insert_index + offset, copied)
    children = list(after_root)
    number_insert_index = next(
        (index for index, child in enumerate(children) if child.tag == W + "numIdMacAtCleanup"),
        len(children),
    )
    for offset, copied in enumerate(copied_numbers):
        after_root.insert(number_insert_index + offset, copied)
    return _serialize_xml(after_root), number_mapping


def _referenced_number_ids(archive, names):
    referenced = set()
    for name in names:
        try:
            root = _parse_xml(archive.read(name))
        except (KeyError, ET.ParseError):
            continue
        for number_id in root.iter(W + "numId"):
            value = number_id.get(W + "val")
            if value not in (None, "0"):
                referenced.add(value)
    return referenced


def _remap_numbering_references(data, number_mapping):
    if not number_mapping:
        return data
    root = _parse_xml(data)
    changed = False
    for number_id in root.iter(W + "numId"):
        old_id = number_id.get(W + "val")
        if old_id in number_mapping:
            number_id.set(W + "val", number_mapping[old_id])
            changed = True
    return _serialize_xml(root) if changed else data


def _ensure_numbering_relationship(relationships_data):
    relationships_namespace = "http://schemas.openxmlformats.org/package/2006/relationships"
    relationship_tag = "{" + relationships_namespace + "}Relationship"
    if relationships_data is None:
        root = ET.Element("{" + relationships_namespace + "}Relationships")
    else:
        root = _parse_xml(relationships_data)
    relationship_type = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering"
    if any(item.get("Type") == relationship_type for item in root.findall(relationship_tag)):
        return _serialize_xml(root)
    used_ids = {item.get("Id", "") for item in root.findall(relationship_tag)}
    index = 1
    while f"rId{index}" in used_ids:
        index += 1
    ET.SubElement(root, relationship_tag, {
        "Id": f"rId{index}",
        "Type": relationship_type,
        "Target": "numbering.xml",
    })
    return _serialize_xml(root)


def _ensure_numbering_content_type(content_types_data):
    content_types_namespace = "http://schemas.openxmlformats.org/package/2006/content-types"
    override_tag = "{" + content_types_namespace + "}Override"
    root = _parse_xml(content_types_data)
    if any(item.get("PartName") == "/word/numbering.xml" for item in root.findall(override_tag)):
        return _serialize_xml(root)
    ET.SubElement(root, override_tag, {
        "PartName": "/word/numbering.xml",
        "ContentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml",
    })
    return _serialize_xml(root)


def _generate_tracked_document(before_path, after_path, output_path, author, include_formatting, include_tables, include_metadata, manifest_json=None, formatting_mask_json=None):
    global _MANIFEST, _PACKAGE_GRAPH
    if manifest_json is None:
        # Read-only test/tool bridge; the browser always passes its already
        # computed screen manifest. Pairing remains TypeScript-owned here too.
        with open(before_path, "rb") as source:
            before_model = extract_document_model(source.read(), True, True)
        with open(after_path, "rb") as source:
            after_model = extract_document_model(source.read(), True, True)
        manifest_json = worklazyComparisonManifestJson(before_model, after_model, bool(include_formatting), bool(include_tables), bool(include_metadata))
    try:
        _install_manifest(json.loads(manifest_json))
    except (KeyError, TypeError, IndexError, RecursionError) as error:
        raise ValueError("INVALID_COMPARISON_MANIFEST") from error
    requested_mask = json.loads(formatting_mask_json) if formatting_mask_json is not None else {group: True for group in ("fontFamily", "size", "style", "color", "paragraph", "numbering")}
    if _MANIFEST.get("formattingMask", {}).get("requested") != requested_mask:
        raise ValueError("STALE_COMPARISON_MANIFEST_FORMATTING_MASK")
    if _MANIFEST.get("policyVersion") != "worklazy-document-1":
        raise ValueError("STALE_COMPARISON_MANIFEST")
    if _MANIFEST.get("options") != {"formatting": bool(include_formatting), "tables": bool(include_tables), "metadata": bool(include_metadata)}:
        raise ValueError("STALE_COMPARISON_MANIFEST")
    for side, path in (("before", before_path), ("after", after_path)):
        with open(path, "rb") as source:
            revision = hashlib.sha256(source.read()).hexdigest()
        if revision != _MANIFEST.get("inputRevision", {}).get(side):
            raise ValueError("STALE_COMPARISON_MANIFEST")
    try:
        _validate_manifest(before_path, after_path)
    except (KeyError, TypeError, IndexError) as error:
        raise ValueError("INVALID_COMPARISON_MANIFEST") from error
    with zipfile.ZipFile(before_path, "r") as before_archive, zipfile.ZipFile(after_path, "r") as after_archive:
        writer = _RevisionWriter(author, _next_revision_id(before_archive, after_archive))
        _PACKAGE_GRAPH = _PackageGraph(before_archive,after_archive)
        before_names = set(before_archive.namelist())
        after_names = set(after_archive.namelist())
        replacements = {}
        additions = {}
        number_mapping = {}
        if "word/numbering.xml" in before_names:
            reference_parts = ["word/document.xml"]
            if include_metadata:
                reference_parts.extend(
                    name for name in before_names
                    if re.fullmatch(r"word/(header|footer)\d+\.xml", name) and name in after_names
                )
                reference_parts.extend(
                    name for name in ("word/footnotes.xml", "word/endnotes.xml")
                    if name in before_names and name in after_names
                )
            referenced_number_ids = _referenced_number_ids(before_archive, reference_parts)
            merged_numbering, number_mapping = _merge_numbering(
                before_archive.read("word/numbering.xml"),
                after_archive.read("word/numbering.xml") if "word/numbering.xml" in after_names else None,
                referenced_number_ids,
            )
            if "word/numbering.xml" in after_names:
                replacements["word/numbering.xml"] = merged_numbering
            else:
                additions["word/numbering.xml"] = merged_numbering
                relationship_path = "word/_rels/document.xml.rels"
                relationship_data = after_archive.read(relationship_path) if relationship_path in after_names else None
                relationship_output = _ensure_numbering_relationship(relationship_data)
                if relationship_path in after_names:
                    replacements[relationship_path] = relationship_output
                else:
                    additions[relationship_path] = relationship_output
                replacements["[Content_Types].xml"] = _ensure_numbering_content_type(
                    after_archive.read("[Content_Types].xml")
                )

        def before_part(name):
            return _remap_numbering_references(before_archive.read(name), number_mapping)

        replacements["word/document.xml"] = _revisionize_xml_part(
            before_part("word/document.xml"),
            after_archive.read("word/document.xml"),
            bool(include_formatting),
            writer,
            "body",
            bool(include_tables),
        )

        if include_formatting and "word/styles.xml" in before_names and "word/styles.xml" in after_names:
            replacements["word/styles.xml"] = _revisionize_styles(
                before_archive.read("word/styles.xml"),
                after_archive.read("word/styles.xml"),
                writer,
            )

        if "word/settings.xml" in after_archive.namelist():
            replacements["word/settings.xml"] = _enable_revision_display(after_archive.read("word/settings.xml"))

        if include_metadata:
            for name in after_archive.namelist():
                if re.fullmatch(r"word/(header|footer)\d+\.xml", name) and name in before_names:
                    replacements[name] = _revisionize_xml_part(
                        before_part(name),
                        after_archive.read(name),
                        bool(include_formatting),
                        writer,
                        include_tables=bool(include_tables),
                        part=name,
                    )
            for name, note_tag in (("word/footnotes.xml", "footnote"), ("word/endnotes.xml", "endnote")):
                if name in after_archive.namelist() and name in before_names:
                    replacements[name] = _revisionize_notes(
                        before_part(name),
                        after_archive.read(name),
                        bool(include_formatting),
                        writer,
                        note_tag,
                        bool(include_tables),
                    )

        for decision in _MANIFEST_DECISIONS:
            if decision.get("trackedRepresentation") == "preserve-after":
                continue
            for side in ("before", "after"):
                for ref in decision[side]:
                    if _MANIFEST_CONSUMED.get((side, _manifest_key(ref))) != 1:
                        raise ValueError("UNSUPPORTED_TRACKED_SOURCE")

        if _MANIFEST_PROPERTY_USED != {action["id"] for action in _MANIFEST["propertyActions"]}:
            raise ValueError("UNSUPPORTED_TRACKED_SOURCE")

        _PACKAGE_GRAPH.finish(replacements, additions)
        _PACKAGE_GRAPH.validate(replacements, additions)
        with zipfile.ZipFile(output_path, "w") as output_archive:
            for entry in after_archive.infolist():
                output_archive.writestr(entry, replacements.get(entry.filename, after_archive.read(entry.filename)))
            for name, data in additions.items():
                output_archive.writestr(name, data)

    _MANIFEST = None
    return writer.count


def generate_tracked_document(before_path, after_path, output_path, author, include_formatting, include_tables, include_metadata, manifest_json=None, formatting_mask_json=None):
    global _MANIFEST, _MANIFEST_NODE_KEYS, _MANIFEST_DECISIONS, _MANIFEST_USED, _MANIFEST_CONSUMED, _MANIFEST_ACTIVE_DECISION, _MANIFEST_ACTIVE_COMPARISON, _MANIFEST_PROPERTY_USED, _MANIFEST_SOURCE_NODES, _MANIFEST_ALLOWED_PROPERTIES
    global _PACKAGE_GRAPH
    try:
        return _generate_tracked_document(before_path, after_path, output_path, author, include_formatting, include_tables, include_metadata, manifest_json, formatting_mask_json)
    finally:
        # Do not retain source nodes or text decisions after failure/cancellation.
        _MANIFEST = None
        _PACKAGE_GRAPH = None
        _MANIFEST_NODE_KEYS = {}
        _MANIFEST_DECISIONS = []
        _MANIFEST_USED = set()
        _MANIFEST_CONSUMED = {}
        _MANIFEST_ACTIVE_DECISION = None
        _MANIFEST_ACTIVE_COMPARISON = None
        _MANIFEST_PROPERTY_USED = set()
        _MANIFEST_SOURCE_NODES = {}
        _MANIFEST_ALLOWED_PROPERTIES = {}
