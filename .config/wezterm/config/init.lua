local wezterm = require('wezterm')

local Config = {}

function Config:init()
   local o = {}
   self = setmetatable(o, { __index = Config })
   self.options = {}
   return o
end

function Config:append(new_options)
   for k, v in pairs(new_options) do
      if self.options[k] ~= nil then
         wezterm.log_warn(
            'Duplicate config option detected: ',
            { old = self.options[k], new = new_options[k] }
         )
         goto continue
      end
      self.options[k] = v
      ::continue::
   end
   return self
end

return Config