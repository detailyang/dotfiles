function validate_agent_skills() {
    local skill_dir
    local skill_file
    local skill_name
    local closing_line
    local name_count
    local description_count
    local declared_name
    local description
    local actual_names
    local expected_names
    local seen_names=" "
    local reference
    local reference_path
    local obsolete

    expected_names="grill herdr improve ship show-me to-goal to-issue to-spec zoom-out"
    actual_names=""

    for skill_dir in .agents/skills/*; do
        [[ -d "$skill_dir" ]] || continue

        skill_name="${skill_dir##*/}"
        skill_file="$skill_dir/SKILL.md"
        [[ -f "$skill_file" ]] || {
            echo "missing $skill_file" >&2
            return 1
        }

        [[ "$(sed -n '1p' "$skill_file")" == "---" ]] || {
            echo "$skill_file must start with YAML frontmatter" >&2
            return 1
        }

        closing_line="$(awk 'NR > 1 && $0 == "---" { print NR; exit }' "$skill_file")"
        [[ -n "$closing_line" ]] || {
            echo "$skill_file has no closing frontmatter delimiter" >&2
            return 1
        }

        name_count="$(sed -n "2,$((closing_line - 1))p" "$skill_file" | grep -c '^name:[[:space:]]*' || true)"
        description_count="$(sed -n "2,$((closing_line - 1))p" "$skill_file" | grep -c '^description:[[:space:]]*' || true)"
        [[ "$name_count" == "1" && "$description_count" == "1" ]] || {
            echo "$skill_file must define exactly one name and description" >&2
            return 1
        }

        declared_name="$(sed -n "2,$((closing_line - 1))p" "$skill_file" | sed -n 's/^name:[[:space:]]*//p')"
        description="$(sed -n "2,$((closing_line - 1))p" "$skill_file" | sed -n 's/^description:[[:space:]]*//p')"

        [[ "$declared_name" == "$skill_name" ]] || {
            echo "$skill_file declares name '$declared_name', expected '$skill_name'" >&2
            return 1
        }
        [[ "$declared_name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || {
            echo "$skill_file has an invalid skill name: $declared_name" >&2
            return 1
        }
        [[ -n "$(printf '%s' "$description" | tr -d '[:space:]')" ]] || {
            echo "$skill_file has an empty description" >&2
            return 1
        }
        awk -v start="$((closing_line + 1))" \
            'NR >= start && /[^[:space:]]/ { found = 1; exit } END { exit !found }' \
            "$skill_file" || {
            echo "$skill_file has an empty body" >&2
            return 1
        }

        case "$seen_names" in
            *" $declared_name "*)
                echo "duplicate skill name: $declared_name" >&2
                return 1
                ;;
        esac
        seen_names="${seen_names}${declared_name} "
        actual_names="${actual_names}${skill_name}"$'\n'

        if [[ -d "$skill_dir/references" ]]; then
            for reference in "$skill_dir"/references/*.md; do
                [[ -e "$reference" ]] || continue
                reference_path="references/${reference##*/}"
                grep -Fq "$reference_path" "$skill_file" || {
                    echo "$skill_file does not mention $reference_path" >&2
                    return 1
                }
            done
        fi
    done

    actual_names="$(printf '%s' "$actual_names" | LC_ALL=C sort | paste -sd ' ' -)"
    [[ "$actual_names" == "$expected_names" ]] || {
        echo "unexpected skill inventory: $actual_names" >&2
        return 1
    }

    for obsolete in code-review debug learn prototype smell think to-prd to-issues; do
        [[ ! -e ".agents/skills/$obsolete" ]] || {
            echo "obsolete skill still present: $obsolete" >&2
            return 1
        }
    done
}

check "project skills resolve through the root .agents symlink" \
    "test -L .agents && [[ \$(readlink .agents) == home/.agents ]]"
check "agent skills have valid manifests, references, and inventory" \
    "validate_agent_skills"

check "show-me preserves its upstream MIT license" \
    "test -f .agents/skills/show-me/LICENSE && grep -Fq 'Copyright (c) 2026 HumanLayer' .agents/skills/show-me/LICENSE"
