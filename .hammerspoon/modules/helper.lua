function shell(cmd)
    result = hs.osascript.applescript(string.format('do shell script "%s"', cmd))
end