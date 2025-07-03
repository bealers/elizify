#!/bin/bash
set -e

# ElizaOS Production Startup Script
# Handles PM2 process management

# Use local PM2 installation
PM2_BIN="./node_modules/.bin/pm2"

echo "Starting ElizaOS Production Server..."

# Check required environment variables
if [ -z "$POSTGRES_URL" ]; then
    echo "Warning: POSTGRES_URL not set, using default SQLite"
fi

# Set default values
export NODE_ENV=${NODE_ENV:-production}
export API_PORT=${API_PORT:-3000}
export LOG_LEVEL=${LOG_LEVEL:-info}
export HOST=${HOST:-0.0.0.0}

echo "Environment Configuration:"
echo "  NODE_ENV: $NODE_ENV"
echo "  API_PORT: $API_PORT"
echo "  HOST: $HOST"
echo "  LOG_LEVEL: $LOG_LEVEL"

# Check if ElizaOS CLI is available locally
echo "Checking ElizaOS CLI availability..."
if [ -f "./node_modules/.bin/elizaos" ]; then
    echo "ElizaOS CLI found locally"
    ./node_modules/.bin/elizaos --version || echo "Could not get version"
elif command -v elizaos >/dev/null 2>&1; then
    echo "ElizaOS CLI found in PATH"
    elizaos --version || echo "Could not get version"
elif npx @elizaos/cli@latest --version >/dev/null 2>&1; then
    echo "ElizaOS CLI available via npx"
    npx @elizaos/cli@latest --version
else
    echo "ElizaOS CLI not found - checking if npm install was run..."
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    else
        echo "Dependencies installed but ElizaOS CLI not found"
        exit 1
    fi
fi

# Ensure log directory exists
mkdir -p /app/logs

# Validate character files if they exist
if [ -d "/app/config/characters" ] && [ "$(ls -A /app/config/characters)" ]; then
    echo "Character files found:"
    ls -la /app/config/characters/
    
    # Validate JSON files
    for file in /app/config/characters/*.json; do
        if [ -f "$file" ]; then
            if ! node -p "JSON.parse(require('fs').readFileSync('$file', 'utf8'))" > /dev/null 2>&1; then
                echo "Invalid JSON in $file"
                exit 1
            fi
        fi
    done
    echo "All character files validated"
else
    echo "No character files found, using default configuration"
fi

# Dynamic plugin installation based on character files
echo "Checking for required plugins..."
REQUIRED_PLUGINS=""

if [ -d "/app/config/characters" ] && [ "$(ls -A /app/config/characters)" ]; then
    for file in /app/config/characters/*.json; do
        if [ -f "$file" ]; then
            # Extract plugins array from character file
            PLUGINS=$(node -p "
                try {
                    const char = JSON.parse(require('fs').readFileSync('$file', 'utf8'));
                    const plugins = char.plugins || [];
                    plugins.join(' ');
                } catch(e) {
                    '';
                }
            " 2>/dev/null || echo "")
            
            if [ -n "$PLUGINS" ]; then
                echo "Found plugins in $(basename "$file"): $PLUGINS"
                REQUIRED_PLUGINS="$REQUIRED_PLUGINS $PLUGINS"
            fi
        fi
    done
    
    # Remove duplicates and install missing plugins
    if [ -n "$REQUIRED_PLUGINS" ]; then
        UNIQUE_PLUGINS=$(echo $REQUIRED_PLUGINS | tr ' ' '\n' | sort -u | tr '\n' ' ')
        echo "Installing required plugins: $UNIQUE_PLUGINS"
        
        for plugin in $UNIQUE_PLUGINS; do
            if [ -n "$plugin" ]; then
                echo "Installing $plugin..."
                bun add "$plugin" || echo "Warning: Failed to install $plugin"
            fi
        done
        
        echo "Plugin installation completed"
    else
        echo "No plugins required"
    fi
else
    echo "No character files to scan for plugins"
fi

# Test database connection if available
if [ -n "$POSTGRES_URL" ]; then
    echo "Testing database connection..."
    # Simple connection test - this will be handled by ElizaOS itself
    echo "Database URL configured: ${POSTGRES_URL%%@*}@[REDACTED]"
fi

# Use our structured PM2 management
echo "Using structured PM2 management..."

# Stop any existing PM2 processes first
if $PM2_BIN list | grep -q "elizaos"; then
    echo "Stopping existing PM2 process..."
    $PM2_BIN stop elizaos || echo "Could not stop existing process"
    $PM2_BIN delete elizaos || echo "Could not delete existing process"
fi

# Clear old logs
echo "Clearing old logs..."
truncate -s 0 /app/logs/elizaos-*.log 2>/dev/null || echo "Could not clear logs"

echo "Starting new PM2 process..."
    $PM2_BIN start config/ecosystem.config.js

# Wait a moment for the process to initialize
sleep 5

# Show PM2 status
echo "PM2 Status:"
$PM2_BIN list

# Show initial logs
echo "Initial Logs:"
$PM2_BIN logs elizaos --lines 20 --nostream || echo "Could not display logs"

echo ""
echo "Management commands available:"
echo "   ./scripts/start-elizaos.sh    # Start/restart ElizaOS"
echo "   ./scripts/stop-elizaos.sh     # Stop ElizaOS gracefully"
echo "   ./scripts/status-elizaos.sh   # Show detailed status"
echo "   $PM2_BIN logs elizaos        # View logs"
echo "   $PM2_BIN monit               # Monitor resources"
echo ""

# Test if the service is responding
echo "Running initial health check in 10 seconds..."
sleep 10

if node /app/scripts/healthcheck.js; then
    echo "Health check passed - service is responding"
else
    echo "Health check failed - investigating..."
    echo "Recent logs:"
    $PM2_BIN logs elizaos --lines 50 --nostream || echo "Could not get logs"
    echo ""
    echo "PM2 Status:"
    $PM2_BIN list
    echo ""
    echo "Process details:"
    $PM2_BIN describe elizaos || echo "Could not get process details"
fi

# Keep the container running by following PM2 logs
echo "Following PM2 logs (Ctrl+C to stop)..."
exec $PM2_BIN logs elizaos --raw 