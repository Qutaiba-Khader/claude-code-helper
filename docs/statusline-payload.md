# Status line payload reference

Claude Code runs your `statusLine` command on session events and pipes it a single JSON object on
stdin. This is the complete shape of that object, verified against the CLI binary (v2.1.220).

Most keys are **optional** — they appear only when the corresponding feature is active. Anything
your script reads has to tolerate the key being missing, or the status line will break in
sessions that happen not to have it.

```jsonc
{
  "session_id": "string",        // unique session id
  "session_name": "string",      // optional: set with /rename
  "prompt_id": "string",         // optional: uuid of the prompt being processed
  "transcript_path": "string",   // path to the conversation transcript
  "cwd": "string",               // current working directory

  "model": {
    "id": "string",              // e.g. "claude-opus-5[1m]"
    "display_name": "string"     // e.g. "Opus 5"
  },

  "workspace": {
    "current_dir": "string",     // current working directory
    "project_dir": "string",     // project root
    "added_dirs": ["string"],    // directories added with /add-dir
    "git_worktree": "string",    // optional: worktree name when cwd is in a linked worktree
    "repo": {                    // optional: identity from the origin remote
      "host":  "string",         // e.g. github.com
      "owner": "string",
      "name":  "string"
    }
  },

  "version": "string",           // Claude Code version, e.g. "2.1.220"
  "output_style": { "name": "string" },   // "default", "Explanatory", a custom style…

  "context_window": {
    "total_input_tokens":  0,    // tokens currently in the window (incl. cache reads/writes)
    "total_output_tokens": 0,    // output tokens from the most recent response
    "context_window_size": 0,    // e.g. 200000, or 1000000 on a 1M model
    "current_usage": {           // null until the first API call
      "input_tokens": 0,
      "output_tokens": 0,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 0
    },
    "used_percentage":      0,   // pre-calculated 0-100, null before the first message
    "remaining_percentage": 0    // pre-calculated 0-100, null before the first message
  },

  "effort":   { "level": "low|medium|high|xhigh|max" },  // only on models with reasoning effort
  "thinking": { "enabled": true },

  "rate_limits": {               // Claude subscription only, and only after the first response
    "five_hour": { "used_percentage": 0, "resets_at": 1785000000 },
    "seven_day": { "used_percentage": 0, "resets_at": 1785400000 }
  },

  "vim":   { "mode": "INSERT|NORMAL|VISUAL|VISUAL LINE" },  // only when vim mode is on
  "agent": { "name": "string", "type": "string" },          // only with --agent

  "pr": {                        // optional: open PR for the current branch
    "number": 0,
    "url": "string",
    "review_state": "approved|pending|changes_requested|draft"
  },

  "worktree": {                  // only in a --worktree session
    "name": "string",
    "path": "string",
    "branch": "string",
    "original_cwd": "string",
    "original_branch": "string"
  }
}
```

## Things that surprise people

**There is no branch in `workspace.repo`.** It carries host, owner and name only. To show a branch
you have to shell out to git — and use `--no-optional-locks` so a status line redraw never fights
a running git command for the index lock:

```bash
git --no-optional-locks -C "$dir" rev-parse --abbrev-ref HEAD
```

**`resets_at` is documented as epoch seconds but may arrive as ISO-8601.** Handle both:

```bash
if [[ $raw =~ ^[0-9]+$ ]]; then epoch=$raw; else epoch=$(date -d "$raw" +%s); fi
```

**`used_percentage` is null before the first message**, not `0`. `// 0` in jq covers it, but only
because jq's `//` treats `null` as empty.

**jq's `//` also treats `false` as empty.** `.thinking.enabled // true` returns `true` when
thinking is *off*. For booleans use an explicit null check:

```jq
def b(d): if . == null then d else . end;
```

**Multi-line output is supported.** The renderer splits your output on newlines and stacks the
lines in a column. A *single*-line status line is treated differently — dimmed, and truncated to
the terminal width. So a grid layout must emit at least two lines.

**Font size cannot be changed** from a status line. There is no ANSI escape for it; that is the
terminal emulator's font setting.

**Ambiguous-width glyphs break alignment.** `⎇`, `↻`, `▰`, `─` and friends are East-Asian
ambiguous width. Some terminals — Windows Terminal in particular — draw them two cells wide, so
character-count-based column padding drifts and glyphs appear to collide with the next character.
Either always put a space after them, or ship an ASCII fallback.

## Reading it in bash

Pull everything out in one `jq` call rather than one per field — the status line runs on every
event and a dozen `jq` processes is noticeable:

```bash
IFS=$'\037' read -r cwd model tokens <<<"$(
  printf '%s' "$input" | jq -j '
    def s: if . == null then "" else tostring end;
    [ (.workspace.current_dir // .cwd // ""),
      (.model.display_name // ""),
      (.context_window.total_input_tokens | s)
    ] | join("")'
)"
```

Use `\x1f` (unit separator), **not** a tab. `read` treats whitespace as `IFS` specially: runs of
it collapse, so a single empty field silently shifts every later value into the wrong variable.
