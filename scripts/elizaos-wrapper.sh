#!/bin/bash
set -e

# ElizaOS Direct Execution Wrapper for PM2
# This script is managed by PM2 but runs ElizaOS directly
# to preserve the execution environment that works

echo "ElizaOS Wrapper: Starting direct execution..."

# Set default environment
export NODE_ENV=${NODE_ENV:-development}
export API_PORT=${API_PORT:-3000}
export LOG_LEVEL=${LOG_LEVEL:-debug}
export HOST=${HOST:-0.0.0.0}

# Character file with fallback logic
CHARACTER_FILE=${CHARACTER_FILE:-/app/config/characters/elliot.character.json}

echo "ElizaOS Wrapper: Environment configured"
echo "  NODE_ENV: $NODE_ENV"
echo "  API_PORT: $API_PORT"
echo "  LOG_LEVEL: $LOG_LEVEL"
echo "  CHARACTER_FILE: $CHARACTER_FILE"

# Debug character directory and file availability
echo "ElizaOS Wrapper: Checking character file availability..."
echo "  Character directory contents:"
ls -la /app/config/characters/ || echo "  ERROR: Character directory not found!"

# Check if specified character file exists, try fallbacks
if [ -f "$CHARACTER_FILE" ]; then
    echo "  ✅ Found character file: $CHARACTER_FILE"
elif [ -f "/app/config/characters/server-bod.character.json" ]; then
    echo "  ⚠️  Fallback: Using server-bod.character.json"
    CHARACTER_FILE="/app/config/characters/server-bod.character.json"
elif [ -f "/app/config/characters/elliot.character.json" ]; then
    echo "  ⚠️  Fallback: Using elliot.character.json"
    CHARACTER_FILE="/app/config/characters/elliot.character.json"
else
    echo "  ❌ ERROR: No character files found in /app/config/characters/"
    echo "  Available files:"
    find /app/config -name "*.json" 2>/dev/null || echo "  No JSON files found"
    exit 1
fi

echo "ElizaOS Wrapper: Using character file: $CHARACTER_FILE"

# Execute ElizaOS directly - no PM2 interference
exec ./node_modules/.bin/elizaos start --port $API_PORT --character "$CHARACTER_FILE" 