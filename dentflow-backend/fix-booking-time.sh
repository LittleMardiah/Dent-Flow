#!/bin/bash
set -e

echo "========================================="
echo " FIX: GUNAKAN sessionSlotId SEBAGAI timeStr"
echo "========================================="

# Backup service
cp src/services/booking.service.ts src/services/booking.service.ts.bak.time

# Ubah baris yang menghasilkan timeStr dari bookingDate menjadi dari sessionSlotId
# Cari const timeStr = bookingDate.toLocaleTimeString(...)
# Ganti dengan const timeStr = sessionSlotId (yang sudah diterima dari payload)

sed -i '/const timeStr = bookingDate.toLocaleTimeString/,/);/c\
        const timeStr = sessionSlotId; // Use sessionSlotId directly from payload' src/services/booking.service.ts

echo "✅ timeStr now uses sessionSlotId directly"

# Tampilkan perubahan
echo "--- Perubahan ---"
diff src/services/booking.service.ts.bak.time src/services/booking.service.ts || echo "Tidak ada perubahan."
echo "-----------------"

# Jalankan integration test
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
