#!/bin/bash
set -e

# ElizaOS Production Start Script
# Manages PM2 process lifecycle for ElizaOS

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "ElizaOS Production Start Script"
echo "Project Directory: $PROJECT_DIR"

# Function to check if we're in a container
is_container() {
    [ -f /.dockerenv ] || grep -q 'docker\|lxc' /proc/1/cgroup 2>/dev/null
}

# Container vs Host execution
if is_container; then
    echo "🐳 Running inside container"
    ELIZAOS_MODE="container"
else
    echo "🖥️  Running on host system"
    ELIZAOS_MODE="host"
fi

# Check if PM2 is available
if ! command -v pm2 &> /dev/null; then
    echo "PM2 not found. Please install PM2:"
    echo "   npm install -g pm2"
    exit 1
fi

# Check if ElizaOS CLI is available
if ! command -v elizaos &> /dev/null; then
    echo "ElizaOS CLI not found. Please install:"
    echo "   npm install -g @elizaos/cli@latest"
    exit 1
fi

# Validate environment
echo "🔍 Validating environment..."

# Check required environment variables
REQUIRED_VARS=("NODE_ENV")
OPTIONAL_VARS=("POSTGRES_URL" "OPENAI_API_KEY" "ANTHROPIC_API_KEY" "GEMINI_API_KEY")

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Required environment variable $var is not set"
        exit 1
    fi
done

echo "Required environment variables are set"

# Check for AI provider keys
AI_PROVIDER_SET=false
for var in "${OPTIONAL_VARS[@]:1}"; do  # Skip POSTGRES_URL
    if [ -n "${!var}" ]; then
        AI_PROVIDER_SET=true
        echo "AI Provider configured: $var"
        break
    fi
done

if [ "$AI_PROVIDER_SET" = false ]; then
    echo "⚠️  Warning: No AI provider API key detected"
    echo "   Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY"
fi

# Database check
if [ -z "$POSTGRES_URL" ]; then
    echo "⚠️  Warning: POSTGRES_URL not set, ElizaOS will use SQLite"
else
    echo "External database configured"
fi

# Ensure log directory exists
mkdir -p "$PROJECT_DIR/logs"
mkdir -p "$PROJECT_DIR/data"

# Validate character files if they exist
if [ -d "$PROJECT_DIR/characters" ] && [ "$(ls -A "$PROJECT_DIR/characters")" ]; then
    echo "📝 Validating character files..."
    
    for file in "$PROJECT_DIR/characters"/*.json; do
        if [ -f "$file" ]; then
            if ! node -p "JSON.parse(require('fs').readFileSync('$file', 'utf8'))" > /dev/null 2>&1; then
                echo "Invalid JSON in $(basename "$file")"
                exit 1
            fi
        fi
    done
    echo "All character files validated"
else
    echo "ℹ️  No custom character files found, using default configuration"
fi

# Check if ElizaOS is already running
if pm2 list | grep -q "elizaos.*online"; then
    echo "ℹ️  ElizaOS is already running"
    echo "📊 Current status:"
    pm2 list
    
    read -p "Do you want to restart ElizaOS? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "♻️  Restarting ElizaOS..."
        pm2 restart elizaos
    else
        echo "ElizaOS continues running"
        exit 0
    fi
else
    echo "🆕 Starting ElizaOS with PM2..."
    
    # Start with ecosystem config
    if [ -f "$PROJECT_DIR/config/ecosystem.config.js" ]; then
        cd "$PROJECT_DIR"
        pm2 start config/ecosystem.config.js
    else
        echo "config/ecosystem.config.js not found"
        exit 1
    fi
fi

# Wait a moment for startup
sleep 3

# Show status
echo "📊 ElizaOS Status:"
pm2 list

# Show recent logs
echo "Recent logs (last 10 lines):"
pm2 logs elizaos --lines 10 --nostream

echo "ElizaOS started successfully"
echo ""
echo "Management commands:"
echo "   pm2 list                    # Show process status"
echo "   pm2 logs elizaos           # View logs"
echo "   pm2 monit                  # Monitor resources"
echo "   pm2 restart elizaos        # Restart application"
echo "   pm2 stop elizaos           # Stop application"
echo ""
echo "🔍 Health check:"
echo "   node healthcheck.js" 