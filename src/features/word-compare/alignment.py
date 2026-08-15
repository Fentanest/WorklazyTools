ALIGNMENT_GAP_COST = 0.58
ALIGNMENT_MATCH_THRESHOLD = 0.24
PARAGRAPH_SPLIT_COVERAGE = 0.58


def align_dynamic_indices(before, after, similarity, gap_cost=ALIGNMENT_GAP_COST, reject_below=None):
    before_count = len(before)
    after_count = len(after)
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
            score = similarity(before[before_index - 1], after[after_index - 1])
            match_cost = 1.0 - score if score >= 0 else gap_cost * 2 + 0.1
            candidates = (
                (costs[before_index - 1][after_index - 1] + match_cost, "match"),
                (costs[before_index - 1][after_index] + gap_cost, "delete"),
                (costs[before_index][after_index - 1] + gap_cost, "insert"),
            )
            costs[before_index][after_index], choices[before_index][after_index] = min(
                candidates, key=lambda item: (item[0], 0 if item[1] == "match" else 1)
            )
    pairs = []
    before_index = before_count
    after_index = after_count
    while before_index > 0 or after_index > 0:
        choice = choices[before_index][after_index]
        if choice == "match":
            old_index = before_index - 1
            new_index = after_index - 1
            if reject_below is not None and similarity(before[old_index], after[new_index]) < reject_below:
                pairs.extend(((None, new_index), (old_index, None)))
            else:
                pairs.append((old_index, new_index))
            before_index -= 1
            after_index -= 1
        elif choice == "delete":
            pairs.append((before_index - 1, None))
            before_index -= 1
        else:
            pairs.append((None, after_index - 1))
            after_index -= 1
    pairs.reverse()
    return pairs
