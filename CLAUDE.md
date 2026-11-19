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
