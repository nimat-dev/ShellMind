# Loop State

Live state for the maker-checker loop. Overwrite the "Current" block each round; append
finished features to History. A cold agent reads this to know which round it is on. The
active feature also lives in `../CURRENT_TASK.md`; keep them consistent.

## Parameters (current feature)
- Feature: <<FILL: first feature id, e.g. F001 — <name>>>
- REQUIRED_PASSES: 2
- MAX_ROUNDS: 6

## Current
- Round: 0
- consecutivePasses: 0
- Last Maker change: none (harness scaffolded)
- Last Checker verdict: none
- Standing defects: none
- Next action: write the sprint contract for the first feature

## History
```
(feature id | rounds used | final verdict | date)
--- none yet ---
```

## Escalations
```
(date | feature | reason | resolution)
--- none yet ---
```
