#!/bin/bash
# Wrapper script for qcash daemon

PROJECT_ROOT="/home/jayant/Desktop/bonsol/qcash" 

LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/daemon_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

echo "=== QCASH Daemon Started at $(date) ===" >> "$LOG_FILE" 2>&1

"$PROJECT_ROOT/target/release/daemon" 2>> "$LOG_FILE"

echo "=== QCASH Daemon Ended at $(date) ===" >> "$LOG_FILE" 2>&1