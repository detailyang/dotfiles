
function changedns()
    local cmd = "networksetup -setdnsservers Wi-Fi 223.5.5.5 223.6.6.6"
    print("Change dns resolver: " .. cmd)
    shell(cmd)
end

hs.timer.doEvery(600, changedns)