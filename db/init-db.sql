-- ElizaOS PostgreSQL Database Initialization
-- Minimal setup - ElizaOS handles its own schema creation

-- Set default encoding and locale for optimal ElizaOS compatibility
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

-- Create commonly used PostgreSQL extensions
-- ElizaOS may need these for UUID generation and cryptographic functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant all privileges to the eliza user on the default public schema
-- ElizaOS will create its own schemas and tables as needed
GRANT ALL PRIVILEGES ON SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO eliza;

-- Allow eliza user to create new schemas
ALTER USER eliza CREATEDB;

-- Optimize database settings for ElizaOS workload
ALTER DATABASE eliza SET max_connections = 100;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'ElizaOS database initialized - ready for ElizaOS schema creation';
    RAISE NOTICE 'Extensions enabled: uuid-ossp, pgcrypto';
    RAISE NOTICE 'ElizaOS will create its own schemas and tables on first run';
END $$;

-- Schema fix function to resolve ElizaOS type mismatch
-- This fixes the issue where server_agents.server_id (UUID) cannot reference message_servers.id (TEXT)
CREATE OR REPLACE FUNCTION fix_elizaos_schema() RETURNS VOID AS $$
BEGIN
    -- Check if server_agents table exists and has UUID server_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'server_agents' 
        AND column_name = 'server_id' 
        AND data_type = 'uuid'
    ) THEN
        -- Drop the problematic constraint if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'server_agents_server_id_fkey'
            AND table_name = 'server_agents'
        ) THEN
            ALTER TABLE server_agents DROP CONSTRAINT server_agents_server_id_fkey;
        END IF;

        -- Convert server_id from UUID to TEXT to match message_servers.id
        ALTER TABLE server_agents ALTER COLUMN server_id TYPE TEXT USING server_id::TEXT;

        -- Add the foreign key constraint with matching types
        ALTER TABLE server_agents 
            ADD CONSTRAINT server_agents_server_id_fkey 
            FOREIGN KEY (server_id) REFERENCES message_servers(id) ON DELETE CASCADE;
            
        RAISE NOTICE 'ElizaOS schema fix applied: server_agents.server_id converted to TEXT';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Set up a trigger to apply the fix after ElizaOS creates its tables
-- This will run the fix when the server_agents table is created
CREATE OR REPLACE FUNCTION trigger_schema_fix() RETURNS event_trigger AS $$
BEGIN
    -- Only run on CREATE TABLE events
    IF TG_TAG = 'CREATE TABLE' THEN
        PERFORM fix_elizaos_schema();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create the event trigger (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_event_trigger WHERE evtname = 'elizaos_schema_fix_trigger'
    ) THEN
        CREATE EVENT TRIGGER elizaos_schema_fix_trigger
            ON ddl_command_end
            WHEN tag IN ('CREATE TABLE')
            EXECUTE FUNCTION trigger_schema_fix();
    END IF;
END
$$; 