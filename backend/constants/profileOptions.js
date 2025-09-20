// Profil seçenekleri ve önceden tanımlanmış listeler

const INTERESTS = [
  // Spor ve Fitness
  'Futbol', 'Basketbol', 'Voleybol', 'Tenis', 'Yüzme', 'Koşu', 'Bisiklet', 'Fitness',
  'Yoga', 'Pilates', 'Dans', 'Boks', 'Güreş', 'Kayak', 'Snowboard', 'Sörf',
  
  // Sanat ve Kültür
  'Müzik', 'Resim', 'Heykel', 'Fotoğrafçılık', 'Sinema', 'Tiyatro', 'Opera', 'Bale',
  'Edebiyat', 'Şiir', 'Müzeler', 'Sergiler', 'Konserler', 'Festivaller',
  
  // Teknoloji ve Bilim
  'Programlama', 'Yapay Zeka', 'Robotik', 'Uzay', 'Astronomi', 'Bilim', 'Matematik',
  'Elektronik', 'Oyun Geliştirme', 'Web Tasarım', 'Mobil Uygulama',
  
  // Doğa ve Çevre
  'Dağcılık', 'Kampçılık', 'Doğa Yürüyüşü', 'Bahçıvanlık', 'Çevre Koruma', 'Hayvan Sevgisi',
  'Balıkçılık', 'Avcılık', 'Botanik', 'Ornitoloji',
  
  // Seyahat ve Macera
  'Seyahat', 'Backpacking', 'Kültürel Turizm', 'Gastronomi Turizmi', 'Adventure Travel',
  'Road Trip', 'Dünya Turu', 'Yerel Keşifler',
  
  // Yemek ve İçecek
  'Yemek Yapma', 'Pastacılık', 'Kahve', 'Çay', 'Şarap', 'Kokteyl', 'Gastronomi',
  'Vegan Beslenme', 'Sağlıklı Beslenme', 'Geleneksel Mutfak',
  
  // Eğlence ve Sosyal
  'Parti', 'Sosyal Etkinlikler', 'Networking', 'Topluluk Çalışması', 'Gönüllülük',
  'Sosyal Sorumluluk', 'Hayır İşleri',
  
  // Hobiler ve El Sanatları
  'Örgü', 'Dikiş', 'El Sanatları', 'Ahşap İşçiliği', 'Seramik', 'Takı Tasarımı',
  'Origami', 'Maket', 'Modelleme', 'Koleksiyonculuk',
  
  // Oyun ve Eğlence
  'Video Oyunları', 'Board Games', 'Puzzle', 'Satranç', 'Kart Oyunları', 'E-spor',
  'Masa Oyunları', 'Rol Yapma Oyunları',
  
  // Eğitim ve Gelişim
  'Okuma', 'Öğrenme', 'Dil Öğrenme', 'Kurslar', 'Sertifikalar', 'Kişisel Gelişim',
  'Motivasyon', 'Liderlik', 'Girişimcilik'
];

const PERSONALITY_TRAITS = [
  // Sosyal Özellikler
  'Dışa Dönük', 'İçe Dönük', 'Sosyal', 'Çekingen', 'Lider', 'Takım Oyuncusu',
  'Bağımsız', 'İşbirlikçi', 'Empatik', 'Anlayışlı',
  
  // Duygusal Özellikler
  'Pozitif', 'Optimist', 'Realist', 'Pesimist', 'Sakin', 'Heyecanlı', 'Romantik',
  'Pratik', 'Duygusal', 'Mantıklı',
  
  // Aktivite Tercihleri
  'Aktif', 'Dinamik', 'Sakin', 'Rahat', 'Aventür', 'Güvenli', 'Spontan',
  'Planlı', 'Organize', 'Esnek',
  
  // İletişim
  'İyi Dinleyici', 'İyi Konuşmacı', 'Humorlu', 'Ciddi', 'Samimi', 'Resmi',
  'Direkt', 'Diplomatik', 'Açık Sözlü', 'Dikkatli',
  
  // Yaşam Tarzı
  'Minimalist', 'Lüks Düşkünü', 'Çevre Dostu', 'Teknoloji Tutkunu', 'Geleneksel',
  'Modern', 'Yaratıcı', 'Analitik', 'Sanatsever', 'Sporsever'
];

const LANGUAGES = [
  'Türkçe', 'İngilizce', 'Almanca', 'Fransızca', 'İspanyolca', 'İtalyanca',
  'Rusça', 'Arapça', 'Farsça', 'Çince', 'Japonca', 'Korece', 'Portekizce',
  'Hollandaca', 'İsveççe', 'Norveççe', 'Danca', 'Fince', 'Polonya Dili',
  'Çekçe', 'Macarca', 'Rumence', 'Bulgarca', 'Yunanca', 'İbranice', 'Hintçe'
];

const RELATIONSHIP_STATUS = [
  'Bekar',
  'İlişkide',
  'Evli',
  'Ayrılmış',
  'Boşanmış',
  'Dul',
  'Karmaşık',
  'Belirtmek İstemiyorum'
];

const LOOKING_FOR = [
  'Arkadaşlık',
  'Ciddi İlişki',
  'Evlilik',
  'Sadece Sohbet',
  'Sosyal Etkinlikler',
  'İş Ortaklığı',
  'Hobi Arkadaşlığı',
  'Spor Partneri',
  'Seyahat Arkadaşı',
  'Belirtmek İstemiyorum'
];

const LIFESTYLE_PREFERENCES = {
  smoking: ['Sigara İçiyor', 'Sigara İçmiyor', 'Sosyal İçici', 'Belirtmek İstemiyorum'],
  drinking: ['Alkol İçiyor', 'Alkol İçmiyor', 'Sosyal İçici', 'Belirtmek İstemiyorum'],
  exercise: ['Düzenli Spor Yapar', 'Ara Sıra Spor Yapar', 'Spor Yapmaz', 'Belirtmek İstemiyorum'],
  diet: ['Normal Beslenme', 'Vejetaryen', 'Vegan', 'Glutensiz', 'Ketojenik', 'Belirtmek İstemiyorum'],
  sleepSchedule: ['Erken Yatar', 'Geç Yatar', 'Düzensiz', 'Belirtmek İstemiyorum'],
  socialMedia: ['Aktif Kullanır', 'Az Kullanır', 'Kullanmaz', 'Belirtmek İstemiyorum']
};

const OCCUPATIONS = [
  // Teknoloji
  'Yazılım Geliştirici', 'Web Tasarımcı', 'Sistem Yöneticisi', 'Veri Analisti',
  'Siber Güvenlik Uzmanı', 'UI/UX Tasarımcı', 'DevOps Mühendisi', 'Mobil Uygulama Geliştirici',
  
  // Sağlık
  'Doktor', 'Hemşire', 'Eczacı', 'Diş Hekimi', 'Psikolog', 'Fizyoterapist',
  'Beslenme Uzmanı', 'Veteriner',
  
  // Eğitim
  'Öğretmen', 'Profesör', 'Eğitim Uzmanı', 'Rehber Öğretmen', 'Okul Müdürü',
  'Eğitim Koordinatörü',
  
  // Finans
  'Muhasebeci', 'Finans Uzmanı', 'Bankacı', 'Yatırım Uzmanı', 'Sigorta Uzmanı',
  'Vergi Uzmanı',
  
  // Hukuk
  'Avukat', 'Hakim', 'Savcı', 'Noter', 'Hukuk Danışmanı',
  
  // Medya ve İletişim
  'Gazeteci', 'Editör', 'İçerik Editörü', 'Sosyal Medya Uzmanı', 'Pazarlama Uzmanı',
  'Reklam Uzmanı', 'Halkla İlişkiler Uzmanı',
  
  // Sanat ve Tasarım
  'Grafik Tasarımcı', 'İç Mimar', 'Mimar', 'Sanatçı', 'Fotoğrafçı', 'Müzisyen',
  'Oyuncu', 'Yönetmen',
  
  // Mühendislik
  'Makine Mühendisi', 'Elektrik Mühendisi', 'İnşaat Mühendisi', 'Endüstri Mühendisi',
  'Bilgisayar Mühendisi', 'Kimya Mühendisi',
  
  // İş ve Yönetim
  'İşletme Uzmanı', 'Proje Yöneticisi', 'İnsan Kaynakları Uzmanı', 'Satış Uzmanı',
  'Operasyon Uzmanı', 'Strateji Uzmanı',
  
  // Diğer
  'Girişimci', 'Serbest Meslek', 'Öğrenci', 'Emekli', 'İşsiz', 'Diğer'
];

const EDUCATION_LEVELS = [
  'İlkokul',
  'Ortaokul',
  'Lise',
  'Ön Lisans',
  'Lisans',
  'Yüksek Lisans',
  'Doktora',
  'Belirtmek İstemiyorum'
];

module.exports = {
  INTERESTS,
  PERSONALITY_TRAITS,
  LANGUAGES,
  RELATIONSHIP_STATUS,
  LOOKING_FOR,
  LIFESTYLE_PREFERENCES,
  OCCUPATIONS,
  EDUCATION_LEVELS
};
