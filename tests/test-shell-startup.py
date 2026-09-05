#!/usr/bin/env python3
"""Exercise shell entry points without loading the host's tools or dotfiles."""

from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
BASH = shutil.which("bash")


@unittest.skipUnless(BASH, "Bash is not installed")
class ShellStartupTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.home = Path(temporary.name)
        self.env = {"HOME": str(self.home), "PATH": str(self.home / "bin"),
                    "TERM": "dumb", "LC_ALL": "C"}
        self.put("bin/.keep", "")
        (self.home / "bin/bash").symlink_to(BASH)
        self.put("bash/.path", "export PATH_LOADED=1\n")
        self.put("bash/nix.sh", "export NIX_LOADED=1\n")
        self.put(".local/bin/env", "export LOCAL_ENV_LOADED=1\n")
        self.put("bash/.aliases", "alias startup-test=':'\n")
        for module in ("cscope", "snippet", "proxy", "k8s", "ssh", "rpm"):
            self.put(f"bash/{module}.sh", f"{module}() {{ :; }}\n")

    def put(self, name, content):
        path = self.home / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def bash(self, command, *args, interactive=False, cwd=None):
        return subprocess.run(
            [BASH, "--noprofile", "--norc", "-ic" if interactive else "-c",
             command, "startup-test", *map(str, args)],
            cwd=cwd or self.home, env=self.env,
            text=True, capture_output=True, timeout=5,
        )

    def activate_tools(self):
        for tool in ("mise", "starship"):
            variable = tool.upper() + "_COUNT"
            script = self.put(f"bin/{tool}",
                             "#!/bin/sh\nprintf '%s\\n' 'export " + variable +
                             "=$(( ${" + variable + ":-0} + 1 ))'\n")
            script.chmod(0o755)

    def test_interactive_loads_modules_and_activates_tools_once(self):
        self.activate_tools()
        result = self.bash(r'''
            source "$1"; source "$1"
            for module in cscope snippet proxy k8s ssh rpm; do
                declare -F "$module" >/dev/null || exit 1
            done
            alias startup-test >/dev/null || exit 1
            printf '%s' "$PATH_LOADED:$NIX_LOADED:$LOCAL_ENV_LOADED:$MISE_COUNT:$STARSHIP_COUNT"
        ''', ROOT / "home/.bashrc", interactive=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "1:1:1:1:1")

    def test_noninteractive_loads_environment_not_interactive_tools(self):
        self.activate_tools()
        result = self.bash(r'''
            source "$1"
            if declare -F proxy >/dev/null || alias startup-test 2>/dev/null; then exit 1; fi
            printf '%s' "$PATH_LOADED:$NIX_LOADED:$LOCAL_ENV_LOADED:${MISE_COUNT:-0}:${STARSHIP_COUNT:-0}"
        ''', ROOT / "home/.bashrc")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "1:1:1:0:0")

    def test_old_nvm_installation_is_not_loaded(self):
        self.put(".nvm/nvm.sh", "NVM_LOADED=1\n")
        for interactive in (False, True):
            with self.subTest(interactive=interactive):
                result = self.bash('source "$1"; printf "%s" "${NVM_LOADED:-0}"',
                                   ROOT / "home/.bashrc", interactive=interactive)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout, "0")

    def test_missing_optional_modules_and_tools_are_allowed(self):
        shutil.rmtree(self.home / "bash")
        shutil.rmtree(self.home / ".local")
        result = self.bash('source "$1"; printf ready', ROOT / "home/.bashrc", interactive=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "ready")

    def test_nix_profiles_are_optional_and_do_not_invent_channels(self):
        daemon = "/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh"
        single = str(self.home / ".nix-profile/etc/profile.d/nix.sh")
        for available in ("none", daemon, single):
            with self.subTest(available=available):
                # Intercept profile discovery/loading, never source a host Nix profile.
                result = self.bash(r'''
                    available=$2
                    test() { [[ "$2" == "$available" ]]; }
                    source() { printf 'loaded:%s\n' "$1"; }
                    NIX_PATH=user-supplied
                    builtin source "$1"
                    printf 'NIX_PATH:%s\n' "$NIX_PATH"
                ''', ROOT / "home/bash/nix.sh", available)
                expected = "" if available == "none" else f"loaded:{available}\n"
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout, expected + "NIX_PATH:user-supplied\n")

    def test_nix_profile_failure_is_not_hidden(self):
        result = self.bash(r'''
            test() { return 0; }
            source() { return 7; }
            builtin source "$1"
        ''', ROOT / "home/bash/nix.sh")
        self.assertEqual(result.returncode, 7, result.stderr)

    def test_syntax_validation_checks_later_files(self):
        paths = ("bootstrap.sh", "home/.bash_profile", "home/.bashrc", "home/bash/sample.sh",
                 "home/bin/proxy-env", "installer/sample.sh", "tests/sample.sh",
                 "tests/validate/sample.sh")
        for path in paths:
            self.put(path, ":\n")
        rule = (ROOT / "tests/validate/shell.sh").read_text().splitlines()[0]
        command = 'check() { eval "$2"; }; ' + rule
        result = self.bash(command, cwd=self.home)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.put("home/.bashrc", "if then\n")
        result = self.bash(command, cwd=self.home)
        self.assertNotEqual(result.returncode, 0, "syntax error after bootstrap.sh was ignored")


if __name__ == "__main__":
    unittest.main()
