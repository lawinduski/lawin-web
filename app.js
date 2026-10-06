const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ============================================================ SECURE DATA LAYER
   The browser never receives Firebase config, API keys, service-account
   credentials, admin secrets, or direct Firestore access. All Firebase
   operations run through same-origin server endpoints with HttpOnly auth.
   ============================================================ */
const SERVER_READY = true;
const PUBLIC_API = '/api/public';
const AUTH_API = '/api/auth';
const ADMIN_API = '/api/admin';

async function apiJson(url, options = {}){
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  let data = null;
  try { data = await res.json(); } catch(_) {}
  if(!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

const WA_DEFAULT = "9647514559566";

const DEFAULT_SETTINGS = {
  whatsapp: "9647514559566",
  instagram: "omar.perfume_",
  snapchat: "omar.perfume",
  tiktok: "omar_perfume1",
  locationUrl: "https://maps.app.goo.gl/qrmb85VNZiXHjK7m8?g_st=ic",
  currency: "$"
};

const SEED_CATEGORIES = [
  { id: "c1", order: 1, name_ckb: "گوڵاڤێن عەرەبی", name_ar: "عطور عربية", name_en: "Arabic Attars" },
  { id: "c2", order: 2, name_ckb: "گوڵاڤێن رۆژئاڤایی", name_ar: "عطور غربية", name_en: "Western Perfumes" },
  { id: "c3", order: 3, name_ckb: "عود و مسک", name_ar: "عود ومسك", name_en: "Oud & Musk" },
];

const SEED_PERFUMES = [
  { id:"p1", categoryId:"c1", order:1, available:true, price:38,
    name_ckb:"عەمبەری شاهانە", name_ar:"العنبر الملكي", name_en:"Royal Amber",
    notes_ckb:"عەمبەر، ڤانیل، عود", notes_ar:"عنبر، فانيليا، عود", notes_en:"Amber, Vanilla, Oud", image:"" },
  { id:"p2", categoryId:"c2", order:2, available:true, price:52,
    name_ckb:"شەڤا پاریسێ", name_ar:"ليلة باريس", name_en:"Paris Nights",
    notes_ckb:"یاسەمین، موسک، وانیل", notes_ar:"ياسمين، مسك، فانيليا", notes_en:"Jasmine, Musk, Vanilla", image:"" },
  { id:"p3", categoryId:"c3", order:3, available:false, price:65,
    name_ckb:"عودا کەڤنار", name_ar:"العود العتيق", name_en:"Aged Oud",
    notes_ckb:"عودێ هندی، زەعفەران", notes_ar:"عود هندي، زعفران", notes_en:"Indian Oud, Saffron", image:"" },
  { id:"p4", categoryId:"c1", order:4, available:true, price:44,
    name_ckb:"گوڵا دهۆکێ", name_ar:"وردة دهوك", name_en:"Duhok Rose",
    notes_ckb:"گوڵ، سەندەل", notes_ar:"ورد، صندل", notes_en:"Rose, Sandalwood", image:"" },
];

const SIZE_OPTIONS = [
  { key: 'full', ratio: 1 },
  { key: 'ml30', ratio: 0.55 },
  { key: 'ml15', ratio: 0.32 },
  { key: 'ml7', ratio: 0.18 },
];

function sizePrice(perfume, key, ratio){
  if(key === 'full') return +(perfume.price || 0);
  const override = perfume['price_' + key];
  if(override !== undefined && override !== null && override !== '' && !isNaN(override)) return +parseFloat(override).toFixed(2);
  return +(((perfume.price || 0) * ratio)).toFixed(2);
}

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

/* Returns the list of sizes actually offered for a perfume, admin-controlled.
   New perfumes store an explicit `sizes` array (label + price, freely added/removed by
   the admin — e.g. only "Full Bottle" if that's all that's sold, or Full + 30ml + 5ml
   if that's what exists). Older perfumes saved before this existed fall back to the
   previous fixed full/30/15/7ml behavior so nothing already live breaks. */
function discountAmountValue(perfume){
  if(!perfume) return 0;
  const explicit = parseFloat(perfume.discountAmount);
  if(Number.isFinite(explicit) && explicit > 0) return explicit;
  // Backward compatibility for products created with the old percentage field.
  const legacyPct = parseFloat(perfume.discountPercent);
  const base = parseFloat(perfume.price) || 0;
  if(Number.isFinite(legacyPct) && legacyPct > 0 && base > 0){
    return +(base * legacyPct / 100).toFixed(2);
  }
  return 0;
}

function applyDiscountAmount(price, perfume){
  const base = parseFloat(price) || 0;
  const discount = discountAmountValue(perfume);
  if(discount <= 0) return base;
  return Math.max(0, +(base - discount).toFixed(2));
}

function getSizes(perfume, t){
  if(Array.isArray(perfume.sizes) && perfume.sizes.length){
    return perfume.sizes
      .filter(s => s && s.label && s.label.trim() !== '' && s.price !== '' && s.price != null && !isNaN(s.price))
      .map(s => ({
        id: s.id,
        label: s.label,
        price: applyDiscountAmount(+parseFloat(s.price).toFixed(2), perfume)
      }));
  }
  return SIZE_OPTIONS.map(s => ({
    id: s.key,
    label: t['size_' + s.key],
    price: applyDiscountAmount(sizePrice(perfume, s.key, s.ratio), perfume)
  }));
}

function discountedPrice(perfume){
  return applyDiscountAmount(perfume && perfume.price, perfume);
}

function defaultSizesFromLegacy(perfume, t){
  if(Array.isArray(perfume.sizes) && perfume.sizes.length) return perfume.sizes;
  return SIZE_OPTIONS.map(s => ({ id: uid(), label: t['size_' + s.key], price: sizePrice(perfume, s.key, s.ratio) }));
}

/* ============================================================ TRANSLATIONS */
const T = {
  ckb: {
    dir: "rtl", langName: "بەهدینی",
    brand: "عومەر", brandSub: "پەرفیوم",
    heroEyebrow: "گوڵاڤخانا دهۆکێ",
    heroTitle1: "بۆنێ کو دبیتە", heroTitleEm: "ناڤونیشانا تە",
    heroLead: "کۆمەکێ ژ باشترین و ئەسلترین گوڵاڤێن جیهانێ، ژ عەرەبی و عود هەتا رۆژئاڤایی — هەلبژێرە ئەوێ کو بۆنا تە پێ دبێژیت.",
    heroBtn: "بگەڕە د کۆمەکێ دا", heroBtn2: "پەیوەندی بکە",
    collEyebrow: "کۆمەکێن گوڵاڤان", collTitle: "کۆمەکێن مە",
    allCat: "هەمی",
    price: "نرخ", order: "داخازکرن", outOfStock: "نەماوە", inStock: "بەردەستە",
    notesLabel: "بۆن:",
    noItems: "هێشتا گوڵاڤ ل ڤێ کۆمەکێ دا نینن",
    perfSearchPh: "لێگەڕیانا گوڵاڤەکێ...", noSearchItems: "ھیچ گوڵاڤەک بەرامبەر لێگەڕیانێ نەهاتە دیتن",
    orderTitle: "داخازکرنا گوڵاڤێ",
    orderDesc: "ژمارەیا دلخوازی هەلبژێرە، پاشی د واتسئاپی دا داخازیا خۆ پێشکێش بکە و شوینێ خۆ بنڤیسە یان بنێرە.",
    qty: "ژمارە", confirmOrder: "بچۆ واتسئاپێ",
    footAbout: "دەربارەی مە", aboutText: "گوڵاڤخانەکە یا ل دهۆکێ یا هەمی جورێن گوڵاڤێن ئەسلی و براندێن جیهانی دئینیت.",
    footFollow: "شوینگری بکە", footContact: "پەیوەندی",
    viewMap: "بینینا لۆکەیشنێ", whatsappUs: "واتسئاپ",
    rights: "هەمی مافێن پارێزراینن",
    langLabel: "زمان",
    adminEnter: "چوونا ئەدمین", adminEmail: "ئیمەیلا ئەدمین", adminPassword: "پاسوۆردا ئەدمین", loginSubmit: "چوونەژوور", authFailed: "ئیمەیل یان پاسوۆرد خەلەتە",
    dashTitle: "بەڕێڤەبرنا سایتێ", logout: "دەرچوون", viewSite: "دیتنا ماڵپەڕی",
    tabCats: "کۆمەک", tabPerf: "گوڵاڤ", tabSettings: "ڕێکخستن",
    searchPh: "لێگەڕیان...", noResults: "ھیچ ئەنجامەک نەهاتە دیتن",
    addCat: "زێدەکرنا کۆمەک", editCat: "دەستکاریکرنا کۆمەک",
    addPerf: "زێدەکرنا گوڵاڤ", editPerf: "دەستکاریکرنا گوڵاڤ",
    nameCkb: "ناڤ (بەهدینی)", nameAr: "ناڤ (عەرەبی)", nameEn: "ناڤ (ئینگلیزی)",
    notesCkb: "بۆن (بەهدینی)", notesAr: "بۆن (عەرەبی)", notesEn: "بۆن (ئینگلیزی)",
    priceField: "نرخ (دۆلار)", categoryField: "کۆمەک", imageField: "وێنە",
    uploadImg: "وێنەیەکی هەلبژێرە", save: "پاشکەفتکرن", cancel: "پاشگەزبوون", delete: "سرینەوە",
    confirmDelete: "دلنیایی کو دفێت ئەڤێ بسرێتەوە؟",
    markAvail: "بەردەستە", markOut: "نەماوە",
    settingsWa: "ژمارا واتسئاپ", settingsIg: "ئینستاگرام", settingsSnap: "سناپچات", settingsTik: "تیکتۆک",
    settingsLoc: "لینکا لۆکەیشنێ", settingsCur: "نیشانا دراڤی",
    saved: "پاشکەفت بوو", saving: "پاشکەفتکرن...", visits: "سەردانکەران",
    noFirebase: "Firebase هێشتا نەهاتیە ڕێکخستن — تشتێن تو زێدە دکەی نکا تنێ لسەر ڤێ ڕایانەری دمینیت. بۆ پاشکەفتکرنا هەمیشەیی، config یا Firebase دابنێ د سەرەتای کۆدی دا.",
    trust1: "١٠٠٪ ئەسلی", trust2: "گەیاندنا خێرا", trust3: "کوالیتی پارێزراییە",
    orderSize: "قەبارە", size_full: "بۆتلا تەواو", size_ml30: "٣٠ ملم", size_ml15: "١٥ ملم", size_ml7: "٧ ملم",
    orderName: "ناڤێ تە", orderNamePh: "ناڤێ خۆ بنڤیسە",
    orderPhone: "ژمارا تەلەفۆنێ", orderPhonePh: "٠٧٥٠xxxxxxx",
    orderRequired: "ڤێ خانێ پێدڤیە",
    orderLocation: "شوین (لۆکەیشن)",
    locBtn: "شوینێ خۆ بنێرە", locLoading: "لدیارکرنا شوینی...", locGot: "شوین هاتە دیارکرن ✓",
    locError: "نەشیا شوین بدیت بێت — تکایە ناڤونیشانا خۆ ل خوارێ بنڤیسە",
    orderAddressPh: "ناڤونیشان یان نیشانەیەکێ زانراو (ئارەزوومەندانە)",
    sending: "لهنارتنێ...",
    orderHint: "دەمێ تو ڤێ دوکمێ دگریت، واتسئاپ راستەوخو ڤەدبیت دگەل هەمی زانیاریێن تە یێن ئامادەکری؛ وێنەیێ گوڵاڤێ ژی د تابەکێ نوی دا ڤەدبیت — پاشکەفتی بکە و پێکڤە دگەل نڤیسینێ بنێرە.",
    sizePricesLabel: "نرخێ قەبارێن بچووکتر (ئارەزوومەندانە — ئەگەر ڤالا بمینیت خۆکارانە ژ نرخێ سەرەکی دهێتە حیساب کرن)",
    price30Field: "نرخێ ٣٠ ملم", price15Field: "نرخێ ١٥ ملم", price7Field: "نرخێ ٧ ملم",
    sizesEditorLabel: "قەبارە و نرخێن گوڵاڤێ (دشێی هەر چەند قەبارەیێ دفەرمینیت زێدە بکەی — ئەگەر بتنێ بۆتلا تەواو دفرۆشیت، بەسە یا یەکێ بمینیت)",
    addSizeBtn: "زێدەکرنا قەبارەیەکێ", sizeLabelPh: "بۆ نموونە: ٣٠ ملم", sizePricePh: "نرخ", removeSize: "سرینەوێ ڤێ قەبارێ", startingFrom: "ژ",
    actionsMenu: "کریار", editAction: "دەستکاریکرن", deleteAction: "سرینەوە", toggleAvailAction: "گۆڕینا بەردەستبوونێ",
    discountField: "بڕێ داشکاندن (د.ع)", markOil: "گوڵاڤا ڕوون/تێکەل", markNormal: "گوڵاڤا ئاسایی",
    oilEyebrow: "بەشەکێ تایبەت", oilTitle: "گوڵاڤێن ڕوون و تێکەل",
    oilLead: "چەند گوڵاڤەکێ ڕوون هەلبژێرە، ئەم دێ بۆ تە پێکڤە تێکەل کەین.",
    oilNav: "ڕوون و تێکەل",
    blendSelect: "هەلبژێرە", blendSelected: "هاتە هەلبژارتن",
    blendCountLabel: "گوڵاڤ هاتنە هەلبژارتن", blendNeedMore: "گوڵاڤەکا دی هەلبژێرە بۆ تێکەلکرنێ",
    blendBtn: "تێکەل بکە و داخاز بکە", blendClear: "پاککرن",
    blendTitle: "داخازا تێکەلێ", blendIntro: "ئەڤ گوڵاڤە دێ پێکڤە هێنە تێکەلکرن:",
    blendRemove: "لابرن", blendHint: "نرخێ دوماهیکێ یێ تێکەلێ دێ دگەل تە ل واتسئاپێ هێتە ڕاستکرن.",
  },
  ar: {
    dir: "rtl", langName: "العربية",
    brand: "عمر", brandSub: "للعطور",
    heroEyebrow: "دار عطور دهوك",
    heroTitle1: "عطر يليق", heroTitleEm: "بحضورك",
    heroLead: "مجموعة مختارة من أفخم العطور العالمية والعربية والعود — اختر ما يعبّر عن أسلوبك.",
    heroBtn: "تصفح المجموعة", heroBtn2: "تواصل معنا",
    collEyebrow: "أقسام العطور", collTitle: "مجموعاتنا",
    allCat: "الكل",
    price: "السعر", order: "اطلب الآن", outOfStock: "غير متوفر", inStock: "متوفر",
    notesLabel: "النوتات:",
    noItems: "لا توجد عطور في هذا القسم حالياً",
    perfSearchPh: "ابحث عن عطر...", noSearchItems: "لم يتم العثور على عطور مطابقة للبحث",
    orderTitle: "طلب العطر",
    orderDesc: "اختر الكمية، ثم أرسل الطلب عبر واتساب مع تحديد موقعك.",
    qty: "الكمية", confirmOrder: "الطلب عبر واتساب",
    footAbout: "من نحن", aboutText: "دار عطور في دهوك تقدم أرقى العطور الأصلية والماركات العالمية.",
    footFollow: "تابعنا", footContact: "تواصل معنا",
    viewMap: "عرض الموقع", whatsappUs: "واتساب",
    rights: "جميع الحقوق محفوظة",
    langLabel: "اللغة",
    adminEnter: "دخول الإدارة", adminEmail: "بريد المدير", adminPassword: "كلمة مرور المدير", loginSubmit: "دخول", authFailed: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    dashTitle: "لوحة التحكم", logout: "خروج", viewSite: "عرض الموقع",
    tabCats: "الأقسام", tabPerf: "العطور", tabSettings: "الإعدادات",
    searchPh: "بحث...", noResults: "لا توجد نتائج",
    addCat: "إضافة قسم", editCat: "تعديل القسم",
    addPerf: "إضافة عطر", editPerf: "تعديل العطر",
    nameCkb: "الاسم (بهدینی)", nameAr: "الاسم (عربي)", nameEn: "الاسم (إنجليزي)",
    notesCkb: "النوتات (بهدینی)", notesAr: "النوتات (عربي)", notesEn: "النوتات (إنجليزي)",
    priceField: "السعر (دولار)", categoryField: "القسم", imageField: "الصورة",
    uploadImg: "اختر صورة", save: "حفظ", cancel: "إلغاء", delete: "حذف",
    confirmDelete: "هل أنت متأكد من الحذف؟",
    markAvail: "متوفر", markOut: "غير متوفر",
    settingsWa: "رقم واتساب", settingsIg: "إنستغرام", settingsSnap: "سناب شات", settingsTik: "تيك توك",
    settingsLoc: "رابط الموقع", settingsCur: "رمز العملة",
    saved: "تم الحفظ", saving: "جاري الحفظ...", visits: "الزيارات",
    noFirebase: "لم يتم إعداد Firebase بعد — التغييرات ستبقى على هذا الجهاز فقط. لحفظ دائم، أضف إعدادات Firebase في أعلى الكود.",
    trust1: "أصلي 100%", trust2: "توصيل سريع", trust3: "جودة مضمونة",
    orderSize: "الحجم", size_full: "زجاجة كاملة", size_ml30: "30 مل", size_ml15: "15 مل", size_ml7: "7 مل",
    orderName: "الاسم", orderNamePh: "اكتب اسمك",
    orderPhone: "رقم الهاتف", orderPhonePh: "0750xxxxxxx",
    orderRequired: "هذا الحقل مطلوب",
    orderLocation: "الموقع",
    locBtn: "إرسال موقعي", locLoading: "جاري تحديد الموقع...", locGot: "تم تحديد الموقع ✓",
    locError: "تعذر تحديد الموقع — الرجاء كتابة عنوانك في الأسفل",
    orderAddressPh: "العنوان أو أقرب نقطة دالة (اختياري)",
    sending: "جاري الإرسال...",
    orderHint: "عند الضغط سيفتح واتساب مباشرة مع كل معلوماتك الجاهزة؛ كما ستفتح صورة العطر في تبويب جديد — احفظها وأرسلها مع الرسالة.",
    sizePricesLabel: "أسعار الأحجام الصغيرة (اختياري — تُحسب تلقائياً من السعر الأساسي إن تُركت فارغة)",
    price30Field: "سعر 30 مل", price15Field: "سعر 15 مل", price7Field: "سعر 7 مل",
    sizesEditorLabel: "الأحجام والأسعار (أضف أي عدد من الأحجام تريده — إن كنت تبيع الزجاجة الكاملة فقط، اترك حجماً واحداً)",
    addSizeBtn: "إضافة حجم", sizeLabelPh: "مثال: 30 مل", sizePricePh: "السعر", removeSize: "حذف هذا الحجم", startingFrom: "من",
    actionsMenu: "إجراءات", editAction: "تعديل", deleteAction: "حذف", toggleAvailAction: "تغيير التوفر",
    discountField: "قيمة الخصم (د.ع)", markOil: "عطر زيتي/خلطة", markNormal: "عطر عادي",
    oilEyebrow: "قسم مميز", oilTitle: "العطور الزيتية والخلطات",
    oilLead: "اختر عدة عطور زيتية وسنخلطها لك معاً في عطر واحد.",
    oilNav: "زيتية وخلطات",
    blendSelect: "اختيار", blendSelected: "تم الاختيار",
    blendCountLabel: "عطور مختارة", blendNeedMore: "اختر عطراً آخر على الأقل لإنشاء الخلطة",
    blendBtn: "اخلطها واطلب", blendClear: "مسح",
    blendTitle: "طلب خلطة", blendIntro: "سيتم خلط هذه العطور معاً:",
    blendRemove: "إزالة", blendHint: "السعر النهائي للخلطة يُؤكَّد معك عبر واتساب.",
  },
  en: {
    dir: "ltr", langName: "English",
    brand: "Omar", brandSub: "Perfume",
    heroEyebrow: "Duhok Perfume House",
    heroTitle1: "A scent that becomes", heroTitleEm: "your signature",
    heroLead: "A curated collection of the world's finest attars, ouds and designer perfumes — find the one that speaks for you.",
    heroBtn: "Browse the Collection", heroBtn2: "Get in Touch",
    collEyebrow: "Collections", collTitle: "Our Collections",
    allCat: "All",
    price: "Price", order: "Order Now", outOfStock: "Out of Stock", inStock: "In Stock",
    notesLabel: "Notes:",
    noItems: "No perfumes in this collection yet",
    perfSearchPh: "Search for a perfume...", noSearchItems: "No perfumes match your search",
    orderTitle: "Order This Perfume",
    orderDesc: "Choose a quantity, then send your order on WhatsApp along with your location.",
    qty: "Quantity", confirmOrder: "Order on WhatsApp",
    footAbout: "About", aboutText: "A Duhok-based perfume house bringing authentic attars and world brands together.",
    footFollow: "Follow Us", footContact: "Contact",
    viewMap: "View Location", whatsappUs: "WhatsApp",
    rights: "All rights reserved",
    langLabel: "Language",
    adminEnter: "Admin Login", adminEmail: "Admin email", adminPassword: "Admin password", loginSubmit: "Enter", authFailed: "Incorrect email or password",
    dashTitle: "Dashboard", logout: "Log out", viewSite: "View Site",
    tabCats: "Categories", tabPerf: "Perfumes", tabSettings: "Settings",
    searchPh: "Search...", noResults: "No results found",
    addCat: "Add Category", editCat: "Edit Category",
    addPerf: "Add Perfume", editPerf: "Edit Perfume",
    nameCkb: "Name (Behdini)", nameAr: "Name (Arabic)", nameEn: "Name (English)",
    notesCkb: "Notes (Behdini)", notesAr: "Notes (Arabic)", notesEn: "Notes (English)",
    priceField: "Price (USD)", categoryField: "Category", imageField: "Image",
    uploadImg: "Choose Image", save: "Save", cancel: "Cancel", delete: "Delete",
    confirmDelete: "Are you sure you want to delete this?",
    markAvail: "In Stock", markOut: "Out of Stock",
    settingsWa: "WhatsApp Number", settingsIg: "Instagram", settingsSnap: "Snapchat", settingsTik: "TikTok",
    settingsLoc: "Location Link", settingsCur: "Currency Symbol",
    saved: "Saved", saving: "Saving...", visits: "Visits",
    noFirebase: "Firebase isn't configured yet — changes will stay on this device only. To save permanently, add your Firebase config at the top of the code.",
    trust1: "100% Authentic", trust2: "Fast Delivery", trust3: "Quality Guaranteed",
    orderSize: "Size", size_full: "Full Bottle", size_ml30: "30ml", size_ml15: "15ml", size_ml7: "7ml",
    orderName: "Your Name", orderNamePh: "Enter your name",
    orderPhone: "Phone Number", orderPhonePh: "0750xxxxxxx",
    orderRequired: "This field is required",
    orderLocation: "Location",
    locBtn: "Share My Location", locLoading: "Getting location...", locGot: "Location captured ✓",
    locError: "Couldn't get your location — please type your address below",
    orderAddressPh: "Address or nearest landmark (optional)",
    sending: "Sending...",
    orderHint: "Tapping this opens WhatsApp directly with all your info filled in; the perfume photo also opens in a new tab — save it and send it along with the message.",
    sizePricesLabel: "Small size prices (optional — auto-calculated from the base price if left blank)",
    price30Field: "30ml Price", price15Field: "15ml Price", price7Field: "7ml Price",
    sizesEditorLabel: "Sizes & prices (add as many sizes as you like — if you only sell the full bottle, keep just one)",
    addSizeBtn: "Add Size", sizeLabelPh: "e.g. 30ml", sizePricePh: "Price", removeSize: "Remove this size", startingFrom: "From",
    actionsMenu: "Actions", editAction: "Edit", deleteAction: "Delete", toggleAvailAction: "Toggle availability",
    discountField: "Discount amount (IQD)", markOil: "Oil / Blended", markNormal: "Regular",
    oilEyebrow: "Special Collection", oilTitle: "Oil & Blended Perfumes",
    oilLead: "Pick several oil perfumes and we'll blend them together for you.",
    oilNav: "Oils & Blends",
    blendSelect: "Select", blendSelected: "Selected",
    blendCountLabel: "selected", blendNeedMore: "Pick at least one more to make a blend",
    blendBtn: "Blend & Order", blendClear: "Clear",
    blendTitle: "Blend Order", blendIntro: "These perfumes will be blended together:",
    blendRemove: "Remove", blendHint: "The final blend price is confirmed with you on WhatsApp.",
  }
};

function useLocalState(key, initial){
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch(e){ return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){}
  }, [key, val]);
  return [val, setVal];
}

function pick(obj, lang, field){
  return obj[field + "_" + lang] || obj[field + "_en"] || obj[field + "_ckb"] || "";
}

/* ============================================================ DATA LAYER */
function useData(){
  const [categories, setCategories] = useLocalState("op_categories", SEED_CATEGORIES);
  // Perfume records can contain large base64 images; keep them out of localStorage so the UI stays fast.
  // Public images are loaded lazily from /api/image. Admin data remains in memory only.
  const [perfumes, setPerfumes] = useState(SEED_PERFUMES);
  const [settings, setSettings] = useLocalState("op_settings", DEFAULT_SETTINGS);
  const [visits, setVisits] = useLocalState("op_visits", 0);

  const refreshPublic = useCallback(async () => {
    try {
      const data = await apiJson(PUBLIC_API);
      if(Array.isArray(data.categories)) setCategories(data.categories);
      if(Array.isArray(data.perfumes)) setPerfumes(data.perfumes);
      if(data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    } catch(e) { console.error('Public data load failed', e); }
  }, []);

  useEffect(() => { refreshPublic(); }, [refreshPublic]);

  const refreshAdmin = useCallback(async () => {
    const data = await apiJson(ADMIN_API);
    if(Array.isArray(data.categories)) setCategories(data.categories);
    if(Array.isArray(data.perfumes)) setPerfumes(data.perfumes);
    if(data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    if(typeof data.visits === 'number') setVisits(data.visits);
    return data;
  }, []);

  const api = useMemo(() => ({
    async refreshAdmin(){ return refreshAdmin(); },
    async addCategory(cat){
      await apiJson(ADMIN_API, { method:'POST', body:JSON.stringify({ resource:'category', data:cat }) });
      await refreshAdmin();
    },
    async updateCategory(id, cat){
      await apiJson(ADMIN_API, { method:'PUT', body:JSON.stringify({ resource:'category', id, data:cat }) });
      await refreshAdmin();
    },
    async deleteCategory(id){
      await apiJson(ADMIN_API, { method:'DELETE', body:JSON.stringify({ resource:'category', id }) });
      await refreshAdmin();
    },
    async addPerfume(p){
      await apiJson(ADMIN_API, { method:'POST', body:JSON.stringify({ resource:'perfume', data:p }) });
      await refreshAdmin();
    },
    async updatePerfume(id, p){
      await apiJson(ADMIN_API, { method:'PUT', body:JSON.stringify({ resource:'perfume', id, data:p }) });
      await refreshAdmin();
    },
    async deletePerfume(id){
      await apiJson(ADMIN_API, { method:'DELETE', body:JSON.stringify({ resource:'perfume', id }) });
      await refreshAdmin();
    },
    async saveSettings(s){
      const safe = { ...s };
      await apiJson(ADMIN_API, { method:'PUT', body:JSON.stringify({ resource:'settings', data:safe }) });
      await refreshAdmin();
    }
  }), [refreshAdmin]);

  return { categories, perfumes, settings, visits, api };
}

/* ============================================================ SCROLL PROGRESS BAR */
function ScrollProgress(){
  const [pct, setPct] = useState(0);
  useEffect(() => {
    function onScroll(){
      const h = document.documentElement;
      const scrolled = h.scrollTop;
      const height = h.scrollHeight - h.clientHeight;
      setPct(height > 0 ? (scrolled / height) * 100 : 0);
    }
    window.addEventListener('scroll', onScroll, { passive:true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div className="scroll-progress" style={{ width: pct + '%' }}></div>;
}

/* ============================================================ SCROLL REVEAL */
function useReveal(){
  useEffect(() => {
    const els = document.querySelectorAll('.card, .reveal');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('in-view'); });
    }, { threshold: 0.12 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  });
}

/* ============================================================ BOTTLE SVG (hero signature) */
function HeroBottle(){
  const wrapRef = useRef(null);
  const [fill, setFill] = useState(0.15);

  useEffect(() => {
    function onScroll(){
      if(!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = 1 - Math.min(Math.max(rect.top / vh, 0), 1);
      setFill(0.12 + progress * 0.8);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const bodyTop = 110, bodyBottom = 280, bodyHeight = bodyBottom - bodyTop;
  const liquidY = bodyBottom - bodyHeight * fill;

  return (
    <div className="bottle-wrap" ref={wrapRef}>
      <div className="bottle-glow"></div>
      <svg viewBox="0 0 200 400" width="100%" height="100%" style={{position:'relative', zIndex:1}}>
        <defs>
          <clipPath id="bottleClip">
            <rect x="35" y={bodyTop} width="130" height={bodyHeight} rx="18" ry="18" />
          </clipPath>
          <linearGradient id="liquidGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--amber)" />
            <stop offset="55%" stopColor="var(--gold-1)" />
            <stop offset="100%" stopColor="var(--gold-3)" />
          </linearGradient>
          <linearGradient id="capGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--gold-2)" />
            <stop offset="45%" stopColor="var(--gold-1)" />
            <stop offset="100%" stopColor="var(--amber)" />
          </linearGradient>
          <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#12301e" />
            <stop offset="100%" stopColor="#030f09" />
          </linearGradient>
        </defs>

        {/* hexagonal cap, faceted like the brand mark */}
        <polygon points="72,48 128,48 148,72 128,96 72,96 52,72" fill="url(#capGrad)" stroke="var(--gold-3)" strokeWidth="2" />
        {/* collar */}
        <rect x="84" y="96" width="32" height="14" rx="3" fill="var(--gold-2)" stroke="var(--gold-1)" strokeWidth="1" />

        {/* body base (glass), softened corners to echo the logo silhouette */}
        <rect x="35" y={bodyTop} width="130" height={bodyHeight} rx="18" ry="18" fill="url(#glassGrad)" />

        {/* liquid fill, clipped to the rounded body */}
        <g clipPath="url(#bottleClip)">
          <rect x="20" y={liquidY} width="160" height="400" fill="url(#liquidGrad)" style={{transition:'y .2s linear'}} />
          <rect x="20" y={liquidY} width="160" height="3" fill="rgba(255,255,255,0.55)" style={{transition:'y .2s linear'}} />
        </g>

        {/* brand label */}
        <text x="100" y={bodyTop + bodyHeight/2 + 3} textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="16" fill="#111111" letterSpacing="3">OMAR</text>
        <text x="100" y={bodyTop + bodyHeight/2 + 20} textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="8" fill="#111111" letterSpacing="4">PERFUME</text>

        {/* crisp gold outlines on top */}
        <rect x="35" y={bodyTop} width="130" height={bodyHeight} rx="18" ry="18" fill="none" stroke="var(--gold-2)" strokeWidth="5" />
        <polygon points="72,48 128,48 148,72 128,96 72,96 52,72" fill="none" stroke="var(--gold-3)" strokeWidth="2" />
      </svg>
    </div>
  );
}

/* ============================================================ SPLASH / CINEMATIC ENTRANCE */
function SplashScreen({ fadingOut }){
  return (
    <div className={"splash-screen" + (fadingOut ? " fade-out" : "")} aria-hidden="true">
      <HeroBottle />
    </div>
  );
}

/* ============================================================ LANGUAGE DROPDOWN */
function LangSwitch({ lang, setLang }){
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e){ if(ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, []);

  return (
    <div className="lang-dd" ref={ref}>
      <button type="button" className={"lang-dd-btn" + (open ? ' open' : '')} onClick={() => setOpen(o => !o)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9"/>
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9s1.3-6.4 3.8-9Z"/>
        </svg>
        <span>{T[lang].langName}</span>
        <svg className="chev" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="lang-dd-menu">
          {['ckb','ar','en'].map(l => (
            <button key={l} type="button" className={lang===l ? 'active' : ''} onClick={() => { setLang(l); setOpen(false); }}>
              {T[l].langName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================ HEADER */
function Header({ lang, setLang, onAdminClick, showOil, onOil }){
  const t = T[lang];
  return (
    <header className="site-header">
      <div className="inner">
        <div className="brand">
          <img src={"logo.jpg"} alt="Omar Perfume" />
          <div>
            <div className="name">{t.brand} <span style={{color:'var(--muted)', fontSize:15}}>{t.brandSub}</span></div>
            <div className="sub">Perfume House · Duhok</div>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          {showOil && (
            <button type="button" className="oil-pill" onClick={onOil}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2c3 4 6 7.5 6 11.5A6 6 0 0 1 6 13.5C6 9.5 9 6 12 2Z"/></svg>
              <span>{t.oilNav}</span>
            </button>
          )}
          <LangSwitch lang={lang} setLang={setLang} />
        </div>
      </div>
    </header>
  );
}

/* ============================================================ HERO */
function Hero({ lang, onBrowse, settings, showOil, onOil }){
  const t = T[lang];
  return (
    <section className="hero">
      <div className="lattice"></div>
      <div className="hero-eyebrow">{t.heroEyebrow}</div>
      <HeroBottle />
      <h1>{t.heroTitle1}<br/><em>{t.heroTitleEm}</em></h1>
      <p className="lead">{t.heroLead}</p>
      <div className="cta-row" style={{display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap'}}>
        <button className="btn-gold" onClick={onBrowse}>{t.heroBtn}</button>
        {showOil && (
          <button type="button" className="btn-ghost oil-cta" onClick={onOil}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2c3 4 6 7.5 6 11.5A6 6 0 0 1 6 13.5C6 9.5 9 6 12 2Z"/></svg>
            {t.oilTitle}
          </button>
        )}
        <a className="btn-ghost" href={"https://wa.me/" + settings.whatsapp} target="_blank" rel="noopener">{t.heroBtn2}</a>
      </div>
      <div className="trust-row">
        <div className="item">✦ {t.trust1}</div>
        <div className="item">✦ {t.trust2}</div>
        <div className="item">✦ {t.trust3}</div>
      </div>
    </section>
  );
}

/* ============================================================ ORDER MODAL */
function OrderModal({ lang, perfume, settings, onClose }){
  const t = T[lang];
  const sizes = perfume ? getSizes(perfume, t) : [];
  const [sizeId, setSizeId] = useState(sizes[0] ? sizes[0].id : null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [locUrl, setLocUrl] = useState('');
  const [locStatus, setLocStatus] = useState('idle');
  const [sending, setSending] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => { setSizeId(sizes[0] ? sizes[0].id : null); }, [perfume && perfume.id]);

  if(!perfume) return null;
  const pname = pick(perfume, lang, 'name');
  const activeSize = sizes.find(s => s.id === sizeId) || sizes[0] || { label: '', price: perfume.price };
  const selectedPrice = activeSize.price;
  const valid = name.trim().length > 0 && phone.trim().length > 0;

  function getLocation(){
    if(!navigator.geolocation){ setLocStatus('error'); return; }
    setLocStatus('loading');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocUrl(`https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`);
        setLocStatus('got');
      },
      () => setLocStatus('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function buildMessage(){
    const sizeLabel = activeSize.label;
    const lines = {
      ckb: [
        `سلاڤ، ڤێ گوڵاڤێ دفێت بکڕم:`,
        `🌸 ${pname}`,
        `📏 ${t.orderSize}: ${sizeLabel}`,
        `💰 ${t.price}: ${settings.currency}${selectedPrice}`,
        ``,
        `👤 ${t.orderName}: ${name}`,
        `📞 ${t.orderPhone}: ${phone}`,
        address ? `📍 ${t.orderAddress || t.orderLocation}: ${address}` : null,
        locUrl ? `🗺️ ${t.orderLocation}: ${locUrl}` : null,
      ],
      ar: [
        `مرحباً، أرغب بطلب:`,
        `🌸 ${pname}`,
        `📏 ${t.orderSize}: ${sizeLabel}`,
        `💰 ${t.price}: ${settings.currency}${selectedPrice}`,
        ``,
        `👤 ${t.orderName}: ${name}`,
        `📞 ${t.orderPhone}: ${phone}`,
        address ? `📍 العنوان: ${address}` : null,
        locUrl ? `🗺️ ${t.orderLocation}: ${locUrl}` : null,
      ],
      en: [
        `Hello, I'd like to order:`,
        `🌸 ${pname}`,
        `📏 ${t.orderSize}: ${sizeLabel}`,
        `💰 ${t.price}: ${settings.currency}${selectedPrice}`,
        ``,
        `👤 ${t.orderName}: ${name}`,
        `📞 ${t.orderPhone}: ${phone}`,
        address ? `📍 Address: ${address}` : null,
        locUrl ? `🗺️ ${t.orderLocation}: ${locUrl}` : null,
      ],
    };
    return lines[lang].filter(l => l !== null).join('\n');
  }

  function sendOrder(){
    setTouched(true);
    if(!valid) return;
    setSending(true);
    const message = buildMessage();
    const waUrl = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(message)}`;
    // Always go straight into WhatsApp — this must never be delayed or blocked by anything else.
    window.open(waUrl, '_blank');
    // Best effort, alongside: also open the selected perfume's photo in its own tab
    // so it can be saved and attached in the same WhatsApp chat.
    if(perfume.image){
      try { window.open(perfume.image, '_blank'); } catch(e) { /* ignore */ }
    }
    setSending(false);
    onClose();
  }

  return (
    <div className="overlay" onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="close" onClick={onClose}>&times;</button>
        <h3>{t.orderTitle}</h3>

        <div className="order-preview">
          {(perfume.image || perfume.imageUrl || perfume.id) ? <img src={perfume.image || perfume.imageUrl || `/api/image?id=${encodeURIComponent(perfume.id)}`} alt={pname} /> : <div style={{width:58,height:58,borderRadius:12,background:'var(--surface-2)'}}></div>}
          <div>
            <div className="ph-name">{pname}</div>
            <div className="ph-price">{settings.currency}{selectedPrice}</div>
          </div>
        </div>

        {sizes.length > 0 && (
          <div className="field">
            <label>{t.orderSize}</label>
            <div className="size-grid">
              {sizes.map(s => (
                <button key={s.id} type="button" className={"size-opt " + (sizeId===s.id ? 'active':'')} onClick={() => setSizeId(s.id)}>
                  <div className="lbl">{s.label}</div>
                  <div className="pr">{settings.currency}{s.price}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <label>{t.orderName}</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t.orderNamePh} />
          {touched && !name.trim() && <div className="field-error">{t.orderRequired}</div>}
        </div>

        <div className="field">
          <label>{t.orderPhone}</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t.orderPhonePh} />
          {touched && !phone.trim() && <div className="field-error">{t.orderRequired}</div>}
        </div>

        <div className="field">
          <label>{t.orderLocation}</label>
          <button type="button" className={"loc-btn " + (locStatus==='got' ? 'got' : '')} onClick={getLocation}>
            📍 {locStatus==='loading' ? t.locLoading : locStatus==='got' ? t.locGot : t.locBtn}
          </button>
          {locStatus === 'error' && <div className="field-error" style={{marginBottom:8}}>{t.locError}</div>}
          <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder={t.orderAddressPh}></textarea>
        </div>

        <button className="btn-gold" style={{width:'100%', justifyContent:'center'}} disabled={sending} onClick={sendOrder}>
          {sending ? t.sending : t.confirmOrder}
        </button>
        <p className="order-hint">{t.orderHint}</p>
      </div>
    </div>
  );
}

/* ============================================================ PRODUCT CARD */
function ProductCard({ perfume, lang, categories, settings, onOrder, selectable, selected, onToggle }){
  const t = T[lang];
  const cat = categories.find(c => c.id === perfume.categoryId);
  const discountAmount = discountAmountValue(perfume);
  return (
    <div className="card" data-selected={selected ? "true" : undefined}>
      <div className="imgwrap">
        {(perfume.image || perfume.imageUrl || perfume.id) ? <img src={perfume.image || perfume.imageUrl || `/api/image?id=${encodeURIComponent(perfume.id)}`} alt={pick(perfume, lang, 'name')} loading="lazy" decoding="async" onError={(e)=>{e.currentTarget.style.display='none';}} /> : (
          <svg className="placeholder" viewBox="0 0 60 110">
            <rect x="24" y="4" width="12" height="16" fill="var(--gold-2)" />
            <rect x="26" y="20" width="8" height="8" fill="var(--gold-2)" />
            <rect x="18" y="28" width="24" height="76" fill="var(--gold-2)" />
          </svg>
        )}
        {selectable && perfume.available && (
          <button type="button" className={"pick-btn " + (selected ? "on" : "")} aria-pressed={!!selected}
            aria-label={selected ? t.blendSelected : t.blendSelect} onClick={() => onToggle(perfume.id)}>
            <span className="box">{selected ? "✓" : ""}</span>
            <span className="lbl">{selected ? t.blendSelected : t.blendSelect}</span>
          </button>
        )}
        <span className={"badge " + (perfume.available ? "ok" : "out")}>{perfume.available ? t.inStock : t.outOfStock}</span>
      </div>
      <div className="body">
        {cat && <div className="cat-label">{pick(cat, lang, 'name')}</div>}
        <h3>{pick(perfume, lang, 'name')}</h3>
        {pick(perfume, lang, 'notes') && <div className="notes">{t.notesLabel} {pick(perfume, lang, 'notes')}</div>}
        <div className="row">
          {(() => {
            const sizes = getSizes(perfume, t);
            if(sizes.length === 0){
              const disc = discountedPrice(perfume);
              return (
                <div className="price price-stack">
                  {discountAmount > 0 && <span className="price-old">{settings.currency}{perfume.price}</span>}
                  <span className="price-current">{settings.currency}{disc}</span>
                </div>
              );
            }
            const originalMin = Math.min(...sizes.map(s => {
              const raw = parseFloat(s.price) || 0;
              return discountAmount > 0 ? raw + discountAmount : raw;
            }));
            const min = Math.min(...sizes.map(s => s.price));
            return (
              <div className="price price-stack">
                {sizes.length > 1 && <span className="from">{t.startingFrom}</span>}
                {discountAmount > 0 && <span className="price-old">{settings.currency}{originalMin}</span>}
                <span className="price-current">{settings.currency}{min}</span>
              </div>
            );
          })()}
          <button className="order-btn" disabled={!perfume.available} onClick={() => onOrder(perfume)}>{t.order}</button>
        </div>
      </div>
    </div>
  );
}
ProductCard = React.memo(ProductCard);

/* ============================================================ COLLECTIONS SECTION */
function CollectionsSection({ lang, categories, perfumes, settings, onOrder, sectionRef }){
  const t = T[lang];
  const [activeCollection, setActiveCollection] = useState('all');
  const [activeBrand, setActiveBrand] = useState('all');
  const [query, setQuery] = useState('');
  useReveal();

  /*
    Two-level category system:
    - Collection: category.type === "collection" (e.g. Fresh, Unisex)
    - Brand: category.type === "brand" (or legacy category without type)
    - A brand belongs to a collection through parentId.
      Example:
        Fresh  -> { id:"fresh", type:"collection" }
        Maison Asrar -> { type:"brand", parentId:"fresh" }
        Lattafa -> { type:"brand", parentId:"unisex" }

    This keeps the existing Firestore categories collection and perfume.categoryId
    structure working, while allowing the website to show:
    Collection pills -> Search -> Brand pills -> Products.
  */

  const sorted = useMemo(
    () => [...categories].sort((a,b) => (a.order||0)-(b.order||0)),
    [categories]
  );

  const collections = useMemo(
    () => sorted.filter(c => c.type === 'collection' || c.isCollection === true),
    [sorted]
  );

  // Existing categories without a type remain usable as brands, so old Firebase data
  // does not break. Only categories explicitly marked as collections are removed here.
  const brands = useMemo(
    () => sorted.filter(c => !(c.type === 'collection' || c.isCollection === true)),
    [sorted]
  );

  const visibleBrands = useMemo(() => {
    if(activeCollection === 'all') return brands;
    return brands.filter(b =>
      (b.parentId || b.parent_id || b.collectionId || b.collection_id || '') === activeCollection
    );
  }, [brands, activeCollection]);

  const nonOilPerfumes = useMemo(
    () => perfumes.filter(p => !p.isOil),
    [perfumes]
  );

  const sortedPerfumes = useMemo(() => {
    let byCategory = nonOilPerfumes;

    if(activeBrand !== 'all'){
      byCategory = nonOilPerfumes.filter(p => p.categoryId === activeBrand);
    } else if(activeCollection !== 'all'){
      const brandIds = new Set(visibleBrands.map(b => b.id));
      byCategory = nonOilPerfumes.filter(p => brandIds.has(p.categoryId));
    }

    const q = query.trim().toLowerCase();
    const filtered = q === '' ? byCategory : byCategory.filter(p =>
      ['name_ckb','name_ar','name_en','notes_ckb','notes_ar','notes_en'].some(f =>
        (p[f] || '').toLowerCase().includes(q)
      )
    );

    return [...filtered].sort((a,b) => (a.order||0)-(b.order||0));
  }, [nonOilPerfumes, activeBrand, activeCollection, visibleBrands, query]);

  const q = query.trim();

  function chooseCollection(id){
    setActiveCollection(id);
    setActiveBrand('all');
  }

  function chooseBrand(id){
    setActiveBrand(id);
  }

  return (
    <section className="section" id="collections" ref={sectionRef}>
      <div className="container">
        <div className="section-head reveal">
          <div className="eyebrow">{t.collEyebrow}</div>
          <h2>{t.collTitle}</h2>
          <div className="divider"></div>
        </div>

        {/* Top level: Collections */}
        <div className="cat-row">
          <button
            className={"cat-pill " + (activeCollection==='all' ? 'active':'')}
            onClick={() => chooseCollection('all')}
          >
            {t.allCat}
          </button>
          {collections.map(c => (
            <button
              key={c.id}
              className={"cat-pill " + (activeCollection===c.id ? 'active':'')}
              onClick={() => chooseCollection(c.id)}
            >
              {pick(c, lang, 'name')}
            </button>
          ))}
        </div>

        {/* Search stays between Collections and Brands */}
        <div className="collection-search">
          <span className="icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold-2)" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          </span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.perfSearchPh} />
        </div>

        {/* Second level: Brands belonging to the selected Collection */}
        <div className="cat-row">
          <button
            className={"cat-pill " + (activeBrand==='all' ? 'active':'')}
            onClick={() => chooseBrand('all')}
          >
            {t.allCat}
          </button>
          {visibleBrands.map(b => (
            <button
              key={b.id}
              className={"cat-pill " + (activeBrand===b.id ? 'active':'')}
              onClick={() => chooseBrand(b.id)}
            >
              {pick(b, lang, 'name')}
            </button>
          ))}
        </div>

        {sortedPerfumes.length === 0 ? (
          <div className="empty">{q === '' ? t.noItems : t.noSearchItems}</div>
        ) : (
          <div className="grid">
            {sortedPerfumes.map(p => (
              <ProductCard key={p.id} perfume={p} lang={lang} categories={categories} settings={settings} onOrder={onOrder} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}


/* ============================================================ BLEND ORDER MODAL */
function BlendOrderModal({ lang, items, settings, onRemove, onClose, onSent }){
  const t = T[lang];
  const [sizeIdx, setSizeIdx] = useState({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [locUrl, setLocUrl] = useState('');
  const [locStatus, setLocStatus] = useState('idle');
  const [touched, setTouched] = useState(false);

  const rows = items.map(p => {
    const sizes = getSizes(p, t);
    const idx = Math.min(sizeIdx[p.id] || 0, Math.max(sizes.length - 1, 0));
    const sz = sizes[idx] || { label: '', price: discountedPrice(p) };
    return { p, sizes, idx, sz };
  });
  const enough = items.length >= 2;
  const valid = enough && name.trim().length > 0 && phone.trim().length > 0;

  function getLocation(){
    if(!navigator.geolocation){ setLocStatus('error'); return; }
    setLocStatus('loading');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocUrl(`https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`);
        setLocStatus('got');
      },
      () => setLocStatus('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function itemLine(r){
    const nm = pick(r.p, lang, 'name');
    const price = `${settings.currency}${r.sz.price}`;
    return `🌸 ${nm} — ${r.sz.label ? r.sz.label + ' · ' : ''}${price}`;
  }

  function buildMessage(){
    const head = {
      ckb: `سلاڤ، دفێت ڤان گوڵاڤێن ڕوون پێکڤە تێکەل بکەم و بکڕم:`,
      ar: `مرحباً، أرغب بخلط العطور الزيتية التالية وطلبها:`,
      en: `Hello, I'd like to order a blend of these oil perfumes:`,
    };
    const addrLabel = lang === 'ar' ? 'العنوان' : (lang === 'en' ? 'Address' : (t.orderAddress || t.orderLocation));
    const lines = [
      head[lang],
      ...rows.map(itemLine),
      ``,
      `👤 ${t.orderName}: ${name}`,
      `📞 ${t.orderPhone}: ${phone}`,
      address ? `📍 ${addrLabel}: ${address}` : null,
      locUrl ? `🗺️ ${t.orderLocation}: ${locUrl}` : null,
    ];
    return lines.filter(l => l !== null).join('\n');
  }

  function sendOrder(){
    setTouched(true);
    if(!valid) return;
    const waUrl = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(buildMessage())}`;
    window.open(waUrl, '_blank');
    onSent();
  }

  return (
    <div className="overlay" onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="close" onClick={onClose}>&times;</button>
        <h3>{t.blendTitle}</h3>
        <div className="desc">{t.blendIntro}</div>

        <div className="blend-list">
          {rows.map(r => (
            <div className="blend-item" key={r.p.id}>
              <div className="blend-item-top">
                <img src={r.p.image || r.p.imageUrl || `/api/image?id=${encodeURIComponent(r.p.id)}`} alt={pick(r.p, lang, 'name')} onError={(e)=>{e.currentTarget.style.visibility='hidden';}} />
                <div className="blend-item-name">{pick(r.p, lang, 'name')}</div>
                <button type="button" className="blend-remove" aria-label={t.blendRemove} title={t.blendRemove} onClick={() => onRemove(r.p.id)}>&times;</button>
              </div>
              {r.sizes.length > 0 && (
                <div className="blend-sizes">
                  {r.sizes.map((sz, i) => (
                    <button key={sz.id != null ? sz.id : i} type="button"
                      className={"blend-size " + (i === r.idx ? 'active' : '')}
                      onClick={() => setSizeIdx(prev => ({ ...prev, [r.p.id]: i }))}>
                      {sz.label} · <span dir="ltr">{settings.currency}{sz.price}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {!enough && <div className="field-error" style={{marginBottom:14}}>{t.blendNeedMore}</div>}

        <div className="field">
          <label>{t.orderName}</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t.orderNamePh} />
          {touched && !name.trim() && <div className="field-error">{t.orderRequired}</div>}
        </div>

        <div className="field">
          <label>{t.orderPhone}</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t.orderPhonePh} />
          {touched && !phone.trim() && <div className="field-error">{t.orderRequired}</div>}
        </div>

        <div className="field">
          <label>{t.orderLocation}</label>
          <button type="button" className={"loc-btn " + (locStatus==='got' ? 'got' : '')} onClick={getLocation}>
            📍 {locStatus==='loading' ? t.locLoading : locStatus==='got' ? t.locGot : t.locBtn}
          </button>
          {locStatus === 'error' && <div className="field-error" style={{marginBottom:8}}>{t.locError}</div>}
          <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder={t.orderAddressPh}></textarea>
        </div>

        <button className="btn-gold" style={{width:'100%', justifyContent:'center'}} disabled={!enough} onClick={sendOrder}>
          {t.confirmOrder}
        </button>
        <p className="order-hint">{t.blendHint}</p>
      </div>
    </div>
  );
}

/* ============================================================ OIL / BLENDED PERFUMES SECTION */
function OilPerfumesSection({ lang, categories, perfumes, settings, onOrder }){
  const t = T[lang];
  useReveal();
  const [selectedIds, setSelectedIds] = useState([]);
  const [blendOpen, setBlendOpen] = useState(false);

  const oilPerfumes = useMemo(() => {
    return perfumes.filter(p => p.isOil).sort((a,b) => (a.order||0)-(b.order||0));
  }, [perfumes]);

  const toggle = useCallback((id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  // Keep the order the customer picked them in; drop anything that is gone or out of stock.
  const selected = useMemo(
    () => selectedIds.map(id => oilPerfumes.find(p => p.id === id)).filter(p => p && p.available),
    [selectedIds, oilPerfumes]
  );

  useEffect(() => { if(blendOpen && selected.length === 0) setBlendOpen(false); }, [blendOpen, selected.length]);

  if(oilPerfumes.length === 0) return null;

  return (
    <section className="section" id="oil-collection">
      <div className="container">
        <div className="section-head reveal">
          <div className="eyebrow">
            <span className="oil-eyebrow-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold-2)" strokeWidth="1.8"><path d="M12 2c3 4 6 7.5 6 11.5A6 6 0 0 1 6 13.5C6 9.5 9 6 12 2Z"/></svg>
            </span>
            {t.oilEyebrow}
          </div>
          <h2>{t.oilTitle}</h2>
          <p className="oil-lead">{t.oilLead}</p>
          <div className="divider"></div>
        </div>
        <div className="oil-panel reveal">
          <div className="grid">
            {oilPerfumes.map(p => (
              <ProductCard key={p.id} perfume={p} lang={lang} categories={categories} settings={settings} onOrder={onOrder}
                selectable={true} selected={selectedIds.includes(p.id)} onToggle={toggle} />
            ))}
          </div>
        </div>
      </div>

      {selected.length > 0 && !blendOpen && (
        <div className={"blend-bar" + (selected.length >= 2 ? " ready" : "")}>
          <div className="blend-bar-info">
            <span className="blend-count">{selected.length}</span>
            <span className="blend-bar-text">{selected.length < 2 ? t.blendNeedMore : t.blendCountLabel}</span>
          </div>
          <div className="blend-bar-actions">
            <button type="button" className="blend-clear" onClick={() => setSelectedIds([])}>{t.blendClear}</button>
            <button type="button" className="btn-gold blend-go" disabled={selected.length < 2} onClick={() => setBlendOpen(true)}>{t.blendBtn}</button>
          </div>
        </div>
      )}

      {blendOpen && selected.length > 0 && (
        <BlendOrderModal
          lang={lang} items={selected} settings={settings}
          onRemove={toggle}
          onClose={() => setBlendOpen(false)}
          onSent={() => { setBlendOpen(false); setSelectedIds([]); }}
        />
      )}
    </section>
  );
}

/* ============================================================ FOOTER */
function SocialIcon({ type }){
  const icons = {
    whatsapp: <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--gold-2)"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.44 1.32 4.94L2.05 22l5.29-1.38a9.9 9.9 0 0 0 4.7 1.19h.01c5.46 0 9.9-4.45 9.9-9.9C21.96 6.45 17.5 2 12.04 2Zm5.8 14.03c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.13-4.9-4.32-.14-.19-1.17-1.55-1.17-2.96s.73-2.1.99-2.39c.26-.29.57-.36.76-.36l.55.01c.17.01.41-.06.64.49.24.58.81 2 .88 2.14.07.14.12.31.02.5-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.34 1.44.29.15.46.13.63-.08.17-.2.72-.84.91-1.13.19-.29.38-.24.64-.14.26.1 1.66.78 1.94.93.29.14.48.21.55.33.07.12.07.68-.17 1.36Z"/></svg>,
    instagram: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold-2)" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.9" fill="var(--gold-2)"/></svg>,
    snapchat: <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--gold-2)"><path d="M12 2c2.9 0 4.7 2.2 4.7 4.8 0 1 0 2.3-.1 3 1 .1 1.5.6 1.5 1 0 .6-.9 1-1.6 1.2-.2.6.4 1.4 1.7 1.8.3.1.5.4.3.7-.3.6-1.3.9-2 1-.1.4-.2 1-1 1-.5 0-1-.2-1.7-.2-.8 0-1.4.9-3.8.9s-3-.9-3.8-.9c-.7 0-1.2.2-1.7.2-.8 0-.9-.6-1-1-.7-.1-1.7-.4-2-1-.2-.3 0-.6.3-.7 1.3-.4 1.9-1.2 1.7-1.8-.7-.2-1.6-.6-1.6-1.2 0-.4.5-.9 1.5-1-.1-.7-.1-2-.1-3C7.3 4.2 9.1 2 12 2Z"/></svg>,
    tiktok: <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--gold-2)"><path d="M14 2h2.5c.2 1.6 1.3 3 3.5 3.3v2.6c-1.3 0-2.5-.4-3.5-1.1v6.4c0 3.1-2.5 5.6-5.6 5.6S5.3 16.3 5.3 13.2c0-3 2.3-5.4 5.3-5.6v2.7c-1.5.2-2.7 1.5-2.7 2.9 0 1.7 1.3 3 3 3s3-1.3 3-3V2Z"/></svg>,
    map: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold-2)" strokeWidth="1.6"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>,
  };
  return icons[type] || null;
}

function Footer({ lang, settings, onAdminClick }){
  const t = T[lang];
  const tapCount = useRef(0);
  const tapTimer = useRef(null);

  function handleSecretTap(){
    tapCount.current += 1;
    if(tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 1500);
    if(tapCount.current >= 5){
      tapCount.current = 0;
      onAdminClick();
    }
  }

  return (
    <footer>
      <div className="foot-grid">
        <div>
          <h4>{t.brand} {t.brandSub}</h4>
          <p>{t.aboutText}</p>
        </div>
        <div>
          <h4>{t.footFollow}</h4>
          <div className="social-row">
            <a href={"https://wa.me/" + settings.whatsapp} target="_blank" rel="noopener" title="WhatsApp"><SocialIcon type="whatsapp" /></a>
            <a href={"https://instagram.com/" + settings.instagram} target="_blank" rel="noopener" title="Instagram"><SocialIcon type="instagram" /></a>
            <a href={"https://snapchat.com/add/" + settings.snapchat} target="_blank" rel="noopener" title="Snapchat"><SocialIcon type="snapchat" /></a>
            <a href={"https://tiktok.com/@" + settings.tiktok} target="_blank" rel="noopener" title="TikTok"><SocialIcon type="tiktok" /></a>
          </div>
        </div>
        <div>
          <h4>{t.footContact}</h4>
          <a href={"https://wa.me/" + settings.whatsapp} target="_blank" rel="noopener">{t.whatsappUs}: +{settings.whatsapp}</a>
          <a href={settings.locationUrl} target="_blank" rel="noopener">{t.viewMap}</a>
        </div>
      </div>
      <div className="foot-bottom">
        <div onClick={handleSecretTap} style={{userSelect:'none', cursor:'default'}}>© {new Date().getFullYear()} Omar Perfume — {t.rights}</div>
      </div>
    </footer>
  );
}

/* ============================================================ TOAST */
function Toast({ msg }){
  if(!msg) return null;
  return <div className="toast">{msg}</div>;
}

/* ============================================================ ADMIN LOGIN */
function AdminLogin({ lang, settings, onSuccess, onClose }){
  const t = T[lang];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e){
    e.preventDefault();
    if(busy || !email.trim() || !password) return;
    setBusy(true);
    setAuthError('');
    try {
      const result = await apiJson(AUTH_API, {
        method:'POST',
        body: JSON.stringify({ email: email.trim(), password })
      });
      if(!result.authenticated) throw new Error('Not authorized');
      onSuccess();
    } catch(err) {
      console.error('Admin authentication failed', err);
      setAuthError(t.authFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="close" onClick={onClose}>&times;</button>
        <h3>{t.adminEnter}</h3>
        <form onSubmit={submit}>
          <div className="field">
            <input type="email" autoComplete="username" placeholder={t.adminEmail}
              value={email} onChange={e => { setEmail(e.target.value); setAuthError(''); }} disabled={busy} />
          </div>
          <div className="field">
            <input type="password" autoComplete="current-password" placeholder={t.adminPassword}
              value={password} onChange={e => { setPassword(e.target.value); setAuthError(''); }} disabled={busy} />
          </div>
          {authError && <div className="banner warn">{authError}</div>}
          <button type="submit" className="btn-gold" style={{width:'100%', justifyContent:'center'}} disabled={busy || !email.trim() || !password}>
            {busy ? t.sending : t.loginSubmit}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ============================================================ IMAGE UPLOAD (resizes + base64-encodes client-side) */
/* ============================================================ ROW ACTION MENU
   A single ☰ trigger that opens a small dropdown with actions, instead of
   several separate buttons crowding a row. Uses the same reliable
   ref + document-listener pattern as LangSwitch (no overlay backdrop),
   which closes correctly on the first click in every language/direction. */
function RowMenu({ items }){
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e){ if(ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, []);

  return (
    <div className="row-menu" ref={ref}>
      <button type="button" className={"row-menu-btn " + (open ? "open" : "")} onClick={() => setOpen(o => !o)} aria-label="menu">☰</button>
      {open && (
        <div className="row-menu-list">
          {items.map((it, i) => it.sep ? (
            <div className="sep" key={"sep" + i}></div>
          ) : (
            <button key={i} type="button" className={it.danger ? "danger" : ""} onClick={() => { setOpen(false); it.onClick(); }}>
              <span>{it.icon}</span><span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ImageUpload({ lang, value, onChange }){
  const t = T[lang];
  const inputRef = useRef(null);

  function handleFile(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 700;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        onChange(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="upload-box" onClick={() => inputRef.current.click()}>
      {value && <img src={value} alt="" />}
      <div style={{fontSize:12, color:'var(--muted)'}}>{t.uploadImg}</div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} />
    </div>
  );
}

/* ============================================================ CATEGORY FORM */
function CategoryForm({ lang, category, onSave, onClose }){
  const t = T[lang];
  const [form, setForm] = useState(category || { name_ckb:'', name_ar:'', name_en:'', order:1 });
  const upd = (k,v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="overlay" onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="close" onClick={onClose}>&times;</button>
        <h3>{category ? t.editCat : t.addCat}</h3>
        <div className="field"><label>{t.nameCkb}</label><input value={form.name_ckb} onChange={e => upd('name_ckb', e.target.value)} /></div>
        <div className="field"><label>{t.nameAr}</label><input value={form.name_ar} onChange={e => upd('name_ar', e.target.value)} /></div>
        <div className="field"><label>{t.nameEn}</label><input value={form.name_en} onChange={e => upd('name_en', e.target.value)} /></div>
        <div className="save-bar">
          <button className="btn-plain" onClick={onClose}>{t.cancel}</button>
          <button className="btn-gold" onClick={() => onSave(form)}>{t.save}</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ PERFUME FORM */
function PerfumeForm({ lang, perfume, categories, onSave, onClose }){
  const t = T[lang];
  const [form, setForm] = useState(() => {
    if(perfume){
      return {
        ...perfume,
        discountAmount: discountAmountValue(perfume) || '',
        sizes: defaultSizesFromLegacy(perfume, t)
      };
    }
    return {
      name_ckb:'', name_ar:'', name_en:'',
      notes_ckb:'', notes_ar:'', notes_en:'',
      price:'', categoryId: categories[0] ? categories[0].id : '',
      available:true, image:'', order:1, discountAmount:'', isOil:false,
      sizes: [{ id: uid(), label: t.size_full, price: '' }]
    };
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const upd = (k,v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave(){
    if(saving) return;
    setSaving(true);
    setSaveError('');
    try{
      await onSave({ ...form, discountAmount: Math.max(0, parseFloat(form.discountAmount) || 0), discountPercent: undefined });
    }catch(err){
      console.error('Perfume save failed', err);
      setSaveError(err && err.message ? err.message : 'Save failed');
      setSaving(false);
    }
  }

  function updSize(id, field, val){
    setForm(f => ({ ...f, sizes: f.sizes.map(s => s.id === id ? { ...s, [field]: val } : s) }));
  }
  function addSize(){
    setForm(f => ({ ...f, sizes: [...f.sizes, { id: uid(), label: '', price: '' }] }));
  }
  function removeSize(id){
    setForm(f => ({ ...f, sizes: f.sizes.filter(s => s.id !== id) }));
  }

  return (
    <div className="overlay" onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide">
        <button className="close" onClick={onClose}>&times;</button>
        <h3>{perfume ? t.editPerf : t.addPerf}</h3>

        <div className="field-row">
          <ImageUpload lang={lang} value={form.image} onChange={v => upd('image', v)} />
          <div>
            <div className="field">
              <label>{t.categoryField}</label>
              <select value={form.categoryId} onChange={e => upd('categoryId', e.target.value)}>
                {categories.map(c => <option key={c.id} value={c.id}>{pick(c, lang, 'name')}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t.priceField}</label>
              <input type="number" step="0.01" value={form.price} onChange={e => upd('price', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="field">
              <label>{t.discountField}</label>
              <input type="number" step="100" min="0" value={form.discountAmount || ''} onChange={e => upd('discountAmount', e.target.value)} placeholder="مثال: 5000" />
            </div>
            <div className="field" style={{display:'flex', alignItems:'center', gap:10}}>
              <div className={"toggle " + (form.available ? "on":"")} onClick={() => upd('available', !form.available)}><div className="dot"></div></div>
              <label style={{margin:0}}>{form.available ? t.markAvail : t.markOut}</label>
            </div>
            <div className="field" style={{display:'flex', alignItems:'center', gap:10}}>
              <div className={"toggle " + (form.isOil ? "on":"")} onClick={() => upd('isOil', !form.isOil)}><div className="dot"></div></div>
              <label style={{margin:0}}>{form.isOil ? t.markOil : t.markNormal}</label>
            </div>
          </div>
        </div>

        <div className="field-row3">
          <div className="field"><label>{t.nameCkb}</label><input value={form.name_ckb} onChange={e => upd('name_ckb', e.target.value)} /></div>
          <div className="field"><label>{t.nameAr}</label><input value={form.name_ar} onChange={e => upd('name_ar', e.target.value)} /></div>
          <div className="field"><label>{t.nameEn}</label><input value={form.name_en} onChange={e => upd('name_en', e.target.value)} /></div>
        </div>
        <div className="field-row3">
          <div className="field"><label>{t.notesCkb}</label><input value={form.notes_ckb} onChange={e => upd('notes_ckb', e.target.value)} /></div>
          <div className="field"><label>{t.notesAr}</label><input value={form.notes_ar} onChange={e => upd('notes_ar', e.target.value)} /></div>
          <div className="field"><label>{t.notesEn}</label><input value={form.notes_en} onChange={e => upd('notes_en', e.target.value)} /></div>
        </div>

        <div className="field">
          <label>{t.sizesEditorLabel}</label>
          {form.sizes.map(s => (
            <div className="size-editor-row" key={s.id}>
              <input className="lbl-input" placeholder={t.sizeLabelPh} value={s.label} onChange={e => updSize(s.id, 'label', e.target.value)} />
              <input className="price-input" type="number" step="0.01" placeholder={t.sizePricePh} value={s.price} onChange={e => updSize(s.id, 'price', e.target.value)} />
              <button type="button" className="size-remove" title={t.removeSize} onClick={() => removeSize(s.id)}>✕</button>
            </div>
          ))}
          <button type="button" className="add-size-btn" onClick={addSize}>+ {t.addSizeBtn}</button>
        </div>

        {saveError && <div className="banner warn" style={{marginBottom:10}}>{saveError}</div>}
        <div className="save-bar">
          <button className="btn-plain" onClick={onClose} disabled={saving}>{t.cancel}</button>
          <button className="btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ ' + t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ SETTINGS FORM */
function SettingsForm({ lang, settings, onSave }){
  const t = T[lang];
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);
  const upd = (k,v) => setForm(f => ({ ...f, [k]: v }));

  function save(){
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="field-row">
        <div className="field"><label>{t.settingsWa} (964XXXXXXXXXX)</label><input value={form.whatsapp} onChange={e => upd('whatsapp', e.target.value)} /></div>
        <div className="field"><label>{t.settingsCur}</label><input value={form.currency} onChange={e => upd('currency', e.target.value)} /></div>
      </div>
      <div className="field-row">
        <div className="field"><label>{t.settingsIg}</label><input value={form.instagram} onChange={e => upd('instagram', e.target.value)} /></div>
        <div className="field"><label>{t.settingsSnap}</label><input value={form.snapchat} onChange={e => upd('snapchat', e.target.value)} /></div>
      </div>
      <div className="field-row">
        <div className="field"><label>{t.settingsTik}</label><input value={form.tiktok} onChange={e => upd('tiktok', e.target.value)} /></div>
      </div>
      <div className="field"><label>{t.settingsLoc}</label><input value={form.locationUrl} onChange={e => upd('locationUrl', e.target.value)} /></div>
      <div className="save-bar">
        <button className="btn-gold" onClick={save}>{saved ? t.saved : t.save}</button>
      </div>
    </div>
  );
}

/* ============================================================ ADMIN DASHBOARD */
function AdminDashboard({ lang, setLang, data, onLogout, onExit }){
  const t = T[lang];
  const { categories, perfumes, settings, visits, api } = data;
  const [tab, setTab] = useState('perfumes');
  const [editingCat, setEditingCat] = useState(null);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingPerf, setEditingPerf] = useState(null);
  const [showPerfForm, setShowPerfForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [toast, setToast] = useState('');
  const [perfSearch, setPerfSearch] = useState('');
  const [catSearch, setCatSearch] = useState('');
  const [perfCatFilter, setPerfCatFilter] = useState('all');

  function matchesSearch(item, query, fields){
    if(!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return fields.some(f => (item[f] || '').toLowerCase().includes(q));
  }
  const byCategory = perfCatFilter === 'all' ? perfumes : perfumes.filter(p => p.categoryId === perfCatFilter);
  const filteredPerfumes = byCategory.filter(p => matchesSearch(p, perfSearch, ['name_ckb','name_ar','name_en','notes_ckb','notes_ar','notes_en']));
  const filteredCategories = categories.filter(c => matchesSearch(c, catSearch, ['name_ckb','name_ar','name_en']));
  const sortedCatsForFilter = [...categories].sort((a,b) => (a.order||0)-(b.order||0));

  function flash(msg){ setToast(msg); setTimeout(() => setToast(''), 1800); }

  async function saveCategory(form){
    if(editingCat) await api.updateCategory(editingCat.id, form);
    else await api.addCategory({ ...form, order: categories.length + 1 });
    setShowCatForm(false); setEditingCat(null); flash(t.saved);
  }
  async function savePerfume(form){
    const payload = { ...form };
    delete payload.id;
    delete payload.discountPercent;
    if(editingPerf && payload.image === editingPerf.image) delete payload.image;
    if(editingPerf){
      await api.updatePerfume(editingPerf.id, payload);
    } else {
      await api.addPerfume({ ...payload, order: perfumes.length + 1 });
    }
    setShowPerfForm(false); setEditingPerf(null); flash(t.saved);
  }
  async function doDelete(){
    if(confirmDel.type === 'cat') await api.deleteCategory(confirmDel.id);
    else await api.deletePerfume(confirmDel.id);
    setConfirmDel(null); flash(t.saved);
  }
  async function togglePerfume(p){
    await api.updatePerfume(p.id, { available: !p.available });
  }

  return (
    <div className="admin-shell" dir={T[lang].dir}>
      <div className="admin-top">
        <div className="brand">
          <img src={"logo.jpg"} alt="" style={{width:36,height:36}} />
          <div className="name" style={{fontSize:17}}>{t.dashTitle}</div>
        </div>
        <div style={{display:'flex', gap:10, alignItems:'center'}}>
          <LangSwitch lang={lang} setLang={setLang} />
          <RowMenu items={[
            { icon:'🌐', label:t.viewSite, onClick:onExit },
            { sep:true },
            { icon:'⎋', label:t.logout, danger:true, onClick:onLogout },
          ]} />
        </div>
      </div>

      <div className="admin-tabs">
        <button className={tab==='perfumes'?'active':''} onClick={() => setTab('perfumes')}>{t.tabPerf}</button>
        <button className={tab==='categories'?'active':''} onClick={() => setTab('categories')}>{t.tabCats}</button>
        <button className={tab==='settings'?'active':''} onClick={() => setTab('settings')}>{t.tabSettings}</button>
      </div>

      <div className="admin-body">
        <div className="stat-row">
          <div className="stat-card"><div className="n">{perfumes.length}</div><div className="l">{t.tabPerf}</div></div>
          <div className="stat-card"><div className="n">{categories.length}</div><div className="l">{t.tabCats}</div></div>
          <div className="stat-card"><div className="n">{visits}</div><div className="l">{t.visits}</div></div>
        </div>

        {tab === 'perfumes' && (
          <div>
            <div className="save-bar" style={{justifyContent:'flex-start', marginBottom:16}}>
              <button className="btn-gold" onClick={() => { setEditingPerf(null); setShowPerfForm(true); }}>+ {t.addPerf}</button>
            </div>
            <div className="admin-search">
              <input value={perfSearch} onChange={e => setPerfSearch(e.target.value)} placeholder={t.searchPh} />
            </div>
            <div className="cat-row" style={{marginBottom:14}}>
              <button className={"cat-pill " + (perfCatFilter==='all' ? 'active':'')} onClick={() => setPerfCatFilter('all')}>{t.allCat}</button>
              {sortedCatsForFilter.map(c => (
                <button key={c.id} className={"cat-pill " + (perfCatFilter===c.id ? 'active':'')} onClick={() => setPerfCatFilter(c.id)}>{pick(c, lang, 'name')}</button>
              ))}
            </div>
            {filteredPerfumes.length === 0 && <div className="admin-empty">{t.noResults}</div>}
            <div className="admin-list">
              {filteredPerfumes.map(p => (
                <div className="admin-row" key={p.id}>
                  {p.image ? <img src={p.image} /> : <div style={{width:44,height:44,borderRadius:8,background:'var(--surface-2)'}}></div>}
                  <div className="info">
                    <div className="t">{pick(p, lang, 'name')}</div>
                    <div className="s">
                      {settings.currency}{Math.min(...getSizes(p, t).map(s => s.price), p.price || Infinity)}
                      {" · "}{pick(categories.find(c => c.id === p.categoryId) || {}, lang, 'name') || '—'}
                      {discountAmountValue(p) > 0 ? ` · -${discountAmountValue(p)} ${settings.currency}` : ''}
                      {p.isOil ? ` · ${t.markOil}` : ''}
                    </div>
                  </div>
                  <div className={"toggle " + (p.available ? "on":"")} onClick={() => togglePerfume(p)} title={p.available ? t.markAvail : t.markOut}><div className="dot"></div></div>
                  <RowMenu items={[
                    { icon:'✎', label:t.editAction, onClick:() => { setEditingPerf(p); setShowPerfForm(true); } },
                    { sep:true },
                    { icon:'🗑', label:t.deleteAction, danger:true, onClick:() => setConfirmDel({ type:'perf', id:p.id }) },
                  ]} />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'categories' && (
          <div>
            <div className="save-bar" style={{justifyContent:'flex-start', marginBottom:16}}>
              <button className="btn-gold" onClick={() => { setEditingCat(null); setShowCatForm(true); }}>+ {t.addCat}</button>
            </div>
            <div className="admin-search">
              <input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder={t.searchPh} />
            </div>
            {filteredCategories.length === 0 && <div className="admin-empty">{t.noResults}</div>}
            <div className="admin-list">
              {filteredCategories.map(c => (
                <div className="admin-row" key={c.id}>
                  <div className="info">
                    <div className="t">{pick(c, lang, 'name')}</div>
                    <div className="s">{perfumes.filter(p => p.categoryId === c.id).length} {t.tabPerf}</div>
                  </div>
                  <RowMenu items={[
                    { icon:'✎', label:t.editAction, onClick:() => { setEditingCat(c); setShowCatForm(true); } },
                    { sep:true },
                    { icon:'🗑', label:t.deleteAction, danger:true, onClick:() => setConfirmDel({ type:'cat', id:c.id }) },
                  ]} />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'settings' && <SettingsForm lang={lang} settings={settings} onSave={(s) => { api.saveSettings(s); flash(t.saved); }} />}
      </div>

      {showCatForm && <CategoryForm lang={lang} category={editingCat} onSave={saveCategory} onClose={() => { setShowCatForm(false); setEditingCat(null); }} />}
      {showPerfForm && <PerfumeForm lang={lang} perfume={editingPerf} categories={categories} onSave={savePerfume} onClose={() => { setShowPerfForm(false); setEditingPerf(null); }} />}
      {confirmDel && (
        <div className="overlay" onClick={(e) => { if(e.target===e.currentTarget) setConfirmDel(null); }}>
          <div className="modal">
            <h3>{t.delete}</h3>
            <p className="desc">{t.confirmDelete}</p>
            <div className="save-bar">
              <button className="btn-plain" onClick={() => setConfirmDel(null)}>{t.cancel}</button>
              <button className="btn-gold" style={{background:'var(--danger)'}} onClick={doDelete}>{t.delete}</button>
            </div>
          </div>
        </div>
      )}
      <Toast msg={toast} />
    </div>
  );
}

/* ============================================================ APP ROOT */
function App(){
  const [lang, setLang] = useLocalState('op_lang', 'ckb');
  const [showLogin, setShowLogin] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState('site');
  const [orderPerfume, setOrderPerfume] = useState(null);
  const data = useData();
  const collectionsRef = useRef(null);

  const [showSplash, setShowSplash] = useState(true);
  const [siteVisible, setSiteVisible] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('dir', T[lang].dir);
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : (lang === 'ar' ? 'ar' : 'ku'));
  }, [lang]);

  useEffect(() => {
    // Cinematic entrance: bottle-only splash, then reveal the rest of the site.
    const revealTimer = setTimeout(() => setSiteVisible(true), 2400);
    const removeSplashTimer = setTimeout(() => setShowSplash(false), 3300);
    return () => { clearTimeout(revealTimer); clearTimeout(removeSplashTimer); };
  }, []);

  function scrollToCollections(){
    if(collectionsRef.current) collectionsRef.current.scrollIntoView({ behavior:'smooth' });
  }

  function scrollToOil(){
    const el = document.getElementById('oil-collection');
    if(!el) return;
    el.scrollIntoView({ behavior:'smooth', block:'start' });
    const panel = el.querySelector('.oil-panel');
    if(panel){
      panel.classList.remove('flash');
      void panel.offsetWidth;
      panel.classList.add('flash');
      setTimeout(() => panel.classList.remove('flash'), 2200);
    }
  }

  function openAdmin(){
    if(authed) setView('admin');
    else setShowLogin(true);
  }

  async function logoutAdmin(){
    try { await apiJson(AUTH_API, { method:'DELETE' }); } catch(_) {}
    setAuthed(false);
    setView('site');
  }

  if(view === 'admin'){
    return (
      <AdminDashboard
        lang={lang} setLang={setLang} data={data}
        onLogout={logoutAdmin}
        onExit={() => setView('site')}
      />
    );
  }

  const hasOil = data.perfumes.some(p => p.isOil);

  return (
    <div>
      {showSplash && <SplashScreen fadingOut={siteVisible} />}
      <div className={"site-shell" + (siteVisible ? " visible" : "")}>
        <ScrollProgress />
        <Header lang={lang} setLang={setLang} showOil={hasOil} onOil={scrollToOil} />
        {hasOil && (
          <button type="button" className="oil-strip" onClick={scrollToOil}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2c3 4 6 7.5 6 11.5A6 6 0 0 1 6 13.5C6 9.5 9 6 12 2Z"/></svg>
            <span>{T[lang].oilTitle}</span>
            <span className="arr">↓</span>
          </button>
        )}
        <Hero lang={lang} onBrowse={scrollToCollections} settings={data.settings} showOil={hasOil} onOil={scrollToOil} />
        <OilPerfumesSection
          lang={lang} categories={data.categories} perfumes={data.perfumes} settings={data.settings}
          onOrder={setOrderPerfume}
        />
        <CollectionsSection
          lang={lang} categories={data.categories} perfumes={data.perfumes} settings={data.settings}
          onOrder={setOrderPerfume} sectionRef={collectionsRef}
        />
        <Footer lang={lang} settings={data.settings} onAdminClick={openAdmin} />
        {orderPerfume && <OrderModal lang={lang} perfume={orderPerfume} settings={data.settings} onClose={() => setOrderPerfume(null)} />}
        {showLogin && (
          <AdminLogin
            lang={lang} settings={data.settings}
            onSuccess={() => { setAuthed(true); setView('admin'); setShowLogin(false); }}
            onClose={() => setShowLogin(false)}
          />
        )}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
