#!/bin/bash

# Fix Collector Sessions Table Script
echo "TrashDrop Mobile Collector Driver - Fix Collector Sessions Table"
echo "=============================================================="
echo

# Check if we have the required tools
if ! command -v open &> /dev/null; then
    echo "The 'open' command is required but not found. Are you on macOS?"
    exit 1
fi

# Open the instructions in the default browser
echo "Opening instructions in your browser..."
open "file://$(pwd)/scripts/fix-instructions.html"

echo
echo "Please follow the instructions in the browser to fix the collector_sessions table."
echo "After you've applied the fix in the Supabase dashboard, press Enter to verify the fix."
read -p "Press Enter to continue..."

# Run the verification script
echo
echo "Running verification script..."
node scripts/verify-fix.js

# Check if the verification was successful
if [ $? -eq 0 ]; then
    echo
    echo "✅ Fix verification completed."
    echo "You can now restart your application to use the updated schema."
else
    echo
    echo "❌ Fix verification failed."
    echo "Please make sure you've applied the fix correctly in the Supabase dashboard."
    echo "If you need help, please refer to the instructions in the browser."
fi

echo
echo "Thank you for using the TrashDrop Mobile Collector Driver!"
