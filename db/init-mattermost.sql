-- PostgreSQL initialization script for ElizaOS Production - Mattermost Integration
-- Creates separate databases for Mattermost and ElizaOS with proper isolation
-- Includes vector extension support for ElizaOS embeddings

-- Set default encoding and locale for optimal compatibility
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

-- Create ElizaOS database
CREATE DATABASE elizaos OWNER mmuser;

-- Connect to ElizaOS database to set up extensions
\c elizaos;

-- Create extensions required for ElizaOS
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant all privileges to mmuser on the elizaos database
GRANT ALL PRIVILEGES ON SCHEMA public TO mmuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mmuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mmuser;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO mmuser;

-- Allow mmuser to create new schemas (critical for ElizaOS)
ALTER USER mmuser CREATEDB;

-- Connect back to mattermost database (default database for Mattermost)
\c mattermost;

-- Mattermost database should already exist (created by POSTGRES_DB env var)
-- Just ensure mmuser has proper permissions
GRANT ALL PRIVILEGES ON SCHEMA public TO mmuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mmuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mmuser;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO mmuser;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Production Mattermost database architecture initialized successfully';
    RAISE NOTICE 'Mattermost database: mattermost (for Mattermost application)';
    RAISE NOTICE 'ElizaOS database: elizaos (for ElizaOS agent with extensions: vector, uuid-ossp, pgcrypto, pg_trgm)';
    RAISE NOTICE 'ElizaOS will create its own schemas and tables on first run';
    RAISE NOTICE 'mmuser has CREATEDB privileges for schema creation';
END $$;
