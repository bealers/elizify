module.exports = {
  apps: [{
    name: 'elizaos',
    script: './scripts/elizaos-wrapper.sh',
    cwd: '/app',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      API_PORT: process.env.API_PORT || 3000,
      LOG_LEVEL: 'debug',
      HOST: '0.0.0.0',
      CHARACTER_FILE: process.env.CHARACTER_FILE || '/app/config/characters/server-bod.character.json'
    },
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000,
    listen_timeout: 8000,
    reload_delay: 1000
  }]
} 