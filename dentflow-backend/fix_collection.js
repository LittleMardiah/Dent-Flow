const fs = require('fs');
const path = './postman/dentflow-api.postman_collection.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Tambahkan pre-request script di level collection (bukan di folder)
data.event = data.event || [];
data.event.push({
  "listen": "prerequest",
  "script": {
    "exec": [
      "const timestamp = Date.now();",
      "const random = Math.floor(Math.random() * 10000);",
      "pm.environment.set('dynamicEmail', 'test-' + timestamp + '-' + random + '@test.com');"
    ],
    "type": "text/javascript"
  }
});

// Ganti semua email di body dengan {{dynamicEmail}}
const bodyString = JSON.stringify(data);
const newBody = bodyString.replace(/"email":\s*"[^"]*"/g, '"email": "{{dynamicEmail}}"');
fs.writeFileSync(path, newBody, 'utf8');
console.log('✅ Collection updated with dynamic email');
