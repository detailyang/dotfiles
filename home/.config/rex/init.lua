-- Migrated from home/.config/herdr/config.toml and home/.tmux.conf.
-- Where shortcuts conflict, prefer the explicit tmux binding.
-- https://www.superlogical.com/rex/docs/customize/config
-- Check: rex config check ~/.config/rex/init.lua
-- Apply on the Rex server: rex config reload
-- Inspect client actions and bindings: rex -C <client> actions; rex keymap

-- Herdr workspace / tmux session -> Rex session; tab / tmux window -> window.
-- These actions start Fish as a login shell. Terminals created through the
-- client's own menus still use its shell settings.
local function run_command(argv, options)
  local result, err = rex.exec(argv, options)
  if err ~= nil then error(err, 0) end
  if not result.ok then error(result.stderr, 0) end
  return result.stdout
end

local function current_directory(ctx)
  if not ctx.block_id then return nil end
  -- Rex fills in the action's block ID. Shell integration reports a file URL.
  local result, err = rex.block.call("com.superlogical.terminal", "pwd", {})
  if err ~= nil then error(err, 0) end
  local pwd = result.pwd
  -- Before the shell reports its directory, use Rex's default directory.
  if pwd == nil or pwd == "" then return nil end
  if pwd:sub(1, 1) == "/" then return pwd end
  local path = pwd:match("^file://[^/]*(/.*)$")
  if not path then error("Terminal reported an unsupported directory: " .. pwd, 0) end
  return (path:gsub("%%(%x%x)", function(hex)
    return string.char(tonumber(hex, 16))
  end))
end

local function fish_layout(ctx, command)
  return rex.layout.block{
    flavor = "com.superlogical.terminal.shell",
    options = {
      command = command or { "fish", "--login" },
      shell = "none",
      cwd = current_directory(ctx),
    },
  }
end

rex.action{
  name = "new_fish_window",
  title = "Open New Fish Window",
  description = "Open a Fish login shell in the current terminal's directory.",
  run = function(ctx)
    local window, err = rex.session.new_window{ layout = fish_layout(ctx) }
    if err ~= nil then error(err, 0) end
    return window
  end,
}

rex.action{
  name = "split_fish",
  title = "Split with Fish",
  args = { direction = "string" },
  run = function(ctx, args)
    local split, err = rex.session.new_split{
      anchor_block_id = ctx.block_id,
      direction = args.direction,
      side = "after",
      focus = true,
      layout = fish_layout(ctx),
    }
    if err ~= nil then error(err, 0) end
    return split
  end,
}

rex.action{
  name = "focus_pane",
  title = "Focus Pane",
  args = { direction = "string" },
  run = function(ctx, args)
    local result, err = rex.session.focus_direction{
      direction = args.direction,
      wrap = true,
    }
    if err ~= nil then error(err, 0) end
    return result
  end,
}

-- tmux's kill-window closes every pane in the current tab.
-- Resolve it from the action's pane rather than another client's active tab.
rex.action{
  name = "close_tab",
  title = "Close Current Tab and All Its Panes",
  run = function(ctx)
    if not ctx.session_id or not ctx.block_id then
      error("Closing a tab requires a focused pane in a session", 0)
    end
    local placement, err = rex.session.describe_block{
      session_id = ctx.session_id,
      block_id = ctx.block_id,
    }
    if err ~= nil then error(err, 0) end
    local window_id = placement.block and placement.block.window_id
    if not window_id or window_id == "" then
      error("The focused pane is not in a window", 0)
    end
    local result, close_err = rex.session.close_window{
      session_id = ctx.session_id,
      window_id = window_id,
    }
    if close_err ~= nil then error(close_err, 0) end
    return result
  end,
}

rex.action{
  name = "open_snippet",
  title = "Open Snippet Picker",
  description = "Run ~/bin/snippet in a temporary pane on the right.",
  run = function(ctx)
    local split, err = rex.session.new_split{
      anchor_block_id = ctx.block_id,
      direction = "horizontal",
      side = "after",
      focus = true,
      -- Expand HOME in Fish, so this works on both macOS and Linux.
      layout = fish_layout(ctx, { "fish", "--login", "--command", 'exec "$HOME/bin/snippet"' }),
    }
    if err ~= nil then error(err, 0) end
    return split
  end,
}

rex.action{
  name = "reload_config",
  title = "Reload Rex Configuration",
  run = function()
    return { output = run_command({ "rex", "config", "reload" }) }
  end,
}

-- tmux's Ctrl+A p captures colored scrollback and opens it in a browser.
-- Rex exports HTML directly, so aha is not needed. The file, browser, and
-- clipboard are on the Rex server, as they were on the tmux server.
rex.action{
  name = "capture_html",
  title = "Export Terminal as HTML",
  run = function(ctx)
    if not ctx.session_id or not ctx.block_id then
      error("HTML export needs a terminal in a Rex session", 0)
    end
    local html = run_command({
      "rex", "capture", "-s", ctx.session_id, "-b", ctx.block_id, "--format", "html",
    })
    local directory = run_command({ "mktemp", "-d", "/tmp/rex-capture.XXXXXXXX" }):gsub("\n$", "")
    local path = directory .. "/terminal.html"
    local file = assert(io.open(path, "w"))
    local written, write_err = file:write(html)
    local closed, close_err = file:close()
    if not written then error(write_err, 0) end
    if not closed then error(close_err, 0) end

    local platform = run_command({ "uname", "-s" }):gsub("\n$", "")
    local opener = platform == "Darwin" and "open" or "xdg-open"
    local opened, open_err = rex.exec({ opener, path })
    if opened and opened.ok then return { path = path } end

    -- Match tmux: if the browser cannot open, copy the saved path instead.
    local clipboard = platform == "Darwin" and { "pbcopy" }
      or { "xclip", "-selection", "clipboard" }
    local copied, copy_err = rex.exec(clipboard, { stdin = path .. "\n" })
    if not copied or not copied.ok then
      error("HTML saved to " .. path .. "; browser: " .. (open_err or opened.stderr)
        .. "; clipboard: " .. (copy_err or copied.stderr), 0)
    end
    return { path = path, copied_path = true }
  end,
}

-- Ctrl+A starts a sequence; press it twice to send Ctrl+A to the terminal.
rex.bind("ctrl+a>ctrl+a", "pane.send_key", { key = "ctrl+a" })
-- Ctrl+A then h/j/k/l or an arrow focuses the adjacent pane.
for key, direction in pairs({ h = "left", j = "down", k = "up", l = "right" }) do
  rex.bind("ctrl+a>" .. key, "focus_pane", { direction = direction })
  rex.bind("ctrl+a>" .. direction, "focus_pane", { direction = direction })
end

rex.bind("ctrl+a>t", "new_fish_window")
rex.bind("ctrl+a>c", "close_tab")
rex.bind("ctrl+a>n", "client.tab.next")
rex.bind("ctrl+a>p", "capture_html")
rex.bind("ctrl+a>shift+p", "client.tab.previous")
-- Ctrl+A then |: side-by-side panes (tmux split-window -h), new pane right.
-- Ctrl+A then -: stacked panes (tmux split-window -v), new pane below.
-- Rex matches unshifted keys: | is Shift+backslash on a US layout.
rex.bind("ctrl+a>shift+\\", "split_fish", { direction = "horizontal" })
rex.bind("ctrl+a>-", "split_fish", { direction = "vertical" })

-- The session picker is the closest documented equivalent of Herdr's
-- workspace picker and goto. Its own navigation keys are client settings.
rex.bind("ctrl+a>w", "session.switch")
rex.bind("ctrl+w", "session.switch")
rex.bind("ctrl+a>g", "session.switch")
-- tmux's `bind M-w` includes the prefix; this opens Rex's session picker.
rex.bind("ctrl+a>alt+w", "session.switch")

rex.bind("ctrl+a>r", "reload_config")
rex.bind("ctrl+a>z", "pane.zoom")
rex.bind("ctrl+a>x", "pane.close") -- Only this pane; Ctrl+A c closes the tab.
-- Reserve Shift+B for tmux's join-pane workflow (see migration limits).
rex.bind("ctrl+a>alt+b", "client.sidebar.toggle")
rex.bind("ctrl+a>o", "open_snippet")

-- A one-shot layout mode replaces tmux's Space menu for the supported action.
-- Space then = balances the existing splits; Escape cancels.
rex.mode("layout", { exclusive = true })
rex.bind("ctrl+a>space", "client.mode.enter", { name = "layout", once = true })
rex.bind("layout/=", "pane.balance")

-- Shift+R enters resize mode; Escape or Enter leaves it.
rex.mode("resize", { exclusive = true })
rex.bind("ctrl+a>shift+r", "client.mode.enter", { name = "resize" })
for key, direction in pairs({ h = "left", j = "down", k = "up", l = "right" }) do
  rex.bind("resize/" .. key, "pane.resize", { direction = direction })
  rex.bind("resize/" .. direction, "pane.resize", { direction = direction })
end
rex.bind("resize/=", "pane.balance")
rex.bind("resize/enter", "client.mode.exit")

-- Keep the existing Ghostty migration's Alt+Backspace behavior.
rex.bind("alt+backspace", "pane.send_key", { key = "alt+backspace" })

-- Herdr settings not migrated here: onboarding, manage_ssh_config, theme,
-- pane borders/gaps, agent sorting, sidebar token rows/colors, and sounds.
-- Rex exposes terminal set_theme, but that does not style the whole client.
-- Configure appearance and shell defaults in the Rex client where available.
-- new_fish_window creates a tab without a separate naming prompt.
--
-- Keep these Herdr bindings unmapped until the installed client's actions
-- confirm equivalents (rex -C <client> actions):
--   Ctrl+A d: detach without closing terminals.
--   Ctrl+A Shift+1..9 / Ctrl+1..9: choose a workspace, not a tab.
--   Ctrl+A Alt+1..9: focus an agent.
--   Ctrl+A Shift+Left/Right: previous/next workspace.
-- Herdr's picker navigation (k/j and h/Ctrl+J/Ctrl+K/l) has no documented
-- equivalent here. client.tab.goto would change tabs, not workspaces.
--
-- tmux workflows not yet migrated:
--   Ctrl+A b / Shift+B: move_block supports moving panes; the chooser and
--     conditional break/join behavior still need implementation.
--   Ctrl+A Space s/S/h/v/t: swap_blocks and move_block support rearranging
--     panes; layout/= currently only balances the existing split tree.
--   Ctrl+A v: persistent p-shell hide/restore behavior is not implemented.
--   Ctrl+A o: snippet remains a temporary split; new_layer supports floats.
--   Ctrl+P: no equivalent live input broadcast action was found in the docs.
--   Ctrl+L: normal shell redraw remains. Public configs use
--     com.superlogical.terminal.clear; verify it on the installed client
--     before adding tmux's screen and scrollback clearing.
--   vi copy-mode v/y: use the Rex client's selection and clipboard controls.
-- Check these with `rex api describe <method>` and `rex -C <client> actions`.
--
-- Terminal type/RGB, extended keys (CSI-u), mouse, escape-time, display-time,
-- clipboard policy, base indexes, titles, status bar, and border styles have
-- no documented init.lua equivalents. tmux's final border colors are 239/200.
-- Rex documents about 64 MiB of scrollback; tmux's million-line limit is not
-- configurable here. HTML export includes only the history Rex retains.
--
-- Existing Ghostty settings also need client-side configuration: fonts,
-- titlebar style, opacity, terminal type, shell integration, and padding.
