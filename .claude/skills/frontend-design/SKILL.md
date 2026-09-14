---
name: frontend-design
description: Guidance for visual design when building new UI or reshaping an existing one based on user request. Apply only to new screens, new design reviews, or approved design changes.
metadata:
  author: anthropic
  version: "1.0.0"
---

# Frontend Design

Guidance for visual design when building new UI or reshaping an existing one.

## Conditions of Use (Strict)

- Use only for new screens, new design reviews, or approved design changes upon explicit user request.
- Do not automatically redesign existing UI when fixing alignment or bugs.
- Claude remains the coordinator and auditor; Astra handles technical plan review and implementation verification. The assigned implementer (GPT 5.6 Sol or Muse Spark 1.3) handles authorized implementation only.
- Gemini discovering this skill does not grant it product implementation authority.
- Parallel implementers follow the ownership, worktree, shared-token/component, and integration rules in PROJECT_RULES.md; this skill does not allow competing edits to shared design files.
- Prioritize existing themes, design tokens, components, and approved drafts. Do not force new color palettes or fonts.
- Both `!계획!` and `!계획만!` use the plan review and rebuttal procedure in PROJECT_RULES.md. `!계획만!` stops after canonicalizing the plan and leaves implementation pending until a later explicit implementation instruction. An approved design, resumed session, or fork is not that instruction. The normal 1+1 review checkpoint is not a maximum; substantive additional rebuttal rounds remain allowed under the common policy.
- If an approved design already exists, do not repeat the aesthetic planning phase.
- Do not execute unrelated full-screen or full-regression tests under the pretext of design review.

## Design principles

Typography carries the personality of the page. You don't need a different typeface for display or headline text and body content: use one family or two, and if two, make them clearly distinct. Default to line lengths of less than 80 characters.

Visual structure is information. Structural devices like outlines, borders, numbering, eyebrows, dividers, labels, etc., encode useful information about the content rather than decorate it.

Use non-user-triggered motion sparingly and deliberately, only to draw attention. Motion that answers a person's action (opening, expanding, confirming) is welcome when it shows what changed.

Consider written content carefully. Often a design brief may not contain real content, and it's up to you to come up with copy and placeholder content. See the below section on writing for more guidance.

## Process: plan, review against the brief, build, critique

Work in two passes. First, brainstorm a short design plan based on the client's design brief (unless an approved design already exists): create a compact token system with color, type, layout, and principles.
- Color: describe the core base palette as 4–6 named hex values, building upon existing themes if present.
- Type: the typefaces and their roles.
- Layout: a layout concept. Include alignment guidance.
- Principles: the high-level guidance for the design.

Then review that plan against the brief. Follow the mode and implementation authorization in PROJECT_RULES.md. With `!계획만!`, complete the necessary review/rebuttal and canonical plan, report implementation pending, and stop before building. A later explicit implementation instruction may authorize the existing plan without an unnecessary new planning cycle.

When writing the code, be careful of structuring your CSS selector specificities to avoid classes that cancel each other out.

## Restraint and self-critique

Build to a quality floor: responsive down to mobile, visible keyboard focus, reduced motion respected, visually accessible, harmonious color palettes. Critique your own work as you build. Consider Chanel's advice: before leaving the house, take a look in the mirror and remove one accessory.

## More on writing in design

Words appear in a design for one reason: to make it easier to understand and use. They are design content, not decoration. Bring the same intentionality and minimalism to copywriting that you would bring to spacing and color.

Write from the end user's perspective. Name things by what users will understand in simple language, not by how the system is built. A user manages notifications, not webhook config. Describe what something is or does in plain terms rather than selling it. Being specific and legible to new users is always better than being clever.

Use active voice as default. A CTA says exactly what happens when it is used: "Save changes," not "Submit." An action keeps the same name through the whole flow.

Treat failure and emptiness as moments for direction, not mood. Explain what went wrong and how to fix it, in the interface's voice rather than a person's. Errors don't apologize, and they are never vague about what happened. An empty screen is an invitation to act.

Keep the tone conversational: plain verbs, sentence case, no filler, with tone matched to the brand and the audience. Let each written element do exactly one job.
