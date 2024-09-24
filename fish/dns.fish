function sd
    set predefined_dns "127.0.0.1" "100.64.0.7"
    
    set dhcp_dns_raw (ipconfig getpacket en0 | grep domain_name_server | cut -d' ' -f3-)
    set dhcp_dns (echo $dhcp_dns_raw | tr -d '{}' | tr ',' '\n' | string trim)
    
    set all_dns $predefined_dns $dhcp_dns
    
    # Display DNS options
    echo "Please select a DNS server:"
    for i in (seq (count $all_dns))
        echo "$i. $all_dns[$i]"
    end
    
    read -P "Choose DNS Server: " choice
    
    # Validate user input
    if test "$choice" -gt 0 -a "$choice" -le (count $all_dns)
        set selected_dns $all_dns[$choice]
        
        set dns_ip (echo $selected_dns | cut -d':' -f1)
        
        sudo networksetup -setdnsservers Wi-Fi $dns_ip
        
        echo "DNS has been changed to $dns_ip"
    else
        echo "Invalid selection. Please run the function again and choose a valid number."
    end
end