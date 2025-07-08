-- ElizaOS PostgreSQL Database Initialization
-- Minimal setup - ElizaOS handles its own schema creation

-- Set default encoding and locale for optimal ElizaOS compatibility
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

-- Create extensions required for ElizaOS
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant all privileges to the eliza user on the default public schema
-- elizaOS will create its own schemas and tables as needed
GRANT ALL PRIVILEGES ON SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO eliza;

-- Allow eliza user to create new schemas (critical for ElizaOS)
ALTER USER eliza CREATEDB;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'ElizaOS database initialized - ready for ElizaOS schema creation';
    RAISE NOTICE 'Extensions enabled: vector, uuid-ossp, pgcrypto, pg_trgm';
    RAISE NOTICE 'ElizaOS will create its own schemas and tables on first run';
    RAISE NOTICE 'eliza user has CREATEDB privileges for schema creation';
END $$; 