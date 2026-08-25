import difflib
import io
import json
import re
import zipfile
import xml.etree.ElementTree as ET


W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
TOKEN_PATTERN = re.compile(r"\s+|[\w]+|[^\w\s]", re.UNICODE)
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


def _text(node):
    parts = []
    for item in node.iter():
        if item.tag == W + "t":
            parts.append(item.text or "")
        elif item.tag == W + "tab":
            parts.append("\t")
        elif item.tag in (W + "br", W + "cr"):
            parts.append("\n")
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
    for name in ("color", "sz", "rFonts"):
        item = props.find(W + name)
        if item is not None:
            values.append(name + ":" + json.dumps(item.attrib, sort_keys=True))
    return "|".join(values)


def _paragraph_record(paragraph, section, location, numbering=None):
    text = _text(paragraph)
    list_label = numbering.label(paragraph) if numbering is not None else ""
    formats = []
    for run in paragraph.iter(W + "r"):
        run_text = _text(run)
        if run_text:
            formats.append(run_text + "=" + _run_style(run))
    return {
        "section": section,
        "location": location,
        "text": text,
        "displayText": f"{list_label} {text}" if list_label and text else list_label or text,
        "listLabel": list_label,
        "format": "||".join(formats),
    }


def _read_comments(archive, numbering):
    if "word/comments.xml" not in archive.namelist():
        return {}

    comments_root = ET.fromstring(archive.read("word/comments.xml"))
    comments = {}
    for comment_index, comment in enumerate(comments_root.findall(W + "comment"), 1):
        comment_id = comment.attrib.get(W + "id", str(comment_index))
        paragraphs = list(comment.iter(W + "p"))
        comments[comment_id] = {
            "id": comment_id,
            "author": comment.attrib.get(W + "author", "").strip(),
            "text": "\n".join(_text(paragraph) for paragraph in paragraphs).strip(),
            "format": "||".join(
                _paragraph_record(paragraph, "comment", "", numbering)["format"]
                for paragraph in paragraphs
            ),
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
    }
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        numbering = _NumberingResolver(archive)
        comments = _read_comments(archive, numbering.fresh()) if include_metadata else {}
        comment_locations = {}
        root = ET.fromstring(archive.read("word/document.xml"))
        body = root.find(W + "body")
        paragraph_index = 0
        table_index = 0
        if body is not None:
            for child in _iter_story_blocks(body):
                if child.tag == W + "p":
                    paragraph_index += 1
                    record = _paragraph_record(child, "body", _l(f"본문 {paragraph_index}번째 문단", f"Body paragraph {paragraph_index}"), numbering)
                    comment_ids = _paragraph_comment_ids(child)
                    record["comments"] = [comments[item] for item in comment_ids if item in comments]
                    for comment_id in comment_ids:
                        comment_locations.setdefault(comment_id, record["location"])
                    if record["text"] or record["format"] or record["comments"]:
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
                            paragraph_records = [_paragraph_record(p, "table", "", numbering) for p in paragraphs]
                            text = "\n".join(record["text"] for record in paragraph_records)
                            display_text = "\n".join(record["displayText"] for record in paragraph_records)
                            list_labels = "\n".join(record["listLabel"] for record in paragraph_records)
                            formatting = "||".join(record["format"] for record in paragraph_records)
                            comment_ids = []
                            for paragraph in paragraphs:
                                for comment_id in _paragraph_comment_ids(paragraph):
                                    if comment_id not in comment_ids:
                                        comment_ids.append(comment_id)
                            record = {
                                "section": "table",
                                "location": _l(f"표 {table_index} · {row_index}행 {cell_index}열", f"Table {table_index} · row {row_index}, column {cell_index}"),
                                "text": text,
                                "displayText": display_text,
                                "listLabel": list_labels,
                                "format": formatting,
                                "comments": [comments[item] for item in comment_ids if item in comments],
                                "tableIndex": table_index - 1,
                                "rowIndex": row_index - 1,
                                "columnIndex": cell_index - 1,
                            }
                            for comment_id in comment_ids:
                                comment_locations.setdefault(comment_id, record["location"])
                            if record["text"] or record["format"] or record["comments"]:
                                records["table"].append(record)
                            row_records.append(record)
                        table_grid.append(row_records)
                    records["tables"].append(table_grid)
                    records["documentBlocks"].append({
                        "type": "table",
                        "tableIndex": table_index - 1,
                    })
                elif child.tag == W + "tbl":
                    for paragraph in child.iter(W + "p"):
                        numbering.label(paragraph)

        if include_metadata:
            header_footer_paths = sorted(
                name for name in archive.namelist()
                if re.match(r"word/(header|footer)\d+\.xml$", name)
            )
            for path in header_footer_paths:
                story_numbering = numbering.fresh()
                metadata_root = ET.fromstring(archive.read(path))
                file_name = path.split("/")[-1]
                area = _l("머리말", "Header") if file_name.startswith("header") else _l("꼬리말", "Footer")
                area_number = re.search(r"\d+", file_name)
                label = f"{area} {area_number.group(0)}" if area_number else area
                for index, paragraph in enumerate(metadata_root.iter(W + "p"), 1):
                    record = _paragraph_record(
                        paragraph,
                        "headerFooter",
                        _l(f"{label} · {index}번째 문단", f"{label} · paragraph {index}"),
                        story_numbering,
                    )
                    if record["text"] or record["format"]:
                        records["headerFooter"].append(record)

            for comment_id, comment in comments.items():
                author_label = f" · {comment['author']}" if comment["author"] else ""
                anchor_location = comment_locations.get(comment_id, _l("연결 위치를 찾지 못한 문단", "Paragraph with unknown anchor"))
                records["comment"].append({
                    "section": "comment",
                    "location": _l(f"{anchor_location} · 메모 {comment_id}{author_label}", f"{anchor_location} · comment {comment_id}{author_label}"),
                    "text": comment["text"],
                    "format": comment["format"],
                })

            for path, note_name, element_name in (
                ("word/footnotes.xml", _l("각주", "Footnote"), "footnote"),
                ("word/endnotes.xml", _l("미주", "Endnote"), "endnote"),
            ):
                if path not in archive.namelist():
                    continue
                notes_root = ET.fromstring(archive.read(path))
                story_numbering = numbering.fresh()
                for note_index, note in enumerate(notes_root.findall(W + element_name), 1):
                    note_id = note.attrib.get(W + "id", str(note_index))
                    try:
                        if int(note_id) < 0:
                            continue
                    except ValueError:
                        pass
                    for paragraph_index, paragraph in enumerate(note.iter(W + "p"), 1):
                        record = _paragraph_record(
                            paragraph,
                            "note",
                            _l(f"{note_name} {note_id} · {paragraph_index}번째 문단", f"{note_name} {note_id} · paragraph {paragraph_index}"),
                            story_numbering,
                        )
                        if record["text"] or record["format"]:
                            records["note"].append(record)
        records["warnings"] = numbering.unresolved
    return records


def _segments(before, after):
    before_tokens = TOKEN_PATTERN.findall(before)
    after_tokens = TOKEN_PATTERN.findall(after)
    matcher = difflib.SequenceMatcher(None, before_tokens, after_tokens, autojunk=False)
    result = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            result.append({"type": "equal", "text": "".join(before_tokens[i1:i2])})
        elif tag == "delete":
            result.append({"type": "deleted", "text": "".join(before_tokens[i1:i2])})
        elif tag == "insert":
            result.append({"type": "added", "text": "".join(after_tokens[j1:j2])})
        else:
            result.append({"type": "deleted", "text": "".join(before_tokens[i1:i2])})
            result.append({"type": "added", "text": "".join(after_tokens[j1:j2])})
    return [segment for segment in result if segment["text"]]


def _display_text(record):
    if not record:
        return ""
    return record.get("displayText", record.get("text", ""))


def _record_key(record, include_formatting):
    # Word's automatic list label is visible document content even though it is
    # stored outside w:t. Include it in matching just like ConvertNumbersToText.
    key = _display_text(record)
    if include_formatting:
        key += "\0" + record["format"]
    return key


def _record_format_changed(before, after):
    return (
        before.get("format", "") != after.get("format", "")
        or before.get("listLabel", "") != after.get("listLabel", "")
    )


def _normalize_split_text(value):
    return re.sub(r"\s+", " ", value or "").strip().casefold()


def _common_prefix_length(left, right):
    limit = min(len(left), len(right))
    index = 0
    while index < limit and left[index] == right[index]:
        index += 1
    return index


def _common_suffix_length(left, right):
    limit = min(len(left), len(right))
    index = 0
    while index < limit and left[-index - 1] == right[-index - 1]:
        index += 1
    return index


def _looks_like_paragraph_split(single_value, first_value, second_value):
    """Recognize one paragraph split into two without treating either half as new content."""
    single = _normalize_split_text(single_value)
    first = _normalize_split_text(first_value)
    second = _normalize_split_text(second_value)
    if len(single) < 20 or len(first) < 8 or len(second) < 8:
        return False
    prefix = _common_prefix_length(single, first)
    suffix = _common_suffix_length(single, second)
    minimum_prefix = min(24, max(8, round(min(len(single), len(first)) * 0.12)))
    minimum_suffix = min(24, max(8, round(min(len(single), len(second)) * 0.12)))
    covered = min(len(single), prefix + suffix) / len(single)
    # Both child paragraphs must own a meaningful, non-overlapping part of the
    # source. This avoids folding an unrelated paragraph into an exact match.
    non_overlapping = prefix < len(single) - minimum_suffix // 2 and suffix < len(single) - minimum_prefix // 2
    return prefix >= minimum_prefix and suffix >= minimum_suffix and covered >= PARAGRAPH_SPLIT_COVERAGE and non_overlapping


def _combine_records(records):
    if not records:
        return None
    first = records[0]
    last = records[-1]
    location = first.get("location", "")
    if location != last.get("location", ""):
        location = f"{location}~{last.get('location', '')}"
    result = {
        "section": first.get("section", last.get("section", "body")),
        "location": location,
        "text": "\n".join(record.get("text", "") for record in records),
        "displayText": "\n".join(_display_text(record) for record in records),
        "listLabel": "\n".join(record.get("listLabel", "") for record in records),
        "format": "||paragraph-break||".join(record.get("format", "") for record in records),
        "comments": [],
    }
    for record in records:
        result["comments"].extend(record.get("comments", []))
    return result


def _align_changed_items(before, after, text_of, compatible):
    def similarity(old, new):
        if not compatible(old, new):
            return -1.0
        return difflib.SequenceMatcher(
            None,
            _normalize_split_text(text_of(old)),
            _normalize_split_text(text_of(new)),
            autojunk=False,
        ).ratio()

    return [
        (
            [before[before_index]] if before_index is not None else [],
            [after[after_index]] if after_index is not None else [],
        )
        for before_index, after_index in align_dynamic_indices(
            before, after, similarity, ALIGNMENT_GAP_COST, ALIGNMENT_MATCH_THRESHOLD
        )
    ]


def _initial_record_groups(before, after, before_keys, after_keys, text_of=_display_text, compatible=lambda old, new: True):
    matcher = difflib.SequenceMatcher(None, before_keys, after_keys, autojunk=False)
    groups = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            groups.extend(([old], [new]) for old, new in zip(before[i1:i2], after[j1:j2]))
        elif tag == "delete":
            groups.extend(([record], []) for record in before[i1:i2])
        elif tag == "insert":
            groups.extend(([], [record]) for record in after[j1:j2])
        else:
            before_group = before[i1:i2]
            after_group = after[j1:j2]
            groups.extend(_align_changed_items(before_group, after_group, text_of, compatible))
    return groups


def _group_paragraph_splits(groups, record_of=lambda item: item, can_group=lambda item: True):
    result = []
    index = 0
    while index < len(groups):
        current_before, current_after = groups[index]
        if index + 1 >= len(groups):
            result.append((current_before, current_after))
            break
        next_before, next_after = groups[index + 1]

        if not current_before and len(current_after) == 1 and len(next_before) == 1 and len(next_after) == 1 and all(map(can_group, current_after + next_before + next_after)):
            if _looks_like_paragraph_split(_display_text(record_of(next_before[0])), _display_text(record_of(current_after[0])), _display_text(record_of(next_after[0]))):
                result.append((next_before, current_after + next_after))
                index += 2
                continue
        if len(current_before) == 1 and len(current_after) == 1 and not next_before and len(next_after) == 1 and all(map(can_group, current_before + current_after + next_after)):
            if _looks_like_paragraph_split(_display_text(record_of(current_before[0])), _display_text(record_of(current_after[0])), _display_text(record_of(next_after[0]))):
                result.append((current_before, current_after + next_after))
                index += 2
                continue
        if len(current_before) == 1 and not current_after and len(next_before) == 1 and len(next_after) == 1 and all(map(can_group, current_before + next_before + next_after)):
            if _looks_like_paragraph_split(_display_text(record_of(next_after[0])), _display_text(record_of(current_before[0])), _display_text(record_of(next_before[0]))):
                result.append((current_before + next_before, next_after))
                index += 2
                continue
        if len(current_before) == 1 and len(current_after) == 1 and len(next_before) == 1 and not next_after and all(map(can_group, current_before + current_after + next_before)):
            if _looks_like_paragraph_split(_display_text(record_of(current_after[0])), _display_text(record_of(current_before[0])), _display_text(record_of(next_before[0]))):
                result.append((current_before + next_before, current_after))
                index += 2
                continue

        result.append((current_before, current_after))
        index += 1
    return result


def _aligned_record_groups(before, after, keys):
    return _group_paragraph_splits(_initial_record_groups(before, after, keys(before), keys(after)))


def _change(kind, before=None, after=None):
    before_location = before.get("location", "") if before else ""
    after_location = after.get("location", "") if after else ""
    before = before or {"text": "", "location": after["location"], "section": after["section"]}
    after = after or {"text": "", "location": before["location"], "section": before["section"]}
    before_text = _display_text(before)
    after_text = _display_text(after)
    return {
        "kind": kind,
        "section": before.get("section") or after["section"],
        "location": after.get("location") or before["location"],
        "beforeLocation": before_location,
        "afterLocation": after_location,
        "before": before_text,
        "after": after_text,
        "segments": _segments(before_text, after_text),
    }


def _compare_records(before, after, include_formatting):
    changes = []
    unchanged = 0

    key_lists = lambda records: [_record_key(record, include_formatting) for record in records]
    for before_group, after_group in _aligned_record_groups(before, after, key_lists):
        old = _combine_records(before_group)
        new = _combine_records(after_group)
        if old is None:
            changes.append(_change("added", None, new))
        elif new is None:
            changes.append(_change("deleted", old, None))
        elif _record_key(old, include_formatting) == _record_key(new, include_formatting):
            unchanged += 1
        else:
            kind = "format" if _display_text(old) == _display_text(new) else "changed"
            changes.append(_change(kind, old, new))

    return changes, unchanged


def _view_pair(kind, before=None, after=None):
    before_comments = before.get("comments", []) if before else []
    after_comments = after.get("comments", []) if after else []
    change = _change(kind, before, after)
    change.pop("location", None)
    change["blockType"] = "paragraph"
    change["comments"] = _align_comments(before_comments, after_comments)
    return change


def _comment_signature(record):
    return json.dumps(
        [{"author": item.get("author", ""), "text": item.get("text", "")} for item in record.get("comments", [])],
        ensure_ascii=False,
        sort_keys=True,
    )


def _view_record_key(record, include_formatting):
    return _record_key(record, include_formatting) + "\0comments:" + _comment_signature(record)


def _align_comments(before, after):
    pairs = []
    unmatched_after = set(range(len(after)))
    matched = []
    for old in before:
        old_id = old.get("id", "")
        match_index = next((index for index in unmatched_after if old_id and after[index].get("id", "") == old_id), None)
        if match_index is None and unmatched_after:
            scored = []
            for index in unmatched_after:
                new = after[index]
                score = difflib.SequenceMatcher(None, old.get("text", ""), new.get("text", ""), autojunk=False).ratio()
                if old.get("author", "") and old.get("author", "") == new.get("author", ""):
                    score += 0.2
                scored.append((score, index))
            score, candidate = max(scored)
            match_index = candidate if score >= 0.45 else None
        if match_index is None:
            matched.append((old, None))
        else:
            unmatched_after.remove(match_index)
            matched.append((old, after[match_index]))
    matched.extend((None, after[index]) for index in sorted(unmatched_after))

    for old, new in matched:
        if old is None:
            pairs.append({
                "kind": "added", "beforeId": "", "afterId": new.get("id", ""),
                "beforeAuthor": "", "afterAuthor": new.get("author", ""),
                "before": "", "after": new.get("text", ""),
                "segments": _segments("", new.get("text", "")),
            })
            continue
        if new is None:
            pairs.append({
                "kind": "deleted", "beforeId": old.get("id", ""), "afterId": "",
                "beforeAuthor": old.get("author", ""), "afterAuthor": "",
                "before": old.get("text", ""), "after": "",
                "segments": _segments(old.get("text", ""), ""),
            })
            continue
        unchanged = old.get("author", "") == new.get("author", "") and old.get("text", "") == new.get("text", "")
        pairs.append({
            "kind": "unchanged" if unchanged else "changed",
            "beforeId": old.get("id", ""),
            "afterId": new.get("id", ""),
            "beforeAuthor": old.get("author", ""),
            "afterAuthor": new.get("author", ""),
            "before": old.get("text", ""),
            "after": new.get("text", ""),
            "segments": _segments(old.get("text", ""), new.get("text", "")),
        })
    return pairs


def _align_records(before, after, include_formatting):
    pairs = []

    key_lists = lambda records: [_view_record_key(record, include_formatting) for record in records]
    for before_group, after_group in _aligned_record_groups(before, after, key_lists):
        old = _combine_records(before_group)
        new = _combine_records(after_group)
        if old is None:
            kind = "added"
        elif new is None:
            kind = "deleted"
        elif _display_text(old) != _display_text(new):
            kind = "changed"
        elif _comment_signature(old) != _comment_signature(new):
            kind = "comment"
        elif include_formatting and _record_format_changed(old, new):
            kind = "format"
        else:
            kind = "unchanged"
        pairs.append(_view_pair(kind, old, new))

    return pairs


def _normalize_cell_text(value):
    return re.sub(r"\s+", " ", value or "").strip().casefold()


def _sequence_similarity(before, after):
    normalized_before = [_normalize_cell_text(value) for value in before]
    normalized_after = [_normalize_cell_text(value) for value in after]
    if not normalized_before and not normalized_after:
        return 1.0
    return difflib.SequenceMatcher(None, normalized_before, normalized_after, autojunk=False).ratio()


def _align_similar_sequences(before, after):
    """Globally align rows or columns while allowing an inserted axis to create one gap."""
    before_count = len(before)
    after_count = len(after)
    gap_cost = 0.55
    costs = [[0.0] * (after_count + 1) for _ in range(before_count + 1)]
    choices = [[""] * (after_count + 1) for _ in range(before_count + 1)]

    for before_index in range(1, before_count + 1):
        costs[before_index][0] = before_index * gap_cost
        choices[before_index][0] = "delete"
    for after_index in range(1, after_count + 1):
        costs[0][after_index] = after_index * gap_cost
        choices[0][after_index] = "insert"

    for before_index in range(1, before_count + 1):
        for after_index in range(1, after_count + 1):
            similarity = _sequence_similarity(before[before_index - 1], after[after_index - 1])
            candidates = (
                (costs[before_index - 1][after_index - 1] + (1.0 - similarity), "match"),
                (costs[before_index - 1][after_index] + gap_cost, "delete"),
                (costs[before_index][after_index - 1] + gap_cost, "insert"),
            )
            costs[before_index][after_index], choices[before_index][after_index] = min(
                candidates,
                key=lambda item: (item[0], 0 if item[1] == "match" else 1),
            )

    pairs = []
    before_index = before_count
    after_index = after_count
    while before_index > 0 or after_index > 0:
        choice = choices[before_index][after_index]
        if choice == "match":
            pairs.append({"beforeIndex": before_index - 1, "afterIndex": after_index - 1})
            before_index -= 1
            after_index -= 1
        elif choice == "delete":
            pairs.append({"beforeIndex": before_index - 1, "afterIndex": None})
            before_index -= 1
        else:
            pairs.append({"beforeIndex": None, "afterIndex": after_index - 1})
            after_index -= 1
    pairs.reverse()
    return pairs


def _row_signatures(table):
    return [[cell.get("text", "") for cell in row] for row in table]


def _column_signatures(table):
    max_columns = max((len(row) for row in table), default=0)
    return [
        [row[column_index].get("text", "") if column_index < len(row) else "__MISSING_CELL__" for row in table]
        for column_index in range(max_columns)
    ]


def _table_identity(table):
    max_columns = max((len(row) for row in table), default=0)
    first_row = tuple(_normalize_cell_text(cell.get("text", "")) for cell in table[0]) if table else ()
    return max_columns, first_row


def _align_table_sets(before_tables, after_tables):
    matcher = difflib.SequenceMatcher(
        None,
        [_table_identity(table) for table in before_tables],
        [_table_identity(table) for table in after_tables],
        autojunk=False,
    )
    pairs = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag in ("equal", "replace"):
            pair_count = min(i2 - i1, j2 - j1)
            pairs.extend((i1 + offset, j1 + offset) for offset in range(pair_count))
            pairs.extend((index, None) for index in range(i1 + pair_count, i2))
            pairs.extend((None, index) for index in range(j1 + pair_count, j2))
        elif tag == "delete":
            pairs.extend((index, None) for index in range(i1, i2))
        else:
            pairs.extend((None, index) for index in range(j1, j2))
    return pairs


def _cell_payload(cell):
    return {
        "text": _display_text(cell),
        "format": cell.get("format", ""),
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


def _smart_table_pair(display_index, before_index, after_index, before_table, after_table, include_formatting):
    row_pairs = _align_similar_sequences(_row_signatures(before_table), _row_signatures(after_table))
    column_pairs = _align_similar_sequences(_column_signatures(before_table), _column_signatures(after_table))
    before_kinds = [["deleted" for _ in row] for row in before_table]
    after_kinds = [["added" for _ in row] for row in after_table]
    row_map = {
        pair["beforeIndex"]: pair["afterIndex"]
        for pair in row_pairs
        if pair["beforeIndex"] is not None and pair["afterIndex"] is not None
    }
    column_map = {
        pair["beforeIndex"]: pair["afterIndex"]
        for pair in column_pairs
        if pair["beforeIndex"] is not None and pair["afterIndex"] is not None
    }
    before_payload = [[_cell_payload(cell) for cell in row] for row in before_table]
    after_payload = [[_cell_payload(cell) for cell in row] for row in after_table]

    changes = []
    unchanged = 0
    for before_row_index, before_row in enumerate(before_table):
        after_row_index = row_map.get(before_row_index)
        for before_column_index, before_cell in enumerate(before_row):
            after_column_index = column_map.get(before_column_index)
            after_cell = None
            if after_row_index is not None and after_column_index is not None and after_row_index < len(after_table):
                after_row = after_table[after_row_index]
                if after_column_index < len(after_row):
                    after_cell = after_row[after_column_index]

            if after_cell is None:
                changes.append(_change("deleted", before_cell, None))
                continue

            if _display_text(before_cell) != _display_text(after_cell):
                kind = "changed"
            elif include_formatting and _record_format_changed(before_cell, after_cell):
                kind = "format"
            else:
                kind = "unchanged"
            before_kinds[before_row_index][before_column_index] = kind
            after_kinds[after_row_index][after_column_index] = kind
            segments = _segments(before_cell.get("text", ""), after_cell.get("text", ""))
            before_payload[before_row_index][before_column_index]["segments"] = segments
            after_payload[after_row_index][after_column_index]["segments"] = segments
            if kind == "unchanged":
                unchanged += 1
            else:
                changes.append(_change(kind, before_cell, after_cell))

    for after_row_index, after_row in enumerate(after_table):
        for after_column_index, after_cell in enumerate(after_row):
            if after_kinds[after_row_index][after_column_index] == "added":
                changes.append(_change("added", None, after_cell))

    if before_index is None:
        table_kind = "added"
    elif after_index is None:
        table_kind = "deleted"
    elif changes:
        table_kind = "changed"
    else:
        table_kind = "unchanged"

    result = {
        "index": display_index,
        "kind": table_kind,
        "beforeIndex": before_index,
        "afterIndex": after_index,
        "before": before_payload,
        "after": after_payload,
        "rowPairs": row_pairs,
        "columnPairs": column_pairs,
        "beforeKinds": before_kinds,
        "afterKinds": after_kinds,
    }
    return result, changes, unchanged


def _compare_tables(before_tables, after_tables, include_formatting):
    results = []
    changes = []
    unchanged = 0
    for display_index, (before_index, after_index) in enumerate(_align_table_sets(before_tables, after_tables)):
        before_table = before_tables[before_index] if before_index is not None else []
        after_table = after_tables[after_index] if after_index is not None else []
        result, table_changes, table_unchanged = _smart_table_pair(
            display_index,
            before_index,
            after_index,
            before_table,
            after_table,
            include_formatting,
        )
        results.append(result)
        changes.extend(table_changes)
        unchanged += table_unchanged
    return results, changes, unchanged


def _document_table_view(table_result):
    before_index = table_result.get("beforeIndex")
    after_index = table_result.get("afterIndex")
    return {
        "kind": table_result["kind"],
        "section": "table",
        "blockType": "table",
        "tableIndex": table_result["index"],
        "beforeLocation": _l(f"표 {before_index + 1}", f"Table {before_index + 1}") if before_index is not None else "",
        "afterLocation": _l(f"표 {after_index + 1}", f"Table {after_index + 1}") if after_index is not None else "",
        "before": "",
        "after": "",
        "segments": [],
        "comments": [],
    }


def _align_document_blocks(before_blocks, after_blocks, table_results, include_formatting):
    before_tables = {
        table["beforeIndex"]: table
        for table in table_results
        if table.get("beforeIndex") is not None
    }
    after_tables = {
        table["afterIndex"]: table
        for table in table_results
        if table.get("afterIndex") is not None
    }

    def block_key(block, side):
        if block["type"] == "paragraph":
            return "paragraph\0" + _view_record_key(block["record"], include_formatting)
        table = (before_tables if side == "before" else after_tables).get(block["tableIndex"])
        if not table:
            return f"{side}-table\0{block['tableIndex']}"
        if table.get("beforeIndex") is not None and table.get("afterIndex") is not None:
            return f"table-pair\0{table['index']}"
        return f"{side}-table\0{table['index']}"

    def single_view(block, side):
        if block["type"] == "table":
            table = (before_tables if side == "before" else after_tables).get(block["tableIndex"])
            return _document_table_view(table) if table else None
        if side == "before":
            return _view_pair("deleted", block["record"], None)
        return _view_pair("added", None, block["record"])

    before_keys = [block_key(block, "before") for block in before_blocks]
    after_keys = [block_key(block, "after") for block in after_blocks]
    result = []

    groups = _initial_record_groups(
        before_blocks,
        after_blocks,
        before_keys,
        after_keys,
        text_of=lambda block: _display_text(block["record"]) if block["type"] == "paragraph" else f"table:{block['tableIndex']}",
        compatible=lambda old, new: old["type"] == new["type"],
    )
    groups = _group_paragraph_splits(
        groups,
        record_of=lambda block: block["record"],
        can_group=lambda block: block["type"] == "paragraph",
    )
    for before_group, after_group in groups:
        if before_group and after_group and all(block["type"] == "paragraph" for block in before_group + after_group):
            old = _combine_records([block["record"] for block in before_group])
            new = _combine_records([block["record"] for block in after_group])
            if _display_text(old) != _display_text(new):
                kind = "changed"
            elif _comment_signature(old) != _comment_signature(new):
                kind = "comment"
            elif include_formatting and _record_format_changed(old, new):
                kind = "format"
            else:
                kind = "unchanged"
            result.append(_view_pair(kind, old, new))
            continue

        if len(before_group) == 1 and len(after_group) == 1 and before_group[0]["type"] == after_group[0]["type"] == "table":
            before_table = before_tables.get(before_group[0]["tableIndex"])
            after_table = after_tables.get(after_group[0]["tableIndex"])
            if before_table and after_table and before_table["index"] != after_table["index"]:
                result.append(_document_table_view(before_table))
                result.append(_document_table_view(after_table))
            elif before_table or after_table:
                result.append(_document_table_view(before_table or after_table))
            continue

        for block in before_group:
            view = single_view(block, "before")
            if view:
                result.append(view)
        for block in after_group:
            view = single_view(block, "after")
            if view:
                result.append(view)

    return result


def compare_documents(before_bytes, after_bytes, before_name, after_name, include_formatting, include_tables, include_metadata, language="ko"):
    global LANGUAGE
    LANGUAGE = "en" if language == "en" else "ko"
    before_bytes = bytes(before_bytes)
    after_bytes = bytes(after_bytes)
    before_records = _parse_document(before_bytes, include_tables, include_metadata)
    after_records = _parse_document(after_bytes, include_tables, include_metadata)
    all_changes = []
    unchanged = 0
    for section in ("body", "headerFooter", "comment", "note"):
        changes, section_unchanged = _compare_records(
            before_records[section], after_records[section], include_formatting
        )
        all_changes.extend(changes)
        unchanged += section_unchanged

    table_results, table_changes, table_unchanged = _compare_tables(
        before_records["tables"],
        after_records["tables"],
        include_formatting,
    )
    all_changes.extend(table_changes)
    unchanged += table_unchanged

    views = {
        "document": _align_document_blocks(
            before_records["documentBlocks"],
            after_records["documentBlocks"],
            table_results,
            include_formatting,
        ),
        "headerFooter": _align_records(before_records["headerFooter"], after_records["headerFooter"], include_formatting),
        "note": _align_records(before_records["note"], after_records["note"], include_formatting),
    }

    summary = {"added": 0, "deleted": 0, "changed": 0, "format": 0, "unchanged": unchanged}
    for change in all_changes:
        summary[change["kind"]] += 1

    warnings = [_l("필드 계산 결과, 도형과 일부 고급 레이아웃은 Microsoft Word의 표시와 차이가 날 수 있습니다.", "Calculated fields, shapes, and some advanced layouts may differ from Microsoft Word's display.")]
    unresolved_numbering = before_records.get("warnings", 0) + after_records.get("warnings", 0)
    if unresolved_numbering:
        warnings.append(_l(f"정의를 찾지 못한 자동 번호 {unresolved_numbering}개는 번호 없이 표시했습니다.", f"Displayed {unresolved_numbering} automatic numbers without labels because their definitions were unavailable."))

    result = {
        "beforeName": before_name,
        "afterName": after_name,
        "summary": summary,
        "changes": all_changes,
        "tables": table_results,
        "views": views,
        "warnings": warnings,
    }
    return json.dumps(result, ensure_ascii=False)


def extract_document_model(document_bytes, include_tables, include_metadata, language="ko"):
    """Return only the format-specific extraction model.

    Paragraph matching and result generation live in the shared TypeScript
    comparison engine so Word and HWP/HWPX use exactly the same rules.
    """
    global LANGUAGE
    LANGUAGE = "en" if language == "en" else "ko"
    records = _parse_document(bytes(document_bytes), include_tables, include_metadata)

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
            "text": _display_text(record),
            "format": record.get("format", ""),
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
            "text": " | ".join(
                "\u241f".join(cell.get("text", "") for cell in row)
                for row in table["grid"]
                if any(cell.get("text", "") for cell in row)
            ),
            "format": "",
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
        "blocks": blocks,
        "headerFooter": [record_of(record) for record in records["headerFooter"]],
        "notes": [record_of(record) for record in records["note"]],
        "comments": [record_of(record) for record in records["comment"]],
        "warnings": warnings,
    }
    return json.dumps(model, ensure_ascii=False)
