// Test script to check template size and investigate quota issues
// Run with: node scripts/test-template-size.js

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const TEMPLATE_ID = "1hyNyTr57hoCEMHBvK3uqvw_5vXGw3akoLaVNIVkkZKs";
const ITINERARIES_FOLDER = "1yxVbHPxFWKrtpuNql8hbeJQIzFkqlS3f";

async function testTemplateSize() {
  try {
    console.log('🔍 Investigating template size and quota issues...');
    
    // Load credentials
    const credsPath = path.join(process.cwd(), 'config/credentials.json');
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/presentations'],
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    // Get detailed template info
    console.log('\n📊 Template Analysis:');
    const templateInfo = await drive.files.get({ 
      fileId: TEMPLATE_ID,
      fields: 'id,name,size,quotaBytesUsed,parents,createdTime,modifiedTime'
    });
    
    const sizeInMB = templateInfo.data.size ? 
      (parseInt(templateInfo.data.size) / (1024 * 1024)).toFixed(2) : 
      'Unknown';
      
    console.log(`📄 Template: "${templateInfo.data.name}"`);
    console.log(`📏 Size: ${sizeInMB} MB`);
    console.log(`🕐 Created: ${templateInfo.data.createdTime}`);
    console.log(`🕑 Modified: ${templateInfo.data.modifiedTime}`);
    
    // Check drive quota
    console.log('\n💾 Drive Quota Analysis:');
    try {
      const about = await drive.about.get({ fields: 'storageQuota,user' });
      const quota = about.data.storageQuota;
      
      if (quota) {
        const usedGB = quota.usage ? (parseInt(quota.usage) / (1024 * 1024 * 1024)).toFixed(2) : 'Unknown';
        const limitGB = quota.limit ? (parseInt(quota.limit) / (1024 * 1024 * 1024)).toFixed(2) : 'Unlimited';
        
        console.log(`👤 User: ${about.data.user?.emailAddress || 'Service Account'}`);
        console.log(`📊 Used: ${usedGB} GB`);
        console.log(`🎯 Limit: ${limitGB} GB`);
        
        if (quota.usage && quota.limit) {
          const percentUsed = ((parseInt(quota.usage) / parseInt(quota.limit)) * 100).toFixed(1);
          console.log(`📈 Usage: ${percentUsed}%`);
          
          if (percentUsed > 95) {
            console.log('🚨 Drive is nearly full!');
          }
        }
      }
    } catch (quotaError) {
      console.log('⚠️ Could not retrieve quota info (normal for service accounts)');
    }
    
    // Test with a different approach - copy to root first, then move
    console.log('\n🧪 Testing Alternative Copy Strategy...');
    try {
      console.log('📋 Step 1: Copy to Drive root...');
      const rootCopy = await drive.files.copy({
        fileId: TEMPLATE_ID,
        requestBody: {
          name: `TEST - Root Copy (${Date.now()})`,
        },
      });
      
      console.log(`✅ Root copy successful: ${rootCopy.data.id}`);
      
      console.log('📋 Step 2: Move to itineraries folder...');
      const moveResult = await drive.files.update({
        fileId: rootCopy.data.id,
        addParents: ITINERARIES_FOLDER,
        removeParents: 'root',
        fields: 'id,parents'
      });
      
      console.log(`✅ Move successful: ${moveResult.data.id}`);
      console.log(`🔗 URL: https://docs.google.com/presentation/d/${moveResult.data.id}/edit`);
      
      // Clean up
      console.log('🧹 Cleaning up test file...');
      await drive.files.delete({ fileId: rootCopy.data.id });
      console.log('✅ Test file deleted');
      
      console.log('\n🎉 Alternative strategy works! Will use copy-then-move approach.');
      
    } catch (altError) {
      console.error('❌ Alternative strategy failed:', altError.message);
      
      // Check if it's specifically about the template being too large
      if (altError.message.includes('quota') || altError.message.includes('storage')) {
        console.log('\n💡 Recommendations:');
        console.log('1. Template is 13.4MB - consider optimizing images');
        console.log('2. Remove unnecessary slides or compress images');
        console.log('3. Use lower resolution images (Slides only needs ~1920x1080)');
        console.log('4. Consider creating a lighter template for testing');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testTemplateSize();