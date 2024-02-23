#! /bin/sh

URL=$(cat ~/.bark)

if [[ -z "$POPCLIP_URLENCODED_TEXT" ]]; then
    POPCLIP_URLENCODED_TEXT=$(perl -MURI::Escape -e "print uri_escape('$1');")
fi

curl -v $URL$POPCLIP_URLENCODED_TEXT?copy=$POPCLIP_URLENCODED_TEXT
