#!/usr/bin/env node

/**
 * Replit Object Storage Setup Script
 *
 * This script helps you configure object storage for persistent file uploads
 * when hosting your KCMBC app on Replit.
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 KCMBC App - Replit Object Storage Setup');
console.log('===========================================\n');

// Check if running on Replit
const isReplit = process.env.REPL_ID || process.env.REPLIT_DB_URL;

if (!isReplit) {
  console.log('⚠️  This script is designed to run on Replit.');
  console.log('   For local development, files are stored locally and will work without setup.\n');
}

// Check current configuration
const envPath = path.join(__dirname, '.env');
const hasEnvFile = fs.existsSync(envPath);

console.log('📋 Current Configuration Status:');
console.log(`   Environment file (.env): ${hasEnvFile ? '✅ Found' : '❌ Not found'}`);

if (hasEnvFile) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasPrivateDir = envContent.includes('PRIVATE_OBJECT_DIR=');
  const hasPublicPaths = envContent.includes('PUBLIC_OBJECT_SEARCH_PATHS=');

  console.log(`   PRIVATE_OBJECT_DIR: ${hasPrivateDir ? '✅ Set' : '❌ Not set'}`);
  console.log(`   PUBLIC_OBJECT_SEARCH_PATHS: ${hasPublicPaths ? '✅ Set' : '❌ Not set'}`);

  if (hasPrivateDir && hasPublicPaths) {
    console.log('\n✅ Object storage appears to be configured!');
    console.log('   Your uploads should persist across deployments.\n');
    return;
  }
}

console.log('\n📝 Setup Instructions:');
console.log('======================');

console.log('\n1. Create an Object Storage Bucket:');
console.log('   • Go to your Replit workspace');
console.log('   • Click on "Tools" → "Object Storage"');
console.log('   • Create a new bucket (e.g., "kcmbc-storage")');
console.log('   • Note the bucket name for step 2');

console.log('\n2. Configure Environment Variables:');
console.log('   • Go to your Replit project');
console.log('   • Click on "Secrets" (🔒 icon in left sidebar)');
console.log('   • Add these environment variables:');
console.log('');
console.log('     Key: PRIVATE_OBJECT_DIR');
console.log('     Value: /your-bucket-name');
console.log('     (Replace "your-bucket-name" with your actual bucket name)');
console.log('');
console.log('     Key: PUBLIC_OBJECT_SEARCH_PATHS');
console.log('     Value: /your-bucket-name/public');
console.log('     (Replace "your-bucket-name" with your actual bucket name)');

console.log('\n3. Restart Your Application:');
console.log('   • Click the "Stop" button in your Replit console');
console.log('   • Click "Run" to restart with new configuration');

console.log('\n4. Test File Upload:');
console.log('   • Go to family management');
console.log('   • Try uploading a family photo');
console.log('   • Check browser console for "object storage" messages');

console.log('\n📚 Example Configuration:');
console.log('========================');
console.log('If your bucket is named "kcmbc-storage":');
console.log('');
console.log('PRIVATE_OBJECT_DIR=/kcmbc-storage');
console.log('PUBLIC_OBJECT_SEARCH_PATHS=/kcmbc-storage/public');

console.log('\n⚠️  Important Notes:');
console.log('===================');
console.log('• Without object storage, uploaded images are lost when your app restarts');
console.log('• With object storage, images persist permanently');
console.log('• The bucket name must start with "/" and match exactly');
console.log('• Environment variables take effect after restarting the app');

console.log('\n✅ After Setup:');
console.log('==============');
console.log('Run this script again to verify your configuration.');
console.log('Look for "Using object storage" messages in your app logs.\n');

// Create or update .env file if on Replit
if (isReplit && !hasEnvFile) {
  console.log('📝 Creating .env template file...');

  const envTemplate = `# KCMBC App Configuration
# Created by setup script

# Database (Replit automatically provides this)
DATABASE_URL=

# Session Secret (you can change this)
SESSION_SECRET=your-secure-session-secret-here

# Object Storage Configuration (REQUIRED for persistent uploads)
# Replace "your-bucket-name" with your actual Object Storage bucket name
# PRIVATE_OBJECT_DIR=/your-bucket-name
# PUBLIC_OBJECT_SEARCH_PATHS=/your-bucket-name/public

# Environment
NODE_ENV=production
PORT=5000
`;

  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ Created .env file with template configuration');
  console.log('   Edit this file and uncomment the object storage lines\n');
}