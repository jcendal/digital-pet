"""Render the public Spanish legal documents. Requires reportlab 4.x.

The checked-in PDFs avoid adding Python to web CI. The static export verifies
both their checksums and the source checksum, so stale PDFs cannot be deployed.
"""

import hashlib
import json
from pathlib import Path
from xml.sax.saxutils import escape

import reportlab
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/server/legal/documents.es.json"
OUTPUT = ROOT / "assets/legal"
OUTPUT.mkdir(parents=True, exist_ok=True)
data = json.loads(SOURCE.read_text(encoding="utf-8"))
font_dir = Path(reportlab.__file__).parent / "fonts"
pdfmetrics.registerFont(TTFont("Legal", str(font_dir / "Vera.ttf")))
pdfmetrics.registerFont(TTFont("LegalBold", str(font_dir / "VeraBd.ttf")))
pdfmetrics.registerFontFamily("Legal", normal="Legal", bold="LegalBold")

INK = colors.HexColor("#22321D")
GREEN = colors.HexColor("#53633E")
body = ParagraphStyle(
    "Body", fontName="Legal", fontSize=10, leading=14.5,
    textColor=INK, spaceAfter=7, alignment=TA_LEFT, allowWidows=0, allowOrphans=0,
)
heading = ParagraphStyle(
    "Heading", parent=body, fontName="LegalBold", fontSize=11.5,
    leading=16, spaceBefore=13, spaceAfter=7, keepWithNext=True,
)
title = ParagraphStyle(
    "Title", parent=body, fontName="LegalBold", fontSize=25,
    leading=30, spaceBefore=10, spaceAfter=12,
)
summary = ParagraphStyle(
    "Summary", parent=body, fontSize=10.5, leading=16,
    backColor=colors.HexColor("#EDF0E5"), borderPadding=10, spaceAfter=16,
)
small = ParagraphStyle("Small", parent=body, fontSize=8, leading=12, textColor=GREEN)


def decorate(canvas, document):
    width, height = A4
    canvas.saveState()
    canvas.setStrokeColor(GREEN)
    canvas.setLineWidth(0.6)
    canvas.line(46, height - 43, width - 46, height - 43)
    canvas.setFont("LegalBold", 8)
    canvas.setFillColor(INK)
    canvas.drawString(46, height - 32, "DIGITAL PET")
    canvas.setFont("Legal", 7)
    canvas.drawRightString(width - 46, height - 32, document.title)
    canvas.line(46, 43, width - 46, 43)
    canvas.drawString(46, 30, f"digital-pet.rebase.es | {data['updated']}")
    canvas.drawRightString(width - 46, 30, f"{document.page}")
    canvas.restoreState()


manifest = {"source": hashlib.sha256(SOURCE.read_bytes()).hexdigest()}
for slug in ("privacy", "terms"):
    content = data[slug]
    destination = OUTPUT / f"{slug}.pdf"
    document = SimpleDocTemplate(
        str(destination), pagesize=A4, leftMargin=46, rightMargin=46,
        topMargin=57, bottomMargin=56, title=content["title"],
        author=data["owner"], subject=f"Digital Pet | Versión {data['version']}",
        lang="es-ES", pageCompression=1, invariant=1,
    )
    logo = Image(str(ROOT.parents[1] / "assets/branding/logo.png"), width=36, height=36)
    logo.hAlign = "LEFT"
    story = [logo, Paragraph(escape(content["title"]), title)]
    story.append(Paragraph(f"Última actualización: {escape(data['updated'])}", small))
    story.append(Spacer(1, 12))
    story.append(Paragraph(escape(content["summary"]), summary))
    for page_index, sections in enumerate(content["pages"]):
        if page_index:
            story.append(PageBreak())
        for section in sections:
            story.append(Paragraph(escape(section["title"]), heading))
            story.extend(Paragraph(escape(text), body) for text in section["paragraphs"])
    story.append(Paragraph("Enlaces de consulta", heading))
    for link in content["links"]:
        url = escape(link["url"], {'"': "&quot;"})
        story.append(Paragraph(f'<link href="{url}" color="#2E4D26"><u>{escape(link["label"])}</u></link>', body))
    canonical = f"{data['origin']}/legal/{slug}"
    story.append(Spacer(1, 8))
    story.append(Paragraph(f'Versión web: <link href="{canonical}">{canonical}</link>', small))
    document.build(story, onFirstPage=decorate, onLaterPages=decorate)
    manifest[slug] = hashlib.sha256(destination.read_bytes()).hexdigest()
    print(destination)

(OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
