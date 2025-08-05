// Test script to verify Google Drive folder access and permissions
// Run with: node scripts/test-folder-access.js

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Folder IDs from your setup
const DRIVE_FOLDERS = {
  MAIN: "1HFHEMUiPKRnKz2NMftVeg__xXfcsV1s5",
  TEMPLATES: "1xe6aI9hBczHcxLzrFqjBOBn28UKLyHD-", 
  ITINERARIES: "1yxVbHPxFWKrtpuNql8hbeJQIzFkqlS3f"
};

const TEMPLATE_ID = "1hyNyTr57hoCEMHBvK3uqvw_5vXGw3akoLaVNIVkkZKs";

async function testFolderAccess() {
  try {
    console.log('🔍 Testing Google Drive folder access...');
    
    // Load credentials
    const credsPath = path.join(process.cwd(), 'config/credentials.json');
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/presentations'],
    });
    
    const drive = google.drive({ version: 'v3', auth });
    const slides = google.slides({ version: 'v1', auth });
    
    console.log('✅ Authentication successful');
    
    // Test 1: Check main folder access
    console.log('\n📁 Testing Main Folder Access...');
    try {
      const mainFolder = await drive.files.get({ 
        fileId: DRIVE_FOLDERS.MAIN,
        fields: 'id,name,permissions'
      });
      console.log(`✅ Main folder accessible: "${mainFolder.data.name}"`);
    } catch (error) {
      console.error('❌ Cannot access main folder:', error.message);
      return;
    }
    
    // Test 2: Check templates folder access
    console.log('\n📂 Testing Templates Folder Access...');
    try {
      const templatesFolder = await drive.files.get({ 
        fileId: DRIVE_FOLDERS.TEMPLATES,
        fields: 'id,name'
      });
      console.log(`✅ Templates folder accessible: "${templatesFolder.data.name}"`);
    } catch (error) {
      console.error('❌ Cannot access templates folder:', error.message);
      return;
    }
    
    // Test 3: Check itineraries folder access
    console.log('\n📋 Testing Itineraries Folder Access...');
    try {
      const itinerariesFolder = await drive.files.get({ 
        fileId: DRIVE_FOLDERS.ITINERARIES,
        fields: 'id,name'
      });
      console.log(`✅ Itineraries folder accessible: "${itinerariesFolder.data.name}"`);
    } catch (error) {
      console.error('❌ Cannot access itineraries folder:', error.message);
      return;
    }
    
    // Test 4: Check template file access
    console.log('\n📄 Testing Template File Access...');
    try {
      const template = await slides.presentations.get({ 
        presentationId: TEMPLATE_ID
      });
      console.log(`✅ Template accessible: "${template.data.title}"`);
      console.log(`📊 Template has ${template.data.slides?.length || 0} slides`);
    } catch (error) {
      console.error('❌ Cannot access template file:', error.message);
      return;
    }
    
    // Test 5: Test creating a file in the itineraries folder
    console.log('\n🧪 Testing File Creation in Itineraries Folder...');
    try {
      const testCopy = await drive.files.copy({
        fileId: TEMPLATE_ID,
        requestBody: {
          name: `TEST - Folder Access Verification (${new Date().toISOString().split('T')[0]})`,
          parents: [DRIVE_FOLDERS.ITINERARIES],
        },
      });
      
      console.log(`✅ Test file created successfully: ${testCopy.data.id}`);
      console.log(`🔗 URL: https://docs.google.com/presentation/d/${testCopy.data.id}/edit`);
      
      // Clean up the test file
      console.log('🧹 Cleaning up test file...');
      await drive.files.delete({ fileId: testCopy.data.id });
      console.log('✅ Test file deleted');
      
    } catch (error) {
      console.error('❌ Cannot create file in itineraries folder:', error.message);
      return;
    }
    
    console.log('\n🎉 All tests passed! Your folder structure is ready for slides generation.');
    console.log('\n📋 Summary:');
    console.log('✅ Service account can access all folders');
    console.log('✅ Template file is accessible and readable');
    console.log('✅ Can create new presentations in the itineraries folder');
    console.log('✅ Ready for end-to-end testing!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testFolderAccess();