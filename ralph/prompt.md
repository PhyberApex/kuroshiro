## ISSUES

GitHub issues are provided at start of context. Parse it to get open issues with their bodies and comments.

If ALL tasks are complete, output <promise>NO MORE TASKS</promise>. Do not output this if not all tasks are finished!

## TASK SELECTION

Pick the next task. Only pick github issues with the label: ready-for-agent.

**IMPORTANT: Parse parent PRD from each issue:**
- Look for "## Parent PRD" section in issue body
- Extract the PRD issue number (e.g., "## Parent PRD\n\n#42" → PRD #42)
- This PRD number will be used for branch naming: `auto/prd-<number>`

Prioritize tasks in this order:

1. Critical bugfixes
2. Development infrastructure

Getting development infrastructure like tests and types and dev scripts ready is an important precursor to building features.

3. Tracer bullets for new features

Tracer bullets are small slices of functionality that go through all layers of the system, allowing you to test and validate your approach early. This helps in identifying potential issues and ensures that the overall architecture is sound before investing significant time in development.

TL;DR - build a tiny, end-to-end slice of the feature first, then expand it out.

4. Polish and quick wins
5. Refactors

## BRANCH SETUP

**Check if PRD branch exists:**
- Branch name: `auto/prd-<parent-prd-number>` (NOT `auto/issue-<number>`)
- Run `git branch -r` to check if `origin/auto/prd-<parent-prd-number>` exists

**If branch does NOT exist (first issue from this PRD):**
- Ensure you're on main and up to date: `git checkout main && git pull origin main`
- Create new branch: `git checkout -b auto/prd-<parent-prd-number>`
- Note: You will create the PR after the first commit

**If branch EXISTS (subsequent issue from same PRD):**
- Checkout existing branch: `git checkout auto/prd-<parent-prd-number>`
- Pull latest: `git pull origin auto/prd-<parent-prd-number>`
- Note: You will update the existing PR after committing

## EXPLORATION

Explore the repo to understand:
- Current state of the codebase
- **Check git history on current branch** with `git log` to see what has been done
- If on existing PRD branch: review commits to understand what's already implemented for this PRD

## IMPLEMENTATION

Complete the task.

## FEEDBACK LOOPS

Before committing, run the feedback loops:

- `pnpm run test` to run the tests
- `pnpm run lint` to run the type checker
- `pnpm run typecheck` to run the type checker

## COMMIT

Make a git commit to the `auto/prd-<parent-prd-number>` branch.

The commit message must follow this format:

```
fix: <issue title>

- Key decisions made
- Files changed

Fixes #<issue-number>
```

Then push: `git push origin auto/prd-<parent-prd-number>` (add `-u` flag if first push)

## PULL REQUEST

**If this is the FIRST issue from this PRD (branch was just created):**
- Create a new PR using `gh pr create`:
    - Title: `<parent-prd-title> (Issue #<issue-number>)`
    - Body:
      ```markdown
      Addresses #<parent-prd-number>
  
      ## Completed Issues
      - Fixes #<issue-number>
  
      ## Implementation
      <what was done>
  
      ## Testing
      <test results>
      ```
    - Base: `main`
    - Head: `auto/prd-<parent-prd-number>`

**If this is a SUBSEQUENT issue from the same PRD (branch already existed):**
- Find the existing PR number: `gh pr list --head auto/prd-<parent-prd-number>`
- Update the PR body by appending to the "Completed Issues" section
- You can use `gh pr edit <pr-number>` to update the body, or post a comment summarizing the new changes

## THE ISSUE

**If the task is complete:**
- Close the original GitHub issue with a comment referencing the PR
- Example: "Completed in PR #<pr-number> (commit: <commit-sha>)"

**If the task is not complete:**
- Leave a comment on the GitHub issue with:
    - What was done
    - What remains
    - Link to the PR: "Work in progress: PR #<pr-number>"

## FINAL RULES

- ONLY WORK ON A SINGLE TASK!
- ALWAYS parse parent PRD from issue body before starting
- ALWAYS use branch name `auto/prd-<parent-prd-number>` (NOT `auto/issue-<number>`)
- ALWAYS check if PRD branch exists before creating new PR
- ALWAYS run tests/lint/typecheck before committing
- ALWAYS create or update PR (never push directly to main)