-- ElizaOS PostgreSQL Database Initialization
-- Minimal setup - ElizaOS handles its own schema creation

-- Set default encoding and locale for optimal ElizaOS compatibility
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant all privileges to the eliza user on the default public schema
-- elizaOS will create its own schemas and tables as needed
GRANT ALL PRIVILEGES ON SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO eliza;

-- Allow eliza user to create new schemas
ALTER USER eliza CREATEDB;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'elizaOS database initialized - ready for elizaOS schema creation';
    RAISE NOTICE 'Extensions enabled: uuid-ossp, pgcrypto';
    RAISE NOTICE 'elizaOS will create its own schemas and tables on first run';
END $$; 