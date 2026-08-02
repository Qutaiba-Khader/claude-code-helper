#!/bin/bash
# Claude Code status line — built with claude-code-helper
# https://qutaiba-khader.github.io/claude-code-helper/tools/statusline/
#
# Reads the Status-hook JSON on stdin and renders the layout described by CONFIG
# below as an aligned grid. Requires `jq`; the `branch` field also needs `git`.
#
# To change the layout, either re-run the builder or hand-edit the CONFIG line.

CONFIG='{"v":2,"rows":[[{"f":"cwd","c":"bold-blue"},{"f":"text","c":"grey","t":"|"},{"f":"branch","c":"bold-yellow"},{"f":"text","c":"grey","t":"|"},{"f":"model_ctx","c":"bold-cyan"}],[{"f":"bar_tokens","c":"ramp","b":"dim"},{"f":"text","c":"grey","t":"|"},{"f":"effort","c":"dim"}],[{"f":"rl5","c":"ramp","b":"dim"},{"f":"text","c":"grey","t":"|"},{"f":"rl7","c":"ramp","b":"dim"}],[{"f":"rule","c":"grey"}]]}'

# Bash counts ${#s} and ${s:i:1} in BYTES unless the locale is UTF-8, and Claude
# Code runs the status line with LANG empty — which silently makes every 3-byte
# glyph three columns wide and throws the padding and the rule out. Pick the
# first locale that measures a box-drawing character as one character.
if [ -z "${LC_ALL:-}" ]; then
  for _loc in "${LANG:-}" C.UTF-8 en_US.UTF-8 UTF-8; do
    [ -n "$_loc" ] || continue
    LC_ALL=$_loc
    _probe='─'
    [ ${#_probe} -eq 1 ] && break
    LC_ALL=''
  done
  [ -n "${LC_ALL:-}" ] && export LC_ALL
fi

# read stdin without forking cat; -d '' reads to EOF and returns 1 there
IFS= read -r -d '' input || :

# --- payload -> shell vars -------------------------------------------------
# \x1f (unit separator) keeps empty fields intact; a whitespace IFS would
# collapse runs of them and shift every value into the wrong variable.
# jq on Windows writes stdout in text mode, so its output arrives with CRs
# welded on. Stripping them is a builtin substitution and costs nothing.
_JQ=$(
  printf '%s\n%s' "$input" "$CONFIG" | jq -j -s '
    def s: if . == null then "" else tostring end;
    def b(d): if . == null then d else . end | tostring;
    .[0] as $p | .[1] as $c |
    ( [ ($p.workspace.current_dir // $p.cwd // ""),
        ($p.workspace.project_dir // ""),
        ($p.model.display_name // ""),
        ($p.model.id // ""),
        ($p.context_window.total_input_tokens | s),
        ($p.context_window.total_output_tokens | s),
        ($p.context_window.context_window_size | s),
        ($p.context_window.used_percentage | s),
        ($p.context_window.remaining_percentage | s),
        ($p.rate_limits.five_hour.used_percentage | s),
        ($p.rate_limits.five_hour.resets_at | s),
        ($p.rate_limits.seven_day.used_percentage | s),
        ($p.rate_limits.seven_day.resets_at | s),
        ($p.cost.total_cost_usd | s),
        ($p.effort.level | s),
        ($p.thinking.enabled | s),
        ($p.fast_mode | s),
        ($p.output_style.name | s),
        ($p.version | s),
        ($p.session_name | s),
        ($p.vim.mode | s),
        ($p.agent.name | s),
        ($p.workspace.repo.owner | s),
        ($p.workspace.repo.name | s),
        ($p.pr.number | s),
        ($p.pr.review_state | s),
        ($p.pr.url | s),
        ($p.worktree.name | s),
        ($p.worktree.branch | s),
        ($p.workspace.git_worktree | s),
        ($p.cost.total_duration_ms | s),
        ($p.cost.total_api_duration_ms | s),
        ($p.cost.total_lines_added | s),
        ($p.cost.total_lines_removed | s),
        ($p.exceeds_200k_tokens | s),
        ($p.context_window.current_usage.cache_read_input_tokens | s),
        ($p.context_window.current_usage.cache_creation_input_tokens | s),
        ($p.workspace.added_dirs // [] | length | s),
        ($p.session_id | s),
        ($c.align | b(true)), ($c.icons | b(true)), ($c.links | b(false)) ]
      + [ ( $c.rows // [] | to_entries | map(
              .key as $r | .value | to_entries | map(
                [ ($r|tostring), (.value.f // ""), (.value.c // ""), (.value.t // ""),
                  (if .value.i == false then "0" else "1" end),
                  (.value.r // ""), (.value.b // "") ] | join("\u001e")
              ) | join("\u001d")
            ) | join("\u001d") ) ]
    ) | join("\u001f")' 2>/dev/null
)
IFS=$'\037' read -r \
  p_cwd p_pdir p_model p_model_id p_in p_out p_ctx p_ctxpct p_ctxleft \
  p_rl5 p_rl5r p_rl7 p_rl7r p_cost p_effort p_think p_fast p_style \
  p_version p_session p_vim p_agent p_owner p_repo p_prnum p_prstate p_prurl \
  p_wt p_wtbranch p_gwt p_dur p_apidur p_added p_removed p_over200k \
  p_cread p_cwrite p_adddirs p_sid \
  cfg_align cfg_icons cfg_links _cells <<<"${_JQ//$'\r'/}"

[ -n "$p_cwd" ] || p_cwd="$PWD"

RST=$'\033[0m'

# name -> ANSI SGR
declare -A _COLCACHE
colour() {   # sets _R
  local key=$1
  if [ -n "${_COLCACHE[$key]+x}" ]; then _R=${_COLCACHE[$key]}; return; fi
  case "$key" in
    bold-*)  basecode "${key#bold-}"; _R=$'\033['"1;$_R"'m' ;;
    heat|ramp|default|"") _R='' ;;
    *)       basecode "$key"; [ -n "$_R" ] && _R=$'\033['"$_R"'m' ;;
  esac
  _COLCACHE[$key]=$_R
}
basecode() {   # sets _R
  _R=''
  case "$1" in
    black) _R=30 ;; red) _R=31 ;; green) _R=32 ;; yellow) _R=33 ;;
    blue) _R=34 ;; magenta|purple) _R=35 ;; cyan) _R=36 ;; white) _R=37 ;;
    grey|gray) _R='38;5;244' ;; dim) _R=2 ;;
    # cNNN is a 256-colour index — how orange and the smooth ramp shades are
    # written, since the basic eight have no orange
    c[0-9]*) _R="38;5;${1#c}" ;;
  esac
}
# ramp <comma-separated-colours> <percentage> — picks the band the value falls in.
# Ten bands: 0-9, 10-19, … 90-100. Fewer colours than bands is fine; the list
# is stretched to cover the range.
RAMP_DEFAULT='c46,c82,c118,c154,c190,c226,c220,c214,c208,c196'
ramp_colour() {   # sets _R
  local list=${1:-$RAMP_DEFAULT} pctv=${2%%.*} n band
  case "$pctv" in ''|*[!0-9]*) pctv=0 ;; esac
  [ "$pctv" -gt 100 ] && pctv=100
  _R=''
  IFS=',' read -r -a RC <<<"$list"
  n=${#RC[@]}
  [ "$n" -gt 0 ] || return
  band=$(( pctv * n / 100 ))
  [ "$band" -ge "$n" ] && band=$(( n - 1 ))
  colour "${RC[$band]}"
}

# green under 50%, yellow 50-79%, red 80%+
heat() {   # sets _R
  local p=${1%%.*}
  case "$p" in ''|*[!0-9]*) p=0 ;; esac
  if   [ "$p" -ge 80 ]; then _R=$'\033[31m'
  elif [ "$p" -ge 50 ]; then _R=$'\033[33m'
  else                       _R=$'\033[32m'; fi
}

# _R carries the result of the helpers below; none of them fork.
_R=''
ico() { if [ "$cfg_icons" = "true" ]; then _R=$1; else _R=$2; fi; }

tok() {  # 41500 -> 41k
  local n=${1:-0}
  case "$n" in ''|*[!0-9]*) n=0 ;; esac
  if [ "$n" -ge 1000 ]; then _R="$(( n / 1000 ))k"; else _R=$n; fi
}

# the value itself, marked so a ramp colours only this part of the cell
VS=$'\002'; VE=$'\003'
pct() { local n=${1%%.*}; case "$n" in ''|*[!0-9-]*) n=0 ;; esac; _R="$VS$n%$VE"; }
val() { _R="$VS$1$VE"; }

ctxsize() {  # 1000000 -> 1M, 200000 -> 200k
  local n=${1:-0}
  _R=''
  case "$n" in ''|*[!0-9]*) return ;; esac
  if   [ "$n" -ge 1000000 ] && [ $(( n % 1000000 )) -eq 0 ]; then _R="$(( n / 1000000 ))M"
  elif [ "$n" -ge 1000 ]; then _R="$(( n / 1000 ))k"
  else _R=$n; fi
}

# $EPOCHSECONDS avoids forking date on every countdown (bash 5+; falls back once)
NOW=${EPOCHSECONDS:-}
[ -n "$NOW" ] || printf -v NOW '%(%s)T' -1

countdown() {  # unix epoch seconds, or an ISO-8601 timestamp
  local raw=$1 epoch left
  _R=''
  [ -n "$raw" ] || return
  if [[ $raw =~ ^[0-9]+$ ]]; then epoch=$raw
  else epoch=$(date -d "$raw" +%s 2>/dev/null) || return; fi
  left=$(( epoch - NOW ))
  [ "$left" -gt 0 ] || return
  if   [ "$left" -ge 86400 ]; then _R="$(( left / 86400 ))d$(( left % 86400 / 3600 ))h"
  elif [ "$left" -ge 3600 ];  then printf -v _R '%dh%02dm' $(( left / 3600 )) $(( left % 3600 / 60 ))
  else                             _R="$(( left / 60 ))m"; fi
}

dur() {  # milliseconds -> 1h04m / 12m / 45s
  local ms=$1 sec
  _R=''
  case "$ms" in ''|*[!0-9]*) return ;; esac
  sec=$(( ms / 1000 ))
  if   [ "$sec" -ge 3600 ]; then printf -v _R '%dh%02dm' $(( sec / 3600 )) $(( sec % 3600 / 60 ))
  elif [ "$sec" -ge 60 ];   then _R="$(( sec / 60 ))m"
  else                           _R="${sec}s"; fi
}

# OSC 8 hyperlink, when links are enabled and the terminal supports them
link() {  # link <url> <text>
  if [ "$cfg_links" = "true" ] && [ -n "$1" ]; then
    printf '\033]8;;%s\033\\%s\033]8;;\033\\' "$1" "$2"
  else
    printf '%s' "$2"
  fi
}

# The percentage a bar is drawn from, worked out once.
CTXPCT=${p_ctxpct%%.*}
case "$CTXPCT" in ''|*[!0-9]*) CTXPCT=0 ;; esac
if [ "$CTXPCT" = 0 ] && [ "${p_ctx:-0}" -gt 0 ] 2>/dev/null; then
  CTXPCT=$(( p_in * 100 / p_ctx ))
fi
[ "$CTXPCT" -gt 100 ] && CTXPCT=100

# bar_of <filled> <empty> <width> -> _R
bar_of() {
  local fc=$1 ec=$2 w=$3 i filled out=""
  filled=$(( CTXPCT * w / 100 ))
  for ((i=0; i<w; i++)); do
    if [ $i -lt $filled ]; then out+=$fc; else out+=$ec; fi
  done
  _R=$out
}

# the whole level in one character -> _R
meter_of() {
  local i
  if [ "$cfg_icons" = "true" ]; then _SCALE=(▁ ▂ ▃ ▄ ▅ ▆ ▇ █)
  else _SCALE=(. : - = + '*' '#' '@'); fi
  i=$(( CTXPCT * ${#_SCALE[@]} / 100 ))
  [ "$i" -ge ${#_SCALE[@]} ] && i=$(( ${#_SCALE[@]} - 1 ))
  _R=${_SCALE[$i]}
}

# home directory as ~
tilde() {
  local d=$1
  case "$d" in
    "$HOME") _R='~' ;;
    "$HOME"/*) _R="~${d#"$HOME"}" ;;
    *) _R=$d ;;
  esac
}

# --- field renderers -------------------------------------------------------
# render <field-id> <custom-text> -> the cell's text (empty = cell omitted)
# render <field-id> <custom-text> <show-icon> -> _R
# Every helper writes to _R, so nothing here forks. `a` prefixes an affix, and
# is skipped when the cell has its built-in label turned off.
render() {
  local f=$1 txt=$2 showicon=${3:-1} out='' a='' br dirty n2 i2 filled2 bar2 cd
  _R=''
  case "$f" in
    text)      _R=$txt ;;
    user)      _R=${USER:-$LOGNAME} ; [ -n "$_R" ] || _R=$(id -un 2>/dev/null) ;;
    host)      _R=${HOSTNAME%%.*} ; [ -n "$_R" ] || _R=$(hostname -s 2>/dev/null) ;;
    userhost)
      local u=${USER:-$LOGNAME} h=${HOSTNAME%%.*}
      [ -n "$u" ] || u=$(id -un 2>/dev/null)
      [ -n "$h" ] || h=$(hostname -s 2>/dev/null)
      _R="$u@$h" ;;
    cwd)       tilde "$p_cwd" ;;
    cwd_base)  _R=${p_cwd##*/} ;;
    project)   [ -n "$p_pdir" ] && _R=${p_pdir##*/} ;;
    branch)
      ico '⎇' 'git:'; a=$_R; [ "$showicon" = 1 ] || a=''
      [ -n "$a" ] && a="$a "
      dirty=''
      if br=$(git --no-optional-locks -C "$p_cwd" rev-parse --abbrev-ref HEAD 2>/dev/null); then
        [ "$br" = HEAD ] && br=$(git --no-optional-locks -C "$p_cwd" rev-parse --short HEAD 2>/dev/null)
        # the dirty check walks the worktree — a few hundred ms on a big repo,
        # so a layout can turn it off with t:"nodirty"
        [ "$txt" = nodirty ] ||
          git --no-optional-locks -C "$p_cwd" diff --quiet --ignore-submodules HEAD 2>/dev/null || dirty='*'
        _R="$a$br$dirty"
      elif [ -n "$p_wtbranch" ]; then
        _R="$a$p_wtbranch"
      else _R=''; fi ;;
    repo)      [ -n "$p_repo" ] && _R="$p_owner/$p_repo" ;;
    pr)
      [ -n "$p_prnum" ] || return
      out="PR #$p_prnum${p_prstate:+ ($p_prstate)}"
      if [ "$cfg_links" = true ] && [ -n "$p_prurl" ]; then
        _R=$'\033]8;;'"$p_prurl"$'\033\\'"$out"$'\033]8;;\033\\'
      else _R=$out; fi ;;
    worktree)     [ -n "$p_wt" ]  && { ico '⑂' 'wt:'; a=$_R; [ "$showicon" = 1 ] && _R="$a $p_wt" || _R=$p_wt; } ;;
    git_worktree) [ -n "$p_gwt" ] && { ico '⑂' 'wt:'; a=$_R; [ "$showicon" = 1 ] && _R="$a $p_gwt" || _R=$p_gwt; } ;;
    added_dirs)   [ "${p_adddirs:-0}" -gt 0 ] 2>/dev/null && _R="+$p_adddirs dir" ;;
    model)     _R=$p_model ;;
    model_ctx)
      [ -n "$p_model" ] || return
      out=$p_model
      if [[ $p_model_id == *'[1m]'* || $p_model_id == *-1m* ]] && [[ $out != *1M* ]]; then
        out="$out 1M"
      elif [ "${p_ctx:-0}" -gt 0 ] 2>/dev/null; then
        ctxsize "$p_ctx"; out="$out $_R"
      fi
      _R=$out ;;
    ctx_size)  [ "${p_ctx:-0}" -gt 0 ] 2>/dev/null && { ctxsize "$p_ctx"; } ;;
    tokens)
      [ "${p_ctx:-0}" -gt 0 ] 2>/dev/null || return
      tok "$p_in"; out=$_R; tok "$p_ctx"
      _R="$out/$_R ($VS$(( p_in * 100 / p_ctx ))%$VE)" ;;
    tokens_plain)
      [ "${p_ctx:-0}" -gt 0 ] 2>/dev/null || return
      tok "$p_in"; out=$_R; tok "$p_ctx"
      _R="$VS$out$VE/$_R" ;;
    tokens_pct)
      [ -n "$p_ctxpct" ] || [ "${p_ctx:-0}" -gt 0 ] 2>/dev/null || return
      _R="$VS$CTXPCT%$VE" ;;
    ctx_pct)   [ -n "$p_ctxpct" ]  && { pct "$p_ctxpct"; [ "$showicon" = 1 ] && _R="ctx $_R"; } ;;
    ctx_left)  [ -n "$p_ctxleft" ] && { pct "$p_ctxleft"; [ "$showicon" = 1 ] && _R="$_R left"; } ;;
    ctx_bar)       [ -n "$p_ctxpct$p_ctx" ] && { ico '▰' '#'; a=$_R; ico '▱' '.'; bar_of "$a" "$_R" 10; val "$_R"; } ;;
    ctx_bar_slim)  [ -n "$p_ctxpct$p_ctx" ] && { ico '━' '='; a=$_R; ico '─' '-'; bar_of "$a" "$_R" 10; val "$_R"; } ;;
    ctx_bar_dots)  [ -n "$p_ctxpct$p_ctx" ] && { ico '●' 'o'; a=$_R; ico '○' '.'; bar_of "$a" "$_R" 10; val "$_R"; } ;;
    ctx_bar_shade) [ -n "$p_ctxpct$p_ctx" ] && { ico '█' '#'; a=$_R; ico '░' '.'; bar_of "$a" "$_R" 10; val "$_R"; } ;;
    ctx_bar_pipe)  [ -n "$p_ctxpct$p_ctx" ] && { ico '▮' '#'; a=$_R; ico '▯' '.'; bar_of "$a" "$_R" 10; val "$_R"; } ;;
    ctx_bar_mini)  [ -n "$p_ctxpct$p_ctx" ] && { ico '▰' '#'; a=$_R; ico '▱' '.'; bar_of "$a" "$_R" 5;  val "$_R"; } ;;
    ctx_bar_meter) [ -n "$p_ctxpct$p_ctx" ] && { meter_of; val "$_R"; } ;;
    bar_tokens)
      [ "${p_ctx:-0}" -gt 0 ] 2>/dev/null || return
      ico '▰' '#'; a=$_R; ico '▱' '.'; bar_of "$a" "$_R" 10; bar2=$_R
      tok "$p_in"; out=$_R; tok "$p_ctx"
      _R="$VS$bar2$VE $out/$_R ($VS$CTXPCT%$VE)" ;;
    out_tokens)
      [ "${p_out:-0}" -gt 0 ] 2>/dev/null || return
      ico '↑' 'out'; a=$_R; tok "$p_out"
      [ "$showicon" = 1 ] && _R="$a $_R" ;;
    cache_read)  [ "${p_cread:-0}" -gt 0 ] 2>/dev/null && { tok "$p_cread"; [ "$showicon" = 1 ] && _R="cache $_R"; } ;;
    cache_write) [ "${p_cwrite:-0}" -gt 0 ] 2>/dev/null && { tok "$p_cwrite"; [ "$showicon" = 1 ] && _R="cw $_R"; } ;;
    over200k)
      [ "$p_over200k" = true ] || return
      ico '⚠ ' '!'; [ "$showicon" = 1 ] && _R="${_R}200k+" || _R='200k+' ;;
    effort)    _R=$p_effort ;;
    thinking)  [ "$p_think" = false ] && _R='no-think' ;;
    fast)      [ "$p_fast" = true ] && ico '⚡' 'fast' ;;
    style)     [ -n "$p_style" ] && [ "$p_style" != default ] && _R=$p_style ;;
    vim)       _R=$p_vim ;;
    agent)     [ -n "$p_agent" ] && { [ "$showicon" = 1 ] && _R="@$p_agent" || _R=$p_agent; } ;;
    session)   _R=$p_session ;;
    version)   [ -n "$p_version" ] && { [ "$showicon" = 1 ] && _R="v$p_version" || _R=$p_version; } ;;
    session_id) [ -n "$p_sid" ] && _R=${p_sid:0:8} ;;
    rl5)
      [ -n "$p_rl5" ] || return
      pct "$p_rl5"; out=$_R
      [ "$showicon" = 1 ] && out="5h $out"
      countdown "$p_rl5r"; cd=$_R
      if [ -n "$cd" ]; then
        if [ "$showicon" = 1 ]; then ico '↻' 'in'; out="$out $_R $cd"; else out="$out $cd"; fi
      fi
      _R=$out ;;
    rl7)
      [ -n "$p_rl7" ] || return
      pct "$p_rl7"; out=$_R
      [ "$showicon" = 1 ] && out="7d $out"
      countdown "$p_rl7r"; cd=$_R
      if [ -n "$cd" ]; then
        if [ "$showicon" = 1 ]; then ico '↻' 'in'; out="$out $_R $cd"; else out="$out $cd"; fi
      fi
      _R=$out ;;
    rl5_bare) [ -n "$p_rl5" ] && { pct "$p_rl5"; [ "$showicon" = 1 ] && _R="5h $_R"; } ;;
    rl7_bare) [ -n "$p_rl7" ] && { pct "$p_rl7"; [ "$showicon" = 1 ] && _R="7d $_R"; } ;;
    cost)     [ -n "$p_cost" ] && printf -v _R '$%.2f' "$p_cost" 2>/dev/null ;;
    duration)     dur "$p_dur" ;;
    api_duration) dur "$p_apidur"; [ -n "$_R" ] && [ "$showicon" = 1 ] && _R="api $_R" ;;
    lines)
      [ -n "$p_added$p_removed" ] || return
      _R="+${p_added:-0}/-${p_removed:-0}" ;;
    lines_added)   [ -n "$p_added" ]   && _R="+$p_added" ;;
    lines_removed) [ -n "$p_removed" ] && _R="-$p_removed" ;;
    time)     printf -v _R '%(%H:%M)T' -1 ;;
    date)     printf -v _R '%(%Y-%m-%d)T' -1 ;;
  esac
}

# the percentage a "heat"-coloured field should be graded against
heatval() {   # sets _R
  _R=''
  case "$1" in
    rl5|rl5_bare) _R=$p_rl5 ;;
    rl7|rl7_bare) _R=$p_rl7 ;;
    ctx_pct|ctx_bar|tokens|tokens_plain|tokens_pct|bar_tokens|\
    ctx_bar_slim|ctx_bar_dots|ctx_bar_shade|ctx_bar_pipe|ctx_bar_mini|ctx_bar_meter)
      _R=$p_ctxpct ;;
    ctx_left) _R=$p_ctxleft ;;
  esac
}

# How many columns a character occupies. Emoji and CJK take two cells, and
# combining marks, variation selectors and joiners take none — counting them all
# as one is what makes a line with an emoji in it drift out of alignment.
charwidth() {   # sets _CW
  local cp=$1
  if   (( cp >= 0x0300 && cp <= 0x036F )) ||
       (( cp >= 0x200B && cp <= 0x200F )) ||
       (( cp >= 0x20D0 && cp <= 0x20FF )) ||
       (( cp >= 0xFE00 && cp <= 0xFE0F )); then _CW=0
  elif (( cp >= 0x1100 && cp <= 0x115F )) ||
       (( cp >= 0x2E80 && cp <= 0x303E )) ||
       (( cp >= 0x3041 && cp <= 0x33FF )) ||
       (( cp >= 0x3400 && cp <= 0x4DBF )) ||
       (( cp >= 0x4E00 && cp <= 0x9FFF )) ||
       (( cp >= 0xA000 && cp <= 0xA4CF )) ||
       (( cp >= 0xAC00 && cp <= 0xD7A3 )) ||
       (( cp >= 0xF900 && cp <= 0xFAFF )) ||
       (( cp >= 0xFE30 && cp <= 0xFE6F )) ||
       (( cp >= 0xFF00 && cp <= 0xFF60 )) ||
       (( cp >= 0xFFE0 && cp <= 0xFFE6 )) ||
       (( cp >= 0x1F300 && cp <= 0x1F64F )) ||
       (( cp >= 0x1F680 && cp <= 0x1F6FF )) ||
       (( cp >= 0x1F900 && cp <= 0x1F9FF )) ||
       (( cp >= 0x1FA70 && cp <= 0x1FAFF )); then _CW=2
  else _CW=1
  fi
}

# Width of a cell as the terminal sees it: escapes and the value markers take no
# columns, wide characters take two. Sets _LEN.
vislen() {
  local t=${1//[$'\002\003']/} out="" i ch cp w=0
  while [[ $t == *$'\033'* ]]; do
    out+=${t%%$'\033'*}
    t=${t#*$'\033'}
    case $t in
      '['*)    t=${t#*m} ;;
      ']8;;'*) t=${t#*$'\033\\'} ;;
      *)       t=${t:1} ;;
    esac
  done
  out+=$t
  # ASCII is the common case and needs no per-character work
  if [[ $out != *[![:ascii:]]* ]]; then
    _LEN=${#out}
    return
  fi
  for (( i=0; i<${#out}; i++ )); do
    ch=${out:i:1}
    printf -v cp '%d' "'$ch"
    charwidth "$cp"
    w=$(( w + _CW ))
  done
  _LEN=$w
}

# --- build the grid --------------------------------------------------------
# One line per cell: row \x1f field \x1f colour \x1f custom-text
IFS=$'\035' read -r -d '' -a CELLS <<<"$_cells" || true

declare -A TXT FMT LEN BASE
declare -a COUNT RULEROW RULEFIT
nrows=0; ncols=0
for line in "${CELLS[@]}"; do
  IFS=$'\036' read -r r f c t ci ramp b <<<"$line"
  [ -n "$f" ] || continue
  # cells are laid out in the order they appear, gaps closed up per row
  idx=${COUNT[$r]:-0}; COUNT[$r]=$(( idx + 1 ))
  if [ "$f" = "rule" ]; then
    RULEROW[$r]=1
    [ "$t" = "fit" ] && RULEFIT[$r]=1
    TXT[$r,$idx]=''
    LEN[$r,$idx]=0
    colour "${c:-grey}"; FMT[$r,$idx]=$_R
    [ $(( r + 1 )) -gt $nrows ] && nrows=$(( r + 1 ))
    continue
  fi
  render "$f" "$t" "$ci"; txt=$_R
  TXT[$r,$idx]=$txt
  vislen "$txt"; LEN[$r,$idx]=$_LEN
  if [ "$c" = "heat" ]; then
    heatval "$f"; heat "$_R"; FMT[$r,$idx]=$_R
    colour "${b:-default}"; BASE[$r,$idx]=$_R
  elif [ "$c" = "ramp" ]; then
    heatval "$f"; ramp_colour "$ramp" "$_R"; FMT[$r,$idx]=$_R
    colour "${b:-default}"; BASE[$r,$idx]=$_R
  else
    colour "$c"; FMT[$r,$idx]=$_R
    BASE[$r,$idx]=${FMT[$r,$idx]}
  fi
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

# emit <cell> honouring the value markers. $2 is the format for the value,
# $3 the format for everything around it.
emit() {
  local t=$1 vfmt=$2 base=$3 pre mid
  if [[ $t != *$'\002'* ]]; then
    printf '%s%s%s' "$vfmt" "$t" "$RST"
    return
  fi
  while [[ $t == *$'\002'* ]]; do
    pre=${t%%$'\002'*}
    t=${t#*$'\002'}
    mid=${t%%$'\003'*}
    t=${t#*$'\003'}
    [ -n "$pre" ] && printf '%s%s%s' "$base" "$pre" "$RST"
    printf '%s%s%s' "$vfmt" "$mid" "$RST"
  done
  [ -n "$t" ] && printf '%s%s%s' "$base" "$t" "$RST"
}

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
ico '─' '-'; RCH=$_R

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
    [ -n "$t" ] && emit "$t" "${FMT[$r,$c]}" "${BASE[$r,$c]}"
    if [ $c -lt "${LAST[$r]}" ] && [ ${W[$c]} -gt "$tl" ]; then
      printf '%*s' $(( W[$c] - tl )) ''
    fi
  done
done
