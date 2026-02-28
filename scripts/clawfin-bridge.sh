#!/usr/bin/env bash
# ClawFin Bridge Script for Convos Agent
# Replaces the `openclaw agent` calls with our own OpenRouter-powered ClawFin logic
#
# Usage: ./scripts/clawfin-bridge.sh <conversation-id>
# 
# The bridge pipes events from `convos agent serve` stdout into our Node.js
# negotiation engine, and sends replies back to agent serve via stdin.

set -euo pipefail

# Close inherited stdin so nothing leaks into agent serve
exec 0</dev/null

CONV_ID="${1:?Usage: $0 <conversation-id>}"
SESSION_ID="convos-${CONV_ID}"
MY_INBOX=""

# Prevent duplicate bridges for the same conversation (macOS-compatible mkdir lock)
LOCK_FILE="/tmp/convos-bridge-${CONV_ID}.lock"
if ! mkdir "$LOCK_FILE" 2>/dev/null; then
  echo "Bridge already running for $CONV_ID (lock: $LOCK_FILE)" >&2
  exit 1
fi
trap 'rm -rf "$LOCK_FILE"' EXIT


# Named pipes
FIFO_DIR=$(mktemp -d)
FIFO_IN="$FIFO_DIR/in"
FIFO_OUT="$FIFO_DIR/out"
mkfifo "$FIFO_IN" "$FIFO_OUT"
trap 'rm -rf "$FIFO_DIR" "$LOCK_FILE"' EXIT

# Start agent serve with named pipes
npx convos agent serve "$CONV_ID" \
  --profile-name "ClawBot" \
  --env production \
  < "$FIFO_IN" > "$FIFO_OUT" 2>/dev/null &
AGENT_PID=$!

# Persistent write FD
exec 3>"$FIFO_IN"

# Message queue
QUEUE_FILE="$FIFO_DIR/queue"
: > "$QUEUE_FILE"

queue_reply() {
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    if [[ "$line" == "{"* ]]; then
      echo "$line" | jq -c . >> "$QUEUE_FILE"
    else
      jq -nc --arg text "$line" '{"type":"send","text":$text}' >> "$QUEUE_FILE"
    fi
  done <<< "$1"
  send_next
}

send_next() {
  [[ ! -s "$QUEUE_FILE" ]] && return
  head -1 "$QUEUE_FILE" >&3
  tail -n +2 "$QUEUE_FILE" > "$QUEUE_FILE.tmp"
  mv "$QUEUE_FILE.tmp" "$QUEUE_FILE"
}

# ClawFin LLM handler — calls our Node.js negotiation engine
clawfin_respond() {
  local message="$1"
  local SCRIPT_DIR
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  
  # Call our ClawFin negotiation handler via Node.js
  node --import tsx/esm "$SCRIPT_DIR/convos-handler.ts" \
    --conv-id "$CONV_ID" \
    --message "$message" \
    2>/dev/null || echo "I'm processing your request..."
}

while IFS= read -r event; do
  evt=$(echo "$event" | jq -r '.event // empty')

  case "$evt" in
    ready)
      MY_INBOX=$(echo "$event" | jq -r '.inboxId')
      echo "Ready: $CONV_ID (inbox: $MY_INBOX)" >&2

      # Send intro message
      INTRO=$(clawfin_respond "__INIT__")
      queue_reply "$INTRO"
      ;;

    sent)
      send_next
      ;;

    message)
      type_id=$(echo "$event" | jq -r '.contentType.typeId // empty')
      [[ "$type_id" != "text" && "$type_id" != "reply" ]] && continue

      catchup=$(echo "$event" | jq -r '.catchup // false')
      [[ "$catchup" == "true" ]] && continue

      sender=$(echo "$event" | jq -r '.senderInboxId // empty')
      [[ "$sender" == "$MY_INBOX" ]] && continue

      sender_name=$(echo "$event" | jq -r '.senderProfile.name // "User"')
      msg_id=$(echo "$event" | jq -r '.id // empty')
      content=$(echo "$event" | jq -r '.content')

      echo "[$sender_name]: $content" >&2

      reply=$(clawfin_respond "$sender_name: $content")
      queue_reply "$reply"
      ;;

    member_joined)
      member_name=$(echo "$event" | jq -r '.profile.name // "someone"')
      queue_reply "Welcome $member_name to the ClawFin Deal Room! 🎯 I'm ClawBot — ask me to find the best deal on any product."
      ;;
  esac
done < "$FIFO_OUT"

wait "$AGENT_PID"
