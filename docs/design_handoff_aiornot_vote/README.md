# Handoff: AIorNot.vote — Voting Interface

## Overview
AIorNot.vote is a "Hot or Not"-style game for the AI era: each round shows two photos side by side (A vs B), and the player votes **AI** or **NOT AI** on each. After voting, the truth is revealed with a correct/wrong verdict and a community-vote percentage. Header tracks round, score, and streak.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing intended look and behavior, **not production code to copy directly**. Your task is to recreate this design in your target codebase (React/Next.js as requested) using its established patterns and libraries. Suggested stack: Next.js App Router + Tailwind (or CSS modules) + a small client component for game state.

- `AIorNot Vote.dc.html` — the full prototype (markup, inline styles, and a `Component` logic class with the complete game-state logic — port this class to a React hook/component).
- `image-slot.js` — a drag-and-drop image placeholder used only for prototyping; in production, images come from your backend/CDN.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and interactions are final. Recreate pixel-perfectly.

## Screens / Views

### Voting Arena (single page)
- **Page background**: `#08080C` with two subtle radial glows: `radial-gradient(ellipse 60% 40% at 20% -10%, rgba(255,61,138,0.10), transparent)` and `radial-gradient(ellipse 60% 40% at 85% 110%, rgba(61,255,168,0.07), transparent)`. Text color `#EDEDF2`. Full viewport height, flex column.

- **Header** (flex, space-between, padding `22px 36px`, bottom border `1px solid #17171F`):
  - Wordmark: "AI" (Unbounded 900, 20px, `#EDEDF2`) + "or" (Unbounded 500, 20px, `#4A4A58`) + "NOT" (Unbounded 900, 20px, `#FF3D8A`) + ".vote" (13px, `#4A4A58`).
  - Right stats (13px uppercase, letter-spacing 0.14em, labels `#5C5C6E`): Round (value `#EDEDF2`), Score (value `#3DFFA8`), Streak (value `#FF3D8A`) — values in Unbounded 700, 15px, zero-padded (`01`, `02`).

- **Prompt** (centered, padding `36px 24px 8px`):
  - H1 "Which one is human?" — Unbounded 700, `clamp(22px, 3vw, 34px)`, letter-spacing −0.5px.
  - Subline "Call it on each photo. No takebacks." — 15px, `#5C5C6E`.

- **Arena** (CSS grid `1fr auto 1fr`, gap 28px, max-width 1180px, centered, padding `28px 36px 20px`):
  - **Photo card** (×2): aspect-ratio 4/5, border-radius 18px, border `1px solid #1E1E2A`, background `#101018`, overflow hidden. Corner label "A"/"B" top-left 14px: dark pill `rgba(8,8,12,0.75)` + blur(6px), border `#2A2A38`, radius 8px, padding `5px 10px`, Unbounded 700 12px `#8A8A9C`.
  - **Reveal overlay** (shown after vote): absolute inset 0, `rgba(8,8,12,0.72)` + blur(3px), centered column, gap 12px, pointer-events none.
    - Truth label: "AI" (`#FF3D8A`) or "NOT AI" (`#3DFFA8`) — Unbounded 900, 34px.
    - Verdict: "You called it" (`#3DFFA8`) or "Fooled you" (`#FF7A5C`) — 14px, 600, uppercase, letter-spacing 0.12em.
    - Community bar: 60% width, 6px track `#22222E` radius 3px, fill `#FF3D8A`; caption "{pct}% of voters said AI" — 12px `#8A8A9C`.
  - **Vote buttons** (2-col grid under each card, gap 12px): Unbounded 700 15px, padding `16px 0`, radius 12px.
    - Idle: bg `#101018`, text `#EDEDF2`, border `#2A2A38`. Hover: border+text `#FF3D8A` (AI) / `#3DFFA8` (NOT AI).
    - Picked: solid accent bg (`#FF3D8A` or `#3DFFA8`), text `#08080C`.
    - Unpicked-after-vote: bg `#0C0C12`, text `#3A3A48`, border `#17171F`; disabled.
  - **VS divider** (center column): vertical 1px gradient lines (`#17171F`→`#2A2A38`) above/below "VS" — Unbounded 900, 18px, `#4A4A58`.

- **Footer** (centered, min-height 96px, padding-bottom 32px):
  - Before any vote: "Trust your eyes" — 13px uppercase, letter-spacing 0.14em, `#3A3A48`.
  - After both votes: "NEXT PAIR →" pill button — Unbounded 700 15px, padding `16px 44px`, radius 999px, bg `#EDEDF2`, text `#08080C`; hover bg `#FF3D8A`.

## Interactions & Behavior
- Voting a card locks it (no takebacks), instantly reveals the overlay (a `revealMode: 'after-both'` variant defers reveals until both cards are voted).
- Correct vote: score +1, streak +1. Wrong vote: streak resets to 0.
- When both cards voted → "NEXT PAIR →" appears (popIn animation); clicking resets votes and increments round; new photos load.
- Animations:
  - `popIn`: scale 0.7→1.06→1 with fade, 0.35s ease (reveal overlays, next button).
  - `riseIn`: translateY(10px)→0 with fade, 0.5s ease; right card delayed 0.08s (page load).
- Button hover transitions on border/text color; keep durations ≤150ms.

## State Management
Port the prototype's `Component` class (in the .dc.html) to React state:
- `round: number`, `leftVote: boolean|null`, `rightVote: boolean|null` (true = voted AI), `score: number`, `streak: number`.
- In the prototype, ground truth and community % are deterministic pseudo-random functions of round+side — **replace with real data**: fetch a photo pair `{ id, imageUrl, isAI, communityAiPct }` per round from your API; POST votes back.
- Derived: `revealed`, `correct`, `bothVoted`.

## Design Tokens
- **Colors**: bg `#08080C`; panel `#101018`; panel-alt `#0C0C12`; borders `#17171F` / `#1E1E2A` / `#2A2A38`; text `#EDEDF2`; muted `#8A8A9C` / `#5C5C6E`; faint `#4A4A58` / `#3A3A48`; AI accent `#FF3D8A`; human accent `#3DFFA8`; wrong `#FF7A5C`; bar track `#22222E`.
- **Typography**: Display/buttons — **Unbounded** (500/700/900); body — **Space Grotesk** (400–700). Both on Google Fonts.
- **Spacing**: 12 / 16 / 28 / 36px rhythm; arena max-width 1180px.
- **Radii**: cards 18px, buttons 12px, pills 999px, badges 8px.
- **Selection**: `::selection { background:#FF3D8A; color:#08080C; }`. Links: `#FF3D8A`, hover `#3DFFA8`.

## Assets
No image assets shipped — photo slots are user-filled placeholders in the prototype. Production images come from your content pipeline.

## Files
- `AIorNot Vote.dc.html` — full prototype (view in a browser via the design tool; the logic class near the bottom is the game-state reference)
- `image-slot.js` — prototype-only placeholder component (do not port)
