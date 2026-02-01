# Business Source License 1.1 (BSL 1.1)
# Licensor: Bonsol Labs Inc.
# Licensed Work: QCash
# Change Date: 2030-12-31
# Change License: Apache License 2.0
# Use of this software is governed by the LICENSE file.

#!/bin/bash
# Wrapper script for qcash daemon

# [FIX] Manually set HOME so Risc0 can find ~/.risc0/cache
export HOME="/home/jayant"

# [FIX] Ensure PATH includes standard binaries (just in case)
export PATH="$HOME/.cargo/bin:$HOME/.risc0/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Ensure this path matches your actual project location
PROJECT_ROOT="/home/jayant/Desktop/bonsol/qcash" 

LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/daemon_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

echo "=== QCASH Daemon Started at $(date) ===" >> "$LOG_FILE" 2>&1
echo "User: $(whoami)" >> "$LOG_FILE" 2>&1
echo "Home: $HOME" >> "$LOG_FILE" 2>&1

# Run the daemon
"$PROJECT_ROOT/target/release/daemon" 2>> "$LOG_FILE"

echo "=== QCASH Daemon Ended at $(date) ===" >> "$LOG_FILE" 2>&1