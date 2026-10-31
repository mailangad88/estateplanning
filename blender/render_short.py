"""
Render a vertical (9:16) explainer short from a JSON spec with Blender, headless.

Two ways to run it (both free):
  1. Blender's Python module:   pip install bpy==5.2.3   (Python 3.13)
                                python3 blender/render_short.py --spec blender/specs/v01.json --out out/v01.mp4
  2. A Blender install:         blender -b -P blender/render_short.py -- --spec ... --out ...

Options:
  --preview N     render only frame N to a PNG (fast layout check)
  --scale 50      render at 50% size (drafts)
  --font PATH     .ttf/.otf for body text (default: Inter if installed, else Blender's built-in font)

The look follows docs/visual-style.md: paper background, ink text, teal accent, clay and gold highlights,
no people and no stock footage. Every frame carries the disclaimer line, and the last scene is the end card
with the /tips URL and the referral-site line. Rendering is CPU only (Cycles, 1 sample, emission-only
materials), so it runs on any machine or CI runner without a GPU.
"""

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import bpy

PALETTE = {
    "paper": "#fbf8f3",
    "sand": "#f3ebdf",
    "ink": "#1b2a30",
    "muted": "#56616a",
    "accent": "#1f6670",
    "accent_tint": "#dcecec",
    "clay": "#c06a40",
    "sage": "#6f957a",
    "gold": "#e2ae45",
}

DEFAULT_DISCLAIMER = "Educational only. Not legal advice. Referral service. Attorney advertising."

# Scene units: the camera is orthographic and 9 units wide, so 1 unit = 120 px at 1080 px wide.
FRAME_W = 9.0
FRAME_H = 16.0


def hex_rgba(h, a=1.0):
    h = h.lstrip("#")
    srgb = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, a)


def color(name_or_hex):
    return hex_rgba(PALETTE.get(name_or_hex, name_or_hex))


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else argv[1:]
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--spec", required=True, help="a spec JSON file, or content/social/calendar.json with --id")
    p.add_argument("--id", default=None, help="video id when --spec is the content calendar")
    p.add_argument("--out", required=True)
    p.add_argument("--preview", type=int, default=None)
    p.add_argument("--scale", type=int, default=100)
    p.add_argument("--font", default=None)
    p.add_argument("--threads", type=int, default=0)
    p.add_argument("--audio", default=None, help="voiceover file (wav/mp3/m4a) to mux in; needs ffmpeg on PATH")
    return p.parse_args(argv)


# ---------------------------------------------------------------- scene setup


def reset_scene(fps, scale, threads):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 0
    scene.render.resolution_x = 1080
    scene.render.resolution_y = 1920
    scene.render.resolution_percentage = scale
    scene.render.fps = fps
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    if threads:
        scene.render.threads_mode = "FIXED"
        scene.render.threads = threads
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = color("paper")
    scene.world = world

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = FRAME_H  # ortho_scale covers the longer side
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (0, 0, 10)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return scene


_materials = {}


def material(name):
    """Flat emission material, one per palette color."""
    if name in _materials:
        return _materials[name]
    m = bpy.data.materials.new(f"m_{name}")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = color(name)
    em.inputs["Strength"].default_value = 1.0
    nt.links.new(em.outputs[0], out.inputs[0])
    _materials[name] = m
    return m


_fonts = {}


def load_font(path):
    if not path:
        return None
    if path not in _fonts:
        _fonts[path] = bpy.data.fonts.load(path)
    return _fonts[path]


def find_font(explicit, bold=False):
    if explicit and os.path.exists(explicit):
        return explicit
    candidates = [
        "/usr/share/fonts/opentype/inter/Inter-Bold.otf" if bold else "/usr/share/fonts/opentype/inter/Inter-Medium.otf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    return next((c for c in candidates if os.path.exists(c)), None)


def text(body, size, col, x=0.0, y=0.0, width=7.6, align="CENTER", font=None, z=0.1):
    cu = bpy.data.curves.new("txt", type="FONT")
    cu.body = body
    cu.size = size
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.space_line = 1.05
    cu.text_boxes[0].width = width
    cu.text_boxes[0].x = -width / 2 if align == "CENTER" else 0
    f = load_font(font)
    if f:
        cu.font = f
    ob = bpy.data.objects.new("txt", cu)
    ob.location = (x, y, z)
    ob.data.materials.append(material(col))
    bpy.context.scene.collection.objects.link(ob)
    return ob


def rect(w, h, col, x=0.0, y=0.0, z=0.0, radius=0.0):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x, y, z))
    ob = bpy.context.active_object
    ob.scale = (w, h, 1)
    if radius:
        bpy.ops.object.transform_apply(scale=True)
        mod = ob.modifiers.new("round", "BEVEL")
        mod.affect = "VERTICES"
        mod.width = radius
        mod.segments = 6
    ob.data.materials.append(material(col))
    return ob


def circle(r, col, x=0.0, y=0.0, z=0.05):
    bpy.ops.mesh.primitive_circle_add(radius=r, vertices=48, fill_type="NGON", location=(x, y, z))
    ob = bpy.context.active_object
    ob.data.materials.append(material(col))
    return ob


# ---------------------------------------------------------------- animation helpers


def visible_between(ob, start, end):
    """Show an object only from frame start to end (inclusive)."""
    for attr in ("hide_render", "hide_viewport"):
        setattr(ob, attr, True)
        ob.keyframe_insert(attr, frame=0)
        setattr(ob, attr, False)
        ob.keyframe_insert(attr, frame=start)
        setattr(ob, attr, True)
        ob.keyframe_insert(attr, frame=end + 1)
    for fc in _fcurves(ob):
        for kp in fc.keyframe_points:
            kp.interpolation = "CONSTANT"


def _fcurves(ob):
    ad = ob.animation_data
    if not ad or not ad.action:
        return []
    act = ad.action
    if hasattr(act, "fcurves"):
        return list(act.fcurves)
    # Blender 5 layered actions
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out


def pop_in(ob, start, fps, delay=0.0, dist=0.6):
    """Slide up and scale in over about a third of a second."""
    f0 = start + int(delay * fps)
    f1 = f0 + max(4, int(0.33 * fps))
    end_loc = tuple(ob.location)
    end_scale = tuple(ob.scale)
    ob.location = (end_loc[0], end_loc[1] - dist, end_loc[2])
    ob.scale = tuple(s * 0.85 for s in end_scale)
    ob.keyframe_insert("location", frame=f0)
    ob.keyframe_insert("scale", frame=f0)
    ob.location = end_loc
    ob.scale = end_scale
    ob.keyframe_insert("location", frame=f1)
    ob.keyframe_insert("scale", frame=f1)
    for fc in _fcurves(ob):
        if fc.data_path in ("location", "scale"):
            for kp in fc.keyframe_points:
                kp.interpolation = "BACK"
                kp.easing = "EASE_OUT"


def grow_x(ob, start, end):
    """Progress bar: scale x from 0 to full across the clip."""
    full = ob.scale[0]
    ob.scale[0] = 0.0001
    ob.keyframe_insert("scale", index=0, frame=start)
    ob.scale[0] = full
    ob.keyframe_insert("scale", index=0, frame=end)
    for fc in _fcurves(ob):
        if fc.data_path == "scale":
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"


def spin_in(ob, start, fps):
    f1 = start + int(0.5 * fps)
    ob.rotation_euler = (0, 0, math.radians(-90))
    ob.keyframe_insert("rotation_euler", frame=start)
    ob.rotation_euler = (0, 0, 0)
    ob.keyframe_insert("rotation_euler", frame=f1)


# ---------------------------------------------------------------- scene builders
# Each builder adds objects for one beat and keys them visible from `start` to `end`.


def build_hook(s, start, end, fps, fonts):
    objs = []
    band = rect(FRAME_W, 6.2, "ink", y=1.0, z=0.0)
    objs.append(band)
    if s.get("kicker"):
        k = text(s["kicker"].upper(), 0.36, "gold", y=3.4, font=fonts["bold"])
        pop_in(k, start, fps)
        objs.append(k)
    t = text(s["text"], s.get("size", 0.72), "paper", y=1.0, width=7.8, font=fonts["bold"])
    pop_in(t, start, fps, delay=0.1)
    objs.append(t)
    return objs


def build_point(s, start, end, fps, fonts):
    objs = []
    card = rect(8.0, 7.6, "sand", y=0.6, z=0.0, radius=0.35)
    pop_in(card, start, fps, dist=0.3)
    objs.append(card)
    bar = rect(0.18, 6.4, s.get("accent", "accent"), x=-3.7, y=0.6, z=0.02)
    objs.append(bar)
    if s.get("kicker"):
        k = text(s["kicker"].upper(), 0.34, "clay", y=3.7, font=fonts["bold"])
        pop_in(k, start, fps, delay=0.05)
        objs.append(k)
    t = text(s["text"], s.get("size", 0.56), "ink", y=0.6, width=6.8, font=fonts["bold"])
    pop_in(t, start, fps, delay=0.12)
    objs.append(t)
    return objs


def build_stat(s, start, end, fps, fonts):
    objs = []
    ring = circle(2.6, "accent_tint", y=2.2)
    spin_in(ring, start, fps)
    pop_in(ring, start, fps, dist=0.0)
    objs.append(ring)
    v = text(s["value"], s.get("size", 1.15), "accent", y=2.2, width=5.2, font=fonts["bold"])
    pop_in(v, start, fps, delay=0.15)
    objs.append(v)
    lab = text(s["label"], 0.5, "ink", y=-1.6, width=7.6, font=fonts["body"])
    pop_in(lab, start, fps, delay=0.3)
    objs.append(lab)
    if s.get("cite"):
        c = text(s["cite"], 0.3, "muted", y=-3.4, width=7.6, font=fonts["body"])
        objs.append(c)
    return objs


def build_steps(s, start, end, fps, fonts):
    objs = []
    if s.get("title"):
        h = text(s["title"], 0.58, "ink", y=4.6, width=7.8, font=fonts["bold"])
        pop_in(h, start, fps)
        objs.append(h)
    items = s["items"][:4]
    gap = 1.9
    y0 = 2.4
    per = max(0.35, (end - start) / fps / (len(items) + 1))
    for i, item in enumerate(items):
        y = y0 - i * gap
        dot = circle(0.38, "clay", x=-3.4, y=y)
        num = text(str(i + 1), 0.42, "paper", x=-3.4, y=y, width=1.0, font=fonts["bold"], z=0.15)
        line = text(item, 0.42, "ink", x=-2.7, y=y, width=6.3, align="LEFT", font=fonts["body"])
        for ob in (dot, num, line):
            pop_in(ob, start, fps, delay=0.2 + i * per, dist=0.3)
            objs.append(ob)
    return objs


def build_myth(s, start, end, fps, fonts):
    objs = []
    myth_bg = rect(8.0, 3.6, "sand", y=3.0, radius=0.3)
    m_k = text("MYTH", 0.34, "clay", y=4.3, font=fonts["bold"])
    m_t = text(s["myth"], 0.5, "ink", y=2.8, width=7.0, font=fonts["bold"])
    strike = rect(6.6, 0.08, "clay", y=2.8, z=0.2)
    fact_bg = rect(8.0, 4.4, "accent", y=-2.0, radius=0.3)
    f_k = text("FACT", 0.34, "gold", y=-0.4, font=fonts["bold"])
    f_t = text(s["fact"], 0.46, "paper", y=-2.2, width=7.0, font=fonts["body"])
    for ob in (myth_bg, m_k, m_t):
        pop_in(ob, start, fps)
    grow_x(strike, start + int(0.9 * fps), start + int(1.3 * fps))
    for ob in (fact_bg, f_k, f_t):
        pop_in(ob, start, fps, delay=1.4)
    objs += [myth_bg, m_k, m_t, strike, fact_bg, f_k, f_t]
    return objs


def build_broll(s, start, end, fps, fonts):
    """Full-frame video plate (for example a Seedance 2.0 shot) with an optional caption over it."""
    objs = []
    path = os.path.abspath(s["video"])
    if not os.path.exists(path):
        raise SystemExit(f"b-roll file not found: {path}")
    img = bpy.data.images.load(path)
    img.source = "MOVIE"
    m = bpy.data.materials.new("m_broll")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.extension = "CLIP"
    iu = tex.image_user
    iu.frame_start = start
    iu.frame_duration = end - start + 1
    iu.use_auto_refresh = True
    nt.links.new(tex.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs[0])
    # Cover the 9:16 frame; a 16:9 source is cropped to its centre.
    w, h = img.size if img.size[0] else (1080, 1920)
    aspect = w / h
    plane_h = FRAME_H if aspect <= FRAME_W / FRAME_H else FRAME_W / aspect
    plane_h = max(plane_h, FRAME_H)
    plane_w = plane_h * aspect
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
    plate = bpy.context.active_object
    plate.scale = (plane_w, plane_h, 1)
    plate.data.materials.append(m)
    objs.append(plate)
    if s.get("text"):
        shade = rect(FRAME_W, 3.2, "ink", y=-4.6, z=0.05)
        cap = text(s["text"], 0.5, "paper", y=-4.6, width=7.8, font=fonts["bold"])
        pop_in(cap, start, fps, delay=0.2)
        objs += [shade, cap]
    tag = text("AI-generated footage", 0.22, "paper", y=6.7, font=fonts["body"], z=0.2)
    objs.append(tag)
    return objs


def build_end(s, start, end, fps, fonts):
    objs = []
    band = rect(FRAME_W, FRAME_H, "accent", z=0.0)
    objs.append(band)
    top = text(s.get("text", "Get the full answer and a free checklist"), 0.6, "paper", y=3.2, width=7.6, font=fonts["bold"])
    pop_in(top, start, fps)
    pill = rect(8.0, 1.5, "paper", y=0.6, radius=0.6)
    pop_in(pill, start, fps, delay=0.15, dist=0.2)
    url = text(s["url"], 0.4, "accent", y=0.6, width=7.6, font=fonts["bold"], z=0.2)
    pop_in(url, start, fps, delay=0.2, dist=0.2)
    sub = text(s.get("sub", "Link in bio. Illinois families only for now."), 0.36, "accent_tint", y=-1.4, width=7.6, font=fonts["body"])
    pop_in(sub, start, fps, delay=0.35)
    ref = text("We match you with an appropriate Illinois estate planning attorney.", 0.3, "accent_tint", y=-3.0, width=7.4, font=fonts["body"])
    objs += [top, pill, url, sub, ref]
    return objs


BUILDERS = {
    "hook": build_hook,
    "point": build_point,
    "stat": build_stat,
    "steps": build_steps,
    "myth": build_myth,
    "broll": build_broll,
    "end": build_end,
}


def build(spec, fps, fonts):
    t = 0
    starts = []
    for s in spec["scenes"]:
        if s["type"] not in BUILDERS:
            raise SystemExit(f"Unknown scene type: {s['type']}")
        n = max(1, int(round(float(s.get("seconds", 3)) * fps)))
        starts.append((s, t + 1, t + n))
        t += n
    total = t
    for s, a, b in starts:
        for ob in BUILDERS[s["type"]](s, a, b, fps, fonts):
            visible_between(ob, a, b)

    # Always-on chrome: brand line, progress bar, disclaimer.
    brand = text(spec.get("brand", "Family Future Planning"), 0.3, "muted", y=7.3, font=fonts["bold"], z=0.5)
    bar_bg = rect(FRAME_W, 0.12, "sand", y=-7.94, z=0.5)
    bar = rect(FRAME_W, 0.12, "gold", y=-7.94, z=0.55)
    bar.location.x = 0
    grow_x(bar, 1, total)
    disc = text(spec.get("disclaimer", DEFAULT_DISCLAIMER), 0.24, "muted", y=-7.35, width=8.4, font=fonts["body"], z=0.5)
    # The end card is a solid accent field, so the chrome switches to light text there.
    end_start = starts[-1][1] if starts and starts[-1][0]["type"] == "end" else None
    if end_start:
        visible_between(brand, 1, end_start - 1)
        visible_between(disc, 1, end_start - 1)
        disc_end = text(spec.get("disclaimer", DEFAULT_DISCLAIMER), 0.24, "accent_tint", y=-7.35, width=8.4, font=fonts["body"], z=0.5)
        visible_between(disc_end, end_start, total)
    _ = bar_bg
    return total


def render(spec, out, preview, scale, font, threads, audio=None):
    fps = int(spec.get("fps", 30))
    scene = reset_scene(fps, scale, threads)
    fonts = {"body": find_font(font), "bold": find_font(font, bold=True)}
    total = build(spec, fps, fonts)
    scene.frame_start = 1
    scene.frame_end = total
    os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)

    if preview is not None:
        scene.frame_set(preview)
        scene.render.image_settings.file_format = "PNG"
        scene.render.filepath = os.path.abspath(out)
        bpy.ops.render.render(write_still=True)
        print(f"Wrote preview frame {preview} of {total} to {out}")
        return

    # Render PNG frames, then encode with ffmpeg when it is on PATH (smaller files, faststart for social);
    # otherwise fall back to Blender's built-in FFmpeg writer.
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        tmp = tempfile.mkdtemp(prefix="short-")
        scene.render.image_settings.file_format = "PNG"
        scene.render.filepath = os.path.join(tmp, "f_")
        bpy.ops.render.render(animation=True)
        cmd = [ffmpeg, "-y", "-loglevel", "error", "-framerate", str(fps), "-i", os.path.join(tmp, "f_%04d.png"),
               *(["-i", os.path.abspath(audio), "-c:a", "aac", "-b:a", "160k", "-shortest"] if audio else []),
               "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", "-movflags", "+faststart", os.path.abspath(out)]
        subprocess.run(cmd, check=True)
        shutil.rmtree(tmp, ignore_errors=True)
    else:
        im = scene.render.image_settings
        if hasattr(im, "media_type"):
            im.media_type = "VIDEO"
        im.file_format = "FFMPEG"
        scene.render.ffmpeg.format = "MPEG4"
        scene.render.ffmpeg.codec = "H264"
        scene.render.ffmpeg.constant_rate_factor = "HIGH"
        scene.render.filepath = os.path.abspath(out)
        bpy.ops.render.render(animation=True)
    print(f"Wrote {total} frames ({total / fps:.1f}s) to {out}")


def main():
    args = parse_args()
    with open(args.spec, encoding="utf-8") as f:
        spec = json.load(f)
    if "videos" in spec:  # the content calendar: pick one video and use its blender block
        if not args.id:
            raise SystemExit("--id is required when --spec is the content calendar")
        video = next((v for v in spec["videos"] if v["id"] == args.id), None)
        if not video:
            raise SystemExit(f"No video {args.id} in {args.spec}")
        spec = {**spec.get("defaults", {}), **video["blender"]}
    if args.audio and not shutil.which("ffmpeg"):
        raise SystemExit("--audio needs ffmpeg on PATH")
    render(spec, args.out, args.preview, args.scale, args.font, args.threads, args.audio)


if __name__ == "__main__":
    main()
