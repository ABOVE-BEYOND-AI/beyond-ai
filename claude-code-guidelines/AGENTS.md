# AGENTS.md - UI Guidelines for AI Coding Agents

This file contains combined UI guidelines from Vercel Web Interface Guidelines, UI Skills, and RAMS. AI coding agents should apply these constraints when generating or reviewing UI code.

---

## Stack Requirements

- Use Tailwind CSS defaults unless custom values already exist
- Use motion/react (formerly framer-motion) for JavaScript animations
- Use tw-animate-css for entrance and micro-animations
- Use cn utility (clsx + tailwind-merge) for class logic

## Component Requirements

- Use accessible component primitives (Base UI, React Aria, Radix) for keyboard/focus behavior
- Use the project's existing component primitives first
- Never mix primitive systems within the same interaction surface
- Add aria-label to icon-only buttons
- Never rebuild keyboard or focus behavior by hand

## Accessibility (Critical)

- All images must have alt text
- Icon-only buttons must have aria-labels
- Form inputs must have labels
- Use semantic elements (button, a, label) not div onClick
- Links must have href
- Every focusable element shows a visible focus ring
- Prefer `:focus-visible` over `:focus`
- Set `:focus-within` for grouped controls

## Accessibility (Serious)

- Never remove focus outline without replacement (use focus-visible:ring-2)
- Include keyboard handlers for interactive elements
- Don't rely on color alone - include text labels
- Touch targets minimum 44×44px (24px visual with expanded hit target)

## Interactions

- Use AlertDialog for destructive or irreversible actions
- Show errors next to where the action happens
- Never block paste in input or textarea
- Use structural skeletons for loading states
- Persist state in URL (filters, tabs, pagination, expanded panels)
- Show loading indicator on buttons, keep original label
- Minimum loading-state duration: 150-300ms delay, 300-500ms visible

## Animation Rules

- Never add animation unless explicitly requested
- Animate only compositor props (transform, opacity)
- Never animate layout properties (width, height, top, left, margin, padding)
- Never exceed 200ms for interaction feedback
- Use ease-out on entrance
- Respect prefers-reduced-motion
- Pause looping animations when off-screen
- Never use `transition: all` - list specific properties
- Never introduce custom easing curves unless requested

## Typography

- Use text-balance for headings
- Use text-pretty for body/paragraphs
- Use tabular-nums for numeric data
- Use truncate or line-clamp for dense UI
- Never modify letter-spacing unless explicitly requested

## Layout

- Never use h-screen, use h-dvh
- Respect safe-area-inset for fixed elements
- Use a fixed z-index scale (no arbitrary z-*)
- Use size-* for square elements instead of w-* + h-*
- Let the browser size things - prefer flex/grid over JS measurement

## Design Rules

- Never use gradients unless explicitly requested
- Never use purple or multicolor gradients
- Never use glow effects as primary affordances
- Use Tailwind CSS default shadow scale unless requested
- Give empty states one clear next action
- Limit accent color usage to one per view
- Use existing theme/color tokens before introducing new ones
- Layered shadows: mimic ambient + direct light with 2+ layers

## Performance

- Never animate large blur() or backdrop-filter surfaces
- Never apply will-change outside an active animation
- Never use useEffect for anything expressible as render logic
- Virtualize large lists (virtua or content-visibility: auto)
- Preload only above-the-fold images, lazy-load the rest
- Set explicit image dimensions to prevent CLS

## Forms

- Enter submits when single text input is focused
- In textarea: ⌘/⌃+Enter submits, Enter inserts newline
- Every control has a label for assistive tech
- Keep submit enabled until submission starts
- Allow any input, show validation feedback (don't block keystrokes)
- Show errors next to their fields; focus first error on submit
- Set autocomplete & meaningful name values

## Color & Contrast

- Minimum contrast ratio: 4.5:1 (prefer APCA over WCAG 2)
- Hover/focus states must have more contrast than rest state
- Handle dark mode consistently
- Set theme-color meta tag to match page background
- Set color-scheme on html for proper scrollbar contrast

---

## Review Checklist

When reviewing UI code, check for:

1. **Critical A11Y**: alt text, aria-labels, form labels, semantic elements, links with href
2. **Focus management**: visible focus rings, keyboard handlers
3. **Touch targets**: minimum 44×44px
4. **Animation**: only transform/opacity, under 200ms, respects reduced-motion
5. **Layout**: no h-screen, safe-area respected, proper z-index scale
6. **Design**: no unauthorized gradients/glows, proper shadows, empty states handled
7. **Performance**: no large blur animations, proper image loading
