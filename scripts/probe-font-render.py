import sys
from pathlib import Path
sys.path.insert(0,str(Path('.pdf-qa/lib').resolve()))
import fitz
for name in ['font-true', 'font-false', 'font-probe']:
    doc=fitz.open('artifacts/pdf/'+name+'.pdf')
    doc[0].get_pixmap().save('artifacts/pdf/'+name+'.png')
    print(name, Path('artifacts/pdf/'+name+'.pdf').stat().st_size, doc[0].get_text())
