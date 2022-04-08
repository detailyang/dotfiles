require "modules.reload"
require "modules.volume"
require "modules.window"
require "modules.gitautopush"
require "modules.hotkey"

hs.hotkey.bind({'cmd', 'shift'}, 'h', function() 
    hs.alert.show("Hello World")
    hs.notify.new({title="Hammerspoon launch", informativeText="Hello World"}):send()
end)
