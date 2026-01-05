# Supabase MCP Setup Guide

## Quick Start (Your Project)

**Your Configuration**:
- Project Reference: `mjxygrbfvlrvhyjrepqq`
- Access Token: `sbp_fb4f25d1e1e11ded53a4a4bf4f93fa08a20120f2`

**Quick Setup**:
1. Open Cursor Settings (`Cmd + ,`)
2. Go to **Features** → **MCP**
3. Add new server with:
   - **URL**: `https://mcp.supabase.com/mcp?project_ref=mjxygrbfvlrvhyjrepqq&features=database,docs,debugging,development`
   - **Header**: `Authorization: Bearer sbp_fb4f25d1e1e11ded53a4a4bf4f93fa08a20120f2`

See `SUPABASE_MCP_CONFIG.md` for detailed configuration.

---

## Overview

This guide will help you connect the official Supabase MCP server to Cursor, enabling AI assistant access to your Supabase database. This provides backend context during development.

## Prerequisites

You should already have:
- ✅ Supabase project created
- ✅ `VITE_SUPABASE_URL` in your `.env.local` file
- ✅ `VITE_SUPABASE_ANON_KEY` in your `.env.local` file

## What You Need

### 1. Project Reference ID

**You already have this!** It's in your `VITE_SUPABASE_URL`.

Your Supabase URL looks like: `https://[PROJECT_REF].supabase.co`

**Example**: If your URL is `https://abcdefghijklmnop.supabase.co`, then your project reference is `abcdefghijklmnop`

**Action**: Extract the project reference from your `.env.local` file's `VITE_SUPABASE_URL`

### 2. Access Token (NEW - You Need to Generate This)

The **anon key is NOT the same** as an access token. You need to generate a separate access token for MCP.

**Steps to Generate Access Token**:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click your **profile icon** (top right) → **Account Settings**
3. Navigate to **Access Tokens** (in the left sidebar)
4. Click **"Generate New Token"**
5. Give it a name: `Cursor MCP Access Token`
6. **Copy the token immediately** (it's only shown once!)
7. Save it securely (you'll need it for Cursor configuration)

**Important**: 
- This token is different from your anon key
- It provides API access to your Supabase account
- Keep it secure (don't commit to git)
- You can revoke it anytime in Account Settings

## Setting Up MCP in Cursor

### Step 1: Open Cursor Settings

1. Open Cursor
2. Press `Cmd + ,` (Mac) or `Ctrl + ,` (Windows/Linux) to open Settings
3. Or: **Cursor** → **Settings** → **Features** → **MCP**

### Step 2: Add MCP Server

1. In the MCP settings section, click **"+ Add New MCP Server"** or **"Add Server"**
2. Fill in the configuration:

**Configuration Details**:

- **Name**: `Supabase Golf Colors` (or any name you prefer)
- **Transport Type**: Select `SSE` (Server-Sent Events) or `HTTP`
- **URL**: 
  ```
  https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF&features=database,docs,debugging,development
  ```
  Replace `YOUR_PROJECT_REF` with the project reference from your `VITE_SUPABASE_URL`

- **Headers**: Add a new header:
  - **Key**: `Authorization`
  - **Value**: `Bearer YOUR_ACCESS_TOKEN`
  Replace `YOUR_ACCESS_TOKEN` with the token you generated

**Example Configuration**:
```
Name: Supabase Golf Colors
URL: https://mcp.supabase.com/mcp?project_ref=abcdefghijklmnop&features=database,docs,debugging,development
Headers:
  Authorization: Bearer supabase_access_token_here
```

### Step 3: Save and Enable

1. Click **Save** or **Apply**
2. Make sure the MCP server is **enabled** (toggle should be on)
3. Restart Cursor if prompted

## Alternative: JSON Configuration

If Cursor uses a JSON config file instead of UI settings, the configuration would look like:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp",
      "params": {
        "project_ref": "YOUR_PROJECT_REF",
        "features": "database,docs,debugging,development"
      },
      "headers": {
        "Authorization": "Bearer YOUR_ACCESS_TOKEN"
      }
    }
  }
}
```

**Note**: Cursor's MCP configuration location varies. Check Cursor's documentation for the exact location.

## Verifying the Connection

After setup, test the connection:

1. In Cursor, ask me: "Can you see my Supabase database schema?"
2. I should be able to:
   - List your tables
   - View table structures
   - Execute queries (if enabled)

If it works, you'll see me accessing your database schema!

## Troubleshooting

### "Connection Failed" Error

- **Check project reference**: Make sure it matches your `VITE_SUPABASE_URL`
- **Check access token**: Verify it's correct (no extra spaces)
- **Regenerate token**: If unsure, generate a new access token

### "Unauthorized" Error

- **Token expired**: Generate a new access token
- **Wrong token**: Make sure you're using the access token, not the anon key
- **Token format**: Should be `Bearer YOUR_TOKEN` (with space after Bearer)

### "Cannot find MCP settings"

- **Update Cursor**: Make sure you're on the latest version
- **Check location**: Settings might be under a different menu
- **Alternative**: Cursor might use a config file - check Cursor documentation

### MCP Server Not Appearing

- **Restart Cursor**: Close and reopen Cursor
- **Check logs**: Look for errors in Cursor's developer console
- **Verify URL**: Make sure the URL format is correct

## Security Best Practices

1. **Use Development Project**: If possible, connect MCP to a development/staging project, not production
2. **Limit Features**: Only enable features you need (we've enabled: database, docs, debugging, development)
3. **Revoke if Needed**: You can revoke the access token anytime in Supabase dashboard
4. **Don't Commit Tokens**: Never commit access tokens to git (they're in Cursor settings, not project files)

## What MCP Enables

Once connected, I can:
- ✅ View your actual database schema (not just migration files)
- ✅ Verify migrations were applied correctly
- ✅ Query your database to debug issues
- ✅ Understand your current data structure
- ✅ Provide more accurate backend guidance
- ✅ Help with database debugging

## Next Steps

After MCP is configured:
1. I'll be able to see your actual database state
2. We can verify the migrations worked correctly
3. I can help debug any database issues with real context
4. Development will be more efficient with backend visibility

## Quick Reference

**Project Reference**: Extract from `VITE_SUPABASE_URL` in `.env.local`
**Access Token**: Generate from Supabase Dashboard → Account Settings → Access Tokens
**MCP URL Format**: `https://mcp.supabase.com/mcp?project_ref=REF&features=database,docs,debugging,development`
**Authorization Header**: `Bearer YOUR_ACCESS_TOKEN`

## Need Help?

If you run into issues:
1. Check Supabase MCP docs: https://supabase.com/mcp
2. Check Cursor MCP docs: Cursor Settings → Help
3. Verify your credentials are correct
4. Try regenerating the access token

