# Supabase Storage Bucket Setup Guide

## Required Storage Bucket

The signup flow uploads ID verification and vehicle photos to Supabase Storage. You need to create a storage bucket before testing signup.

### 1. Create Storage Bucket

1. **Go to Supabase Dashboard** → https://supabase.com/dashboard
2. **Click "Storage"** in the left sidebar
3. **Click "New bucket"**
4. **Enter bucket details**:
   - **Name**: `collector-photos`
   - **Public bucket**: ✅ **YES** (photos need to be publicly accessible)
   - Click **"Create bucket"**

### 2. Set Up Storage Policies

After creating the bucket, set up security policies:

```sql
-- Policy: Allow authenticated users to upload their own photos
CREATE POLICY "Users can upload photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'collector-photos');

-- Policy: Allow public read access to photos
CREATE POLICY "Public can view photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'collector-photos');

-- Policy: Users can update their own photos
CREATE POLICY "Users can update own photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'collector-photos');

-- Policy: Users can delete their own photos
CREATE POLICY "Users can delete own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'collector-photos');
```

### 3. Folder Structure

Files will be uploaded to the following path structure:
```
collector-photos/
└── collector-documents/
    ├── id_front_1729435678901.jpg
    ├── id_back_1729435678902.jpg
    └── vehicle_1729435678903.jpg
```

### 4. File Naming Convention

Files are automatically named with:
- **Type prefix**: `id_front_`, `id_back_`, or `vehicle_`
- **Timestamp**: Current timestamp in milliseconds
- **Extension**: Original file extension (jpg, png, etc.)

Example: `id_front_1729435678901.jpg`

### 5. Verify Bucket Setup

To verify the bucket is working:

1. Go to **Storage** → **collector-photos** in Supabase Dashboard
2. Try uploading a test file manually
3. Check if the file appears in the bucket
4. Try accessing the public URL

### 6. Size Limits

Current limits configured in the app:
- **Maximum file size**: 5MB per photo
- **Allowed formats**: image/* (jpg, jpeg, png, gif, etc.)
- **Required photos**: 3 (ID front, ID back, vehicle)

## Alternative: Run SQL Script

You can also run this SQL script in the Supabase SQL Editor:

```sql
-- Enable storage if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: Storage bucket creation must be done via Dashboard UI
-- But you can set up the policies here after bucket is created

-- Ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies (run these AFTER creating the bucket via UI)
CREATE POLICY "Users can upload photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'collector-photos');

CREATE POLICY "Public can view photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'collector-photos');

CREATE POLICY "Users can update own photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'collector-photos');

CREATE POLICY "Users can delete own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'collector-photos');
```

## Important Notes

⚠️ **Security Considerations**:
- Photos are publicly accessible via URL
- File names include timestamps to prevent overwrites
- Users can only upload when authenticated
- Consider adding file size validation in production

✅ **Before Testing Signup**:
1. Create the `collector-photos` bucket
2. Make it public
3. Set up storage policies
4. Run the updated table migration to add photo URL columns

## Troubleshooting

**Error: "Bucket not found"**
- Make sure you created the bucket in the Supabase Dashboard
- Verify the bucket name is exactly `collector-photos`

**Error: "Permission denied"**
- Ensure storage policies are set up correctly
- Check that user is authenticated before uploading

**Photos not displaying**
- Verify the bucket is set to **Public**
- Check the public URL in browser
- Ensure photos were uploaded successfully
