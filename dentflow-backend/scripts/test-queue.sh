#!/bin/bash
# Test queue endpoints with automatic token fetching

# 1. Login sebagai patient
echo "🔑 Logging in as patient..."
PATIENT_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/patient/login \
  -H "Content-Type: application/json" \
  -d '{"username":"budi_santoso","password":"Patient123!"}')
PATIENT_TOKEN=$(echo $PATIENT_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "✅ Patient token obtained: ${PATIENT_TOKEN:0:20}..."

# 2. Login sebagai admin
echo "🔑 Logging in as admin..."
ADMIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_a","password":"Admin123!"}')
ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "✅ Admin token obtained: ${ADMIN_TOKEN:0:20}..."

# 3. Reset queue
echo "🔄 Resetting queue..."
curl -s -X POST http://localhost:3000/api/queue/reset \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branch_id":"494a607c-d109-4330-a3a9-68f54326f0c7","doctor_id":"965dedad-11ba-46a3-a402-f88c2029c676"}' | jq .

# 4. Generate 5 queue numbers (simulate check-in)
echo "🔢 Generating 5 queue numbers..."
for i in {1..5}; do
  echo "Generating number $i..."
  # Simulate check-in by calling getNextQueueNumber via a direct Redis call
  # Since we don't have an endpoint, we'll use the redis-cli directly
  docker exec -it dentflow-cache redis-cli INCR "queue:494a607c-d109-4330-a3a9-68f54326f0c7:965dedad-11ba-46a3-a402-f88c2029c676:$(date +%Y%m%d)"
done

# 5. Get queue status
echo "📊 Getting queue status..."
curl -s -X GET "http://localhost:3000/api/queue/status?branch_id=494a607c-d109-4330-a3a9-68f54326f0c7&doctor_id=965dedad-11ba-46a3-a402-f88c2029c676" \
  -H "Authorization: Bearer $PATIENT_TOKEN" | jq .

echo "✅ Test complete!"
