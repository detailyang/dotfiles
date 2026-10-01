# Pi Package

This context describes a personal Pi package that adds commands, agent skills, prompt templates, themes, and terminal workflows to the Pi coding agent.

## Language

**Pi package**:
A distributable package that contributes extensions, skills, prompts, and themes to Pi.
_Avoid_: dotfiles package, plugin bundle

**Extension**:
A TypeScript module loaded by Pi to register commands, tools, shortcuts, message renderers, or session lifecycle behavior.
_Avoid_: plugin, command file

**Skill**:
An executable instruction module that teaches an agent a specialized workflow and may reference supporting instruction files.
_Avoid_: guide, markdown command

**Prompt**:
A reusable slash-command template written in Markdown that asks the agent to perform a focused workflow.
_Avoid_: snippet, canned message

**Side-thread**:
A separate conversation flow that can use main-session context without becoming part of the main working turn unless explicitly injected.
_Avoid_: aside, subchat

**Transcript**:
The normalized conversation record used by extensions when they extract user messages, assistant messages, tool calls, tool results, and streamed agent events.
_Avoid_: message dump, conversation text

**Review target**:
The code or plan scope selected for `/review`, such as uncommitted changes, a base branch, a commit, a pull request, or a folder snapshot.
_Avoid_: review mode, diff source

**Isolated agent run**:
A child agent execution kept out of the main session context, usually used to run a review, commit helper, summary, or side-thread response.
_Avoid_: subprocess, background agent

**Context cache graph**:
The `/context` view that renders cache-hit metrics for assistant messages in the current session.
_Avoid_: token graph, cache chart
