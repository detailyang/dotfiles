local wezterm = require 'wezterm'
local mux = wezterm.mux
local config = {}
local platform = require 'utils.platform'

wezterm.on('gui-startup', function(cmd)
    if platform.is_mac then
        local tab, pane, window = mux.spawn_window {
            workspace = 'tmux',
            args = {
                '/usr/local/bin/fish',
                '-l',
                '-c',
                'tmux attach || tmux'
            },
        }

        mux.set_active_workspace 'tmux'
    end

end)

return config