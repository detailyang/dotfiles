# Dotfiles

Personal development environment configuration for installing host tools and exposing reusable shell behavior across machines.

## Language

**Shell capability**:
A user-facing shell behavior that should mean the same thing across supported shells, even when each shell needs its own adapter.
_Avoid_: shell function, alias, script wrapper

**Proxy env**:
A shell capability for choosing proxy endpoints and exporting the related proxy environment variables consistently across shells and host modes.
_Avoid_: proxy function, proxy alias, environment hack
