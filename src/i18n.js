// Titles that count as "not renamed", so they follow the language switch.
export const DEFAULT_TITLES = ['Our Class Aquarium', 'Sinfimiz akvariumi'];

export const STRINGS = {
  en: {
    lock: 'Lock', lockTitle: 'Enter PIN', lockSub: 'Teacher PIN required to open the aquarium', wrongPin: 'Wrong PIN, try again',
    clear: 'Clear', del: 'Delete',
    tooMany: 'Too many tries. Wait 10 minutes and try again.', pinNotSet: 'The PIN has not been set up in the database yet.',
    offline: "Can't reach the server. Check the internet connection.", syncError: 'Changes are not being saved. Check the internet connection.',
    needsUpdate: 'This change needs a database update: re-run supabase/fishtank.sql in the Supabase SQL Editor.',
    className: 'Class name', hint: 'Tap the title to rename · Tap a fish to feed it', feedAll: 'Feed everyone',
    empty: 'Add a student to put the first fish in the tank', newName: 'New student name', addFish: 'Add fish',
    name: 'Name', fishType: 'Fish type', color: 'Color', undo: 'Undo a feed (−1)',
    decorHelp: 'Tap an item below to add it. In the tank, drag a decoration to move it, drag a corner handle to resize, and tap it for more options.',
    forwardShort: 'Front', backShort: 'Back', flip: 'Flip', remove: 'Remove', forward: 'Bring forward', backward: 'Send backward',
    resetSizes: 'Reset sizes', resetTitle: 'Reset every fish to the smallest size?',
    resetBody: "This sets every student's feed count back to 0. It can't be undone.", cancel: 'Cancel', resetConfirm: 'Reset all fish',
    sunny: 'Sunny Reef', night: 'Night Glow', students: 'Students', decorate: 'Decorate',
    fish: n => n + ' fish', testTank: 'Test aquarium',
    namesAlways: 'Names: always', namesHover: 'Names: on hover',
    fullscreen: 'Full screen', exitFullscreen: 'Exit full screen', removeFish: 'Remove fish', tapAgain: 'Tap again to remove',
    title: 'Our Class Aquarium', maxAt: 'Max size at',
    types: { spotty: 'Spotty', scales: 'Scales', hearts: 'Hearts', waves: 'Waves', flowers: 'Flowers' },
    decor: { chest: 'Treasure chest', castle: 'Castle', cave: 'Rock cave', coral: 'Coral', seaweed: 'Tall seaweed', seagrass: 'Seagrass', rock: 'Rocks', shell: 'Pearl clam', star: 'Starfish' },
  },
  uz: {
    lock: 'Qulflash', lockTitle: 'PIN kodni kiriting', lockSub: "Akvariumni ochish uchun o'qituvchi PIN kodi kerak", wrongPin: "Noto'g'ri PIN, qayta urinib ko'ring",
    clear: 'Tozalash', del: "O'chirish",
    tooMany: "Juda ko'p urinish. 10 daqiqa kutib, qayta urinib ko'ring.", pinNotSet: "PIN kod hali bazada o'rnatilmagan.",
    offline: "Serverga ulanib bo'lmadi. Internet aloqasini tekshiring.", syncError: "O'zgarishlar saqlanmayapti. Internet aloqasini tekshiring.",
    needsUpdate: "Bu o'zgarish uchun bazani yangilash kerak: Supabase SQL Editor'da supabase/fishtank.sql faylini qayta ishga tushiring.",
    className: 'Sinf nomi', hint: "Nomini o'zgartirish uchun sarlavhaga bosing · Boqish uchun baliqqa bosing", feedAll: 'Hammani boqish',
    empty: "Birinchi baliqni qo'yish uchun o'quvchi qo'shing", newName: "Yangi o'quvchi ismi", addFish: "Qo'sh",
    name: 'Ism', fishType: 'Baliq turi', color: 'Rang', undo: 'Minus ball (−1)',
    decorHelp: "Qo'shish uchun pastdagi bezakni bosing. Akvariumda bezakni ko'chirish uchun suring, o'lchamini o'zgartirish uchun burchakdagi tutqichni suring, boshqa amallar uchun ustiga bosing.",
    forwardShort: 'Old', backShort: 'Orqa', flip: 'Burish', remove: "O'chirish", forward: 'Oldinga', backward: 'Orqaga',
    resetSizes: 'Nolga qaytarish', resetTitle: "Barcha baliqlar eng kichik o'lchamga qaytarilsinmi?",
    resetBody: "Bu har bir o'quvchining boqish sonini 0 ga qaytaradi. Buni bekor qilib bo'lmaydi.", cancel: 'Bekor qilish', resetConfirm: 'Hammasini tiklash',
    sunny: 'Quyoshli rif', night: 'Tungi nur', students: "O'quvchilar", decorate: 'Bezatish',
    fish: n => n + ' ta baliq', testTank: 'Sinov akvariumi',
    namesAlways: 'Ismlar: doim', namesHover: 'Ismlar: bosganda',
    fullscreen: "To'liq ekran", exitFullscreen: "To'liq ekrandan chiqish", removeFish: "Baliqni o'chirish", tapAgain: "O'chirish uchun yana bosing",
    title: 'Sinfimiz akvariumi', maxAt: 'Maksimum',
    types: { spotty: 'Xolli', scales: 'Tangachali', hearts: 'Yurakchali', waves: "To'lqinli", flowers: 'Gulli' },
    decor: { chest: "Xazina sandig'i", castle: 'Qasr', cave: "Tosh g'or", coral: 'Marjon', seaweed: "Baland suv o'ti", seagrass: "Dengiz o'ti", rock: 'Toshlar', shell: "Marvaridli chig'anoq", star: 'Dengiz yulduzi' },
  },
};

export const LANGS = ['en', 'uz'];
export const strings = lang => STRINGS[lang] || STRINGS.uz;
