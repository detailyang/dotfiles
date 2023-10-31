local Config = require('config')

require('events.right-status').setup()
require('events.tab-title').setup()
require('events.new-tab-button').setup()

return Config:init()
   :append(require('config.appearance'))
   :append(require('config.lanuch'))
   :append(require('config.fonts'))
   :append(require('config.bindings'))
   :append(require('config.general')).options