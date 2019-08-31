#!/usr/bin/env python3

import json
import re
from collections import OrderedDict
from pathlib import Path

re_valid = re.compile("[^A-Za-z0-9_]")

for file in Path("_locales/").glob("**/*.json"):
  with file.open("r") as filep:
    messages = json.load(filep, object_pairs_hook=OrderedDict)
  for x in list(messages):
    prev = x
    while True:
      y = re_valid.sub("_", x)
      if prev == y:
        break
      prev = y
    if x == y:
      continue
    messages[y] = messages[x]
    del messages[x]
  with file.open("w", encoding="utf-8") as filep:
    json.dump(messages, filep, ensure_ascii=False, indent=2)