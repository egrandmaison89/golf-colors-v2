# Supabase MCP Configuration for Cursor

## Your Configuration Details

**Project Reference**: `mjxygrbfvlrvhyjrepqq`  
**Access Token**: `sbp_fb4f25d1e1e11ded53a4a4bf4f93fa08a20120f2`

## Cursor MCP Setup Instructions

### Step 1: Open Cursor Settings
1. Press `Cmd + ,` (Mac) or `Ctrl + ,` (Windows/Linux)
2. Navigate to **Features** → **MCP** (or search for "MCP" in settings)

### Step 2: Add New MCP Server
1. Click **"+ Add New MCP Server"** or **"Add Server"**
2. Fill in the following:

**Server Configuration**:

- **Name**: `Supabase Golf Colors`

- **Transport Type**: `SSE` or `HTTP` (try SSE first)

- **URL**: 
  ```
  https://mcp.supabase.com/mcp?project_ref=mjxygrbfvlrvhyjrepqq&features=database,docs,debugging,development
  ```

- **Headers** (add this header):
  - **Key**: `Authorization`
  - **Value**: `Bearer sbp_fb4f25d1e1e11ded53a4a4bf4f93fa08a20120f2`

### Step 3: Save and Enable
1. Click **Save** or **Apply**
2. Ensure the server is **enabled** (toggle should be on)
3. Restart Cursor if prompted

## Alternative: If Cursor Uses JSON Config

If Cursor uses a JSON configuration file (check Cursor documentation for location), use this:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp",
      "params": {
        "project_ref": "mjxygrbfvlrvhyjrepqq",
        "features": "database,docs,debugging,development"
      },
      "headers": {
        "Authorization": "Bearer sbp_fb4f25d1e1e11ded53a4a4bf4f93fa08a20120f2"
      }
    }
  }
}
```

## Verification

After configuration, test by asking me:
- "Can you see my Supabase database tables?"
- "List my database schema"

I should be able to access your Supabase project and see your database structure.

## Troubleshooting

If connection fails:
1. Verify the project reference matches: `mjxygrbfvlrvhyjrepqq`
2. Check the access token is correct (no extra spaces)
3. Try regenerating the access token if needed
4. Restart Cursor after configuration

## Security Note

- This access token provides API access to your Supabase account
- Keep it secure (it's stored in Cursor settings, not in project files)
- You can revoke it anytime in Supabase Dashboard → Account Settings → Access Tokens

