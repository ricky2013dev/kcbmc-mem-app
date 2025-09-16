# 🚀 Replit Deployment Guide - KCMBC App

## Quick Setup for File Uploads

Your upload feature is now **fixed and ready for Replit**! Follow these steps to ensure uploaded images persist across deployments.

### 🔧 1. Automatic Setup (Recommended)

Run the setup script in your Replit console:

```bash
npm run setup:replit
```

This script will check your configuration and provide specific instructions for your setup.

### 📋 2. Manual Configuration Steps

#### Step 1: Create Object Storage Bucket

1. Open your Replit project
2. Click **Tools** → **Object Storage** in the left sidebar
3. Create a new bucket (example: `kcmbc-storage`)
4. Note down your bucket name

#### Step 2: Configure Environment Variables

1. Click **🔒 Secrets** in the left sidebar of your Replit project
2. Add these environment variables:

```
Key: PRIVATE_OBJECT_DIR
Value: /kcmbc-storage

Key: PUBLIC_OBJECT_SEARCH_PATHS
Value: /kcmbc-storage/public
```

**Important:** Replace `kcmbc-storage` with your actual bucket name from Step 1.

#### Step 3: Restart Your Application

1. Click **Stop** in the console
2. Click **Run** to restart with new configuration

### ✅ 3. Verify Setup

After restarting, check the console logs for these messages:

```
✅ Good: "Using object storage for file upload"
❌ Bad: "Using local storage for file upload"
```

### 🧪 4. Test Upload

1. Go to **Family Management**
2. Create or edit a family
3. Click the **Picture** tab
4. Upload a family photo
5. Check browser console for "object storage" messages

### 🔍 5. Troubleshooting

#### Issue: Images disappear after app restart
**Solution:** Object storage not configured. Follow steps 1-3 above.

#### Issue: Upload fails with "No file uploaded"
**Solutions:**
- Check file size (must be < 5MB)
- Check file type (JPG, PNG, GIF, WebP only)
- Check browser console for detailed error messages

#### Issue: "Failed to upload to object storage"
**Solutions:**
- Verify bucket name matches exactly (including `/` prefix)
- Restart app after changing environment variables
- Check Replit Object Storage tool is available

#### Issue: Upload works but images don't display
**Solutions:**
- Check browser network tab for 404 errors
- Verify object storage serving endpoint is working
- Try hard refresh (Ctrl+F5)

### 📝 6. Environment Variable Examples

For a bucket named `my-church-storage`:

```bash
# In Replit Secrets
PRIVATE_OBJECT_DIR=/my-church-storage
PUBLIC_OBJECT_SEARCH_PATHS=/my-church-storage/public
```

For a bucket named `kcmbc-files`:

```bash
# In Replit Secrets
PRIVATE_OBJECT_DIR=/kcmbc-files
PUBLIC_OBJECT_SEARCH_PATHS=/kcmbc-files/public
```

### 🔄 7. Development vs Production

| Mode | Storage | Persistence | Setup Required |
|------|---------|-------------|----------------|
| **Local Development** | Local files | ❌ Lost on restart | None |
| **Replit (No Config)** | Local files | ❌ Lost on restart | None |
| **Replit (Configured)** | Object Storage | ✅ Permanent | Steps 1-3 above |

### 🎯 8. What Gets Fixed

✅ **Before Fix:**
- Upload errors and failures
- Complex error messages
- Images lost on deployment
- Inconsistent behavior

✅ **After Fix:**
- Clear error messages with debugging info
- Automatic storage backend detection
- Persistent image storage on Replit
- Better error handling and logging
- Setup automation script

### 📞 9. Need Help?

1. Run `npm run setup:replit` for guided setup
2. Check browser console for detailed error messages
3. Check Replit console logs for server-side errors
4. Verify environment variables are set correctly

---

## 🔧 Advanced Configuration

### Custom Bucket Structure

You can organize your files with custom paths:

```bash
# Separate buckets
PRIVATE_OBJECT_DIR=/kcmbc-private
PUBLIC_OBJECT_SEARCH_PATHS=/kcmbc-public/images

# Subfolder organization
PRIVATE_OBJECT_DIR=/kcmbc-storage
PUBLIC_OBJECT_SEARCH_PATHS=/kcmbc-storage/public,/kcmbc-storage/assets
```

### Force Storage Backend

Override automatic detection:

```bash
# Force object storage (production)
STORAGE_BACKEND=object

# Force local storage (development)
STORAGE_BACKEND=local
```

---

## 🚨 Important Notes

- **Without object storage:** Images are lost when your Replit app restarts
- **With object storage:** Images persist permanently across deployments
- Environment variables take effect only after restarting the app
- Bucket names must start with `/` and match exactly
- File uploads are limited to 5MB and common image formats
- The setup script can be run multiple times safely

---

## 🎉 Success!

Once configured, your KCMBC app will have:
- ✅ Persistent file uploads
- ✅ Professional image handling
- ✅ Automatic storage backend detection
- ✅ Clear error messages and debugging
- ✅ Production-ready file management

Your church management system is now ready for production use on Replit! 🎊