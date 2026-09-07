import hashlib
import inspect
import io
import json
import re
import time
import zipfile


# This file is executed inside Pyodide after the production Word scripts. It
# instruments, but does not replace, the production paragraph emitter.
def _segments_from_xml(paragraph):
    segments = []

    def append(kind, text):
        if not text:
            return
        if segments and segments[-1]["type"] == kind:
            segments[-1]["text"] += text
        else:
            segments.append({"type": kind, "text": text})

    def walk(element, kind="equal"):
        if element.tag in PROPERTY_CHANGE_TAGS or element.tag == W + "pPr":
            return
        if element.tag in INSERTED_CONTENT_TAGS:
            kind = "added"
        elif element.tag in DELETED_CONTENT_TAGS:
            kind = "deleted"
        if element.tag in (W + "t", W + "delText"):
            append(kind, element.text or "")
        elif element.tag == W + "tab":
            append(kind, "\t")
        elif element.tag in (W + "br", W + "cr"):
            append(kind, "\n")
        else:
            for child in element:
                walk(child, kind)

    walk(paragraph)
    return _with_offsets(segments)


def _with_offsets(segments):
    before_cursor = 0
    after_cursor = 0
    result = []
    for segment in segments:
        text = segment["text"]
        if not text:
            continue
        result.append({
            **segment,
            "beforeOffset": before_cursor,
            "afterOffset": after_cursor,
        })
        if segment["type"] != "added":
            before_cursor += len(text)
        if segment["type"] != "deleted":
            after_cursor += len(text)
    return result


def _expected_segments(before, after):
    return _with_offsets(json.loads(worklazyDiffJson(before, after)))


def _paragraph(text):
    paragraph = ET.Element(W + "p")
    paragraph.append(_token_run(text, None))
    return paragraph


def _revision_author(element):
    return element.attrib.get(W + "author")


def _has_target_marker(container, properties_tag, marker_tags, target_author):
    properties = container.find(W + properties_tag)
    return properties is not None and any(
        target_author is not None
        and marker.tag in marker_tags
        and _revision_author(marker) == target_author
        for marker in properties.iter()
    )


def _text_after_rejecting_author(node, target_author):
    if node.tag == W + "tr" and _has_target_marker(node, "trPr", {W + "ins"}, target_author):
        return ""
    if node.tag == W + "tc" and _has_target_marker(node, "tcPr", {W + "cellIns"}, target_author):
        return ""
    if target_author is not None and node.tag in INSERTED_CONTENT_TAGS and _revision_author(node) == target_author:
        return ""
    if node.tag in (W + "t", W + "delText"):
        return node.text or ""
    if node.tag == W + "tab":
        return "\t"
    if node.tag in (W + "br", W + "cr"):
        return "\n"
    return "".join(_text_after_rejecting_author(child, target_author) for child in node)


def _xml_text(data):
    return _text_after_rejecting_author(_parse_xml(data), None)


def _story_part_names(archive):
    return sorted(
        name for name in archive.namelist()
        if name == "word/document.xml"
        or name in ("word/footnotes.xml", "word/endnotes.xml")
        or re.fullmatch(r"word/(?:header|footer)\d+\.xml", name)
    )


def _target_structural_revision_count(root, target_author):
    count = 0
    for row in root.iter(W + "tr"):
        properties = row.find(W + "trPr")
        if properties is not None:
            count += sum(
                marker.tag in (W + "ins", W + "del") and _revision_author(marker) == target_author
                for marker in properties.iter()
            )
    for cell in root.iter(W + "tc"):
        properties = cell.find(W + "tcPr")
        if properties is not None:
            count += sum(
                marker.tag in (W + "cellIns", W + "cellDel", W + "cellMerge")
                and _revision_author(marker) == target_author
                for marker in properties.iter()
            )
    return count


def _package_reject_rows(tracked_bytes, before_path, exceptions, target_author):
    exception_by_part = {item["storyPart"]: item for item in exceptions}
    rows = []
    with zipfile.ZipFile(io.BytesIO(tracked_bytes)) as tracked, zipfile.ZipFile(before_path) as before:
        tracked_parts = set(_story_part_names(tracked))
        before_parts = set(_story_part_names(before))
        for part in sorted(tracked_parts | before_parts):
            actual_root = _parse_xml(tracked.read(part)) if part in tracked_parts else None
            actual = _text_after_rejecting_author(actual_root, target_author) if actual_root is not None else ""
            expected = _xml_text(before.read(part)) if part in before_parts else ""
            exception = exception_by_part.get(part)
            if exception:
                for replacement in exception["replacements"]:
                    old = replacement["before"]
                    assert expected.count(old) == replacement.get("count", 1)
                    expected = expected.replace(old, replacement["after"], replacement.get("count", 1))
            rows.append({
                "storyPart": part,
                "actual": actual,
                "expected": expected,
                "match": actual == expected,
                "exceptionReasonId": exception["reasonId"] if exception else None,
                "targetStructuralRevisions": _target_structural_revision_count(actual_root, target_author)
                if actual_root is not None else 0,
            })
    return rows


def _cell_paragraph_inputs(package_path):
    with zipfile.ZipFile(package_path) as archive:
        if "word/document.xml" not in archive.namelist():
            return []
        root = _parse_xml(archive.read("word/document.xml"))
    return [
        ["".join(token["text"] for token in _styled_tokens(paragraph)) for paragraph in cell.findall(W + "p")]
        for cell in root.iter(W + "tc")
    ]


def _corrupt_first_generated_deletion(package_bytes, target_author):
    corrupted = 0
    result = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(package_bytes)) as source, zipfile.ZipFile(result, "w") as target:
        for info in source.infolist():
            data = source.read(info.filename)
            if not corrupted and info.filename == "word/document.xml":
                root = _parse_xml(data)
                for deletion in root.iter(W + "del"):
                    if _revision_author(deletion) != target_author:
                        continue
                    deleted_text = next(deletion.iter(W + "delText"), None)
                    if deleted_text is not None:
                        deleted_text.text = "CORRUPTED_DELETED_TEXT"
                        corrupted = 1
                        data = _serialize_xml(root)
                        break
            target.writestr(info, data)
    assert corrupted == 1
    return result.getvalue(), corrupted


_real_parse_xml = _parse_xml
_node_paths = {}
_part_by_hash = {}
_pair_id = "edge"


def _parse_xml(data):
    root = _real_parse_xml(data)
    part = _part_by_hash.get(hashlib.sha256(data).hexdigest(), "root:" + _local_name(root.tag))

    def visit(node, path):
        _node_paths[node] = (part, path)
        counters = {}
        for child in node:
            tag = _local_name(child.tag)
            index = counters.get(tag, 0)
            counters[tag] = index + 1
            visit(child, f"{path}/{tag}[{index}]")

    visit(root, _local_name(root.tag))
    return root


_real_plain_paragraph_from_tokens = _plain_paragraph_from_tokens
_synthetic_sources = {}


def _plain_paragraph_from_tokens(source, tokens):
    result = _real_plain_paragraph_from_tokens(source, tokens)
    origin = _node_paths.get(source)
    if origin:
        full_text = "".join(token["text"] for token in _styled_tokens(source))
        slice_text = "".join(token["text"] for token in tokens)
        start = full_text.find(slice_text)
        if start >= 0:
            _synthetic_sources[result] = {
                "part": origin[0],
                "path": origin[1],
                "sourceSlice": [start, start + len(slice_text)],
            }
    return result


def _sidecar_key(before, after):
    frame = inspect.currentframe().f_back
    while frame and frame.f_code.co_name != "_revision_blocks":
        frame = frame.f_back
    locals_at_call = frame.f_locals if frame else {}
    before_path = _node_paths.get(before)
    after_path = _node_paths.get(after)
    synthetic = _synthetic_sources.get(before)
    key = {
        "pairId": _pair_id,
        "storyPart": (after_path or before_path or ((synthetic["part"],) if synthetic else None) or ("synthetic",))[0],
        "beforeIndexes": list(locals_at_call.get("before_indexes", [])),
        "afterIndexes": list(locals_at_call.get("after_indexes", [])),
        "beforePath": before_path[1] if before_path else synthetic["path"] if synthetic else None,
        "afterPath": after_path[1] if after_path else None,
    }
    if synthetic:
        key["sourceSlice"] = synthetic["sourceSlice"]
    return key


_real_paragraph_revision = _paragraph_revision
_observations = []


def _paragraph_revision(before, after, include_formatting, writer):
    result = _real_paragraph_revision(before, after, include_formatting, writer)
    before_text = "".join(token["text"] for token in _styled_tokens(before))
    after_text = "".join(token["text"] for token in _styled_tokens(after))
    actual = _segments_from_xml(result)
    expected = _expected_segments(before_text, after_text)
    _observations.append({
        "key": _sidecar_key(before, after),
        "before": before_text,
        "after": after_text,
        "expected": expected,
        "actual": actual,
        "match": expected == actual,
        "preservedAfterRevision": _has_visible_text_revision(after),
    })
    return result


def _run_pair(pair_spec, before_path, after_path):
    global _observations, _part_by_hash, _pair_id, _node_paths, _synthetic_sources
    pair_id = pair_spec["pairId"]
    _pair_id = pair_id
    _node_paths = {}
    _synthetic_sources = {}
    _part_by_hash = {}
    for path in (before_path, after_path):
        with zipfile.ZipFile(path) as archive:
            for name in archive.namelist():
                if name.endswith(".xml"):
                    _part_by_hash[hashlib.sha256(archive.read(name)).hexdigest()] = name

    _observations = []
    output = io.BytesIO()
    started = time.perf_counter()
    target_author = globals().get("PACKAGE_REJECT_AUTHOR", "Worklazy Oracle")
    revision_count = generate_tracked_document(
        before_path,
        after_path,
        output,
        target_author,
        True,
        True,
        True,
    )
    package_bytes = output.getvalue()
    corrupted_deleted_texts = 0
    if globals().get("ORACLE_MUTATION") == "deleted-text" and pair_id == "base":
        package_bytes, corrupted_deleted_texts = _corrupt_first_generated_deletion(
            package_bytes,
            target_author,
        )
    elapsed_ms = (time.perf_counter() - started) * 1000
    tracked_path = f"/fixtures/{pair_id}-tracked.docx"
    accepted_path = f"/fixtures/{pair_id}-accepted.docx"
    accepted_after_path = f"/fixtures/{pair_id}-after-accepted.docx"
    with open(tracked_path, "wb") as target:
        target.write(package_bytes)
    accept_tracked_document(tracked_path, accepted_path)
    accept_tracked_document(after_path, accepted_after_path)
    accepted_model = json.loads(extract_document_model(open(accepted_path, "rb").read(), True, True, "ko"))
    accepted_after_model = json.loads(extract_document_model(open(accepted_after_path, "rb").read(), True, True, "ko"))
    after_model = json.loads(extract_document_model(open(after_path, "rb").read(), True, True, "ko"))
    before_model = json.loads(extract_document_model(open(before_path, "rb").read(), True, True, "ko"))

    with zipfile.ZipFile(io.BytesIO(package_bytes)) as archive:
        parts = sorted(archive.namelist())
        comments_preserved = (
            "word/comments.xml" not in parts
            or archive.read("word/comments.xml") == zipfile.ZipFile(after_path).read("word/comments.xml")
        )
        package_rows = []
        if pair_id == "exact":
            document_root = ET.fromstring(archive.read("word/document.xml"))
            package_rows.extend(
                _segments_from_xml(paragraph)
                for paragraph in document_root.findall(W + "body/" + W + "p")
            )
            cell_paragraph = document_root.find(".//" + W + "tbl/" + W + "tr/" + W + "tc/" + W + "p")
            if cell_paragraph is not None:
                package_rows.append(_segments_from_xml(cell_paragraph))
    return ({
        "id": pair_id,
        "revisionCount": revision_count,
        "elapsedMs": elapsed_ms,
        "observations": list(_observations),
        "packageParts": parts,
        "commentsPreserved": comments_preserved,
        "acceptedMatchesAfter": accepted_model == after_model,
        "acceptedMatchesAcceptedAfter": accepted_model == accepted_after_model,
        "acceptedTextMatchesAcceptedAfter": _model_text(accepted_model) == _model_text(accepted_after_model),
        "packageRejectRows": _package_reject_rows(
            package_bytes,
            before_path,
            pair_spec.get("rejectTextExceptions", []),
            target_author,
        ),
        "inputCellParagraphs": {
            "before": _cell_paragraph_inputs(before_path),
            "after": _cell_paragraph_inputs(after_path),
        },
        "corruptedDeletedTexts": corrupted_deleted_texts,
        "packageRows": package_rows,
    }, before_model, after_model)


def _model_text(model):
    return {
        "blocks": [
            {
                "type": block["type"],
                "text": block.get("text", ""),
                "grid": [
                    [cell.get("text", "") for cell in row]
                    for row in (block.get("table") or {}).get("grid", [])
                ],
            }
            for block in model["blocks"]
        ],
        "headerFooter": [record.get("text", "") for record in model["headerFooter"]],
        "notes": [record.get("text", "") for record in model["notes"]],
        "comments": [record.get("text", "") for record in model.get("comments", [])],
    }


pair_specs = json.loads(PAIR_SPECS_JSON)
reports = []
models = []
for pair_spec in pair_specs:
    pair_id = pair_spec["pairId"]
    before_path = "/fixtures/" + pair_spec["before"]
    after_path = "/fixtures/" + pair_spec["after"]
    report, before_model, after_model = _run_pair(pair_spec, before_path, after_path)
    reports.append(report)
    models.append({"id": pair_id, "before": before_model, "after": after_model})

edge_cases = []
for identifier, before_text, after_text in (
    ("tab", "A\tB", "A B"),
    ("br", "A\nB", "A B"),
    ("cr", "A\nB", "A B"),
    ("surrogate", "😀 A cat", "😀 A cats"),
    ("combining", "cafe\u0301", "cafe\u0300"),
    ("empty-run", "same cat", "same cats"),
    ("empty-text", "", "cat"),
):
    before_paragraph = _paragraph(before_text)
    after_paragraph = _paragraph(after_text)
    if identifier == "cr":
        for element in before_paragraph.iter(W + "br"):
            element.tag = W + "cr"
    if identifier == "empty-run":
        before_paragraph.insert(0, ET.Element(W + "r"))
        after_paragraph.insert(0, ET.Element(W + "r"))
    _observations = []
    _paragraph_revision(before_paragraph, after_paragraph, True, _RevisionWriter("Worklazy Oracle"))
    edge_cases.append({"id": identifier, **_observations[-1]})

existing_after = ET.fromstring(
    '<w:p xmlns:w="' + WORD_NS + '"><w:ins w:id="8" w:author="Existing">'
    '<w:r><w:t>cats</w:t></w:r></w:ins></w:p>'
)
_observations = []
_paragraph_revision(_paragraph("cat"), existing_after, True, _RevisionWriter("Worklazy Oracle"))
edge_cases.append({"id": "existing-after", **_observations[-1]})

result = {
    "pairs": reports,
    "models": models,
    "edges": edge_cases,
}
json.dumps(result, ensure_ascii=False)
