# Troubleshooting Announcements Feature

## 400 Bad Request Error - Common Solutions

### 1. Database Table Missing
**Most likely cause** - The announcements table doesn't exist yet.

**Solution:**
```bash
# Run the SQL script in your PostgreSQL database
psql -d your_database_name -f create_announcements_table.sql

# OR if using Drizzle migrations
npx drizzle-kit push
```

### 2. Authentication Issues
The user must be logged in with **ADM** role to create announcements.

**Check:**
- Is the user logged in?
- Does the user have `group: 'ADM'`?
- Are session cookies working properly?

### 3. Date Format Issues
Frontend sends dates, but backend expects specific format.

**Expected format:** ISO 8601 strings
```javascript
// Correct format
startDate: "2024-01-01T00:00:00.000Z"
endDate: "2024-01-08T23:59:59.999Z"
```

### 4. Missing Required Fields
Check that all required fields are being sent:

```javascript
{
  title: "string (required, max 255 chars)",
  content: "string (required)",
  type: "Major" | "Medium" | "Minor" (required),
  isLoginRequired: boolean (required),
  startDate: "ISO date string (required)",
  endDate: "ISO date string (required)", 
  isActive: boolean (required)
}
```

## Debug Steps

### Step 1: Run Debug Script
```bash
node debug_announcement_api.js
```

This will test:
- Server connectivity
- Login functionality  
- Announcement creation
- Show detailed error messages

### Step 2: Check Server Logs
Look at your server console for detailed error messages when making the POST request.

### Step 3: Verify Database Connection
```bash
# Test database connection
npm run db:push
```

### Step 4: Check Network Tab
In browser DevTools → Network tab:
1. Look at the POST request to `/api/announcements`
2. Check Request Headers (should include cookies)
3. Check Request Body (verify all fields present)
4. Check Response (detailed error message)

## Common Error Messages

### "Invalid data, errors: ..."
- **Cause:** Zod validation failed
- **Solution:** Check that all required fields match the expected format

### "Unauthorized"  
- **Cause:** User not logged in
- **Solution:** Login first as ADM user

### "Admin access required"
- **Cause:** User logged in but not ADM role
- **Solution:** Use an ADM user account

### "relation 'announcements' does not exist"
- **Cause:** Database table not created
- **Solution:** Run the SQL script

### Database connection errors
- **Cause:** Database server not running or wrong connection string
- **Solution:** Check DATABASE_URL in .env.local

## Test Data for Manual Testing

Use this JSON in your API testing tool:

```json
{
  "title": "Test Announcement",
  "content": "<p>This is a <strong>test</strong> announcement with HTML content.</p>",
  "type": "Medium",
  "isLoginRequired": false,
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-12-31T23:59:59.999Z",
  "isActive": true
}
```

## Quick Fix Commands

```bash
# Kill any processes on port 3000
kill $(lsof -t -i:3000)

# Restart development server
npm run dev

# Push database schema
npm run db:push

# Check if table exists (PostgreSQL)
psql -d your_db -c "SELECT table_name FROM information_schema.tables WHERE table_name = 'announcements';"
```