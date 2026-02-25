import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

const resources = {
  en: {
    translation: {
      "app": {
        "title": "PawVibe",
        "camera_permission": "We need your permission to show the camera",
        "grant_permission": "Grant Permission",
        "analyze_btn": "🐾 Analyze Vibe",
        "scanning": "Scanning...",
        "waiting_auth": "Waiting for authentication...",
        "out_of_credits": "Out of Credits! ⚡",
        "out_of_credits_msg": "You have used all your free scans for this week! Head to your profile to upgrade.",
        "analysis_failed": "Analysis Failed",
        "analysis_failed_msg": "Could not analyze your pet right now.",
        "error": "Error",
        "vibe_check_complete": "Vibe Check Complete ✨",
        "chaos": "Chaos",
        "energy": "Energy",
        "sweetness": "Sweetness",
        "judgment": "Judgment",
        "cuddle": "Cuddle-o-Meter",
        "derp": "Derp Factor",
        "scan_another": "Scan Another Pet 🐾",
        "profile_title": "My Profile 🐾",
        "my_credits": "My Credits ⚡",
        "weekly_free": "Weekly Free Scans (Resets weekly)",
        "purchased_scans": "Purchased Scans",
        "buy_snack_pack": "Want more? Buy a Snack Pack! 🍖",
        "recent_scans": "Recent Scans",
        "no_scans": "No pets analyzed yet. Go scan some vibes!",
        "sweet": "Sweet",
        "tab_scan": "Scan",
        "tab_profile": "My Vibe",
        "profile_not_created": "Profile not created yet. Try taking a photo first!"
      }
    }
  },
  tr: {
    translation: {
      "app": {
        "title": "PawVibe",
        "camera_permission": "Kamerayı göstermek için izninize ihtiyacımız var",
        "grant_permission": "İzin Ver",
        "analyze_btn": "🐾 Modu Analiz Et",
        "scanning": "Taranıyor...",
        "waiting_auth": "Kimlik doğrulanıyor...",
        "out_of_credits": "Kredin Bitti! ⚡",
        "out_of_credits_msg": "Bu haftaki tüm ücretsiz haklarını kullandın! Kredi almak için profiline git.",
        "analysis_failed": "Analiz Başarısız",
        "analysis_failed_msg": "Şu an evcil hayvanını analiz edemiyoruz.",
        "error": "Hata",
        "vibe_check_complete": "Mod Analizi Tamamlandı ✨",
        "chaos": "Kaos",
        "energy": "Enerji",
        "sweetness": "Tatlılık",
        "judgment": "Yargı",
        "cuddle": "Sevgi",
        "derp": "Şapşallık",
        "scan_another": "Yeni Analiz 🐾",
        "profile_title": "Profilim 🐾",
        "my_credits": "Kredilerim ⚡",
        "weekly_free": "Haftalık Bedava (Her hafta yenilenir)",
        "purchased_scans": "Satın Alınanlar",
        "buy_snack_pack": "Daha fazla hak mı? Paket Satın Al! 🍖",
        "recent_scans": "Son Analizler",
        "no_scans": "Hiç analiz yok. Hadi biraz mod tarayalım!",
        "sweet": "Tatlı",
        "tab_scan": "Tara",
        "tab_profile": "Modum",
        "profile_not_created": "Profil henüz oluşturulmadı. Önce bir fotoğraf çekmeyi dene!",
        "share": "Paylaş!"
      }
    }
  }
};

const deviceLanguage = getLocales()[0].languageCode;

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4', // Required for React Native
    resources,
    lng: deviceLanguage || 'en', // Set default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
