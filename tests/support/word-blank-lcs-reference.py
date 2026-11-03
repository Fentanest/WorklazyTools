"""Frozen c20104bf blank balancing oracle (tracked_docx.py SHA256
613e025c7094ee25f3659030f99a371912e105f7203a86ca60cca3ed44e84c1f).
Do not derive expected results from the replacement helper.
"""

def reference_pairs(a, b):
    old = list(enumerate(a))
    new = [([[], [j], {}], value) for j, value in enumerate(b)]
    rows, columns = len(old), len(new)
    table = [[0] * (columns + 1) for _ in range(rows + 1)]
    for i in range(rows - 1, -1, -1):
        for j in range(columns - 1, -1, -1):
            table[i][j] = table[i + 1][j + 1] + 1 if old[i][1] == new[j][1] else max(table[i + 1][j], table[i][j + 1])
    i = j = 0
    paired_old, paired_new = set(), set()
    while i < rows and j < columns:
        if old[i][1] == new[j][1]:
            new[j][0][0].append(old[i][0]); paired_old.add(i); paired_new.add(j); i += 1; j += 1
        elif table[i + 1][j] >= table[i][j + 1]:
            i += 1
        else:
            j += 1
    return [(item[0][0], item[1][0]) for item, _ in new if item[0]]


def reference_balance(before, after, result):
    """Empty paragraphs are left out of the comparison. Between the same neighbouring decisions,
    keep as many revised empty paragraphs as both sides have, mark the revision's extra ones as
    inserted and record the original's extra ones as deleted, so paragraph counts match on both
    Accept All and Reject All. Empty paragraphs holding a section break pair by order instead."""
    covered_before = {index for indexes, _, _ in result for index in indexes}
    pairs = sorted((xs[0], ys[0]) for xs, ys, _ in result if xs and ys)
    pair_keys = [a for a, _ in pairs]
    after_anchors = sorted(b for _, b in pairs)
    def anchor_of_before(index):
        position = bisect.bisect_right(pair_keys, index)
        return pairs[position][1] if position < len(pairs) else len(after)
    def anchor_of_after(index):
        position = bisect.bisect_right(after_anchors, index)
        return after_anchors[position] if position < len(after_anchors) else len(after)
    groups = {}
    for index, node in enumerate(before):
        signature = _blank_signature(node) if index not in covered_before else None
        if signature is not None:
            groups.setdefault(anchor_of_before(index), [[], []])[0].append((index, signature))
    for item in result:
        xs, ys, decision = item
        signature = _blank_signature(after[ys[0]]) if decision.get("untracked") and len(ys) == 1 else None
        if signature is not None:
            groups.setdefault(anchor_of_after(ys[0]), [[], []])[1].append((item, signature))
    for anchor, (old, new) in groups.items():
        new.sort(key=lambda entry: entry[0][1][0])
        # Pair lines of the same kind (plain, page break, ...) without crossing, as a longest
        # common subsequence. A kept line stands for the original's line it pairs with, so
        # deletions around it keep their original order on Reject All.
        rows, columns = len(old), len(new)
        table = [[0] * (columns + 1) for _ in range(rows + 1)]
        for i in range(rows - 1, -1, -1):
            for j in range(columns - 1, -1, -1):
                table[i][j] = table[i + 1][j + 1] + 1 if old[i][1] == new[j][1] else max(table[i + 1][j], table[i][j + 1])
        i = j = 0
        paired_old, paired_new = set(), set()
        while i < rows and j < columns:
            if old[i][1] == new[j][1]:
                new[j][0][0].append(old[i][0]); paired_old.add(i); paired_new.add(j); i += 1; j += 1
            elif table[i + 1][j] >= table[i][j + 1]:
                i += 1
            else:
                j += 1
        for j, (item, _) in enumerate(new):
            if j not in paired_new:
                item[2]["insertedBlank"] = True
        for i, (index, _) in enumerate(old):
            if i not in paired_old:
                result.append(([index], [], {"deletedBlank": True}))
