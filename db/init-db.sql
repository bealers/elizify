-- PostgreSQL initialization script for ElizaOS production
-- Exact copy of working mattermost pattern adapted for production

-- Set default encoding and locale for optimal compatibility
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

-- ElizaOS database should already exist (created by POSTGRES_DB env var)
-- Just ensure eliza has proper permissions
GRANT ALL PRIVILEGES ON SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO eliza;

-- Create extensions required for ElizaOS
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'ElizaOS production database initialized successfully';
    RAISE NOTICE 'ElizaOS database: eliza (for ElizaOS agent with extensions: vector, uuid-ossp, pgcrypto, pg_trgm)';
    RAISE NOTICE 'ElizaOS will create its own schemas and tables on first run';
END $$; 