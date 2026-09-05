#!/usr/bin/env python3
"""Regression tests for skill discovery and resource validation (stdlib only)."""

import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "agent_skills", Path(__file__).with_name("validate-agent-skills.py"))
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


def skill(name: str = "sample", description: str = "Use for a focused task.") -> str:
    return f"---\nname: {name}\ndescription: {description}\n---\n\n# Task\n\nComplete the requested task.\n"


class SkillValidationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        for name in validator.WORKFLOW_NAMES:
            self.put(f"home/.agents/skills/{name}/SKILL.md", skill(name))
        self.entry = self.put("home/skills/sample/SKILL.md", skill())
        self.put("pi/skills/pi-sample/SKILL.md", skill("pi-sample"))
        self.put("home/.agents/AGENTS.md", "# Global rules\n")
        self.put("AGENTS.md", "# Repository rules\n")

    def put(self, relative, content):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def test_valid_inventory(self):
        self.assertEqual(validator.validate(self.root), [])

    def test_invalid_manifests(self):
        cases = {
            "start": skill().removeprefix("---\n"),
            "closing": skill().replace("\n---\n", "\n", 1),
            "duplicate": skill().replace("name: sample", "name: sample\nname: sample"),
            "empty-description": skill(description=""),
            "folded-description": skill(description=">\n  use this"),
            "yaml-comment": skill(description="description # not all of the string"),
            "yaml-mapping": skill(description="Use for: tasks"),
            "wrong-name": skill("different"),
            "invalid-name": skill("sample--name"),
            "long-name": skill("a" * 65),
            "long-description": skill(description="测" * 1025),
            "empty-body": "---\nname: sample\ndescription: Test\n---\n",
            "large-entry": skill() + "x" * validator.ENTRY_LIMIT,
        }
        for case, text in cases.items():
            with self.subTest(case=case):
                self.entry.write_text(text, encoding="utf-8")
                self.assertTrue(validator.manifest_errors(self.entry))

    def test_unicode_description_uses_characters(self):
        self.entry.write_text(skill(description="测" * 1024), encoding="utf-8")
        self.assertEqual(validator.manifest_errors(self.entry), [])

    def test_pi_manifest_is_checked(self):
        self.put("pi/skills/pi-sample/SKILL.md", skill("wrong-name"))
        self.assertTrue(any("pi/skills/pi-sample/SKILL.md" in e for e in validator.validate(self.root)))

    def test_missing_script(self):
        self.entry.write_text(skill() + "Use `scripts/missing.py`.\n", encoding="utf-8")
        self.assertTrue(any("missing or escaping resource" in e for e in validator.validate(self.root)))

    def test_orphan_reference(self):
        self.put("home/skills/sample/references/unused.md", "# Unused\n")
        self.assertTrue(any("not discoverable" in e for e in validator.validate(self.root)))

    def test_reference_links_are_checked(self):
        self.entry.write_text(skill() + "[Guide](references/guide.md)\n", encoding="utf-8")
        self.put("home/skills/sample/references/guide.md", "[Missing](missing.md)\n")
        self.assertTrue(any("missing local link target" in e for e in validator.validate(self.root)))

    def test_external_and_anchor_links_are_not_fetched(self):
        self.entry.write_text(skill() + "[Source](https://example.com/missing.md) [Topic](#topic)\n", encoding="utf-8")
        self.assertEqual(validator.validate(self.root), [])

    def test_encoded_local_link(self):
        self.put("home/skills/sample/assets/test file.txt", "example")
        self.entry.write_text(skill() + "[File](assets/test%20file.txt)\n", encoding="utf-8")
        self.assertEqual(validator.validate(self.root), [])

    def test_escaping_link(self):
        self.entry.write_text(skill() + "[Outside](../../../../outside.md)\n", encoding="utf-8")
        self.assertTrue(any("escapes" in e for e in validator.validate(self.root)))

    def test_duplicate_between_roots(self):
        self.put("home/skills/ship/SKILL.md", skill("ship"))
        self.assertTrue(any("duplicate skill name" in e for e in validator.validate(self.root)))

    def test_missing_manifest(self):
        self.entry.unlink()
        self.assertTrue(any("missing manifest" in e for e in validator.validate(self.root)))

    def test_missing_workflow(self):
        missing = self.root / "home/.agents/skills/ship/SKILL.md"
        missing.unlink()
        missing.parent.rmdir()
        self.assertTrue(any("workflow inventory mismatch" in e for e in validator.validate(self.root)))

    def test_global_budget_and_link(self):
        self.put("home/.agents/AGENTS.md", "[Guide](references/missing.md)\n" + "测" * 1400)
        errors = validator.validate(self.root)
        self.assertTrue(any("global AGENTS.md exceeds" in e for e in errors))
        self.assertTrue(any("missing local link target" in e for e in errors))


class ValidationGroupTests(unittest.TestCase):
    def setUp(self):
        import shutil
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.groups = ("shell", "installer", "toolchain", "integrations", "agents")
        directory = self.root / "tests/validate"
        directory.mkdir(parents=True)
        shutil.copyfile(Path(__file__).with_name("validate.sh"), self.root / "tests/validate.sh")
        for group in self.groups:
            (directory / f"{group}.sh").write_text(f'check "{group}" "true"\n', encoding="utf-8")

    def run_groups(self, *groups):
        import subprocess
        return subprocess.run(["bash", "tests/validate.sh", *groups], cwd=self.root,
                              text=True, capture_output=True, timeout=5)

    def test_default_runs_all_groups(self):
        result = self.run_groups()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Passed: 5", result.stdout)
        positions = [result.stdout.index(f"Checking {g}") for g in self.groups]
        self.assertEqual(positions, sorted(positions))

    def test_selects_only_requested_groups(self):
        result = self.run_groups("agents")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Passed: 1", result.stdout)
        self.assertNotIn("Checking shell", result.stdout)

    def test_invalid_groups_rejected_before_any_check(self):
        for invalid in ("unknown", "../../bootstrap", ""):
            with self.subTest(group=invalid):
                result = self.run_groups("agents", invalid)
                self.assertEqual(result.returncode, 2)
                self.assertNotIn("Checking ", result.stdout)
                self.assertIn("Unknown validation group", result.stderr)

    def test_selected_failure_is_not_hidden(self):
        (self.root / "tests/validate/agents.sh").write_text('check "failure" "false"\n', encoding="utf-8")
        result = self.run_groups("agents")
        self.assertEqual(result.returncode, 1)
        self.assertIn("Failed: 1", result.stdout)


if __name__ == "__main__":
    unittest.main()
