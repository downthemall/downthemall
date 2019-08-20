jq -r 'to_entries[] | "\(.key)\n\(.value | .label)\nFilter label for the \(.value | .label) filter"' data/filters.json | ./util/addlocale.py >/dev/null
