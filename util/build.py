#!/usr/bin/env python3
import json
import os
import sys

from datetime import datetime
from collections import OrderedDict
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

RELEASE_ID = "{DDC359D1-844A-42a7-9AA1-88A850A938A8}"

UNCOMPRESSABLE = set((".png", ".jpg", ".zip", ".woff2"))
LICENSED = set((".css", ".html", ".js", "*.ts"))
IGNORED = set((".DS_Store", "Thumbs.db"))
# XXX: #125
IGNORED_OPERA = set(("done.opus", "error.opus"))

PERM_IGNORED_FX = set(("downloads.shelf", "webRequest", "webRequestBlocking"))
PERM_IGNORED_CHROME = set(("menus", "sessions", "theme"))

SCRIPTS = [
  "yarn build:cleanup",
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


def files(additional_ignored):
  p = Path("")
  for pattern in FILES:
    for file in sorted(p.glob(pattern)):
      if file.name in IGNORED or file.name in additional_ignored or not file.is_file():
        continue
      yield file

def build(out, manifest, additional_ignored=set()):
  with ZipFile(out, "w", compression=ZIP_DEFLATED, allowZip64=False) as zp:
    for file in files(additional_ignored):
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
        zp.writestr(zinfo, buf, compress_type=ZIP_DEFLATED)
      print(file)


def build_firefox(args):
  now = datetime.now().strftime("%Y%m%d%H%M%S")
  with open("manifest.json") as manip:
    infos = json.load(manip, object_pairs_hook=OrderedDict)

  version = infos.get("version")
  if args.mode == "nightly":
    version = infos["version"] = f"{version}.{now}"

  version = infos.get("version")

  if args.mode != "release":
    infos["version_name"] = f"{version}-{args.mode}"
    infos["browser_specific_settings"]["gecko"]["id"] = f"{args.mode}@downthemall.org"
    infos["short_name"] = infos.get("name")
    infos["name"] = f"{infos.get('name')} {args.mode}"
  else:
    infos["browser_specific_settings"]["gecko"]["id"] = RELEASE_ID

  infos["permissions"] = [p for p in infos.get("permissions") if not p in PERM_IGNORED_FX]
  out = Path("web-ext-artifacts") / f"dta-{version}-{args.mode}-fx.zip"
  if not out.parent.exists():
    out.parent.mkdir()
  if out.exists():
    out.unlink()
  print("Output", out)
  build(out, json.dumps(infos, indent=2).encode("utf-8"))

  
def build_chromium(args, pkg, additional_ignored=set()):
  now = datetime.now().strftime("%Y%m%d%H%M%S")
  with open("manifest.json") as manip:
    infos = json.load(manip, object_pairs_hook=OrderedDict)

  version = infos.get("version")
  if args.mode == "nightly":
    version = infos["version"] = f"{version}.{now}"

  version = infos.get("version")

  del infos["browser_specific_settings"]
  if args.mode != "release":
    infos["version_name"] = f"{version}-{args.mode}"
    infos["short_name"] = infos.get("name")
    infos["name"] = f"{infos.get('name')} {args.mode}"

  infos["permissions"] = [p for p in infos.get("permissions") if not p in PERM_IGNORED_CHROME]
  out = Path("web-ext-artifacts") / f"dta-{version}-{args.mode}-{pkg}.zip"
  if not out.parent.exists():
    out.parent.mkdir()
  if out.exists():
    out.unlink()
  print("Output", out)
  build(out, json.dumps(infos, indent=2).encode("utf-8"), additional_ignored=additional_ignored)

def main():
  from argparse import ArgumentParser
  args = ArgumentParser()
  args.add_argument("--mode",
    type=str, default="dev", choices=["dev", "beta", "release", "nightly"])
  args = args.parse_args(sys.argv[1:])
  check_licenses()
  for script in SCRIPTS:
    if os.name == "nt":
      run(script.split(" "), shell=True)
    else:
      run([script], shell=True)
  build_firefox(args)
  build_chromium(args, "crx")
  build_chromium(args, "opr", IGNORED_OPERA)
  print("DONE.")

if __name__ == "__main__":
  main()