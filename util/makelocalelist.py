#!/usr/bin/env python3
import json
from pathlib import Path

langs = sorted(Path("_locales").glob("**/messages.json"), key=lambda p: p.parent.name.casefold())
all = {}
for m in langs:
  loc = m.parent.name
  with m.open("r", encoding="utf-8") as mp:
    lang = json.load(mp).get("language").get("message")
  if not lang:
    raise Exception(f"{m}: no language")
  lang = f"{lang} [{loc}]"
  all[loc] = lang
with open("_locales/all.json", "wb") as op:
  op.write(json.dumps(all, indent=2, ensure_ascii=False).encode("utf-8"))