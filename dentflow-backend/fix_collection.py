import json

with open('postman/dentflow-api.postman_collection.json', 'r') as f:
    data = json.load(f)

# Cari Create Booking dan update test script
for item in data.get('item', []):
    if item.get('name') == 'Booking (Patient)':
        for sub in item.get('item', []):
            if sub.get('name') == 'Create Booking':
                for ev in sub.get('event', []):
                    if ev.get('listen') == 'test':
                        ev['script']['exec'] = [
                            "pm.test('Status code is 201', function () { pm.response.to.have.status(201); });",
                            "pm.test('Response has booking data', function () {",
                            "  var jsonData = pm.response.json();",
                            "  pm.expect(jsonData.success).to.be.true;",
                            "  pm.expect(jsonData.data.id).to.be.a('string');",
                            "  pm.environment.set('bookingId', jsonData.data.id);",
                            "  pm.environment.set('bookingCode', jsonData.data.booking_code || jsonData.data.check_in_code || '');",
                            "});"
                        ]
                        break
                break

with open('postman/dentflow-api.postman_collection.json', 'w') as f:
    json.dump(data, f, indent=2)
print('✅ Collection fixed')
