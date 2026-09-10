#!/usr/bin/env bash
set -u
cd '/mnt/d/AI Engineer/DentFlow 1.0/dentflow-web' || exit 1
rm -f /tmp/web.log
(
  setsid bash -c 'npm run dev > /tmp/web.log 2>&1' < /dev/null &
)
sleep 3
if [ -f /tmp/web.log ]; then
  echo "web.log created OK"
  head -10 /tmp/web.log
else
  echo "web.log NOT created"
fi
ps -ef | grep -E 'next|node' | grep -v grep | head -5
exit 0