# FoodLink - Supabase Setup Guide

## Quick Start (5 minutes)

### 1. Run the Database Schema

1. Open your Supabase project: https://ifuwgtitycokjmlsyyai.supabase.co
2. Go to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the ENTIRE contents of `/supabase/schema.sql` from this repo
5. Paste into the editor
6. Click **Run** (or Ctrl+Enter)

You should see: `Success. No rows returned`

### 2. Verify It Worked

Run this query to verify all tables exist:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

You should see these 9 tables:
- chat_messages
- chat_threads
- deliveries
- donations
- emergency_requests
- notifications
- profiles
- reviews
- user_badges

### 3. Verify Storage Buckets

Go to **Storage** in the sidebar. You should see:
- `food-images` (public)
- `delivery-proofs` (public)
- `profile-pictures` (public)

If not, re-run the schema SQL.

### 4. Verify the RPC Function

Run:
```sql
select proname from pg_proc where proname = 'increment_points';
```
You should see `increment_points`.

### 5. Verify the Auth Trigger

Run:
```sql
select tgname from pg_trigger where tgname = 'on_auth_user_created';
```
You should see `on_auth_user_created`.

## Environment Variables

Your `.env` file should already contain:

```
VITE_SUPABASE_URL=https://ifuwgtitycokjmlsyyai.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_BDkCisxRod2dhO_hU9F6rQ_Z4R4Q0EH
```

Restart your dev server after changes: `npm run dev`

## Common Issues & Fixes

### "donations table missing column: contact_phone"
**Fix:** Re-run the entire `/supabase/schema.sql` file.

### "row-level security policy violated"
**Fix:** The schema file creates permissive RLS policies. Re-run it.

### "foreign key violation on donations.donor_id"
**Fix:** The auth trigger creates profiles automatically on signup. Check that:
1. The trigger `on_auth_user_created` exists (see step 5 above)
2. The user is authenticated before inserting donations

### "schema cache is out of date"
**Fix:** Run this SQL:
```sql
notify pgrst, 'reload schema';
```
Then refresh your app.

### "relation X does not exist"
**Fix:** Run the schema.sql file. The schema is idempotent (safe to re-run).

## What the Schema Creates

### Tables (9)
1. **profiles** - extends auth.users with app-specific fields
2. **donations** - food donations with all required columns
3. **emergency_requests** - hunger alerts from NGOs
4. **notifications** - per-user notifications
5. **chat_threads** - conversation threads
6. **chat_messages** - messages within threads
7. **reviews** - donation reviews/ratings
8. **user_badges** - earned badges (many-to-many)
9. **deliveries** - delivery audit trail

### Functions (1)
- **increment_points(user_id, pts)** - atomically updates points and rank

### Triggers (1)
- **on_auth_user_created** - auto-creates profile when user signs up

### Storage Buckets (3)
- **food-images** - donation photos
- **delivery-proofs** - proof of delivery photos
- **profile-pictures** - user avatars

### Realtime Tables (5)
- donations, notifications, chat_messages, emergency_requests, profiles

### RLS Policies
Permissive policies that allow:
- Public read on donations, profiles, emergency_requests, reviews, badges
- Authenticated users to read their own notifications
- Donors to manage their own donations
- NGOs to accept and manage assigned donations
- Volunteers to update assigned donations
- Authenticated users to chat

## Testing

After running the schema, try these actions in your app:

1. ✅ Register a new user (should auto-create profile)
2. ✅ Login (should fetch profile)
3. ✅ Upload food (should insert donation)
4. ✅ NGO accepts donation (should update status)
5. ✅ Send chat message (should create thread + message)
6. ✅ Create emergency alert (should insert + notify donors)

## Support

If something doesn't work:
1. Open browser DevTools → Console
2. Look for red error messages starting with `[FoodLink Schema Health]`
3. The error will tell you exactly what's missing
4. Re-run the schema.sql file
