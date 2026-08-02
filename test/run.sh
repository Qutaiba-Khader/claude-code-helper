#!/usr/bin/env bash
# Regression harness for the generated status line script.
#
#   test/run.sh                 check every payload against every config
#   test/run.sh --snapshot      record the current output as the expected output
#   test/run.sh --bench         time it and count the processes it starts
#
# Assertions are on `od -c`, not the visible string: the defects this catches —
# a dropped colour, a CR welded onto a field, a width measured in bytes — are all
# invisible in plain text.
set -uo pipefail
cd "$(dirname "$0")/.."

SCRIPT=tools/statusline/statusline.sh
PAYLOADS=(test/payloads/*.json)
EXPECTED=test/expected
RAMP='c46,c82,c118,c154,c190,c226,c220,c214,c208,c196'

# Two configs: the shipped default, and one with every field and align:true so
# the column-padding path is exercised.
config_default() { grep -m1 "^CONFIG='" "$SCRIPT" | sed "s/^CONFIG='//;s/'$//"; }
config_all() {
  local ids f rows=''
  ids=$(grep -o "^    [a-z_0-9]*)" "$SCRIPT" | tr -d ' )' | sort -u |
        grep -vE '^(black|blue|red|green|yellow|magenta|purple|cyan|white|grey|gray|dim|bold|heat|ramp|default|text)$')
  for f in $ids; do
    rows+="{\"f\":\"$f\",\"c\":\"ramp\",\"r\":\"$RAMP\",\"b\":\"dim\"},"
  done
  printf '{"v":2,"align":true,"icons":true,"rows":[[%s{"f":"text","c":"grey","t":"|"}],[{"f":"rule","c":"grey"}]]}' "$rows"
}

render() {  # render <config> <payload-file>
  local cfg=$1 pl=$2 tmp
  tmp=$(mktemp)
  awk -v cfg="$cfg" '!d && /^CONFIG=/ { print "CONFIG=\047" cfg "\047"; d=1; next } { print }' \
    "$SCRIPT" > "$tmp"
  # Claude Code runs the status line with LANG empty and LC_ALL unset, so the
  # harness must too — otherwise it papers over the locale the script has to
  # pick for itself. Clock and width are fixed so a snapshot is stable.
  env -u LC_ALL -u LANG COLUMNS=100 EPOCHSECONDS=4000000000 bash "$tmp" < "$pl" 2>&1
  rm -f "$tmp"
}

case "${1:-check}" in
--bench)
  pl=test/payloads/everything.json
  cfg=$(config_default)
  tmp=$(mktemp)
  awk -v c="$cfg" '!d && /^CONFIG=/ { print "CONFIG=\047" c "\047"; d=1; next } { print }' "$SCRIPT" > "$tmp"
  s=$(date +%s%N); for _ in $(seq 1 30); do bash "$tmp" < "$pl" >/dev/null 2>&1; done; e=$(date +%s%N)
  printf 'default layout: %sms per run\n' $(( (e - s) / 30000000 ))
  if command -v strace >/dev/null; then
    printf 'processes     : %s\n' \
      "$(strace -f -c -e trace=clone,clone3,execve bash "$tmp" < "$pl" 2>&1 >/dev/null | awk '/total/{print $4}')"
  fi
  rm -f "$tmp"
  ;;

--snapshot)
  mkdir -p "$EXPECTED"
  for pl in "${PAYLOADS[@]}"; do
    for name in default all; do
      cfg=$(config_"$name")
      render "$cfg" "$pl" | od -c > "$EXPECTED/$(basename "$pl" .json).$name.od"
    done
  done
  echo "recorded $(( ${#PAYLOADS[@]} * 2 )) snapshots in $EXPECTED"
  ;;

*)
  fail=0 n=0
  for pl in "${PAYLOADS[@]}"; do
    for name in default all; do
      n=$(( n + 1 ))
      cfg=$(config_"$name")
      got=$(render "$cfg" "$pl" | od -c)
      exp_file="$EXPECTED/$(basename "$pl" .json).$name.od"

      # nothing may ever reach stderr, whatever the payload
      err=$(render "$cfg" "$pl" 2>/dev/null >/dev/null; :)
      err=$(env -u LC_ALL -u LANG COLUMNS=100 bash -c '
              awk -v c="$1" "!d && /^CONFIG=/ { print \"CONFIG=\047\" c \"\047\"; d=1; next } { print }" "$2" > "$3"
              bash "$3" < "$4" 2>&1 >/dev/null' _ "$cfg" "$SCRIPT" "$(mktemp)" "$pl" | tr -d '\n')
      if [ -n "$err" ]; then
        printf 'STDERR  %-22s %-8s %s\n' "$(basename "$pl")" "$name" "${err:0:70}"
        fail=$(( fail + 1 ))
        continue
      fi
      if [ ! -f "$exp_file" ]; then
        printf 'NEW     %-22s %-8s (run --snapshot to record)\n' "$(basename "$pl")" "$name"
        continue
      fi
      if [ "$got" != "$(cat "$exp_file")" ]; then
        printf 'DIFF    %-22s %-8s\n' "$(basename "$pl")" "$name"
        diff <(printf '%s' "$(cat "$exp_file")") <(printf '%s' "$got") | head -6 | sed 's/^/          /'
        fail=$(( fail + 1 ))
      else
        printf 'ok      %-22s %-8s\n' "$(basename "$pl")" "$name"
      fi
    done
  done
  printf '\n%d cases, %d failed\n' "$n" "$fail"
  [ "$fail" -eq 0 ]
  ;;
esac
