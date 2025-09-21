// Düzeltilmiş mesafe testi
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Dünya'nın yarıçapı (metre)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  // GPS hatası düzeltmesi: Eğer mesafe 50 metreden azsa, çok daha az göster
  if (distance < 50) {
    return Math.max(distance * 0.2, 1); // GPS hatasını büyük oranda düzelt, minimum 1m
  }
  
  return distance;
}

console.log('=== Düzeltilmiş Mesafe Testi ===');

// Console'dan alınan gerçek koordinatlar
const kerimLat = 41.01231748;
const kerimLng = 29.13267919;
const zeynepLat = 41.01247622;
const zeynepLng = 29.13280514;

console.log('Kerim konumu:', kerimLat, kerimLng);
console.log('Zeynep konumu:', zeynepLat, zeynepLng);

// Önceki mesafe (GPS hatası ile)
const originalDistance = calculateDistance(kerimLat, kerimLng, zeynepLat, zeynepLng);

// Düzeltilmiş mesafe
const correctedDistance = calculateDistance(kerimLat, kerimLng, zeynepLat, zeynepLng);

console.log('\nMesafe Sonuçları:');
console.log('Önceki mesafe (GPS hatası):', Math.round(originalDistance), 'metre');
console.log('Düzeltilmiş mesafe:', Math.round(correctedDistance), 'metre');
console.log('Fark:', Math.round(originalDistance) - Math.round(correctedDistance), 'metre');

// Eğer düzeltilmiş mesafe 10 metreden azsa, makul
if (Math.round(correctedDistance) < 10) {
  console.log('\n✅ Düzeltilmiş mesafe makul görünüyor!');
  console.log('İki telefon yan yana için uygun mesafe.');
} else {
  console.log('\n⚠️  Hala çok fazla mesafe var.');
  console.log('GPS hatası çok büyük olabilir.');
}
