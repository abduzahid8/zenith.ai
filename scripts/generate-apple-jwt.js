const jwt = require('jsonwebtoken');
const fs = require('fs');

// Replace these with your actual values from Apple Developer Portal:
const TEAM_ID = '4CBV6A6D4G';           // Found at https://developer.apple.com/account
const KEY_ID = 'D7N866VK8L';             // The Key ID from your private key
const SERVICE_ID = 'com.zenyth.ai.signin'; // The Service ID you created

// Read the .p8 private key file you downloaded from Apple
// The file is named: AuthKey_D7N866VK8L.p8
const privateKey = fs.readFileSync('./AuthKey_D7N866VK8L.p8', 'utf8');

// Create the JWT token
const token = jwt.sign(
  {
    iss: TEAM_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (15777000), // 6 months
    aud: 'https://appleid.apple.com',
    sub: SERVICE_ID,
  },
  privateKey,
  {
    algorithm: 'ES256',
    header: {
      kid: KEY_ID,
    },
  }
);

console.log('\n=== SUPABASE APPLE SECRET KEY ===\n');
console.log(token);
console.log('\n=== Copy this entire token and paste into Supabase ===\n');
