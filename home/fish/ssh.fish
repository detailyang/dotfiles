#!/usr/bin/env fish

# SSH connection management
# Reads from ~/.hosts file with format: "host|user|ip|port|key-file"

function i
    set -l hosts_file "$HOME/.hosts"
    
    if not test -f "$hosts_file"
        echo "Error: $hosts_file not found"
        return 1
    end

    set -l hosts (cat "$hosts_file" | sort)
    set -l ssh_cmd "ssh -A -o ConnectTimeout=3 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
    
    echo "Select SSH host:"
    set -l line (printf '%s\n' $hosts | fzf) || return
    set -l host (echo "$line" | cut -d'|' -f1)
    set -l user (echo "$line" | cut -d'|' -f2)
    set -l ip (echo "$line" | cut -d'|' -f3)
    set -l port (echo "$line" | cut -d'|' -f4)
    set -l key_file (echo "$line" | cut -d'|' -f5)
    
    echo "Connecting to $user@$ip:$port using key $key_file"
    eval "$ssh_cmd -i $key_file -p $port $user@$ip"
end
