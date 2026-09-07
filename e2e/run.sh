#!/bin/bash
# Run the on-device UI tests against a booted simulator.
#
#   ./e2e/run.sh                       # first booted simulator
#   ./e2e/run.sh <simulator-udid>      # a specific one
#   ./e2e/run.sh <udid> testE_orientationContract   # a single test
#
# Requires: the Goti dev build installed on the target simulator (npm run ios) and
# Metro running (npm start), because the debug build fetches its JS bundle at launch.
set -e
cd "$(dirname "$0")"

command -v xcodegen >/dev/null || { echo "xcodegen missing: brew install xcodegen"; exit 1; }

UDID="${1:-$(xcrun simctl list devices | grep '(Booted)' | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')}"
[ -n "$UDID" ] || { echo "No booted simulator. Boot one first."; exit 1; }

ONLY=""
[ -n "$2" ] && ONLY="-only-testing:GotiUITests/GotiUITests/$2"

curl -s -o /dev/null http://localhost:8081/status || echo "warning: Metro does not look reachable on :8081"

xcodegen generate --quiet
# xcodebuild refuses to overwrite an existing result bundle.
rm -rf ./result.xcresult
xcodebuild test \
  -project GotiUITests.xcodeproj \
  -scheme GotiUITests \
  -destination "platform=iOS Simulator,id=$UDID" \
  $ONLY \
  -resultBundlePath ./result.xcresult \
  2>&1 | grep -E "Test Case|XCTAssert|error:|TEST SUCCEEDED|TEST FAILED"

echo
echo "Screenshots: xcrun xcresulttool export attachments --path e2e/result.xcresult --output-path e2e/shots"
