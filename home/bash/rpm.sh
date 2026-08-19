#!/usr/bin/env bash

# RPM build utilities

function rpmbuild-here() {
    rpmbuild --define "_topdir $(cd .. ; pwd)" "$@"
}

function rpmbuild-bootstrap() {
    mkdir -p BUILD BUILDROOT SOURCE SPECS SRPMS
    echo "RPM build directory structure created in parent directory"
}
