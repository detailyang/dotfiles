
function changedns()
    -- local _, output,_ = shell("networksetup -getdnsservers Wi-Fi")
    -- local servers = splitlines(output)

    -- for _, server in ipairs({"127.0.0.1"}) do
    --     if indexOf(servers, server) == nil then
    --         servers[#servers+1] = server
    --     end
    -- end

    local setcmd = "networksetup -setdnsservers Wi-Fi 127.0.0.1" 
    print("Change dns resolver: " .. setcmd)
    shell(setcmd)
end

hs.timer.doEvery(600, changedns)


hs.hotkey.bind({'cmd', 'shift'}, 'd', function() 
    changedns()
end)
