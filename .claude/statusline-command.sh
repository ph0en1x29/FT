#!/bin/bash

# Read input JSON from stdin
input=$(cat)

# Extract values
cwd=$(echo "$input" | jq -r '.workspace.current_dir')
model=$(echo "$input" | jq -r '.model.display_name')
output_style=$(echo "$input" | jq -r '.output_style.name')
remaining=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')
vim_mode=$(echo "$input" | jq -r '.vim.mode // empty')

# Get current directory basename
dir_name=$(basename "$cwd")

# Get git branch (skip optional locks for performance)
git_branch=""
if git -C "$cwd" rev-parse --git-dir > /dev/null 2>&1; then
    git_branch=$(git -C "$cwd" --no-optional-locks branch --show-current 2>/dev/null)
    if [ -n "$git_branch" ]; then
        # Check for uncommitted changes
        if ! git -C "$cwd" --no-optional-locks diff-index --quiet HEAD 2>/dev/null; then
            git_branch="${git_branch}*"
        fi
    fi
fi

# Shorten model name
model_short=$(echo "$model" | sed 's/Claude //' | sed 's/ Sonnet//')

# Build status line components
components=()

# Directory
components+=("$(printf '\033[36m%s\033[0m' "$dir_name")")

# Git branch
if [ -n "$git_branch" ]; then
    components+=("$(printf '\033[32m%s\033[0m' "$git_branch")")
fi

# Model
components+=("$(printf '\033[35m%s\033[0m' "$model_short")")

# Context remaining
if [ -n "$remaining" ]; then
    # Color based on remaining percentage
    if (( $(echo "$remaining < 20" | bc -l 2>/dev/null || echo 0) )); then
        color='\033[31m'  # Red for low
    elif (( $(echo "$remaining < 50" | bc -l 2>/dev/null || echo 0) )); then
        color='\033[33m'  # Yellow for medium
    else
        color='\033[32m'  # Green for plenty
    fi
    components+=("$(printf "${color}ctx:%.0f%%\033[0m" "$remaining")")
fi

# Output style (only if not default)
if [ -n "$output_style" ] && [ "$output_style" != "default" ]; then
    components+=("$(printf '\033[34m%s\033[0m' "$output_style")")
fi

# Vim mode
if [ -n "$vim_mode" ]; then
    if [ "$vim_mode" = "INSERT" ]; then
        components+=("$(printf '\033[33mINSERT\033[0m')")
    else
        components+=("$(printf '\033[32mNORMAL\033[0m')")
    fi
fi

# Join components with separator
separator=" $(printf '\033[90m|\033[0m') "
result=""
for i in "${!components[@]}"; do
    if [ $i -eq 0 ]; then
        result="${components[$i]}"
    else
        result="${result}${separator}${components[$i]}"
    fi
done

echo "$result"
