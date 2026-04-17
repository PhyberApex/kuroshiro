#!/bin/bash
set -eo pipefail

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

# Logging helper
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >&2
}

# jq filter to extract streaming text from assistant messages
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'

# jq filter to extract final result
final_result='select(.type == "result").result // empty'

log "Starting ralph session: $1 iterations"
START_TIME=$(date +%s)

for ((i=1; i<=$1; i++)); do
  ITER_START=$(date +%s)
  log "=== Iteration $i/$1 ==="
  log "Fetching context..."
  tmpfile=$(mktemp)
  trap "rm -f $tmpfile" EXIT

  issues=$(gh issue list --state open --json number,title,body,comments)
  NUM_ISSUES=$(echo "$issues" | jq 'length')
  prompt=$(cat ralph/prompt.md)

  log "Context: $NUM_ISSUES open issues"

 claude --permission-mode acceptEdits --dangerously-skip-permissions \
    --verbose \
    --print \
    --output-format stream-json \
    "$issues $prompt" \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_text"

  result=$(jq -r "$final_result" "$tmpfile")

  ITER_END=$(date +%s)
  ITER_DURATION=$((ITER_END - ITER_START))
  log "Iteration $i complete ($(($ITER_DURATION / 60))m $(($ITER_DURATION % 60))s)"

  if [[ "$result" == *"<promise>NO MORE TASKS</promise>"* ]]; then
    log "Ralph complete after $i iterations"

    # Check if all ready-for-agent tasks are done
    remaining_afk=$(gh issue list --label ready-for-agent --state open --json number --jq 'length')
    if [ "$remaining_afk" -eq 0 ]; then
      log "No more ready-for-agent issues. Checking for parent PRD..."

      # Find parent PRD by looking at recently closed issues
      recent_closed=$(gh issue list --state closed --limit 20 --json number,body)
      prd_number=$(echo "$recent_closed" | jq -r '.[].body // "" | match("## Parent PRD\\s*\\n+#([0-9]+)") | .captures[0].string' | head -n 1)

      if [ -n "$prd_number" ]; then
        log "Found parent PRD: #$prd_number. Generating completion report..."

        # Get all closed issues that reference this PRD
        completed_issues=$(echo "$recent_closed" | jq -r --arg prd "$prd_number" '.[] | select(.body | test("## Parent PRD\\s*\\n+#" + $prd)) | "- #\(.number) \(.title) ✓"' 2>/dev/null || echo "")

        # Get remaining open issues (HITL/QA)
        remaining_issues=$(gh issue list --state open --json number,title,labels --jq '.[] | select(.labels[].name | contains("ready-for-human")) | "- #\(.number) \(.title) (HITL)"')

        # Build comment
        comment="🤖 Ralph completed all automated tasks!

**Completed:**
$completed_issues

**Remaining (needs human):**
$remaining_issues

Ready for human review and remaining HITL tasks."

        # Post comment to PRD
        echo "$comment" | gh issue comment "$prd_number" --body-file -
        log "Posted completion report to PRD #$prd_number"
      else
        log "No parent PRD found in recent issues"
      fi
    fi

    END_TIME=$(date +%s)
    TOTAL_DURATION=$((END_TIME - START_TIME))
    log "Session complete: $((TOTAL_DURATION / 3600))h $(( (TOTAL_DURATION % 3600) / 60))m"
    exit 0
  fi
done

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))
log "Ralph used all $1 iterations. Exiting..."
log "Session complete: $((TOTAL_DURATION / 3600))h $(( (TOTAL_DURATION % 3600) / 60))m"