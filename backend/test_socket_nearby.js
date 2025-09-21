const io = require('socket.io-client');

async function testSocketNearbyUsers() {
  try {
    console.log('🧪 Testing Socket.io Nearby Users...');
    
    // Socket bağlantısı kur
    const socket = io('http://localhost:3001', {
      auth: {
        token: 'test-token' // Geçici token
      }
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      
      // Yakındaki kullanıcıları iste
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
        socket.disconnect();
      }
    }, 10000);

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testSocketNearbyUsers();
