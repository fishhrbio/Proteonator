"""Render the small bundled Markdown guide to an offline, script-free HTML page."""
from pathlib import Path
from html import escape
import re
root=Path(__file__).resolve().parents[1]
def inline(value):
    text=escape(value)
    text=re.sub(r'`([^`]+)`',r'<code>\1</code>',text)
    text=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',text)
    text=re.sub(r'\[([^\]]+)\]\((https://[^)]+)\)',r'<a href="\2">\1</a>',text)
    return text
blocks=[];listed=False
for paragraph in (root/'docs/USER_GUIDE.md').read_text(encoding='utf-8').split('\n\n'):
    if not paragraph.strip():continue
    if paragraph.startswith('# '):blocks.append('<h1>'+inline(paragraph[2:])+'</h1>')
    elif paragraph.startswith('## '):blocks.append('<h2>'+inline(paragraph[3:])+'</h2>')
    elif paragraph.startswith('- '):blocks.append('<ul>'+''.join('<li>'+inline(line[2:])+'</li>' for line in paragraph.splitlines())+'</ul>')
    else:blocks.append('<p>'+inline(paragraph.replace('\n',' '))+'</p>')
header='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;"><title>ProView user guide</title><style>body{font:17px/1.65 system-ui,sans-serif;max-width:860px;margin:40px auto;padding:0 24px;color:#172333;background:#fafcfd}h1,h2{line-height:1.2;color:#12483f}h2{margin-top:38px}code{background:#e8eff1;padding:2px 5px}a{color:#095d77}li{margin:10px 0}</style></head><body>'''
(root/'docs/USER_GUIDE.html').write_text(header+'\n'.join(blocks)+'</body></html>',encoding='utf-8')
