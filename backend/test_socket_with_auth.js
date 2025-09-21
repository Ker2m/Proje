const io = require('socket.io-client');
const http = require('http');

// HTTP request helper function
function makeRequest(method, path, data) {
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

async function testSocketWithAuth() {
  try {
    console.log('🧪 Testing Socket.io with Authentication...');
    
    // Önce login ol
    const loginData = await makeRequest('POST', '/api/auth/login', {
      email: 'zeynep57sena@gmail.com',
      password: '123456'
    });
    
    if (!loginData.success) {
      console.log('❌ Login failed:', loginData.message);
      return;
    }
    
    console.log('✅ Login successful');
    const token = loginData.data.token;
    
    // Socket bağlantısı kur
    const socket = io('http://localhost:3001', {
      auth: {
        token: token
      }
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      
      // Yakındaki kullanıcıları iste
      console.log('📍 Requesting nearby users...');
      socket.emit('request_nearby_users', {
        radius: 10000,
        limit: 100
      });
    });

    socket.on('nearby_users_list', (data) => {
      console.log('📍 Nearby users received:', data);
      if (data.success && data.users) {
        console.log(`✅ Found ${data.users.length} nearby users:`);
        data.users.forEach(user => {
          console.log(`   - ${user.firstName} ${user.lastName} (${user.distance}m away)`);
        });
      } else {
        console.log('❌ No users found or error');
      }
      socket.disconnect();
    });

    socket.on('nearby_users_error', (error) => {
      console.error('❌ Nearby users error:', error);
      socket.disconnect();
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
    });

    // 10 saniye sonra bağlantıyı kapat
    setTimeout(() => {
      if (socket.connected) {
        console.log('⏰ Timeout, disconnecting...');
        socket.disconnect();
      }
    }, 10000);

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testSocketWithAuth();
