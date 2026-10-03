# Guess Matching

Classifies each guess as **correct**, **close**, or **wrong**. Runs only on the server, in `game-core`, with no I/O and lots of unit tests.

## 1. Normalization

Apply the same steps to the guess, the card text, and each alternate:

1. Unicode NFKD, strip diacritics (`séance` → `seance`).
2. Lowercase.
3. Replace `&` → `and`. Remove punctuation except spaces (`witch's` → `witchs`; also try the version without the possessive `s`).
4. Collapse whitespace and trim.
5. Remove leading articles and filler: `a`, `an`, `the`, and for silly cards also `on`, `in`, `at`, `of`, `with`, `doing`, `is` (only for the keyword check, not for exact match).
6. Simple singularization (`bats` → `bat`, `witches` → `witch`). A small library like `pluralize` is enough.

The rules depend on language. Version 1 ships English rules only.

## 2. Classification

```
targets = [card.text, ...card.alternates].map(normalize)
g = normalize(guess)

if g in targets:                                   → CORRECT
if card.isSilly and keywordCoverage(g) == 1.0:     → CORRECT   // all key concepts, any order
if any target: similarity(g, target) ≥ CLOSE:      → CLOSE
if card.isSilly and keywordCoverage(g) ≥ 0.5:      → CLOSE
if any target word (len ≥ 4) is within edit distance 1 of a guess word,
   and the target has multiple words:              → CLOSE     // "vampire" for "vampire bat"
else                                               → WRONG
```

### Similarity ("close")

Use **Damerau–Levenshtein distance** (counts transpositions like `pumpkni`) with a threshold that grows with word length:

| Target length (chars, no spaces) | Max edits to count as **close** |
|---|---|
| ≤ 4 | 1 |
| 5–8 | 2 |
| ≥ 9 | 3 |

Exact match after normalization is required for **correct**. Typos are "close", not correct, the same as in skribbl.io. An open question is whether 1-edit typos on long words should count as correct (see [open-questions.md](../planning/open-questions.md)).

Also counted as close:
- **Token-set overlap** for multi-word answers: the guess contains ≥ 50% of the target's meaningful words (`haunted mansion` vs `haunted house`).
- **Substring**: the guess is the target with one word missing or extra (`house` vs `haunted house` → close).

### Silly cards and keywords

The AI provides `keywords` per card (e.g. `Vampire on a unicycle` → `["vampire", "unicycle"]`, and `Realtor skeleton` → `["realtor", "skeleton"]`). The AI also provides synonym groups in `alternates` where they make sense (`["real estate agent skeleton", "skeleton realtor"]`).

```
keywordCoverage(g) = (# keywords k where some guess token ≈ k (edit distance ≤ 1, or singular match)) / keywords.length
```

So `skeleton realtor`, `a realtor that's a skeleton`, and `vampire riding unicycle` are all **correct**. `vampire` alone is **close**.

## 3. Anti-spoiler details

- A guess that contains the answer plus junk (`pumpkinpumpkin`, `is it pumpkin?`) is normalized first. If a target appears as a whole token sequence inside the guess, it counts as **correct**. This is more forgiving for casual players.
- Repeating close guesses doesn't help: each one is shown redacted.
- The redaction length is fixed (`██████`) and doesn't match the guess's length, so it gives away no information.

## 4. Test cases (starter set)

| Card | Guess | Expected |
|---|---|---|
| Pumpkin | `pumpkin` | correct |
| Pumpkin | `Pumpkins!` | correct (plural + punctuation) |
| Pumpkin | `pumkin` | close |
| Pumpkin | `pump` | wrong |
| Witch hat | `witch's hat` | correct (alternate/possessive) |
| Witch hat | `hat` | close (token overlap) |
| Séance | `seance` | correct |
| Haunted house | `haunted mansion` | close |
| Vampire on a unicycle | `vampire unicycle` | correct (keywords) |
| Vampire on a unicycle | `unicycle vampire` | correct |
| Vampire on a unicycle | `vampire` | close |
| Vampire on a unicycle | `dracula on a bike` | wrong (could be close if alternates include "dracula"/"bike". Up to the AI) |
| Realtor skeleton | `skeleton real estate agent` | correct (alternate) |
| Cat | `car` | close (len ≤ 4, 1 edit) |
| Cat | `dog` | wrong |

## 5. Later improvements

- **Semantic closeness** via embeddings (e.g. `dracula` ↔ `vampire`). It needs to be fast (a precomputed embedding per card plus a cached embedding per guess) and tuned carefully so synonyms don't become "correct" too easily. Use it only to upgrade *wrong → close*, never to mark a guess correct.
- Collect anonymized (guess, card, classification) data to tune thresholds and to generate better `alternates`.
