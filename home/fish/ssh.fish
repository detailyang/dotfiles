#!/usr/bin/env fish

# SSH connection management
# Reads from ~/.hosts file with format: "host|user|ip|port|key-file"

function i
    set hosts_file "$HOME/.hosts"
    
    if not test -f "$hosts_file"
        echo "Error: $hosts_file not found"
        return 1
    end

    set hosts (cat "$hosts_file" | sort)
    set ssh_cmd "ssh -A -o ConnectTimeout=3 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
    
    echo "Select SSH host:"
    set line (echo $hosts | fzf) || return
    set host (echo "$line" | cut -d'|' -f1)
    set user (echo "$line" | cut -d'|' -f2)
    set ip (echo "$line" | cut -d'|' -f3)
    set port (echo "$line" | cut -d'|' -f4)
    set key_file (echo "$line" | cut -d'|' -f5)
    
    echo "Connecting to $user@$ip:$port using key $key_file"
    eval "$ssh_cmd -i $key_file -p $port $user@$ip"
end
