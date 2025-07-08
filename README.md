# elizaOS Production Deployment Recipes

[![Version](https://img.shields.io/badge/version-v0.2.0-blue.svg)](https://github.com/bealers/elizify/releases)
[![Changelog](https://img.shields.io/badge/changelog-available-green.svg)](https://github.com/bealers/elizify/blob/main/CHANGELOG.md)

Just Works™️ production-ready Docker deployment for [elizaOS](https://github.com/elizaOS/eliza) agents. Deploy anywhere Docker Compose is supported.

## What's Included

- **Non-root execution** - Runs as non-privileged user with sensible file permissions
- **PostgreSQL by default** - Properly configured with relevant extensions 
- **BYO database** -  'slim' version also available
- **PM2 process management** - Auto-restart on failure, 2GB memory limit, graceful shutdowns
- **Health monitoring** - API health endpoints, PM2 status monitoring, structured logging
- **Docker deployment** - Standard Docker Compose

## Getting Started

```bash
# Clone the repository
git clone https://github.com/bealers/elizify.git
cd elizify

# Set up environment variables  
cp .env.example .env
# Edit .env with your API keys

# Install dependencies
bun install

# Start the Mattermost demo 
docker-compose -f docker-compose.mattermost.yaml up -d
```

Once Docker has loaded everything and config scripts have finished, you can visit:

- elizaOS chat UI `http://localhost:8070`
- Mattermost configured with our demo bot `http://localhost:8065`


## CLI Recipe Launcher (Work in progress)

For interactive deployment with various recipes, use the TUI:

```bash
# Make TUI executable
chmod +x elizify.ts

# Launch the TUI recipe launcher
bun run tui

# or
./elizify.ts
```

**Available Recipes:**
- **Mattermost** - Complete ElizaOS + Mattermost integration  (Working)
- **Slim** - ElizaOS only (bring your own database)
- **Standard** - ElizaOS + PostgreSQL with pgvector

## Production Deployment

Tested on [Coolify](https://coolify.io/)

1. **New Project** → **Git Repository**
2. **Repository URL**: `https://github.com/bealers/elizify`
3. **Build Pack**: Docker Compose
4. **Compose File**: `docker-compose[specifiy version].yaml`
5. **Environment Variables**: Set your API keys manually
6. **Deploy**

## Management & Monitoring

### Container Management

```bash
# Start/restart services
docker-compose up -d

# View ElizaOS logs
docker-compose -f docker-compose.mattermost.yaml logs -f elizaos

# View Mattermost logs  (if relevant)
docker-compose -f docker-compose.mattermost.yaml logs -f mattermost

# Stop all services
docker-compose -f docker-compose.mattermost.yaml down
```

### Agent Monitoring

```bash
# Check ElizaOS status
docker exec elizify-mattermost-elizaos ./scripts/status-elizaos.sh

# Monitor ElizaOS process
docker exec elizify-mattermost-elizaos pm2 monit

# View detailed logs
docker exec elizify-mattermost-elizaos pm2 logs
```

## Troubleshooting

### Quick Diagnostics

```bash
# Check all services status
docker-compose -f docker-compose.mattermost.yaml ps

# Check ElizaOS container logs
docker logs elizify-mattermost-elizaos --tail 50

# Check Mattermost container logs  
docker-compose -f docker-compose.mattermost.yaml logs mattermost

# Validate ElizaOS configuration
docker exec elizify-mattermost-elizaos ./scripts/status-elizaos.sh
```

### Database & Services

```bash
# Check PostgreSQL status
docker exec elizify-postgres-1 pg_isready -U mmuser

# Check Mattermost API
curl -f http://localhost:8065/api/v4/system/ping

# Check ElizaOS API
curl -f http://localhost:8070/health
```

### Container Resource Monitoring

```bash
# Resource usage for ElizaOS
docker stats elizify-mattermost-elizaos

# Resource usage for all services
docker-compose -f docker-compose.mattermost.yaml top
```

---

## Contributing

Open to PRs.