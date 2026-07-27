#!/bin/bash

echo "=== DentFlow Queue Test ==="

# 1. Login as patient
echo "📝 Logging in as patient..."
RESPONSE=$(curl -s -X POST http://localhost:3000/auth/patient/login \
  -H "Content-Type: application/json" \
  -d '{"username":"budi_santoso","password":"Patient123!"}')
TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get patient token"
  exit 1
fi
echo "✅ Patient token obtained"

# 2. Login as admin
echo "📝 Logging in as admin..."
ADMIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_a","password":"Admin123!"}')
ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Failed to get admin token"
  exit 1
fi
echo "✅ Admin token obtained"

# 3. Reset queue
echo "🔄 Resetting queue..."
curl -s -X POST http://localhost:3000/api/queue/reset \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branch_id":"494a607c-d109-4330-a3a9-68f54326f0c7","doctor_id":"965dedad-11ba-46a3-a402-f88c2029c676"}' > /dev/null
echo "✅ Queue reset"

# 4. Get initial queue status
echo "📊 Getting queue status (patient)..."
curl -s -X GET "http://localhost:3000/api/queue/status?branch_id=494a607c-d109-4330-a3a9-68f54326f0c7&doctor_id=965dedad-11ba-46a3-a402-f88c2029c676" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || echo "❌ Could not parse JSON"

# 5. Simulate queue number generation using Redis directly
echo ""
echo "🔢 Simulating 5 check-ins (using Redis INCR)..."
for i in {1..5}; do
  QUEUE_NUM=$(redis-cli -h localhost -p 6380 INCR "queue:494a607c-d109-4330-a3a9-68f54326f0c7:965dedad-11ba-46a3-a402-f88c2029c676:20260722" 2>/dev/null)
  echo "  Check-in #$i → Queue number: $QUEUE_NUM"
done

# 6. Final queue status
echo ""
echo "📊 Final queue status:"
curl -s -X GET "http://localhost:3000/api/queue/status?branch_id=494a607c-d109-4330-a3a9-68f54326f0c7&doctor_id=965dedad-11ba-46a3-a402-f88c2029c676" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || echo "❌ Could not parse JSON"

echo ""
echo "✅ Test Complete"
