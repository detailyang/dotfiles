function gendate -d "gendate"
    set -l start $argv[1]
    set -l stop $argv[2]
    set -l date_cmd date
    if type -q gdate
        set date_cmd gdate
    end

    set -l stop_ts ($date_cmd -d "$stop" +%s); or return 1
    while test ($date_cmd -d "$start" +%s) -le $stop_ts
        echo $start
        set start ($date_cmd -d "$start + 1 day" +%F); or return 1
    end
end

