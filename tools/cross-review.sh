#!/bin/bash
# Cross-model validation: runs Codex AND Claude Code review in parallel
# Usage: ./tools/cross-review.sh [file_or_pattern]
# Example: ./tools/cross-review.sh "pages/JobDetail/components/*.tsx"
#          ./tools/cross-review.sh  (reviews last commit)

set -e
cd "$(dirname "$0")/.."

TARGET="${1:-$(git diff --name-only HEAD~1 HEAD | tr '\n' ' ')}"

if [ -z "$TARGET" ]; then
  echo "No files to review. Pass a file/pattern or have a recent commit."
  exit 1
fi

echo "🔍 Cross-model review of: $TARGET"
echo "================================================"

# Run both in parallel
echo ""
echo "🤖 Starting Codex review (GPT-5.3)..."
codex exec "Review these files for bugs, security issues, race conditions, and edge cases: $TARGET. Use the ft-review skill. Output issues only, no praise." > /tmp/codex-review.md 2>&1 &
CODEX_PID=$!

echo "🧠 Starting Claude Code review (Opus 4.6)..."
claude -p "Review these files for bugs, security issues, race conditions, and edge cases: $TARGET. Focus on: TypeScript errors, Supabase patterns (.error before .data), stale closures, dark mode (no bg-white), and missing error handling. Output format: [SEVERITY] file:line — issue. Issues only." > /tmp/claude-review.md 2>&1 &
CLAUDE_PID=$!

echo "⏳ Both reviews running in parallel..."
echo ""

# Wait for both
wait $CODEX_PID 2>/dev/null
CODEX_EXIT=$?
wait $CLAUDE_PID 2>/dev/null  
CLAUDE_EXIT=$?

echo "================================================"
echo "📋 CODEX REVIEW (GPT-5.3):"
echo "================================================"
if [ $CODEX_EXIT -eq 0 ]; then
  cat /tmp/codex-review.md
else
  echo "⚠️ Codex review failed (exit $CODEX_EXIT)"
fi

echo ""
echo "================================================"
echo "📋 CLAUDE CODE REVIEW (Opus 4.6):"  
echo "================================================"
if [ $CLAUDE_EXIT -eq 0 ]; then
  cat /tmp/claude-review.md
else
  echo "⚠️ Claude Code review failed (exit $CLAUDE_EXIT)"
fi

echo ""
echo "================================================"
echo "✅ Cross-review complete. Compare both outputs above."
echo "Fix any issues found by EITHER model before committing."
