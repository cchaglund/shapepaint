# Description of project

Shapepaint is a daily creative challenge web app where users create constrained artwork using 2 randomly-assigned colors and 2 geometric shapes on a Figma-style canvas editor, with community voting and ELO-based rankings.

# Best Practices
Ask yourself "what's the best way to do this?", NOT "what's the easiest/quickest way to do this?".

Turn off the lights when you leave:
- if you've started a dev server, stop it before you consider yourself finished.
- If you've started an MCP server, stop it before you go (e.g. Chrome dev tools or playwright), killing it if necessary.

Write DRY code - if you find yourself creating the same code multiple times, create a reusable function/component/module instead. If you find code that's essentially duplicated, refactor it into a reusable function/component/module. Having duplicate code is almost always a mistake.

## Supabase - REMOTE ONLY

This project uses the REMOTE Supabase database, NOT local. If you need to interact with the Supabase database, see supabase-info.md for instructions.

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

## Agent Browser/Visual Testing

When testing things using the browser, it often helps to be logged in. Read how in agent-login.md.

## Browser Automation

Use playwright mcp for browser automation tasks. .

## Design Context

See DESIGN.md for design context and guidelines.
