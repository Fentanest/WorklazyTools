import posixpath
import copy
import difflib
import io
import os
import re
import zipfile
import xml.etree.ElementTree as ET


WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
WORD_2010_NS = "http://schemas.microsoft.com/office/word/2010/wordml"
WORD_2012_NS = "http://schemas.microsoft.com/office/word/2012/wordml"
W = "{" + WORD_NS + "}"
MC = "{http://schemas.openxmlformats.org/markup-compatibility/2006}"
W14 = "{" + WORD_2010_NS + "}"
W15 = "{" + WORD_2012_NS + "}"

ACCEPTED_XML_PARTS = {
    "word/document.xml",
    "word/footnotes.xml",
    "word/endnotes.xml",
    "word/comments.xml",
    "word/styles.xml",
    "word/settings.xml",
}
PROPERTY_CHANGE_TAGS = {
    W + "rPrChange",
    W + "pPrChange",
    W + "tblPrChange",
    W + "tblPrExChange",
    W + "tblGridChange",
    W + "trPrChange",
    W + "tcPrChange",
    W + "sectPrChange",
}
REMOVED_RANGE_MARKERS = {
    W + "moveFromRangeStart",
    W + "moveFromRangeEnd",
    W + "moveToRangeStart",
    W + "moveToRangeEnd",
    W + "customXmlInsRangeStart",
    W + "customXmlInsRangeEnd",
    W + "customXmlDelRangeStart",
    W + "customXmlDelRangeEnd",
}
REMOVED_RECORD_TAGS = PROPERTY_CHANGE_TAGS | REMOVED_RANGE_MARKERS | {
    W + "cellIns",
    W + "cellDel",
    W + "cellMerge",
    W + "numberingChange",
}
DELETED_WRAPPERS = {W + "del", W + "moveFrom"}
EMPTIED_WRAPPERS = {W + "hyperlink", W + "fldSimple", W + "smartTag", W + "customXml"}
WRAPPER_PROPERTIES = {W + "fldData", W + "smartTagPr", W + "customXmlPr"}
INSERTED_WRAPPERS = {W + "ins", W + "moveTo"}
COMMENT_MARKERS = {W + "commentRangeStart", W + "commentRangeEnd"}


def _local_name(name):
    return name.rsplit("}", 1)[-1]


def _attribute_by_local_name(element, name, default=None):
    for attribute_name, value in element.attrib.items():
        if _local_name(attribute_name) == name:
            return value
    return default


def _parse_xml(data):
    declared = {}
    for _, namespace in ET.iterparse(io.BytesIO(data), events=("start-ns",)):
        prefix, uri = namespace
        declared.setdefault(prefix, uri)
        try:
            ET.register_namespace(prefix or "", uri)
        except ValueError:
            pass
    root = ET.fromstring(data)
    # ElementTree drops namespace declarations that occur only in Ignorable.
    # Remove the corresponding hint so the serialized XML never names an
    # undeclared prefix; extension elements and attributes remain unchanged.
    for element in root.iter():
        for attribute_name in list(element.attrib):
            if attribute_name.endswith("}Ignorable"):
                element.attrib.pop(attribute_name, None)
        # A Choice's Requires names prefixes too and cannot be dropped: declare them on it.
        if element.tag == MC + "Choice":
            for prefix in element.get("Requires", "").split():
                if prefix in declared:
                    element.set("xmlns:" + prefix, declared[prefix])
    return root


def _serialize_xml(root):
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _has_paragraph_mark(paragraph, kind):
    paragraph_properties = paragraph.find(W + "pPr")
    run_properties = paragraph_properties.find(W + "rPr") if paragraph_properties is not None else None
    return run_properties is not None and run_properties.find(W + kind) is not None


def _remove_paragraph_mark(paragraph, kind):
    paragraph_properties = paragraph.find(W + "pPr")
    run_properties = paragraph_properties.find(W + "rPr") if paragraph_properties is not None else None
    if run_properties is None:
        return
    for marker in list(run_properties):
        if marker.tag == W + kind:
            run_properties.remove(marker)


def _fully_deleted_supported_paragraph(paragraph):
    # Terminal deleted-mark rule: every payload is explicitly inside deletion.
    # Anchors, surviving objects, section boundaries and history stay protected.
    protected = PROPERTY_CHANGE_TAGS | COMMENT_MARKERS | {W+"commentReference",W+"bookmarkStart",W+"bookmarkEnd",W+"permStart",W+"permEnd"}
    saw_payload = False
    def run_payload(run):
        nonlocal saw_payload
        if run.tag==W+"hyperlink":return bool(len(run)) and all(run_payload(child) for child in run)
        if run.tag!=W+"r":return False
        for item in run:
            if any(node.tag in protected for node in item.iter()):return False
            if item.tag==W+"rPr":continue
            if item.tag in {W+"delText",W+"delInstrText",W+"fldChar",W+"tab",W+"br",W+"cr",W+"sym",W+"softHyphen",W+"noBreakHyphen",W+"lastRenderedPageBreak",W+"footnoteReference",W+"endnoteReference",W+"drawing","{http://schemas.openxmlformats.org/markup-compatibility/2006}AlternateContent"}:saw_payload=True
            else:return False
        return True
    for child in paragraph:
        if child.tag==W+"pPr":
            # Paragraph property history is accepted with the paragraph; a section break is not.
            if any(node.tag==W+"sectPr" for node in child.iter()):return False
        elif child.tag==W+"hyperlink":
            if not len(child) or any(part.tag!=W+"del" or not len(part) or not all(run_payload(run) for run in part) for part in child):return False
        elif child.tag!=W+"del" or not len(child) or not all(run_payload(run) for run in child):return False
    return saw_payload


BETWEEN_BLOCK_MARKERS = {W + name for name in ("bookmarkStart", "bookmarkEnd", "commentRangeStart", "commentRangeEnd", "permStart", "permEnd", "proofErr", "moveFromRangeStart", "moveFromRangeEnd", "moveToRangeStart", "moveToRangeEnd")}


def _merge_deleted_paragraph_marks(parent):
    for child in list(parent):
        _merge_deleted_paragraph_marks(child)

    index = 0
    while index < len(parent):
        paragraph = parent[index]
        if paragraph.tag != W + "p" or not _has_paragraph_mark(paragraph, "del"):
            index += 1
            continue

        # Range markers between paragraphs (bookmarks, comment ranges) do not stop the join.
        following = index + 1
        while following < len(parent) and parent[following].tag in BETWEEN_BLOCK_MARKERS:
            following += 1
        next_paragraph = parent[following] if following < len(parent) else None
        if next_paragraph is None or next_paragraph.tag != W + "p":
            # OfficeDev RevisionProcessor terminal paragraph rule: no following
            # block (body sectPr is not a block), or the following block is a table.
            terminal = next_paragraph is None or next_paragraph.tag in {W + "tbl", W + "sectPr"}
            # Also at the end of a block content control that keeps another block.
            container = parent.tag == W + "body" or (parent.tag == W + "sdtContent" and any(child is not paragraph and child.tag in {W + "p", W + "tbl", W + "sdt"} for child in parent))
            if container and terminal and _fully_deleted_supported_paragraph(paragraph):
                parent.remove(paragraph)
                continue
            # An empty paragraph whose mark was inserted and then deleted (the separator kept
            # between a replaced table's two versions) never existed in either version.
            if _has_paragraph_mark(paragraph, "ins") and all(child.tag == W + "pPr" for child in paragraph):
                parent.remove(paragraph)
                continue
            # The deleted last mark of a block content control: its remaining content (a field's
            # end character, say) joins the previous paragraph, as Word does.
            previous = index - 1
            while previous >= 0 and parent[previous].tag in BETWEEN_BLOCK_MARKERS:
                previous -= 1
            if parent.tag == W + "sdtContent" and next_paragraph is None and previous >= 0 and parent[previous].tag == W + "p":
                target = parent[previous]
                for child in list(paragraph):
                    if child.tag != W + "pPr":
                        paragraph.remove(child)
                        target.append(child)
                parent.remove(paragraph)
                continue
            _remove_paragraph_mark(paragraph, "del")
            index += 1
            continue

        insertion_index = 1 if next_paragraph.find(W + "pPr") is not None else 0
        for child in list(paragraph):
            if child.tag == W + "pPr":
                continue
            paragraph.remove(child)
            next_paragraph.insert(insertion_index, child)
            insertion_index += 1
        parent.remove(paragraph)


def _row_is_deleted(row):
    properties = row.find(W + "trPr")
    return properties is not None and properties.find(W + "del") is not None


def _cell_is_deleted(cell):
    properties = cell.find(W + "tcPr")
    return properties is not None and properties.find(W + "cellDel") is not None


def _preserved_comment_anchors(node):
    # Like Word, a bookmark wholly inside the deleted content goes with it; one whose other end
    # lies outside keeps this endpoint at the deletion point.
    starts = {element.get(W + "id") for element in node.iter() if element.tag == W + "bookmarkStart"}
    ends = {element.get(W + "id") for element in node.iter() if element.tag == W + "bookmarkEnd"}
    enclosed = starts & ends
    anchors = []
    for element in node.iter():
        if element.tag in COMMENT_MARKERS:
            anchors.append(copy.deepcopy(element))
        elif element.tag in (W + "bookmarkStart", W + "bookmarkEnd") and element.get(W + "id") not in enclosed:
            anchors.append(copy.deepcopy(element))
        elif element.tag == W + "r":
            references = [copy.deepcopy(child) for child in element if child.tag == W + "commentReference"]
            if references:
                run = ET.Element(W + "r", dict(element.attrib))
                properties = element.find(W + "rPr")
                if properties is not None:
                    run.append(copy.deepcopy(properties))
                run.extend(references)
                anchors.append(run)
    return anchors


def _accept_tree(parent):
    index = 0
    while index < len(parent):
        child = parent[index]

        # A formerly populated table whose every row is explicitly deleted has
        # no surviving container only for the fully accounted direct-row shape.
        # Row wrappers (e.g. SDT/customXml) may hold live rows or other content;
        # leave their container intact. Never prune a source zero-row table.
        if child.tag==W+'tbl':
            rows=child.findall(W+'tr')
            if (rows and all(node.tag in {W+'tblPr', W+'tblGrid', W+'tr'} for node in child)
                    and all(_row_is_deleted(row) for row in rows)):
                parent.remove(child)
                continue

        if child.tag == W + "tr" and _row_is_deleted(child):
            parent.remove(child)
            continue
        if child.tag == W + "tc" and _cell_is_deleted(child):
            parent.remove(child)
            continue
        if child.tag in DELETED_WRAPPERS:
            anchors = _preserved_comment_anchors(child)
            parent.remove(child)
            for offset, anchor in enumerate(anchors):
                parent.insert(index + offset, anchor)
            index += len(anchors)
            continue
        if child.tag in INSERTED_WRAPPERS:
            _accept_tree(child)
            nested_children = list(child)
            parent.remove(child)
            for offset, nested in enumerate(nested_children):
                parent.insert(index + offset, nested)
            continue
        if child.tag in REMOVED_RECORD_TAGS:
            parent.remove(child)
            continue

        held_deletion = child.tag in EMPTIED_WRAPPERS and any(node.tag in DELETED_WRAPPERS for node in child)
        _accept_tree(child)
        # A hyperlink or simple field cannot sit inside w:del, so a deleted one is written as a
        # wrapper around deleted runs. Like Word, drop the wrapper once accepting empties it.
        if held_deletion and all(node.tag in WRAPPER_PROPERTIES for node in child):
            parent.remove(child)
            continue
        index += 1


def _remove_deleted_field_results(root):
    """Like Word, accepting the deletion of a field's begin, separator and end characters also
    removes its displayed result, even where the result runs themselves are not marked deleted."""
    fields, orphans, parents = [], [], {}
    def visit(node, deleted):
        for child in node:
            parents[child] = node
            inside = deleted or child.tag in DELETED_WRAPPERS
            if child.tag == W + "r":
                kinds = [item.get(W + "fldCharType") for item in child if item.tag == W + "fldChar"]
                if not kinds and fields and fields[-1]["separated"] and not inside:
                    fields[-1]["result"].append(child)
                for kind in kinds:
                    if kind == "begin":
                        fields.append({"deleted": inside, "separated": False, "result": []})
                    elif kind == "separate" and fields:
                        fields[-1]["separated"] = True
                        fields[-1]["deleted"] = fields[-1]["deleted"] and inside
                    elif kind == "end" and fields:
                        field = fields.pop()
                        if field["deleted"] and inside and field["separated"]:
                            orphans.extend(field["result"])
                continue
            visit(child, inside)
    visit(root, False)
    for run in orphans:
        parent = parents.get(run)
        if parent is not None and run in list(parent):
            parent.remove(run)


def _accept_xml(data, is_settings=False):
    root = _parse_xml(data)
    _remove_deleted_field_results(root)
    _merge_deleted_paragraph_marks(root)
    _accept_tree(root)
    if is_settings:
        for parent in root.iter():
            for child in list(parent):
                if child.tag == W + "trackRevisions":
                    parent.remove(child)
    return _serialize_xml(root)


# Element names `_accept_xml` acts on, with any prefix (Unicode names included). A part without one
# of them only round-trips through parse and serialization, so it is kept byte for byte.
_REVISION_MARKUP = re.compile(
    r"<(?:[^\s<>/:!?\"'=]+:)?(?:ins|del|moveFrom|moveTo|cellIns|cellDel|cellMerge|numberingChange|trackRevisions"
    r"|rPrChange|pPrChange|tblPrChange|tblPrExChange|tblGridChange|trPrChange|tcPrChange|sectPrChange"
    r"|moveFromRangeStart|moveFromRangeEnd|moveToRangeStart|moveToRangeEnd"
    r"|customXmlInsRangeStart|customXmlInsRangeEnd|customXmlDelRangeStart|customXmlDelRangeEnd)[\s/>]"
)
_XML_DECLARED_ENCODING = re.compile(rb"^\s*<\?xml[^>]*\bencoding\s*=\s*[\"']([A-Za-z0-9._-]+)[\"']")
# A document type declaration can define entities that expand into revision elements when parsed.
_DOCUMENT_TYPE = re.compile(rb"<!(?:DOCTYPE|ENTITY)", re.IGNORECASE)


def _without_revision_markup(data):
    """True only when the part is certainly UTF-8 (no BOM other than UTF-8's, a UTF-8 or absent
    encoding declaration, valid UTF-8 without NUL, no DOCTYPE or entity declaration) and has no revision
    element. Anything else (UTF-16, other encodings, undecodable bytes, entities that could expand into
    elements) goes through the full accept path."""
    if data.startswith((b"\xff\xfe", b"\xfe\xff")) or b"\x00" in data:
        return False
    body = data[3:] if data.startswith(b"\xef\xbb\xbf") else data
    if _DOCUMENT_TYPE.search(body):
        return False
    declared = _XML_DECLARED_ENCODING.match(body)
    if declared and declared.group(1).decode("ascii").lower().replace("_", "-") not in ("utf-8", "utf8"):
        return False
    try:
        text = body.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return not _REVISION_MARKUP.search(text)


def _is_accept_part(name):
    return name in ACCEPTED_XML_PARTS or bool(re.fullmatch(r"word/(?:header|footer)\d+\.xml", name))


def _copy_archive(source_path, output_path, replacements):
    with zipfile.ZipFile(source_path, "r") as source, zipfile.ZipFile(output_path, "w") as target:
        names = set()
        for info in source.infolist():
            names.add(info.filename)
            target.writestr(info, replacements.get(info.filename, source.read(info.filename)))
        for name, data in replacements.items():
            if name not in names:
                target.writestr(name, data, compress_type=zipfile.ZIP_DEFLATED)


def accept_tracked_document(input_path, output_path):
    """Accept every supported OOXML revision while preserving comment objects."""
    replacements = {}
    with zipfile.ZipFile(input_path, "r") as archive:
        stories=set()
        if "word/_rels/document.xml.rels" in archive.namelist():
            for rel in ET.fromstring(archive.read("word/_rels/document.xml.rels")):
                if rel.get("Type") in {"http://schemas.openxmlformats.org/officeDocument/2006/relationships/"+kind for kind in ("header","footer","footnotes","endnotes")} and rel.get("TargetMode")!="External":
                    target=rel.get("Target","");stories.add(target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join("word",target)))
        for info in archive.infolist():
            if _is_accept_part(info.filename) or info.filename in stories:
                data = archive.read(info.filename)
                if _without_revision_markup(data):
                    continue
                replacements[info.filename] = _accept_xml(
                    data,
                    is_settings=info.filename == "word/settings.xml",
                )
    if replacements:
        _copy_archive(input_path, output_path, replacements)
    else:
        import shutil
        shutil.copyfile(input_path, output_path)
    return sum(1 for name in replacements if name != "word/settings.xml")


def _element_text(node):
    parts = []
    for item in node.iter():
        if item.tag == W + "t":
            parts.append(item.text or "")
        elif item.tag == W + "tab":
            parts.append("\t")
        elif item.tag in (W + "br", W + "cr"):
            parts.append("\n")
    return "".join(parts)


def _comment_identity_maps(archive):
    durable_by_para = {}
    if "word/commentsIds.xml" in archive.namelist():
        root = _parse_xml(archive.read("word/commentsIds.xml"))
        for item in root.iter():
            para_id = _attribute_by_local_name(item, "paraId")
            durable_id = _attribute_by_local_name(item, "durableId")
            if para_id and durable_id:
                durable_by_para[para_id] = durable_id

    parent_by_para = {}
    if "word/commentsExtended.xml" in archive.namelist():
        root = _parse_xml(archive.read("word/commentsExtended.xml"))
        for item in root.iter():
            para_id = _attribute_by_local_name(item, "paraId")
            parent_id = _attribute_by_local_name(item, "paraIdParent")
            if para_id and parent_id:
                parent_by_para[para_id] = parent_id
    return durable_by_para, parent_by_para


def _comment_anchors(archive):
    anchors = {}
    paths = sorted(
        name for name in archive.namelist()
        if name == "word/document.xml"
        or name in ("word/footnotes.xml", "word/endnotes.xml")
        or re.fullmatch(r"word/(?:header|footer)\d+\.xml", name)
    )
    for part_name in paths:
        root = _parse_xml(archive.read(part_name))
        paragraphs = list(root.iter(W + "p"))
        texts = [_element_text(paragraph) for paragraph in paragraphs]
        for index, paragraph in enumerate(paragraphs):
            comment_ids = []
            for element in paragraph.iter():
                if element.tag in COMMENT_MARKERS or element.tag == W + "commentReference":
                    comment_id = element.attrib.get(W + "id")
                    if comment_id is not None and comment_id not in comment_ids:
                        comment_ids.append(comment_id)
            signature = (
                part_name,
                index,
                texts[index],
                texts[index - 1] if index else "",
                texts[index + 1] if index + 1 < len(texts) else "",
            )
            for comment_id in comment_ids:
                anchors.setdefault(comment_id, []).append(signature)
    return anchors


def _comment_records(archive):
    if "word/comments.xml" not in archive.namelist():
        return None, []
    comments_root = _parse_xml(archive.read("word/comments.xml"))
    durable_by_para, parent_by_para = _comment_identity_maps(archive)
    anchors = _comment_anchors(archive)
    records = []
    for order, comment in enumerate(comments_root.findall(W + "comment")):
        comment_id = comment.attrib.get(W + "id", str(order))
        first_paragraph = comment.find(".//" + W + "p")
        para_id = _attribute_by_local_name(first_paragraph, "paraId") if first_paragraph is not None else None
        records.append({
            "order": order,
            "id": comment_id,
            "element": comment,
            "author": comment.attrib.get(W + "author", ""),
            "text": _element_text(comment),
            "para": para_id,
            "durable": durable_by_para.get(para_id),
            "parent_raw": parent_by_para.get(para_id),
            "anchors": anchors.get(comment_id, []),
        })

    by_para = {record["para"]: record for record in records if record["para"]}
    by_durable = {record["durable"]: record for record in records if record["durable"]}
    for record in records:
        parent_raw = record.pop("parent_raw")
        parent = by_para.get(parent_raw) or by_durable.get(parent_raw)
        if parent is not None:
            record["parent"] = "durable:" + parent["durable"] if parent["durable"] else "para:" + parent["para"]
        elif parent_raw:
            record["parent"] = "identity:" + parent_raw
        else:
            record["parent"] = ""
    return comments_root, records


def _ratio(left, right):
    return difflib.SequenceMatcher(None, left or "", right or "", autojunk=False).ratio()


def _anchor_similarity(before, after):
    if not before["anchors"] or not after["anchors"]:
        return 0.0
    best = 0.0
    for old in before["anchors"]:
        for new in after["anchors"]:
            score = 0.0
            if old[0] == new[0]:
                score += 0.25
            score += _ratio(old[2], new[2]) * 0.45
            score += _ratio(old[3], new[3]) * 0.15
            score += _ratio(old[4], new[4]) * 0.15
            if old[0] == new[0]:
                score += 0.1 / (1 + abs(old[1] - new[1]))
            best = max(best, score)
    return min(best, 1.0)


def _fallback_score(before, after):
    text_score = _ratio(before["text"], after["text"])
    anchor_score = _anchor_similarity(before, after)
    parent_matches = bool(before["parent"] and before["parent"] == after["parent"])
    parent_score = 1.0 if parent_matches else (0.25 if not before["parent"] and not after["parent"] else 0.0)
    usable = text_score >= 0.35 or anchor_score >= 0.65 or parent_matches
    core = text_score * 0.7 + parent_score * 0.12 + anchor_score * 0.18
    return usable and core >= 0.42, core, before["author"] == after["author"]


def _match_existing_comments(before_records, after_records):
    unmatched_before = set(range(len(before_records)))
    matched_after = set()

    durable_lookup = {}
    for index, record in enumerate(before_records):
        if record["durable"]:
            durable_lookup.setdefault(record["durable"], []).append(index)
    for after_index, record in enumerate(after_records):
        if not record["durable"]:
            continue
        candidate = next((index for index in durable_lookup.get(record["durable"], []) if index in unmatched_before), None)
        if candidate is not None:
            unmatched_before.remove(candidate)
            matched_after.add(after_index)

    para_lookup = {}
    for index in unmatched_before:
        record = before_records[index]
        if record["para"]:
            para_lookup.setdefault(record["para"], []).append(index)
    for after_index, record in enumerate(after_records):
        if after_index in matched_after or record["durable"] or not record["para"]:
            continue
        candidate = next((index for index in para_lookup.get(record["para"], []) if index in unmatched_before), None)
        if candidate is not None:
            unmatched_before.remove(candidate)
            matched_after.add(after_index)

    # Identity-free legacy comments are matched one-to-one. Body text after
    # revision acceptance, reply parent identity and anchor context determine
    # the score; author equality is only a tie-breaker.
    for after_index, after in enumerate(after_records):
        if after_index in matched_after or after["durable"] or after["para"]:
            continue
        scored = []
        for before_index in unmatched_before:
            usable, core, same_author = _fallback_score(before_records[before_index], after)
            if usable:
                scored.append((core, same_author, -before_records[before_index]["order"], before_index))
        if not scored:
            continue
        before_index = max(scored)[-1]
        unmatched_before.remove(before_index)
        matched_after.add(after_index)
    return matched_after


def _author_initials(author):
    words = [word for word in re.split(r"\s+", author.strip()) if word]
    return "".join(word[0].upper() for word in words)[:4] or author[:1]


def _updated_people_xml(data, author):
    if data is None:
        root = ET.Element(W15 + "people")
    else:
        root = _parse_xml(data)
    for person in root:
        if _attribute_by_local_name(person, "author") == author:
            return data
    person = ET.SubElement(root, W15 + "person")
    person.set(W15 + "author", author)
    return _serialize_xml(root)


def rewrite_new_comment_authors(accepted_before, accepted_after, author):
    """Rewrite only comments newly present in the accepted after document."""
    author = (author or "Worklazy Tools").strip() or "Worklazy Tools"
    with zipfile.ZipFile(accepted_before, "r") as before_archive:
        _, before_records = _comment_records(before_archive)
    with zipfile.ZipFile(accepted_after, "r") as after_archive:
        comments_root, after_records = _comment_records(after_archive)
        if comments_root is None:
            return 0
        existing_after = _match_existing_comments(before_records, after_records)
        new_records = [record for index, record in enumerate(after_records) if index not in existing_after]
        if not new_records:
            return 0
        for record in new_records:
            record["element"].set(W + "author", author)
            record["element"].set(W + "initials", _author_initials(author))
        comments_xml = _serialize_xml(comments_root)
        people_xml = _updated_people_xml(
            after_archive.read("word/people.xml") if "word/people.xml" in after_archive.namelist() else None,
            author,
        )

    temporary_path = accepted_after + ".comments.tmp"
    try:
        replacements = {"word/comments.xml": comments_xml}
        if people_xml is not None:
            replacements["word/people.xml"] = people_xml
        _copy_archive(accepted_after, temporary_path, replacements)
        os.replace(temporary_path, accepted_after)
    finally:
        if os.path.exists(temporary_path):
            os.unlink(temporary_path)
    return len(new_records)
