# Project Rules

- At the end of every change that is more than 10 lines, you MUST run all tests and report on the results.
- At the end of every change, provide a concise, human-readable summary of what has been addressed.
- When a request involves more than one distinct work item, spawn multiple sub-agents to handle them in parallel.
- **Prisma Changes**: After every Prisma schema or data change, you MUST verify that the changes have been correctly reflected in production.
- **Data Integrity**: It is NEVER acceptable to delete records from production unless explicitly requested by the user.

## Multi-Instance Workflow (Recommendation)
- For concurrent tasks across different Gemini instances, use **git worktree** to prevent filesystem and git-state conflicts.
- Ensure environment variables (like `DATABASE_URL`) are isolated per worktree if running tests or migrations.
