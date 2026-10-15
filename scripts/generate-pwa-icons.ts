import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Ensure public directory exists
const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. High quality brand SVG for Al-Mustaqbal University Academic Attendance System
const brandSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064e3b" />
      <stop offset="50%" stop-color="#047857" />
      <stop offset="100%" stop-color="#022c22" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.02" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background with subtle university shield border -->
  <rect width="512" height="512" rx="104" fill="url(#bgGrad)" />
  <rect x="16" y="16" width="480" height="480" rx="90" fill="none" stroke="url(#goldGrad)" stroke-width="4" stroke-opacity="0.4" />

  <!-- Academic Shield Centerpiece -->
  <path d="M 256 70 C 330 70 380 95 390 150 C 390 280 290 380 256 410 C 222 380 122 280 122 150 C 132 95 182 70 256 70 Z" 
        fill="url(#shieldGrad)" stroke="#10b981" stroke-width="6" stroke-opacity="0.7" />

  <!-- Graduation Cap (Academic Symbol) -->
  <g transform="translate(0, -10)">
    <!-- Cap top diamond -->
    <polygon points="256,120 375,175 256,230 137,175" fill="url(#goldGrad)" filter="url(#glow)" />
    <!-- Cap skull base -->
    <path d="M 180 200 L 180 248 C 180 280 332 280 332 248 L 332 200 L 256 235 Z" fill="#047857" stroke="#fbbf24" stroke-width="3" />
    <!-- Tassel ribbon & tassel -->
    <path d="M 256 175 C 330 185 365 220 370 255" fill="none" stroke="#fef08a" stroke-width="4" stroke-linecap="round" />
    <circle cx="370" cy="265" r="8" fill="#fbbf24" />
    <path d="M 370 273 L 370 300" stroke="#fef08a" stroke-width="4" stroke-linecap="round" />
  </g>

  <!-- Attendance Verification Checkmark Symbol -->
  <g transform="translate(0, 30)">
    <circle cx="256" cy="325" r="48" fill="#10b981" />
    <circle cx="256" cy="325" r="44" fill="#065f46" stroke="#34d399" stroke-width="3" />
    <path d="M 234 325 L 249 340 L 280 310" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
  </g>

  <!-- University Arabic Initials / Subtitle Styling -->
  <text x="256" y="445" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">جامعة المستقبل</text>
  <text x="256" y="475" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#a7f3d0" text-anchor="middle" letter-spacing="2">نظام المتابعة الأكاديمي</text>
</svg>`;

// 2. Maskable SVG with safe margin padding (15% padding around content)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064e3b" />
      <stop offset="50%" stop-color="#047857" />
      <stop offset="100%" stop-color="#022c22" />
    </linearGradient>
    <linearGradient id="goldGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
  </defs>

  <!-- Full-bleed background -->
  <rect width="512" height="512" fill="url(#bgGradMask)" />

  <!-- Centered Scaled Content (80% safe zone) -->
  <g transform="translate(51.2, 51.2) scale(0.8)">
    <!-- Academic Shield Centerpiece -->
    <path d="M 256 70 C 330 70 380 95 390 150 C 390 280 290 380 256 410 C 222 380 122 280 122 150 C 132 95 182 70 256 70 Z" 
          fill="rgba(255,255,255,0.12)" stroke="#10b981" stroke-width="6" stroke-opacity="0.8" />

    <!-- Graduation Cap (Academic Symbol) -->
    <g transform="translate(0, -10)">
      <polygon points="256,120 375,175 256,230 137,175" fill="url(#goldGradMask)" />
      <path d="M 180 200 L 180 248 C 180 280 332 280 332 248 L 332 200 L 256 235 Z" fill="#047857" stroke="#fbbf24" stroke-width="3" />
      <path d="M 256 175 C 330 185 365 220 370 255" fill="none" stroke="#fef08a" stroke-width="4" stroke-linecap="round" />
      <circle cx="370" cy="265" r="8" fill="#fbbf24" />
      <path d="M 370 273 L 370 300" stroke="#fef08a" stroke-width="4" stroke-linecap="round" />
    </g>

    <!-- Attendance Verification Checkmark Symbol -->
    <g transform="translate(0, 30)">
      <circle cx="256" cy="325" r="48" fill="#10b981" />
      <circle cx="256" cy="325" r="44" fill="#065f46" stroke="#34d399" stroke-width="3" />
      <path d="M 234 325 L 249 340 L 280 310" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
    </g>

    <text x="256" y="445" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle">جامعة المستقبل</text>
  </g>
</svg>`;

async function generateIcons() {
  console.log('Generating PWA Icons for Al-Mustaqbal University System...');

  // Save SVG brand icon
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), brandSvg, 'utf8');

  // Generate 512x512 standard PNG
  await sharp(Buffer.from(brandSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // Generate 192x192 standard PNG
  await sharp(Buffer.from(brandSvg))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  // Generate 512x512 maskable PNG (padded)
  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');

  // Generate 180x180 apple-touch-icon PNG for iOS
  await sharp(Buffer.from(brandSvg))
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // Generate 64x64 favicon
  await sharp(Buffer.from(brandSvg))
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('Generated favicon.png');

  console.log('All PWA Icons generated successfully in /public!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
