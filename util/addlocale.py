#!/usr/bin/env python3
"""Update an extension locale quickly, kinda"""
# pylint: disable=broad-except,unused-import,too-many-branches
# License: MIT

import os
import json
import re

try:
    import atexit
    import readline

    def init_rl():
        """Because why not"""
        histfile = os.path.join(os.path.expanduser("~"), ".addlocale.py.history")
        try:
            readline.read_history_file(histfile)
            # default history len is -1 (infinite), which may grow unruly
            readline.set_history_length(1000)
        except FileNotFoundError:
            pass

        atexit.register(readline.write_history_file, histfile)

    init_rl()

except ImportError:
    pass

def main():
    """Do it!"""
    with open("_locales/en/messages.json", "rb") as inp:
        try:
            data = json.load(inp)
        except Exception:
            data = dict()

    modified = False
    try:
        while True:
            try:
                mid = input("ID:  ").strip()
            except EOFError:
                return
            if not mid:
                return
            msg = input("Msg: ").strip()
            if not msg:
                return
            description = input("Dsc: ").strip() or ""
            if not re.search(r"\$(.+?)\$", msg):
                data[mid] = dict(message=msg, description=description)
                modified = True
                continue
            placeholders = dict()
            pidx = 1
            for match in re.finditer(r"\$(.+?)\$", msg):
                match = match[1].strip().lower()
                idx = f"${pidx}"
                pidx += 1
                example = input(f"${match} example: ").strip() or ""
                placeholders[match] = dict(content=idx, example=example)
            data[mid] = dict(
                message=msg,
                description=description,
                placeholders=placeholders)
            modified = True
    finally:
        if modified:
            try:
                with open("messages.json.tmp", "w", encoding="utf-8") as outp:
                    json.dump(data, outp, sort_keys=True, indent=2, ensure_ascii=False)
                os.replace("messages.json.tmp", "_locales/en/messages.json")
            finally:
                try:
                    os.unlink("messages.json.tmp")
                except Exception:
                    pass


if __name__ == "__main__":
    main()
