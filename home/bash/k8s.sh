#!/usr/bin/env bash

# Kubernetes context switcher
# Reads from ~/.k8s file with format: "name|kubeconfig-path"

function k() {
    local k8s_file="$HOME/.k8s"
    
    if [[ ! -f "$k8s_file" ]]; then
        echo "Error: $k8s_file not found"
        return 1
    fi

    local clusters=$(cat "$k8s_file" | sort)
    
    echo "Select Kubernetes cluster:"
    select cluster in $clusters; do
        if [[ -n "$cluster" ]]; then
            IFS='|' read -r name config <<< "$cluster"
            export KUBENAME=$name
            export KUBECONFIG=$config
            
            echo "Switched to: $name"
            echo "KUBECONFIG=$config"
            
            # Copy to clipboard if available
            if command -v pbcopy &> /dev/null; then
                echo "export KUBECONFIG=$config" | pbcopy
            fi

            # Try to switch to preferred shell
            if command -v fish &> /dev/null; then
                exec fish
            elif command -v zsh &> /dev/null; then
                exec zsh
            elif command -v bash &> /dev/null; then
                exec bash
            fi
            return 0
        fi
    done
}
