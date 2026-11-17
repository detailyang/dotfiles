#!/usr/bin/env fish

# RPM build utilities

function rpmbuild-here
    rpmbuild --define "_topdir "(dirname "$PWD") $argv
end

function rpmbuild-bootstrap
    mkdir -p BUILD BUILDROOT RPMS SOURCES SPECS SRPMS
    echo "RPM build directory structure created"
end
