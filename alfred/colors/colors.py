#!/usr/bin/python

import os

OPEN_COLORS = \
{
  "human": [
    "#19CAAD",
    "#8CC7B5",
    "#A0EEE1",
    "#BEE7E9",
    "#BEEDC7",
    "#D6D5B7",
    "#D1BA74",
    "#E6CEAC",
    "#ECAD9E",
    "#F4606C",
  ],
}

COLOR_CATEGORIES = (
    'human',
)


from collections import OrderedDict
items = OrderedDict()

for color in COLOR_CATEGORIES:
    for number, hexcode in enumerate(OPEN_COLORS[color]):
        items['%s-%d' % (color, number)] = hexcode

XML_HEADER = ['<?xml version="1.0"?>', '<items>']
XML_FOOTER = ['</items>']

def print_category():
    lines = []
    for i, c in enumerate(COLOR_CATEGORIES):
        lines.append(
            '''
            <item uid="oc-{i}-{c}" autocomplete="{c}" type="file" valid="no">
                <title>{c}</title>
                <icon>icons/{c}-6.png</icon>
            </item>
            '''.format(i=i, c=c)
        )
    print('\n'.join(XML_HEADER + lines + XML_FOOTER))


def print_items(query):
    workdir = os.path.dirname(os.path.realpath(__file__))
    lines = []
    for key, hexcode in items.items():
        if not query in key:
            continue
        lines.append(
            '''
            <item uid="{key}" autocomplete="{key}" arg="{hexcode}" type="file">
                <title>{key}</title>
                <subtitle>{hexcode}</subtitle>
                <icon>{workdir}/icons/{key}.png</icon>
            </item>
            '''.format(workdir=workdir,key=key, hexcode=hexcode)
        )

    if not lines:
        lines.append(
            '''
            <item uid="no-result" type="file" valid="no">
                <title>No Results Found</title>
            </item>
            '''
        )

    print('\n'.join(XML_HEADER + lines + XML_FOOTER))


def hex2rgb(v):
    v = v.lstrip('#')
    L = len(v)
    return tuple(int(v[i:i+L//3], 16) for i in range(0, L, L//3))

def generate_icons():
    # requires Pillow package to run with '--generate-icons' options
    import os, os.path
    from PIL import Image
    if not os.path.exists('./icons'):
        os.mkdir('./icons')

    for key, hexcode in items.items():
        print ('Generating %10s : %s ...' % (key, hexcode))
        pixel_rgb = hex2rgb(hexcode)
        im = Image.new('RGB', (64, 64))
        im.putdata([pixel_rgb] * (64*64))
        im.save('./icons/%s.png' % key)

def main():
    import sys
    arg = sys.argv[1] if len(sys.argv) > 1 else ''

    if arg == '--generate-icons':
        generate_icons()
    elif arg == '':
        print_category()
    else:
        print_items(arg)

if __name__ == '__main__':
    main()
