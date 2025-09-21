// Gerçek mesafe testi - iki telefon yan yana
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

// Console'dan alınan gerçek koordinatlar
console.log('=== İki Telefon Yan Yana Mesafe Testi ===');

// Kerim'in konumu
const kerimLat = 41.01231748;
const kerimLng = 29.13267919;

// Zeynep'in konumu  
const zeynepLat = 41.01247622;
const zeynepLng = 29.13280514;

console.log('Kerim konumu:', kerimLat, kerimLng);
console.log('Zeynep konumu:', zeynepLat, zeynepLng);

// Koordinat farkları
const latDiff = Math.abs(zeynepLat - kerimLat);
const lngDiff = Math.abs(zeynepLng - kerimLng);

console.log('\nKoordinat farkları:');
console.log('Enlem farkı:', latDiff.toFixed(8), 'derece');
console.log('Boylam farkı:', lngDiff.toFixed(8), 'derece');

// Basit mesafe hesaplama (daha doğru olabilir)
const latMeters = latDiff * 111000; // 1 derece = 111km
const lngMeters = lngDiff * 111000 * Math.cos(zeynepLat * Math.PI / 180);
const simpleDistance = Math.sqrt(latMeters * latMeters + lngMeters * lngMeters);

console.log('\nBasit hesaplama:');
console.log('Enlem farkı (metre):', latMeters.toFixed(2));
console.log('Boylam farkı (metre):', lngMeters.toFixed(2));
console.log('Toplam mesafe:', Math.round(simpleDistance), 'metre');

// Haversine hesaplama
const haversineDistance = calculateDistance(kerimLat, kerimLng, zeynepLat, zeynepLng);

console.log('\nHaversine hesaplama:', Math.round(haversineDistance), 'metre');

// Fark
console.log('\nFark:', Math.round(haversineDistance) - Math.round(simpleDistance), 'metre');

// Eğer mesafe 5 metreden fazlaysa, GPS hatası olabilir
if (Math.round(simpleDistance) > 5) {
  console.log('\n⚠️  Mesafe 5 metreden fazla! GPS hatası olabilir.');
  console.log('İki telefon yan yana ise mesafe 1-3 metre olmalı.');
} else {
  console.log('\n✅ Mesafe makul görünüyor.');
}

// Google Maps ile karşılaştırma için
console.log('\nGoogle Maps ile test etmek için:');
console.log(`https://www.google.com/maps/dir/${kerimLat},${kerimLng}/${zeynepLat},${zeynepLng}`);
