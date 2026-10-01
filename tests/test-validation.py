#!/usr/bin/env python3
"""Exercise the real dispatcher with isolated, deterministic validation groups."""

from pathlib import Path
import os
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
BASH = shutil.which("bash")


@unittest.skipUnless(BASH, "Bash is not installed")
class ValidationTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / "checkout with spaces"
        self.groups = self.root / "tests/validate"
        self.groups.mkdir(parents=True)
        self.dispatcher = self.root / "tests/validate.sh"
        shutil.copyfile(ROOT / "tests/validate.sh", self.dispatcher)

    def run_group(self, script, *groups, cwd=None):
        (self.groups / "shell.sh").write_text(script, encoding="utf-8")
        return subprocess.run(
            [BASH, str(self.dispatcher), *groups],
            cwd=cwd or self.root,
            env={"PATH": os.defpath, "HOME": str(self.root), "LC_ALL": "C"},
            text=True, capture_output=True, timeout=10,
        )

    def test_selected_group_resolves_from_another_working_directory(self):
        result = self.run_group('check "checkout relative path" "test -f tests/validate.sh"\n',
                                "shell", cwd=self.root.parent)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Passed: 1", result.stdout)
        self.assertNotIn("No such file", result.stderr)

    def test_failed_check_keeps_diagnostics_and_runs_remaining_checks(self):
        result = self.run_group('''
check "broken fixture" "printf 'failure detail\\n' >&2; exit 7"
check "remaining fixture" "true"
''', "shell")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("failure detail", result.stdout)
        self.assertIn("exit 7", result.stdout)
        self.assertIn("remaining fixture", result.stdout)
        self.assertIn("Passed: 1", result.stdout)
        self.assertIn("Failed: 1", result.stdout)

    def test_optional_tools_are_counted_as_skipped_not_passed(self):
        result = self.run_group('''
check_if_available dotfiles-nonexistent-test-tool "optional fixture" "exit 9"
check "required fixture" "true"
''', "shell")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Passed: 1", result.stdout)
        self.assertIn("Failed: 0", result.stdout)
        self.assertIn("Skipped: 1", result.stdout)
        self.assertNotIn("All checks passed!", result.stdout)

    def test_invalid_or_missing_groups_fail_before_running_any_checks(self):
        for group in ("../outside", "installer"):
            with self.subTest(group=group):
                result = self.run_group('check "must not run" "true"\n', "shell", group)
                self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
                self.assertNotIn("must not run", result.stdout)

    def test_group_syntax_failure_is_counted_and_other_groups_still_run(self):
        (self.groups / "installer.sh").write_text(
            'check "remaining group" "true"\n', encoding="utf-8")
        result = self.run_group("if then\n", "shell", "installer")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("syntax error", result.stderr)
        self.assertIn("Failed to load validation group: shell", result.stderr)
        self.assertIn("Passed: 1", result.stdout)
        self.assertIn("Failed: 1", result.stdout)

    def test_default_runs_every_group_without_losing_failure_status(self):
        for group in ("installer", "toolchain", "integrations", "agents"):
            (self.groups / (group + ".sh")).write_text(
                f'check "{group}" "true"\n', encoding="utf-8")
        result = self.run_group('check "shell" "false"\n')
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("Passed: 4", result.stdout)
        self.assertIn("Failed: 1", result.stdout)
        self.assertIn("Skipped: 0", result.stdout)


if __name__ == "__main__":
    unittest.main()
