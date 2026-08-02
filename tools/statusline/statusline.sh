#!/bin/bash
# Claude Code status line — built with claude-code-helper
# https://qutaiba-khader.github.io/claude-code-helper/tools/statusline/
#
# Reads the Status-hook JSON on stdin and renders the layout described by CONFIG
# below as an aligned grid. Requires `jq`; the `branch` field also needs `git`.
#
# To change the layout, either re-run the builder or hand-edit the CONFIG line.

CONFIG='{"v":1,"sep":" | ","sepColor":"grey","rule":true,"align":true,"icons":true,"rows":[[{"f":"userhost","c":"bold-green"},{"f":"cwd","c":"bold-blue"},{"f":"branch","c":"bold-yellow"}],[{"f":"tokens","c":"bold-magenta"},{"f":"model_ctx","c":"bold-cyan"},{"f":"effort","c":"dim"}],[{"f":"rl5","c":"heat"},{"f":"rl7","c":"heat"}]]}'

input=$(cat)

# --- payload -> shell vars -------------------------------------------------
# \x1f (unit separator) keeps empty fields intact; a whitespace IFS would
# collapse runs of them and shift every value into the wrong variable.
IFS=$'\037' read -r \
  p_cwd p_pdir p_model p_model_id p_in p_out p_ctx p_ctxpct p_ctxleft \
  p_rl5 p_rl5r p_rl7 p_rl7r p_cost p_effort p_think p_fast p_style \
  p_version p_session p_vim p_agent p_owner p_repo p_prnum p_prstate \
  p_wt p_wtbranch <<<"$(
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
      (.worktree.name | s),
      (.worktree.branch | s)
    ] | join("\u001f")' 2>/dev/null
)"
[ -n "$p_cwd" ] || p_cwd="$PWD"

# --- config -> shell vars --------------------------------------------------
IFS=$'\037' read -r cfg_sep cfg_sepcol cfg_rule cfg_align cfg_icons <<<"$(
  printf '%s' "$CONFIG" | jq -j '
    def b(d): if . == null then d else . end | tostring;
    [ (.sep // " | "), (.sepColor // "grey"),
      (.rule | b(false)), (.align | b(true)),
      (.icons | b(true)) ] | join("\u001f")' 2>/dev/null
)"

RST=$'\033[0m'

# name -> ANSI SGR
colour() {
  case "$1" in
    bold-*)  printf '\033[1;%sm' "$(basecode "${1#bold-}")" ;;
    heat|default|"") : ;;
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
  local f=$1 txt=$2 v
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
        printf '%s %s%s' "$(ico '⎇' 'git:')" "$br" "$dirty"
      elif [ -n "$p_wtbranch" ]; then
        printf '%s %s' "$(ico '⎇' 'git:')" "$p_wtbranch"
      fi ;;
    repo)      [ -n "$p_repo" ] && printf '%s/%s' "$p_owner" "$p_repo" ;;
    pr)        [ -n "$p_prnum" ] && printf 'PR #%s%s' "$p_prnum" "${p_prstate:+ ($p_prstate)}" ;;
    worktree)  [ -n "$p_wt" ] && printf '%s %s' "$(ico '⑂' 'wt:')" "$p_wt" ;;
    model)     printf '%s' "$p_model" ;;
    model_ctx)
      [ -n "$p_model" ] || return
      v=$p_model
      if [[ $p_model_id == *'[1m]'* || $p_model_id == *-1m* ]] && [[ $v != *1M* ]]; then
        v="$v (1M context)"
      fi
      printf '[%s]' "$v" ;;
    tokens)
      [ "${p_ctx:-0}" -gt 0 ] 2>/dev/null || return
      printf '%s/%s (%d%%)' "$(tok "$p_in")" "$(tok "$p_ctx")" $(( p_in * 100 / p_ctx )) ;;
    tokens_plain)
      [ "${p_ctx:-0}" -gt 0 ] 2>/dev/null || return
      printf '%s/%s' "$(tok "$p_in")" "$(tok "$p_ctx")" ;;
    ctx_pct)   [ -n "$p_ctxpct" ]  && printf 'ctx %s' "$(pct "$p_ctxpct")" ;;
    ctx_left)  [ -n "$p_ctxleft" ] && printf '%s left' "$(pct "$p_ctxleft")" ;;
    ctx_bar)
      [ -n "$p_ctxpct" ] || return
      local n=${p_ctxpct%%.*} i filled bar=""
      filled=$(( n * 10 / 100 ))
      for ((i=0;i<10;i++)); do
        if [ $i -lt $filled ]; then bar+=$(ico '▰' '#'); else bar+=$(ico '▱' '.'); fi
      done
      printf '%s' "$bar" ;;
    out_tokens) [ "${p_out:-0}" -gt 0 ] 2>/dev/null && printf '%s %s' "$(ico '↑' 'out')" "$(tok "$p_out")" ;;
    effort)    printf '%s' "$p_effort" ;;
    thinking)  [ "$p_think" = "false" ] && printf 'no-think' ;;
    fast)      [ "$p_fast" = "true" ] && ico '⚡' 'fast' ;;
    style)     [ -n "$p_style" ] && [ "$p_style" != "default" ] && printf '%s' "$p_style" ;;
    vim)       [ -n "$p_vim" ] && printf '%s' "$p_vim" ;;
    agent)     [ -n "$p_agent" ] && printf '@%s' "$p_agent" ;;
    session)   printf '%s' "$p_session" ;;
    version)   [ -n "$p_version" ] && printf 'v%s' "$p_version" ;;
    rl5)
      [ -n "$p_rl5" ] || return
      v="5h $(pct "$p_rl5")"
      local cd; cd=$(countdown "$p_rl5r"); [ -n "$cd" ] && v="$v $(ico '↻' 'in') $cd"
      printf '%s' "$v" ;;
    rl7)
      [ -n "$p_rl7" ] || return
      v="7d $(pct "$p_rl7")"
      local cd; cd=$(countdown "$p_rl7r"); [ -n "$cd" ] && v="$v $(ico '↻' 'in') $cd"
      printf '%s' "$v" ;;
    rl5_bare) [ -n "$p_rl5" ] && printf '5h %s' "$(pct "$p_rl5")" ;;
    rl7_bare) [ -n "$p_rl7" ] && printf '7d %s' "$(pct "$p_rl7")" ;;
    cost)     [ -n "$p_cost" ] && printf '$%.2f' "$p_cost" 2>/dev/null ;;
    time)     date +%H:%M ;;
    date)     date +%Y-%m-%d ;;
  esac
}

# the percentage a "heat"-coloured field should be graded against
heatval() {
  case "$1" in
    rl5|rl5_bare) printf '%s' "$p_rl5" ;;
    rl7|rl7_bare) printf '%s' "$p_rl7" ;;
    ctx_pct|ctx_bar|tokens|tokens_plain) printf '%s' "$p_ctxpct" ;;
    ctx_left) printf '%s' "$p_ctxleft" ;;
  esac
}

# --- build the grid --------------------------------------------------------
# One line per cell: row \x1f field \x1f colour \x1f custom-text
mapfile -t CELLS < <(printf '%s' "$CONFIG" | jq -r '
  .rows // [] | to_entries[] as $r | $r.value | to_entries[] |
  [ ($r.key|tostring), (.value.f // ""), (.value.c // ""), (.value.t // "") ]
  | join("\u001f")' 2>/dev/null)

declare -A TXT FMT
declare -a COUNT
nrows=0; ncols=0
for line in "${CELLS[@]}"; do
  IFS=$'\037' read -r r f c t <<<"$line"
  [ -n "$f" ] || continue
  # cells are laid out in the order they appear, gaps closed up per row
  idx=${COUNT[$r]:-0}; COUNT[$r]=$(( idx + 1 ))
  txt=$(render "$f" "$t")
  TXT[$r,$idx]=$txt
  if [ "$c" = "heat" ]; then FMT[$r,$idx]=$(heat "$(heatval "$f")")
  else FMT[$r,$idx]=$(colour "$c"); fi
  [ $(( r + 1 )) -gt $nrows ] && nrows=$(( r + 1 ))
  [ $(( idx + 1 )) -gt $ncols ] && ncols=$(( idx + 1 ))
done

# rows whose cells are all empty are dropped; trailing empty cells are trimmed
declare -a LAST
for ((r=0; r<nrows; r++)); do
  LAST[$r]=-1
  for ((c=0; c<ncols; c++)); do [ -n "${TXT[$r,$c]}" ] && LAST[$r]=$c; done
done

# column widths, from the widest cell in each column
declare -a W
for ((c=0; c<ncols; c++)); do
  W[$c]=0
  for ((r=0; r<nrows; r++)); do
    [ "${LAST[$r]}" -ge 0 ] || continue
    v=${TXT[$r,$c]}
    [ ${#v} -gt ${W[$c]} ] && W[$c]=${#v}
  done
done
[ "$cfg_align" = "true" ] || for ((c=0; c<ncols; c++)); do W[$c]=0; done

SEPFMT=$(colour "$cfg_sepcol")
SEP="${SEPFMT}${cfg_sep}${RST}"

first=1
for ((r=0; r<nrows; r++)); do
  [ "${LAST[$r]}" -ge 0 ] || continue
  [ $first = 1 ] || printf '\n'
  first=0
  for ((c=0; c<=${LAST[$r]}; c++)); do
    [ $c -gt 0 ] && printf '%s' "$SEP"
    t=${TXT[$r,$c]}
    [ -n "$t" ] && printf '%s%s%s' "${FMT[$r,$c]}" "$t" "$RST"
    if [ $c -lt "${LAST[$r]}" ] && [ ${W[$c]} -gt ${#t} ]; then
      printf '%*s' $(( W[$c] - ${#t} )) ''
    fi
  done
done

# --- horizontal rule, sized to the grid (not the terminal) -----------------
if [ "$cfg_rule" = "true" ] && [ $first = 0 ]; then
  wide=0
  for ((r=0; r<nrows; r++)); do
    [ "${LAST[$r]}" -ge 0 ] || continue
    row_w=0
    for ((c=0; c<=${LAST[$r]}; c++)); do
      cw=${W[$c]}; [ ${#TXT[$r,$c]} -gt $cw ] && cw=${#TXT[$r,$c]}
      row_w=$(( row_w + cw ))
      [ $c -gt 0 ] && row_w=$(( row_w + ${#cfg_sep} ))
    done
    [ $row_w -gt $wide ] && wide=$row_w
  done
  ch=$(ico '─' '-')
  line=""
  for ((i=0; i<wide; i++)); do line+=$ch; done
  printf '\n%s%s%s' "$SEPFMT" "$line" "$RST"
fi
