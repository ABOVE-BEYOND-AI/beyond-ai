// Quick test script to verify Google authentication is working
// Run with: node scripts/test-google-auth.js

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function testAuth() {
  try {
    console.log('🔍 Testing Google authentication...');
    
    // Load credentials
    const credsPath = path.join(process.cwd(), 'config/credentials.json');
    
    if (!fs.existsSync(credsPath)) {
      throw new Error('credentials.json not found at: ' + credsPath);
    }
    
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    console.log('✅ Credentials loaded');
    console.log('📧 Service account email:', creds.client_email);
    
    // Test auth
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/presentations'],
    });
    
    const slides = google.slides({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });
    
    // Test template access
    const templateId = '1hyNyTr57hoCEMHBvK3uqvw_5vXGw3akoLaVNIVkkZKs';
    console.log('🔍 Testing access to template:', templateId);
    
    const presentation = await slides.presentations.get({ presentationId: templateId });
    console.log('✅ Template accessible!');
    console.log('📋 Template title:', presentation.data.title);
    console.log('📊 Slides count:', presentation.data.slides?.length || 0);
    
    console.log('\n🎉 All tests passed! Google authentication is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('Permission denied')) {
      console.log('\n💡 Solution: Make sure you shared the template with your service account email:');
      console.log('   itinerary-creator-slide-creato@itinerary-builder-468012.iam.gserviceaccount.com');
    }
    
    process.exit(1);
  }
}

testAuth();