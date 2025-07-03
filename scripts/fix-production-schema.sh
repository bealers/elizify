#!/bin/bash
set -e

echo "ElizaOS Production Schema Fix"
echo "=============================="
echo ""

# Database connection details for production
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-eliza}
DB_USER=${DB_USER:-eliza}
DB_PASSWORD=${DB_PASSWORD:-eliza_secure_password}

echo "Applying schema migration to fix UUID/TEXT type mismatch..."
echo "Database: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""

# Apply the migration
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "/app/db/migrate-existing-schema.sql"

echo ""
echo "Schema migration completed!"
echo ""
echo "You can now restart ElizaOS to apply the fix:"
echo "  docker restart [container_name]"
echo "  # or"
echo "  pm2 restart elizaos" 