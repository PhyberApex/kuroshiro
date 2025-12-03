# Database Migrations Guide

This document explains how to use TypeORM migrations in the Kuroshiro API.

## Overview

The API uses TypeORM migrations to manage database schema changes. Migrations run **automatically at startup**, making deployments seamless for self-hosted Docker installations.

## How It Works

- **Automatic Migration**: When the API starts, it automatically runs any pending migrations
- **Safe**: TypeORM tracks which migrations have run in the `migrations` table
- **Idempotent**: Running the app multiple times won't re-run migrations
- **Version Control**: All migrations are committed to git with the code

## Migration Scripts

The following npm scripts are available:

### Development Scripts

```bash
# Generate a new migration by comparing entities to database schema
pnpm migration:generate src/migrations/DescriptiveName

# Create a blank migration file for custom changes
pnpm migration:create src/migrations/DescriptiveName

# Manually run pending migrations (usually not needed - they run at startup)
pnpm migration:run

# Show migration status
pnpm migration:show

# Revert the last migration (use with caution!)
pnpm migration:revert
```

## Creating a New Migration

When you change entity files (e.g., adding a column, creating a new entity), follow these steps:

### 1. Make Your Entity Changes

Edit your entity files in `src/*/entities/`:

```typescript
@Entity()
export class Device {
  // ... existing fields ...

  @Column('text', { nullable: true })
  newField?: string // New field added
}
```

### 2. Build the Project

```bash
pnpm build
```

### 3. Generate the Migration

```bash
pnpm migration:generate src/migrations/AddNewFieldToDevice
```

This will:
- Compare your entities to the current database schema
- Generate a migration file with the necessary SQL changes
- Save it in `src/migrations/` with a timestamp prefix

### 4. Review the Migration

Open the generated migration file and verify the SQL looks correct:

```typescript
import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddNewFieldToDevice1733155300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" ADD "newField" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "newField"`)
  }
}
```

### 5. Test the Migration

```bash
# Restart the dev server - migrations run at startup
pnpm start:dev
```

### 6. Commit the Migration

```bash
git add src/migrations/
git add src/devices/devices.entity.ts  # and any other changed files
git commit -m "feat: add newField to Device entity"
```

## Release Process

### For Users Upgrading

Users upgrading their self-hosted instance simply need to:

1. **Pull the new Docker image**
   ```bash
   docker pull <your-registry>/kuroshiro:latest
   ```

2. **Restart the container**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. **Migrations run automatically**
   - On startup, the API checks for pending migrations
   - Runs them in order
   - Logs the results
   - Continues with normal startup

**No manual intervention needed!**

## Migration Best Practices

### DO ✅

- **Test migrations on a copy of production data** before releasing
- **Make migrations reversible** when possible (implement `down()`)
- **Keep migrations small and focused** - one logical change per migration
- **Use descriptive names** - `AddUserEmailColumn` not `Migration1`
- **Review generated SQL** - TypeORM might not generate optimal queries
- **Commit migrations with code changes** - keep them in sync

### DON'T ❌

- **Don't edit old migrations** - create a new one to fix issues
- **Don't run migrations manually in production** - let the app do it at startup
- **Don't skip migrations** - they must run in order
- **Don't mix schema and data changes** - use separate migrations
- **Don't use `synchronize: true` in production** - always use migrations

## Handling Existing Databases

### For Existing Installations (Baseline Migration)

The baseline migration (`1733155200000-Baseline.ts`) handles existing databases that were created with `synchronize: true`:

- Uses `CREATE TABLE IF NOT EXISTS` to safely handle both scenarios:
  - **New installations**: Creates all tables from scratch
  - **Existing installations**: Skips table creation (tables already exist)

When an existing user upgrades to a version with migrations:
1. The baseline migration runs
2. Sees tables already exist
3. Marks itself as complete
4. Future migrations run normally

**This means no manual intervention is needed for existing users!**

## Troubleshooting

### Migration Failed

If a migration fails at startup:

1. **Check the logs** - the API will log the error
2. **Check database connectivity** - ensure DB is accessible
3. **Fix the issue**:
   - If it's a migration bug: create a new migration to fix it
   - If it's data corruption: fix the data manually
4. **Restart the app** - it will retry

### Stuck Migration

If you need to manually intervene:

```bash
# Connect to the database
psql -h localhost -U root -d kuroshiro

# Check migration status
SELECT * FROM migrations;

# If a migration is stuck, you can manually mark it as run (use with caution!)
INSERT INTO migrations (timestamp, name) VALUES (1733155200000, 'Baseline1733155200000');
```

### Reset Database (Development Only)

To start fresh in development:

```bash
# Drop and recreate the database
psql -h localhost -U root -c "DROP DATABASE kuroshiro_dev; CREATE DATABASE kuroshiro_dev;"

# Restart the app - all migrations run from scratch
pnpm start:dev
```
