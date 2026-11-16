#!/bin/bash
# apply b.txt, then show status and next N pending
S=/tmp/claude-0/-home-user-testgame/fdfd7214-ba27-557e-a3d2-82d60d020e16/scratchpad/recast
W=/home/user/testgame/.claude/worktrees/agent-a044b9651dc592a3c
cd $S && python3 rc.py done b.txt && python3 $W/tools/recast_apply.py $S/plan.json $S/progress.json $S/done_cur.json && python3 rc.py stat && python3 rc.py next ${1:-12}
