import struct, zlib, math, os

def png_chunk(name, data):
    c = zlib.crc32(name + data) & 0xffffffff
    return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)

def make_png(pixels, w, h):
    raw = b''.join(b'\x00' + bytes([v for px in row for v in px]) for row in pixels)
    compressed = zlib.compress(raw, 9)
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n' + png_chunk(b'IHDR', ihdr) + png_chunk(b'IDAT', compressed) + png_chunk(b'IEND', b''))

W = H = 512
pixels = [[(8, 8, 10)] * W for _ in range(H)]

def clamp(v): return max(0, min(255, int(v)))

CX, CY = W//2, H//2
for y in range(H):
    for x in range(W):
        dx, dy = x - CX, y - CY
        rx = max(abs(dx) - 190, 0)
        ry = max(abs(dy) - 190, 0)
        if rx*rx + ry*ry <= 900:
            pixels[y][x] = (18, 18, 26)

for y in range(H):
    for x in range(W):
        dx, dy = x - CX, y - CY
        dist = math.sqrt(dx*dx + dy*dy)
        if dist < 160:
            t = 1.0 - dist / 160.0
            base = pixels[y][x]
            pixels[y][x] = (clamp(base[0] + (245-base[0])*t*0.15), clamp(base[1] + (158-base[1])*t*0.15), clamp(base[2] + (11-base[2])*t*0.15))

for i in range(50):
    for dy2 in range(-6,7):
        for dx2 in range(-6,7):
            px2,py2 = CX-80+i+dx2, CY-50+i+dy2
            if 0<=px2<W and 0<=py2<H: pixels[py2][px2] = (245,158,11)
            px2,py2 = CX-80+i+dx2, CY+50-i+dy2
            if 0<=px2<W and 0<=py2<H: pixels[py2][px2] = (245,158,11)
for i in range(80):
    for dy2 in range(-6,7):
        px2,py2 = CX+10+i, CY+55+dy2
        if 0<=px2<W and 0<=py2<H: pixels[py2][px2] = (245,158,11)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(ROOT, 'resources'), exist_ok=True)
with open(os.path.join(ROOT, 'resources', 'icon.png'), 'wb') as f:
    f.write(make_png(pixels, W, H))
print('OK: resources/icon.png 512x512')
