local wezterm = require('wezterm')
local platform = require('utils.platform')
local act = wezterm.action

local mod = {}

if platform.is_mac then
   mod.SUPER = 'SUPER'
   mod.SUPER_REV = 'SUPER|CTRL'
elseif platform.is_win then
   mod.SUPER = 'ALT' -- to not conflict with Windows key shortcuts
   mod.SUPER_REV = 'ALT|CTRL'
end

local leader = { key = 'w', mods = 'CTRL' }

local keys = {
   -- copy/paste --
   { key = 'c', mods = mod.SUPER, action = act.CopyTo('Clipboard') },
   { key = 'v', mods = mod.SUPER, action = act.PasteFrom('Clipboard') },
   {
      key = [[-]],
      mods = 'LEADER',
      action = act.SplitVertical({ domain = 'CurrentPaneDomain' }),
   },
   {
      key = [[|]],
      mods = 'LEADER',
      action = act.SplitHorizontal({ domain = 'CurrentPaneDomain' }),
   },
   {
      key = 't',
      mods = 'LEADER',
      action = act.PromptInputLine {
        description = 'Enter new name for tab',
        action = wezterm.action_callback(function(window, pane, line)
          if line then
            window:active_tab():set_title(line)
          end
        end),
      },
   },
   { key = 'k', mods = 'LEADER', action = act.ActivatePaneDirection('Up') },
   { key = 'j', mods = 'LEADER', action = act.ActivatePaneDirection('Down') },
   { key = 'h', mods = 'LEADER', action = act.ActivatePaneDirection('Left') },
   { key = 'l', mods = 'LEADER', action = act.ActivatePaneDirection('Right') },
   { key = 'x', mods = 'LEADER',action = wezterm.action.CloseCurrentPane { confirm = false }},
}

return {
   leader = leader,
   keys = keys,
}
