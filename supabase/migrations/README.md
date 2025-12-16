# Database Migrations

This directory contains SQL migrations for the TrashDrop Mobile Collector Driver application.

## How to Apply Migrations

### Option 1: Using Supabase CLI

1. Install the Supabase CLI if you haven't already:
   ```bash
   npm install -g supabase
   ```

2. Link your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Apply migrations:
   ```bash
   supabase db push
   ```

### Option 2: Using Supabase Dashboard

1. Log in to the [Supabase Dashboard](https://app.supabase.io)
2. Select your project
3. Go to the SQL Editor
4. Copy the contents of each migration file
5. Paste into the SQL Editor and run the queries

## Migration Files

- `20251014_create_otps_table.sql`: Creates the OTPs table for storing one-time passwords

## Switching Between In-Memory and Database Storage

The application is currently configured to use in-memory storage for OTPs. To switch to database storage:

1. Apply the migration to create the `otps` table
2. Update the `authService.js` file to use database storage instead of in-memory storage

### Code Changes Required

In `src/services/authService.js`:

1. Remove the in-memory store:
   ```javascript
   constructor(provider) {
     this.provider = provider;
     
     // OTP expiry time in milliseconds
     this.OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
   }
   ```

2. Update the `sendOtp` method to use the database:
   ```javascript
   // Generate a 6-digit OTP
   const otp = Math.floor(100000 + Math.random() * 900000).toString();
   
   // Store OTP in database with expiry time
   const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MS).toISOString();
   const { error: otpError } = await this.provider.storeOtp(phoneNumber, otp, expiresAt);
   
   if (otpError) {
     console.error('Error storing OTP in database:', otpError);
     return { success: false, error: 'Failed to generate verification code' };
   }
   ```

3. Update the `verifyOtp` method to use the database:
   ```javascript
   // Check if OTP exists in database for this phone number
   const { data: otpData, error: fetchError } = await this.provider.getOtp(phoneNumber);
   
   if (fetchError || !otpData || otpData.length === 0) {
     console.error('Error fetching OTP from database:', fetchError);
     return { success: false, error: 'No verification code found. Please request a new code.' };
   }
   
   const otpRecord = otpData[0]; // Get the latest OTP
   
   // Check if OTP has expired
   const expiresAt = new Date(otpRecord.expires_at).getTime();
   if (Date.now() > expiresAt) {
     // Remove expired OTP from database
     await this.provider.deleteOtp(phoneNumber);
     return { success: false, error: 'Verification code has expired. Please request a new code.' };
   }
   
   // Check if OTP matches
   if (otpRecord.code !== otp) {
     return { success: false, error: 'Invalid verification code. Please try again.' };
   }
   
   // OTP is valid, remove it from database
   await this.provider.deleteOtp(phoneNumber);
   ```
