#!/usr/bin/env bash

# Cscope utilities for code navigation
# See: https://cscope.sourceforge.net/

function cscope-build() {
    cscope -bqR
}

function cscope-go() {
    cscope -dq
}
