-- Migrated from home/.config/herdr/config.toml.
-- https://www.superlogical.com/rex/docs/customize/config
-- Check: rex config check ~/.config/rex/init.lua
-- Apply on the Rex server: rex config reload
-- Inspect client actions and bindings: rex -C <client> actions; rex keymap

-- Herdr workspace -> Rex session; Herdr tab -> Rex window.
-- These actions start Fish as a login shell. Terminals created through the
-- client's own menus still use its shell settings.
local function fish_layout(command)
  return rex.layout.block{
    flavor = "com.superlogical.terminal.shell",
    options = { command = command or { "fish", "--login" }, shell = "none" },
  }
end

rex.action{
  name = "new_fish_window",
  title = "Open New Fish Window",
  description = "Open a new Rex tab with a Fish login shell.",
  run = function()
    local window, err = rex.session.new_window{ layout = fish_layout() }
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
      direction = args.direction,
      side = "after",
      focus = true,
      layout = fish_layout(),
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
    }
    if err ~= nil then error(err, 0) end
    return result
  end,
}

rex.action{
  name = "open_snippet",
  title = "Open Snippet Picker",
  description = "Run ~/bin/snippet in a temporary pane on the right.",
  run = function()
    local split, err = rex.session.new_split{
      direction = "horizontal",
      side = "after",
      focus = true,
      -- Expand HOME in Fish, so this works on both macOS and Linux.
      layout = fish_layout({ "fish", "--login", "--command", 'exec "$HOME/bin/snippet"' }),
    }
    if err ~= nil then error(err, 0) end
    return split
  end,
}

rex.action{
  name = "reload_config",
  title = "Reload Rex Configuration",
  run = function()
    local result, err = rex.exec({ "rex", "config", "reload" })
    if err ~= nil then error(err, 0) end
    if not result.ok then error(result.stderr, 0) end
    return { output = result.stdout }
  end,
}

-- Ctrl+A starts a sequence; press it twice to send Ctrl+A to the terminal.
rex.bind("ctrl+a>ctrl+a", "pane.send_key", { key = "ctrl+a" })
rex.bind("ctrl+a>h", "focus_pane", { direction = "left" })
rex.bind("ctrl+a>j", "focus_pane", { direction = "down" })
rex.bind("ctrl+a>k", "focus_pane", { direction = "up" })
rex.bind("ctrl+a>l", "focus_pane", { direction = "right" })

rex.bind("ctrl+a>t", "new_fish_window")
rex.bind("ctrl+a>n", "client.tab.next")
rex.bind("ctrl+a>p", "client.tab.previous")
-- Rex matches unshifted keys: | is Shift+backslash on a US layout.
rex.bind("ctrl+a>shift+\\", "split_fish", { direction = "horizontal" })
rex.bind("ctrl+a>-", "split_fish", { direction = "vertical" })

-- The session picker is the closest documented equivalent of Herdr's
-- workspace picker and goto. Its own navigation keys are client settings.
rex.bind("ctrl+a>w", "session.switch")
rex.bind("ctrl+w", "session.switch")
rex.bind("ctrl+a>g", "session.switch")

rex.bind("ctrl+a>r", "reload_config")
rex.bind("ctrl+a>z", "pane.zoom")
rex.bind("ctrl+a>x", "pane.close")
rex.bind("ctrl+a>shift+b", "client.sidebar.toggle")
rex.bind("ctrl+a>o", "open_snippet")

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

-- Migration limits: no equivalent init.lua setting is documented for Herdr's
-- onboarding, manage_ssh_config, catppuccin-latte theme, pane borders/gaps,
-- agent priority sorting, sidebar token rows/colors, or disabled sounds.
-- Configure appearance and shell defaults in the Rex client where available.
-- new_fish_window creates a tab without a separate naming prompt.
--
-- Keep these Herdr bindings unmapped until the installed client's actions
-- confirm equivalents (rex -C <client> actions):
--   Ctrl+A c: close the whole tab; Ctrl+A d: detach without closing terminals.
--   Ctrl+A Shift+1..9 / Ctrl+1..9: choose a workspace, not a tab.
--   Ctrl+A Alt+1..9: focus an agent.
--   Ctrl+A Shift+Left/Right: previous/next workspace.
-- Herdr's picker navigation (k/j and h/Ctrl+J/Ctrl+K/l) has no documented
-- equivalent here. client.tab.goto would change tabs, not workspaces.
--
-- Existing Ghostty settings also need client-side configuration: fonts,
-- titlebar style, opacity, terminal type, shell integration, and padding.
