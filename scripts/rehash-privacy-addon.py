#!/usr/bin/env python3
"""Re-hash the unminified privacy add-on after editing it, and rewire index.html, 404.html and sw.js.
Edit assets/privacy-*.js / assets/privacy-*.css in place, then run:  python3 scripts/rehash-privacy-addon.py
The script renames the files to privacy-<md5[:8]>.*, updates the <script>/<link> tags in index.html and 404.html,
updates the service-worker precache entries and the index.html revision (so installed copies refresh)."""
import hashlib, os, re, glob
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
md5 = lambda b: hashlib.md5(b).hexdigest()
def rehash(ext):
    (old,) = glob.glob(f"assets/privacy-*.{ext}")
    data = open(old, "rb").read()
    new = f"assets/privacy-{md5(data)[:8]}.{ext}"
    if new != old: os.rename(old, new)
    return old, new, md5(data)
(oj, nj, hj), (oc, nc, hc) = rehash("js"), rehash("css")
idx = open("index.html").read().replace("/" + oj, "/" + nj).replace("/" + oc, "/" + nc)
open("index.html", "w").write(idx); open("404.html", "w").write(idx)
sw = open("sw.js").read()
sw = re.sub(r'\{url:"assets/privacy-[^"]+\.js",revision:"[0-9a-f]+"\}', '{url:"%s",revision:"%s"}' % (nj, hj), sw)
sw = re.sub(r'\{url:"assets/privacy-[^"]+\.css",revision:"[0-9a-f]+"\}', '{url:"%s",revision:"%s"}' % (nc, hc), sw)
sw = re.sub(r'\{url:"index.html",revision:"[0-9a-f]+"\}', '{url:"index.html",revision:"%s"}' % md5(idx.encode()), sw)
open("sw.js", "w").write(sw)
print(nj, nc, "index.html", md5(idx.encode()))
