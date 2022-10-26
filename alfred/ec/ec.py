#!/usr/bin/python

XML_HEADER = ['<?xml version="1.0"?>', '<items>']
XML_FOOTER = ['</items>']

def main():
    import sys
    arg = sys.argv[1] if len(sys.argv) > 1 else ''
    run(arg)

def urldec(i):
    try:
        from urllib.parse import unquote
        data = unquote(i)
        return '''
            <item uid="urldec" autocomplete="urldec" arg="{arg}" type="file">
                <title>urldec</title>
                <subtitle>{arg}</subtitle>
            </item>
            '''.format(arg=data)
    except:
        return ""

def urlenc(i):
    try:
        from urllib.parse import quote
        data = quote(i)
        return '''
            <item uid="urlenc" autocomplete="urlenc" arg="{arg}" type="file">
                <title>urlenc</title>
                <subtitle>{arg}</subtitle>
            </item>
            '''.format(arg=data)
    except Exception as e:
        return ""

def b64dec(i):
    try:
        import base64

        data = base64.b64decode(i.encode('utf-8'))
        return '''
            <item uid="b64dec" autocomplete="b64dec" arg="{arg}" type="file">
                <title>b64dec</title>
                <subtitle>{arg}</subtitle>
            </item>
            '''.format(arg=data)
    except:    
        return ''

def b64enc(i):
    try:
        import base64

        data = base64.b64encode(i.encode('utf-8'))
        return '''
            <item uid="b64enc" autocomplete="b64enc" arg="{arg}" type="file">
                <title>b64enc</title>
                <subtitle>{arg}</subtitle>
            </item>
            '''.format(arg=data)
    except Exception as e:    
        return ''
        
def lowercase(i):
    return '''
        <item uid="lower" autocomplete="lower" arg="{arg}" type="file">
            <title>lower</title>
            <subtitle>{arg}</subtitle>
        </item>
        '''.format(arg=i.lower())

def uppercase(i):
    return '''
        <item uid="upper" autocomplete="upper" arg="{arg}" type="file">
            <title>upper</title>
            <subtitle>{arg}</subtitle>
        </item>
        '''.format(arg=i.upper())

def run(i):
    items = []

    item = urlenc(i)
    if item:
        items.append(item)

    item = urldec(i)
    if item:
        items.append(item)

    item = b64enc(i)
    if item:
        items.append(item)

    item = b64dec(i)
    if item:
        items.append(item)
        
    item = lowercase(i)
    if item:
        items.append(item)

    item = uppercase(i)
    if item:
        items.append(item)

    if not items:
        lines.append(
            '''
            <item uid="no-result" type="file" valid="no">
                <title>No Results Found</title>
            </item>
            '''
        )

    print('\n'.join(XML_HEADER + items + XML_FOOTER))

if __name__ == '__main__':
    main()
