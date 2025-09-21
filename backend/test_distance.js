// Haversine formülü ile mesafe hesaplama testi
function calculateDistance(lat1, lng1, lat2, lng2) {
  console.log('Input coordinates:');
  console.log('  Lat1:', lat1, 'Lng1:', lng1);
  console.log('  Lat2:', lat2, 'Lng2:', lng2);
  console.log('  Lat1 type:', typeof lat1, 'Lng1 type:', typeof lng1);
  console.log('  Lat2 type:', typeof lat2, 'Lng2 type:', typeof lng2);
  
  // String'leri number'a çevir
  const numLat1 = parseFloat(lat1);
  const numLng1 = parseFloat(lng1);
  const numLat2 = parseFloat(lat2);
  const numLng2 = parseFloat(lng2);
  
  console.log('Converted coordinates:');
  console.log('  Lat1:', numLat1, 'Lng1:', numLng1);
  console.log('  Lat2:', numLat2, 'Lng2:', numLng2);
  
  const R = 6371000; // Dünya'nın yarıçapı (metre)
  const dLat = (numLat2 - numLat1) * Math.PI / 180;
  const dLng = (numLng2 - numLng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(numLat1 * Math.PI / 180) * Math.cos(numLat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  console.log('Calculated distance:', distance, 'meters');
  console.log('Rounded distance:', Math.round(distance), 'meters');
  
  return distance;
}

// Test koordinatları (gerçek verilerden)
const zeynepLat = "41.01247625";
const zeynepLng = "29.13280513";
const kerimLat = "41.01231496";
const kerimLng = "29.13268266";

console.log('=== Distance Test ===');
const distance = calculateDistance(zeynepLat, zeynepLng, kerimLat, kerimLng);
console.log('Final result:', Math.round(distance), 'meters');

// Basit mesafe hesaplama (daha basit formül)
function simpleDistance(lat1, lng1, lat2, lng2) {
  const numLat1 = parseFloat(lat1);
  const numLng1 = parseFloat(lng1);
  const numLat2 = parseFloat(lat2);
  const numLng2 = parseFloat(lng2);
  
  const latDiff = numLat2 - numLat1;
  const lngDiff = numLng2 - numLng1;
  
  // 1 derece ≈ 111km
  const latMeters = latDiff * 111000;
  const lngMeters = lngDiff * 111000 * Math.cos(numLat1 * Math.PI / 180);
  
  const distance = Math.sqrt(latMeters * latMeters + lngMeters * lngMeters);
  
  console.log('Simple calculation:', Math.round(distance), 'meters');
  return distance;
}

console.log('\n=== Simple Distance Test ===');
simpleDistance(zeynepLat, zeynepLng, kerimLat, kerimLng);
