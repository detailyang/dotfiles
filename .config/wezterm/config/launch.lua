local platform = require('utils.platform')()

local options = {
   default_prog = {},
   launch_menu = {},
}

if platform.is_win then
   options.default_prog = { 'powershell' }
   options.launch_menu = {
      { label = 'Nushell', args = { 'nu' } },
   }
elseif platform.is_mac then
   options.default_prog = { '/usr/local/bin/fish' , '-l', '-c', 'tmux attach || tmux'}
   options.launch_menu = {
      { label = 'Bash', args = { 'bash' } },
      { label = 'Fish', args = { '/usr/local/bin/fish' } },
      { label = 'Zsh', args = { 'zsh' } },
   }
end

return options