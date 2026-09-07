import hashlib
import inspect
import io
import json
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


def _run_pair(pair_id, before_path, after_path):
    global _observations, _part_by_hash, _pair_id, _node_paths, _synthetic_sources
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
    revision_count = generate_tracked_document(
        before_path,
        after_path,
        output,
        "Worklazy Oracle",
        True,
        True,
        True,
    )
    elapsed_ms = (time.perf_counter() - started) * 1000
    tracked_path = f"/fixtures/{pair_id}-tracked.docx"
    accepted_path = f"/fixtures/{pair_id}-accepted.docx"
    accepted_after_path = f"/fixtures/{pair_id}-after-accepted.docx"
    with open(tracked_path, "wb") as target:
        target.write(output.getvalue())
    accept_tracked_document(tracked_path, accepted_path)
    accept_tracked_document(after_path, accepted_after_path)
    accepted_model = json.loads(extract_document_model(open(accepted_path, "rb").read(), True, True, "ko"))
    accepted_after_model = json.loads(extract_document_model(open(accepted_after_path, "rb").read(), True, True, "ko"))
    after_model = json.loads(extract_document_model(open(after_path, "rb").read(), True, True, "ko"))
    before_model = json.loads(extract_document_model(open(before_path, "rb").read(), True, True, "ko"))

    with zipfile.ZipFile(output) as archive:
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
    report, before_model, after_model = _run_pair(pair_id, before_path, after_path)
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
