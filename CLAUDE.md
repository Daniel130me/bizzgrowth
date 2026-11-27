## North Star — read before building or changing anything

Every feature, prompt, screen and notification must serve **the feeling we want owners to have**:
the full text is in `PRODUCT.md` ("North Star: the feeling we want owners to have").

- **Fear of missing valuable discoveries**: every visit can show the owner something new and useful
  about their own business.
- **Confidence Nellovia will find answers**: it investigates beyond the obvious, finds overlooked
  problems and opportunities, challenges wrong assumptions (the owner's too, when their figures say
  otherwise), recommends evidence-based solutions, and follows through until there is real progress.
- **A living business intelligence**: it feels like a consultant who keeps thinking, not a tool that
  waits for instructions.
- **It remembers** (owners never start over), **every discovery can be checked** (their own figures,
  maths in code, working shown), **it cares about the person** (the urgent thing first), and
  **progress is visible**.
- **Earned, never manufactured**: no fabricated discoveries, meaningless notifications,
  manufactured urgency, or generic advice dressed up as insight. When nothing new has happened,
  say so.

Before finishing a change, ask: after this, what does the owner know that they didn't, or what can
they now do that they couldn't? If a screen or flow misleads or underwhelms, change it.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

### bizzGrowth notes
- Graph covers `src/`, `scripts/` and top-level config (code-only AST build, ~1,675 nodes / 93 communities as of 2026-11-18). What's excluded is listed in `.graphifyignore` (node_modules, .next, tool-results, download, upload, public, db, etc.).
- Run graphify commands from this folder (`bizzgrowth/`), where `graphify-out/` lives.
- Refresh after big changes: `graphify update .` (add `--force` if files were deleted and the graph should shrink). Git hooks (post-commit/checkout/merge/rewrite) also rebuild it automatically after commits.
- Query output is capped at 2000 tokens by default; pass `--budget 600` for a quick file lookup.
