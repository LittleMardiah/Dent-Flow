import json

with open('postman/dentflow-api.postman_collection.json', 'r') as f:
    data = json.load(f)

# --- Tambahkan Admin Check-in request di folder Booking (Patient) ---
for item in data['item']:
    if item['name'] == 'Booking (Patient)':
        # Cari request Create Booking untuk ambil bookingCode
        create_booking = None
        for sub in item['item']:
            if sub['name'] == 'Create Booking':
                create_booking = sub
                break
        
        # Update test script Create Booking untuk simpan booking_code
        if create_booking:
            for ev in create_booking.get('event', []):
                if ev.get('listen') == 'test':
                    # Tambahkan penyimpanan booking_code ke environment
                    ev['script']['exec'].append("  pm.environment.set('bookingCode', jsonData.data.booking_code);")
                    break
        
        # Buat request Admin Check-in
        admin_checkin = {
            "name": "Admin Check-in",
            "request": {
                "method": "POST",
                "header": [
                    {"key": "Content-Type", "value": "application/json"},
                    {"key": "Authorization", "value": "Bearer {{adminToken}}"}
                ],
                "body": {
                    "mode": "raw",
                    "raw": "{\n  \"check_in_code\": \"{{bookingCode}}\",\n  \"branchId\": \"{{branchId}}\"\n}"
                },
                "url": {
                    "raw": "{{baseUrl}}/api/admin/check-in",
                    "host": ["{{baseUrl}}"],
                    "path": ["api", "admin", "check-in"]
                }
            },
            "response": [],
            "event": [
                {
                    "listen": "test",
                    "script": {
                        "exec": [
                            "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
                            "pm.test('Response has queue data', function () {",
                            "  var jsonData = pm.response.json();",
                            "  pm.expect(jsonData.success).to.be.true;",
                            "  // Admin check-in returns queue id (maybe data.id or data.queueId)",
                            "  if (jsonData.data.id) {",
                            "    pm.environment.set('queueId', jsonData.data.id);",
                            "  } else if (jsonData.data.queueId) {",
                            "    pm.environment.set('queueId', jsonData.data.queueId);",
                            "  } else {",
                            "    // fallback: use booking id?",
                            "    pm.environment.set('queueId', jsonData.data.bookingId);",
                            "  }",
                            "});"
                        ]
                    }
                }
            ]
        }
        # Masukkan setelah Cancel Booking (jika ada) atau di akhir
        cancel_index = -1
        for i, sub in enumerate(item['item']):
            if sub['name'] == 'Cancel Booking':
                cancel_index = i
                break
        if cancel_index != -1:
            item['item'].insert(cancel_index + 1, admin_checkin)
        else:
            item['item'].append(admin_checkin)
        break

# --- Perbaiki Doctor Check-in URL ---
for item in data['item']:
    if item['name'] == 'Queue':
        for sub in item.get('item', []):
            if sub['name'] == 'Check-in Patient (Doctor)':
                sub['request']['url']['raw'] = "{{baseUrl}}/api/queue/{{queueId}}/check-in"
                sub['request']['url']['path'] = ["api", "queue", "{{queueId}}", "check-in"]
                # Update test script (jika perlu)
                break

# Simpan collection
with open('postman/dentflow-api.postman_collection.json', 'w') as f:
    json.dump(data, f, indent=2)
print('✅ Collection updated')
