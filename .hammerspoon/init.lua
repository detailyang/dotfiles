require "modules.reload"
require "modules.volume"
require "modules.window"
require "modules.gitautopush"

hs.hotkey.bind({'cmd', 'shift'}, 'h', function() 
	hs.notify.new({title="Hammerspoon launch", informativeText="Boss, at your service"}):send()
end)
