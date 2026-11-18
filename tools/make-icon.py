from PIL import Image, ImageDraw, ImageFilter
import math, os, io

ROOT = r"C:\Users\YB\Desktop\番茄钟"
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
OUT = os.path.join(ROOT, "tools", "shots")
os.makedirs(OUT, exist_ok=True)

SS = 4  # supersample


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def radial_gradient(size, inner, outer):
    mask = Image.radial_gradient("L").resize((size, size), Image.LANCZOS)
    a = Image.new("RGBA", (size, size), inner + (255,))
    b = Image.new("RGBA", (size, size), outer + (255,))
    return Image.composite(a, b, mask)


def vertical_gradient(size, top, bottom):
    img = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        d.line([(0, y), (size, y)], fill=lerp(top, bottom, y / max(1, size - 1)) + (255,))
    return img


def rounded_mask(size, radius_ratio, circular=False):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    if circular:
        d.ellipse([0, 0, size - 1, size - 1], fill=255)
    else:
        r = int(size * radius_ratio)
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    return m


def draw_tomato(size, cx, cy, R, plate=True, plate_ratio=1.24):
    """Return RGBA layer with plate + four tomato quarters + calyx."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    P = int(R * plate_ratio)

    # soft shadow under the plate
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse(
        [cx - P * 1.02, cy - P * 0.86 + P * 0.08, cx + P * 1.02, cy + P * 1.12 + P * 0.08],
        fill=(22, 62, 82, 65),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(2, size // 90)))
    layer = Image.alpha_composite(layer, shadow)

    if plate:
        plate_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        pd = ImageDraw.Draw(plate_layer)
        pd.ellipse([cx - P, cy - P, cx + P, cy + P], fill=(252, 247, 235, 255))
        pd.ellipse(
            [cx - P, cy - P, cx + P, cy + P],
            outline=(235, 223, 201, 255),
            width=max(2, int(size * 0.003)),
        )
        # faint water ring just outside the plate
        ring_r = int(P * 1.055)
        pd.ellipse(
            [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
            outline=(174, 208, 220, 120),
            width=max(2, int(size * 0.004)),
        )
        layer = Image.alpha_composite(layer, plate_layer)

    # four quarter pieces, with a visible cross gap
    gap_deg = 3.6
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    for q in range(4):
        start = q * 90 + gap_deg
        end = (q + 1) * 90 - gap_deg
        md.pieslice([cx - R, cy - R, cx + R, cy + R], start, end, fill=255)

    tomato = radial_gradient(size, (245, 109, 82), (166, 38, 26))
    # squash the tomato very slightly
    tomato = tomato.resize((size, int(size * 0.97)), Image.LANCZOS)
    tomato = tomato.crop((0, 0, size, size)) if tomato.height == size else tomato.resize((size, size), Image.LANCZOS)
    layer = Image.composite(tomato, layer, mask)

    d = ImageDraw.Draw(layer)

    # rind: a darker arc on the outside of each quarter
    for q in range(4):
        start = q * 90 + gap_deg
        end = (q + 1) * 90 - gap_deg
        d.arc(
            [cx - R, cy - R, cx + R, cy + R],
            start,
            end,
            fill=(150, 28, 20, 230),
            width=max(2, int(R * 0.028)),
        )

    # soft highlight along the upper-left of each cut face
    for q in range(4):
        start = q * 90 + gap_deg
        end = (q + 1) * 90 - gap_deg
        for ang, alpha in ((start + 1.8, 70), (end - 1.8, 55)):
            a = math.radians(ang)
            r0, r1 = R * 0.13, R * 0.95
            d.line(
                [(cx + math.cos(a) * r0, cy + math.sin(a) * r0),
                 (cx + math.cos(a) * r1, cy + math.sin(a) * r1)],
                fill=(255, 208, 188, alpha),
                width=max(2, int(R * 0.012)),
            )

    # seeds
    for q in range(4):
        mid = q * 90 + 45
        for rr, off in ((0.46, -12), (0.6, 10)):
            a = math.radians(mid + off)
            x = cx + math.cos(a) * R * rr
            y = cy + math.sin(a) * R * rr
            sw = max(2, int(R * 0.027))
            sh = max(2, int(R * 0.041))
            d.ellipse([x - sw, y - sh, x + sw, y + sh], fill=(255, 237, 215, 190))

    # calyx: five short, slightly pointed sepals around the stem
    leaf_len = R * 0.4
    leaf_w = R * 0.078
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
        polygon = left + list(reversed(right))
        d.polygon(polygon, fill=(89, 119, 63, 255))
        d.line([(cx, cy), (cx + direction[0] * leaf_len * 0.86, cy + direction[1] * leaf_len * 0.86)],
               fill=(142, 168, 106, 150), width=max(1, int(R * 0.008)))

    # stem: a thicker curved stalk rising out of the calyx
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
    # calyx center
    d.ellipse(
        [cx - R * 0.07, cy - R * 0.07, cx + R * 0.07, cy + R * 0.07],
        fill=(80, 108, 57, 255),
    )

    return layer


def render_adaptive(size):
    S = size * SS
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    tomato = draw_tomato(S, S // 2, int(S * 0.51), int(S * 0.245), plate=True, plate_ratio=1.22)
    layer = Image.alpha_composite(layer, tomato)
    return layer.resize((size, size), Image.LANCZOS)


def render_legacy(size, circular=False):
    S = size * SS
    bg = vertical_gradient(S, (248, 252, 253), (207, 229, 238))
    # soft top-left light
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-S * 0.2, -S * 0.25, S * 0.7, S * 0.55], fill=(255, 255, 255, 95))
    glow = glow.filter(ImageFilter.GaussianBlur(S // 12))
    bg = Image.alpha_composite(bg, glow)

    mask = rounded_mask(S, 0.22, circular=circular)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(bg, (0, 0), mask)

    tomato = draw_tomato(S, S // 2, int(S * 0.51), int(S * 0.305), plate=True, plate_ratio=1.14)
    out = Image.alpha_composite(out, tomato)

    # keep the outer shape crisp
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

# previews
render_legacy(512).save(os.path.join(OUT, "icon-preview-512.png"))
render_legacy(96).save(os.path.join(OUT, "icon-preview-96.png"))
render_legacy(48).save(os.path.join(OUT, "icon-preview-48.png"))
render_adaptive(432).save(os.path.join(OUT, "icon-preview-foreground.png"))

# browser favicon: use the same light icon instead of the old dark SVG
import base64, re

buf = io.BytesIO()
render_legacy(64).save(buf, format="PNG")
b64 = base64.b64encode(buf.getvalue()).decode("ascii")
index_path = os.path.join(ROOT, "index.html")
with open(index_path, "r", encoding="utf-8") as f:
    html = f.read()
html2, n = re.subn(
    r'href="data:image/svg\+xml,[^"]+"',
    f'href="data:image/png;base64,{b64}"',
    html,
    count=1,
    flags=re.S,
)
if n:
    with open(index_path, "w", encoding="utf-8", newline="") as f:
        f.write(html2)
    print("favicon updated")
else:
    print("favicon pattern not found")
print("icons written")
