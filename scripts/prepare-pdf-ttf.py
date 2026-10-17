import sys
from pathlib import Path
sys.path.insert(0,str(Path('.pdf-qa/lib').resolve()))
from fontTools.ttLib import TTFont
font = TTFont('public/fonts/NotoSansSC-Regular.woff2')
font.flavor = None
font.save('public/fonts/NotoSansSC-Regular.ttf')
print('TTF bytes', Path('public/fonts/NotoSansSC-Regular.ttf').stat().st_size)
