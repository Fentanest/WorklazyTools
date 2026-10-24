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
    W + "tblGridChange",
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
        self.output_owner=None
        self.story_parts={item["part"] for item in _story_package_facts(after)["parts"]}|{"word/document.xml","word/footnotes.xml","word/endnotes.xml","word/comments.xml"}
        self.types = ET.fromstring(after.read('[Content_Types].xml')) if '[Content_Types].xml' in after.namelist() else ET.Element(CT+'Types')
        self.before_types = ET.fromstring(before.read('[Content_Types].xml')) if '[Content_Types].xml' in before.namelist() else ET.Element(CT+'Types')
        self.names = set(after.namelist()); self.next_drawing_id = 1
        for part in after.namelist():
            if part.startswith('word/media/'):
                self.media[(hashlib.sha256(after.read(part)).hexdigest(),self.mime(part,self.types))] = part
            if part in self.story_parts:
                for node in ET.fromstring(after.read(part)).iter():
                    if node.tag=='{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}docPr' and node.get('id','').isdigit(): self.next_drawing_id = max(self.next_drawing_id,int(node.get('id'))+1)
    def add_note_part(self, part, kind):
        self.names.add(part)
        content='application/vnd.openxmlformats-officedocument.wordprocessingml.'+kind+'s+xml'
        existing=[node for node in self.types if node.tag==CT+'Override' and node.get('PartName')=='/'+part]
        if len(existing)>1 or any(node.get('ContentType')!=content for node in existing):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_NOTE_CONTENT_TYPE')
        if not existing:ET.SubElement(self.types,CT+'Override',{'PartName':'/'+part,'ContentType':content})
        path=self.rel_path('word/document.xml')
        root=self.roots.get(path)
        if root is None:root=ET.fromstring(self.after.read(path)) if path in self.after.namelist() else ET.Element(PR+'Relationships')
        kind_uri=R[1:-1]+'/'+kind+'s'
        if any(node.get('Type')==kind_uri for node in root):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_NOTE_RELATIONSHIP')
        used={node.get('Id') for node in root};number=1
        while 'rIdWorklazyNote'+str(number) in used:number+=1
        ET.SubElement(root,PR+'Relationship',{'Id':'rIdWorklazyNote'+str(number),'Type':kind_uri,'Target':posixpath.basename(part)})
        self.roots[path]=root
    def mime(self, part, types):
        content=next((node.get('ContentType') for node in types if node.tag==CT+'Override' and node.get('PartName')=='/'+part),None)
        return content or next((node.get('ContentType') for node in types if node.tag==CT+'Default' and node.get('Extension','').lower()==posixpath.splitext(part)[1].lstrip('.').lower()),None)
    def rel_path(self, part):
        return posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels')
    def leaf_hyperlink(self, part, target):
        # Bounded v1: an opaque XML data leaf, never a story or a nested OPC graph.
        if not target or any(c in target for c in "\\:#?%"):
            raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
        source=target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(part),target))
        if source.startswith('../') or source in self.story_parts or self.before.namelist().count(source)!=1:
            raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
        if self.rel_path(source) in self.before.namelist():raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RESOURCE_GRAPH')
        overrides=[n.get('ContentType') for n in self.before_types if n.tag==CT+'Override' and n.get('PartName')=='/'+source]
        defaults=[n.get('ContentType') for n in self.before_types if n.tag==CT+'Default' and n.get('Extension','').lower()==posixpath.splitext(source)[1].lstrip('.').lower()]
        declarations=overrides or defaults
        if declarations!=['application/xml']:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_CONTENT_TYPE')
        data=self.before.read(source)
        try:root=ET.fromstring(data)
        except ET.ParseError:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RESOURCE_GRAPH')
        office=('http://schemas.openxmlformats.org/','urn:schemas-microsoft-com:','http://schemas.microsoft.com/office/')
        if any(n.tag.startswith(tuple('{'+uri for uri in office)) or any(a.startswith(R) for a in n.attrib) for n in root.iter()):
            raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RESOURCE_GRAPH')
        return source,data,'application/xml'
    def relationship(self, part, rid, output_owner=None):
        output_owner=output_owner or part
        key=('before',part,rid,output_owner)
        if key in self.ids: return self.ids[key]
        path=self.rel_path(part)
        if path not in self.before.namelist(): raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
        candidates=[node for node in ET.fromstring(self.before.read(path)) if node.get('Id')==rid]
        if len(candidates)!=1: raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
        old=candidates[0]; kind=old.get('Type',''); target=old.get('Target','')
        if kind not in {R[1:-1]+'/image',R[1:-1]+'/hyperlink'}: raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
        path=self.rel_path(output_owner)
        root=self.roots.get(path)
        if root is None:root=ET.fromstring(self.after.read(path)) if path in self.after.namelist() else ET.Element(PR+'Relationships')
        if old.get('TargetMode')!='External':
            source=target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(part),target))
            if kind==R[1:-1]+'/hyperlink':
                if old.get('TargetMode','') not in ('','Internal'):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
                source,_,_=self.leaf_hyperlink(part,target)
            elif source not in self.before.namelist():raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
            if self.rel_path(source) in self.before.namelist():raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RESOURCE_GRAPH')
            data=self.before.read(source); digest=hashlib.sha256(data).hexdigest()
            content=self.mime(source,self.before_types)
            if content is None: raise ValueError('UNSUPPORTED_TRACKED_SOURCE_CONTENT_TYPE')
            cache_key=(digest,content) if kind==R[1:-1]+'/image' else ('hyperlink',digest,content)
            destination=self.media.get(cache_key)
            if destination is None:
                extension=posixpath.splitext(source)[1]
                prefix='word/media/worklazy-' if kind==R[1:-1]+'/image' else 'word/worklazy-resource-'
                destination=prefix+digest+extension
                suffix=0
                while destination in self.names:
                    suffix+=1; destination=prefix+digest+'-'+str(suffix)+extension
                self.names.add(destination);self.media[cache_key]=destination;self.additions[destination]=data
                ET.SubElement(self.types,CT+'Override',{'PartName':'/'+destination,'ContentType':content})
            target=posixpath.relpath(destination,posixpath.dirname(output_owner))
        for existing in root:
            if existing.get('Type')==kind and existing.get('TargetMode','')==old.get('TargetMode','') and existing.get('Target')==target:
                self.ids[key]=existing.get('Id');return existing.get('Id')
        self.roots[path]=root
        number=1;used={node.get('Id') for node in root}
        while 'rIdWorklazy'+str(number) in used:number+=1
        rid='rIdWorklazy'+str(number);attrs=dict(old.attrib);attrs.update(Id=rid,Target=target)
        ET.SubElement(root,PR+'Relationship',attrs);self.ids[key]=rid
        return rid
    def copy(self, source, part, output_owner=None):
        result=copy.deepcopy(source)
        for node in result.iter():
            for name,value in list(node.attrib.items()):
                if name.startswith(R):node.set(name,self.relationship(part,value,output_owner))
            if node.tag=='{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}docPr':
                node.set('id',str(self.next_drawing_id));self.next_drawing_id+=1
        return result
    def validate(self, replacements, additions):
        names=self.names | set(additions)
        types=ET.fromstring(replacements.get('[Content_Types].xml',self.after.read('[Content_Types].xml'))) if '[Content_Types].xml' in self.after.namelist() else self.types
        for part in self.story_parts:
            data=additions.get(part,replacements.get(part))
            if data is None:
                if part not in self.after.namelist():continue
                data=self.after.read(part)
            root=_qname_safe_parse(data);path=self.rel_path(part)
            raw=additions.get(path,replacements.get(path))
            rels=ET.fromstring(raw) if raw is not None else ET.fromstring(self.after.read(path)) if path in self.after.namelist() else ET.Element(PR+'Relationships')
            for node in root.iter():
                if node.tag not in {W+'headerReference',W+'footerReference',W+'hyperlink','{http://schemas.openxmlformats.org/drawingml/2006/main}blip','{urn:schemas-microsoft-com:vml}imagedata','{http://schemas.openxmlformats.org/drawingml/2006/main}hlinkClick'}:continue
                for name,rid in node.attrib.items():
                    if not name.startswith(R):continue
                    matches=[rel for rel in rels if rel.get('Id')==rid]
                    if len(matches)!=1:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
                    rel=matches[0]
                    expected=R[1:-1]+('/header' if node.tag==W+'headerReference' else '/footer' if node.tag==W+'footerReference' else '/hyperlink' if node.tag in {W+'hyperlink','{http://schemas.openxmlformats.org/drawingml/2006/main}hlinkClick'} else '/image')
                    if rel.get('Type','')!=expected:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_RELATIONSHIP')
                    if rel.get('TargetMode')=='External':continue
                    target=rel.get('Target','');target=target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(part),target))
                    if target not in names or self.mime(target,types) is None:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_CONTENT_TYPE')
                    if node.tag in {W+'headerReference',W+'footerReference'}:
                        kind='header' if node.tag==W+'headerReference' else 'footer'
                        if self.mime(target,types)!='application/vnd.openxmlformats-officedocument.wordprocessingml.'+kind+'+xml':raise ValueError('UNSUPPORTED_TRACKED_SOURCE_CONTENT_TYPE')
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
        if self.additions or any(part not in self.after.namelist() for part in additions):
            merged=ET.fromstring(replacements.get('[Content_Types].xml',self.after.read('[Content_Types].xml')))
            present={node.get('PartName') for node in merged if node.tag==CT+'Override'}
            for node in self.types:
                if node.tag==CT+'Override' and node.get('PartName','').lstrip('/') in additions and node.get('PartName') not in present:merged.append(copy.deepcopy(node))
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
    result=_PACKAGE_GRAPH.copy(source, origin[1][0],_PACKAGE_GRAPH.output_owner) if _PACKAGE_GRAPH is not None and origin and origin[0] == "before" else copy.deepcopy(source)
    if _MANIFEST is not None and origin and origin[0]=='before':
        parents={child:parent for parent in result.iter() for child in parent}
        for original,cloned in list(zip(source.iter(),result.iter())):
            if not _is_note_event(original):continue
            if _MANIFEST['options']['metadata']:
                action=_note_action(original);cloned.set(W+'id',_NOTE_IDS[action['noteId']])
            elif cloned in parents:parents[cloned].remove(cloned)
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


def _qname_safe_parse(data, register_namespaces=True):
    pending = {}; contexts = []; root = None
    for event, value in ET.iterparse(io.BytesIO(data), events=("start-ns", "start", "end")):
        if event == "start-ns":
            prefix, uri = value; pending[prefix or ""] = uri
            if register_namespaces and prefix and not prefix.startswith("wltq"):
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
                    if register_namespaces:ET.register_namespace("wltn" + hashlib.sha256(uri.encode()).hexdigest(), uri)
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








def _table_grid_projection(source,paired=False):
    origin=_MANIFEST_NODE_KEYS.get(source)
    candidates=[decision for decision in _MANIFEST_DECISIONS if decision['type']=='table' and origin and any(_manifest_key(ref)==origin[1] for ref in decision[origin[0]])]
    if len(candidates)!=1:raise ValueError('INVALID_COMPARISON_MANIFEST_GRID_OWNER')
    decision=candidates[0]
    keys={(decision['id'],side) for side in ('before','after') if decision[side]} if paired else {(decision['id'],origin[0])}
    if _MANIFEST_GRID_USED & keys:raise ValueError('INVALID_COMPARISON_MANIFEST_GRID_CONSUMPTION')
    _MANIFEST_GRID_USED.update(keys)
    return decision['gridProjection']


def _revisionize_table_grid(result,before,after,writer):
    projection=_table_grid_projection(before,True)
    action=_property_action(before,after,W+'tblGrid') if _MANIFEST['options']['formatting'] else None
    if not projection['changed']:return
    current=result.find(W+'tblGrid')
    if current is None:
        current=ET.Element(W+'tblGrid');index=list(result).index(result.find(W+'tblPr'))+1 if result.find(W+'tblPr') is not None else 0;result.insert(index,current)
    if current.find(W+'tblGridChange') is not None:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_GRID_HISTORY')
    previous=ET.Element(W+'tblGrid')
    for entry in projection['restore']:
        if entry['implicit']:column=ET.Element(W+'gridCol')
        else:
            source=before if entry['side']=='before' else after
            column=copy.deepcopy(source.find(W+'tblGrid').findall(W+'gridCol')[entry['index']])
        previous.append(column)
    attributes=writer.attributes();change=ET.SubElement(current,W+'tblGridChange',{W+'id':attributes[W+'id']});change.append(previous)


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
    if property_tag==W+"pPr":
        for child in list(previous):
            if child.tag in {W+"rPr",W+"sectPr"}:previous.remove(child)
    if property_tag==W+"sectPr":
        for child in list(previous):
            if child.tag in {W+"headerReference",W+"footerReference"}:previous.remove(child)
    attributes=writer.attributes()
    if change_tag==W+"tblGridChange":attributes={W+"id":attributes[W+"id"]}
    change = ET.SubElement(result, change_tag, attributes)
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
        index=list(result).index(result.find(W+"tblPr"))+1 if property_tag==W+"tblGrid" and result.find(W+"tblPr") is not None else 0
        result.insert(index, revised)


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
                for reference in list(child.findall(W+"commentReference")):child.remove(reference)
                if all(node.tag==W+"rPr" for node in child):
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
    if paragraph in _MANIFEST_SYNTHETIC_TOKENS:
        tokens,events=_MANIFEST_SYNTHETIC_TOKENS[paragraph]
        return (tokens,events) if collect_events else tokens
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
                    drawings=[child for child in node if _is_drawing_event(child) or _is_note_event(child)]
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
                if (_is_drawing_event(child) or _is_note_event(child)) and collect_events and not inside_preserved_wrapper: events.setdefault(len(tokens),[]).append(child)
                for token in value:tokens.append({"text":token,"properties":copy.deepcopy(run_properties) if run_properties is not None else None,"wrapper":wrapper,"link":link,"sourceOffset":len(tokens)})
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


def _consume_object(source, positions=None):
    if _MANIFEST is None:return
    origin=_MANIFEST_NODE_KEYS.get(source)
    if origin not in _MANIFEST_OBJECT_EXPECTED:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_EMISSION")
    expected=_MANIFEST_OBJECT_EXPECTED[origin];values=set(expected if positions is None else positions)
    consumed=_MANIFEST_OBJECT_CONSUMED.setdefault(origin,set())
    if not values<=expected or consumed & values:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_EMISSION")
    consumed.update(values)


def _consume_link_tokens(tokens):
    for token in tokens:
        if token.get("link") is not None:_consume_object(token["link"],[token["sourceOffset"]])


def _consume_copied_objects(source):
    if source in _MANIFEST_SYNTHETIC_TOKENS:
        tokens,events=_MANIFEST_SYNTHETIC_TOKENS[source];_consume_link_tokens(tokens)
        for values in events.values():
            for event in values:
                if _is_drawing_event(event) or _is_note_event(event):_consume_object(event)
        return
    origin=_MANIFEST_NODE_KEYS.get(source)
    if _MANIFEST is None or origin is None:return
    side,(part,path)=origin
    for key,positions in _MANIFEST_OBJECT_EXPECTED.items():
        if key[0]==side and key[1][0]==part and key[1][1][:len(path)]==path:
            _consume_object(_MANIFEST_SOURCE_NODES[key])


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
            _consume_link_tokens(tokens[start:end])
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
    for index,(proxy,(start,end)) in enumerate(zip((first_before,second_before),slices),1):
        selected={}
        context=next(value for value in _MANIFEST_ACTIVE_DECISION["objectEvents"]["contexts"] if value["comparisonIndex"]==index) if "objectEvents" in _MANIFEST_ACTIVE_DECISION else None
        if context is not None:
            for event in context["before"]:
                node=_MANIFEST_SOURCE_NODES[("before",_manifest_key(event["source"]))]
                selected.setdefault(event["start"],[]).append(node)
        _MANIFEST_SYNTHETIC_TOKENS[proxy]=(before_tokens[start:end],selected)
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
    projection=_MANIFEST_ACTIVE_DECISION["mergeProjection"]
    combined_tokens = _styled_tokens(first_before) + _styled_tokens(second_before)
    combined_before = _plain_paragraph_from_tokens(first_before, combined_tokens)
    events={}
    context=(_MANIFEST_ACTIVE_DECISION.get("objectEvents",{}).get("contexts") or [None])[0]
    if context is not None:
        for event in context["before"]:events.setdefault(event["start"],[]).append(_MANIFEST_SOURCE_NODES[("before",_manifest_key(event["source"]))])
    _MANIFEST_SYNTHETIC_TOKENS[combined_before]=(combined_tokens,events)
    _MANIFEST_ACTIVE_COMPARISON = _MANIFEST_ACTIVE_DECISION["comparisons"][1]
    revised_after = _paragraph_revision(combined_before, after, include_formatting, writer)
    first_attrs={name:value for name,value in first_before.attrib.items() if name not in {"{http://schemas.microsoft.com/office/word/2010/wordml}paraId","{http://schemas.microsoft.com/office/word/2010/wordml}textId"}}
    paragraphs=[ET.Element(W+"p",first_attrs),ET.Element(W+"p",dict(after.attrib))]
    properties=revised_after.find(W+"pPr")
    if properties is not None:paragraphs[0].append(copy.deepcopy(properties))
    action=projection["properties"][1]
    properties=_property_revision(after.find(W+"pPr"),second_before.find(W+"pPr"),W+"pPr",W+"pPrChange",writer,action["families"],action["history"])
    if properties is not None:paragraphs[1].append(properties)
    for child in revised_after:
        if child.tag==W+"pPr":continue
        side=_MANIFEST_MERGE_SIDES.get(child)
        if side not in (0,1):raise ValueError("UNSUPPORTED_TRACKED_SOURCE_MERGE_EMISSION")
        paragraphs[side].append(child)
    _mark_paragraph_end(paragraphs[0],"del",writer)
    return paragraphs


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
    properties = copy.deepcopy(after.find(W+property_name)) if property_name=="tblGrid" and action and action["representation"]=="preserve-after-history" else _project_properties(source.find(W + property_name), after.find(W + property_name), property_name)
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
                elif _is_note_event(event):
                    if _MANIFEST["options"]["metadata"]:paragraph.append(_note_event(event,"del",writer))
                    else:_consume_object(event)
            cursor=position
        return paragraph

    emitted_wrappers = set()
    position = 0
    while position <= len(tokens):
        for event in events.get(position, []):
            if _is_drawing_event(event):paragraph.append(_drawing_revision(event,"ins",writer))
            elif _is_note_event(event):paragraph.append(_note_event(event,"ins",writer))
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


def _linked_run(run, token):
    if token.get("link") is None:return run
    hyperlink=_source_copy(token["link"]);hyperlink[:]=[run];return hyperlink


def _source_event_decision(source):
    origin=_MANIFEST_NODE_KEYS.get(source)
    if origin is None:raise ValueError('INVALID_COMPARISON_MANIFEST_OBJECT_SOURCE')
    owner=_MANIFEST_EVENT_OWNERS.get(origin)
    if owner is None:raise ValueError('INVALID_COMPARISON_MANIFEST_OBJECT_SOURCE')
    return owner


def _link_source_key(token):
    link=token.get("link")
    if link is None:return None
    origin=_MANIFEST_NODE_KEYS.get(link)
    if origin is None:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_SOURCE")
    side,key=origin
    entry=next((source for source in _source_event_decision(link).get("objectEvents",{}).get(side,[]) if _manifest_key(source)==key),None)
    if entry is None:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_SOURCE")
    return origin[1]


_NOTE_IDS={}
def _is_note_event(node):return node.tag in (W+'footnoteReference',W+'endnoteReference')
def _note_action(source):
    origin=_MANIFEST_NODE_KEYS.get(source)
    if origin is None:raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_REFERENCE')
    return next(item for item in _MANIFEST['noteProjection']['references'] if item.get(origin[0]) and _manifest_key(item[origin[0]])==origin[1])
def _note_event(source,kind,writer):
    if not _MANIFEST['options']['metadata']:
        if kind!='ins':raise ValueError('UNSUPPORTED_TRACKED_SOURCE_NOTE_SCOPE')
        origin=_MANIFEST_NODE_KEYS[source];parent=_MANIFEST_SOURCE_NODES[(origin[0],(origin[1][0],origin[1][1][:-1]))]
        run=ET.Element(W+'r');properties=parent.find(W+'rPr')
        if properties is not None:run.append(copy.deepcopy(properties))
        run.append(copy.deepcopy(source));_consume_object(source);return run
    action=_note_action(source);result=_drawing_revision(source,kind,writer)
    for node in result.iter():
        if _is_note_event(node):node.set(W+'id',_NOTE_IDS[action['noteId']])
    return result

def _prepare_note_ids(after_archive):
    result={};used={}
    for pair in _MANIFEST['noteProjection']['pairs']:
        note=pair.get('after') or pair['before'];part=note['source']['part']
        if part not in used:
            root=ET.fromstring(after_archive.read(part)) if part in after_archive.namelist() else []
            used[part]={node.get(W+'id') for node in root}
            used[part].update(note['id'] for action in _MANIFEST['noteProjection']['partActions'] if action['part']==part for note in action['specials'])
        if pair.get('after'):result[pair['id']]=pair['after']['id']
        else:
            identity=1
            while str(identity) in used[part]:identity+=1
            used[part].add(str(identity));result[pair['id']]=str(identity)
    return result

def _drawing_revision(source, kind, writer):
    run=ET.Element(W+"r")
    origin=_MANIFEST_NODE_KEYS.get(source)
    parent=_MANIFEST_SOURCE_NODES.get((origin[0],(origin[1][0],origin[1][1][:-1]))) if origin else None
    properties=parent.find(W+"rPr") if parent is not None and parent.tag==W+"r" else None
    if kind=="del" and origin:
        owner=_source_event_decision(source)
        projection=next((pair for pair in owner.get("objectEvents",{}).get("drawingProperties",[]) if _manifest_key(pair["before"])==origin[1]),None)
        if projection is not None:
            after_ref=projection["after"]
            after_run=_MANIFEST_SOURCE_NODES.get(("after",(after_ref["part"],tuple(after_ref["objectEvent"]["runPath"]))))
            if after_run is None:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_PROPERTIES")
            revised=after_run.find(W+"rPr")
            # Restore included families from before, retaining every excluded
            # family from this explicitly paired revised image run.
            families=projection["families"] if projection["representation"]=="revision" else []
            value=_property_revision(revised,properties,W+"rPr",W+"rPrChange",writer,families)
            previous=value.find(W+"rPrChange/"+W+"rPr") if families and value is not None else None
            properties=previous if previous is not None else value
        else:
            restore=next((entry for entry in owner.get("objectEvents",{}).get("deletedDrawingStyles",[]) if _manifest_key(entry["before"])==origin[1]),None)
            if restore is None:raise ValueError("INVALID_COMPARISON_MANIFEST_DRAWING_RESTORE")
            if restore["policy"]!="restore-before-unpaired":
                after_run=_MANIFEST_SOURCE_NODES.get(("after",_manifest_key(restore["source"]))) if "source" in restore else None
                revised=after_run.find(W+"rPr") if after_run is not None else None
                revised=_effective_properties(revised) if revised is not None else None
                families=restore["families"]
                value=_property_revision(revised,properties,W+"rPr",W+"rPrChange",writer,families)
                previous=value.find(W+"rPrChange/"+W+"rPr") if families and value is not None else None
                properties=previous if previous is not None else value
    if properties is not None:run.append(_effective_properties(properties) if kind=="del" else copy.deepcopy(properties))
    run.append(_source_copy(source))
    _consume_object(source)
    revision=ET.Element(W+kind,writer.attributes());revision.append(run)
    return revision


def _paragraph_revision(before,after,include_formatting,writer):
    result=_paragraph_revision_content(before,after,include_formatting,writer)
    if include_formatting and _MANIFEST is not None:
        a=before.find(W+'pPr/'+W+'sectPr');b=after.find(W+'pPr/'+W+'sectPr')
        if a is not None and b is not None:
            action=_property_action(a,b,W+'sectPr')
            if action is not None:
                current=result.find(W+'pPr/'+W+'sectPr')
                if current is None:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_SECTION_PROPERTIES')
                revised=_property_revision(current,a,W+'sectPr',W+'sectPrChange',writer,action['families'],action['representation']=='preserve-after-history')
                props=result.find(W+'pPr');index=list(props).index(current);props.remove(current);props.insert(index,revised)
    return result


def _paragraph_revision_content(before, after, include_formatting, writer):
    before_text = _comparison_text(before)
    after_text = _comparison_text(after)
    # Source revisions cannot be nested safely inside a second insertion or
    # deletion. Keep the after-document author's text revision intact and let
    # that existing revision explain the visible change. This avoids producing
    # a mixed reject state such as "동의 없는금을" when revisions overlap.
    if before_text != after_text and _has_visible_text_revision(after):
        result=copy.deepcopy(after);_consume_copied_objects(before);_consume_copied_objects(after);return result
    before_tokens, before_events = _styled_tokens(before,collect_events=True)
    after_tokens, after_events = _styled_tokens(after, collect_events=True)
    before_values = [token["text"] for token in before_tokens]
    after_values = [token["text"] for token in after_tokens]
    before_paragraph_properties = before.find(W + "pPr")
    paragraph_properties = after.find(W + "pPr")
    formatting = (_MANIFEST_ACTIVE_COMPARISON or {}).get("formatting", {})
    paragraph_families = formatting.get("paragraphFamilies", []) if include_formatting else []
    spans = formatting.get("spans", []) if include_formatting else []
    merge=(_MANIFEST_ACTIVE_DECISION or {}).get("mergeProjection")
    format_changed = bool(paragraph_families or spans or any(pair["families"] for pair in (_MANIFEST_ACTIVE_DECISION or {}).get("objectEvents",{}).get("drawingProperties",[])))
    object_changed=bool(merge) or ((_MANIFEST_ACTIVE_DECISION or {}).get("objectEvents") or {}).get("changed",False)
    if before_text == after_text and not format_changed and not object_changed:
        result=copy.deepcopy(after);_consume_copied_objects(before);_consume_copied_objects(after);return result

    paragraph = ET.Element(W + "p", dict(after.attrib))
    revised_paragraph_properties = (
        _property_revision(paragraph_properties, before_paragraph_properties, W + "pPr", W + "pPrChange", writer, paragraph_families, formatting.get("paragraphHistory", False))
        if include_formatting
        else copy.deepcopy(paragraph_properties) if paragraph_properties is not None else None
    )
    if revised_paragraph_properties is not None:
        paragraph.append(revised_paragraph_properties)

    def append_nodes(values,before_position=None,event=None,after_position=None):
        for value in values:
            if merge:
                if event is not None and (_is_drawing_event(event) or _is_note_event(event)):
                    side,key=_MANIFEST_NODE_KEYS[event]
                    entry=next(item for item in merge[side+"Events"] if _manifest_key(item["source"])==key)
                    role=entry["side"]
                elif before_position is not None:role=int(before_position>=merge["beforeBoundary"])
                elif after_position is not None:role=int(after_position>=merge["afterBoundary"])
                else:raise ValueError("UNSUPPORTED_TRACKED_SOURCE_MERGE_EMISSION")
                _MANIFEST_MERGE_SIDES[value]=role
            paragraph.append(value)
    unchanged_drawings=(_MANIFEST_ACTIVE_DECISION or {}).get("objectEvents",{}).get("unchangedDrawings",[]) if merge else []
    emitted_event_positions = set()
    emitted_wrappers = set()

    def emit_events(position):
        if position in emitted_event_positions:
            return
        emitted_event_positions.add(position)
        for event in after_events.get(position, []):
            if _is_note_event(event):
                if not _MANIFEST["options"]["metadata"]:
                    origin=_MANIFEST_NODE_KEYS[event][1];parent=_MANIFEST_SOURCE_NODES[("after",(origin[0],origin[1][:-1]))];run=ET.Element(W+"r");props=parent.find(W+"rPr")
                    if props is not None:run.append(copy.deepcopy(props))
                    run.append(copy.deepcopy(event));_consume_object(event);append_nodes([run],after_position=position);continue
                action=_note_action(event);matched=action.get('before') and action.get('after')
                pair=next((pair for pair in (_MANIFEST_ACTIVE_DECISION.get('objectEvents') or {}).get('unchangedDrawings',[]) if _manifest_key(pair['after'])==_MANIFEST_NODE_KEYS[event][1]),None)
                if matched and pair:
                    origin=_MANIFEST_NODE_KEYS[event][1];parent=_MANIFEST_SOURCE_NODES[('after',(origin[0],origin[1][:-1]))];run=ET.Element(W+'r');props=parent.find(W+'rPr')
                    if props is not None:run.append(copy.deepcopy(props))
                    ref=copy.deepcopy(event);ref.set(W+'id',_NOTE_IDS[action['noteId']]);run.append(ref);_consume_object(event);_consume_object(_MANIFEST_SOURCE_NODES[('before',_manifest_key(action['before']))]);append_nodes([run],after_position=position,event=event)
                else:append_nodes([_note_event(event,'ins',writer)],after_position=position,event=event)
                continue
            if _is_drawing_event(event):
                origin=_MANIFEST_NODE_KEYS[event][1]
                pair=next((pair for pair in unchanged_drawings if _manifest_key(pair["after"])==origin),None)
                if pair is None:append_nodes([_drawing_revision(event,"ins",writer)],event=event)
                else:
                    parent=_MANIFEST_SOURCE_NODES[("after",(origin[0],origin[1][:-1]))]
                    run=ET.Element(W+"r");properties=parent.find(W+"rPr")
                    if properties is not None:run.append(copy.deepcopy(properties))
                    run.append(_source_copy(event));_consume_object(event);_consume_object(_MANIFEST_SOURCE_NODES[("before",_manifest_key(pair["before"]))])
                    append_nodes([run],event=event)
            else:append_nodes([copy.deepcopy(event)],after_position=position)

    emitted_before_events=set()
    def emit_before_events(position):
        if position in emitted_before_events:return
        emitted_before_events.add(position)
        for event in before_events.get(position,[]):
            if _is_note_event(event):
                if not _MANIFEST["options"]["metadata"]:_consume_object(event);continue
                action=_note_action(event)
                if action.get('after') and any(_manifest_key(pair['before'])==_MANIFEST_NODE_KEYS[event][1] for pair in (_MANIFEST_ACTIVE_DECISION.get('objectEvents') or {}).get('unchangedDrawings',[])):continue
                append_nodes([_note_event(event,'del',writer)],before_position=position,event=event);continue
            if _is_drawing_event(event):
                if any(_manifest_key(pair["before"])==_MANIFEST_NODE_KEYS[event][1] for pair in unchanged_drawings):continue
                append_nodes([_drawing_revision(event,"del",writer)],event=event)

    def emit_deleted(start,end):
        cursor=start
        boundaries={merge["beforeBoundary"]} if merge and start<merge["beforeBoundary"]<end else set()
        for position in sorted({value for value in before_events if start<=value<=end}|{end}|boundaries):
            if cursor<position:append_nodes(_revision_containers("del",(_restore_projected_tokens(before_tokens[cursor:position],cursor,_MANIFEST_ACTIVE_COMPARISON["restoreStyles"]) if _MANIFEST is not None else before_tokens[cursor:position]),writer,strip_history=True),before_position=cursor)
            emit_before_events(position);cursor=position

    def emit_existing_wrapper(token):
        wrapper = token.get("wrapper")
        if wrapper is None:
            return False
        wrapper_id, wrapper_element = wrapper
        if wrapper_id not in emitted_wrappers:
            append_nodes([copy.deepcopy(wrapper_element)],after_position=token["sourceOffset"])
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
            link_pair=(_link_source_key(before_tokens[before_position]),_link_source_key(token))
            pair = (scope_id, families, preserve_history, _properties_signature(after_properties),link_pair)
            end = position + 1
            while end < j2 and end not in after_events and i1+end-j1 not in before_events and (not merge or i1+end-j1!=merge["beforeBoundary"]) and after_tokens[end].get("wrapper") is None:
                next_families, next_history, next_scope_id = declared(i1 + (end - j1), end)
                if (next_scope_id, next_families, next_history, _properties_signature(after_tokens[end]["properties"]),(_link_source_key(before_tokens[i1+end-j1]),_link_source_key(after_tokens[end]))) != pair:
                    break
                end += 1
            text = "".join(item["text"] for item in after_tokens[position:end])
            revised_properties = _property_revision(after_properties, before_properties, W + "rPr", W + "rPrChange", writer, families, preserve_history) if families else after_properties
            if any(value is not None for value in link_pair) and link_pair not in {(_manifest_key(pair["before"]),_manifest_key(pair["after"])) for pair in (_MANIFEST_ACTIVE_DECISION or {}).get("objectEvents",{}).get("unchangedLinks",[])}:
                append_nodes(_revision_containers("del",_restore_projected_tokens(before_tokens[before_position:before_position+end-position],before_position,_MANIFEST_ACTIVE_COMPARISON["restoreStyles"]),writer,strip_history=True),before_position=before_position)
                append_nodes(_revision_containers("ins",after_tokens[position:end],writer),before_position=before_position)
            else:
                append_nodes([_linked_run(_token_run(text,revised_properties),token)],before_position=before_position)
                _consume_link_tokens(before_tokens[before_position:before_position+end-position]);_consume_link_tokens(after_tokens[position:end])
            position = end
        emit_before_events(i1+j2-j1)
        emit_events(j2)

    def emit_inserted(j1, j2, before_position):
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
                if _properties_signature(after_tokens[end]["properties"]) != signature or _link_source_key(after_tokens[end])!=_link_source_key(token):
                    break
                end += 1
            append_nodes(_revision_containers("ins", after_tokens[position:end], writer),before_position=before_position)
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
                emit_inserted(j1, j2, i1)
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
            row = copy.deepcopy(after_rows[after_row_index]);_consume_copied_objects(after_rows[after_row_index])
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
                cell = copy.deepcopy(after_cell);_consume_copied_objects(after_cell)
                _mark_cell(cell, "cellIns", writer)
            elif after_cell is None and before_cell is not None:
                _consume_manifest_subtree("before", before_cell)
                cell = _accepted_copy(before_cell);_consume_copied_objects(before_cell)
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
    _revisionize_table_grid(table,before,after,writer)
    return table


def _whole_table_revision(source, kind, writer):
    _consume_manifest_subtree("after" if kind == "ins" else "before", source)
    projection=_table_grid_projection(source)
    table = copy.deepcopy(source) if kind == "ins" else _accepted_copy(source)
    if kind=="ins":_consume_copied_objects(source)
    if kind == "del":
        _restore_whole_properties(table, source, "tblPr")
        _restore_whole_properties(table, source, "tblGrid")
        if projection['mode']=='paired':
            current=table.find(W+'tblGrid');previous=ET.Element(W+'tblGrid')
            for entry in projection['restore']:
                if entry['implicit']:column=ET.Element(W+'gridCol')
                else:
                    ref=next(decision[entry['side']][0] for decision in _MANIFEST_DECISIONS if decision.get('gridProjection') is projection)
                    root=_MANIFEST_SOURCE_NODES[(entry['side'],_manifest_key(ref))];column=copy.deepcopy(root.find(W+'tblGrid').findall(W+'gridCol')[entry['index']])
                previous.append(column)
            if current is not None:table.remove(current)
            index=list(table).index(table.find(W+'tblPr'))+1 if table.find(W+'tblPr') is not None else 0;table.insert(index,previous)
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
_MANIFEST_MERGE_SIDES = {}
_MANIFEST_SYNTHETIC_TOKENS = {}
_MANIFEST_OBJECT_EXPECTED = {}
_MANIFEST_EVENT_OWNERS = {}
_MANIFEST_GRID_USED = set()
_MANIFEST_OBJECT_CONSUMED = {}


def _manifest_key(source):
    if not isinstance(source, dict) or not isinstance(source.get("part"), str) or not isinstance(source.get("path"), list) or any(type(index) is not int or index < 0 for index in source["path"]):
        raise ValueError("INVALID_COMPARISON_MANIFEST_SOURCE_REF")
    return (source["part"], tuple(source["path"]))


def _source_envelope(nodes,side_name,value):
    def canonical(node):
        return (node.tag,tuple(sorted(node.attrib.items())),node.text if (node.text or "").strip() else "",tuple(canonical(child) for child in node),node.tail if (node.tail or "").strip() else "")
    result=[]
    for depth in range(1,len(value["path"])):
        ancestor=nodes[side_name][(value["part"],tuple(value["path"][:depth]))]
        if ancestor.tag==CONTENT_CONTROL_TAG:
            result.append((ancestor.tag,tuple(sorted(ancestor.attrib.items())),ancestor.text if (ancestor.text or "").strip() else "",tuple(canonical(child) for child in ancestor if child.tag!=CONTENT_CONTROL_BODY_TAG)))
        elif ancestor.tag==CONTENT_CONTROL_BODY_TAG:
            result.append((ancestor.tag,tuple(sorted(ancestor.attrib.items())),ancestor.text if (ancestor.text or "").strip() else ""))
    return result

def _validate_story_projection(facts,actual):
    if _MANIFEST.get('storyFacts')!=facts:raise ValueError('INVALID_COMPARISON_MANIFEST_STORY_FACTS')
    plan=_MANIFEST.get('storyProjection',{})
    if plan.get('policy')!='worklazy-story-projection-2':raise ValueError('INVALID_COMPARISON_MANIFEST_STORY')
    a,b=facts['before'],facts['after'];sections=plan.get('sections');ids=set()
    if not isinstance(sections,list):raise ValueError('INVALID_COMPARISON_MANIFEST_SECTIONS')
    for pair in sections:
        if pair['id'] in ids:raise ValueError('INVALID_COMPARISON_MANIFEST_SECTIONS')
        ids.add(pair['id'])
        for side in ('before','after'):
            if pair.get(side) is not None and pair[side] not in facts[side]['sections']:raise ValueError('INVALID_COMPARISON_MANIFEST_SECTIONS')
        if pair['final']:
            if pair['id']!='section:final-body' or pair.get('ownerDecisionId') is not None or any(not pair[side]['final'] for side in ('before','after') if pair.get(side)):raise ValueError('INVALID_COMPARISON_MANIFEST_SECTIONS')
        else:
            owner=next((d for d in _MANIFEST_DECISIONS if d['id']==pair.get('ownerDecisionId')),None)
            if owner is None or owner['type']!='paragraph' or owner['moved'] or len(owner['before'])!=1 or len(owner['after'])!=1 or pair['id']!='section:'+owner['id']:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_SECTION_BOUNDARY')
            for side in ('before','after'):
                section=pair.get(side);paragraph=owner[side][0]
                if section is None or section['final'] or section['source']['part']!=paragraph['part'] or len(section['source']['path'])!=len(paragraph['path'])+2 or section['source']['path'][:len(paragraph['path'])]!=paragraph['path']:raise ValueError('INVALID_COMPARISON_MANIFEST_SECTION_OWNER')
                if not any(ref['kind']=='body' and ref['part']==paragraph['part'] and ref['path']==paragraph['path'][:-1] for ref in actual[side].values()):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_SECTION_ENVELOPE')
    if _MANIFEST['options']['metadata'] or _MANIFEST['options']['formatting']:
        for side in ('before','after'):
            if [pair[side] for pair in sections if pair.get(side)]!=facts[side]['sections']:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_SECTION_ORDER')
    elif sections:raise ValueError('INVALID_COMPARISON_MANIFEST_SECTIONS')
    if plan.get('supported') is not True or plan.get('reasons'):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_STORY')
    if not _MANIFEST['options']['metadata']:
        if plan.get('pairs')!=[] or plan.get('bindings')!=[] or plan.get('routes')!=[]:raise ValueError('INVALID_COMPARISON_MANIFEST_STORY')
        return
    if a['errors'] or b['errors']:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_STORY')
    if any(not p['final'] for p in sections):
        if not any(s['final'] for s in a['sections']) or not any(s['final'] for s in b['sections']):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_SECTIONS')
        if any(p.get('before',{}).get('activation')!=p.get('after',{}).get('activation') for p in sections):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_SECTION_ACTIVATION')
    if a.get('settings')!=b.get('settings'):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_STORY_ACTIVATION')
    if any(('before' in item)!=('after' in item) for item in plan.get('bindings',[])):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_STORY_BINDING')
    pairs=plan.get('pairs',[]);pair_ids={pair['id'] for pair in pairs}
    if len(pair_ids)!=len(pairs):raise ValueError('INVALID_COMPARISON_MANIFEST_STORY')
    slots=sorted({ref['kind']+':'+ref['variant'] for ref in a['bindings']+b['bindings']});expected_bindings=[];routes=[];used=set();donors={'before':{},'after':{}}
    for section in sections:
        for slot in slots:
            refs={side:next((ref for ref in facts[side]['bindings'] if section.get(side) and ref['section']==section[side]['source'] and ref['kind']+':'+ref['variant']==slot),None) for side in ('before','after')}
            old,new=refs['before'],refs['after'];kind,variant=slot.split(':')
            if old or new:
                pair=next((pair for pair in pairs if pair.get('beforePart')==(old or {}).get('targetPart') and pair.get('afterPart')==(new or {}).get('targetPart')),None)
                if pair is None:raise ValueError('INVALID_COMPARISON_MANIFEST_STORY_BINDING')
                binding={'id':'binding:'+section['id']+':'+slot,'sectionId':section['id'],'kind':kind,'variant':variant,'storyId':pair['id']}
                if old is not None:binding['before']=old
                if new is not None:binding['after']=new
                expected_bindings.append(binding);used.add(pair['id'])
            for side in ('before','after'):
                if refs[side]:donors[side][slot]={'donorSectionId':section['id'],'part':refs[side]['targetPart']}
            before={'explicit':old is not None,**donors['before'].get(slot,{})};after={'explicit':new is not None,**donors['after'].get(slot,{})}
            pair=next((pair for pair in pairs if pair.get('beforePart')==before.get('part') and pair.get('afterPart')==after.get('part')),None)
            route={'sectionId':section['id'],'kind':kind,'variant':variant,'before':before,'after':after}
            if pair:route['storyId']=pair['id']
            if before.get('donorSectionId')!=after.get('donorSectionId') or bool(before.get('part'))!=bool(after.get('part')):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_STORY_INHERITANCE')
            routes.append(route)
    if plan.get('bindings')!=expected_bindings or plan.get('routes')!=routes:raise ValueError('INVALID_COMPARISON_MANIFEST_STORY_BINDING')
    owned={'before':set(),'after':set()};covered_decisions=set()
    for pair in pairs:
        old,new=pair.get('beforePart'),pair.get('afterPart')
        kind=pair['kind'];identity='story:'+json.dumps([kind,old,new],ensure_ascii=False,separators=(',',':'))
        representation='inline' if old and new else 'unsupported-binding'
        if pair['id']!=identity or pair['representation']!=representation:raise ValueError('INVALID_COMPARISON_MANIFEST_STORY')
        for side,part in [('before',old),('after',new)]:
            if part is None:continue
            if part in owned[side] or not any(item['part']==part and item['kind']==kind for item in facts[side]['parts']):raise ValueError('INVALID_COMPARISON_MANIFEST_STORY_OWNER')
            owned[side].add(part)
        if pair['id'] not in used and (old!=new or any(item['active'] for side,part in [('before',old),('after',new)] for item in facts[side]['parts'] if item['part']==part)):raise ValueError('INVALID_COMPARISON_MANIFEST_STORY_BINDING')
        decisions=[decision for decision in _MANIFEST_DECISIONS if any(ref['part']==part for side,part in [('before',old),('after',new)] if part for ref in decision[side])]
        if pair['decisionIds']!=[decision['id'] for decision in decisions] or any(decision['id'] in covered_decisions for decision in decisions):raise ValueError('INVALID_COMPARISON_MANIFEST_STORY_COVERAGE')
        covered_decisions.update(pair['decisionIds'])
        for decision in decisions:
            if any(ref['part']!=part for side,part in [('before',old),('after',new)] for ref in decision[side]) or decision.get('trackedRepresentation')!='revision':raise ValueError('INVALID_COMPARISON_MANIFEST_STORY_COVERAGE')
        for side,part in [('before',old),('after',new)]:
            expected=[ref for ref in actual[side].values() if ref['part']==part and ref['kind'] in ('p','tbl')]
            if pair['coverage'][side]!=expected:raise ValueError('INVALID_COMPARISON_MANIFEST_STORY_COVERAGE')
    if any(owned[side]!={item['part'] for item in facts[side]['parts']} for side in ('before','after')):raise ValueError('INVALID_COMPARISON_MANIFEST_STORY_COVERAGE')

def _validate_note_projection(facts,actual):
    if _MANIFEST.get('noteFacts')!=facts:raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_FACTS')
    plan=_MANIFEST.get('noteProjection',{})
    if _MANIFEST['options']['metadata']:
        expected_parts=[{'part':'word/'+kind+'s.xml','kind':kind,'before':'word/'+kind+'s.xml' in facts['before']['parts'],'after':'word/'+kind+'s.xml' in facts['after']['parts'],'create':'word/'+kind+'s.xml' not in facts['after']['parts'],'specials':[] if 'word/'+kind+'s.xml' in facts['after']['parts'] else [note for note in facts['before']['containers'] if note['kind']==kind and note['type']!='normal']} for kind in ('footnote','endnote') if any('word/'+kind+'s.xml' in facts[side]['parts'] for side in ('before','after'))]
        if plan.get('partActions')!=expected_parts:raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_PARTS')
        for decision in _MANIFEST_DECISIONS:
            if decision['type']!='paragraph' or len(decision['before'])!=1 or len(decision['after'])!=2:continue
            before=decision['before'][0];left,right=decision['after'];boundary=decision['splitSlices'][0][1]
            refs=lambda side,parent:[ref['source']['objectEvent'] for ref in facts[side]['references'] if ref['source']['part']==parent['part'] and ref['source']['objectEvent']['paragraphPath']==parent['path']]
            if sum(ref['start']==boundary for ref in refs('before',before))>1 and any(ref['start']==len(actual['after'][_manifest_key(left)]['rawText']) for ref in refs('after',left)) and any(ref['start']==0 for ref in refs('after',right)):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_NOTE_ORDER')
        checks=plan.get('specialChecks');covered=set()
        if not isinstance(checks,list):raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_SPECIAL')
        def selected(side,note):
            result=[]
            for source in actual[side].values():
                if source['part']!=note['source']['part'] or source['path'][:1]!=note['source']['path']:continue
                for property_name,fact in source.get('normalizedProperties',{}).items():
                    values={name:value for name,value in fact['supported'].items() if _mask_enabled(property_name,name)}
                    if values:result.append(values)
            return result
        for check in checks:
            identity=(check['part'],check['role'])
            if identity in covered or not any(action['part']==check['part'] and action['before'] and action['after'] for action in expected_parts):raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_SPECIAL')
            covered.add(identity)
            for side in ('before','after'):
                expected=[note for note in facts[side]['containers'] if note['source']['part']==check['part'] and note['type']==check['role'] and note['type']!='normal']
                if check.get(side)!=expected:raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_SPECIAL')
            old,new=check['before'],check['after']
            equal=len(old)==len(new)==1 and old[0]['contentSignature']==new[0]['contentSignature'] and selected('before',old[0])==selected('after',new[0])
            if check.get('includedEqual') is not equal or not equal:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_NOTE_SPECIAL')
        required={(action['part'],note['type']) for action in expected_parts if action['before'] and action['after'] for side in ('before','after') for note in facts[side]['containers'] if note['source']['part']==action['part'] and note['type']!='normal'}
        if covered!=required:raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_SPECIAL')

    if plan.get('policy')!='worklazy-note-projection-1':raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE')
    if not _MANIFEST['options']['metadata']:
        if plan!={'policy':'worklazy-note-projection-1','supported':True,'reasons':[],'pairs':[],'references':[]}:raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE')
        return
    if plan.get('supported') is not True or plan.get('reasons') or any(value['errors'] for value in facts.values()):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_NOTE')
    pairs=plan['pairs'];owned={side:set() for side in ('before','after')};used_refs={side:set() for side in ('before','after')};ids=set()
    for pair in pairs:
        old,new=pair.get('before'),pair.get('after');identity='note:'+json.dumps([(old or {}).get('source'),(new or {}).get('source')],ensure_ascii=False,separators=(',',':'))
        if pair['id']!=identity or identity in ids or pair['kind']!=(old or new)['kind']:raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE')
        ids.add(identity)
        for side,note in [('before',old),('after',new)]:
            if note is None:continue
            key=_manifest_key(note['source'])
            if note not in facts[side]['containers'] or note['type']!='normal' or key in owned[side]:raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_OWNER')
            owned[side].add(key)
        decisions=[decision for decision in _MANIFEST_DECISIONS if any(ref['part']==note['source']['part'] and ref['path'][:1]==note['source']['path'] for side,note in [('before',old),('after',new)] if note for ref in decision[side])]
        if pair['decisionIds']!=[decision['id'] for decision in decisions]:raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_COVERAGE')
        for decision in decisions:
            if decision.get('trackedRepresentation')!=('revision' if old and new else 'note-reference') or (not(old and new) and decision.get('noteId')!=identity):raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_COVERAGE')
            for side,note in [('before',old),('after',new)]:
                if any(note is None or ref['part']!=note['source']['part'] or ref['path'][:1]!=note['source']['path'] for ref in decision[side]):raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_COVERAGE')
        for side,note in [('before',old),('after',new)]:
            coverage=[ref for ref in actual[side].values() if note and ref['part']==note['source']['part'] and ref['path'][:1]==note['source']['path'] and ref['kind'] in ('p','tbl')]
            if pair['coverage'][side]!=coverage:raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_COVERAGE')
    for ref in plan['references']:
        decision=next((decision for decision in _MANIFEST_DECISIONS if decision['id']==ref['decisionId']),None);pair=next((pair for pair in pairs if pair['id']==ref['noteId']),None)
        if decision is None or pair is None:raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_REFERENCE')
        for side in ('before','after'):
            source=ref.get(side);note=pair.get(side)
            if source is None:continue
            key=_manifest_key(source)
            if key in used_refs[side] or not any(item['source']==source and item['id']==note['id'] and item['kind']==note['kind'] for item in facts[side]['references']) or not any(parent['part']==source['part'] and parent['path']==source['objectEvent']['paragraphPath'] for parent in decision[side]):raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_REFERENCE')
            used_refs[side].add(key)
        property_pairs=decision.get('objectEvents',{}).get('drawingProperties',[])
        matching=next((item for item in property_pairs if (ref.get('before') and item['before']==ref['before']) or (ref.get('after') and item['after']==ref['after'])),None)
        if (matching is not None)!=(bool(ref.get('before')) and bool(ref.get('after'))) or matching is not None and (matching['before']!=ref['before'] or matching['after']!=ref['after']):raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_REFERENCE')
        if set(ref)!={key for key in ('decisionId','noteId','before','after') if key in ('decisionId','noteId') or ref.get(key) is not None}:raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_REFERENCE')
    referenced_pairs={ref['noteId'] for ref in plan['references']}
    for pair in pairs:
        if pair['id'] not in referenced_pairs:
            old,new=pair.get('before'),pair.get('after')
            if not old or not new or old['id']!=new['id'] or old['source']!=new['source'] or any(item['kind']==note['kind'] and item['id']==note['id'] for side,note in [('before',old),('after',new)] for item in facts[side]['references']):raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_REFERENCE')
    for side in ('before','after'):
        if used_refs[side]!={_manifest_key(ref['source']) for ref in facts[side]['references']} or owned[side]!={_manifest_key(note['source']) for note in facts[side]['containers'] if note['type']=='normal'}:raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_COVERAGE')

def _validate_manifest(before_path, after_path):
    """Validate ownership against raw input, without choosing correspondences."""
    actual = {}
    story_facts={}
    note_facts={}
    nodes = {}
    for side, path in (("before", before_path), ("after", after_path)):
        with open(path, "rb") as source:
            model = json.loads(extract_document_model(source.read(), True, True, "en"))
        if _MANIFEST.get("fields", {}).get(side) != model.get("fields", []):
            raise ValueError("INVALID_COMPARISON_MANIFEST_FIELD_ANNOTATIONS")
        provenance = _MANIFEST.get("provenance", {}).get(side)
        if provenance is not None and provenance.get("comparisonSha256") != model["sourceRevision"]:
            raise ValueError("STALE_COMPARISON_MANIFEST_PROVENANCE")
        story_facts[side]=model["storyFacts"]
        note_facts[side]=model["noteFacts"]
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
    _validate_story_projection(story_facts,actual)
    _validate_note_projection(note_facts,actual)
    owners = {"before": {}, "after": {}}
    for decision in _MANIFEST_DECISIONS:
        decision_id = decision.get("id")
        if not isinstance(decision_id, str) or decision_id in ids:
            raise ValueError("INVALID_COMPARISON_MANIFEST_DUPLICATE_DECISION")
        ids.add(decision_id)
        representation = decision.get("trackedRepresentation")
        reason = decision.get("trackedReason")
        if representation not in {"revision", "preserve-after","note-reference"}:
            raise ValueError("INVALID_COMPARISON_MANIFEST_REPRESENTATION")
        if representation=="note-reference" and not any(pair["id"]==decision.get("noteId") and decision["id"] in pair["decisionIds"] and not(pair.get("before") and pair.get("after")) for pair in _MANIFEST["noteProjection"]["pairs"]):raise ValueError("INVALID_COMPARISON_MANIFEST_NOTE_COVERAGE")
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
        if shape==(2,1) and decision.get("trackedRepresentation")=="revision":
            refs=decision["before"];target=decision["after"][0]
            parent=nodes["before"][(refs[0]["part"],tuple(refs[0]["path"][:-1]))]
            after_parent=nodes["after"][(target["part"],tuple(target["path"][:-1]))]
            if parent.tag!=after_parent.tag or any(ref["part"]!=refs[0]["part"] or ref["path"][:-1]!=refs[0]["path"][:-1] for ref in refs):raise ValueError("UNSUPPORTED_TRACKED_SOURCE_MERGE_ENVELOPE")
            envelope=_source_envelope(nodes,"after",target)
            if any(_source_envelope(nodes,"before",ref)!=envelope for ref in refs):raise ValueError("UNSUPPORTED_TRACKED_SOURCE_MERGE_ENVELOPE")
            noise=set(json.loads(WORKLAZY_FORMATTING_POLICY_JSON)["noiseAttributes"])|{"{http://schemas.microsoft.com/office/word/2010/wordml}paraId","{http://schemas.microsoft.com/office/word/2010/wordml}textId"}
            attrs={name:value for name,value in nodes["after"][_manifest_key(target)].attrib.items() if name not in noise}
            for merge_side in ("before","after"):
                for ref in decision[merge_side]:
                    paragraph=nodes[merge_side][_manifest_key(ref)];properties=paragraph.find(W+"pPr")
                    if {name:value for name,value in paragraph.attrib.items() if name not in noise}!=attrs or any(child.tag not in {W+"pPr",W+"r",W+"commentRangeStart",W+"commentRangeEnd"} for child in paragraph):raise ValueError("UNSUPPORTED_TRACKED_SOURCE_MERGE_ENVELOPE")
                    if paragraph.find(W+"pPr/"+W+"sectPr") is not None or properties is not None and any(child.tag in TRACK_CHANGE_TAGS for child in properties.iter()):raise ValueError("UNSUPPORTED_TRACKED_SOURCE_MERGE_ENVELOPE")
                    for run in paragraph.findall(W+"r"):
                        if any(child.tag not in {W+"rPr",W+"t",W+"tab",W+"br",W+"cr",W+"footnoteReference",W+"endnoteReference",W+"drawing",W+"commentReference","{http://schemas.openxmlformats.org/markup-compatibility/2006}AlternateContent"} for child in run):raise ValueError("UNSUPPORTED_TRACKED_SOURCE_MERGE_ENVELOPE")
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
                if any(ref["part"] not in opposite_parts and not any(pair.get(side+"Part")==ref["part"] for pair in _MANIFEST["storyProjection"]["pairs"]) and not (decision.get('trackedRepresentation')=='note-reference' and any(pair['id']==decision.get('noteId') for pair in _MANIFEST['noteProjection']['pairs'])) for ref in decision[side]):
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
    _validate_table_grids(actual)

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
            special=next((note for note in note_facts[side]['containers'] if note['type']!='normal' and note['source']['part']==key[0] and tuple(note['source']['path'])==key[1][:1]),None)
            if special:
                imported=side=='before' and any(action['create'] and special in action['specials'] for action in _MANIFEST['noteProjection'].get('partActions',[]))
                if item['disposition']!=('note-special' if imported else 'preserve-after') or item.get('reason')!='note-separator':raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_COVERAGE')
                continue
            note=next((pair for pair in _MANIFEST['noteProjection']['pairs'] if pair.get(side) and pair[side]['source']['part']==key[0] and tuple(pair[side]['source']['path'])==key[1][:1]),None)
            if note and not(note.get('before') and note.get('after')):
                if item['disposition']!='note-reference' or item.get('noteId')!=note['id']:raise ValueError('INVALID_COMPARISON_MANIFEST_NOTE_COVERAGE')
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
                if len(owner["before"])==1 and len(owner["after"])==2:
                    old_ref=owner["before"][0];new_refs=owner["after"]
                    old_parent=nodes["before"][(old_ref["part"],tuple(old_ref["path"][:-1]))]
                    new_parent=nodes["after"][(new_refs[0]["part"],tuple(new_refs[0]["path"][:-1]))]
                    if any(value["part"]!=new_refs[0]["part"] or value["path"][:-1]!=new_refs[0]["path"][:-1] for value in new_refs) or old_parent.tag!=new_parent.tag:raise ValueError("UNSUPPORTED_TRACKED_SOURCE_SPLIT_ENVELOPE")
                    old_envelope=_source_envelope(nodes,"before",old_ref)
                    if any(_source_envelope(nodes,"after",value)!=old_envelope for value in new_refs):raise ValueError("UNSUPPORTED_TRACKED_SOURCE_SPLIT_ENVELOPE")
                    for split_side in ("before","after"):
                        for value in owner[split_side]:
                            paragraph=nodes[split_side][_manifest_key(value)]
                            properties=paragraph.find(W+"pPr")
                            if any(child.tag not in {W+"pPr",W+"r"} for child in paragraph) or paragraph.find(W+"pPr/"+W+"sectPr") is not None or (properties is not None and any(child.tag in TRACK_CHANGE_TAGS for child in properties.iter())):raise ValueError("UNSUPPORTED_TRACKED_SOURCE_SPLIT_ENVELOPE")
                            for run in paragraph.findall(W+"r"):
                                if any(child.tag not in {W+"rPr",W+"t",W+"tab",W+"br",W+"cr",W+"footnoteReference",W+"endnoteReference",W+"drawing","{http://schemas.openxmlformats.org/markup-compatibility/2006}AlternateContent"} for child in run):raise ValueError("UNSUPPORTED_TRACKED_SOURCE_SPLIT_ENVELOPE")

                if any(parent["type"]=="table" and (parent.get("moved") or len(parent["before"])!=1 or len(parent["after"])!=1) and any(ref["part"]==key[0] and key[1][:len(ref["path"])]==tuple(ref["path"]) for ref in parent[side]) for parent in _MANIFEST_DECISIONS):raise ValueError("UNSUPPORTED_TRACKED_SOURCE_TABLE_OBJECT_AXIS")
                declared = event_owner.get("objectEvents", {}).get(side)
                if declared is not None:declared=[source for source in declared if source["part"]==key[0] and source["objectEvent"]["paragraphPath"]==list(key[1])]
                expected = [source for source in actual[side].values() if source.get("objectEvent") and source["part"] == key[0] and source["objectEvent"]["paragraphPath"] == list(key[1])]
                # Per-paragraph coverage is checked here; exact whole-decision
                # membership and TS slice contexts are verified below.
                if len(owner["before"]) > 2 or len(owner["after"]) > 2 or (len(owner["after"])==2 and any(source["objectEvent"]["kind"] not in {"drawing","note"} for side in ("before","after") for source in owner.get("objectEvents",{}).get(side,[]))) or declared is None or len(declared) != len(expected) or {_manifest_key(source): source for source in declared} != {_manifest_key(source): source for source in expected}:
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
            expected_pairs.add((before, after, "tblPr"));expected_pairs.add((before, after, "tblGrid"))
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
        if events is None or events.get("policy") != "worklazy-source-events-5":raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_EVENTS")
        for side in ("before","after"):
            if events[side] != expected[side]:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_EVENTS")
        if len(decision["after"])==2 and any(ref["objectEvent"]["kind"] not in {"drawing","note"} for side in ("before","after") for ref in expected[side]):
            if events.get("propertiesSupported") is not True:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_PROPERTIES")
            raise ValueError("UNSUPPORTED_TRACKED_SOURCE_SPLIT_ENVELOPE")
        def run_fact(side,ref):return actual[side].get((ref["part"],tuple(ref["objectEvent"]["runPath"])),{}).get("normalizedProperties",{}).get("rPr",{"supported":{},"unsupported":{},"history":False})
        indexes=[1,2] if len(decision["before"])==1 and len(decision["after"])==2 else [1] if len(decision["before"])==2 and len(decision["after"])==1 else [0]
        contexts=[];offset=0
        for index in indexes:
            comparison=decision["comparisons"][index]
            slices={side:[(ref,[0,len(actual[side][_manifest_key(ref)].get("rawText",""))]) for ref in decision[side]] for side in ("before","after")}
            if indexes==[1,2]:slices={"before":[(decision["before"][0],decision["splitSlices"][index-1])],"after":[slices["after"][index-1]]}
            context={"comparisonIndex":index,"offset":offset}
            if slices["after"]:context["afterParagraph"]=slices["after"][0][0]
            for side in ("before","after"):
                context[side]=[];displacement=0
                for parent,(start,end) in slices[side]:
                    length=len(actual[side][_manifest_key(parent)].get("rawText",""))
                    for ref in expected[side]:
                        event=ref["objectEvent"];position=event["start"]
                        if ref["part"]==parent["part"] and event["paragraphPath"]==parent["path"] and start<=position and (position<end or position==end==length and (side=="after" or len(decision["before"])==2 or index==indexes[-1])):
                            context[side].append({"source":ref,"start":position-start+displacement,"end":event["end"]-start+displacement})
                    displacement+=end-start+(0 if len(decision["before"])==2 and len(decision["after"])==1 else 1)
            contexts.append(context);offset+=len(comparison["after"])+1
        if events.get("contexts")!=contexts:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_CONTEXTS")
        locations={side:{_manifest_key(item["source"]):(context,item) for context in contexts for item in context[side]} for side in ("before","after")}
        position_cache={}
        def context_of(side,ref):return locations[side][_manifest_key(ref)][0]
        def local_boundary(context,position):
            comparison=decision["comparisons"][context["comparisonIndex"]]
            if position==len(comparison["before"]):return len(comparison["after"])
            old=new=0
            for segment in comparison["segments"]:
                size=len(segment["text"])
                if segment["type"]=="equal" and old<=position<=old+size:return new+position-old
                if segment["type"]=="deleted" and old<=position<old+size:return new
                if segment["type"]!="added":old+=size
                if segment["type"]!="deleted":new+=size
            return new
        def position_of(side,ref,end=False):
            key=(side,_manifest_key(ref),end)
            if key not in position_cache:
                context,item=locations[side][_manifest_key(ref)];position=item["end" if end else "start"]
                position_cache[key]=context["offset"]+(local_boundary(context,position) if side=="before" else position)
            return position_cache[key]
        # Validate TS's correspondence, never recover/select a missing pair.
        drawings={side:[ref for ref in expected[side] if ref["objectEvent"]["kind"]=="drawing" or _MANIFEST["options"]["metadata"] and ref["objectEvent"]["kind"]=="note"] for side in ("before","after")}
        buckets={side:{} for side in ("before","after")}
        for side in ("before","after"):
            for ref in drawings[side]:
                position=position_of(side,ref)
                buckets[side].setdefault((position,ref["objectEvent"]["kind"],ref["objectEvent"]["signature"] if ref["objectEvent"]["kind"]=="note" else ""),[]).append(ref)
        projections=events.get("drawingProperties")
        if not isinstance(projections,list) or len(projections)!=sum(min(len(refs),len(buckets["after"].get(position,[]))) for position,refs in buckets["before"].items()):raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_PROPERTIES")
        seen={side:set() for side in ("before","after")}
        for pair in projections:
            for side in ("before","after"):
                ref=pair.get(side)
                if ref not in drawings[side] or _manifest_key(ref) in seen[side]:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_PROPERTIES")
                seen[side].add(_manifest_key(ref))
            ref,match=pair["before"],pair["after"]
            position=position_of("before",ref)
            bucket=(position,ref["objectEvent"]["kind"],ref["objectEvent"]["signature"] if ref["objectEvent"]["kind"]=="note" else "")
            if ref["objectEvent"]["kind"]!=match["objectEvent"]["kind"] or ref["objectEvent"]["kind"]=="note" and ref["objectEvent"]["signature"]!=match["objectEvent"]["signature"] or position!=position_of("after",match) or buckets["before"][bucket].index(ref)!=buckets["after"][bucket].index(match):raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_PROPERTIES")
            old,new=run_fact("before",ref),run_fact("after",match)
            names=[name for name in dict.fromkeys(list(old["supported"])+list(new["supported"])) if old["supported"].get(name,[])!=new["supported"].get(name,[])]
            excluded=[name for name in dict.fromkeys(list(old["unsupported"])+list(new["unsupported"])) if old["unsupported"].get(name,[])!=new["unsupported"].get(name,[])]
            verified={"representation":"preserve-after-history" if new["history"] else "revision","before":ref,"after":match,"beforeFact":old,"afterFact":new,"families":[name for name in names if _mask_enabled("rPr",name)],"excludedFamilies":excluded+[name for name in names if not _mask_enabled("rPr",name)]}
            if pair!=verified:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_PROPERTIES")
        unpaired=[ref for ref in drawings["before"] if not any(pair["before"]==ref for pair in projections)]
        restores=events.get("deletedDrawingStyles")
        if not isinstance(restores,list) or len(restores)!=len(unpaired):raise ValueError("INVALID_COMPARISON_MANIFEST_DRAWING_RESTORE")
        owned=set()
        for restore in restores:
            ref=restore.get("before")
            if ref not in unpaired or _manifest_key(ref) in owned:raise ValueError("INVALID_COMPARISON_MANIFEST_DRAWING_RESTORE")
            owned.add(_manifest_key(ref));old=run_fact("before",ref)
            verified={"before":ref,"beforeFact":old,"policy":"restore-before-unpaired"}
            if decision["after"]:
                context=context_of("before",ref);paragraph=context["afterParagraph"]
                cursor=local_boundary(context,next(item["start"] for item in context["before"] if item["source"]==ref))
                runs=[source for source in actual["after"].values() if source["kind"]=="r" and source["part"]==paragraph["part"] and source.get("paragraphPath")==paragraph["path"] and "textRange" in source]
                length=len(actual["after"][_manifest_key(paragraph)].get("rawText",""))
                def at(position):return next((source for source in runs if source["textRange"][0]<=position<source["textRange"][1]),None)
                source=at(cursor) or at(min(cursor,length)-1)
                new=source.get("normalizedProperties",{}).get("rPr",{"supported":{},"unsupported":{},"history":False}) if source is not None else {"supported":{},"unsupported":{},"history":False}
                families=[name for name in dict.fromkeys(list(old["supported"])+list(new["supported"])) if _mask_enabled("rPr",name)]
                verified.update({"policy":"copy-revised-run" if source is not None else "inherit-after-default","afterParagraph":paragraph,"afterFact":new,"cursor":cursor,"families":families})
                if source is not None:verified["source"]=source
            if restore!=verified:raise ValueError("INVALID_COMPARISON_MANIFEST_DRAWING_RESTORE")
        if events.get("propertiesSupported") is not True:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_PROPERTIES")
        unchanged_drawings=[{"before":pair["before"],"after":pair["after"]} for pair in projections if pair["before"]["objectEvent"]["signature"]==pair["after"]["objectEvent"]["signature"] and (not pair["families"] or pair["representation"]=="preserve-after-history")]
        if events.get("unchangedDrawings")!=unchanged_drawings:raise ValueError("INVALID_COMPARISON_MANIFEST_DRAWING_ACTIONS")
        unchanged=[{"before":a,"after":b} for a in expected["before"] if a["objectEvent"]["kind"]=="hyperlink" for b in expected["after"] if b["objectEvent"]["kind"]=="hyperlink" and a["objectEvent"]["signature"]==b["objectEvent"]["signature"] and position_of("before",a)==position_of("after",b) and position_of("before",a,True)==position_of("after",b,True)]
        if events.get("unchangedLinks")!=unchanged:raise ValueError("INVALID_COMPARISON_MANIFEST_LINK_ACTIONS")
        facts=lambda side:[(source["objectEvent"]["kind"],position_of(side,source),position_of(side,source,True),source["objectEvent"]["signature"]) for source in expected[side] if _MANIFEST["options"]["metadata"] or source["objectEvent"]["kind"]!="note"]
        if type(events.get("changed")) is not bool or events["changed"] != (facts("before") != facts("after")):raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_EVENTS")
    for decision in _MANIFEST_DECISIONS:
        value=decision.get("mergeProjection")
        if decision["type"]!="paragraph" or decision.get("trackedRepresentation")!="revision" or len(decision["before"])!=2 or len(decision["after"])!=1:
            if value is not None:raise ValueError("INVALID_COMPARISON_MANIFEST_MERGE_PROJECTION")
            continue
        if not isinstance(value,dict) or any(type(value.get(name)) is not int for name in ("beforeBoundary","afterBoundary")) or any(not isinstance(value.get(name),list) for name in ("properties","beforeEvents","afterEvents")) or any(not isinstance(item,dict) or type(item.get("history")) is not bool for item in value["properties"]) or any(not isinstance(item,dict) or type(item.get("side")) is not int or item["side"] not in (0,1) for name in ("beforeEvents","afterEvents") for item in value[name]):raise ValueError("INVALID_COMPARISON_MANIFEST_MERGE_PROJECTION")
        comparison=decision["comparisons"][1];boundary=len(actual["before"][_manifest_key(decision["before"][0])].get("rawText",""));old=new=0
        if boundary==len(comparison["before"]):target=len(comparison["after"])
        else:
            target=0
            for segment in comparison["segments"]:
                size=len(segment["text"])
                if segment["type"]=="equal" and old<=boundary<=old+size:target=new+boundary-old;break
                if segment["type"]=="deleted" and old<=boundary<old+size:target=new;break
                if segment["type"]!="added":old+=size
                if segment["type"]!="deleted":new+=size
                target=new
        properties=[]
        for ref in decision["before"]:
            after=decision["after"][0];empty={"supported":{},"unsupported":{},"history":False}
            a=actual["before"][_manifest_key(ref)].get("normalizedProperties",{}).get("pPr",empty);b=actual["after"][_manifest_key(after)].get("normalizedProperties",{}).get("pPr",empty)
            families=[name for name in dict.fromkeys(list(a["supported"])+list(b["supported"])) if a["supported"].get(name,[])!=b["supported"].get(name,[]) and _mask_enabled("pPr",name)]
            properties.append({"before":ref,"after":after,"beforeFact":a,"afterFact":b,"families":families,"history":b["history"]})
        events=decision.get("objectEvents",{});before_events=[{"source":ref,"side":int(ref["part"]!=decision["before"][0]["part"] or ref["objectEvent"]["paragraphPath"]!=decision["before"][0]["path"])} for ref in events.get("before",[])]
        after_events=[]
        for ref in events.get("after",[]):
            pair=next((pair for pair in events.get("drawingProperties",[]) if _manifest_key(pair["after"])==_manifest_key(ref)),None)
            role=next(item["side"] for item in before_events if _manifest_key(item["source"])==_manifest_key(pair["before"])) if pair else int(ref["objectEvent"]["start"]>=target)
            after_events.append({"source":ref,"side":role})
        if value!={"policy":"worklazy-merge-1","beforeBoundary":boundary,"afterBoundary":target,"properties":properties,"beforeEvents":before_events,"afterEvents":after_events}:raise ValueError("INVALID_COMPARISON_MANIFEST_MERGE_PROJECTION")
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


def _validate_table_grids(actual):
    empty=json.dumps([W+'gridCol',[],'',[]],separators=(',',':'))
    for decision in _MANIFEST_DECISIONS:
        supplied=decision.get('gridProjection')
        if decision['type']!='table' or decision.get('trackedRepresentation')!='revision' or not decision['before'] and not decision['after']:
            if supplied is not None:raise ValueError('INVALID_COMPARISON_MANIFEST_GRID')
            continue
        refs={side:actual[side].get(_manifest_key(decision[side][0])) if decision[side] else None for side in ('before','after')}
        def cols(side):return [child for child in ((refs[side] or {}).get('propertySnapshots',{}).get('tblGrid') or {}).get('children',[]) if child['name']==W+'gridCol']
        def fact(side):return (refs[side] or {}).get('normalizedProperties',{}).get('tblGrid',{'supported':{},'unsupported':{},'history':False})
        def values(side):return fact(side)['supported'].get(W+'gridCol',[])
        counts={side:max([len(cols(side)),0]+[pair[side+'Index']+1 for pair in decision['columns'] if pair[side+'Index'] is not None]) for side in ('before','after')}
        mode='after-unpaired' if not refs['before'] else 'before-unpaired' if not refs['after'] else 'paired';restore=[]
        for index in range(counts['before']):
            pair=next((pair for pair in decision['columns'] if pair['beforeIndex']==index),None)
            side='after' if mode=='paired' and not _MANIFEST['formattingMask']['effective']['paragraph'] and pair is not None and pair['afterIndex'] is not None else 'before'
            source_index=pair['afterIndex'] if side=='after' else index
            restore.append({'side':side,'index':source_index,'implicit':source_index>=len(cols(side))})
        target=[values(entry['side'])[entry['index']] if entry['index']<len(values(entry['side'])) else empty for entry in restore]
        current=[values('after')[index] if index<len(values('after')) else empty for index in range(counts['after'])]
        def footprint(side):
            root=refs[side];result=[]
            for source in actual[side].values():
                if root and source['part']==root['part'] and source['path'][:len(root['path'])]==root['path']:
                    result.extend((name,data) for name,data in source.get('normalizedProperties',{}).get('tcPr',{}).get('supported',{}).items() if name in {W+'gridSpan',W+'vMerge'})
                    result.extend((name,data) for name,data in source.get('normalizedProperties',{}).get('trPr',{}).get('unsupported',{}).items() if name in {W+'gridBefore',W+'gridAfter'})
            return result
        structural=footprint('before')!=footprint('after') or decision['moved'] or counts['before']!=counts['after'] or any(pair['beforeIndex'] is None or pair['afterIndex'] is None or pair['beforeIndex']!=pair['afterIndex'] for pair in decision['columns'])
        expected={'policy':'worklazy-table-grid-1','mode':mode,'beforeCount':counts['before'],'afterCount':counts['after'],'restore':restore,'changed':mode=='paired' and target!=current,'supported':True}
        history=fact('after')['history']
        if mode=='paired' and history and not structural:expected.update(mode='after-history',restore=[{'side':'after','index':index,'implicit':index>=len(cols('after'))} for index in range(counts['after'])],changed=False)
        if mode=='paired' and (expected['changed'] or structural):
            unsafe=history or not _MANIFEST['formattingMask']['effective']['paragraph'] and any(entry['side']=='before' and not any(pair['beforeIndex']==entry['index'] and pair['afterIndex'] is None for pair in decision['columns']) for entry in restore)
            for side in ('before','after'):
                root=refs[side]
                unsafe=unsafe or bool(fact(side)['unsupported'])
                for source in actual[side].values():
                    if root and source['part']==root['part'] and source['path'][:len(root['path'])]==root['path']:
                        for name,data in source.get('normalizedProperties',{}).get('trPr',{}).get('unsupported',{}).items():
                            if name in {W+'gridBefore',W+'gridAfter'} and any(not any(attribute==W+'val' and value=='0' for attribute,value in json.loads(item)[1]) for item in data):unsafe=True
                        for name,data in source.get('normalizedProperties',{}).get('tcPr',{}).get('supported',{}).items():
                            if name==W+'vMerge' or name==W+'gridSpan' and any(not any(attribute==W+'val' and value=='1' for attribute,value in json.loads(item)[1]) for item in data):unsafe=True
            if unsafe:expected.update(supported=False,reason='unsupported-grid-geometry-or-history')
        if supplied!=expected:raise ValueError('INVALID_COMPARISON_MANIFEST_GRID')
        if not expected['supported']:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_GRID_GEOMETRY')


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
        if action['property']=='tblGrid' and action['representation']!='preserve-after-history' and any(scope[side+'Fact']['unsupported'] for side in ('before','after')):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_GRID_DEPENDENCY')
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
            expect(before, after, "tblPr");expect(before, after, "tblGrid")
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
        for section in _MANIFEST['storyProjection']['sections']:
            if not section['final'] and section.get('before') and section.get('after'):expect(_manifest_key(section['before']['source']),_manifest_key(section['after']['source']),'sectPr')
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
    _MANIFEST_GRID_USED.clear();_MANIFEST_EVENT_OWNERS.clear();_MANIFEST_OBJECT_EXPECTED.clear();_MANIFEST_OBJECT_CONSUMED.clear();_MANIFEST_SYNTHETIC_TOKENS.clear();_MANIFEST_MERGE_SIDES.clear()
    for decision in _MANIFEST_DECISIONS:
        for side in ("before","after"):
            for ref in decision.get("objectEvents",{}).get(side,[]):
                event=ref["objectEvent"];key=(side,_manifest_key(ref))
                if key in _MANIFEST_OBJECT_EXPECTED:raise ValueError("INVALID_COMPARISON_MANIFEST_OBJECT_EMISSION")
                _MANIFEST_EVENT_OWNERS[key]=decision
                _MANIFEST_OBJECT_EXPECTED[key]=set(range(event["start"],event["end"])) if event["kind"]=="hyperlink" and event["end"]>event["start"] else {None}


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


def _revisionize_xml_part(before_data, after_data, include_formatting, writer, container_tag=None, include_tables=True, part="word/document.xml",source_before_part=None):
    previous_owner=_PACKAGE_GRAPH.output_owner if _PACKAGE_GRAPH is not None else None
    if _PACKAGE_GRAPH is not None:_PACKAGE_GRAPH.output_owner=part
    try:
        before_root = _parse_xml(before_data)
        after_root = _parse_xml(after_data)
        _register_manifest_root(before_root, source_before_part or part, "before")
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
    finally:
        if _PACKAGE_GRAPH is not None:_PACKAGE_GRAPH.output_owner=previous_owner

def _validate_imported_note(original,include_tables):
    if any(_is_note_event(node) or node.tag in {W+'numPr',W+'pict',W+'object',W+'sdt',W+'bookmarkStart',W+'bookmarkEnd'} or (node.tag==W+'tbl' and not include_tables) or (node.tag==W+'hyperlink' and node.get(W+'anchor')) for node in original.iter()):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_NOTE_DEPENDENCY')
    styles=ET.fromstring(_PACKAGE_GRAPH.after.read('word/styles.xml')) if 'word/styles.xml' in _PACKAGE_GRAPH.after.namelist() else ET.Element(W+'styles');style_ids={node.get(W+'styleId') for node in styles.findall(W+'style')}
    if any(node.get(W+'val') not in style_ids for node in original.iter() if node.tag in {W+'pStyle',W+'rStyle'}):raise ValueError('UNSUPPORTED_TRACKED_SOURCE_NOTE_STYLE')

def _revisionize_notes(before_data,after_data,include_formatting,writer,note_tag,include_tables=True):
    before_root=_parse_xml(before_data) if before_data else ET.Element(W+note_tag+'s');after_root=_parse_xml(after_data) if after_data else ET.Element(W+note_tag+'s');part='word/'+note_tag+'s.xml'
    _register_manifest_root(before_root,part,'before');_register_manifest_root(after_root,part,'after')
    action=next(item for item in _MANIFEST['noteProjection']['partActions'] if item['part']==part)
    if after_data is None and not action['specials']:
        for identity,kind in [('-1','separator'),('0','continuationSeparator')]:
            special=ET.SubElement(after_root,W+note_tag,{W+'id':identity,W+'type':kind});ET.SubElement(ET.SubElement(ET.SubElement(special,W+'p'),W+'r'),W+kind)
    if after_data is None and action['specials']:
        identities=set();types=set()
        for special in action['specials']:
            original=before_root[special['source']['path'][0]];identity=special['id'];kind=special['type']
            if not identity.lstrip('-').isdigit() or identity in identities or kind in types or kind not in {'separator','continuationSeparator','continuationNotice'}:raise ValueError('UNSUPPORTED_TRACKED_SOURCE_NOTE_SPECIAL')
            identities.add(identity);types.add(kind)
            _validate_imported_note(original,include_tables)
            after_root.append(_accepted_copy(original))
    for pair in _MANIFEST['noteProjection']['pairs']:
        old,new=pair.get('before'),pair.get('after')
        if (old or new)['source']['part']!=part:continue
        if old and new:
            before_note=before_root[old['source']['path'][0]];after_note=after_root[new['source']['path'][0]]
            _replace_blocks(after_note,_revision_blocks([child for child in before_note if child.tag in BLOCK_TAGS],[child for child in after_note if child.tag in BLOCK_TAGS],include_formatting,writer,include_tables))
        else:
            if old:
                original=before_root[old['source']['path'][0]]
                _validate_imported_note(original,include_tables)
                copied=_accepted_copy(original);copied.set(W+'id',_NOTE_IDS[pair['id']]);after_root.append(copied)
            for identity in pair['decisionIds']:
                decision=next(item for item in _MANIFEST_DECISIONS if item['id']==identity)
                for side in ('before','after'):_consume_manifest_refs(side,decision[side])
                _MANIFEST_USED.add(identity)
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
    global _MANIFEST, _PACKAGE_GRAPH, _NOTE_IDS
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
        _NOTE_IDS=_prepare_note_ids(after_archive) if include_metadata else {}
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
                    if any(pair.get("beforePart")==name for pair in _MANIFEST["storyProjection"]["pairs"])
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
            for pair in _MANIFEST['storyProjection']['pairs']:
                old,new=pair.get('beforePart'),pair.get('afterPart')
                if old and new:
                    replacements[new]=_revisionize_xml_part(before_part(old),after_archive.read(new),bool(include_formatting),writer,include_tables=bool(include_tables),part=new,source_before_part=old)
            for action in _MANIFEST['noteProjection']['partActions']:
                name,note_tag=action['part'],action['kind']
                data=_revisionize_notes(before_part(name) if action['before'] else None,after_archive.read(name) if action['after'] else None,bool(include_formatting),writer,note_tag,bool(include_tables))
                (replacements if action['after'] else additions)[name]=data
                if action['create']:
                    _PACKAGE_GRAPH.add_note_part(name,note_tag)

        for decision in _MANIFEST_DECISIONS:
            if decision.get("trackedRepresentation") == "preserve-after":
                continue
            for side in ("before", "after"):
                for ref in decision[side]:
                    if _MANIFEST_CONSUMED.get((side, _manifest_key(ref))) != 1:
                        raise ValueError("UNSUPPORTED_TRACKED_SOURCE")

        if _MANIFEST_GRID_USED!={(decision['id'],side) for decision in _MANIFEST_DECISIONS if decision['type']=='table' and decision.get('trackedRepresentation')=='revision' for side in ('before','after') if decision[side]}:raise ValueError('INVALID_COMPARISON_MANIFEST_GRID_CONSUMPTION')
        if _MANIFEST_OBJECT_CONSUMED != _MANIFEST_OBJECT_EXPECTED:raise ValueError("UNSUPPORTED_TRACKED_SOURCE_OBJECT_CONSUMPTION")
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
        _NOTE_IDS.clear()
        _MANIFEST_NODE_KEYS = {}
        _MANIFEST_DECISIONS = []
        _MANIFEST_USED = set()
        _MANIFEST_CONSUMED = {}
        _MANIFEST_ACTIVE_DECISION = None
        _MANIFEST_ACTIVE_COMPARISON = None
        _MANIFEST_PROPERTY_USED = set()
        _MANIFEST_SOURCE_NODES = {}
        _MANIFEST_ALLOWED_PROPERTIES = {}
        _MANIFEST_GRID_USED.clear();_MANIFEST_EVENT_OWNERS.clear();_MANIFEST_OBJECT_EXPECTED.clear();_MANIFEST_OBJECT_CONSUMED.clear();_MANIFEST_SYNTHETIC_TOKENS.clear();_MANIFEST_MERGE_SIDES.clear()
