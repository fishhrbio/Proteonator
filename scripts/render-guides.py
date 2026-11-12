"""Render self-contained local help without runtime network dependencies."""
from pathlib import Path
import html,re
root=Path(__file__).resolve().parents[1]
def inline(text):
    text=html.escape(text)
    text=re.sub(r'\[([^\]]+)\]\(([^\s)]+)\)',lambda m:'<a href="'+m[2].replace('SCIENCE.md','SCIENCE.html')+'">'+m[1]+'</a>',text)
    text=re.sub(r'\*\*(.+?)\*\*',r'<strong>\1</strong>',text)
    return re.sub(r'`(.+?)`',r'<code>\1</code>',text)
for name in ['USER_GUIDE','SCIENCE']:
    blocks=[]
    for block in (root/'docs'/f'{name}.md').read_text(encoding='utf8').strip().split('\n\n'):
        lines=block.splitlines()
        if block.startswith('#'):
            n=len(block)-len(block.lstrip('#'));blocks.append(f'<h{n}>'+inline(block[n:].strip())+f'</h{n}>')
        elif block.startswith('|'):
            rows=[[c.strip() for c in line.strip('|').split('|')] for line in lines]
            blocks.append('<div class="table"><table><thead><tr>'+''.join('<th>'+inline(c)+'</th>' for c in rows[0])+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+inline(c)+'</td>' for c in row)+'</tr>' for row in rows[2:])+'</tbody></table></div>')
        elif block.startswith('- '):blocks.append('<ul>'+''.join('<li>'+inline(line[2:])+'</li>' for line in lines)+'</ul>')
        else:blocks.append('<p>'+inline(' '.join(lines))+'</p>')
    title='Proteonator '+('user guide' if name=='USER_GUIDE' else 'scientific methods')
    css="body{max-width:920px;margin:40px auto;padding:0 24px;background:#101b29;color:#e8f1fa;font:16px/1.7 system-ui}h1,h2,h3,a{color:#86e6d3}h2{margin-top:2em}code{color:#ffc47e}li{margin:.7em 0}table{border-collapse:collapse;font-size:14px}td,th{border:1px solid #60778d;padding:10px;text-align:left}.table{overflow:auto}nav{display:flex;gap:22px}a:focus-visible{outline:3px solid #ffc47e}"
    (root/'docs'/f'{name}.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>'+css+'</style><nav><a href="USER_GUIDE.html">User guide</a><a href="SCIENCE.html">Scientific methods</a></nav><main>'+''.join(blocks)+'</main></html>',encoding='utf8')
