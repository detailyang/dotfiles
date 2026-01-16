# Dotfiles

My personal development environment configuration for macOS/Linux/Windows.

## Quick Start

```bash
git clone https://github.com/detailyang/dotfiles.git
cd dotfiles

# Unix/macOS
./install.sh

# Windows
./install.ps1

# Preview deployment (dry-run)
./install.sh --dry-run
```

## Key Features

- Cross-platform (macOS/Linux/Windows)
- Automated installation with pre-flight checks
- Modular components
- Development-focused
- Backup and rollback support

## Directory Structure

```
dotfiles/
├── fish/              # Fish shell configuration (modular functions)
├── bash/              # Bash shell configuration
├── snippet/           # Command snippets by tool category
├── alfred/            # Alfred workflows (Go-based)
├── bin/               # Executable utilities
├── .config/           # XDG application configs
├── .hammerspoon/      # macOS automation
├── darwin/            # macOS-specific utilities
├── docker/            # Docker development environment
├── install.sh         # Unix/macOS installer
└── install.ps1        # Windows PowerShell installer
```

## Shell Configuration

### Fish Shell
Fish is the primary shell with modular functions:

- 50+ individual function files (one per function)
- Intelligent autocompletion
- Built-in history search (Ctrl+R via fzf)
- Custom two-line prompt with Git/K8s context

Common commands:
```fish
proxy <interface>     # Set SOCKS5 proxy
unproxy               # Disable proxy
autoproxy             # Read proxy from system settings
wslproxy              # Set proxy in WSL environment
k <context>           # Kubernetes context switch
s                     # Open snippet browser
docker-clean          # Clean Docker resources
```

### Bash Shell
Bash is the fallback shell with:
- PATH management with directory existence checks
- Shared Nix configuration
- Proxy functions (delegates to Fish)

## Tools Integration

### Alfred Workflows
```bash
cd alfred
make              # Build all workflows
make all          # Or use this command
```

### Command Snippets
```bash
# Browse snippets with fzf
~/dotfiles/bin/snippte

# Or use shortcuts
# Fish:
s

# Bash:
sb
```

### Docker Development Environment
```bash
make              # Build CentOS7 Docker image
```

## Proxy Management

Supports 4 proxy modes:

1. **proxy**: Manual SOCKS5 proxy (default port 7890)
   ```fish
   proxy en0          # Use en0 interface IP
   proxy 192.168.1.1  # Use specific IP
   ```

2. **unproxy**: Disable all proxies
   ```fish
   unproxy
   ```

3. **autoproxy**: Read from macOS system settings
   ```fish
   autoproxy
   ```

4. **wslproxy**: WSL environment proxy
   ```fish
   wslproxy
   ```

## Installation Options

```bash
# Default installation
./install.sh

# Skip git pull
./install.sh --no-pull

# Preview changes without deploying
./install.sh --dry-run

# Combined options
./install.sh --no-pull --dry-run
```

## Backup and Restore

### Automatic Backup
The installer automatically creates backups before deployment:
```bash
# Backup location pattern
~/.dotfiles-backup-YYYYMMDD_HHMMSS/
```

### Manual Restore
```bash
# List available backups
ls -la ~/.dotfiles-backup-*

# Restore from backup
cp -r ~/.dotfiles-backup-YYYYMMDD_HHMMSS/* ~/
```

## Troubleshooting

### Installation Issues

**Check disk space**:
```bash
df -h ~
```

**Check permissions**:
```bash
ls -ld ~
```

**Preview changes**:
```bash
./install.sh --dry-run
```

### Shell Issues

**Fish prompt not showing**:
```fish
# Check if fish_prompt.fish exists
ls -l ~/.config/fish/functions/fish_prompt.fish

# Reload Fish configuration
source ~/.config/fish/config.fish
```

**Bash not loading configs**:
```bash
# Check .bash_profile
cat ~/.bash_profile

# Reload Bash
source ~/.bash_profile
```

**Zsh starship not working**:
```bash
# Verify starship is installed
which starship

# Check .zshrc for errors
zsh -n ~/.zshrc
```

## Maintenance

### Updating Configuration

```bash
cd ~/dotfiles
git pull
./install.sh
```

### Adding New Fish Functions

1. Create new file: `fish/yourfunction.fish`
2. Write function in the file
3. Function will be auto-loaded when rsynced

### Modifying Nix Configuration

Edit `bash/nix-common.sh` - shared between Bash and Fish.

## Migration

For migration guides and breaking changes, see [MIGRATION.md](MIGRATION.md).

## License

MIT
