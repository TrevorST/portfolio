---
title: MoodBox
summary: A local visual prototyping studio. Collect references on a canvas, pick the context, and have Codex or Claude Code generate interactive demos beside them. Every revision is kept as a branch.
build: 0.2.0
status: active
year: 2026
stack: [TypeScript, React, tldraw, Node, Express, SQLite, Playwright]
cover: ../../assets/projects/moodbox.svg
coverAlt: The MoodBox logo. An open lime-green box with an angular M inside.
featured: true
order: 2
---

MoodBox turns a board of visual inspiration into working, interactive demos.

## The loop

1. Drop images and notes on the board, or capture a public website as a screenshot.
2. Select what matters and write a prompt. `@ID` mentions pull specific references into it.
3. Choose Codex or Claude Code. The generated demo appears on the canvas next to the references it came from.
4. Revise. Each revision is a new, immutable branch, and a lineage graph shows how every version relates.

## Under the hood

- A local Node service with SQLite metadata and file-system assets, plus a React and tldraw canvas.
- A durable job system with bounded concurrency for generation, visual analysis and captures.
- Every capability is a module with a written charter, and the build rejects imports that break module boundaries.
- Boxes nest up to five levels deep, each with its own design brief that overrides the board's.

It runs locally against your own signed-in agent tools, so there is no hosted demo. A showcase of what it generates lands here in v0.3.
