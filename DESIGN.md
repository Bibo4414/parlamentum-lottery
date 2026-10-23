---
name: Parlamentum Lottery
description: "The game's own night navy and gold, in dense panels, for two raffles whose every draw can be checked."
colors:
  gold: "#e3b341"
  gold-lit: "#f0c75a"
  gold-bright: "#f6d374"
  gold-deep: "#c9971c"
  gold-warm: "#d6a42a"
  gold-ink: "#161006"
  gold-wash: "rgba(227, 179, 65, 0.14)"
  gold-select: "rgba(227, 179, 65, 0.35)"
  credit: "#4ade80"
  credit-wash: "rgba(74, 222, 128, 0.12)"
  credit-edge: "rgba(74, 222, 128, 0.35)"
  danger: "#f87171"
  danger-wash: "rgba(248, 113, 113, 0.12)"
  danger-edge: "rgba(248, 113, 113, 0.4)"
  waiting: "#fbbf24"
  waiting-wash: "rgba(251, 191, 36, 0.12)"
  waiting-edge: "rgba(251, 191, 36, 0.35)"
  rail: "#060a12"
  ground: "#070b14"
  surface: "#0a101c"
  surface-2: "#0f1828"
  surface-3: "#16213a"
  scrollbar: "#26324a"
  line: "rgba(201, 151, 28, 0.25)"
  line-focal: "rgba(227, 179, 65, 0.4)"
  line-strong: "rgba(227, 179, 65, 0.55)"
  line-soft: "rgba(148, 163, 184, 0.14)"
  control-edge: "#2a3550"
  field-edge: "#5b6884"
  field-edge-hover: "#7a89a6"
  text: "#e2e8f0"
  text-muted: "#94a3b8"
  text-faint: "#7f8da3"
  toast: "#f1f5f9"
  toast-ink: "#0b1220"
  toast-error: "#fee2e2"
  toast-error-ink: "#7f1d1d"
typography:
  pool:
    fontFamily: "Oswald, 'Arial Narrow', sans-serif"
    fontSize: "4rem"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.01em"
    fontFeature: '"tnum"'
  balance:
    fontFamily: "Oswald, 'Arial Narrow', sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: '"tnum"'
  page-title:
    fontFamily: "Oswald, 'Arial Narrow', sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0.05em"
  figure:
    fontFamily: "Oswald, 'Arial Narrow', sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    fontFeature: '"tnum"'
  figure-small:
    fontFamily: "Oswald, 'Arial Narrow', sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
  panel-heading:
    fontFamily: "Oswald, 'Arial Narrow', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.12em"
  label:
    fontFamily: "Oswald, 'Arial Narrow', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.12em"
  stamp:
    fontFamily: "Oswald, 'Arial Narrow', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.08em"
  numeral:
    fontFamily: "Oswald, 'Arial Narrow', sans-serif"
    letterSpacing: "0.01em"
    fontFeature: '"tnum"'
  body:
    fontFamily: "Barlow, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0.005em"
    fontFeature: '"tnum"'
  body-small:
    fontFamily: "Barlow, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  button:
    fontFamily: "Barlow, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.01em"
  mono:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "0.86em"
rounded:
  stamp: "4px"
  stub: "6px"
  control: "8px"
  card: "12px"
  pill: "999px"
spacing:
  s1: "0.25rem"
  s2: "0.5rem"
  s3: "0.75rem"
  s4: "1rem"
  s5: "1.25rem"
  s6: "1.5rem"
  s8: "2rem"
  s14: "3.5rem"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.gold-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 1.25rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.gold-lit}"
    textColor: "{colors.gold-ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 1.25rem"
    height: "2.75rem"
  button-ghost-hover:
    backgroundColor: "{colors.gold-wash}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 1.25rem"
    height: "2.75rem"
  button-danger-hover:
    backgroundColor: "{colors.danger-wash}"
  button-small:
    padding: "0 0.75rem"
    height: "2.75rem"
  link-button:
    textColor: "{colors.gold}"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0 0.75rem"
    height: "2.75rem"
  badge-credit:
    backgroundColor: "{colors.credit-wash}"
    textColor: "{colors.credit}"
    typography: "{typography.stamp}"
    rounded: "{rounded.pill}"
    padding: "0.15rem 0.5rem"
  badge-waiting:
    backgroundColor: "{colors.waiting-wash}"
    textColor: "{colors.waiting}"
    typography: "{typography.stamp}"
    rounded: "{rounded.pill}"
    padding: "0.15rem 0.5rem"
  badge-danger:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger}"
    typography: "{typography.stamp}"
    rounded: "{rounded.pill}"
    padding: "0.15rem 0.5rem"
  badge-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    typography: "{typography.stamp}"
    rounded: "{rounded.pill}"
    padding: "0.15rem 0.5rem"
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 0.75rem"
    height: "2.75rem"
  input-number:
    typography: "{typography.figure-small}"
  segmented-option:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.figure-small}"
    padding: "0 0.75rem"
    size: "2.75rem"
  segmented-option-selected:
    backgroundColor: "{colors.gold-wash}"
    textColor: "{colors.gold}"
  tab:
    textColor: "{colors.text-muted}"
    typography: "{typography.panel-heading}"
    padding: "0 1rem"
    height: "2.75rem"
  tab-current:
    textColor: "{colors.gold}"
  nav-link:
    textColor: "{colors.text-muted}"
    typography: "{typography.panel-heading}"
    padding: "0 0.75rem"
    height: "3.75rem"
  nav-link-current:
    textColor: "{colors.text}"
  tab-bar:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.text-muted}"
    height: "4rem"
  tab-bar-current:
    textColor: "{colors.gold}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "1.25rem"
  notice:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    typography: "{typography.body-small}"
    rounded: "{rounded.control}"
    padding: "0.75rem 1rem"
  notice-credit:
    backgroundColor: "{colors.credit-wash}"
  notice-waiting:
    backgroundColor: "{colors.waiting-wash}"
  notice-danger:
    backgroundColor: "{colors.danger-wash}"
  ticket-stub:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.gold}"
    rounded: "{rounded.stub}"
    padding: "0 0.75rem 0 1rem"
    height: "2rem"
  proof-stamp:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    typography: "{typography.stamp}"
    rounded: "{rounded.stamp}"
    padding: "0 0.5rem"
    height: "1.875rem"
  proof-stamp-checked:
    textColor: "{colors.credit}"
  proof-stamp-mismatch:
    textColor: "{colors.danger}"
  proof-stamp-pending:
    textColor: "{colors.text-faint}"
  toast:
    backgroundColor: "{colors.toast}"
    textColor: "{colors.toast-ink}"
    rounded: "{rounded.control}"
    padding: "0.75rem 1rem"
  toast-error:
    backgroundColor: "{colors.toast-error}"
    textColor: "{colors.toast-error-ink}"
---

# Design System: Parlamentum Lottery

## Overview

**Creative North Star: "The Sealed Ledger"**

The lottery is a ledger kept inside Parlamentum's own interface. It wears the game's night-navy ground, panels drawn with the game's gold hairline, its uppercase Oswald labels and Oswald figures, with Barlow for anything a player reads at length. A player opens it between turns and reads it like an account: how big each pool is and when it draws, what they hold, whether they won, where their gold is.

Its signature is the seal. Each pool shows the fingerprint of its sealed draw; each winner row is re-checked in the player's own browser and earns a stamp that lands once and unfolds into what was checked, the fingerprint and the revealed seed. Tickets are drawn as paper stubs. The mechanism is shown in plain view instead of asking for faith.

The density is high and the temperature is low: one grid of panels on every screen, rows split by hairlines rather than boxes, gold kept for what can be counted or acted on, motion only where a state changes. The confirmed rejection is the casino default, a jackpot hero with "Play" buttons that lead to separate pages; nothing on the page pushes a player to play.

**Key Characteristics:**
- Dark only: a night-navy ground climbing through four tonal steps.
- One accent, Parlamentum Gold, with lit, deep, ink and wash partners.
- Oswald for labels and standalone figures, Barlow for reading, tabular figures everywhere.
- Panels on a 12-column grid; one column and a bottom tab bar on phones.
- Hairlines before shadows: one faint ambient lift, and only the toast floats.
- One authored motion: the proof stamp landing.

## Colors

A night-navy ground in tonal steps, one gold accent with its partners, and three state colours that appear only when they mean something.

### Primary
- **Parlamentum Gold** (#e3b341): the game's gold and the only accent. It writes pool figures, ticket numbers, the balance chip's figure, countdowns, text links, the brand, the current tab and the chosen ticket quantity, and it draws the focus outline. It is the primary button's base. 9.8:1 on Panel Navy.
- **Lit Gold** (#f0c75a): gold catching light. The top of the primary button's gradient, the base under its hover gradient, and the hover colour of links and the brand. The hover gradient itself runs from **Bright Gold** (#f6d374) to **Warm Gold** (#d6a42a).
- **Deep Gold** (#c9971c): gold in shade. The bottom of the primary button's gradient, the icons in panel headings and in the seal, and the unit set after a big figure. 7.2:1 on Panel Navy, so it can carry text.
- **Gold Ink** (#161006): text on gold, 9.7:1 on Parlamentum Gold.
- **Gold Wash** (rgba(227, 179, 65, 0.14)): gold as a tint: the chosen quantity, ghost-button hover, tab counts, the input focus ring. Selected text takes gold at 35%.

### States
- **Credit Green** (#4ade80) on **Credit Wash** (rgba(74, 222, 128, 0.12)): gold coming in and success: sales open, a deposit credited, a draw that checks out, the watcher on.
- **Danger Coral** (#f87171) on **Danger Wash** (rgba(248, 113, 113, 0.12)): errors, a draw that doesn't check out, actions that can't be undone.
- **Waiting Amber** (#fbbf24) on **Waiting Wash** (rgba(251, 191, 36, 0.12)): pending and warnings: a draw that is due, deposits credited by hand, the watcher's warnings.
- Each state also has an edge, its colour at 35% (green, amber) or 40% (coral), for a notice's outline, the danger buttons and the "can't be undone" panel.

### Neutral
- **Night Rail** (#060a12): the top bar and the phone tab bar, laid at 92 to 94% over the page with a 10px blur.
- **Night Navy** (#070b14): the page ground and the browser's theme colour.
- **Panel Navy** (#0a101c): panels and chips.
- **Raised Navy** (#0f1828): what sits on a panel: inputs, notices, ticket stubs, the quantity control.
- **Pressed Navy** (#16213a): a quantity option under the pointer.
- **Gold Hairline** (rgba(201, 151, 28, 0.25)): every panel's edge, the rails' edges, chip and ghost-button edges, the line under tabs and table headers.
- **Focal Gold Line** (rgba(227, 179, 65, 0.4)): the pool panels' edge, and nothing else.
- **Strong Gold Line** (rgba(227, 179, 65, 0.55)): the ticket stub's dashed outline, the rings around step numbers, the ghost button's hover edge.
- **Slate Rule** (rgba(148, 163, 184, 0.14)): rules inside a panel: between rows and table rows, above the buy area, around a notice.
- **Field Edge** (#5b6884): the resting edge of a field, 3.4:1 against Panel Navy so a field can be found by its outline alone (WCAG 2.2 asks 3:1); **#7a89a6** under the pointer.
- **Control Edge** (#2a3550): quiet edges that identify nothing on their own: quiet badges and the quiet proof states.
- **Mist White** (#e2e8f0): text, 15.4:1 on Panel Navy.
- **Muted Slate** (#94a3b8): secondary text, labels, panel headings, inactive navigation; 7.4:1 on Panel Navy.
- **Faint Slate** (#7f8da3): placeholders, a proof still checking, a draw without a seed; 5.3:1 on Raised Navy.

Every one of these is a custom property in `src/styles/tokens.css`; the component styles use no literal colour.

### Named Rules
**The One Gold Rule.** Gold is the only accent, and it is ink, not paint: it writes figures, links, icons and lines. The only solid gold surface is the primary button (and the skip link); hovers and chosen options take the 14% Gold Wash, selected text gold at 35%.

**The Meaning-Only Rule.** Green, coral and amber appear only when they mean credit, error or waiting. They colour a label, a figure, an icon or a thin edge; when a state needs a ground it is that colour's 12% wash, and no panel, button or badge is ever filled solid with it.

**The Night Rule.** The lottery is dark only, like the game. The toast is the one light surface.

## Typography

**Display Font:** Oswald (with Arial Narrow, sans-serif), self-hosted at 500, 600 and 700
**Body Font:** Barlow (with system-ui, -apple-system, Segoe UI, sans-serif), self-hosted at 400 to 700
**Label/Mono Font:** labels are Oswald; fingerprints, seeds and commands use the system monospace stack (ui-monospace, SF Mono, Menlo, Consolas) at 0.86em

**Character:** Oswald is the game's own voice: condensed, uppercase in labels, built for counting. Barlow is a plain, open grotesque that reads well at 14 and 16px. Every number on the page, in either face, sits on tabular figures.

### Hierarchy
- **Pool** (Oswald 700, 4rem / 64px, 3.25rem / 52px on phones; line-height 0.95; -0.01em): the pool in a pool panel, in Parlamentum Gold. The biggest thing on any screen.
- **Balance** (Oswald 700, 2.5rem / 40px, 1): the player's own gold, in Mist White; also the signed-in name on the account page.
- **Page Title** (Oswald 600, 1.75rem / 28px, 1.15, 0.05em, uppercase): one per page (Wallet, Draws, Account, Organizer); the dashboard's title is there for screen readers only.
- **Figure** (Oswald 600, 1.375rem / 22px): the values in a row of facts. Set uppercase at 0.06em in Mist White, the same size names a panel that is one of a pair, such as each raffle in the organizer's view.
- **Figure Small** (Oswald 600, 1.125rem / 18px): quantity options, the balance chip's figure, the House line's values, and, in Deep Gold, the unit after a pool figure (uppercase, 0.06em) or a balance. Number inputs set their digits at this size in weight 500.
- **Panel Heading** (Oswald 600, 0.875rem / 14px, 1.3, 0.12em, uppercase, Muted Slate): every panel's heading, with its icon; the same face sets the top bar's links and the in-page tabs.
- **Label** (Oswald 600, 0.75rem / 12px, 1.3, 0.12em, uppercase, Muted Slate): section labels inside a panel, table headers, the names in a row of facts, the names over a fingerprint and a seed, the House line's names.
- **Stamp** (Oswald 600, 0.75rem / 12px, 0.08em, uppercase): badges and proof stamps, in their state colour.
- **Body** (Barlow 400, 1rem / 16px, 1.55, 0.005em): reading text; 16px is the floor for body copy, and page intros hold to 60ch.
- **Body Small** (Barlow 400, 0.875rem / 14px, 1.55): rows, tables, hints, notices, prices, the seal line. Field labels take it at 600 in Mist White.
- **Button** (Barlow 700, 1rem / 16px, 1, 0.01em): button labels; 14px in small buttons.
- **Numeral** (Oswald, tabular, 0.01em): a figure in a row or a table cell, at the size around it.
- **Mono** (system monospace, 0.86em): fingerprints, seeds and commands; a long seed breaks anywhere rather than overflow.

### Named Rules
**The Standalone Figure Rule.** A figure that stands on its own (a pool, a balance, a fact, a ticket number, a gold move, a table amount) is set in Oswald; an amount inside a sentence or a button label stays in the sentence's Barlow. Both sit on tabular figures, so columns line up.

**The Numbers-Lead Rule.** The hierarchy is carried by figures, not headings: the 64px gold pool, the 40px balance and the gold primary button are the loudest things on a screen, while panel headings stay at the game's own 14px uppercase label. The flat step between headings is deliberate.

## Layout

Every screen uses the same grammar: panels on a 12-column grid with 16px gutters, inside a centred column of at most 76rem (1216px), with 24px above, 16px at the sides (or the safe area, if wider) and 56px below. Panels span 4, 5, 6, 7, 8 or 12 columns. Where panels share a row of the dashboard they stretch to one height; elsewhere each keeps its own height and aligns to the top. A page head (its title, and at most one page-wide action) and the page's tabs sit above the grid; everything else is inside a panel.

The top bar is a sticky 60px rail: the brand at the left, the main navigation after it, the balance and account chips at the right.

- **From 75rem (1200px):** the full 12 columns.
- **Below 75rem:** 4-, 5-, 7- and 8-column panels become halves; the wallet panel takes the full row.
- **48rem to 64rem (768 to 1023px):** the top bar compacts: the brand to its mark, the account chip to its icon.
- **Below 48rem (768px):** one column in reading order. The navigation and the account chip leave the top bar for a fixed bottom tab bar (64px plus the safe area), and the page leaves room for it; panels pad 16px; the pool figure drops to 52px; the toast rises above the tab bar.
- **Inside panels** (each panel is a size container): the wallet's body splits into two columns once its panel is 36rem wide; tables marked to stack become two-line cards when their panel is under 34rem, the winners table as ticket and prize over winner and proof.

Spacing runs on a 4px base (4, 8, 12, 16, 20, 24, 32, 56). Inside a panel, groups sit 24px apart and items within a group 12px apart; a panel pads 20px, its heading sits 12px above its content, its footer actions sit 16px below with 8px between them, fields in a form sit 16px apart, and rows take 12px above and below.

### Named Rules
**The Panel Grammar Rule.** Every screen, the organizer's included, is built from panels on the same grid; only the page head and the page's tabs sit outside a panel.

**The No-Nested-Cards Rule.** Inside a panel, lists are rows split by the Slate Rule and groups are split by space; the only tinted box a panel may hold is a notice.

## Elevation & Depth

Depth is tonal and drawn, not lifted. The ground steps up from Night Navy to Panel Navy to Raised Navy and, under a pointer, to Pressed Navy, and every panel is outlined by the Gold Hairline. One ambient shadow gives panels a faint top-edge highlight and a soft fall beneath their lower edge, read as a slight darkening rather than a lift. The rails are translucent Night Rail over a 10px backdrop blur, edged with the hairline. Only the toast floats.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 18px 40px -24px rgba(0, 0, 0, 0.7)`): every panel.
- **Float** (`box-shadow: 0 14px 40px -12px rgba(0, 0, 0, 0.75)`): the toast, and nothing else.
- **Focus ring** (`box-shadow: 0 0 0 3px rgba(227, 179, 65, 0.14)`): a focused input, around its gold edge; Danger Wash instead while the input is invalid.
- **Chosen quantity** (`box-shadow: inset 0 -2px 0 #e3b341`): the gold underline inside the selected quantity option.

Everywhere else, focus is a 2px Parlamentum Gold outline drawn 2px outside the element; inside the quantity control, which clips what lies outside it, the outline is drawn 3px inside each option.

### Named Rules
**The Hairline-First Rule.** A panel separates from the ground by tone and the Gold Hairline, never by a heavier frame or a deeper shadow. Only the pool panels take the Focal Gold Line.

## Shapes

Corners step down with size: panels at 12px; controls at 8px (buttons, inputs, the quantity control, notices, the toast, the skip link); ticket stubs at 6px; proof stamps at 4px, the corner a focus outline takes on a bare link or tab. Anything that is a tag (chips, badges, tab counts) is a full pill, and status dots and step numbers are circles. Lines are 1px everywhere; stamps and the brand mark draw at 1.5px; the current place is underlined at 2px. The brand mark is a 32px square at the 8px control corner with a 1.5px gold edge around the Lucide landmark, and the favicon repeats it.

Dashed and dotted lines belong to paper. A ticket stub has a 1px dashed Strong Gold Line outline and a 2px dotted perforation in gold at 40%, 5px in from its left edge and 5px short of its top and bottom; a proof stamp that is still checking is dashed in Control Edge. These are drawn conventions of this world, not decoration.

### Named Rules
**The Smaller-Tighter Rule.** The smaller the object, the tighter its corner: 12, 8, 6, 4. A tag is always a full pill.

**The Paper-Line Rule.** Dashed and dotted lines are for tickets and for a proof still being checked; panels and controls are always solid.

## Components

### Buttons
Solid, compact and plainly labelled; the gold one is the action.
- **Shape:** gently rounded (8px), at least 44px tall (2.75rem), 20px side padding; icon and label 8px apart.
- **Primary:** Parlamentum Gold under a vertical gradient from Lit Gold to Deep Gold, with Gold Ink text in Barlow 700. Hover brightens the gradient to run from #f6d374 to #d6a42a.
- **Ghost:** transparent with the Gold Hairline edge and Mist White text; hover fills it with Gold Wash and the Strong Gold Line. The secondary action beside a primary (Withdraw beside Deposit) and every quiet action.
- **Danger:** transparent, Danger Coral text and the Danger Edge (coral at 40%); hover takes Danger Wash. For actions that can't be undone or that stop something running; the irreversible ones sit together in their own panel with a coral edge and heading.
- **Small:** 12px side padding and 14px text at the same 44px height, for actions inside rows and forms.
- **States:** a press moves the button 1px down; disabled and busy drop to 50% with a not-allowed cursor, and a busy button shows a turning ring after its label. Background, edge and press move in 150ms on the ease-out curve.
- **Text links:** Parlamentum Gold, underlined 0.2em below the text, Lit Gold on hover. A text link that acts as a button is set at 600 and gets an invisible 44px-tall hit area.

### Chips
- **Style:** full pill, 44px tall, 12px side padding, Panel Navy with the Gold Hairline edge, Barlow 600 at 14px in Mist White, a Lucide icon at the left.
- **Use:** the top bar's balance chip, whose figure is Parlamentum Gold in Figure Small, and the account chip.

### Badges
- **Style:** full pill (0.15rem 0.5rem padding), Stamp type, a 1px edge in the badge's own colour over that colour's wash.
- **Tones:** Credit (sales open, credited, the player's own "You" on a winner row), Waiting (draw due, waiting), Danger (a failing watcher, balances off the ledger), Quiet (Muted Slate on the Control Edge with no wash: sales closed, not a deposit).
- **Tab counts:** a smaller pill of Gold Wash with a gold figure beside a tab's name; Danger Wash with a warning icon when something needs the organizer.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Panel Navy.
- **Shadow Strategy:** the Card shadow (see Elevation & Depth).
- **Border:** 1px Gold Hairline; the pool panels take the Focal Gold Line; the "can't be undone" panel takes the Danger Edge.
- **Internal Padding:** 20px, 16px on phones.
- **Head:** the heading in Panel Heading type with a Lucide icon in Deep Gold, 8px apart; the right end holds a badge, a status dot or a text link. A panel that is one of a pair takes its name as the title instead: Figure size, uppercase at 0.06em, Mist White, with a gold icon.
- **Foot:** actions 16px below the content, 8px apart, wrapping.
- **Notices:** the one box a panel may hold: Raised Navy, an 8px corner, a Slate Rule edge, 12px by 16px padding, 14px text after a gold icon aligned to the first line. In a state a notice takes that state's wash, an edge in its colour at 35 to 40%, and its colour on the icon.

### Inputs / Fields
- **Style:** 44px tall, 8px corner, Raised Navy with a 1px Field Edge, 12px side padding, Barlow 500 at 16px in Mist White, a gold caret, placeholders in Faint Slate. Number fields set their digits in Oswald at 18px with 0.02em.
- **Field:** a visible label above (Barlow 600, 14px, Mist White), 8px gap, the input, then a hint in Muted Slate at 14px. Optional fields wait behind a gold disclosure line with a plus icon.
- **Focus:** no outline; the edge turns Parlamentum Gold inside the 3px Gold Wash ring. Hover lightens the resting edge to #7a89a6.
- **Error / Disabled:** an invalid field takes a coral edge (and a Danger Wash ring on focus), and its message sits directly under it in Danger Coral, Barlow 600 at 14px, after a circle-x icon; a failure that belongs to no field sits at the end of the form, by the button that failed. Disabled fields drop to 55%.

### Quantity Control
- **Style:** 1, 2, 3, 5 or 10 tickets as one segmented group: Raised Navy inside a Gold Hairline frame at an 8px corner, each option at least 44px square and split from the next by a hairline, its figure in Figure Small.
- **State:** hover takes Pressed Navy; the chosen option takes Gold Wash, a gold figure and a 2px gold underline drawn inside it.
- **Placement:** it sits in the buy row beside the primary button, which grows to fill the row (from 12rem) and carries the full cost in its label.

### Navigation
- **Top bar:** sticky, 60px, Night Rail at 92% over a 10px blur, a Gold Hairline beneath. The brand is Parlamentum Gold Oswald 700 at 16px, uppercase at 0.12em, after its mark; hover lifts it to Lit Gold. Links are Panel Heading type in Muted Slate, Mist White on hover; the current page is Mist White over a 2px gold underline along the bar's bottom edge. Signed out, a small primary "Sign in" button takes the chips' place.
- **Tab bar (phones):** fixed to the bottom, 64px plus the safe area, Night Rail at 94% over the blur, a Gold Hairline above; equal columns, each a 22px icon over an 11px Oswald 600 label, uppercase at 0.08em, in Muted Slate; the current one is Parlamentum Gold. It carries Dashboard, Wallet, Draws, Organizer (for the organizer) and Account.
- **In-page tabs** (the wallet, the organizer, signing in): Panel Heading type in Muted Slate, 44px tall with 16px sides, standing on a Gold Hairline; hover turns them Mist White, and the current tab turns gold over a 2px gold underline.
- **Skip link:** Parlamentum Gold with Gold Ink text at an 8px corner; it drops into view at the top when focused.

### Pool Panel
The system's loudest object: one raffle's pool, its draw and the place to buy.
- **Frame:** a panel with the Focal Gold Line; its head carries the raffle's name with a ticket icon, and a sales badge.
- **Figure:** the pool in Pool type and Parlamentum Gold, followed by "gold in the pool" in Figure Small, Deep Gold, uppercase at 0.06em; a Muted Slate note under it says how the pool is made.
- **Draw line:** a gold clock icon, the draw time in UTC at 600, and the live countdown in gold Oswald.
- **Seal:** a Deep Gold shield-check icon, "Sealed draw" in Muted Slate, the fingerprint's first 12 characters in Mono and Mist White (the full value in its title), and a link to how it is checked.
- **Buy area:** at the panel's foot, above a Slate Rule: the price with its fee, then the quantity control and the primary button.

### Ticket Stubs
A ticket is drawn as the stub a player keeps.
- **Style:** Raised Navy, 32px tall, a 6px corner, a 1px dashed Strong Gold Line outline and a dotted perforation (2px, gold at 40%) 5px inside the left edge; the number ("#7") in Oswald 600 at 16px, Parlamentum Gold, with 16px before it and 12px after.
- **Layout:** stubs wrap 8px apart, grouped per raffle beside the raffle's name in a 72px column (Oswald 600, 16px, uppercase at 0.06em), each group split from the next by the Slate Rule.

### Proof Stamp
The signature: each finished draw proves itself in the player's browser.
- **Stamp:** 30px tall, a 4px corner, a 1.5px edge in its own colour, no fill, Stamp type with a 16px icon, inside a 44px hit area. Checked is Credit Green with a circle-check; doesn't check out is Danger Coral with a circle-x; no seed is Faint Slate on the Control Edge; still checking is Faint Slate, dashed and inert; a failed check offers "Check again" in Muted Slate. Hover takes Raised Navy.
- **Landing:** when a check finishes, the stamp lands once: from 1.4 times its size and -8° to rest in 360ms on the ease-out curve, fully opaque by 60% of the way. Under reduced motion it fades in over 150ms.
- **Unfolding:** a chevron in the stamp turns 180° (150ms) as it opens a row beneath the winner: each check with a green or coral circle icon, then the fingerprint shown before the draw and the seed revealed at it, each under a Label and set in Mono, and a link to copy the seed.

### Rows, Tables and Facts
- **Rows:** lists split by the Slate Rule, 12px above and below each row, 14px text, the name at the left and the figure at the right on one baseline. A player's gold moves are signed: gold in is Credit Green with a plus, gold out is Mist White with a true minus (−).
- **Tables:** 14px text; headers in Label type over a Gold Hairline; rows split by the Slate Rule; figures right-aligned in Numeral type, their units after them in 12px uppercase Muted Slate.
- **Facts:** a wrapping row of name and value pairs, each at least 6.5rem wide: names in Label type, values in Figure type; gold owed to players and gold in a pool are Parlamentum Gold.
- **Steps:** numbered how-tos: the number in gold Oswald 600 at 16px inside a 32px circle with a Strong Gold Line ring, a bold line, then a 14px Muted Slate explanation.
- **Status dot:** an 8px dot before a 14px line, Credit Green when deposits credit themselves, Waiting Amber when the organizer credits them.

### Toast
- **Style:** one message at a time, centred near the bottom (above the tab bar on phones), at most 34rem wide: Toast (#f1f5f9) with Toast Ink (#0b1220) text at 600, an 8px corner, 12px by 16px padding, the Float shadow.
- **Behaviour:** it rises 1rem into place and fades in over 220ms; an error turns it #fee2e2 with #7f1d1d text and keeps it for 6 seconds instead of 3.5.

### Icons
- **Style:** Lucide, drawn inline at one stroke weight (1.75), 1.15em square beside their text and set 0.2em down to sit on its line; hidden from screen readers unless an icon is the only label.
- **Colour:** Deep Gold in panel headings and the seal, Parlamentum Gold where an icon leads a line (the draw time, a notice), the state's colour in a state.

### Named Rules
**The Earned Stamp Rule.** A proof stamp is earned, not printed: it reads "Checking…" until this browser has redone the draw, lands once when the check finishes, and is the system's one authored motion.

## Do's and Don'ts

### Do:
- **Do** build every new screen from panels on the 12-column grid: Panel Navy, the Gold Hairline, a 12px corner, the Card shadow.
- **Do** set standalone figures in Oswald on tabular figures, with the unit after them in Deep Gold or Muted Slate.
- **Do** keep every interactive target at least 44px (2.75rem) tall; text links and stamps get an enlarged hit area.
- **Do** show a state with its colour on the label, the icon or a 1px edge, and its 12% wash when it needs a ground.
- **Do** put the full cost where the click is: the price and its fee above the buy row, the total on the button.
- **Do** name every field with a visible label above it, and put its error directly beneath it.
- **Do** draw icons with Lucide, inline, at stroke 1.75 and 1.15em.
- **Do** collapse to one column below 48rem (768px) and move navigation into the bottom tab bar.

### Don't:
- **Don't** borrow the casino default: no jackpot hero and no "Play" buttons that lead to other pages; a pool is a panel like the rest, bought in place.
- **Don't** show players ticket counts, player counts or chances; those figures belong to the organizer's view.
- **Don't** add a second accent hue, or a solid gold surface other than the primary button.
- **Don't** put a box inside a panel other than a notice; split rows with the Slate Rule and groups with space.
- **Don't** mark a state with a coloured side stripe on a panel, notice or row.
- **Don't** set a small label above a heading as a kicker; a label names a value or is itself the panel's heading.
- **Don't** use characters or emoji as icons.
- **Don't** animate anything but a change of state; the proof stamp landing is the one authored moment.
- **Don't** add a light theme or light panels; the toast is the only light surface.
