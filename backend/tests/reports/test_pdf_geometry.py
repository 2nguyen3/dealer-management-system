import shutil
import subprocess
from xml.etree import ElementTree

import pytest
from PIL import Image
from reportlab.pdfbase import pdfmetrics

from app.modules.document_history.printing import FONT, register_font


@pytest.mark.integration
def test_rendered_pdf_word_boxes_are_inside_page_and_do_not_overlap(
    tmp_path, report_resource_artifacts
):
    executable = shutil.which("pdftotext")
    assert executable, "Explicit PDF geometry check requires installed pdftotext"
    source = report_resource_artifacts / "m30-visual-cash.pdf"
    assert source.is_file()
    output = tmp_path / "geometry.html"
    subprocess.run(
        [executable, "-bbox-layout", "-enc", "UTF-8", str(source), str(output)],
        check=True,
        capture_output=True,
        timeout=60,
    )
    root = ElementTree.parse(output).getroot()
    ns = {"h": "http://www.w3.org/1999/xhtml"}
    pages = root.findall(".//h:page", ns)
    assert len(pages) >= 15
    count = 0
    for page in pages:
        width, height = float(page.get("width")), float(page.get("height"))
        boxes = []
        for word in page.findall(".//h:word", ns):
            left, top, right, bottom = (
                float(word.get(key)) for key in ("xMin", "yMin", "xMax", "yMax")
            )
            assert 30 <= left < right <= width - 30, word.text
            assert 20 <= top < bottom <= height - 15, word.text
            for other_left, other_top, other_right, other_bottom, text in boxes:
                overlap_x = min(right, other_right) - max(left, other_left)
                overlap_y = min(bottom, other_bottom) - max(top, other_top)
                assert overlap_x <= 0.5 or overlap_y <= 0.5, (word.text, text)
            boxes.append((left, top, right, bottom, word.text))
        assert boxes
        count += len(boxes)
    assert count > 1000
    rasterizer = shutil.which("pdftoppm")
    assert rasterizer, "Explicit PDF raster check requires installed pdftoppm"
    subprocess.run(
        [rasterizer, "-png", "-r", "72", str(source), str(tmp_path / "page")],
        check=True,
        capture_output=True,
        timeout=120,
    )
    images = list(tmp_path.glob("page-*.png"))
    assert len(images) == len(pages)
    for filename in images:
        with Image.open(filename) as image:
            ink = image.convert("L").point(lambda value: 255 if value < 230 else 0)
            bounds = ink.getbbox()
            assert bounds, filename.name
            left, top, right, bottom = bounds
            # Rasterized grid strokes extend beyond the text boxes by a few pixels.
            assert 28 <= left < right <= image.width - 28, filename.name
            assert 20 <= top < bottom <= image.height - 15, filename.name
    register_font()
    glyphs = pdfmetrics.getFont(FONT).face.charToGlyph
    vietnamese = "\u0110\u1ea1i l\u00fd Nguy\u1ec5n \u00c1nh \u0110\u01a1n v\u1ecb l\u1ebb"
    assert all(glyphs.get(ord(character), 0) for character in vietnamese if not character.isspace())
