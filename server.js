const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const config = {
    clientId: '9ygysj744ynkj8meey5c',
    clientSecret: '0bfee4b2de2345aea41ee56d8e516fbf',
    deviceId: 'bf43693c4842500a39o05g',
    baseUrl: 'https://openapi.tuyaeu.com',
    region: 'eu'
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'smartplug-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Global token storage
let accessToken = null;
let tokenExpiry = null;

// Mock data for energy consumption (replace with real data storage later)
let energyData = {
    daily: [2.1, 1.8, 2.3, 1.9, 2.5, 2.0, 1.7],
    weekly: [14.2, 16.8, 13.9, 15.4],
    monthly: [65.3, 58.9, 72.1]
};

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session.authenticated) {
        next();
    } else {
        res.status(401).json({ error: 'Authentication required' });
    }
};

// NEW Tuya API signature helper functions (post June 30, 2021)
function generateNewSignature(clientId, timestamp, nonce, stringToSign, clientSecret, accessToken = null) {
    // For token requests: client_id + t + nonce + stringToSign
    // For authenticated requests: client_id + access_token + t + nonce + stringToSign
    let str;
    if (accessToken) {
        str = clientId + accessToken + timestamp + nonce + stringToSign;
    } else {
        str = clientId + timestamp + nonce + stringToSign;
    }
    
    const signature = crypto.createHmac('sha256', clientSecret).update(str, 'utf8').digest('hex').toUpperCase();
    
    // Debug logging
    console.log('NEW Signature generation debug:');
    console.log('- clientId:', clientId);
    console.log('- accessToken:', accessToken ? 'present' : 'none');
    console.log('- timestamp:', timestamp);
    console.log('- nonce:', nonce);
    console.log('- stringToSign:', JSON.stringify(stringToSign));
    console.log('- concatenated string:', JSON.stringify(str));
    console.log('- signature:', signature);
    
    return signature;
}

function buildStringToSign(method, contentSha256, headers, url) {
    // New format: HTTPMethod + "\n" + Content-SHA256 + "\n" + Headers + "\n" + Url
    return method + '\n' + contentSha256 + '\n' + headers + '\n' + url;
}

async function getTuyaToken() {
    try {
        const timestamp = Date.now().toString();
        const nonce = crypto.randomBytes(16).toString('hex');
        
        // NEW signature format for token requests
        const method = 'GET';
        const contentSha256 = crypto.createHash('sha256').update('', 'utf8').digest('hex'); // Empty body
        const headers = ''; // No custom headers for token request
        const url = '/v1.0/token?grant_type=1';
        
        const stringToSign = buildStringToSign(method, contentSha256, headers, url);
        
        console.log('\n=== NEW TOKEN REQUEST FORMAT ===');
        const signature = generateNewSignature(config.clientId, timestamp, nonce, stringToSign, config.clientSecret);
        
        const requestHeaders = {
            'client_id': config.clientId,
            't': timestamp,
            'sign_method': 'HMAC-SHA256',
            'nonce': nonce,
            'sign': signature
        };
        
        console.log('Final headers:', requestHeaders);
        console.log('Request URL:', `${config.baseUrl}/v1.0/token?grant_type=1`);
        
        const response = await axios.get(`${config.baseUrl}/v1.0/token?grant_type=1`, { headers: requestHeaders });
        
        if (response.data.success) {
            accessToken = response.data.result.access_token;
            tokenExpiry = Date.now() + (response.data.result.expire_time * 1000);
            console.log('✓ Token obtained successfully, expires in:', response.data.result.expire_time, 'seconds');
            return accessToken;
        } else {
            console.error('Token request failed:', response.data);
            throw new Error('Failed to get token: ' + response.data.msg);
        }
    } catch (error) {
        console.error('Error getting Tuya token:', error.response?.data || error.message);
        throw error;
    }
}

async function makeAuthenticatedRequest(method, endpoint, data = null) {
    try {
        // Check if token needs refresh
        if (!accessToken || Date.now() >= tokenExpiry - 300000) { // Refresh 5 minutes before expiry
            console.log('Token expired or missing, refreshing...');
            await getTuyaToken();
        }
        
        const timestamp = Date.now().toString();
        const nonce = crypto.randomBytes(16).toString('hex');
        
        // NEW signature format for authenticated requests
        let contentSha256 = crypto.createHash('sha256').update('', 'utf8').digest('hex'); // Default empty body
        let requestData = null;
        
        if (data && (method === 'POST' || method === 'PUT')) {
            requestData = JSON.stringify(data);
            contentSha256 = crypto.createHash('sha256').update(requestData, 'utf8').digest('hex');
        }
        
        const headers = ''; // No custom headers for basic requests
        const stringToSign = buildStringToSign(method, contentSha256, headers, endpoint);
        
        const signature = generateNewSignature(config.clientId, timestamp, nonce, stringToSign, config.clientSecret, accessToken);
        
        const requestHeaders = {
            'client_id': config.clientId,
            'access_token': accessToken,
            't': timestamp,
            'sign_method': 'HMAC-SHA256',
            'nonce': nonce,
            'sign': signature,
            'Content-Type': 'application/json'
        };
        
        const requestConfig = {
            method,
            url: `${config.baseUrl}${endpoint}`,
            headers: requestHeaders,
            timeout: 10000 // 10 second timeout
        };
        
        if (requestData) {
            requestConfig.data = requestData;
        }
        
        console.log(`Making ${method} request to ${endpoint}`);
        const response = await axios(requestConfig);
        
        if (!response.data.success) {
            console.warn('API request returned error:', response.data);
        }
        
        return response.data;
    } catch (error) {
        console.error('API request error:', error.response?.data || error.message);
        
        // If token is invalid, clear it and retry once
        if (error.response?.data?.code === 1010) {
            console.log('Token invalid, clearing and retrying...');
            accessToken = null;
            tokenExpiry = null;
            // Don't retry immediately to avoid infinite recursion
        }
        
        throw error;
    }
}

// Validate configuration
function validateConfig() {
    const issues = [];
    
    if (!config.clientId || config.clientId.length < 10) {
        issues.push('Invalid or missing clientId');
    }
    
    if (!config.clientSecret || config.clientSecret.length < 10) {
        issues.push('Invalid or missing clientSecret');
    }
    
    if (!config.deviceId || config.deviceId.length < 10) {
        issues.push('Invalid or missing deviceId');
    }
    
    if (!config.baseUrl || !config.baseUrl.startsWith('https://')) {
        issues.push('Invalid baseUrl');
    }
    
    if (issues.length > 0) {
        console.error('Configuration issues found:');
        issues.forEach(issue => console.error('- ' + issue));
        return false;
    }
    
    console.log('✓ Configuration validated');
    return true;
}

// Test API connection
async function testConnection() {
    try {
        console.log('\n=== TESTING TUYA API CONNECTION ===');
        
        if (!validateConfig()) {
            throw new Error('Configuration validation failed');
        }
        
        await getTuyaToken();
        console.log('✓ Successfully connected to Tuya API');
        
        // Test device info request
        const deviceInfo = await makeAuthenticatedRequest('GET', `/v1.0/devices/${config.deviceId}`);
        if (deviceInfo.success) {
            console.log('✓ Device found:', deviceInfo.result.name);
        } else {
            console.warn('⚠ Device request failed:', deviceInfo.msg);
        }
    } catch (error) {
        console.error('✗ Connection test failed:', error.message);
        console.log('\n=== TROUBLESHOOTING TIPS ===');
        console.log('1. Verify your credentials in Tuya IoT Platform');
        console.log('2. Ensure device is linked to your project');
        console.log('3. Check if your IP is whitelisted (if required)');
        console.log('4. Verify the base URL matches your region');
        console.log('5. Make sure system time is synchronized');
    }
}

// Routes

// Login page
app.get('/login', (req, res) => {
    const errorParam = req.query.error;
    const errorMessage = errorParam ? '<div class="error">Invalid username or password</div>' : '';
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SmartPlug Login</title>
            <style>
                body { font-family: Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                .login-container { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
                .login-container h2 { text-align: center; color: #333; margin-bottom: 1.5rem; }
                .form-group { margin-bottom: 1rem; }
                .form-group label { display: block; margin-bottom: 0.5rem; color: #555; }
                .form-group input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
                .btn { width: 100%; padding: 0.75rem; background: #007bff; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
                .btn:hover { background: #0056b3; }
                .error { color: #dc3545; text-align: center; margin-top: 1rem; padding: 0.5rem; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="login-container">
                <h2>SmartPlug Dashboard</h2>
                <form action="/login" method="POST">
                    <div class="form-group">
                        <label for="username">Username:</label>
                        <input type="text" id="username" name="username" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Password:</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    <button type="submit" class="btn">Login</button>
                </form>
                ${errorMessage}
            </div>
        </body>
        </html>
    `);
});

// Login POST
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    // Simple authentication (replace with proper user management)
    if (username === 'admin' && password === 'smartplug123') {
        req.session.authenticated = true;
        res.redirect('/');
    } else {
        res.redirect('/login?error=1');
    }
});

// Logout
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Main dashboard (protected)
app.get('/', (req, res) => {
    if (!req.session.authenticated) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes

// Manual signature verification endpoint for debugging
app.get('/api/debug-signature', requireAuth, (req, res) => {
    try {
        const timestamp = Date.now().toString();
        const nonce = crypto.randomBytes(16).toString('hex');
        
        // Test different signature formats
        const formats = [
            {
                name: 'Format 1: Just the path',
                stringToSign: '/v1.0/token?grant_type=1'
            },
            {
                name: 'Format 2: HTTP method + path',
                stringToSign: 'GET\n\n\n/v1.0/token?grant_type=1'
            },
            {
                name: 'Format 3: Complete HTTP signature',
                stringToSign: 'GET\n\napplication/json\n/v1.0/token?grant_type=1'
            }
        ];
        
        const results = formats.map(format => {
            const str = config.clientId + timestamp + nonce + format.stringToSign;
            const signature = crypto.createHmac('sha256', config.clientSecret)
                .update(str, 'utf8')
                .digest('hex')
                .toUpperCase();
            
            return {
                ...format,
                concatenatedString: str,
                signature: signature
            };
        });
        
        res.json({
            success: true,
            timestamp,
            nonce,
            clientId: config.clientId,
            clientSecretLength: config.clientSecret.length,
            formats: results
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test connection endpoint
app.get('/api/test-connection', requireAuth, async (req, res) => {
    try {
        await getTuyaToken();
        const deviceInfo = await makeAuthenticatedRequest('GET', `/v1.0/devices/${config.deviceId}`);
        
        res.json({
            success: true,
            message: 'Connection successful',
            device: deviceInfo.result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});

// Get device status
app.get('/api/device/status', requireAuth, async (req, res) => {
    try {
        const result = await makeAuthenticatedRequest('GET', `/v1.0/devices/${config.deviceId}/status`);
        
        if (result.success) {
            // Parse the status data
            const statusData = {};
            result.result.forEach(item => {
                statusData[item.code] = item.value;
            });
            
            res.json({
                success: true,
                data: {
                    online: statusData.switch_1 !== undefined,
                    power_switch: statusData.switch_1 || false,
                    current: statusData.cur_current || 0,
                    power: statusData.cur_power || 0,
                    voltage: statusData.cur_voltage || 0,
                    totalEnergy: statusData.add_ele || 0,
                    ...statusData
                }
            });
        } else {
            res.json({ success: false, error: result.msg });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.response?.data
        });
    }
});

// Control device
app.post('/api/device/control', requireAuth, async (req, res) => {
    try {
        const { command, value } = req.body;
        
        if (!command) {
            return res.status(400).json({ success: false, error: 'Command is required' });
        }
        
        const commands = [{
            code: command,
            value: value
        }];
        
        const result = await makeAuthenticatedRequest('POST', `/v1.0/devices/${config.deviceId}/commands`, { commands });
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.response?.data
        });
    }
});

// Get device info
app.get('/api/device/info', requireAuth, async (req, res) => {
    try {
        const result = await makeAuthenticatedRequest('GET', `/v1.0/devices/${config.deviceId}`);
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.response?.data
        });
    }
});

// Update device name
app.post('/api/device/rename', requireAuth, async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, error: 'Name is required' });
        }
        
        const result = await makeAuthenticatedRequest('PUT', `/v1.0/devices/${config.deviceId}`, { name });
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.response?.data
        });
    }
});

// Get energy data (mock data for now)
app.get('/api/energy/:period', requireAuth, (req, res) => {
    const { period } = req.params;
    
    if (energyData[period]) {
        res.json({
            success: true,
            data: energyData[period],
            labels: period === 'daily' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] :
                   period === 'weekly' ? ['Week 1', 'Week 2', 'Week 3', 'Week 4'] :
                   ['Jan', 'Feb', 'Mar']
        });
    } else {
        res.status(400).json({ success: false, error: 'Invalid period' });
    }
});

// Schedule management (mock implementation)
let schedules = [];

app.get('/api/schedules', requireAuth, (req, res) => {
    res.json({ success: true, data: schedules });
});

app.post('/api/schedules', requireAuth, (req, res) => {
    const schedule = {
        id: Date.now(),
        ...req.body,
        created: new Date()
    };
    schedules.push(schedule);
    res.json({ success: true, data: schedule });
});

app.delete('/api/schedules/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    schedules = schedules.filter(s => s.id !== id);
    res.json({ success: true });
});

// Timer management (basic implementation)
let timers = [];

app.post('/api/timer', requireAuth, (req, res) => {
    const { minutes, action } = req.body;
    
    if (!minutes || !action) {
        return res.status(400).json({ success: false, error: 'Minutes and action are required' });
    }
    
    const timer = {
        id: Date.now(),
        minutes,
        action,
        startTime: new Date(),
        endTime: new Date(Date.now() + minutes * 60 * 1000)
    };
    
    timers.push(timer);
    
    // Set actual timer
    setTimeout(async () => {
        try {
            await makeAuthenticatedRequest('POST', `/v1.0/devices/${config.deviceId}/commands`, {
                commands: [{ code: 'switch_1', value: action === 'on' }]
            });
            console.log(`Timer executed: ${action} after ${minutes} minutes`);
        } catch (error) {
            console.error('Timer execution failed:', error);
        }
        
        // Remove timer from list
        timers = timers.filter(t => t.id !== timer.id);
    }, minutes * 60 * 1000);
    
    res.json({ success: true, data: timer });
});

app.get('/api/timers', requireAuth, (req, res) => {
    res.json({ success: true, data: timers });
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
    console.log(`SmartPlug Dashboard server running on port ${PORT}`);
    console.log(`Access the dashboard at: http://localhost:${PORT}`);
    console.log('Default login: admin / smartplug123');
    
    // Test connection on startup
    setTimeout(testConnection, 1000);
});

module.exports = app;
