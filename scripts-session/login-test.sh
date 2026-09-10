#!/usr/bin/env bash
set -u
echo '=== LOGIN TEST ==='
curl -s -m 15 -X POST http://localhost:3001/auth/patient/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"patient@test.com","password":"Patient123!"}'
echo
echo '=== HTTP STATUS ==='
curl -s -m 15 -o /dev/null -w 'HTTP %{http_code}\n' -X POST http://localhost:3001/auth/patient/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"patient@test.com","password":"Patient123!"}'
exit 0