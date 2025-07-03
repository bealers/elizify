#!/bin/bash
set -e

# ElizaOS Production Stop Script
# Gracefully stops PM2 managed ElizaOS process

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "ElizaOS Production Stop Script"
echo "Project Directory: $PROJECT_DIR"

# Function to check if we're in a container
is_container() {
    [ -f /.dockerenv ] || grep -q 'docker\|lxc' /proc/1/cgroup 2>/dev/null
}

# Container vs Host execution
if is_container; then
    echo "Running inside container"
    ELIZAOS_MODE="container"
else
    echo "Running on host system"
    ELIZAOS_MODE="host"
fi

# Check if PM2 is available
if ! command -v pm2 &> /dev/null; then
    echo "PM2 not found. Cannot stop ElizaOS."
    exit 1
fi

# Check current status
echo "Checking ElizaOS status..."

if ! pm2 list | grep -q "elizaos"; then
    echo "ℹ️  ElizaOS is not managed by PM2 or not running"
    echo "📊 Current PM2 processes:"
    pm2 list
    exit 0
fi

# Show current status
echo "Current ElizaOS status:"
pm2 list | grep -E "(App name|elizaos)" || pm2 list

# Check if ElizaOS is running
if pm2 list | grep -q "elizaos.*online"; then
    echo "ElizaOS is currently running"
    
    # Option to view logs before stopping
    read -p "Do you want to view recent logs before stopping? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Recent logs (last 20 lines):"
        pm2 logs elizaos --lines 20 --nostream
        echo ""
    fi
    
    # Confirm stop
    read -p "Are you sure you want to stop ElizaOS? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "ElizaOS continues running"
        exit 0
    fi
    
    echo "Stopping ElizaOS gracefully..."
    
    # Graceful stop with timeout
    if pm2 stop elizaos; then
        echo "ElizaOS stopped successfully"
        
        # Option to delete from PM2 process list
        read -p "Do you want to remove ElizaOS from PM2 process list? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            pm2 delete elizaos
            echo "ElizaOS removed from PM2 process list"
        else
            echo "ℹ️  ElizaOS kept in PM2 process list (stopped state)"
            echo "   Use 'pm2 start elizaos' or './scripts/start-elizaos.sh' to restart"
        fi
    else
        echo "Failed to stop ElizaOS gracefully"
        echo "Attempting force stop..."
        
        if pm2 kill; then
            echo "PM2 daemon stopped (force stop)"
        else
            echo "Failed to force stop PM2 daemon"
            exit 1
        fi
    fi
    
elif pm2 list | grep -q "elizaos.*stopped"; then
    echo "ℹ️  ElizaOS is already stopped"
    
    read -p "Do you want to remove ElizaOS from PM2 process list? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pm2 delete elizaos
        echo "ElizaOS removed from PM2 process list"
    else
        echo "ℹ️  ElizaOS kept in PM2 process list (stopped state)"
    fi
    
else
    echo "❓ ElizaOS is in an unknown state"
    pm2 list
    
    read -p "Do you want to force remove ElizaOS from PM2? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pm2 delete elizaos 2>/dev/null || echo "ElizaOS not found in process list"
        echo "Cleanup completed"
    fi
fi

# Final status
echo ""
echo "Final PM2 status:"
pm2 list

echo ""
echo "ElizaOS stop script completed"
echo ""
echo "To restart ElizaOS:"
echo "   ./scripts/start-elizaos.sh"
echo "   # or"
echo "   pm2 start elizaos  # if kept in process list" 