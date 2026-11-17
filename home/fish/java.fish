
if test -d /Library/Java/JavaVirtualMachines
    set -l jdk (command ls /Library/Java/JavaVirtualMachines | head -n 1)
    if test -n "$jdk"
        set -gx JAVA_HOME "/Library/Java/JavaVirtualMachines/$jdk/Contents/Home"
    end
end


