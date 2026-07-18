from __future__ import annotations

import argparse
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "docs" / "XtalLoop_开题补充材料_内容底稿.md"
DEFAULT_OUTPUT = ROOT / "output" / "pdf" / "XtalLoop_开题补充材料.pdf"


def register_fonts() -> tuple[str, str]:
    candidates = [
        (Path(r"C:\Windows\Fonts\Deng.ttf"), Path(r"C:\Windows\Fonts\Dengb.ttf")),
        (Path(r"C:\Windows\Fonts\simhei.ttf"), Path(r"C:\Windows\Fonts\simhei.ttf")),
        (
            Path(r"C:\Windows\Fonts\Noto Sans SC (TrueType).otf"),
            Path(r"C:\Windows\Fonts\Noto Sans SC Bold (TrueType).otf"),
        ),
        (Path(r"C:\Windows\Fonts\msyh.ttc"), Path(r"C:\Windows\Fonts\msyhbd.ttc")),
    ]
    for regular, bold in candidates:
        if regular.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont("XtalBody", str(regular)))
            pdfmetrics.registerFont(TTFont("XtalBold", str(bold)))
            return "XtalBody", "XtalBold"
    return "Helvetica", "Helvetica-Bold"


BODY_FONT, BOLD_FONT = register_fonts()


def xml_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def inline_markup(text: str) -> str:
    text = xml_escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', text)
    return text


def make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=base["Title"],
            fontName=BOLD_FONT,
            fontSize=28,
            leading=34,
            textColor=colors.HexColor("#0F172A"),
            alignment=TA_CENTER,
            spaceAfter=10,
        ),
        "cover_subtitle": ParagraphStyle(
            "cover_subtitle",
            parent=base["Normal"],
            fontName=BODY_FONT,
            fontSize=13,
            leading=20,
            textColor=colors.HexColor("#334155"),
            alignment=TA_CENTER,
            spaceAfter=12,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontName=BOLD_FONT,
            fontSize=22,
            leading=28,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName=BOLD_FONT,
            fontSize=18,
            leading=23,
            textColor=colors.HexColor("#1E3A8A"),
            spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["BodyText"],
            fontName=BODY_FONT,
            fontSize=9.2,
            leading=13.5,
            textColor=colors.HexColor("#1F2937"),
            spaceAfter=5,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            parent=base["BodyText"],
            fontName=BODY_FONT,
            fontSize=9,
            leading=13,
            leftIndent=10,
            firstLineIndent=-7,
            textColor=colors.HexColor("#1F2937"),
            spaceAfter=3,
        ),
        "quote": ParagraphStyle(
            "quote",
            parent=base["BodyText"],
            fontName=BOLD_FONT,
            fontSize=10.5,
            leading=15,
            alignment=TA_LEFT,
            textColor=colors.HexColor("#0F766E"),
            backColor=colors.HexColor("#ECFDF5"),
            borderColor=colors.HexColor("#99F6E4"),
            borderWidth=0.6,
            borderPadding=7,
            spaceAfter=8,
        ),
        "code": ParagraphStyle(
            "code",
            parent=base["Code"],
            fontName="Courier",
            fontSize=7.8,
            leading=10,
            textColor=colors.HexColor("#111827"),
            backColor=colors.HexColor("#F8FAFC"),
            borderColor=colors.HexColor("#CBD5E1"),
            borderWidth=0.4,
            borderPadding=6,
            spaceAfter=7,
        ),
        "table": ParagraphStyle(
            "table",
            parent=base["BodyText"],
            fontName=BODY_FONT,
            fontSize=7.7,
            leading=10,
            textColor=colors.HexColor("#111827"),
        ),
        "table_header": ParagraphStyle(
            "table_header",
            parent=base["BodyText"],
            fontName=BOLD_FONT,
            fontSize=7.8,
            leading=10,
            textColor=colors.white,
        ),
    }


STYLES = make_styles()


def split_pages(markdown: str) -> list[str]:
    pages = re.split(r"\n---+\n", markdown)
    pages = [page.strip() for page in pages if page.strip()]
    if pages and pages[0].startswith("# XtalLoop 开题补充材料内容底稿"):
        pages = pages[1:]
    return pages


def is_table_start(lines: list[str], index: int) -> bool:
    return (
        index + 1 < len(lines)
        and lines[index].strip().startswith("|")
        and re.match(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$", lines[index + 1])
        is not None
    )


def parse_table(lines: list[str], start: int) -> tuple[Table, int]:
    table_lines: list[str] = []
    index = start
    while index < len(lines) and lines[index].strip().startswith("|"):
        table_lines.append(lines[index].strip())
        index += 1

    rows = []
    for line_no, line in enumerate(table_lines):
        if line_no == 1:
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        style = STYLES["table_header"] if line_no == 0 else STYLES["table"]
        rows.append([Paragraph(inline_markup(cell), style) for cell in cells])

    if not rows:
        return Table([[""]]), index

    col_count = max(len(row) for row in rows)
    normalized = [row + [""] * (col_count - len(row)) for row in rows]
    table = Table(normalized, hAlign="LEFT", repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), BOLD_FONT),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table, index


def parse_code_block(lines: list[str], start: int) -> tuple[Preformatted, int]:
    index = start + 1
    collected: list[str] = []
    while index < len(lines) and not lines[index].strip().startswith("```"):
        collected.append(lines[index])
        index += 1
    if index < len(lines):
        index += 1
    return Preformatted("\n".join(collected), STYLES["code"]), index


def render_page(page: str, page_index: int) -> list:
    lines = page.splitlines()
    story: list = []
    index = 0
    while index < len(lines):
        raw = lines[index]
        line = raw.strip()
        if not line:
            story.append(Spacer(1, 3))
            index += 1
            continue
        if line.startswith("```"):
            block, index = parse_code_block(lines, index)
            story.append(block)
            continue
        if is_table_start(lines, index):
            table, index = parse_table(lines, index)
            story.append(table)
            story.append(Spacer(1, 7))
            continue
        if line.startswith("# "):
            style = STYLES["cover_title"] if page_index == 0 else STYLES["h1"]
            story.append(Spacer(1, 18 if page_index == 0 else 0))
            story.append(Paragraph(inline_markup(line[2:].strip()), style))
            index += 1
            continue
        if line.startswith("## "):
            if page_index == 0:
                index += 1
                continue
            story.append(Paragraph(inline_markup(line[3:].strip()), STYLES["h2"]))
            index += 1
            continue
        if line.startswith("> "):
            story.append(Paragraph(inline_markup(line[2:].strip()), STYLES["quote"]))
            index += 1
            continue
        if line.startswith("- "):
            story.append(Paragraph(f"• {inline_markup(line[2:].strip())}", STYLES["bullet"]))
            index += 1
            continue
        if re.match(r"^\d+\.\s+", line):
            story.append(Paragraph(inline_markup(line), STYLES["bullet"]))
            index += 1
            continue
        if page_index == 0:
            if line.startswith("**") and line.endswith("**"):
                story.append(Spacer(1, 35))
                story.append(Paragraph(inline_markup(line.strip("*")), STYLES["cover_title"]))
            else:
                story.append(Paragraph(inline_markup(line), STYLES["cover_subtitle"]))
        else:
            story.append(Paragraph(inline_markup(line), STYLES["body"]))
        index += 1
    return story


def draw_page(canvas, doc):
    width, height = landscape(A4)
    page_no = canvas.getPageNumber()
    canvas.saveState()
    canvas.setFillColor(colors.HexColor("#E0F2FE"))
    canvas.rect(0, height - 12 * mm, width, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#0F172A"))
    canvas.setFont(BOLD_FONT, 8)
    canvas.drawString(15 * mm, height - 7.8 * mm, "XtalLoop | AI 实验研发加速器")
    canvas.setFont(BODY_FONT, 7)
    canvas.setFillColor(colors.HexColor("#475569"))
    canvas.drawRightString(width - 15 * mm, 8 * mm, f"{page_no}")
    canvas.restoreState()


def build_pdf(input_path: Path, output_path: Path) -> None:
    markdown = input_path.read_text(encoding="utf-8")
    pages = split_pages(markdown)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=landscape(A4),
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=18 * mm,
        bottomMargin=13 * mm,
        title="XtalLoop Submission Supplement",
        author="XtalLoop",
    )

    story: list = []
    for page_index, page in enumerate(pages):
        if page_index > 0:
            story.append(PageBreak())
        story.extend(render_page(page, page_index))

    doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)
    build_pdf(input_path, output_path)
    print(f"PDF written: {output_path}")


if __name__ == "__main__":
    main()
