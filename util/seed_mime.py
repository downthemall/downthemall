#!/usr/bin/env python3

import json
import re
import sys
from collections import OrderedDict

def unique(seq):
  return list(OrderedDict([i, None] for i in seq if i))

def generate(major, minor, exts):
  exts = exts[:]
  yield f"{major}/{minor}", exts
  if (minor.startswith("x-")):
    yield f"{major}/{minor[2:]}", exts
  else:
    yield f"{major}/x-{minor}", exts
  for ext in exts:
    yield f"{major}/{ext}", exts
    yield f"{major}/x-{ext}", exts


def make(text, final):
  lines = "".join([
    line.strip()
    for line in re.search(r"\{(.*)\}", text, re.S).group(1).split("\n")
    if line.strip() and not line.strip().startswith("#")
  ]).split(";")

  additional = []
  for line in lines:
    if not line:
      continue
    m = re.match(r"([a-z1-9]+)/([^\s]+)\s+(.+?)$", line)
    if not m:
      continue
    [major, minor, exts] = m.groups()
    exts = unique(e.lower().strip() for e in exts.split(" ") if e.strip())
    mime = f"{major}/{minor}"
    if mime == "application/octet-stream":
      continue
    if mime in final:
      final[mime] += exts
      continue
    final[mime] = exts
    additional += (major, minor, exts),

  for [major, minor, exts] in additional:
    for [mime, exts] in generate(major, minor, exts):
      if mime in final:
        continue
      final[mime] = exts

final = OrderedDict()
for file in sys.argv[1:]:
  with open(file, "r") as fp:
    make(fp.read(), final)

multi = dict()
for [mime, exts] in list(final.items()):
  exts = unique(exts)
  prim = exts[0]
  final[mime] = prim
  if len(exts) == 1:
    continue
  exts = exts[1:]
  if len(exts) == 1:
    multi[prim] = exts[0]
  else:
    multi[prim] = exts

final = OrderedDict(sorted(final.items()))
multi = OrderedDict(sorted(multi.items()))

print(json.dumps(dict(e=multi, m=final), indent=2))
print("generated", len(final), "mimes", "with", len(multi), "multis", file=sys.stderr)