# syntax=docker/dockerfile:1.4

# ElizaOS Production Deployment - Multi-Stage Optimized Build

# ============================================================================
# BUILD STAGE - Dependencies and preparation
# ============================================================================
FROM node:23-slim AS builder

# Install system dependencies needed for building
RUN apt-get update && \
    apt-get install -y \
        curl \
        python3 \
        build-essential \
        ca-certificates \
        unzip \
        gnupg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Bun for package management
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json bun.lock* ./

# Install dependencies (including dev dependencies for building)
RUN bun install

# Copy source code and configuration
COPY config/ ./config/
COPY scripts/ ./scripts/

# Make scripts executable
RUN chmod +x scripts/*.sh scripts/*.js

# ============================================================================
# PRODUCTION STAGE - Runtime optimized image
# ============================================================================
FROM node:23-slim AS production

# Install only runtime system dependencies
RUN apt-get update && \
    apt-get install -y \
        ffmpeg \
        ca-certificates \
        dumb-init \
        procps \
        curl \
        unzip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /var/cache/apt/*

# Install Bun for runtime (lighter installation)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Create app user for security
RUN groupadd -r eliza && \
    useradd -r -g eliza -s /bin/bash eliza && \
    mkdir -p /home/eliza/.pm2 /home/eliza/.npm && \
    chown -R eliza:eliza /home/eliza

WORKDIR /app

# Create application directories with proper permissions
RUN mkdir -p /app/config /app/data /app/logs /app/scripts && \
    chown -R eliza:eliza /app

# Copy production dependencies from builder stage
COPY --from=builder --chown=eliza:eliza /app/node_modules ./node_modules
COPY --from=builder --chown=eliza:eliza /app/package.json ./

# Copy application files from builder stage
COPY --from=builder --chown=eliza:eliza /app/config ./config
COPY --from=builder --chown=eliza:eliza /app/scripts ./scripts

# Switch to app user for security
USER eliza

# Expose ElizaOS ports
EXPOSE 3000
EXPOSE 50000-50100/udp

# Health check with comprehensive monitoring
HEALTHCHECK --interval=30s --timeout=15s --start-period=90s --retries=3 \
    CMD bun /app/scripts/healthcheck.js || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start ElizaOS using PM2 through our startup script
CMD ["./scripts/start.sh"]

# ============================================================================
# EXTERNAL HOSTING VARIANT - Separate stage for publishing
# ============================================================================
FROM production AS external

# Add labels for external hosting metadata
LABEL maintainer="ElizaOS Team"
LABEL description="Production-ready ElizaOS deployment container"
LABEL version="1.0.0"
LABEL org.opencontainers.image.title="ElizaOS Production"
LABEL org.opencontainers.image.description="Containerized ElizaOS AI agent platform"
LABEL org.opencontainers.image.vendor="ElizaOS"
LABEL org.opencontainers.image.licenses="MIT"

# Remove development artifacts and optimize for distribution
USER root
RUN apt-get autoremove -y && \
    apt-get autoclean && \
    rm -rf /tmp/* /var/tmp/* && \
    find /usr/share/doc -type f -delete && \
    find /usr/share/man -type f -delete

USER eliza

# Default environment for external hosting
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV HOST=0.0.0.0
ENV PORT=3000 