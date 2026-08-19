#!/bin/bash -ex

if [[ "$(uname)" != "Linux" ]]; then
  exit 1
fi

active_window=$(xdotool getactivewindow)
id=$(printf %x $active_window)
active_class=$(wmctrl -lx | grep "$id" | awk '{print $3}')

if [[ "$active_class" == *"$1"* ]]; then
    wmctrl -i -r "$active_window" -b add,hidden
else
    wmctrl -x -a "$1" || $2
fi
