# Markdown Conversion Refactor Plan

Goal: replace string-level newline heuristics with a generalized, test-driven HTML/DOM-to-Markdown pipeline that is robust for ChatGPT selection markup.

## Phase 1: Freeze Current + Problem Behaviors (Fixtures First)
- [ ] Create fixture structure under `tests/unit/fixtures/`:
  - `input.html`
  - `expected.md`
- [ ] Add fixture test runner that exact-compares conversion output to `expected.md`.
- [ ] Add baseline fixtures:
  - [ ] headings + paragraphs
  - [ ] wrapped paragraph with `<br>` (the reported bug case)
  - [ ] multi-`<p>` line wraps from ChatGPT
  - [ ] ordered/unordered/nested lists
  - [ ] blockquote
  - [ ] code block + inline code
  - [ ] tables (including `colspan`)
  - [ ] links + emphasis/strong/strike
  - [ ] KaTeX inline/display
  - [ ] mixed whitespace/indentation text nodes

## Phase 2: Introduce AST/IR
- [ ] Define block node types:
  - [ ] `paragraph`
  - [ ] `heading`
  - [ ] `list`
  - [ ] `list_item`
  - [ ] `blockquote`
  - [ ] `code_block`
  - [ ] `table`
  - [ ] `hr`
- [ ] Define inline node types:
  - [ ] `text`
  - [ ] `em`
  - [ ] `strong`
  - [ ] `del`
  - [ ] `code`
  - [ ] `link`
  - [ ] `hard_break`
  - [ ] `math_inline`
  - [ ] `math_block`
- [ ] Add parser-shape unit tests for tricky DOM patterns.

## Phase 3: DOM -> AST Parser
- [ ] Parse `DocumentFragment` into AST instead of directly emitting markdown strings.
- [ ] Implement explicit block/inline boundaries.
- [ ] Map `<br>` to `hard_break`.
- [ ] Drop formatting-only text nodes at block boundaries.
- [ ] Preserve meaningful inline whitespace.

## Phase 4: AST Normalization
- [ ] Merge adjacent text nodes.
- [ ] Remove empty nodes/blocks.
- [ ] Normalize list item structure.
- [ ] Collapse redundant hard breaks.
- [ ] Add normalization unit tests for each rule.

## Phase 5: AST -> Markdown Renderer
- [ ] Implement deterministic rendering rules:
  - [ ] one blank line between block nodes
  - [ ] no extra blank lines inside paragraph unless explicit hard break
  - [ ] stable list indentation
  - [ ] stable table rendering
- [ ] Add renderer tests (AST input -> markdown output).

## Phase 6: Integration + Migration
- [ ] Replace `htmlToMarkdown` internals with `parse -> normalize -> render`.
- [ ] Keep current converter behind temporary feature flag for rollback/parity checks.
- [ ] Add parity tests where old output is known-good.
- [ ] Add explicit improved-output tests for known old failures.

## Phase 7: E2E Verification
- [ ] Extend Playwright tests to assert exact clipboard markdown content for:
  - [ ] wrapped `<p><br>` paragraph
  - [ ] multi-`<p>` wrapped content
  - [ ] lists/code/tables sample
- [ ] Verify both selection button and full-response button paths.

## Release Gate / Definition of Done
- [ ] All fixture/unit tests pass.
- [ ] E2E clipboard-content assertions pass.
- [ ] Remove markdown punctuation regex hacks from normalization.
- [ ] Confirm no regressions on corpus and real chat samples.
