#!/usr/bin/env bash
# claude-code-helper — status line installer.
#
#   curl -fsSL https://qutaiba-khader.github.io/claude-code-helper/tools/statusline/install.sh \
#     | bash -s -- <base64url-config>
#
# Writes ~/.claude/statusline-command.sh with the layout encoded in the argument
# and points "statusLine" at it in ~/.claude/settings.json, keeping every other
# setting intact. The previous script and settings file are backed up first.
set -euo pipefail

BASE="${CCH_BASE:-https://qutaiba-khader.github.io/claude-code-helper}"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SCRIPT="$CLAUDE_DIR/statusline-command.sh"
SETTINGS="$CLAUDE_DIR/settings.json"

die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m==>\033[0m %s\n' "$*"; }

[ $# -ge 1 ] || die "no config given. Copy the one-liner from $BASE/tools/statusline/"
CFG_B64=$1

for bin in curl jq; do
  command -v "$bin" >/dev/null 2>&1 || die "$bin is required but not installed"
done

# --- decode the config -----------------------------------------------------
# base64url -> base64, then pad. `base64 -d` is GNU/BSD-portable enough here.
b64=$(printf '%s' "$CFG_B64" | tr '_-' '/+')
case $(( ${#b64} % 4 )) in 2) b64="$b64==" ;; 3) b64="$b64=" ;; esac
CONFIG=$(printf '%s' "$b64" | base64 -d 2>/dev/null) || die "the config argument is not valid base64"
printf '%s' "$CONFIG" | jq -e . >/dev/null 2>&1 || die "the decoded config is not valid JSON"

# --- fetch the runtime -----------------------------------------------------
info "fetching statusline.sh"
TEMPLATE=$(curl -fsSL "$BASE/tools/statusline/statusline.sh") || die "could not download the runtime script"
printf '%s' "$TEMPLATE" | grep -q "^CONFIG='" || die "downloaded script has no CONFIG line — aborting"

# --- write the script ------------------------------------------------------
mkdir -p "$CLAUDE_DIR"
if [ -f "$SCRIPT" ]; then
  cp "$SCRIPT" "$SCRIPT.bak.$(date +%Y%m%d_%H%M%S)"
  info "backed up the previous script"
fi

# awk, not sed: the config contains slashes, pipes and brackets.
printf '%s\n' "$TEMPLATE" | CONFIG="$CONFIG" awk '
  !done && /^CONFIG=/ { print "CONFIG=\047" ENVIRON["CONFIG"] "\047"; done=1; next }
  { print }
' > "$SCRIPT"
chmod +x "$SCRIPT"
info "wrote $SCRIPT"

# --- patch settings.json ---------------------------------------------------
# Follow a symlink so we edit the real file, not replace the link.
if [ -L "$SETTINGS" ]; then
  SETTINGS=$(readlink -f "$SETTINGS")
  info "settings.json is a symlink -> $SETTINGS"
fi
[ -f "$SETTINGS" ] || printf '{}\n' > "$SETTINGS"
cp "$SETTINGS" "$SETTINGS.bak.$(date +%Y%m%d_%H%M%S)"

jq -e . "$SETTINGS" >/dev/null 2>&1 || die "$SETTINGS is not valid JSON — fix it first, nothing was changed"

# padding / refreshInterval / hideVimModeIndicator ride along in the config's
# `st` block. The script ignores them; they belong to settings.json.
PADDING=$(printf '%s' "$CONFIG" | jq -r '.st.padding // 0')
REFRESH=$(printf '%s' "$CONFIG" | jq -r '.st.refresh // 0')
HIDEVIM=$(printf '%s' "$CONFIG" | jq -r 'if .st.hideVim then "true" else "false" end')

tmp=$(mktemp)
jq --arg cmd "bash $SCRIPT" \
   --argjson padding "$PADDING" \
   --argjson refresh "$REFRESH" \
   --argjson hidevim "$HIDEVIM" '
     .statusLine = ({type: "command", command: $cmd}
       + (if $padding > 0 then {padding: $padding} else {} end)
       + (if $refresh > 0 then {refreshInterval: $refresh} else {} end)
       + (if $hidevim   then {hideVimModeIndicator: true} else {} end))
   ' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
info "updated $SETTINGS"

# --- show what it looks like ----------------------------------------------
printf '\n'
info "preview with sample data:"
printf '\n'
printf '%s' '{"cwd":"'"$PWD"'","version":"2.1.220","model":{"id":"claude-opus-5[1m]","display_name":"Opus 5"},"workspace":{"current_dir":"'"$PWD"'"},"context_window":{"total_input_tokens":41500,"total_output_tokens":1800,"context_window_size":1000000,"used_percentage":4.2,"remaining_percentage":95.8},"rate_limits":{"five_hour":{"used_percentage":11,"resets_at":'"$(( $(date +%s) + 13380 ))"'},"seven_day":{"used_percentage":46,"resets_at":'"$(( $(date +%s) + 187200 ))"'}},"cost":{"total_cost_usd":6.63},"effort":{"level":"high"},"thinking":{"enabled":true}}' \
  | bash "$SCRIPT" || true
printf '\n\n'
info "done — restart Claude Code to see it."
