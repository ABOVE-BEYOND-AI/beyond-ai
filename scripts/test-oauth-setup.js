// Simple test page to verify OAuth setup
// This would be a React component, but showing the logic here

console.log('OAuth Setup Verification:');
console.log('1. Check if environment variables are set...');

const requiredVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET', 
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL'
];

let allSet = true;
requiredVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`✅ ${varName}: Set`);
  } else {
    console.log(`❌ ${varName}: Missing`);
    allSet = false;
  }
});

if (allSet) {
  console.log('\n🎉 All OAuth environment variables are configured!');
  console.log('\nNext steps:');
  console.log('1. Add the OAuth credentials to .env.local');
  console.log('2. Update your itinerary page to include Google sign-in');
  console.log('3. Test the /api/slides-oauth endpoint');
} else {
  console.log('\n❌ Please set the missing environment variables');
}

export {};