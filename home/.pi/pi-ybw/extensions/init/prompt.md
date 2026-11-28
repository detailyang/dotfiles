Refactor my AGENTS.md file to follow progressive disclosure principles. If no AGENTS.md exists, create one that follows those principles instead.

Follow these steps:

1. **Locate the file**: Check the repository root for AGENTS.md. If it exists, refactor it. If it does not exist, gather repository evidence (README, manifests, build and test configuration, CI, and existing conventions) and create it. Do not stop to ask whether to create it.

2. **Find contradictions**: If AGENTS.md exists, identify any instructions that conflict with each other. For each contradiction, ask me which version I want to keep.

3. **Identify the essentials**: Extract only what belongs in the root AGENTS.md:
   - One-sentence project description
   - Package manager (if not npm)
   - Non-standard build/typecheck commands
   - Anything truly relevant to every single task

4. **Group the rest**: Organize remaining instructions into logical categories (e.g., TypeScript conventions, testing patterns, API design, Git workflow). For each group, create a separate markdown file.

5. **Create the file structure**: Output:
   - A minimal root AGENTS.md with markdown links to the separate files
   - Each separate file with its relevant instructions
   - A suggested docs/ folder structure

6. **Flag for deletion**: If AGENTS.md existed, identify any instructions that are:
   - Redundant (the agent already knows this)
   - Too vague to be actionable
   - Overly obvious (like "write clean code")
