function gendate -d "gendate"
    set -x start $argv[1];
    set -x stop $argv[2];

    while [ (gdate -d "$start" +%s) -le (gdate -d "$stop" +%s) ];
        echo $start
        set start (gdate -d "$start + 1 day" +%F)
    end
end

