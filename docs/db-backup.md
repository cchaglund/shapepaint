# Database Backups

Weekly database backups run via GitHub Actions and are stored in Cloudflare R2, independent of Supabase.

## Schedule

Backups run **every Sunday at 03:00 UTC** automatically. Files are named `shapepaint-backup-YYYY-MM-DD_HHMMSS.sql.gz`.

## Manual trigger

Go to GitHub repo → **Actions** → "Weekly DB Backup" → **Run workflow** → select branch → **Run**.

## GitHub Secrets required

| Secret | Description |
|---|---|
| `SUPABASE_DB_URL` | Postgres connection string (Session pooler URI from Supabase Dashboard → Connect) |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 API token secret key |
| `R2_ENDPOINT_URL` | R2 S3 API endpoint (`https://<account-id>.r2.cloudflarestorage.com`) |

## Restoring from backup

1. Download the backup file from the R2 bucket (via Cloudflare dashboard or CLI)

2. Restore into the database:
   ```bash
   gunzip -c shapepaint-backup-YYYY-MM-DD_HHMMSS.sql.gz | psql "$SUPABASE_DB_URL"
   ```

   If you need to wipe the database first (e.g. it has corrupt data):
   ```bash
   # Drop and recreate the public schema before restoring
   psql "$SUPABASE_DB_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   gunzip -c shapepaint-backup-YYYY-MM-DD_HHMMSS.sql.gz | psql "$SUPABASE_DB_URL"
   ```

## R2 bucket details

- **Bucket**: `shapepaint-db-backup`
- **Region**: Eastern Europe (EEUR)
- **Public access**: Disabled (private, access via API tokens only)

## Why not rely on Supabase backups alone?

Supabase Pro includes daily backups with 7-day retention. If a destructive event goes unnoticed for more than 7 days, all rolling backups will contain the damaged state. Weekly R2 backups provide an independent safety net with no automatic expiry.
