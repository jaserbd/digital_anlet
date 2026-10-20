# Executive comments per question, duplicate benchmark rows, PDF spider diagram

**Status: done** — merged to `main`, deployed to `anlet-504115` as revision `anlet-00011-zjm` on 2026-10-20 after Cloud SQL backup `1792526056171` (no migration; rollback: revision `anlet-00010-9kf`). Live smoke test only (pages load, new bundle served, no error logs), since the logged-in walkthrough needs a production account. Locally tested (integration + unit tests, headless-Chrome walkthrough of the Executive page, Deep-Dive page and personal results PDF with local "ZZ PDF Test" data, deleted afterwards).

Source: `admin_management.md` lines 25–29 (2026-10-20), clarified in discussion.

## Findings

- Comment Collection only shows the Cognitive Activity, not the question, so a comment can't be matched to its question.
- The "duplicate" benchmark row is the synthetic "no NatCo" row. It is named after the organization and created for
  any counted member without a NatCo — usually Executives, whose profile doesn't ask for one. When the only NatCo has
  the organization's name, the empty row looks like a duplicate.
- Neither PDF (personal results, Executive/Deep-Dive report) includes the spider diagram. The report renders every chart
  one after another through html2canvas.

## Decisions

| Topic | Decision |
|---|---|
| Comments per question | **Both**: each question's comments shown inside its Answer distribution block (respecting the NatCo scope), and a **Question** column ("Q3 · Service Capability") in Comment Collection, its Excel sheet and the PDF. |
| Duplicate rows | An organization with **exactly one NatCo** counts members without a NatCo under that NatCo (no extra row). With several NatCos, the "no NatCo" row is shown **only when someone in it has submitted**. An organization with no NatCos keeps its single organization-named row. Same rule for the combined Core table and the Executive participation-by-NatCo table. |
| PDF spider diagram | Added to the personal results PDF and to the Executive/Deep-Dive report, using the on-screen NatCo/Country filter (named above the chart). |
| PDF speed | Charts are rendered by serializing their SVG straight to a canvas (no html2canvas), with chart animation off during capture; full content kept. Measured locally: 15.1 s → 1.8 s. html2canvas also produced blank chart images. |

## Steps

1. Backend: benchmark row rule + NatCo status rule, integration tests.
2. Frontend: Question column + inline comments, PDF spider diagram, faster chart capture, tests.
3. Local checks + browser testing, review, update CLAUDE.md, merge to `main`, deploy to `anlet-504115`, live test.
