// Test script to work around quota issues by testing different approaches
// Run with: node scripts/test-quota-workaround.js

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const TEMPLATE_ID = "1hyNyTr57hoCEMHBvK3uqvw_5vXGw3akoLaVNIVkkZKs";
const ITINERARIES_FOLDER = "1yxVbHPxFWKrtpuNql8hbeJQIzFkqlS3f";

async function testQuotaWorkaround() {
  try {
    console.log('🔍 Testing quota workarounds...');
    
    // Load credentials
    const credsPath = path.join(process.cwd(), 'config/credentials.json');
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/presentations'],
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    // Test 1: Try creating a very small file first
    console.log('\n🧪 Test 1: Creating minimal document...');
    try {
      const tinyFile = await drive.files.create({
        requestBody: {
          name: `Tiny Test File ${Date.now()}`,
          parents: [ITINERARIES_FOLDER],
          mimeType: 'application/vnd.google-apps.document'
        },
        media: {
          mimeType: 'text/plain',
          body: 'Test content'
        }
      });
      
      console.log('✅ Tiny file created successfully:', tinyFile.data.id);
      
      // Clean up
      await drive.files.delete({ fileId: tinyFile.data.id });
      console.log('✅ Tiny file deleted');
      
    } catch (error) {
      console.log('❌ Even tiny file creation failed:', error.message);
    }
    
    // Test 2: Check if we can copy a smaller Google Slides template
    console.log('\n🧪 Test 2: Testing with built-in template...');
    try {
      // Try to create a blank presentation instead of copying
      const blankPresentation = await drive.files.create({
        requestBody: {
          name: `Blank Test Presentation ${Date.now()}`,
          parents: [ITINERARIES_FOLDER],
          mimeType: 'application/vnd.google-apps.presentation'
        }
      });
      
      console.log('✅ Blank presentation created:', blankPresentation.data.id);
      console.log(`🔗 URL: https://docs.google.com/presentation/d/${blankPresentation.data.id}/edit`);
      
      // Clean up
      await drive.files.delete({ fileId: blankPresentation.data.id });
      console.log('✅ Blank presentation deleted');
      
      console.log('\n💡 SOLUTION FOUND: We can create blank presentations!');
      console.log('📋 Alternative approach:');
      console.log('1. Create blank presentation in target folder');
      console.log('2. Copy slides from template using Slides API');
      console.log('3. This avoids Drive quota issues with file copying');
      
    } catch (error) {
      console.log('❌ Blank presentation creation failed:', error.message);
    }
    
    // Test 3: Check available storage more thoroughly
    console.log('\n🧪 Test 3: Detailed quota analysis...');
    try {
      const files = await drive.files.list({
        q: `'${ITINERARIES_FOLDER}' in parents`,
        fields: 'files(id,name,size,quotaBytesUsed)'
      });
      
      console.log(`📁 Files in itineraries folder: ${files.data.files?.length || 0}`);
      
      let totalSize = 0;
      files.data.files?.forEach(file => {
        const size = file.size ? parseInt(file.size) : 0;
        totalSize += size;
        if (size > 0) {
          console.log(`  📄 ${file.name}: ${(size / (1024 * 1024)).toFixed(2)} MB`);
        }
      });
      
      console.log(`📊 Total folder size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
      
    } catch (error) {
      console.log('❌ Could not analyze folder contents:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testQuotaWorkaround();