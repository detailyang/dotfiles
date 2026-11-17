local hyper = {'ctrl', 'cmd'}

-- hs.hotkey.bind({"cmd"}, "L", hs.caffeinate.systemSleep)

-- show front activated app infos
hs.hotkey.bind(
    hyper, ".",
    function()
        local win = hs.window.focusedWindow()
        local app = win and win:application()
        hs.alert.show(string.format("App path:        %s\nApp name:      %s\nIM source id:  %s",
                                    app and app:path() or "n/a",
                                    app and app:name() or "n/a",
                                    hs.keycodes.currentSourceID()))
    end)

