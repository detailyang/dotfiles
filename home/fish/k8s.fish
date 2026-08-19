#!/usr/bin/env fish

# Kubernetes context switcher
# Reads from ~/.k8s file with format: "name|kubeconfig-path"

function k
    set k8s_file "$HOME/.k8s"
    
    if not test -f "$k8s_file"
        echo "Error: $k8s_file not found"
        return 1
    end

    set clusters (cat "$k8s_file" | sort)
    
    echo "Select Kubernetes cluster:"
    set cluster (echo $clusters | fzf) || return
    set name (echo "$cluster" | cut -d'|' -f1)
    set config (echo "$cluster" | cut -d'|' -f2)
    set -gx KUBENAME $name
    set -gx KUBECONFIG $config
    
    echo "Switched to: $name"
    echo "KUBECONFIG=$config"
    
    # Copy to clipboard if available
    if type -q pbcopy
        echo "export KUBECONFIG=$config" | pbcopy
    end
end
