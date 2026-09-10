#!/usr/bin/env bash
set -u
cd '/mnt/d/AI Engineer/DentFlow 1.0/dentflow-backend' || exit 1
rm -f /tmp/backend.log
(
  setsid bash -c 'npm run dev > /tmp/backend.log 2>&1' < /dev/null &
)
sleep 3
if [ -f /tmp/backend.log ]; then
  echo "backend.log created OK"
  head -10 /tmp/backend.log
else
  echo "backend.log NOT created"
fi
ps -ef | grep -E 'ts-node|/node' | grep -v grep | head -5
exit 0