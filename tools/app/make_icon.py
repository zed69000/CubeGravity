# Fabrique l'icône de Date Gravity et toutes ses déclinaisons, à partir d'une proposition de Mockup/icones.html.
#   python tools/app/make_icon.py C8       (C8 = le nom de la proposition)
#
# Le dessin est en SVG dans la page de maquette ; Edge (sans fenêtre) le photographie en 1024 x 1024,
# puis ce script le réduit à chaque taille.
# Sorties :
#   icons/icon-1024.png, icon-512.png, icon-192.png, icon-180.png   site web, boutiques
#   tools/app/android-res/mipmap-*/                                  icônes Android, copiées par configure-native.mjs
#   tools/app/android-res/values/ic_launcher_background.xml          couleur de fond de l'icône adaptative
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BACKGROUND = "#B45AEE"   # fond de l'icône adaptative Android : ce qui dépasse autour du dessin (le violet du dégradé)
letter = sys.argv[1] if len(sys.argv) > 1 else "C8"


def shoot(query):
    """Photographie la page de maquette, fond transparent."""
    out = os.path.join(tempfile.mkdtemp(), "icon.png")
    url = (ROOT / "Mockup" / "icones.html").as_uri() + "?export=" + letter + query
    subprocess.run([EDGE, "--headless", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                    "--default-background-color=00000000", "--window-size=1024,1024", "--screenshot=" + out, url],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):  # Edge rend la main avant d'avoir fini d'écrire le fichier
        if os.path.exists(out) and os.path.getsize(out):
            break
        time.sleep(.2)
    time.sleep(.3)
    return Image.open(out).convert("RGBA")


def masked(img, shape):
    m = Image.new("L", img.size, 0)
    w = img.size[0] - 1
    if shape == "round":
        ImageDraw.Draw(m).ellipse([0, 0, w, w], fill=255)
    else:
        ImageDraw.Draw(m).rounded_rectangle([0, 0, w, w], radius=int(w * .19), fill=255)
    out = img.copy()
    out.putalpha(m)
    return out


def save(img, path, size):
    path = ROOT / path
    path.parent.mkdir(parents=True, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(path, optimize=True)


full, fg = shoot(""), shoot("&layer=fg")
for size in (1024, 512, 192, 180):
    save(full.convert("RGB"), "icons/icon-%d.png" % size, size)

# Android : icône adaptative (dessin dans la zone sûre centrale + couleur de fond),
# plus les anciennes icônes carrée et ronde pour les vieux lanceurs.
for name, base in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
    folder = "tools/app/android-res/mipmap-%s/" % name
    save(masked(full, "square"), folder + "ic_launcher.png", base)
    save(masked(full, "round"), folder + "ic_launcher_round.png", base)
    save(fg, folder + "ic_launcher_foreground.png", base * 9 // 4)
values = ROOT / "tools/app/android-res/values"
values.mkdir(parents=True, exist_ok=True)
(values / "ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">%s</color>\n</resources>\n' % BACKGROUND,
    encoding="utf-8", newline="\n")
print("icone", letter, "ecrite")
