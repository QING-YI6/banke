from PIL import Image, ImageDraw, ImageFilter
import math, os, io, base64, re

ROOT = r"C:\Users\YB\Desktop\番茄钟"
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
OUT = os.path.join(ROOT, "tools", "shots")
os.makedirs(OUT, exist_ok=True)
SS = 4


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def vertical_gradient(size, top, bottom):
    img = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        d.line([(0, y), (size, y)], fill=lerp(top, bottom, y / max(1, size - 1)) + (255,))
    return img


def radial_gradient(size, inner, outer):
    mask = Image.radial_gradient("L").resize((size, size), Image.LANCZOS)
    a = Image.new("RGBA", (size, size), inner + (255,))
    b = Image.new("RGBA", (size, size), outer + (255,))
    return Image.composite(a, b, mask)


def rounded_mask(size, radius_ratio, circular=False):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    if circular:
        d.ellipse([0, 0, size - 1, size - 1], fill=255)
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    return m


def tomato_outline(cx, cy, R, n=320):
    pts = []
    for i in range(n):
        a = (2 * math.pi * i) / n
        # four soft lobes + a little irregularity
        rr = R * (1 + 0.035 * math.cos(4 * a) + 0.012 * math.cos(7 * a + 1.3))
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.96))
    return pts


def draw_tomato(size, cx, cy, R):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # soft shadow in the water
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse(
        [cx - R * 1.04, cy + R * 0.28, cx + R * 1.04, cy + R * 0.94],
        fill=(20, 60, 80, 60),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(2, size // 80)))
    layer = Image.alpha_composite(layer, shadow)

    pts = tomato_outline(cx, cy, R)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)

    body = radial_gradient(size, (245, 105, 78), (158, 32, 24))
    layer = Image.composite(body, layer, mask)
    d = ImageDraw.Draw(layer)

    # rind
    d.line(pts + [pts[0]], fill=(146, 27, 19, 235), width=max(2, int(R * 0.028)), joint="curve")

    # soft light on the upper-left shoulder
    hi = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hi)
    hd.ellipse(
        [cx - R * 0.78, cy - R * 0.92, cx + R * 0.2, cy - R * 0.1],
        fill=(255, 220, 196, 85),
    )
    hi = hi.filter(ImageFilter.GaussianBlur(max(2, int(R * 0.16))))
    hi.putalpha(Image.composite(hi.getchannel("A"), Image.new("L", (size, size), 0), mask))
    layer = Image.alpha_composite(layer, hi)
    d = ImageDraw.Draw(layer)

    # four cut lines, thin and clean: a scored tomato, not a pizza
    cut_color = (252, 246, 234, 235)
    for ang in (0, 90, 180, 270):
        a = math.radians(ang)
        d.line(
            [(cx + math.cos(a) * R * 0.08, cy + math.sin(a) * R * 0.08),
             (cx + math.cos(a) * R * 0.985, cy + math.sin(a) * R * 0.985)],
            fill=cut_color,
            width=max(1, int(R * 0.015)),
        )

    # a few tiny seeds on the cut faces
    for q in range(4):
        a = math.radians(q * 90 + 42)
        for rr, off in ((0.5, -6), (0.63, 8)):
            aa = math.radians(q * 90 + 42 + off)
            x = cx + math.cos(aa) * R * rr
            y = cy + math.sin(aa) * R * rr * 0.96
            sw = max(1, int(R * 0.017))
            sh = max(1, int(R * 0.027))
            d.ellipse([x - sw, y - sh, x + sw, y + sh], fill=(255, 238, 214, 135))

    # calyx: five soft sepals
    leaf_len = R * 0.43
    leaf_w = R * 0.08
    for k in range(5):
        ang = math.radians(-90 + k * 72)
        direction = (math.cos(ang), math.sin(ang))
        perp = (-direction[1], direction[0])
        left, right = [], []
        for t in (0.0, 0.12, 0.26, 0.44, 0.62, 0.8, 0.93, 1.0):
            w = leaf_w * (math.sin(min(1.0, t * 1.1) * math.pi) ** 0.72)
            px = cx + direction[0] * leaf_len * t
            py = cy + direction[1] * leaf_len * t
            left.append((px + perp[0] * w, py + perp[1] * w))
            right.append((px - perp[0] * w, py - perp[1] * w))
        d.polygon(left + list(reversed(right)), fill=(88, 118, 62, 255))
        d.line([(cx, cy), (cx + direction[0] * leaf_len * 0.86, cy + direction[1] * leaf_len * 0.86)],
               fill=(142, 168, 106, 145), width=max(1, int(R * 0.008)))

    # stem
    stem_pts = [
        (cx, cy),
        (cx + R * 0.018, cy - R * 0.3),
        (cx + R * 0.052, cy - R * 0.58),
        (cx + R * 0.03, cy - R * 0.76),
    ]
    d.line(stem_pts, fill=(75, 102, 53, 255), width=max(5, int(R * 0.105)), joint="curve")
    d.line(stem_pts, fill=(121, 151, 87, 255), width=max(2, int(R * 0.052)), joint="curve")
    d.ellipse(
        [stem_pts[-1][0] - R * 0.048, stem_pts[-1][1] - R * 0.048,
         stem_pts[-1][0] + R * 0.048, stem_pts[-1][1] + R * 0.048],
        fill=(128, 158, 93, 255),
    )
    d.ellipse(
        [cx - R * 0.07, cy - R * 0.07, cx + R * 0.07, cy + R * 0.07],
        fill=(80, 108, 57, 255),
    )
    return layer


def render_adaptive(size):
    S = size * SS
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    layer = Image.alpha_composite(layer, draw_tomato(S, S // 2, int(S * 0.52), int(S * 0.255)))
    return layer.resize((size, size), Image.LANCZOS)


def render_legacy(size, circular=False):
    S = size * SS
    bg = vertical_gradient(S, (248, 252, 254), (207, 230, 240))
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-S * 0.25, -S * 0.3, S * 0.72, S * 0.58], fill=(255, 255, 255, 100))
    glow = glow.filter(ImageFilter.GaussianBlur(S // 12))
    bg = Image.alpha_composite(bg, glow)
    mask = rounded_mask(S, 0.22, circular=circular)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(bg, (0, 0), mask)

    # faint water ring
    ring = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rr = int(S * 0.355)
    rd.ellipse(
        [S // 2 - rr, int(S * 0.52) - rr, S // 2 + rr, int(S * 0.52) + rr],
        outline=(172, 207, 220, 110),
        width=max(2, int(S * 0.004)),
    )
    out = Image.alpha_composite(out, ring)
    out = Image.alpha_composite(out, draw_tomato(S, S // 2, int(S * 0.52), int(S * 0.325)))
    out.putalpha(Image.composite(out.getchannel("A"), Image.new("L", (S, S), 0), mask))
    return out.resize((size, size), Image.LANCZOS)


legacy_sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
fg_sizes = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
for dens, sz in legacy_sizes.items():
    folder = os.path.join(RES, f"mipmap-{dens}")
    os.makedirs(folder, exist_ok=True)
    render_legacy(sz).save(os.path.join(folder, "ic_launcher.png"))
    render_legacy(sz, circular=True).save(os.path.join(folder, "ic_launcher_round.png"))
for dens, sz in fg_sizes.items():
    folder = os.path.join(RES, f"mipmap-{dens}")
    os.makedirs(folder, exist_ok=True)
    render_adaptive(sz).save(os.path.join(folder, "ic_launcher_foreground.png"))

render_legacy(512).save(os.path.join(OUT, "icon-preview-512.png"))
render_legacy(48).save(os.path.join(OUT, "icon-preview-48.png"))
render_adaptive(432).save(os.path.join(OUT, "icon-preview-foreground.png"))

buf = io.BytesIO()
render_legacy(64).save(buf, format="PNG")
b64 = base64.b64encode(buf.getvalue()).decode("ascii")
index_path = os.path.join(ROOT, "index.html")
with open(index_path, "r", encoding="utf-8") as f:
    html = f.read()
html2, n = re.subn(r'href="data:image/[^"]+"', f'href="data:image/png;base64,{b64}"', html, count=1, flags=re.S)
if n:
    with open(index_path, "w", encoding="utf-8", newline="") as f:
        f.write(html2)
    print("favicon updated")
else:
    print("favicon pattern not found")
print("icons written")
