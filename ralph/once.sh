#!/bin/bash

issues=$(gh issue list --state open --json number,title,body,comments)
prompt=$(cat ralph/prompt.md)

claude --permission-mode acceptEdits \
  "$issues $prompt"