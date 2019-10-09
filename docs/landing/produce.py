import sys
from path import Path
from subprocess import check_call

options = '-map v:0 -map_metadata -1 -c:v libvpx-vp9 -deadline best -b:v 0 -crf 5 -pass 2 -row-mt 1 -vf scale=720:480:force_original_aspect_ratio=decrease:flags=spline+accurate_rnd+full_chroma_int+full_chroma_inp,pad=720:480:(ow-iw)/2:(oh-ih)/2:color=White'.split(" ")

for f in Path(".").files("*.mov"):
    for p in [1, 2]:
        d = f.namebase + ".webm"
        final = ["ffmpeg", "-y", "-i", f.name] + options + ["-pass", str(p), d]
        print(final)
        check_call(final)
for f in Path(".").files("*.webm"):
    for ext in [".png", ".jpg"]:
        d = f.namebase + ext
        final = ["ffmpeg", "-y", "-i", f, "-ss", "1", "-q:v", "2", "-frames", "1", d]
        print(final)
        check_call(final)
