import json, re

with open('postman/dentflow-api.postman_collection.json', 'r') as f:
    data = json.load(f)

# 1. Tambahkan pre-request script di level collection
if 'event' not in data:
    data['event'] = []
prereq = None
for ev in data['event']:
    if ev.get('listen') == 'prerequest':
        prereq = ev
        break
if not prereq:
    prereq = {'listen': 'prerequest', 'script': {'exec': [], 'type': 'text/javascript'}}
    data['event'].append(prereq)

prereq['script']['exec'] = [
    "// Generate dynamic email (once per run)",
    "if (!pm.environment.get('dynamicEmail')) {",
    "  const timestamp = Date.now();",
    "  const random = Math.floor(Math.random() * 10000);",
    "  const email = 'test-' + timestamp + '-' + random + '@test.com';",
    "  pm.environment.set('dynamicEmail', email);",
    "  console.log('dynamicEmail set to:', email);",
    "}",
    "",
    "// Generate bookingDate (next Monday 09:00 WIB)",
    "const now = new Date();",
    "const day = now.getDay();",
    "const daysUntilMonday = (1 - day + 7) % 7 || 7;",
    "const monday = new Date(now);",
    "monday.setDate(now.getDate() + daysUntilMonday);",
    "monday.setHours(9, 0, 0, 0);",
    "const offset = 7 * 60;",
    "const local = new Date(monday.getTime() + offset * 60000);",
    "const iso = local.toISOString().slice(0, 16);",
    "const bookingDate = iso.replace('T', 'T') + ':00+07:00';",
    "pm.environment.set('bookingDate', bookingDate);",
    "console.log('bookingDate set to:', bookingDate);"
]

# 2. Update body Register & Login pakai {{dynamicEmail}}
for item in data['item']:
    if item.get('name') == 'Auth':
        for sub in item.get('item', []):
            if sub.get('name') in ['Register Patient', 'Login Patient']:
                raw = sub['request']['body']['raw']
                new_raw = re.sub(r'"email":\s*"[^"]*"', '"email": "{{dynamicEmail}}"', raw)
                sub['request']['body']['raw'] = new_raw

# 3. Update body Create Booking pakai {{bookingDate}}
for item in data['item']:
    if item.get('name') == 'Booking (Patient)':
        for sub in item.get('item', []):
            if sub.get('name') == 'Create Booking':
                raw = sub['request']['body']['raw']
                new_raw = raw.replace('2026-07-27T09:00:00+07:00', '{{bookingDate}}')
                sub['request']['body']['raw'] = new_raw

# 4. Perbaiki test script Create Booking (sudah benar)
for item in data['item']:
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
                            "});"
                        ]

# 5. Perbaiki URL Get Booking Detail
for item in data['item']:
    if item.get('name') == 'Booking (Patient)':
        for sub in item.get('item', []):
            if sub.get('name') == 'Get Booking Detail':
                sub['request']['url']['raw'] = "{{baseUrl}}/api/patient/bookings/{{bookingId}}"

with open('postman/dentflow-api.postman_collection.json', 'w') as f:
    json.dump(data, f, indent=2)
print('✅ Collection fully fixed with dynamic email + bookingDate + tests')
