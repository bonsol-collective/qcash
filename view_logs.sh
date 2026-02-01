# Business Source License 1.1 (BSL 1.1)
# Licensor: Bonsol Labs Inc.
# Licensed Work: QCash
# Change Date: 2030-12-31
# Change License: Apache License 2.0
# Use of this software is governed by the LICENSE file.

#!/bin/bash
# View daemon logs in real-time

LOG_DIR="/home/jayant/Desktop/Projects/qcash/logs"

echo "=== QCASH Daemon Log Viewer ==="
echo "Watching logs in: $LOG_DIR"
echo ""

# Get the most recent log file
LATEST_LOG=$(ls -t "$LOG_DIR"/daemon_*.log 2>/dev/null | head -1)

if [ -z "$LATEST_LOG" ]; then
    echo "No logs found yet. Waiting for daemon to start..."
    echo "Run a command from the extension to start logging."
    echo ""
    # Wait for new log file
    while [ -z "$LATEST_LOG" ]; do
        sleep 1
        LATEST_LOG=$(ls -t "$LOG_DIR"/daemon_*.log 2>/dev/null | head -1)
    done
fi

echo "Tailing: $LATEST_LOG"
echo "----------------------------------------"
tail -f "$LATEST_LOG"
