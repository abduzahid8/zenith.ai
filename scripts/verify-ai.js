const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env manualy
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
    console.error('Error: valid Supabase configuration not found in .env');
    process.exit(1);
}

const url = `${SUPABASE_URL}/functions/v1/ai-proxy`;
console.log(`Testing AI Proxy at: ${url}`);

const data = JSON.stringify({
    action: 'sendMessage',
    messages: [{ role: 'user', content: 'Hello, are you working?' }]
});

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`
    }
};

const req = https.request(url, options, (res) => {
    let responseBody = '';

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
            const parsed = JSON.parse(responseBody);
            console.log('Response:', JSON.stringify(parsed, null, 2));
            if (res.statusCode === 200 && parsed.data) {
                console.log('✅ AI Service is working correctly!');
            } else {
                console.error('❌ AI Service failed.');
                if (res.statusCode === 404) {
                    console.error('Reason: Function not found. Please run scripts/deploy-ai.sh');
                } else if (res.statusCode === 500) {
                    console.error('Reason: Internal Server Error. Check Supabase logs or API Key.');
                }
            }
        } catch (e) {
            console.log('Raw Response:', responseBody);
        }
    });
});

req.on('error', (error) => {
    console.error('Request Error:', error);
});

req.write(data);
req.end();
