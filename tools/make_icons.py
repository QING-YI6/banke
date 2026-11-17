"""生成半刻的全套图标与启动图。运行：python tools/make_icons.py"""
from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
ANDROID = ROOT / "android" / "app" / "src" / "main" / "res"
PUBLIC = ROOT / "public"

INK = (7, 17, 15, 255)
DEEP = (13, 31, 26, 255)
PAPER = (242, 232, 214, 255)
GOLD = (211, 162, 94, 255)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(len(a)))


def rounded_mask(size: int, radius: int, supersample: int = 4) -> Image.Image:
    m = Image.new("L", (size * supersample, size * supersample), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle(
        (0, 0, size * supersample - 1, size * supersample - 1),
        radius=radius * supersample,
        fill=255,
    )
    return m.resize((size, size), Image.LANCZOS)


def background(size: int, rounded: bool) -> Image.Image:
    """夜色渐变 + 中心一点点青绿的光。"""
    img = Image.new("RGBA", (size, size), INK)
    px = img.load()
    cx = cy = size / 2
    maxd = math.hypot(cx, cy)
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy) / maxd
            t = max(0.0, min(1.0, d))
            c = lerp((22, 54, 45), (7, 17, 15), t ** 0.72)
            px[x, y] = (*c, 255)
    if rounded:
        mask = rounded_mask(size, int(size * 0.22))
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        return out
    return img


def tomato_mark(size: int) -> Image.Image:
    """俯视的番茄切面：四瓣、籽、果心与绿蒂。"""
    S = size
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cx = cy = S / 2
    R = S * 0.41
    gap = 4.2
    offset = S * 0.012

    palette = [
        ((155, 36, 21), (208, 62, 38)),
        ((172, 43, 25), (222, 78, 48)),
        ((150, 33, 20), (201, 57, 34)),
        ((165, 39, 23), (216, 70, 44)),
    ]

    for i in range(4):
        a0 = 45 + i * 90 + gap
        a1 = 45 + (i + 1) * 90 - gap
        mid = math.radians((a0 + a1) / 2)
        ox = math.cos(mid) * offset
        oy = math.sin(mid) * offset
        scx, scy = cx + ox, cy + oy

        mask = Image.new("L", (S, S), 0)
        md = ImageDraw.Draw(mask)
        md.pieslice(
            (scx - R, scy - R, scx + R, scy + R),
            start=a0,
            end=a1,
            fill=255,
        )

        # 果肉：从外圈深红到靠近果心的浅色
        flesh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        fd = ImageDraw.Draw(flesh)
        steps = 90
        outer, inner = palette[i]
        for k in range(steps):
            t = k / (steps - 1)
            rr = R * (1 - t)
            if t < 0.7:
                c = lerp(outer, inner, t / 0.7)
            else:
                c = lerp(inner, (198, 66, 41), (t - 0.7) / 0.3)
            fd.ellipse(
                (cx - rr, cy - rr, cx + rr, cy + rr),
                fill=(*c, 255),
            )
        img.paste(flesh, (0, 0), mask)

        # 籽：沿弧线排布
        for s in range(6):
            ang = math.radians(a0 + 12 + s * ((a1 - a0 - 24) / 5))
            dist = R * (0.5 + 0.05 * (s % 2))
            sx = cx + math.cos(ang) * dist
            sy = cy + math.sin(ang) * dist
            seed = Image.new("RGBA", (int(S * 0.052), int(S * 0.032)), (0, 0, 0, 0))
            sd = ImageDraw.Draw(seed)
            sd.ellipse(
                (1, 1, seed.width - 2, seed.height - 2),
                fill=(246, 229, 191, 235),
                outline=(150, 92, 56, 190),
                width=max(1, S // 640),
            )
            seed = seed.rotate(-math.degrees(ang), expand=True, resample=Image.BICUBIC)
            img.alpha_composite(seed, (int(sx - seed.width / 2), int(sy - seed.height / 2)))

    # 外圈果皮
    outline = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    od = ImageDraw.Draw(outline)
    for i in range(4):
        a0 = 45 + i * 90 + gap
        a1 = 45 + (i + 1) * 90 - gap
        mid = math.radians((a0 + a1) / 2)
        ox = math.cos(mid) * offset
        oy = math.sin(mid) * offset
        od.arc(
            (cx + ox - R, cy + oy - R, cx + ox + R, cy + oy + R),
            start=a0,
            end=a1,
            fill=(112, 20, 12, 210),
            width=max(2, int(S * 0.006)),
        )
    img.alpha_composite(outline)

    # 中心绿蒂
    calyx = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cd = ImageDraw.Draw(calyx)
    leaf_r = R * 0.15
    for k in range(5):
        ang = math.radians(-90 + k * 72)
        p0 = (cx + math.cos(ang - 0.42) * leaf_r * 0.22, cy + math.sin(ang - 0.42) * leaf_r * 0.22)
        p1 = (cx + math.cos(ang - 0.3) * leaf_r, cy + math.sin(ang - 0.3) * leaf_r)
        p2 = (cx + math.cos(ang) * leaf_r * 1.22, cy + math.sin(ang) * leaf_r * 1.22)
        p3 = (cx + math.cos(ang + 0.3) * leaf_r, cy + math.sin(ang + 0.3) * leaf_r)
        p4 = (cx + math.cos(ang + 0.42) * leaf_r * 0.22, cy + math.sin(ang + 0.42) * leaf_r * 0.22)
        cd.polygon([p0, p1, p2, p3, p4], fill=(126, 148, 82, 255), outline=(78, 96, 50, 255))
        cd.line([ (cx, cy), p2 ], fill=(93, 113, 60, 180), width=max(1, S // 700))
    cd.ellipse(
        (cx - leaf_r * 0.3, cy - leaf_r * 0.3, cx + leaf_r * 0.3, cy + leaf_r * 0.3),
        fill=(88, 107, 57, 255),
        outline=(63, 77, 42, 255),
    )
    img.alpha_composite(calyx)
    return img


def full_icon(size: int, rounded: bool = True) -> Image.Image:
    S = size * 2
    bg = background(S, rounded)
    mark = tomato_mark(S)
    # 番茄占画面 76%
    target = int(S * 0.82)
    mark = mark.resize((target, target), Image.LANCZOS)
    bg.alpha_composite(mark, ((S - target) // 2, int(S * 0.07)))
    return bg.resize((size, size), Image.LANCZOS)


def round_icon(size: int) -> Image.Image:
    img = full_icon(size, rounded=True)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def foreground(size: int) -> Image.Image:
    S = size * 4
    mark = tomato_mark(S)
    target = int(S * 0.72)
    mark = mark.resize((target, target), Image.LANCZOS)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.alpha_composite(mark, ((S - target) // 2, (S - target) // 2))
    return out.resize((size, size), Image.LANCZOS)


def font(path: str, size: int):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def splash(w: int, h: int) -> Image.Image:
    img = Image.new("RGBA", (w, h), INK)
    # 中心青绿色微光
    glow = Image.new("L", (w, h), 0)
    gd = ImageDraw.Draw(glow)
    rad = int(min(w, h) * 0.75)
    gd.ellipse((w // 2 - rad, h // 2 - rad, w // 2 + rad, h // 2 + rad), fill=90)
    glow = glow.filter(ImageFilter.GaussianBlur(int(min(w, h) * 0.12)))
    tint = Image.new("RGBA", (w, h), (18, 48, 40, 255))
    img = Image.composite(tint, img, glow)

    mark_size = int(min(w, h) * 0.4)
    mark = tomato_mark(mark_size * 3).resize((mark_size, mark_size), Image.LANCZOS)
    x = (w - mark_size) // 2
    y = int(h * 0.5 - mark_size * 0.62)
    img.alpha_composite(mark, (x, y))

    serif = font("C:/Windows/Fonts/simsun.ttc", max(18, int(mark_size * 0.28)))
    sans = font("C:/Windows/Fonts/arial.ttf", max(10, int(mark_size * 0.075)))
    d = ImageDraw.Draw(img)
    title = "半刻"
    tw = d.textlength(title, font=serif)
    d.text(((w - tw) / 2, y + mark_size + int(mark_size * 0.12)), title, font=serif, fill=PAPER)
    sub = "B A N K E"
    sw = d.textlength(sub, font=sans)
    d.text(((w - sw) / 2, y + mark_size + int(mark_size * 0.5)), sub, font=sans, fill=(*GOLD[:3], 190))
    return img


def main() -> None:
    BUILD.mkdir(exist_ok=True)
    PUBLIC.mkdir(exist_ok=True)
    (PUBLIC / "icons").mkdir(exist_ok=True)

    master = full_icon(1024)
    master.save(BUILD / "icon.png")
    master.resize((512, 512), Image.LANCZOS).save(BUILD / "icon-512.png")
    master.save(
        BUILD / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    master.save(PUBLIC / "icons" / "icon-512.png")
    master.resize((192, 192), Image.LANCZOS).save(PUBLIC / "icons" / "icon-192.png")

    if ANDROID.exists():
        for density, icon_size, fg_size in [
            ("mdpi", 48, 108),
            ("hdpi", 72, 162),
            ("xhdpi", 96, 216),
            ("xxhdpi", 144, 324),
            ("xxxhdpi", 192, 432),
        ]:
            folder = ANDROID / f"mipmap-{density}"
            folder.mkdir(parents=True, exist_ok=True)
            full_icon(icon_size, rounded=True).save(folder / "ic_launcher.png")
            round_icon(icon_size).save(folder / "ic_launcher_round.png")
            foreground(fg_size).save(folder / "ic_launcher_foreground.png")

        for folder, w, h in [
            ("drawable", 480, 320),
            ("drawable-land-mdpi", 480, 320),
            ("drawable-land-hdpi", 800, 480),
            ("drawable-land-xhdpi", 1280, 720),
            ("drawable-land-xxhdpi", 1600, 960),
            ("drawable-land-xxxhdpi", 1920, 1280),
            ("drawable-port-mdpi", 320, 480),
            ("drawable-port-hdpi", 480, 800),
            ("drawable-port-xhdpi", 720, 1280),
            ("drawable-port-xxhdpi", 960, 1600),
            ("drawable-port-xxxhdpi", 1280, 1920),
        ]:
            target = ANDROID / folder
            if target.exists():
                splash(w, h).save(target / "splash.png")

    print("icons and splashes generated")


if __name__ == "__main__":
    main()
