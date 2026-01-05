# Testing Authentication

## Prerequisites

1. **Supabase Project**: You need a Supabase project set up
   - If you don't have one: Go to [supabase.com](https://supabase.com) and create a free project
   - If you have one from v1: You can use the same project or create a new one

2. **Environment Variables**: Create `.env.local` file in the project root

## Setup Steps

### 1. Get Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the following:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### 2. Create `.env.local` File

In the project root (`/Users/ericgrandmaison/Desktop/cursor_projects/golf-colors-v2/`), create a file named `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important**: Replace the placeholder values with your actual Supabase credentials.

### 3. Configure Supabase Auth Settings

In your Supabase dashboard:

1. Go to **Authentication** → **Providers**
2. Make sure **Email** provider is enabled
3. (Optional) Configure email templates if you want custom confirmation emails
4. For testing, you might want to disable "Confirm email" temporarily:
   - Go to **Authentication** → **Settings**
   - Under "Email Auth", you can disable "Enable email confirmations" for easier testing

### 4. Start the Dev Server

```bash
npm run dev
```

The app should start at `http://localhost:5173`

## Testing Checklist

### ✅ Test 1: Home Page (Public)
- [ ] Navigate to `http://localhost:5173`
- [ ] Should see "Golf Colors" header
- [ ] Should see "Sign in" link in header
- [ ] Should NOT see user email or "Sign out" button

### ✅ Test 2: Sign Up Flow
- [ ] Click "Sign in" → should go to `/login`
- [ ] Click "Don't have an account? Sign up" → should go to `/signup`
- [ ] Enter email and password (min 6 characters)
- [ ] Click "Sign up"
- [ ] **Expected**: Should redirect to `/dashboard` (or show success message if email confirmation is enabled)
- [ ] Should see your email in the header
- [ ] Should see "Sign out" button

### ✅ Test 3: Sign Out
- [ ] Click "Sign out" in header
- [ ] **Expected**: Should redirect to home page
- [ ] Should see "Sign in" link again
- [ ] Should NOT be able to access `/dashboard` (should redirect to `/login`)

### ✅ Test 4: Sign In Flow
- [ ] Navigate to `/login`
- [ ] Enter the email/password you just created
- [ ] Click "Sign in"
- [ ] **Expected**: Should redirect to `/dashboard`
- [ ] Should see your email in header

### ✅ Test 5: Protected Routes
- [ ] While signed out, try to navigate to `/dashboard`
- [ ] **Expected**: Should redirect to `/login`
- [ ] While signed out, try to navigate to `/leaderboard`
- [ ] **Expected**: Should redirect to `/login`
- [ ] Sign in, then navigate to `/dashboard`
- [ ] **Expected**: Should see dashboard page (placeholder for now)

### ✅ Test 6: Error Handling
- [ ] Try to sign in with wrong password
- [ ] **Expected**: Should show error message
- [ ] Try to sign up with existing email
- [ ] **Expected**: Should show error message
- [ ] Try to sign up with password < 6 characters
- [ ] **Expected**: Browser validation should prevent submission

## Common Issues

### Issue: "Missing Supabase environment variables"
**Solution**: Make sure `.env.local` exists and has correct variable names (must start with `VITE_`)

### Issue: "Invalid API key"
**Solution**: Double-check your Supabase anon key is correct (copy entire key, no extra spaces)

### Issue: "Email already registered"
**Solution**: This is expected if you've already signed up. Use "Sign in" instead, or use a different email.

### Issue: "Email not confirmed"
**Solution**: 
- Check your email for confirmation link, OR
- Disable email confirmation in Supabase dashboard (Settings → Authentication)

### Issue: Redirects not working
**Solution**: Make sure you're using the latest code. Try clearing browser cache.

## Next Steps After Testing

Once authentication is working:
1. ✅ Phase 2 complete
2. → Proceed to Phase 3: Database Schema Setup
3. → Then Phase 4+: Feature Implementation

## Notes

- The dashboard and leaderboard pages are currently placeholders
- They will be implemented in later phases
- For now, they just confirm protected routes work

