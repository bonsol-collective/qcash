# Business Source License 1.1 (BSL 1.1)
# Licensor: Bonsol Labs Inc.
# Licensed Work: QCash
# Change Date: 2030-12-31
# Change License: Apache License 2.0
# Use of this software is governed by the LICENSE file.

#!/bin/bash
# Test script for the daemon

echo "Testing daemon directly..."

# Function to send message in native messaging format
send_message() {
    local msg="$1"
    local len=${#msg}
    printf "$(printf '\\x%02x' $((len & 0xFF)) $((len >> 8 & 0xFF)) $((len >> 16 & 0xFF)) $((len >> 24 & 0xFF)))$msg"
}

# Clean start
rm -f wallet.json

# Test Init
echo "=== Testing Init ==="
echo '{"action":"Init"}' | send_message "$(cat)" | ./target/release/daemon | xxd -l 100

# Test Faucet
echo "=== Testing Faucet (amount: 1000) ==="
echo '{"action":"Faucet","payload":{"amount":1000}}' | send_message "$(cat)" | ./target/release/daemon | xxd -l 200

echo ""
echo "Check wallet.json:"
cat wallet.json | python3 -m json.tool | head -20
