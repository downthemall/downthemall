#!/usr/bin/env python3
import json
import os

from collections import OrderedDict
from glob import glob
from pathlib import Path
from subprocess import check_call as run
from zipfile import (ZipFile, ZipInfo, ZIP_DEFLATED, ZIP_STORED)

FILES = [
  "manifest.json",
  "_locales/**/*",
  "bundles/*",
  "style/*",
  "uikit/css/*",
  "windows/*.html",
  "Readme.*",
  "LICENSE.*",
]

UNCOMPRESSABLE = set((".png", ".jpg", ".zip", ".woff2"))
LICENSED = set((".css", ".html", ".js"))
IGNORED = set((".DS_Store", "Thumbs.db"))

PERM_IGNORED_FX = set(("downloads.shelf",))

SCRIPTS = [
  "yarn build:regexps",
  "yarn build:bundles",
]

def check_licenses():
  for file in Path().glob("**/*"):
    if "node_modules" in str(file):
      continue
    if not file.suffix in LICENSED:
      continue
    with file.open("rb") as fp:
      if not b"License:" in fp.read():
        raise Exception(f"No license in {file}")


def files():
  p = Path("")
  for pattern in FILES:
    for file in sorted(p.glob(pattern)):
      if file.name in IGNORED or not file.is_file():
        continue
      yield file

def build(out, manifest):
  with ZipFile(out, "w", compression=ZIP_DEFLATED, allowZip64=False, compresslevel=2) as zp:
    for file in files():
      if str(file) == "manifest.json":
        buf = manifest
      else:
        with file.open("rb") as fp:
          buf = fp.read()
        if file.suffix in LICENSED and not b"License:" in buf:
          raise Exception(f"No license in {file}")

      zinfo = ZipInfo(str(file), date_time=(2019, 1, 1, 0, 0, 0))
      if file.suffix in UNCOMPRESSABLE:
        zp.writestr(zinfo, buf, compress_type=ZIP_STORED)
      else:
        zp.writestr(zinfo, buf, compress_type=ZIP_DEFLATED, compresslevel=2)
      print(file)


def build_firefox():
  with open("manifest.json") as manip:
    infos = json.load(manip, object_pairs_hook=OrderedDict)
  version = infos.get("version")
  
  infos["permissions"] = [p for p in infos.get("permissions") if not p in PERM_IGNORED_FX]
  out = Path("web-ext-artifacts") / f"dta-{version}-fx.zip"
  if out.exists():
    out.unlink()
  print(out)
  build(out, json.dumps(infos).encode("utf-8"))

def main():
  check_licenses()
  for script in SCRIPTS:
    run([script], shell=True)
  build_firefox()

if __name__ == "__main__":
  main()