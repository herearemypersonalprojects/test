// ga-lozu.js

// 1. Khai báo ID GA4 của Lozu
window.LOZU_GA_ID = 'G-T79PMFJPN5';

// 2. Nạp script gtag.js từ Google
(function() {
  var gaId = window.LOZU_GA_ID;
  if (!gaId) return;

  // tạo <script> để tải gtag
  var gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + gaId;
  document.head.appendChild(gtagScript);

  // khởi tạo dataLayer + gtag
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;

  // init
  gtag('js', new Date());
})();
