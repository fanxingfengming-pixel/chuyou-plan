import sys
from pathlib import Path
sys.path.insert(0, str(Path('.pdf-qa/lib').resolve()))
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
font = TTFont('assets/pdf-font/NotoSansSC-VF.ttf')
instantiateVariableFont(font, {'wght': 400}, inplace=True)
font.flavor = None
font.save('public/fonts/NotoSansSC-Regular.ttf')
print('static font bytes:', Path('public/fonts/NotoSansSC-Regular.ttf').stat().st_size)
