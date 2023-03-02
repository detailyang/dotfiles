require "modules.helper"
require "modules.reload"
require "modules.volume"
require "modules.window"
require "modules.hotkey"
require "modules.dns"

hs.hotkey.bind({'cmd', 'shift'}, 'h', function() 
    hs.alert.show("Hello World")
    hs.notify.new({title="Hammerspoon launch", informativeText="Hello World"}):send()
end)
