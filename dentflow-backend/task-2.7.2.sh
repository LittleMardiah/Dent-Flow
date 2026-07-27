#!/bin/bash
set -e

echo "========================================="
echo " TASK 2.7.2 - JEST COVERAGE REPORT"
echo "========================================="

# STEP 1: Cek Jest
echo "[1/6] Cek Jest..."
if ! npx jest --version > /dev/null 2>&1; then
  echo "❌ Jest belum terinstall. Jalankan: npm install --save-dev jest @types/jest ts-jest"
  exit 1
fi
echo "✅ Jest terinstall"

# STEP 2: Jalankan coverage (hanya src/)
echo ""
echo "[2/6] Menjalankan Jest coverage (hanya src/**/*.ts)..."
npm run test -- --coverage --collectCoverageFrom="src/**/*.ts" --coverageReporters=text-summary --silent || {
  echo "❌ Coverage gagal. Cek error di atas."
  exit 1
}
echo "✅ Coverage selesai"

# STEP 3: Cek folder coverage
echo ""
echo "[3/6] Cek folder coverage..."
if [ -d "coverage" ]; then
  echo "✅ Folder coverage/ terbuat"
  ls -la coverage/ | head -10
else
  echo "❌ Folder coverage/ TIDAK ADA."
  exit 1
fi

# STEP 4: Ambil angka coverage
echo ""
echo "[4/6] Coverage Summary:"
COVERAGE_OUTPUT=$(npx jest --coverage --collectCoverageFrom="src/**/*.ts" --coverageReporters=text-summary --silent 2>/dev/null)

echo "$COVERAGE_OUTPUT"

# Ekstrak angka untuk TESTING.md
STATEMENTS=$(echo "$COVERAGE_OUTPUT" | grep -oP 'Statements\s+\K\d+\.\d+' | head -1 || echo "N/A")
BRANCHES=$(echo "$COVERAGE_OUTPUT" | grep -oP 'Branches\s+\K\d+\.\d+' | head -1 || echo "N/A")
FUNCTIONS=$(echo "$COVERAGE_OUTPUT" | grep -oP 'Functions\s+\K\d+\.\d+' | head -1 || echo "N/A")
LINES=$(echo "$COVERAGE_OUTPUT" | grep -oP 'Lines\s+\K\d+\.\d+' | head -1 || echo "N/A")

# STEP 5: Buat TESTING.md
echo ""
echo "[5/6] Membuat TESTING.md..."
cat > TESTING.md << INNER_EOF
# Testing Documentation - DentFlow

## Coverage Report

**Generated:** $(date)

### Summary

| Metric | Target | Actual |
|--------|--------|--------|
| Statements | ≥70% | ${STATEMENTS}% |
| Branches | ≥65% | ${BRANCHES}% |
| Functions | ≥70% | ${FUNCTIONS}% |
| Lines | ≥70% | ${LINES}% |

### How to Run Tests

\`\`\`bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report (full)
npm run test:coverage

# Coverage report (only src/)
npm run test -- --coverage --collectCoverageFrom="src/**/*.ts"

# Integration tests
npm run test:integration

# API contract tests (Postman/Newman)
npm run test:postman
\`\`\`

### Coverage Gap Analysis

1. Buka \`coverage/index.html\` di browser.
2. Cari file dengan coverage rendah (warna merah/kuning).
3. Tambahkan test untuk file tersebut, atau gunakan \`/* istanbul ignore next */\` untuk kode yang memang tidak perlu di-test (misal config, index.ts, error handler).

**Last Updated:** $(date)
INNER_EOF

echo "✅ TESTING.md berhasil dibuat"

# STEP 6: Analisis coverage
echo ""
echo "[6/6] Analisis Coverage..."
echo "📊 Target: Statements ≥70%, Branches ≥65%, Functions ≥70%, Lines ≥70%"
echo ""

# Cek Statements
if [[ "$STATEMENTS" != "N/A" ]]; then
  if (( $(echo "$STATEMENTS >= 70" | bc -l) )); then
    echo "✅ Statements: $STATEMENTS% (≥70%)"
  else
    echo "❌ Statements: $STATEMENTS% (<70%) → PERLU TAMBAH TEST"
  fi
else
  echo "⚠️  Statements: N/A (gagal baca coverage)"
fi

# Cek Branches
if [[ "$BRANCHES" != "N/A" ]]; then
  if (( $(echo "$BRANCHES >= 65" | bc -l) )); then
    echo "✅ Branches: $BRANCHES% (≥65%)"
  else
    echo "❌ Branches: $BRANCHES% (<65%) → PERLU TAMBAH TEST"
  fi
else
  echo "⚠️  Branches: N/A (gagal baca coverage)"
fi

# Cek Functions
if [[ "$FUNCTIONS" != "N/A" ]]; then
  if (( $(echo "$FUNCTIONS >= 70" | bc -l) )); then
    echo "✅ Functions: $FUNCTIONS% (≥70%)"
  else
    echo "❌ Functions: $FUNCTIONS% (<70%) → PERLU TAMBAH TEST"
  fi
else
  echo "⚠️  Functions: N/A (gagal baca coverage)"
fi

# Cek Lines
if [[ "$LINES" != "N/A" ]]; then
  if (( $(echo "$LINES >= 70" | bc -l) )); then
    echo "✅ Lines: $LINES% (≥70%)"
  else
    echo "❌ Lines: $LINES% (<70%) → PERLU TAMBAH TEST"
  fi
else
  echo "⚠️  Lines: N/A (gagal baca coverage)"
fi

# STEP 7: Final output
echo ""
echo "========================================="
echo " ✅ TASK 2.7.2 - SELESAI"
echo "========================================="
echo "📁 Coverage report: coverage/index.html"
echo "📄 Documentation: TESTING.md"
echo ""
echo "🔍 NEXT STEP: Buka coverage/index.html di browser"
echo "   untuk lihat gap analysis detail per file."
echo ""
echo "📊 Jika coverage masih di bawah target, tambahkan test"
echo "   atau gunakan /* istanbul ignore next */ untuk"
echo "   file yang tidak perlu di-cover (config, index, dll)."
