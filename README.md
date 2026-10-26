# AgentReady Scan — GitHub Action (DRAFT, unpublished)

> **Status: local draft only — not published, not tagged, not listed.**
> Staged 2026-10-22 after both Marketplace gates passed (see below).
> Publishing is Marcus Richards's tap.

Score how well AI agents can read, cite, and operate a website — 15 checks,
93 weighted points, evidence for every verdict. Checks include llms.txt,
AI crawler rules in robots.txt, structured data (JSON-LD), OpenAPI,
agent manifest, and markdown negotiation. Soft-404 safe: a catch-all site
cannot fake a pass, and an unreachable site fails closed (UNREACHABLE)
instead of scoring zero-evidence guesses.

The action runs entirely in your own runner. It sends no data anywhere
except read-only GET requests to the site you scan. Zero dependencies.

## Usage

```yaml
name: Agent readiness
on: [push]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: FetchDoge/agentready-action@v1
        with:
          url: https://example.com
          fail-below: '45'
```

## Inputs

| Input | Required | Default | What it does |
|---|---|---|---|
| `url` | yes | — | Public website to scan |
| `top` | no | all | Show only the top N failing checks |
| `timeout-ms` | no | `12000` | Per-request timeout |
| `fail-below` | no | — | Fail the step when the score is under this threshold |
| `comment-on` | no | `none` | Reserved for a future release (report currently lands in the step summary + artifact) |

## Outputs

| Output | Meaning |
|---|---|
| `score` | 0–100 agent-readiness score |
| `grade` | Letter grade (A–F) |
| `earned` | Weighted points earned, out of 93 |
| `report-json` | Path to the JSON report in the uploaded artifact |

## How it works

This repo contains no scoring code. `action.yml` checks out the scanner
(FetchDoge/agentready) at a pinned, immutable commit and runs it through
the same SSRF/hostname guard the scanner's own issue funnel uses
(localhost, `*.local`, `*.internal`, IP literals, and metadata hosts are
refused). A scanner release bumps the pin in one commit.

**Scanner pin:** `345705a2f29ffa8bc32b64d29d26733ada9c08c7`
(FetchDoge/agentready main, 2026-10-18; scan.mjs blob
`2f9e11284dc1eb0037ccfcde9bb1bfa48774f7dd`). The scanner repo has no
release tag yet, so the pin is the full commit SHA; when a scanner
release is tagged, the pin moves to that tag + SHA in the release notes.

## Gate evidence (2026-10-22)

- **Reproduction gate — PASS.** Clean clone, test suite
  19 pass / 0 fail / 1 skipped; live scan of stripe.com scored
  **47/100, grade D, 44/93** — delta 0 against the verified baseline
  recorded on Linear AGENTS-75.
- **Name gate — PASS with a crowding note.** Marketplace search for
  "agentready" (type: actions) on 2026-10-22 returned exactly 3 listings —
  "AgentReady Repository Scanner", "AgentReady CI Gate by TimeProofs",
  "AgentReady Woo Release Preflight" — none named "AgentReady Scan".
  The name is free as far as public checks can tell; GitHub's definitive
  uniqueness check still happens at publish time, and the AgentReady
  name space is crowded, so expect look-alike listings in search results.

## Categories (planned listing)

Utilities (primary). Pricing plan: Free. Support: GitHub issues on this repo.

## License

MIT — see LICENSE (matching the scanner repo).
