# elizaOS Production Deployment

[![Version](https://img.shields.io/badge/version-v0.1.1-blue.svg)](https://github.com/bealers/elizify/releases)

Just Works™️ production-ready Docker deployment for [elizaOS](https://github.com/elizaOS/eliza) agents. Deploy anywhere Docker Compose is supported.

Tested on [Coolify](https://coolify.io/), guides for other platforms on their way.

**Project status:** Production ready! Web UI can now be cleanly disabled via `ELIZA_DISABLE_UI=true` environment variable (elizaOS 1.0.16+).

## Quick Start

1. **Fork this repo**
2. **Set your API keys** in environment variables
3. **Spin up containers** - Run `docker-compose up -d`

Your elizaOS agent is running at `http://localhost:3000` with chat interface and ready to accept API connections.

## What's Included

- **Non-root execution** - Runs as non-privileged user with sensible file permissions
- **PostgreSQL by default** - Internal database included, external database support with slim config.
- **PM2 process management** - Auto-restart on failure, 2GB memory limit, graceful shutdowns
- **Health monitoring** - API health endpoints, PM2 status monitoring, structured logging
- **Docker deployment** - Standard Docker Compose, works on any Docker based platform

---

## Platform Deployment

### Coolify (Tested)

**Deployment with SSL and domain management**

1. **New Project** → **Git Repository**
2. **Repository URL**: `https://github.com/yourusername/your-fork`
3. **Build Pack**: Docker Compose
4. **Compose File**: `docker-compose.yaml`
5. **Environment Variables**: Set your API keys
6. **Deploy**


**Optional: Disable Web UI**
Set `ELIZA_DISABLE_UI=true` in your environment variables to run API-only mode.


---

## Environment Configuration
### Database Options

**Internal PostgreSQL (Default)**
```bash
# Uses docker-compose.yaml - no configuration needed
```

**External PostgreSQL (Production)**
```bash
# Use docker-compose.slim.yaml
POSTGRES_URL=postgresql://user:password@host:5432/database
```

---

## Character Configuration

### Default Character
Includes a throw-away character (`server-bod.character.json`) for immediate deployment testing.

### Custom Characters
1. **Create your character** following the [elizaOS character schema](https://eliza.how/docs/core/characterfile)
2. **Place in** `config/characters/your-character.character.json`
3. **Set environment**: `CHARACTER_FILE=/app/config/characters/your-character.character.json`
4. **Restart deployment**

**Character Development**: See [elizaOS Documentation](https://eliza.how/docs/core/characterfile) for detailed character creation guides.

---

## Management & Monitoring

### Container Management

```bash
# Start/restart services
docker-compose up -d

# View logs in real-time
docker-compose logs -f eliza

# Stop services
docker-compose down
```

### Agent Monitoring

```bash
# Comprehensive status
docker exec <container> ./scripts/status-elizaos.sh

# Process monitoring
docker exec <container> pm2 monit

# View agent logs
docker exec <container> pm2 logs elizaos
```

### Multi-Agent Scaling

```bash
# Deploy multiple agents with different configurations
CHARACTER_FILE=/app/config/characters/discord-agent.character.json
DISCORD_API_TOKEN=your-token
docker-compose -p discord-agent up -d

CHARACTER_FILE=/app/config/characters/telegram-agent.character.json
TELEGRAM_BOT_TOKEN=your-token
docker-compose -p telegram-agent up -d
```

---

## Troubleshooting

### Quick Diagnostics

```bash
# Check all services
docker-compose ps

# View agent logs
docker-compose logs eliza

# Check agent process
docker exec <container> pm2 list

# Validate configuration
docker exec <container> ./scripts/status-elizaos.sh
```

### Monitoring

```bash
# Resource usage
docker stats <container>

# Process monitoring
docker exec <container> pm2 monit

# Database status
docker exec <container> pg_isready -h db -p 5432
```

---

## Contributing

Open to PRs and collaboration.

