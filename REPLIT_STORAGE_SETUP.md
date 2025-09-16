# Replit Object Storage Setup Guide

This guide will help you set up persistent file uploads for your KCMBC app using Replit's built-in Object Storage.

## 📋 Prerequisites

- Your KCMBC app deployed on Replit
- Access to your Replit project settings

## 🚀 Setup Instructions

### Step 1: Create Object Storage Bucket in Replit

1. Open your Replit project
2. Click on **Tools** in the left sidebar
3. Click on **Object Storage**
4. Click **Create Bucket**
5. Name your bucket (e.g., `kcmbc-storage`)
6. Click **Create**

> **Note**: Remember the exact bucket name - you'll need it for Step 2.

### Step 2: Configure Environment Variables

1. In your Replit project, click on **Secrets** (🔒 icon in left sidebar)
2. Add the following environment variables:

```bash
# Replit Object Storage Configuration
PRIVATE_OBJECT_DIR=/your-bucket-name
PUBLIC_OBJECT_SEARCH_PATHS=/your-bucket-name/public

# Environment Configuration
NODE_ENV=production
PORT=5000

# Session Secret (generate a secure random string)
SESSION_SECRET=your-secure-session-secret-here

# Database URL (use your existing database connection string)
DATABASE_URL=your-existing-database-url
```

**Important**: Replace `your-bucket-name` with the exact name of the bucket you created in Step 1.

#### Example Configuration:
If your bucket is named `kcmbc-storage`, your secrets should look like:

```bash
PRIVATE_OBJECT_DIR=/kcmbc-storage
PUBLIC_OBJECT_SEARCH_PATHS=/kcmbc-storage/public
NODE_ENV=production
PORT=5000
SESSION_SECRET=abc123xyz789secure-random-string
DATABASE_URL=postgresql://user:pass@host:port/database
```

### Step 3: Restart Your Application

1. Click the **Stop** button in your Replit console
2. Click **Run** to restart with the new configuration
3. Wait for the application to fully start

### Step 4: Test Upload Functionality

1. Open your KCMBC app in the browser
2. Log in with your credentials
3. Navigate to **Family Management**
4. Try uploading a family photo
5. Check the Replit console for success messages

## ✅ Verification

### Console Messages to Look For:

When uploads are working correctly, you should see messages like:

```
Upload request received: {
  useCloudStorage: true,
  hasGoogleCloudConfig: false,
  nodeEnv: 'production'
}
Using object storage for file upload
Successfully uploaded to object storage
Generated object path: /objects/uploads/abc123-1234567890.jpg
```

### File Persistence Test:

1. Upload an image to a family profile
2. Restart your Replit app
3. Check if the image is still accessible
4. ✅ If yes, object storage is working correctly!

## 🔧 How It Works

### Development vs Production Modes:

| Environment | Storage Type | File Location | Persistence |
|-------------|--------------|---------------|-------------|
| **Development** (local) | Local disk | `/uploads/` folder | ❌ Lost on restart |
| **Production** (Replit) | Object Storage | Replit cloud bucket | ✅ Persistent |

### Automatic Detection:

The application automatically detects which storage to use based on:
- Presence of `PRIVATE_OBJECT_DIR` and `PUBLIC_OBJECT_SEARCH_PATHS` environment variables
- `NODE_ENV=production` setting

### File URL Patterns:

- **Local development**: `http://localhost:3000/uploads/filename.jpg`
- **Replit production**: `https://your-app.replit.app/objects/uploads/filename.jpg`

## 🛠 Troubleshooting

### Common Issues:

#### 1. "Object storage temporarily disabled" error
**Cause**: Environment variables not set correctly
**Solution**: Double-check bucket name and environment variables

#### 2. Files not persisting after restart
**Cause**: Still using local storage instead of object storage
**Solution**: Verify `NODE_ENV=production` and restart app

#### 3. Upload fails with 500 error
**Cause**: Bucket doesn't exist or wrong permissions
**Solution**: Recreate bucket and check bucket name in environment variables

### Debug Steps:

1. Check Replit console logs for error messages
2. Verify all environment variables are set correctly
3. Ensure bucket name matches exactly (case-sensitive)
4. Try restarting the application
5. Test with a small image file first

## 📝 Environment Variables Reference

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `PRIVATE_OBJECT_DIR` | ✅ Yes | `/kcmbc-storage` | Your bucket path for private files |
| `PUBLIC_OBJECT_SEARCH_PATHS` | ✅ Yes | `/kcmbc-storage/public` | Search paths for public files |
| `NODE_ENV` | ✅ Yes | `production` | Enables object storage mode |
| `PORT` | ✅ Yes | `5000` | Replit requires this port |
| `SESSION_SECRET` | ✅ Yes | `your-secret-key` | Session encryption key |
| `DATABASE_URL` | ✅ Yes | `postgresql://...` | Database connection string |

## 🎉 Success!

Once configured correctly, your KCMBC app will have:
- ✅ Persistent file uploads that survive app restarts
- ✅ Automatic cloud storage in production
- ✅ Local development support
- ✅ Seamless file serving and management

Your family photos and uploaded files will now be safely stored in Replit's Object Storage and remain accessible even after deployments and updates!

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Replit console logs for specific error messages
3. Verify your bucket exists in Tools → Object Storage
4. Ensure all environment variables are correctly set

---

*Last updated: September 2024*