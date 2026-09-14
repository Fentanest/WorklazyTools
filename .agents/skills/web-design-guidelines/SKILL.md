---
name: web-design-guidelines
description: Review specified UI code and screens for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review specific files and screens for compliance with Web Interface Guidelines.

## Scope of Application

- Only apply to specified UI code or screens.
- If files or screens are not explicitly specified, try to find the scope from the current instructions or diff. If still not found, leave the target as 'unconfirmed'.
- Do not automatically ask the user for the scope again or expand to a site-wide audit.
- Only review the specified screens. Do not start code modifications or a broad regression test.

## Guidelines Source

Use the saved guidelines located at:
`references/web-interface-guidelines.md`

(Source URL: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md, fetched at 2026-09-10, SHA-256: 3917908714f429cd3355f228506f57b1d1ae2d4173d2496ea41335eee8f8eafd)

Use the saved guidelines above, and only replace/update them upon explicit user request or approved renewal tasks. Do not download the latest guidelines for every review.

## Review Output Format

- Clearly distinguish between observed screen symptoms, code analysis, and suspected causes.
- Provide evidence using file names, line numbers, captures, screen names, or states.
- If a screen was not actively viewed/inspected, mark it as 'unconfirmed'.

## Security and Privacy Guardrails

- General guidelines (such as URL state sharing) must not permit or encourage the external transmission of sensitive filenames, document contents, or passwords.
