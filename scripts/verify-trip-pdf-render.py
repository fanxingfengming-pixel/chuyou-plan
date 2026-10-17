import sys, json
from pathlib import Path
sys.path.insert(0, str(Path('.pdf-qa/lib').resolve()))
import fitz
out = Path('artifacts/pdf')
files = [p for p in out.glob('*.pdf') if not p.name.startswith('font-')]
results = []
for file in files:
    doc = fitz.open(file)
    for xref in {font[0] for page in doc for font in page.get_fonts()}:
        embedded = doc.extract_font(xref)[3]
        assert embedded, (file, 'font is not embedded')
        raster_font = fitz.Font(fontbuffer=embedded)
        assert raster_font.glyph_count > 1, (file, 'unreadable embedded font')
    texts = [page.get_text() for page in doc]
    complete = '\n'.join(texts)
    assert '出游plan' in complete, file
    assert '杭州旅行行程' in complete, file
    assert '文件导出时间' in complete, file
    assert '\ufffd' not in complete, file
    issues = []
    for i, page in enumerate(doc):
        assert f'{i + 1} / {len(doc)}' in texts[i], (file, i)
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                for span in line['spans']:
                    x0, y0, x1, y1 = span['bbox']
                    if x0 < 40 or x1 > page.rect.width - 39 or y0 < 14 or y1 > page.rect.height - 17:
                        issues.append({'page': i+1, 'text': span['text'], 'bbox': span['bbox']})
    assert not issues, issues[:3]
    if file.name == 'sample-itinerary.pdf':
        assert '本日暂无已安排地点' in complete
        assert '未选择酒店不应导出' not in complete
        for i, page in enumerate(doc):
            page.get_pixmap(matrix=fitz.Matrix(1.35,1.35)).save(out / f'sample-page-{i+1}.png')
    if file.name == 'long-itinerary.pdf':
        assert '第 30 天' in complete
        for i in [0, len(doc)//2, len(doc)-1]:
            doc[i].get_pixmap(matrix=fitz.Matrix(1.1,1.1)).save(out / f'long-page-{i+1}.png')
    results.append({'file': str(file), 'pages': len(doc), 'bytes': file.stat().st_size, 'all_text_inside_page': True, 'chinese_text_extractable': True})
(out / 'pdf-checks.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps(results, ensure_ascii=False))
