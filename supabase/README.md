# Supabase Migrations

This directory contains SQL migration files for setting up the Golf Colors v2 database schema.

## Migration Files

1. **001_initial_schema.sql** - Creates all database tables and indexes
2. **002_rls_policies.sql** - Sets up Row Level Security (RLS) policies
3. **003_triggers.sql** - Creates triggers for updated_at timestamps

## Running Migrations

### Option 1: Supabase Dashboard (Recommended for initial setup)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open each migration file in order (001, 002, 003)
4. Run each file by clicking "Run"

### Option 2: Supabase CLI

If you have Supabase CLI installed:

```bash
# Link to your project (first time only)
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Option 3: Manual Copy-Paste

1. Open each migration file
2. Copy the SQL content
3. Paste into Supabase SQL Editor
4. Run in order

## Migration Order

**Important**: Run migrations in this exact order:

1. `001_initial_schema.sql` - Creates all tables
2. `002_rls_policies.sql` - Sets up security policies
3. `003_triggers.sql` - Adds triggers

## Verifying Migration

After running migrations, verify in Supabase Dashboard:

1. **Table Editor**: Should see all tables listed
2. **Authentication → Policies**: Should see RLS policies enabled
3. **Database → Functions**: Should see `update_updated_at_column()` function

## Troubleshooting

### Error: "relation already exists"
- Tables may already exist from previous runs
- Either drop existing tables or skip this migration

### Error: "permission denied"
- Make sure you're using the Supabase SQL Editor (has admin privileges)
- Or use Supabase CLI with proper authentication

### RLS Policies Not Working
- Verify RLS is enabled: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
- Check policies exist in Authentication → Policies section

## Next Steps

After migrations are complete:
1. Verify tables exist and have correct structure
2. Test RLS policies with a test user
3. Proceed with application development

