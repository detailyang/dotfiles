#!/usr/bin/env bash

# SSH connection management
# Reads from ~/.hosts file with format: "host|user|ip|port|key-file"

function i() {
    local hosts_file="$HOME/.hosts"
    
    if [[ ! -f "$hosts_file" ]]; then
        echo "Error: $hosts_file not found"
        return 1
    fi

    local hosts=$(cat "$hosts_file" | sort)
    local ssh_cmd="ssh -A -o ConnectTimeout=3 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
    
    echo "Select SSH host:"
    select line in $hosts; do
        if [[ -n "$line" ]]; then
            IFS='|' read -r host user ip port key_file <<< "$line"
            echo "Connecting to $user@$ip:$port using key $key_file"
            $ssh_cmd -i "$key_file" -p "$port" "$user@$ip"
            return 0
        fi
    done
}
