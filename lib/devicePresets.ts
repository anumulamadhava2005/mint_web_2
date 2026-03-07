// ═══════════════════════════════════════════════════════════════
// Device Size Presets — Standard screen dimensions for frames
// ═══════════════════════════════════════════════════════════════

export interface DevicePreset {
  name: string;
  width: number;
  height: number;
}

export interface DevicePresetGroup {
  label: string;
  presets: DevicePreset[];
}

export const DEVICE_PRESETS: DevicePresetGroup[] = [
  {
    label: "APPLE",
    presets: [
      { name: "iPhone 16", width: 393, height: 852 },
      { name: "iPhone 16 Pro", width: 402, height: 874 },
      { name: "iPhone 16 Pro Max", width: 440, height: 956 },
      { name: "iPhone 16 Plus", width: 430, height: 932 },
      { name: "14/15 Pro Max", width: 430, height: 932 },
      { name: "iPhone 15/15 Pro", width: 393, height: 852 },
      { name: "iPhone 13/14", width: 390, height: 844 },
      { name: "iPhone 14 Plus", width: 428, height: 926 },
      { name: "iPhone 13 Mini", width: 375, height: 812 },
      { name: "iPhone SE", width: 320, height: 568 },
      { name: "iPhone 12/12 Pro", width: 390, height: 844 },
      { name: "iPhone 12 Mini", width: 360, height: 780 },
      { name: "iPhone 12 Pro Max", width: 428, height: 926 },
      { name: "iPhone X/XS/11 Pro", width: 375, height: 812 },
      { name: "iPhone XS Max/XR/11", width: 414, height: 896 },
      { name: "iPad", width: 768, height: 1024 },
      { name: "iPad Mini 8.3in", width: 744, height: 1133 },
      { name: "iPad Pro 10.5in", width: 834, height: 1112 },
      { name: "iPad Pro 11in", width: 834, height: 1194 },
      { name: "iPad Pro 12.9in", width: 1024, height: 1366 },
      { name: "Watch Series 10", width: 416, height: 496 },
    ],
  },
  {
    label: "ANDROID",
    presets: [
      { name: "Pixel 9", width: 412, height: 924 },
      { name: "Pixel 9 Pro", width: 412, height: 924 },
      { name: "Pixel 9 Pro XL", width: 448, height: 1004 },
      { name: "Samsung Galaxy S24", width: 360, height: 780 },
      { name: "Samsung Galaxy S24+", width: 384, height: 832 },
      { name: "Samsung Galaxy S24 Ultra", width: 412, height: 892 },
      { name: "Samsung Galaxy A54", width: 360, height: 800 },
      { name: "Android Small", width: 360, height: 640 },
      { name: "Android Large", width: 412, height: 846 },
    ],
  },
  {
    label: "DESKTOP",
    presets: [
      { name: "Desktop", width: 1440, height: 1024 },
      { name: "Desktop HD", width: 1920, height: 1080 },
      { name: "Desktop 4K", width: 3840, height: 2160 },
      { name: "MacBook Air", width: 1280, height: 832 },
      { name: "MacBook Pro 14\"", width: 1512, height: 982 },
      { name: "MacBook Pro 16\"", width: 1728, height: 1117 },
      { name: "Surface Pro 8", width: 1440, height: 960 },
      { name: "iMac 24\"", width: 2048, height: 1152 },
    ],
  },
  {
    label: "SOCIAL MEDIA",
    presets: [
      { name: "Instagram Post", width: 1080, height: 1080 },
      { name: "Instagram Story", width: 1080, height: 1920 },
      { name: "Facebook Post", width: 1200, height: 630 },
      { name: "Facebook Cover", width: 820, height: 312 },
      { name: "Twitter Post", width: 1200, height: 675 },
      { name: "Twitter Header", width: 1500, height: 500 },
      { name: "LinkedIn Banner", width: 1584, height: 396 },
      { name: "YouTube Thumbnail", width: 1280, height: 720 },
    ],
  },
  {
    label: "PRESENTATION",
    presets: [
      { name: "Slide 16:9", width: 1920, height: 1080 },
      { name: "Slide 4:3", width: 1024, height: 768 },
      { name: "A4 Portrait", width: 595, height: 842 },
      { name: "A4 Landscape", width: 842, height: 595 },
      { name: "Letter Portrait", width: 612, height: 792 },
      { name: "Letter Landscape", width: 792, height: 612 },
    ],
  },
];
