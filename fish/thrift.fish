if command -v thrift > /dev/null
    set -gx THRIFT_HOME (dirname (dirname (which thrift)))
end
