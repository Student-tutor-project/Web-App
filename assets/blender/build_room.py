# Builds the conference-room pieces for the hero and exports website/public/model/room.glb.
# Run: blender -b -P assets/blender/build_room.py
# Blender is Z-up; the glTF exporter turns it Y-up, so three.js (x, y, z) = Blender (x, z, -y).
# Room shell (floor, walls, ceiling) and the city are built in three.js; this file holds the
# objects that need real modelling: the table, the laptop and the window frames.
import bpy, bmesh, math, os

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "website", "public", "model", "room.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def mat(name, color, metallic=0.0, rough=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    return m


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


M_TOP = mat("TableTop", srgb("#BDB7AE"), 0.0, 0.42)
M_CHROME = mat("Chrome", srgb("#E4E8EA"), 1.0, 0.12)
M_ALU = mat("Aluminium", srgb("#5B6166"), 0.9, 0.35)
M_SCREEN = mat("LaptopScreen", srgb("#0E1418"), 0.0, 0.08)
M_FRAME = mat("WindowFrame", srgb("#A9B1B6"), 0.85, 0.3)


def obj_from_bm(name, bm, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def bevel(o, width, segments=3):
    m = o.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    o.modifiers.new("wn", "WEIGHTED_NORMAL")


# ---------------- the table: a racetrack top on two chrome sled legs ----------------
table = bpy.data.objects.new("Table", None)
scene.collection.objects.link(table)

L, R, H, T = 1.85, 0.74, 0.75, 0.045       # half straight length, end radius, height, top thickness
pts = []
for i in range(25):                          # right end arc
    a = -math.pi / 2 + math.pi * i / 24
    pts.append((L + R * math.cos(a), R * math.sin(a)))
for i in range(25):                          # left end arc
    a = math.pi / 2 + math.pi * i / 24
    pts.append((-L + R * math.cos(a), R * math.sin(a)))
bm = bmesh.new()
verts = [bm.verts.new((x, y, H - T)) for x, y in pts]
face = bm.faces.new(verts)
ext = bmesh.ops.extrude_face_region(bm, geom=[face])
for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]:
    v.co.z += T
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
top = obj_from_bm("TableTop", bm, M_TOP)
bevel(top, 0.012, 4)
top.parent = table


def sled(x):
    # a flat chrome loop: floor runner, two uprights, a rail under the top
    c = bpy.data.curves.new("sled", "CURVE")
    c.dimensions = "3D"
    c.bevel_depth = 0.018
    c.bevel_resolution = 3
    sp = c.splines.new("POLY")
    w, z0, z1, r = 0.5, 0.012, H - T - 0.03, 0.08
    path = [(-w, z1), (-w, z0 + r), (-w + r * 0.3, z0 + r * 0.3), (-w + r, z0), (w - r, z0), (w - r * 0.3, z0 + r * 0.3), (w, z0 + r), (w, z1)]
    sp.points.add(len(path) - 1)
    for p, (y, z) in zip(sp.points, path):
        p.co = (x, y, z, 1)
    o = bpy.data.objects.new("Sled", c)
    scene.collection.objects.link(o)
    o.data.materials.append(M_CHROME)
    o.parent = table


sled(-1.25)
sled(1.25)

# ---------------- the laptop: open, at the left end of the table ----------------
laptop = bpy.data.objects.new("Laptop", None)
scene.collection.objects.link(laptop)
lw, ld, lt = 0.33, 0.23, 0.012
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1)
bmesh.ops.scale(bm, vec=(lw, ld, lt), verts=bm.verts)
bmesh.ops.translate(bm, vec=(0, 0, lt / 2), verts=bm.verts)
base = obj_from_bm("LaptopBase", bm, M_ALU)
bevel(base, 0.004, 3)
base.parent = laptop

# lid hinged at the back edge (+y in Blender = away from the user), opened to about 110 degrees
lid = bpy.data.objects.new("LaptopLid", None)
scene.collection.objects.link(lid)
lid.parent = laptop
lid.location = (0, ld / 2, lt)
lid.rotation_euler = (math.radians(-20), 0, 0)
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1)
bmesh.ops.scale(bm, vec=(lw, 0.007, 0.215), verts=bm.verts)
bmesh.ops.translate(bm, vec=(0, 0.0035, 0.1075), verts=bm.verts)
shell = obj_from_bm("LaptopShell", bm, M_ALU)
bevel(shell, 0.003, 2)
shell.parent = lid
bm = bmesh.new()                             # the display: a separate mesh so the site can light it
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
bmesh.ops.scale(bm, vec=(lw - 0.02, 0.195, 1), verts=bm.verts)
bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(math.radians(90), 3, "X"))
bmesh.ops.translate(bm, vec=(0, -0.0006, 0.11), verts=bm.verts)
screen = obj_from_bm("LaptopScreen", bm, M_SCREEN)
screen.parent = lid
# UVs for the display so the site can paint a glow on it
uv = screen.data.uv_layers.new(name="UVMap")

laptop.location = (-L - 0.2, -0.36, H)       # left end, near side; the user sits at -y, the hinge is at +y
laptop.rotation_euler = (0, 0, math.radians(8))
laptop.parent = table

# ---------------- window frames: mullions along the glass wall ----------------
frames = bpy.data.objects.new("WindowFrames", None)
scene.collection.objects.link(frames)


def bar(name, size, loc):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    bmesh.ops.translate(bm, vec=loc, verts=bm.verts)
    o = obj_from_bm(name, bm, M_FRAME)
    o.parent = frames


# the glass wall runs along x = -4.5 (three.js), from z = +6 to z = -6, 3 m tall
WX, Z0, Z1, HT = -4.5, 6.0, -6.0, 3.0
n = 8
for i in range(n + 1):
    z = Z0 + (Z1 - Z0) * i / n
    bar(f"Mullion{i}", (0.07, 0.07, HT), (WX, -z, HT / 2))
bar("Sill", (0.12, abs(Z1 - Z0), 0.1), (WX, 0, 0.05))
bar("Head", (0.12, abs(Z1 - Z0), 0.1), (WX, 0, HT - 0.05))

# apply modifiers so the export is plain meshes
bpy.ops.object.select_all(action="DESELECT")
for o in scene.objects:
    if o.type in {"MESH", "CURVE"}:
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
bpy.ops.object.convert(target="MESH")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", export_apply=True, export_yup=True)
print("EXPORTED", os.path.abspath(OUT))
