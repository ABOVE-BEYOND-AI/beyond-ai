# /rams - Design Engineer

> Source: https://www.rams.ai/

A design engineer for your coding agent. Reviews for accessibility issues, visual inconsistencies, and UI polish—then offers to fix them. Works with Claude Code, Cursor, OpenCode, Codex, and Antigravity.

## Installation

```bash
curl -fsSL https://rams.ai/install | bash
```

Auto-detects your coding agent.

## Usage

```bash
/rams              # ask which files to review
/rams src/App.tsx  # review specific file
```

---

## Accessibility (WCAG 2.1)

### Critical

- Images without alt text
- Icon-only buttons missing aria-labels
- Form inputs without labels
- Non-semantic click handlers (div onClick)
- Links without href

### Serious

- Focus outline removed without replacement
- Missing keyboard handlers
- Color-only information
- Touch targets under 44×44px

### Moderate

- Skipped heading levels
- Positive tabIndex values
- Role without required attributes

---

## Visual Design

### Layout & Spacing

- Inconsistent spacing values
- Overflow and alignment issues
- Z-index conflicts

### Typography

- Mixed font families and weights
- Line height issues
- Missing font fallbacks

### Color & Contrast

- Contrast ratio below 4.5:1
- Missing hover/focus states
- Dark mode inconsistencies

### Components

- Missing button states
- Missing form field states
- Inconsistent borders and shadows

---

## Output

Each issue includes the line number, code snippet, fix suggestion, and WCAG reference.

### Example Output

```
═══════════════════════════════════════════════════
 RAMS DESIGN REVIEW: app/page.tsx
═══════════════════════════════════════════════════

CRITICAL (2 issues)
───────────────────
[A11Y] Line 24: Button missing accessible name
  <button><CloseIcon /></button>
  Fix: Add aria-label="Close"
  WCAG: 4.1.2

SERIOUS (1 issue)
─────────────────
[A11Y] Line 48: Focus outline removed
  className="outline-none"
  Fix: Add focus-visible:ring-2
  WCAG: 2.4.7

═══════════════════════════════════════════════════
 SUMMARY: 2 critical, 1 serious, 0 moderate
 Score: 68/100
═══════════════════════════════════════════════════
```
