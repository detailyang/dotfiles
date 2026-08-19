function shell(cmd)
    result = hs.osascript.applescript(string.format('do shell script "%s"', cmd))
end


function runGitAutoPush()
    -- touch ~/.gitpush.json

    local file = os.getenv("HOME") .. "/.gitpush.json"
    print("Loading gitpush: " .. file)
    local repos = hs.json.read(file) 
    for key, repo in ipairs(repos) do
        local cmd = "cd " .. repo .. [[ && git add . ; git commit -m autocommit ; git push]]
        print("repo " .. repo .. " and cmd: " .. cmd)
        shell(cmd)
    end
end

hs.timer.doEvery(14400, runGitAutoPush)

hs.hotkey.bind({'cmd', 'shift'}, 'j', function() 
	hs.notify.new({title="Hammerspoon launch", informativeText="auto push git started"}):send()
	runGitAutoPush()
	hs.notify.new({title="Hammerspoon launch", informativeText="auto push git completed"}):send()
end)
