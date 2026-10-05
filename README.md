# Metal Bakım Takip – PWA

Bu sürüm Windows üzerinde geliştirilebilir ve iPhone'da Safari üzerinden ana ekrana eklenebilir.

## Özellikler

- Müşteri ekleme / düzenleme / silme
- Yetkili, telefon, adres, not
- Cihaz adı, marka/model, seri numarası
- iPhone kamerasından fotoğraf çekme veya galeriden seçme
- Son bakım tarihi
- 6 aylık bakım periyodu (değiştirilebilir)
- 5 gün önceden yaklaşan bakım göstergesi
- Gecikmiş bakım göstergesi
- Toplam alacak
- Bu ay tahsil edilen
- Geciken ödemeler
- Kısmi tahsilat
- Firma / cihaz / seri no ile arama
- JSON yedekleme ve geri yükleme
- İnternet kesilse bile, bir kez yüklendikten sonra temel ekranların çevrimdışı çalışması

## Windows'ta test etme

Bu klasörde terminal açın.

Python yüklüyse:

    python -m http.server 8080

Sonra bilgisayarda:
http://localhost:8080

## iPhone'da kullanma

iPhone'un uygulamayı açabilmesi için dosyaların HTTPS ile yayınlanması en kolay yöntemdir.
GitHub Pages, Netlify, Cloudflare Pages veya benzeri statik site hizmetleri kullanılabilir.

Safari'de siteyi açtıktan sonra:

Paylaş > Ana Ekrana Ekle

Böylece uygulama ikonuyla, tam ekran uygulama gibi açılır.

## Bildirim hakkında önemli not

PWA içinde "bakım tarihinden tam 5 gün önce uygulama kapalıyken kesin yerel alarm"
iOS tarafından normal JavaScript zamanlayıcısıyla güvenilir biçimde çalıştırılamaz.

iPhone'da gerçek push bildirimi yapılabilir, fakat bunun için:
- ana ekrana eklenmiş PWA,
- HTTPS,
- Web Push altyapısı,
- push aboneliği saklayan bir backend/sunucu

gerekir.

Bu başlangıç sürümünde uygulama açıldığında yaklaşan ve gecikmiş bakımlar otomatik görünür.

- Bakım durumu: Planlandı / Yapılmadı / Tamamlandı
- "Bakım Yapılmadı" seçildiğinde bakım tarihi ileri alınmaz ve kayıt beklemede/gecikmiş kalır.


## v4 güncellemesi

- Uygulama üst bölümüne Kalmer Kalibrasyon logosu eklendi
- Uygulama adı üstte Kalmer Kalibrasyon olarak gösteriliyor
- iPhone ana ekran simgeleri (`icon-192.png` ve `icon-512.png`) yeni logoyla değiştirildi
- Alt menü yazıları büyük ve daha okunaklı bırakıldı


## v5 güncellemesi

- Makine ekleme bölümünde "Marka / model" alanı "Operatör İsimleri" olarak değiştirildi.
- Bakımlar bölümünden "Tümü" kaldırıldı.
- Bakım filtreleri: Yaklaşan / Gecikmiş / Yapılanlar.
- Tamamlanan bakımlar tarih bilgisiyle "Yapılanlar" bölümünde gösteriliyor.
- Bakım kartlarında müşteri, makine, operatör, seri no ve durum daha profesyonel ayrıştırıldı.


## v6 güncellemesi

- Cihaz Tipi alanı eklendi:
  - İğne Dedektörü
  - El Tipi Metal Dedektör
  - Diğer
- Bakım Tamamlandı butonu artık doğrudan tarih atlamıyor; Kalibrasyon / Servis Formu açıyor.
- Form alanları Kalmer'in mevcut bakım/kalibrasyon kağıdına göre uyarlandı.
- İğne dedektörü formunda:
  - Hassasiyet ayarı
  - Sayaç sensörleri
  - Otomatik başlama
  - Yazıcı
  - Saat/tarih
  - Konveyör band
  - 1.2 Ferrous test kartı
  - 9 nokta aparat
  - Eğitim alan kişiler
- El tipi metal dedektörde:
  - Power Supply
  - Battery Back-up
  - Proces Board
  - Head Capacitor
  - 1.2 Ferrous test kartı
- Yapılan çalışmalar, teknisyen ve gelecek servis tarihi kaydedilir.
- Her makine için bakım/kalibrasyon geçmişi tutulur.
- Geçmiş kayıttan PDF / Yazdır ekranı açılabilir.


## v6.1 düzeltmesi

- v6 sürümünde tüm butonların çalışmasını engelleyen JavaScript satır sonu hatası düzeltildi.
- `app.js` sözdizimi kontrolünden geçirildi.
- Service Worker cache sürümü `metal-bakim-v61` olarak güncellendi.


## v6.2 düzeltmesi

- Yeni Cihaz ekranındaki "Vazgeç" butonu düzeltildi.
- Tüm modal formlardaki "Vazgeç" butonları artık submit tetiklemeden pencereyi kapatıyor.
- Service Worker cache sürümü `metal-bakim-v62` olarak güncellendi.


## v6.3 düzeltmesi

- Servis / Kalibrasyon formundaki Vazgeç butonu iPhone Safari uyumlu hale getirildi.
- Kaydet ve Tamamla butonu artık tüm alanlara getElementById üzerinden erişiyor.
- Safari'nin otomatik global ID değişkenlerine bağımlılık kaldırıldı.
- Kayıt tamamlandığında başarı mesajı gösteriliyor.
- Service Worker cache sürümü metal-bakim-v63 olarak güncellendi.


## v6.4 güncellemesi

- Program artık bakım kaydından PDF üretmeye odaklanmıyor.
- Bakım tamamlanırken gerçek evrak eklenebilir.
- iPhone'dan fotoğraf veya PDF seçilebilir.
- Desteklenen evrak türleri: JPG / PNG / diğer resimler / PDF.
- Bakım geçmişinde "Evrakı Aç" butonu ile kayıtlı belge görüntülenebilir.
- Yerel tarayıcı saklama sınırı nedeniyle tek evrak için 3 MB sınırı uygulanır.


## v6.5 güncellemesi

- Evrak uygulama içinde belge görüntüleyicide açılır.
- Evrak ekranında WhatsApp Gönder, Yazdır ve Kapat butonları bulunur.
- WhatsApp Gönder, iPhone paylaşım ekranını açar; WhatsApp seçilerek dosya paylaşılır.
- Resim ve PDF evrakları görüntülenebilir.
