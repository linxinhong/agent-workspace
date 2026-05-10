#!/bin/bash
# Inline AI Edit endpoint tests
# Usage: ./tests/inline-edit.sh [BASE_URL]
BASE="${1:-http://localhost:3000}"
ARTIFACT_ID=""

pass=0
fail=0

assert_status() {
  local test_name="$1" expected="$2" actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    echo "  PASS: $test_name (status $actual)"
    pass=$((pass + 1))
  else
    echo "  FAIL: $test_name (expected $expected, got $actual)"
    fail=$((fail + 1))
  fi
}

assert_contains() {
  local test_name="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -q "$needle"; then
    echo "  PASS: $test_name"
    pass=$((pass + 1))
  else
    echo "  FAIL: $test_name (expected to contain '$needle')"
    fail=$((fail + 1))
  fi
}

assert_not_contains() {
  local test_name="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -q "$needle"; then
    echo "  FAIL: $test_name (should not contain '$needle')"
    fail=$((fail + 1))
  else
    echo "  PASS: $test_name"
    pass=$((pass + 1))
  fi
}

echo "Finding an existing artifact..."
ARTIFACT_ID=$(curl -s "$BASE/api/artifacts?limit=1" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null)
if [ -z "$ARTIFACT_ID" ]; then
  echo "SKIP: No artifacts found. Create one first."
  exit 0
fi
echo "Using artifact: $ARTIFACT_ID"
echo ""

# Test 1: Normal replacement
echo "Test 1: Normal replacement"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/artifacts/$ARTIFACT_ID/inline-edit" \
  -H 'Content-Type: application/json' \
  -d '{"selectedText":"hello world","instruction":"make it more formal"}')
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
assert_status "returns 200" 200 "$STATUS"
assert_contains "contains replacement key" "$BODY" "replacement"

# Test 2: Empty selectedText → 400
echo "Test 2: Empty selectedText"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/artifacts/$ARTIFACT_ID/inline-edit" \
  -H 'Content-Type: application/json' \
  -d '{"selectedText":"","instruction":"test"}')
STATUS=$(echo "$RESP" | tail -1)
assert_status "returns 400" 400 "$STATUS"

# Test 3: Empty instruction → 400
echo "Test 3: Empty instruction"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/artifacts/$ARTIFACT_ID/inline-edit" \
  -H 'Content-Type: application/json' \
  -d '{"selectedText":"hello","instruction":""}')
STATUS=$(echo "$RESP" | tail -1)
assert_status "returns 400" 400 "$STATUS"

# Test 4: Non-existent artifact → 404
echo "Test 4: Non-existent artifact"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/artifacts/nonexistent-id/inline-edit" \
  -H 'Content-Type: application/json' \
  -d '{"selectedText":"x","instruction":"y"}')
STATUS=$(echo "$RESP" | tail -1)
assert_status "returns 404" 404 "$STATUS"

# Test 5: HTML fragment not wrapped
echo "Test 5: HTML fragment not wrapped"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/artifacts/$ARTIFACT_ID/inline-edit" \
  -H 'Content-Type: application/json' \
  -d '{"selectedText":"<p>hello</p>","instruction":"make it bold"}')
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$STATUS" -eq 200 ]; then
  assert_not_contains "no <html> wrapper" "$BODY" "<html>"
  assert_not_contains "no <body> wrapper" "$BODY" "<body>"
else
  echo "  SKIP: endpoint returned $STATUS (API key may not be configured)"
fi

# Test 6: Markdown not wrapped in artifact tags
echo "Test 6: Markdown not wrapped in artifact tags"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/artifacts/$ARTIFACT_ID/inline-edit" \
  -H 'Content-Type: application/json' \
  -d '{"selectedText":"# Title","instruction":"add a subtitle"}')
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$STATUS" -eq 200 ]; then
  assert_not_contains "no <artifact> tag" "$BODY" "<artifact"
else
  echo "  SKIP: endpoint returned $STATUS"
fi

echo ""
echo "Results: $pass passed, $fail failed"
exit $fail
