set jdk (command ls /Library/Java/JavaVirtualMachines | head -n 1)
export JAVA_HOME="/Library/Java/JavaVirtualMachines/$jdk/Contents/Home"
