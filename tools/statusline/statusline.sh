#!/bin/bash
# Claude Code status line — built with claude-code-helper
# https://qutaiba-khader.github.io/claude-code-helper/tools/statusline/
#
# Reads the Status-hook JSON on stdin and renders the layout described by CONFIG
# below as an aligned grid. Requires `jq`; the `branch` field also needs `git`.
#
# To change the layout, either re-run the builder or hand-edit the CONFIG line.

CONFIG='{"v":2,"align":true,"icons":true,"rows":[[{"f":"userhost","c":"bold-green"},{"f":"text","c":"grey","t":"|"},{"f":"cwd","c":"bold-blue"},{"f":"text","c":"grey","t":"|"},{"f":"branch","c":"bold-yellow"}],[{"f":"tokens","c":"bold-magenta"},{"f":"text","c":"grey","t":"|"},{"f":"model_ctx","c":"bold-cyan"},{"f":"text","c":"grey","t":"|"},{"f":"effort","c":"dim"}],[{"f":"rl5","c":"ramp","r":"green,green,green,green,green,yellow,yellow,red,red,bold-red"},{"f":"text","c":"grey","t":"|"},{"f":"rl7","c":"ramp","r":"green,green,green,green,green,yellow,yellow,red,red,bold-red"},{"f":"text","c":"grey","t":"|"},{"f":"ctx_bar","c":"ramp","r":"green,green,green,green,green,yellow,yellow,red,red,bold-red"}],[{"f":"rule","c":"grey"}]]}'

input=$(cat)

# --- payload -> shell vars -------------------------------------------------
# \x1f (unit separator) keeps empty fields intact; a whitespace IFS would
# collapse runs of them and shift every value into the wrong variable.
IFS=$'\037' read -r \
  p_cwd p_pdir p_model p_model_id p_in p_out p_ctx p_ctxpct p_ctxleft \
  p_rl5 p_rl5r p_rl7 p_rl7r p_cost p_effort p_think p_fast p_style \
  p_version p_session p_vim p_agent p_owner p_repo p_prnum p_prstate p_prurl \
  p_wt p_wtbranch p_gwt p_dur p_apidur p_added p_removed p_over200k \
  p_cread p_cwrite p_adddirs p_sid <<<"$(
  printf '%s' "$input" | jq -j '
    def s: if . == null then "" else tostring end;
    [ (.workspace.current_dir // .cwd // ""),
      (.workspace.project_dir // ""),
      (.model.display_name // ""),
      (.model.id // ""),
      (.context_window.total_input_tokens | s),
      (.context_window.total_output_tokens | s),
      (.context_window.context_window_size | s),
      (.context_window.used_percentage | s),
      (.context_window.remaining_percentage | s),
      (.rate_limits.five_hour.used_percentage | s),
      (.rate_limits.five_hour.resets_at | s),
      (.rate_limits.seven_day.used_percentage | s),
      (.rate_limits.seven_day.resets_at | s),
      (.cost.total_cost_usd | s),
      (.effort.level | s),
      (.thinking.enabled | s),
      (.fast_mode | s),
      (.output_style.name | s),
      (.version | s),
      (.session_name | s),
      (.vim.mode | s),
      (.agent.name | s),
      (.workspace.repo.owner | s),
      (.workspace.repo.name | s),
      (.pr.number | s),
      (.pr.review_state | s),
      (.pr.url | s),
      (.worktree.name | s),
      (.worktree.branch | s),
      (.workspace.git_worktree | s),
      (.cost.total_duration_ms | s),
      (.cost.total_api_duration_ms | s),
      (.cost.total_lines_added | s),
      (.cost.total_lines_removed | s),
      (.exceeds_200k_tokens | s),
      (.context_window.current_usage.cache_read_input_tokens | s),
      (.context_window.current_usage.cache_creation_input_tokens | s),
      (.workspace.added_dirs // [] | length | s),
      (.session_id | s)
    ] | join("\u001f")' 2>/dev/null
)"
[ -n "$p_cwd" ] || p_cwd="$PWD"

# --- config -> shell vars --------------------------------------------------
IFS=$'\037' read -r cfg_align cfg_icons cfg_links <<<"$(
  printf '%s' "$CONFIG" | jq -j '
    def b(d): if . == null then d else . end | tostring;
    [ (.align | b(true)), (.icons | b(true)), (.links | b(false)) ]
    | join("\u001f")' 2>/dev/null
)"

RST=$'\033[0m'

# name -> ANSI SGR
colour() {
  case "$1" in
    bold-*)  printf '\033[1;%sm' "$(basecode "${1#bold-}")" ;;
    heat|ramp|default|"") : ;;
    *)       local b; b=$(basecode "$1"); [ -n "$b" ] && printf '\033[%sm' "$b" ;;
  esac
}
basecode() {
  case "$1" in
    black) echo 30 ;; red) echo 31 ;; green) echo 32 ;; yellow) echo 33 ;;
    blue) echo 34 ;; magenta|purple) echo 35 ;; cyan) echo 36 ;; white) echo 37 ;;
    grey|gray) echo '38;5;244' ;; dim) echo 2 ;; *) echo '' ;;
  esac
}
# ramp <comma-separated-colours> <percentage> — picks the band the value falls in.
# Ten bands: 0-9, 10-19, … 90-100. Fewer colours than bands is fine; the list
# is stretched to cover the range.
ramp_colour() {
  local list=$1 pctv=${2%%.*} n i band
  case "$pctv" in ''|*[!0-9]*) pctv=0 ;; esac
  [ "$pctv" -gt 100 ] && pctv=100
  IFS=',' read -r -a RC <<<"$list"
  n=${#RC[@]}
  [ "$n" -gt 0 ] || return
  band=$(( pctv * n / 100 ))
  [ "$band" -ge "$n" ] && band=$(( n - 1 ))
  colour "${RC[$band]}"
}

# green under 50%, yellow 50-79%, red 80%+
heat() {
  local p=${1%%.*}
  case "$p" in ''|*[!0-9]*) p=0 ;; esac
  if   [ "$p" -ge 80 ]; then printf '\033[31m'
  elif [ "$p" -ge 50 ]; then printf '\033[33m'
  else                       printf '\033[32m'; fi
}

ico() {  # ico <glyph> <ascii-fallback>
  if [ "$cfg_icons" = "true" ]; then printf '%s' "$1"; else printf '%s' "$2"; fi
}

tok() {  # 41500 -> 41k
  local n=${1:-0}
  case "$n" in ''|*[!0-9]*) n=0 ;; esac
  if [ "$n" -ge 1000 ]; then printf '%dk' $(( n / 1000 )); else printf '%d' "$n"; fi
}

pct() { printf '%d%%' "${1%%.*}"; }

ctxsize() {  # 1000000 -> 1M, 200000 -> 200k
  local n=${1:-0}
  case "$n" in ''|*[!0-9]*) return ;; esac
  if   [ "$n" -ge 1000000 ] && [ $(( n % 1000000 )) -eq 0 ]; then printf '%dM' $(( n / 1000000 ))
  elif [ "$n" -ge 1000 ]; then printf '%dk' $(( n / 1000 ))
  else printf '%d' "$n"; fi
}

countdown() {  # unix epoch seconds, or an ISO-8601 timestamp
  local raw=$1 epoch now left
  [ -n "$raw" ] || return
  if [[ $raw =~ ^[0-9]+$ ]]; then epoch=$raw
  else epoch=$(date -d "$raw" +%s 2>/dev/null) || return; fi
  now=$(date +%s); left=$(( epoch - now ))
  [ "$left" -gt 0 ] || return
  if   [ "$left" -ge 86400 ]; then printf '%dd%dh' $(( left / 86400 )) $(( left % 86400 / 3600 ))
  elif [ "$left" -ge 3600 ];  then printf '%dh%02dm' $(( left / 3600 )) $(( left % 3600 / 60 ))
  else                             printf '%dm' $(( left / 60 )); fi
}

dur() {  # milliseconds -> 1h04m / 12m / 45s
  local ms=${1:-0} sec
  case "$ms" in ''|*[!0-9]*) return ;; esac
  sec=$(( ms / 1000 ))
  if   [ "$sec" -ge 3600 ]; then printf '%dh%02dm' $(( sec / 3600 )) $(( sec % 3600 / 60 ))
  elif [ "$sec" -ge 60 ];   then printf '%dm' $(( sec / 60 ))
  else                           printf '%ds' "$sec"; fi
}

# OSC 8 hyperlink, when links are enabled and the terminal supports them
link() {  # link <url> <text>
  if [ "$cfg_links" = "true" ] && [ -n "$1" ]; then
    printf '\033]8;;%s\033\\%s\033]8;;\033\\' "$1" "$2"
  else
    printf '%s' "$2"
  fi
}

# home directory as ~
tilde() {
  local d=$1
  case "$d" in
    "$HOME") printf '~' ;;
    "$HOME"/*) printf '~%s' "${d#"$HOME"}" ;;
    *) printf '%s' "$d" ;;
  esac
}

# --- field renderers -------------------------------------------------------
# render <field-id> <custom-text> -> the cell's text (empty = cell omitted)
render() {
  local f=$1 txt=$2 showicon=${3:-1} v
  # aff <text> — a leading glyph or word, dropped when the cell's icon is off
  aff() { [ "$showicon" = "1" ] && printf '%s' "$1"; }
  case "$f" in
    text)      printf '%s' "$txt" ;;
    user)      whoami ;;
    host)      hostname -s ;;
    userhost)  printf '%s@%s' "$(whoami)" "$(hostname -s)" ;;
    cwd)       tilde "$p_cwd" ;;
    cwd_base)  printf '%s' "${p_cwd##*/}" ;;
    project)   [ -n "$p_pdir" ] && printf '%s' "${p_pdir##*/}" ;;
    branch)
      local br dirty=""
      if br=$(git --no-optional-locks -C "$p_cwd" rev-parse --abbrev-ref HEAD 2>/dev/null); then
        [ "$br" = "HEAD" ] && br=$(git --no-optional-locks -C "$p_cwd" rev-parse --short HEAD 2>/dev/null)
        git --no-optional-locks -C "$p_cwd" diff --quiet --ignore-submodules HEAD 2>/dev/null || dirty="*"
        printf '%s%s%s' "$(aff "$(ico '⎇' 'git:') ")" "$br" "$dirty"
      elif [ -n "$p_wtbranch" ]; then
        printf '%s%s' "$(aff "$(ico '⎇' 'git:') ")" "$p_wtbranch"
      fi ;;
    repo)      [ -n "$p_repo" ] && printf '%s/%s' "$p_owner" "$p_repo" ;;
    pr)        [ -n "$p_prnum" ] && link "$p_prurl" "PR #$p_prnum${p_prstate:+ ($p_prstate)}" ;;
    worktree)  [ -n "$p_wt" ] && printf '%s%s' "$(aff "$(ico '⑂' 'wt:') ")" "$p_wt" ;;
    git_worktree) [ -n "$p_gwt" ] && printf '%s%s' "$(aff "$(ico '⑂' 'wt:') ")" "$p_gwt" ;;
    added_dirs)   [ "${p_adddirs:-0}" -gt 0 ] 2>/dev/null && printf '+%s dir' "$p_adddirs" ;;
    model)     printf '%s' "$p_model" ;;
    model_ctx)
      [ -n "$p_model" ] || return
      v=$p_model
      if [[ $p_model_id == *'[1m]'* || $p_model_id == *-1m* ]] && [[ $v != *1M* ]]; then
        v="$v 1M"
      elif [ "${p_ctx:-0}" -gt 0 ] 2>/dev/null; then
        v="$v $(ctxsize "$p_ctx")"
      fi
      printf '%s' "$v" ;;
    ctx_size)  [ "${p_ctx:-0}" -gt 0 ] 2>/dev/null && ctxsize "$p_ctx" ;;
    tokens)
      [ "${p_ctx:-0}" -gt 0 ] 2>/dev/null || return
      printf '%s/%s (%d%%)' "$(tok "$p_in")" "$(tok "$p_ctx")" $(( p_in * 100 / p_ctx )) ;;
    tokens_plain)
      [ "${p_ctx:-0}" -gt 0 ] 2>/dev/null || return
      printf '%s/%s' "$(tok "$p_in")" "$(tok "$p_ctx")" ;;
    ctx_pct)   [ -n "$p_ctxpct" ]  && printf '%s%s' "$(aff 'ctx ')" "$(pct "$p_ctxpct")" ;;
    tokens_pct)
      # the percentage on its own, computed from the token counts so it works
      # even before used_percentage is populated
      if [ -n "$p_ctxpct" ]; then printf '%s' "$(pct "$p_ctxpct")"
      elif [ "${p_ctx:-0}" -gt 0 ] 2>/dev/null; then printf '%d%%' $(( p_in * 100 / p_ctx ))
      fi ;;
    ctx_left)  [ -n "$p_ctxleft" ] && printf '%s%s' "$(pct "$p_ctxleft")" "$(aff ' left')" ;;
    ctx_bar)
      [ -n "$p_ctxpct" ] || return
      local n=${p_ctxpct%%.*} i filled bar=""
      filled=$(( n * 10 / 100 ))
      for ((i=0;i<10;i++)); do
        if [ $i -lt $filled ]; then bar+=$(ico '▰' '#'); else bar+=$(ico '▱' '.'); fi
      done
      printf '%s' "$bar" ;;
    out_tokens) [ "${p_out:-0}" -gt 0 ] 2>/dev/null && printf '%s%s' "$(aff "$(ico '↑' 'out') ")" "$(tok "$p_out")" ;;
    cache_read)  [ "${p_cread:-0}" -gt 0 ] 2>/dev/null && printf '%s%s' "$(aff 'cache ')" "$(tok "$p_cread")" ;;
    cache_write) [ "${p_cwrite:-0}" -gt 0 ] 2>/dev/null && printf '%s%s' "$(aff 'cw ')" "$(tok "$p_cwrite")" ;;
    over200k)    [ "$p_over200k" = "true" ] && printf '%s200k+' "$(aff "$(ico '⚠ ' '!')")" ;;
    effort)    printf '%s' "$p_effort" ;;
    thinking)  [ "$p_think" = "false" ] && printf 'no-think' ;;
    fast)      [ "$p_fast" = "true" ] && ico '⚡' 'fast' ;;
    style)     [ -n "$p_style" ] && [ "$p_style" != "default" ] && printf '%s' "$p_style" ;;
    vim)       [ -n "$p_vim" ] && printf '%s' "$p_vim" ;;
    agent)     [ -n "$p_agent" ] && printf '%s%s' "$(aff '@')" "$p_agent" ;;
    session)   printf '%s' "$p_session" ;;
    version)   [ -n "$p_version" ] && printf '%s%s' "$(aff 'v')" "$p_version" ;;
    rl5)
      [ -n "$p_rl5" ] || return
      v="$(aff '5h ')$(pct "$p_rl5")"
      local cd; cd=$(countdown "$p_rl5r"); [ -n "$cd" ] && v="$v $(aff "$(ico '↻' 'in') ")$cd"
      printf '%s' "$v" ;;
    rl7)
      [ -n "$p_rl7" ] || return
      v="$(aff '7d ')$(pct "$p_rl7")"
      local cd; cd=$(countdown "$p_rl7r"); [ -n "$cd" ] && v="$v $(aff "$(ico '↻' 'in') ")$cd"
      printf '%s' "$v" ;;
    rl5_bare) [ -n "$p_rl5" ] && printf '%s%s' "$(aff '5h ')" "$(pct "$p_rl5")" ;;
    rl7_bare) [ -n "$p_rl7" ] && printf '%s%s' "$(aff '7d ')" "$(pct "$p_rl7")" ;;
    cost)     [ -n "$p_cost" ] && printf '$%.2f' "$p_cost" 2>/dev/null ;;
    duration)     dur "$p_dur" ;;
    api_duration) v=$(dur "$p_apidur"); [ -n "$v" ] && printf '%s%s' "$(aff 'api ')" "$v" ;;
    lines)
      [ -n "$p_added$p_removed" ] || return
      printf '+%s/-%s' "${p_added:-0}" "${p_removed:-0}" ;;
    lines_added)   [ -n "$p_added" ]   && printf '+%s' "$p_added" ;;
    lines_removed) [ -n "$p_removed" ] && printf '-%s' "$p_removed" ;;
    session_id)   [ -n "$p_sid" ] && printf '%s' "${p_sid:0:8}" ;;
    time)     date +%H:%M ;;
    date)     date +%Y-%m-%d ;;
  esac
}

# the percentage a "heat"-coloured field should be graded against
heatval() {
  case "$1" in
    rl5|rl5_bare) printf '%s' "$p_rl5" ;;
    rl7|rl7_bare) printf '%s' "$p_rl7" ;;
    ctx_pct|ctx_bar|tokens|tokens_plain|tokens_pct) printf '%s' "$p_ctxpct" ;;
    ctx_left) printf '%s' "$p_ctxleft" ;;
  esac
}

# Length of a cell as the terminal sees it: escape sequences take no columns.
vislen() {
  local t=$1 out=""
  while [[ $t == *$'\033'* ]]; do
    out+=${t%%$'\033'*}
    t=${t#*$'\033'}
    case $t in
      '['*)    t=${t#*m} ;;                    # CSI ... m
      ']8;;'*) t=${t#*$'\033\\'} ;;            # OSC 8 ... ST
      *)       t=${t:1} ;;
    esac
  done
  out+=$t
  printf '%s' "${#out}"
}

# --- build the grid --------------------------------------------------------
# One line per cell: row \x1f field \x1f colour \x1f custom-text
mapfile -t CELLS < <(printf '%s' "$CONFIG" | jq -r '
  .rows // [] | to_entries[] as $r | $r.value | to_entries[] |
  [ ($r.key|tostring), (.value.f // ""), (.value.c // ""), (.value.t // ""),
    (if .value.i == false then "0" else "1" end), (.value.r // "") ]
  | join("\u001f")' 2>/dev/null)

declare -A TXT FMT LEN
declare -a COUNT RULEROW RULEFIT
nrows=0; ncols=0
for line in "${CELLS[@]}"; do
  IFS=$'\037' read -r r f c t ci ramp <<<"$line"
  [ -n "$f" ] || continue
  # cells are laid out in the order they appear, gaps closed up per row
  idx=${COUNT[$r]:-0}; COUNT[$r]=$(( idx + 1 ))
  if [ "$f" = "rule" ]; then
    RULEROW[$r]=1
    [ "$t" = "fit" ] && RULEFIT[$r]=1
    TXT[$r,$idx]=''
    LEN[$r,$idx]=0
    FMT[$r,$idx]=$(colour "${c:-grey}")
    [ $(( r + 1 )) -gt $nrows ] && nrows=$(( r + 1 ))
    continue
  fi
  txt=$(render "$f" "$t" "$ci")
  TXT[$r,$idx]=$txt
  LEN[$r,$idx]=$(vislen "$txt")
  if [ "$c" = "heat" ]; then FMT[$r,$idx]=$(heat "$(heatval "$f")")
  elif [ "$c" = "ramp" ] && [ -n "$ramp" ]; then FMT[$r,$idx]=$(ramp_colour "$ramp" "$(heatval "$f")")
  else FMT[$r,$idx]=$(colour "$c"); fi
  [ $(( r + 1 )) -gt $nrows ] && nrows=$(( r + 1 ))
  [ $(( idx + 1 )) -gt $ncols ] && ncols=$(( idx + 1 ))
done

# rows whose cells are all empty are dropped; trailing empty cells are trimmed
declare -a LAST
for ((r=0; r<nrows; r++)); do
  LAST[$r]=-1
  if [ "${RULEROW[$r]:-0}" = 1 ]; then LAST[$r]=0; continue; fi
  for ((c=0; c<ncols; c++)); do [ -n "${TXT[$r,$c]}" ] && LAST[$r]=$c; done
done

# column widths, from the widest cell in each column
declare -a W
for ((c=0; c<ncols; c++)); do
  W[$c]=0
  for ((r=0; r<nrows; r++)); do
    [ "${LAST[$r]}" -ge 0 ] || continue
    [ "${RULEROW[$r]:-0}" = 1 ] && continue
    v=${LEN[$r,$c]:-0}
    [ "$v" -gt ${W[$c]} ] && W[$c]=$v
  done
done
[ "$cfg_align" = "true" ] || for ((c=0; c<ncols; c++)); do W[$c]=0; done

# Cells are joined by a single space. Anything more — a bar, a dot, a slash —
# is a text cell placed in the row, so it can be coloured and moved like the
# rest of them.
SEP=' '
SEPW=1

wide=0
for ((r=0; r<nrows; r++)); do
  [ "${LAST[$r]}" -ge 0 ] || continue
  [ "${RULEROW[$r]:-0}" = 1 ] && continue
  row_w=0
  for ((c=0; c<=${LAST[$r]}; c++)); do
    cw=${W[$c]}; [ "${LEN[$r,$c]:-0}" -gt $cw ] && cw=${LEN[$r,$c]}
    row_w=$(( row_w + cw ))
    [ $c -gt 0 ] && row_w=$(( row_w + SEPW ))
  done
  [ $row_w -gt $wide ] && wide=$row_w
done
RCH=$(ico '─' '-')

first=1
for ((r=0; r<nrows; r++)); do
  [ "${LAST[$r]}" -ge 0 ] || continue
  [ $first = 1 ] || printf '\n'
  first=0

  if [ "${RULEROW[$r]:-0}" = 1 ]; then
    rw=$wide
    # `tput cols` cannot work here: Claude Code captures stdout rather than
    # attaching a tty. It exports COLUMNS/LINES instead (v2.1.153+).
    if [ "${RULEFIT[$r]:-0}" = 1 ] && [ -n "${COLUMNS:-}" ] && [ "${COLUMNS:-0}" -gt 0 ] 2>/dev/null; then
      rw=$(( COLUMNS - 2 ))
    fi
    [ "$rw" -lt 1 ] && rw=1
    line=""
    for ((i=0; i<rw; i++)); do line+=$RCH; done
    printf '%s%s%s' "${FMT[$r,0]}" "$line" "$RST"
    continue
  fi

  for ((c=0; c<=${LAST[$r]}; c++)); do
    [ $c -gt 0 ] && printf '%s' "$SEP"
    t=${TXT[$r,$c]}
    tl=${LEN[$r,$c]:-0}
    [ -n "$t" ] && printf '%s%s%s' "${FMT[$r,$c]}" "$t" "$RST"
    if [ $c -lt "${LAST[$r]}" ] && [ ${W[$c]} -gt "$tl" ]; then
      printf '%*s' $(( W[$c] - tl )) ''
    fi
  done
done
