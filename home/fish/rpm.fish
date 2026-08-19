#!/usr/bin/env fish

# RPM build utilities

function rpmbuild-here
    rpmbuild --define "_topdir "(cd ..; pwd)" $argv"
end

function rpmbuild-bootstrap
    mkdir -p BUILD BUILDROOT SOURCE SPECS SRPMS
    echo "RPM build directory structure created in parent directory"
end
