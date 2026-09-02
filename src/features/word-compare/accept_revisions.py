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
    for _, namespace in ET.iterparse(io.BytesIO(data), events=("start-ns",)):
        prefix, uri = namespace
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


def _merge_deleted_paragraph_marks(parent):
    for child in list(parent):
        _merge_deleted_paragraph_marks(child)

    index = 0
    while index < len(parent):
        paragraph = parent[index]
        if paragraph.tag != W + "p" or not _has_paragraph_mark(paragraph, "del"):
            index += 1
            continue

        next_paragraph = parent[index + 1] if index + 1 < len(parent) else None
        if next_paragraph is None or next_paragraph.tag != W + "p":
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
    anchors = []
    for element in node.iter():
        if element.tag in COMMENT_MARKERS:
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

        _accept_tree(child)
        index += 1


def _accept_xml(data, is_settings=False):
    root = _parse_xml(data)
    _merge_deleted_paragraph_marks(root)
    _accept_tree(root)
    if is_settings:
        for parent in root.iter():
            for child in list(parent):
                if child.tag == W + "trackRevisions":
                    parent.remove(child)
    return _serialize_xml(root)


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
        for info in archive.infolist():
            if _is_accept_part(info.filename):
                replacements[info.filename] = _accept_xml(
                    archive.read(info.filename),
                    is_settings=info.filename == "word/settings.xml",
                )
    _copy_archive(input_path, output_path, replacements)
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
