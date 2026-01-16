#!/bin/bash
# Wrapper script for qcash daemon to capture logs

LOG_DIR="/home/jayant/Desktop/Projects/qcash/logs"
LOG_FILE="$LOG_DIR/daemon_$(date +%Y%m%d_%H%M%S).log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Log start time
echo "=== QCASH Daemon Started at $(date) ===" >> "$LOG_FILE" 2>&1

# Run the daemon and redirect stderr to log file, keep stdout for native messaging
/home/jayant/Desktop/Projects/qcash/target/release/daemon 2>> "$LOG_FILE"

# Log end time
echo "=== QCASH Daemon Ended at $(date) ===" >> "$LOG_FILE" 2>&1
