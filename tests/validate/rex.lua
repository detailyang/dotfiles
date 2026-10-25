-- Run from the repository root: lua tests/validate/rex.lua
-- Rex is mocked at its API boundary; this does not verify a live server.
local actions, bindings, calls = {}, {}, {}
local loading = true
local api_error, placement_error, close_error
local placement = { block = { window_id = "window:target" } }

local function record(method, args)
  assert(not loading, "Rex API called while loading configuration")
  calls[#calls + 1] = { method = method, args = args }
  if api_error then return nil, api_error end
  return { window_id = "window:new", block_ids = { "block:new" } }
end

rex = {
  action = function(action) actions[action.name] = action end,
  bind = function(key, action, args)
    assert(not bindings[key], "Duplicate shortcut: " .. key)
    bindings[key] = { action = action, args = args or {} }
  end,
  mode = function() end,
  layout = { block = function(layout) return layout end },
  block = { call = function() return { pwd = "/tmp/rex project" } end },
  session = {
    new_window = function(args) return record("new_window", args) end,
    new_split = function(args) return record("new_split", args) end,
    focus_direction = function(args) return record("focus_direction", args) end,
    describe_block = function(args)
      record("describe_block", args)
      if placement_error then return nil, placement_error end
      return placement
    end,
    close_window = function(args)
      record("close_window", args)
      if close_error then return nil, close_error end
      return { revision = 42 }
    end,
  },
}

dofile("home/.config/rex/init.lua")
loading = false
local ctx = { session_id = "session:target", block_id = "block:target" }
local function invoke(key, context)
  calls = {}
  local binding = assert(bindings[key], "Missing shortcut: " .. key)
  return assert(actions[binding.action], "Missing action: " .. binding.action)
    .run(context or ctx, binding.args)
end
local function expect_error(key, message, context)
  local ok, err = pcall(invoke, key, context)
  assert(not ok and tostring(err):find(message, 1, true), tostring(err))
end

-- Split the triggering pane, even if another pane has since taken focus.
for key, direction in pairs({ ["ctrl+a>shift+\\"] = "horizontal", ["ctrl+a>-"] = "vertical" }) do
  invoke(key)
  local call = calls[1]
  assert(call.method == "new_split")
  assert(call.args.anchor_block_id == ctx.block_id, "Split must target the triggering pane")
  assert(call.args.direction == direction and call.args.side == "after")
  assert(call.args.focus == true)
  assert(call.args.layout.options.cwd == "/tmp/rex project")
  assert(table.concat(call.args.layout.options.command, " ") == "fish --login")
  api_error = "split failed"
  expect_error(key, api_error)
  api_error = nil
end

-- Both vi keys and arrows move focus; wrap preserves tmux's edge behavior.
for key, direction in pairs({ h = "left", j = "down", k = "up", l = "right" }) do
  for _, suffix in ipairs({ key, direction }) do
    invoke("ctrl+a>" .. suffix)
    assert(calls[1].method == "focus_direction")
    assert(calls[1].args.direction == direction and calls[1].args.wrap == true)
  end
end
api_error = "focus failed"
expect_error("ctrl+a>h", api_error)
api_error = nil

-- Close the whole window containing the triggering pane, not an active-window
-- guess or a pane.close action. Keep Ctrl+A x as the separate pane operation.
assert(bindings["ctrl+a>x"].action == "pane.close")
assert(invoke("ctrl+a>c").revision == 42)
assert(#calls == 2 and calls[1].method == "describe_block")
assert(calls[1].args.session_id == ctx.session_id and calls[1].args.block_id == ctx.block_id)
assert(calls[2].method == "close_window")
assert(calls[2].args.session_id == ctx.session_id and calls[2].args.window_id == "window:target")

for _, context in ipairs({ {}, { session_id = ctx.session_id }, { block_id = ctx.block_id } }) do
  expect_error("ctrl+a>c", "Closing a tab requires a focused pane in a session", context)
  assert(#calls == 0)
end
for _, result in ipairs({ {}, { block = {} }, { block = { window_id = "" } } }) do
  placement = result
  expect_error("ctrl+a>c", "The focused pane is not in a window")
  assert(#calls == 1, "Unresolved window must never be closed")
end
placement_error = "pane no longer exists"
expect_error("ctrl+a>c", placement_error)
assert(#calls == 1)
placement_error = nil
placement = { block = { window_id = "window:target" } }
close_error = "close failed"
expect_error("ctrl+a>c", close_error)
assert(#calls == 2)

print("Rex: splits, focus navigation, window targeting, pane closing, and failure paths passed")
