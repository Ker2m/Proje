const https = require('https');
const http = require('http');

async function testNearbyUsersAPI() {
  try {
    console.log('🧪 Testing Nearby Users API...');
    
    // Önce login ol
    const loginData = await makeRequest('POST', '/api/auth/login', {
      email: 'zeynep57sena@gmail.com',
      password: '123456' // Zeynep şifresi
    });
    
    if (!loginData.success) {
      console.log('❌ Login failed:', loginData.message);
      return;
    }
    
    console.log('✅ Login successful');
    const token = loginData.data.token;
    
    // Yakındaki kullanıcıları iste
    const nearbyData = await makeRequest('GET', '/api/location/nearby?radius=10000&limit=100', null, token);
    
    console.log('📍 Nearby Users API Response:');
    console.log(JSON.stringify(nearbyData, null, 2));
    
    if (nearbyData.success && nearbyData.data.users.length > 0) {
      console.log(`✅ Found ${nearbyData.data.users.length} nearby users:`);
      nearbyData.data.users.forEach(user => {
        console.log(`   - ${user.firstName} ${user.lastName} (${Math.round(user.distance)}m away)`);
      });
    } else {
      console.log('❌ No nearby users found');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// HTTP request helper function
function makeRequest(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

testNearbyUsersAPI();
