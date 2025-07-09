#!/bin/bash
set -e

# elizaOS Direct Execution Wrapper for PM2
# This script is managed by PM2 but runs ElizaOS directly
# to preserve the execution environment that works

echo "elizaOS Wrapper: Starting direct execution..."

# Set default environment
export NODE_ENV=${NODE_ENV:-development}
export API_PORT=${API_PORT:-3000}
export LOG_LEVEL=${LOG_LEVEL:-debug}
export HOST=${HOST:-0.0.0.0}

# Character file
CHARACTER_FILE=${CHARACTER_FILE:-/app/config/characters/elliot.character.json}

echo "elizaOS Wrapper: Environment configured"
echo "  NODE_ENV: $NODE_ENV"
echo "  API_PORT: $API_PORT"
echo "  LOG_LEVEL: $LOG_LEVEL"
echo "  CHARACTER_FILE: $CHARACTER_FILE"

# Execute elizaOS directly - no PM2 interference
exec ./node_modules/.bin/elizaos start --port $API_PORT --character "$CHARACTER_FILE" 