# TrashDrop Mobile Collector Driver - Fix Instructions

## Issue 1: React Hooks Error in Map.jsx

This issue has been fixed by moving all React hooks to the top level of the component, before any conditional returns. The fix ensures that hooks are always called in the same order on every render.

## Issue 2: 406 Not Acceptable Error with collector_sessions Table

To fix this issue, you need to run the SQL script in the Supabase SQL Editor:

1. **Log in to your Supabase dashboard** at https://app.supabase.io
2. **Select your project**
3. **Click on "SQL Editor" in the left sidebar**
4. **Create a new query**
5. **Copy and paste the contents of `scripts/fix-collector-sessions-table.sql`**
6. **Run the script**

The script will:
- Create the `collector_sessions` table if it doesn't exist
- Add missing columns if the table exists
- Set up proper RLS policies with correct type casting
- Create indexes for performance
- Grant necessary permissions

## After Applying the Fix

1. **Restart your application**
2. **Check the browser console** to verify that the 406 Not Acceptable error is gone
3. **Verify that the collector status is working correctly**

## Troubleshooting

If you still encounter issues after applying the fix:

1. **Check the Supabase SQL Editor output** for any error messages
2. **Verify the table structure** in the Supabase Table Editor
3. **Check the RLS policies** in the Supabase Auth settings
4. **Clear your browser cache** and reload the application

## Additional Notes

- The React Hooks error was caused by hooks being defined after conditional returns
- The 406 Not Acceptable error was caused by missing columns in the `collector_sessions` table
- The SQL script fixes both the table structure and the RLS policies
