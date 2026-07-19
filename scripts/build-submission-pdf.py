# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "docs" / "XtalLoop_开题补充材料_内容底稿.md"
DEFAULT_OUTPUT = ROOT / "output" / "pdf" / "XtalLoop_开题补充材料.pdf"

PAGE_W, PAGE_H = landscape(A4)


def register_fonts() -> tuple[str, str]:
    candidates = [
        (Path(r"C:\Windows\Fonts\Deng.ttf"), Path(r"C:\Windows\Fonts\Dengb.ttf")),
        (Path(r"C:\Windows\Fonts\msyh.ttc"), Path(r"C:\Windows\Fonts\msyhbd.ttc")),
        (Path(r"C:\Windows\Fonts\simhei.ttf"), Path(r"C:\Windows\Fonts\simhei.ttf")),
        (
            Path(r"C:\Windows\Fonts\Noto Sans SC (TrueType).otf"),
            Path(r"C:\Windows\Fonts\Noto Sans SC Bold (TrueType).otf"),
        ),
    ]
    for regular, bold in candidates:
        if regular.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont("XtalBody", str(regular)))
            pdfmetrics.registerFont(TTFont("XtalBold", str(bold)))
            return "XtalBody", "XtalBold"
    return "Helvetica", "Helvetica-Bold"


BODY_FONT, BOLD_FONT = register_fonts()


def h(hex_value: str) -> colors.Color:
    return colors.HexColor(hex_value)


PALETTE = {
    "navy": h("#0B1F4D"),
    "blue": h("#1D4ED8"),
    "blue2": h("#2563EB"),
    "sky": h("#0EA5E9"),
    "cyan": h("#22D3EE"),
    "ice": h("#EAF6FF"),
    "ice2": h("#F3F8FF"),
    "bg": h("#F8FBFF"),
    "white": colors.white,
    "ink": h("#0F172A"),
    "muted": h("#64748B"),
    "line": h("#D7E6F7"),
    "green": h("#10B981"),
    "green_bg": h("#ECFDF5"),
    "orange": h("#F59E0B"),
    "orange_bg": h("#FFF7ED"),
    "red": h("#EF4444"),
    "red_bg": h("#FEF2F2"),
}


def xml_escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline_markup(text: str) -> str:
    escaped = xml_escape(text)
    escaped = re.sub(
        r"\*\*(.+?)\*\*",
        rf'<font name="{BOLD_FONT}">\1</font>',
        escaped,
    )
    return escaped.replace("\n", "<br/>")


def style(
    name: str,
    size: float,
    leading: float | None = None,
    color: colors.Color | None = None,
    font: str | None = None,
    align: int = TA_LEFT,
    space_after: float = 0,
) -> ParagraphStyle:
    return ParagraphStyle(
        name,
        fontName=font or BODY_FONT,
        fontSize=size,
        leading=leading or size * 1.35,
        textColor=color or PALETTE["ink"],
        alignment=align,
        spaceAfter=space_after,
        wordWrap="CJK",
    )


STYLES = {
    "eyebrow": style("eyebrow", 8.5, 11, PALETTE["blue"], BOLD_FONT),
    "title": style("title", 24, 30, PALETTE["ink"], BOLD_FONT),
    "subtitle": style("subtitle", 10.5, 15, PALETTE["muted"]),
    "body": style("body", 9.4, 13.2, PALETTE["ink"]),
    "body_muted": style("body_muted", 8.7, 12.4, PALETTE["muted"]),
    "card_title": style("card_title", 11, 14, PALETTE["navy"], BOLD_FONT),
    "card_body": style("card_body", 8.6, 12.2, PALETTE["ink"]),
    "small": style("small", 7.6, 10.2, PALETTE["muted"]),
    "metric": style("metric", 19, 22, PALETTE["blue"], BOLD_FONT, TA_CENTER),
    "metric_label": style("metric_label", 7.6, 10, PALETTE["muted"], BODY_FONT, TA_CENTER),
    "code": style("code", 7.3, 9.5, h("#172033"), "Courier"),
    "white_title": style("white_title", 30, 37, colors.white, BOLD_FONT),
    "white_subtitle": style("white_subtitle", 11.5, 16, h("#DCEEFF")),
}


def yt(y_from_top: float) -> float:
    return PAGE_H - y_from_top


def draw_para(
    c: canvas.Canvas,
    text: str,
    x: float,
    y_from_top: float,
    width: float,
    pstyle: ParagraphStyle,
    max_height: float = 500,
) -> float:
    para = Paragraph(inline_markup(text), pstyle)
    _, para_h = para.wrap(width, max_height)
    para.drawOn(c, x, yt(y_from_top) - para_h)
    return para_h


def round_rect(
    c: canvas.Canvas,
    x: float,
    y_from_top: float,
    width: float,
    height: float,
    fill: colors.Color,
    stroke: colors.Color | None = None,
    radius: float = 14,
    stroke_width: float = 0.8,
) -> None:
    c.saveState()
    c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(stroke_width)
        c.roundRect(x, yt(y_from_top + height), width, height, radius, fill=1, stroke=1)
    else:
        c.roundRect(x, yt(y_from_top + height), width, height, radius, fill=1, stroke=0)
    c.restoreState()


def soft_shadow(c: canvas.Canvas, x: float, y: float, width: float, height: float) -> None:
    c.saveState()
    c.setFillColor(h("#DCEBFF"))
    try:
        c.setFillAlpha(0.35)
    except AttributeError:
        pass
    c.roundRect(x + 2.5, yt(y + height + 3), width, height, 14, fill=1, stroke=0)
    try:
        c.setFillAlpha(1)
    except AttributeError:
        pass
    c.restoreState()


def draw_badge(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    fill: colors.Color = PALETTE["ice"],
    color: colors.Color = PALETTE["blue"],
    width: float | None = None,
) -> float:
    text_width = pdfmetrics.stringWidth(text, BOLD_FONT, 8.2)
    box_w = width or text_width + 18
    round_rect(c, x, y, box_w, 22, fill, None, radius=11)
    c.setFont(BOLD_FONT, 8.2)
    c.setFillColor(color)
    c.drawCentredString(x + box_w / 2, yt(y + 14.5), text)
    return box_w


def draw_title(
    c: canvas.Canvas,
    page_no: int,
    section: str,
    title: str,
    subtitle: str | None = None,
) -> None:
    draw_para(c, section.upper(), 42, 34, 260, STYLES["eyebrow"])
    draw_para(c, title, 42, 52, 520, STYLES["title"])
    if subtitle:
        draw_para(c, subtitle, 42, 87, 560, STYLES["subtitle"])
    c.setStrokeColor(PALETTE["line"])
    c.setLineWidth(1)
    c.line(42, yt(116), PAGE_W - 42, yt(116))
    draw_footer(c, page_no)


def draw_footer(c: canvas.Canvas, page_no: int) -> None:
    c.saveState()
    c.setStrokeColor(h("#DCE8F8"))
    c.setLineWidth(0.6)
    c.line(42, 34, PAGE_W - 42, 34)
    c.setFont(BODY_FONT, 7.2)
    c.setFillColor(PALETTE["muted"])
    c.drawString(42, 20, "XtalLoop | AI 实验研发加速器")
    c.drawRightString(PAGE_W - 42, 20, f"{page_no:02d} / 14")
    c.restoreState()


def draw_background(c: canvas.Canvas) -> None:
    c.setFillColor(PALETTE["bg"])
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.saveState()
    c.setFillColor(PALETTE["ice"])
    c.circle(PAGE_W - 40, PAGE_H + 15, 145, fill=1, stroke=0)
    c.setFillColor(h("#DDF4FF"))
    c.circle(PAGE_W - 125, PAGE_H - 22, 78, fill=1, stroke=0)
    c.setFillColor(h("#F0F7FF"))
    c.circle(18, 80, 96, fill=1, stroke=0)
    c.restoreState()


def draw_card(
    c: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    title: str,
    body: str,
    accent: colors.Color = PALETTE["blue"],
    fill: colors.Color = PALETTE["white"],
    title_width: float | None = None,
) -> None:
    soft_shadow(c, x, y, width, height)
    round_rect(c, x, y, width, height, fill, PALETTE["line"], radius=15)
    c.saveState()
    c.setFillColor(accent)
    c.roundRect(x, yt(y + height), 5, height, 2.5, fill=1, stroke=0)
    c.restoreState()
    draw_para(c, title, x + 17, y + 16, title_width or width - 30, STYLES["card_title"])
    draw_para(c, body, x + 17, y + 38, width - 31, STYLES["card_body"], max_height=height - 42)


def draw_numbered_card(
    c: canvas.Canvas,
    number: str,
    title: str,
    body: str,
    x: float,
    y: float,
    width: float,
    height: float,
    accent: colors.Color,
) -> None:
    draw_card(c, x, y, width, height, title, body, accent)
    c.saveState()
    c.setFillColor(accent)
    c.circle(x + width - 27, yt(y + 27), 14, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont(BOLD_FONT, 9.5)
    c.drawCentredString(x + width - 27, yt(y + 31), number)
    c.restoreState()


def draw_bullet_list(
    c: canvas.Canvas,
    items: list[str],
    x: float,
    y: float,
    width: float,
    pstyle: ParagraphStyle = STYLES["card_body"],
    gap: float = 7,
    color: colors.Color = PALETTE["blue"],
) -> float:
    cursor = y
    for item in items:
        c.saveState()
        c.setFillColor(color)
        c.circle(x + 4, yt(cursor + 7), 2.4, fill=1, stroke=0)
        c.restoreState()
        used = draw_para(c, item, x + 13, cursor, width - 13, pstyle, max_height=90)
        cursor += used + gap
    return cursor - y


def draw_arrow(c: canvas.Canvas, x1: float, y1: float, x2: float, y2: float, color: colors.Color) -> None:
    c.saveState()
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(1.6)
    c.line(x1, yt(y1), x2, yt(y2))
    if abs(y2 - y1) < abs(x2 - x1):
        direction = 1 if x2 > x1 else -1
        c.line(x2, yt(y2), x2 - direction * 8, yt(y2 - 4))
        c.line(x2, yt(y2), x2 - direction * 8, yt(y2 + 4))
    else:
        direction = 1 if y2 > y1 else -1
        c.line(x2, yt(y2), x2 - 4, yt(y2 - direction * 8))
        c.line(x2, yt(y2), x2 + 4, yt(y2 - direction * 8))
    c.restoreState()


def draw_metric_card(
    c: canvas.Canvas,
    value: str,
    label: str,
    x: float,
    y: float,
    width: float,
    height: float,
    accent: colors.Color = PALETTE["blue"],
) -> None:
    soft_shadow(c, x, y, width, height)
    round_rect(c, x, y, width, height, colors.white, PALETTE["line"], radius=16)
    draw_para(c, value, x + 8, y + 18, width - 16, style("metric_local", 20, 22, accent, BOLD_FONT, TA_CENTER))
    draw_para(c, label, x + 12, y + 48, width - 24, STYLES["metric_label"])


def draw_code_block(c: canvas.Canvas, lines: list[str], x: float, y: float, width: float, height: float) -> None:
    round_rect(c, x, y, width, height, h("#0B1220"), None, radius=13)
    c.saveState()
    c.setFillColor(h("#FF5F57"))
    c.circle(x + 16, yt(y + 18), 4, fill=1, stroke=0)
    c.setFillColor(h("#FFBD2E"))
    c.circle(x + 29, yt(y + 18), 4, fill=1, stroke=0)
    c.setFillColor(h("#28C840"))
    c.circle(x + 42, yt(y + 18), 4, fill=1, stroke=0)
    c.setFont("Courier", 7.4)
    yy = y + 39
    for line in lines:
        color = h("#92D7FF") if line.startswith("$") else h("#E5EDF7")
        c.setFillColor(color)
        c.drawString(x + 16, yt(yy), line)
        yy += 14
    c.restoreState()


def draw_network(c: canvas.Canvas, x: float, y: float, width: float, height: float) -> None:
    nodes = [
        ("Meeting", x + 52, y + 44, PALETTE["blue"]),
        ("Claim", x + 177, y + 33, PALETTE["sky"]),
        ("Base", x + 265, y + 94, PALETTE["green"]),
        ("Task", x + 108, y + 134, PALETTE["orange"]),
        ("Wiki", x + 221, y + 178, PALETTE["blue2"]),
        ("Graph", x + 64, y + 217, PALETTE["cyan"]),
    ]
    edges = [(0, 1), (1, 2), (1, 3), (2, 4), (3, 4), (4, 5), (5, 0)]
    c.saveState()
    for a, b in edges:
        _, ax, ay, _ = nodes[a]
        _, bx, by, _ = nodes[b]
        c.setStrokeColor(h("#B9D7F5"))
        c.setLineWidth(1.2)
        c.line(ax, yt(ay), bx, yt(by))
    for label, nx, ny, color in nodes:
        c.setFillColor(colors.white)
        c.setStrokeColor(h("#CFE2F7"))
        c.setLineWidth(1)
        c.circle(nx, yt(ny), 24, fill=1, stroke=1)
        c.setFillColor(color)
        c.circle(nx, yt(ny), 15, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont(BOLD_FONT, 6.5)
        c.drawCentredString(nx, yt(ny + 3), label[:2])
        c.setFillColor(PALETTE["muted"])
        c.setFont(BODY_FONT, 6.3)
        c.drawCentredString(nx, yt(ny + 33), label)
    c.restoreState()


def slide_cover(c: canvas.Canvas) -> None:
    c.setFillColor(colors.white)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.saveState()
    c.setFillColor(PALETTE["navy"])
    c.rect(PAGE_W * 0.58, 0, PAGE_W * 0.42, PAGE_H, fill=1, stroke=0)
    c.setFillColor(PALETTE["blue"])
    c.circle(PAGE_W - 45, PAGE_H - 35, 210, fill=1, stroke=0)
    c.setFillColor(h("#0EA5E9"))
    c.circle(PAGE_W - 235, 86, 130, fill=1, stroke=0)
    c.setFillColor(h("#F0F7FF"))
    c.circle(60, PAGE_H - 20, 145, fill=1, stroke=0)
    c.restoreState()

    draw_badge(c, "Feishu Meeting AI + Knowledge Graph", 48, 56, PALETTE["ice"], PALETTE["blue"], 225)
    draw_para(c, "XtalLoop", 48, 100, 380, style("cover_brand", 21, 25, PALETTE["blue"], BOLD_FONT))
    draw_para(c, "AI 实验研发加速器", 48, 137, 470, style("cover_title", 36, 45, PALETTE["ink"], BOLD_FONT))
    draw_para(
        c,
        "把研发会议中的实验参数、方案争议、风险判断、待办任务和失败经验，转成可追溯、可审阅、可写回、可复用的结构化研发知识。",
        50,
        202,
        420,
        style("cover_subtitle", 12.2, 18, PALETTE["muted"]),
    )
    x = 50
    for badge in ["Evidence-first", "Feishu-native", "Obsidian Graph", "24h 复用"]:
        used = draw_badge(c, badge, x, 290, PALETTE["ice2"], PALETTE["blue"])
        x += used + 10

    round_rect(c, 50, 338, 410, 92, h("#F2F8FF"), h("#C9E2FF"), radius=18)
    draw_para(c, "一句话价值", 72, 360, 120, style("cover_quote_title", 10, 13, PALETTE["blue"], BOLD_FONT))
    draw_para(
        c,
        "不把 AI 纪要当最终答案，而是把 transcript 拆成带证据锚点的研发 Claim，再进入飞书事实源与团队审阅闭环。",
        72,
        383,
        360,
        style("cover_quote", 11.2, 16.5, PALETTE["ink"], BOLD_FONT),
    )

    round_rect(c, 520, 84, 266, 360, h("#F8FBFF"), h("#9CD8FF"), radius=24)
    draw_para(c, "Research Flow Map", 548, 113, 190, style("network_title", 14, 17, PALETTE["navy"], BOLD_FONT))
    draw_network(c, 514, 147, 280, 250)
    draw_footer(c, 1)


def slide_pain(c: canvas.Canvas) -> None:
    draw_background(c)
    draw_title(c, 2, "01 / 命题再理解", "真正卡住的不是会议记录，而是研发知识流转")

    cards = [
        ("参数依据难追溯", "温度、转速、配比等调整常在讨论中形成，但会后难定位到说话人、时间戳和原始证据。", PALETTE["blue"]),
        ("方案争议难沉淀", "争议被压缩成一句结论，后续评审看不到反对理由、风险边界和备选方案。", PALETTE["sky"]),
        ("失败经验难复用", "高通量实验每天产生大量失败案例，但失败模式没有被索引，导致重复试错。", PALETTE["orange"]),
        ("跨团队节奏不同步", "算法、实验、物料、研发负责人分布在不同地域，口头共识很快变成信息差。", PALETTE["green"]),
    ]
    x0, y0, w, hgt = 48, 145, 355, 108
    for idx, (title, body, accent) in enumerate(cards):
        x = x0 + (idx % 2) * 390
        y = y0 + (idx // 2) * 132
        draw_numbered_card(c, f"{idx+1}", title, body, x, y, w, hgt, accent)

    round_rect(c, 80, 434, 682, 72, PALETTE["navy"], None, radius=20)
    draw_para(
        c,
        "核心洞察: 会议纪要如果不能变成可审阅的数据对象、可执行的任务对象和可复用的知识对象，就只能减少记录成本，不能减少研发摩擦。",
        112,
        456,
        618,
        style("insight", 13, 19, colors.white, BOLD_FONT, TA_CENTER),
    )


def slide_external(c: canvas.Canvas) -> None:
    draw_background(c)
    draw_title(c, 3, "02 / 外部洞察", "AI 会议助手、ELN/LIMS 与知识库正在融合，但中间缺一层研发语义")

    cols = [
        (
            "AI 会议助手",
            ["强项: 转写、总结、待办识别", "短板: 参数可信度与来源锚点不足", "风险: 结论被压缩后失去争议过程"],
            PALETTE["blue"],
        ),
        (
            "ELN / LIMS",
            ["强项: 实验记录、样品、流程合规", "短板: 会前/会中决策链路弱", "风险: 失败讨论留在系统外"],
            PALETTE["green"],
        ),
        (
            "企业知识库",
            ["强项: 文档沉淀与权限管理", "短板: 搜索常停在关键词层面", "风险: 文档有了，复用仍靠人记忆"],
            PALETTE["sky"],
        ),
    ]
    for idx, (title, items, accent) in enumerate(cols):
        x = 48 + idx * 255
        soft_shadow(c, x, 150, 226, 230)
        round_rect(c, x, 150, 226, 230, colors.white, PALETTE["line"], radius=20)
        draw_badge(c, f"0{idx+1}", x + 18, 172, PALETTE["ice"], accent, 44)
        draw_para(c, title, x + 18, 208, 180, style(f"ext_title_{idx}", 15, 19, PALETTE["navy"], BOLD_FONT))
        draw_bullet_list(c, items, x + 20, 250, 184, STYLES["card_body"], gap=12, color=accent)

    round_rect(c, 62, 418, 718, 78, h("#EFF8FF"), h("#B7DAFF"), radius=18)
    draw_para(c, "XtalLoop 的切入", 91, 438, 150, style("xtal_cut_title", 11, 15, PALETTE["blue"], BOLD_FONT))
    draw_para(
        c,
        "补齐“会议语义 -> 研发 Claim -> 飞书写回 -> 知识复用”的中间层，让会议 AI 从记录工具升级为实验研发流转基础设施。",
        91,
        465,
        650,
        style("xtal_cut", 12.2, 17.5, PALETTE["ink"], BOLD_FONT),
    )


def slide_solution(c: canvas.Canvas) -> None:
    draw_background(c)
    draw_title(c, 4, "03 / 整体方案", "以飞书为组织事实源，在上方叠加研发知识结构化 Agent")

    center_x, center_y = PAGE_W / 2, 290
    c.saveState()
    c.setFillColor(PALETTE["blue"])
    c.circle(center_x, yt(center_y), 64, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont(BOLD_FONT, 20)
    c.drawCentredString(center_x, yt(center_y - 2), "XtalLoop")
    c.setFont(BODY_FONT, 7.8)
    c.drawCentredString(center_x, yt(center_y + 22), "Research Claim Hub")
    c.restoreState()

    nodes = [
        ("飞书会议 / 妙记", "transcript 与会议产物", 90, 170, PALETTE["blue"]),
        ("结构化 Agent", "抽取参数/争议/风险/任务", 304, 140, PALETTE["sky"]),
        ("Base 审阅台", "Claim 状态、证据、版本", 557, 170, PALETTE["green"]),
        ("飞书任务", "责任人、截止时间、验收", 557, 360, PALETTE["orange"]),
        ("Docx / Wiki", "知识卡片与复盘沉淀", 302, 394, PALETTE["blue2"]),
        ("Obsidian", "个人图谱与低成本复用", 90, 360, PALETTE["cyan"]),
    ]
    for title, body, x, y, accent in nodes:
        draw_card(c, x, y, 185, 82, title, body, accent)
        draw_arrow(c, x + 92, y + 42, center_x, center_y, h("#A9CFF8"))

    draw_para(
        c,
        "设计边界: 飞书负责组织级事实源、权限和协作执行；Obsidian 只做个人研究工作台与可重建图谱，不替代企业事实源。",
        105,
        507,
        630,
        style("boundary", 10.5, 15, PALETTE["muted"], BOLD_FONT, TA_CENTER),
    )


def slide_loop(c: canvas.Canvas) -> None:
    draw_background(c)
    draw_title(c, 5, "04 / 研发闭环", "打通“方案研讨 - 实验执行 - 结果复盘 - 知识沉淀”")

    stages = [
        ("会前", "资料归集\n历史案例召回"),
        ("会中", "AI 转写\n参数与争议捕捉"),
        ("会后", "Claim 抽取\n任务拆解"),
        ("执行", "Base 追踪\nTask 承接"),
        ("复盘", "结果对齐\n风险更新"),
        ("沉淀", "Wiki 卡片\nObsidian 图谱"),
    ]
    start_x, box_w, gap, y = 50, 112, 24, 186
    for idx, (stage, body) in enumerate(stages):
        x = start_x + idx * (box_w + gap)
        round_rect(c, x, y, box_w, 112, colors.white, PALETTE["line"], radius=18)
        c.setFillColor(PALETTE["blue"] if idx < 3 else PALETTE["sky"])
        c.circle(x + box_w / 2, yt(y + 28), 17, fill=1, stroke=0)
        c.setFont(BOLD_FONT, 8.5)
        c.setFillColor(colors.white)
        c.drawCentredString(x + box_w / 2, yt(y + 32), f"{idx+1}")
        draw_para(c, stage, x + 14, y + 54, box_w - 28, style(f"loop_stage_{idx}", 11, 14, PALETTE["navy"], BOLD_FONT, TA_CENTER))
        draw_para(c, body, x + 14, y + 76, box_w - 28, style(f"loop_body_{idx}", 8.3, 11.3, PALETTE["muted"], BODY_FONT, TA_CENTER))
        if idx < len(stages) - 1:
            draw_arrow(c, x + box_w + 5, y + 56, x + box_w + gap - 4, y + 56, PALETTE["blue"])

    round_rect(c, 62, 350, 718, 118, h("#F0F8FF"), h("#B7DAFF"), radius=22)
    draw_para(c, "24 小时内完成的不是“总结一篇文档”，而是六类资产同步落地", 92, 374, 650, style("asset_title", 14, 18, PALETTE["navy"], BOLD_FONT, TA_CENTER))
    assets = ["实验参数", "争议依据", "风险提示", "待办任务", "结果复盘", "可复用案例"]
    x = 108
    for asset in assets:
        draw_badge(c, asset, x, 418, colors.white, PALETTE["blue"], 88)
        x += 103


def slide_claim(c: canvas.Canvas) -> None:
    draw_background(c)
    draw_title(c, 6, "05 / 数据对象", "最小核心不是文档，而是可追溯的 Scientific Claim")

    round_rect(c, 58, 145, 330, 322, colors.white, PALETTE["line"], radius=22)
    draw_para(c, "Claim Schema", 86, 170, 200, style("schema_title", 15, 19, PALETTE["blue"], BOLD_FONT))
    schema_lines = [
        ("claim_type", "parameter_change / risk / task"),
        ("subject", "EXP-DEMO-002"),
        ("predicate", "has_reaction_temperature"),
        ("object", "80°C -> 75°C"),
        ("verification_status", "IN_REVIEW"),
        ("source.speaker_id", "SPEAKER-01"),
        ("source.start_ms", "10000"),
        ("source.quote_hash", "sha256"),
    ]
    y = 214
    for key, value in schema_lines:
        c.setFont(BOLD_FONT, 7.8)
        c.setFillColor(PALETTE["muted"])
        c.drawString(88, yt(y), key)
        c.setFont(BODY_FONT, 8.2)
        c.setFillColor(PALETTE["ink"])
        c.drawString(216, yt(y), value)
        y += 27

    draw_card(
        c,
        426,
        150,
        350,
        90,
        "SourceAnchor 证据锚点",
        "每条 Claim 绑定说话人、时间戳、原文片段与 quote_hash。评审可以回到原始 transcript，而不是只看 AI 摘要。",
        PALETTE["green"],
    )
    draw_card(
        c,
        426,
        266,
        350,
        90,
        "默认 IN_REVIEW",
        "模型或规则抽取的结论默认不自动发布。关键参数、日期、风险和任务必须经过人工审阅后再写回事实源。",
        PALETTE["orange"],
    )
    draw_card(
        c,
        426,
        382,
        350,
        90,
        "复用但不污染",
        "历史失败案例只作为 reference_id 参与召回，不覆盖当前实验 ID，也不把相似经验误当成当前实验事实。",
        PALETTE["sky"],
    )


def slide_modules(c: canvas.Canvas) -> None:
    draw_background(c)
    draw_title(c, 7, "06 / 核心功能模块", "从会议原文到飞书写回，形成可审计的工程流水线")

    modules = [
        ("Transcript Normalizer", "统一妙记/纪要/VC 的片段结构，修正说话人、时间戳和会议元数据。", PALETTE["blue"]),
        ("Claim Extractor", "抽取参数变化、方案争议、风险提示、待办任务、复盘结论等研发语义。", PALETTE["sky"]),
        ("Evidence Binder", "为每条结论绑定 SourceAnchor、quote_hash 与验证状态，支持内容溯源。", PALETTE["green"]),
        ("Writeback Planner", "生成 Base / Task / Docx 写回计划，默认 dry-run，带幂等键。", PALETTE["orange"]),
        ("Review Console", "把 IN_REVIEW 结论推入 Base 审阅台，明确责任人与处理状态。", PALETTE["blue2"]),
        ("Knowledge Graph", "把审阅后的知识沉淀为 Wiki 卡片与 Obsidian 图谱索引。", PALETTE["cyan"]),
    ]
    for idx, (title, body, accent) in enumerate(modules):
        x = 50 + (idx % 3) * 260
        y = 152 + (idx // 3) * 156
        draw_card(c, x, y, 228, 118, title, body, accent)

    draw_code_block(
        c,
        [
            "$ npm run demo:e2e",
            "normalized transcript -> extraction bundle",
            "9 IN_REVIEW claims -> 4 writeback commands",
            "simulated dry-run execution log -> report",
        ],
        186,
        468,
        470,
        82,
    )


def slide_feishu(c: canvas.Canvas) -> None:
    draw_background(c)
    draw_title(c, 8, "07 / 真实飞书落地", "用飞书 CLI / OpenAPI 做可验证接入，公开仓库保留脱敏证据")

    round_rect(c, 52, 148, 340, 310, colors.white, PALETTE["line"], radius=22)
    draw_para(c, "Reader Profile", 82, 176, 230, style("reader", 15, 19, PALETTE["blue"], BOLD_FONT))
    draw_bullet_list(
        c,
        [
            "读取 VC 历史会议、Note、Minutes、transcript。",
            "只用于获取当前身份可见的会议产物。",
            "不在公开仓库保存真实 token、URL、Open ID、原文。",
        ],
        84,
        222,
        250,
        STYLES["card_body"],
        gap=12,
    )
    draw_badge(c, "xtal-reader", 84, 382, PALETTE["ice"], PALETTE["blue"], 118)

    round_rect(c, 450, 148, 340, 310, colors.white, PALETTE["line"], radius=22)
    draw_para(c, "Writer Profile", 480, 176, 230, style("writer", 15, 19, PALETTE["green"], BOLD_FONT))
    draw_bullet_list(
        c,
        [
            "写入 Base 审阅表、创建飞书任务、生成 Docx 知识卡片。",
            "仅开放白名单命令: record_upsert、task.create、docx.create。",
            "真实执行前需要人工确认，默认 dry-run。",
        ],
        482,
        222,
        250,
        STYLES["card_body"],
        gap=12,
        color=PALETTE["green"],
    )
    draw_badge(c, "xtal-writer", 482, 382, PALETTE["green_bg"], PALETTE["green"], 118)

    draw_arrow(c, 392, 304, 450, 304, PALETTE["blue"])
    round_rect(c, 310, 482, 225, 40, PALETTE["navy"], None, radius=20)
    draw_para(c, "飞书仍是组织事实源，Obsidian 只做个人复用视图", 330, 493, 185, style("truth", 8.6, 11.5, colors.white, BOLD_FONT, TA_CENTER))


def slide_evidence(c: canvas.Canvas) -> None:
    draw_background(c)
    draw_title(c, 9, "08 / Demo 与实测证据", "当前仓库已经能跑通 P0 证据链，而不是停留在概念稿")

    draw_code_block(
        c,
        [
            "$ npm test",
            "Artifact validation passed.",
            "Golden-set entries: 24",
            "Scientific claims: 27",
            "Meeting transcripts: 2",
            "Writeback commands: 4",
        ],
        54,
        152,
        360,
        152,
    )
    draw_card(
        c,
        452,
        152,
        330,
        152,
        "飞书能力验证",
        "历史会议查询、会议结束事件、Note 事件、Minutes 事件、transcript 读取、Base 写入、任务创建、Docx 创建均已做脱敏验证。",
        PALETTE["green"],
    )

    artifacts = [
        ("schemas/", "Claim、Bundle、Transcript、Writeback Plan、Execution Log"),
        ("evaluation/", "golden-set、generated bundle、dry-run execution report"),
        ("fixtures/feishu/", "脱敏后的飞书读写与事件验证样例"),
        ("docs/", "PRD、Feishu 可行性、真实业务配置、评委指南"),
    ]
    y = 342
    for idx, (path, desc) in enumerate(artifacts):
        x = 62 + (idx % 2) * 360
        yy = y + (idx // 2) * 88
        draw_card(c, x, yy, 310, 64, path, desc, PALETTE["blue"] if idx % 2 == 0 else PALETTE["sky"])


def slide_safety(c: canvas.Canvas) -> None:
    draw_background(c)
    draw_title(c, 10, "09 / 安全与权限", "研发场景不能让 AI 直接“想写就写”，必须证据优先、权限收敛")

    controls = [
        ("白名单操作", "只允许 Base upsert、Task create、Docx create，禁止 raw API、删除、改权限、公开分享。", PALETTE["blue"]),
        ("审阅优先", "所有抽取结论默认 IN_REVIEW，高风险参数必须人工确认后进入事实源。", PALETTE["orange"]),
        ("幂等执行", "每条写回命令带 idempotency_key，避免重复任务和重复记录。", PALETTE["green"]),
        ("敏感隔离", "真实响应保存在 .tmp 或 private 路径，公开仓库只保留 redacted evidence。", PALETTE["red"]),
        ("身份拆分", "reader / writer profile 分离，降低单一授权过大的风险。", PALETTE["sky"]),
        ("可审计日志", "保留 writeback plan 与 execution log，便于复盘每次写入依据。", PALETTE["blue2"]),
    ]
    for idx, (title, body, accent) in enumerate(controls):
        x = 52 + (idx % 3) * 258
        y = 150 + (idx // 3) * 142
        draw_card(c, x, y, 225, 104, title, body, accent)

    round_rect(c, 126, 462, 590, 54, h("#F1F7FF"), h("#BADBFF"), radius=18)
    draw_para(
        c,
        "原则: AI 可以推进整理、比对和计划，但不能绕过证据、审阅和飞书权限边界。",
        156,
        480,
        530,
        style("safe_principle", 11.5, 16, PALETTE["navy"], BOLD_FONT, TA_CENTER),
    )


def slide_obsidian(c: canvas.Canvas) -> None:
    draw_background(c)
    draw_title(c, 11, "10 / Obsidian 联动", "低成本图谱工作台: 让个人研究复用更快，但事实源仍回到飞书")

    round_rect(c, 58, 164, 250, 250, colors.white, PALETTE["line"], radius=24)
    draw_para(c, "飞书", 90, 195, 170, style("feishu_title", 18, 23, PALETTE["blue"], BOLD_FONT, TA_CENTER))
    draw_bullet_list(
        c,
        ["组织级事实源", "权限与审阅", "任务协同", "Wiki 发布"],
        104,
        244,
        150,
        STYLES["card_body"],
        gap=12,
    )

    round_rect(c, 534, 164, 250, 250, colors.white, PALETTE["line"], radius=24)
    draw_para(c, "Obsidian", 566, 195, 170, style("obs_title", 18, 23, PALETTE["sky"], BOLD_FONT, TA_CENTER))
    draw_bullet_list(
        c,
        ["个人研究笔记", "本地图谱浏览", "相似案例联想", "离线复盘"],
        580,
        244,
        150,
        STYLES["card_body"],
        gap=12,
        color=PALETTE["sky"],
    )

    c.saveState()
    c.setStrokeColor(PALETTE["blue"])
    c.setLineWidth(1.4)
    draw_arrow(c, 309, 288, 385, 288, PALETTE["blue"])
    draw_arrow(c, 457, 288, 533, 288, PALETTE["sky"])
    c.restoreState()
    round_rect(c, 352, 226, 138, 120, PALETTE["navy"], None, radius=26)
    draw_para(c, "Agent 后台", 378, 250, 88, style("agent_title", 14, 18, colors.white, BOLD_FONT, TA_CENTER))
    draw_para(c, "Claim 版本化\n关系整理\n相似案例召回", 374, 287, 92, style("agent_body", 8.3, 12.2, h("#DCEEFF"), BODY_FONT, TA_CENTER))

    round_rect(c, 92, 452, 658, 56, h("#EFF8FF"), h("#BFE1FF"), radius=18)
    draw_para(
        c,
        "关键边界: Obsidian 不保存完整真实 transcript，只同步已授权、已审阅或脱敏摘要；图谱可重建，不作为唯一事实源。",
        124,
        470,
        594,
        style("obs_boundary", 10.6, 15, PALETTE["navy"], BOLD_FONT, TA_CENTER),
    )


def slide_value(c: canvas.Canvas) -> None:
    draw_background(c)
    draw_title(c, 12, "11 / 预期业务价值", "把“会后整理”变成可量化的研发流转指标")

    metrics = [
        (">=80%", "会后 24 小时知识就绪率"),
        ("100%", "SourceAnchor 覆盖率"),
        ("100%", "关键参数人工审阅率"),
        (">=70%", "结论进入任务系统比例"),
    ]
    for idx, (value, label) in enumerate(metrics):
        draw_metric_card(c, value, label, 54 + idx * 194, 150, 164, 102, PALETTE["blue"] if idx < 2 else PALETTE["green"])

    round_rect(c, 68, 310, 706, 172, colors.white, PALETTE["line"], radius=22)
    draw_para(c, "试点后希望观察的变化", 96, 334, 260, style("change_title", 13, 17, PALETTE["navy"], BOLD_FONT))
    labels = ["重复讨论", "重复试错", "任务遗漏", "复盘检索成本"]
    values = [55, 45, 60, 70]
    x0, y0 = 120, 392
    for idx, (label, value) in enumerate(zip(labels, values)):
        x = x0 + idx * 158
        c.setFillColor(h("#E2EEFC"))
        c.roundRect(x, yt(y0 + 58), 82, 58, 8, fill=1, stroke=0)
        c.setFillColor(PALETTE["blue"])
        c.roundRect(x, yt(y0 + value), 82, value, 8, fill=1, stroke=0)
        c.setFont(BODY_FONT, 7.8)
        c.setFillColor(PALETTE["muted"])
        c.drawCentredString(x + 41, yt(y0 + 78), label)
        c.setFont(BOLD_FONT, 8.2)
        c.setFillColor(PALETTE["blue"])
        c.drawCentredString(x + 41, yt(y0 + value + 13), f"-{value}%")
    draw_para(
        c,
        "数值为试点目标口径，用于定义评估方式: 相同主题重复会议次数、失败案例命中率、任务闭环率、复盘检索耗时。",
        96,
        493,
        650,
        STYLES["small"],
    )


def slide_roadmap(c: canvas.Canvas) -> None:
    draw_background(c)
    draw_title(c, 13, "12 / 落地路线", "从可海选 MVP 到企业试点，路径清楚、成本可控")

    phases = [
        ("P0", "海选 MVP", "可运行 demo、schemas、脱敏飞书证据、README、评委指南、蓝白版 PDF。", PALETTE["blue"]),
        ("P1", "试点原型", "真实会议烟测、真实 dry-run、Base 审阅台、Obsidian 插件 MVP。", PALETTE["sky"]),
        ("P2", "企业增强", "LLM + 本体混合抽取、权限过滤检索、指标看板、ELN/LIMS 对接。", PALETTE["green"]),
    ]
    x_positions = [78, 324, 570]
    c.setStrokeColor(h("#B8D7FA"))
    c.setLineWidth(2)
    c.line(x_positions[0] + 75, yt(242), x_positions[-1] + 75, yt(242))
    for idx, (phase, title, body, accent) in enumerate(phases):
        x = x_positions[idx]
        c.setFillColor(accent)
        c.circle(x + 75, yt(242), 21, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont(BOLD_FONT, 10)
        c.drawCentredString(x + 75, yt(246), phase)
        draw_card(c, x, 290, 190, 140, title, body, accent)

    round_rect(c, 156, 470, 530, 52, h("#EFF8FF"), h("#BFE1FF"), radius=18)
    draw_para(
        c,
        "当前状态: P0 工程链路已完成；下一步补齐 3 分钟演示视频与更贴近真实实验的多场景样例。",
        186,
        487,
        470,
        style("roadmap_now", 10.8, 15.4, PALETTE["navy"], BOLD_FONT, TA_CENTER),
    )


def slide_submit(c: canvas.Canvas) -> None:
    draw_background(c)
    draw_title(c, 14, "13 / 评委如何评估", "仓库不暴露真实密钥，但能清楚证明真实业务可落地")

    draw_card(
        c,
        56,
        152,
        225,
        238,
        "1. 看 README",
        "了解真实飞书私有租户如何配置 reader/writer profile、事件订阅、Base/Task/Docx 写回和 Obsidian 边界。",
        PALETTE["blue"],
    )
    draw_card(
        c,
        309,
        152,
        225,
        238,
        "2. 跑本地验证",
        "执行 npm test 与 npm run demo:e2e，检查 schema 校验、claim 抽取、写回计划和 dry-run 日志。",
        PALETTE["green"],
    )
    draw_card(
        c,
        562,
        152,
        225,
        238,
        "3. 查脱敏证据",
        "fixtures/feishu 中保留读写与事件链路的 redacted JSON，证明不是纯概念方案。",
        PALETTE["sky"],
    )

    round_rect(c, 84, 430, 674, 78, PALETTE["navy"], None, radius=24)
    draw_para(
        c,
        "交付印象: 一个 solo 也能完成的低成本、可审计、可扩展研发效能原型；飞书负责组织协同，Agent 负责结构化推进，Obsidian 负责个人知识复用。",
        124,
        456,
        594,
        style("final_cta", 13, 19, colors.white, BOLD_FONT, TA_CENTER),
    )


SLIDES = [
    slide_cover,
    slide_pain,
    slide_external,
    slide_solution,
    slide_loop,
    slide_claim,
    slide_modules,
    slide_feishu,
    slide_evidence,
    slide_safety,
    slide_obsidian,
    slide_value,
    slide_roadmap,
    slide_submit,
]


def build_pdf(input_path: Path, output_path: Path) -> None:
    if not input_path.exists():
        raise FileNotFoundError(f"Source draft not found: {input_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(output_path), pagesize=landscape(A4))
    pdf.setTitle("XtalLoop 开题补充材料")
    pdf.setAuthor("XtalLoop")
    pdf.setSubject("AI 实验研发加速器海选补充材料")

    for render_slide in SLIDES:
        render_slide(pdf)
        pdf.showPage()

    pdf.save()


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
