// Gerçek zamanlı mesafe hesaplama testi
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Dünya'nın yarıçapı (metre)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Console log'larından alınan gerçek koordinatlar
console.log('=== Gerçek Zamanlı Konum Testi ===');

// Zeynep'in güncel konumu (console'dan)
const zeynepLat = 41.0124762251865;
const zeynepLng = 29.132805140499276;

// Kerim'in güncel konumu (console'dan)
const kerimLat = 41.01231495253063;
const kerimLng = 29.132682665642967;

console.log('Zeynep konumu:', zeynepLat, zeynepLng);
console.log('Kerim konumu:', kerimLat, kerimLng);

// Mesafe hesapla
const distance = calculateDistance(zeynepLat, zeynepLng, kerimLat, kerimLng);

console.log('Hesaplanan mesafe:', distance, 'metre');
console.log('Yuvarlanmış mesafe:', Math.round(distance), 'metre');

// Koordinat farklarını göster
const latDiff = Math.abs(zeynepLat - kerimLat);
const lngDiff = Math.abs(zeynepLng - kerimLng);

console.log('\nKoordinat farkları:');
console.log('Enlem farkı:', latDiff.toFixed(8), 'derece');
console.log('Boylam farkı:', lngDiff.toFixed(8), 'derece');

// Basit mesafe hesaplama
const latMeters = latDiff * 111000;
const lngMeters = lngDiff * 111000 * Math.cos(zeynepLat * Math.PI / 180);
const simpleDistance = Math.sqrt(latMeters * latMeters + lngMeters * lngMeters);

console.log('\nBasit hesaplama:', Math.round(simpleDistance), 'metre');

// Eğer mesafe 21m'den farklıysa, neden farklı olduğunu göster
if (Math.round(distance) !== 21) {
  console.log('\n⚠️  Mesafe 21m değil! Fark:', Math.round(distance) - 21, 'metre');
  
  // Önceki koordinatlarla karşılaştır
  const oldZeynepLat = 41.01247625;
  const oldZeynepLng = 29.13280513;
  const oldKerimLat = 41.01231496;
  const oldKerimLng = 29.13268266;
  
  const oldDistance = calculateDistance(oldZeynepLat, oldZeynepLng, oldKerimLat, oldKerimLng);
  
  console.log('Önceki mesafe:', Math.round(oldDistance), 'metre');
  console.log('Yeni mesafe:', Math.round(distance), 'metre');
  console.log('Değişim:', Math.round(distance) - Math.round(oldDistance), 'metre');
}
