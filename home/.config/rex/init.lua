-- Rex configuration migrated from home/.config/ghostty/config.
-- Rex stores keybindings and session actions here. Client appearance settings
-- remain in the Rex client until Rex exposes configuration for them.

local fish = "fish"

-- Ghostty's command setting starts new terminals with Fish. Rex applies the
-- same choice to windows opened through this action.
rex.action{
  name = "new_fish_window",
  title = "Open New Fish Window",
  description = "Open a new Rex window with Fish.",
  run = function()
    local window, err = rex.session.new_window{
      layout = rex.layout.block{
        flavor = "com.superlogical.terminal.shell",
        options = { command = { fish }, shell = "none" },
      },
    }
    if err ~= nil then error(err, 0) end
    return window
  end,
}

-- Ghostty sends ESC followed by DEL for Alt+Backspace.
rex.bind("alt+backspace", "pane.send_key", { key = "alt+backspace" })

-- These Ghostty settings have no documented Rex init.lua equivalent yet:
-- font-family, font-size, macos-titlebar-style, background-opacity, theme,
-- term, shell-integration, shell-integration-features, and window padding.
-- Rex client actions for clipboard copy/paste must be checked with:
--   rex -C <client> actions
-- before adding Ctrl+C/Ctrl+V bindings here.
