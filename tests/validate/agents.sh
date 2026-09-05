check "project skills resolve through the root .agents symlink" \
    "test -L .agents && [[ \$(readlink .agents) == home/.agents ]]"
check "all skill roots have valid discovery metadata and resource links" \
    "python3 -B tests/validate-agent-skills.py"
check "skill validator rejects malformed entries and broken resources" \
    "python3 -B tests/test-agent-skills.py"
check "show-me preserves its upstream MIT license" \
    "test -f .agents/skills/show-me/LICENSE && grep -Fq 'Copyright (c) 2026 HumanLayer' .agents/skills/show-me/LICENSE"
