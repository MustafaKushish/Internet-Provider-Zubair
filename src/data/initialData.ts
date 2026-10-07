import { Subscriber, PaymentRecord, SupportTicket, UpstreamProvider, SystemSettings, StaffUser, TowerPoint } from '../types/isp';

export const INITIAL_SETTINGS: SystemSettings = {
  ispName: 'شبكة أولاد كشيش لخدمات الإنترنت',
  agentName: 'إدارة أولاد كشيش',
  contactPhone: '+964 771 979 7455',
  address: 'العراق - البصرة - قضاء الزبير',
  currency: 'IQD',
  warningDaysBeforeExpiry: 3,
  whatsappFooter: 'شكراً لاختياركم شبكة أولاد كشيش لخدمات الإنترنت (البصرة - الزبير). للدعم الفني والاشتراكات: 07719797455',
};

export const INITIAL_PROVIDERS: UpstreamProvider[] = [
  {
    id: 'prov_earthlink',
    name: 'إيرثلنك (Earthlink)',
    contact: '07700001111',
    plans: [
      { id: 'el_economy', name: 'Economy', defaultCost: 25000, defaultSalePrice: 35000, speed: '20 Mbps' },
      { id: 'el_economy_plus', name: 'Economy+', defaultCost: 28000, defaultSalePrice: 40000, speed: '30 Mbps' },
      { id: 'el_standard', name: 'Standard', defaultCost: 35000, defaultSalePrice: 50000, speed: '45 Mbps' },
      { id: 'el_turbo', name: 'Turbo', defaultCost: 45000, defaultSalePrice: 65000, speed: '70 Mbps' },
      { id: 'el_active', name: 'Active', defaultCost: 31000, defaultSalePrice: 45000, speed: '40 Mbps' },
    ],
  },
  {
    id: 'prov_supercell',
    name: 'سوبرسيل (Supercell)',
    contact: '07800002222',
    plans: [
      { id: 'sc_bronze', name: 'برونزي (Bronze)', defaultCost: 20000, defaultSalePrice: 30000, speed: '20 Mbps' },
      { id: 'sc_silver', name: 'فضي (Silver)', defaultCost: 27000, defaultSalePrice: 40000, speed: '35 Mbps' },
      { id: 'sc_gold', name: 'ذهبي (Gold)', defaultCost: 36000, defaultSalePrice: 55000, speed: '60 Mbps' },
    ],
  },
  {
    id: 'prov_ftth',
    name: 'الفايبر الوطني (FTTH)',
    contact: '07500003333',
    plans: [
      { id: 'ftth_home', name: 'فايبر منزلي 50M', defaultCost: 32000, defaultSalePrice: 45000, speed: '50 Mbps' },
      { id: 'ftth_ultra', name: 'فايبر الترا 100M', defaultCost: 48000, defaultSalePrice: 70000, speed: '100 Mbps' },
    ],
  },
];

// لا تُضمَّن بيانات مشتركين حقيقية داخل كود الموقع (تُرسل لكل من يفتح الصفحة).
// استورد المشتركين من ملف إكسل عبر زر "استيراد" بعد تسجيل الدخول.
export const INITIAL_SUBSCRIBERS: Subscriber[] = [];
export const INITIAL_PAYMENTS: PaymentRecord[] = [];
export const INITIAL_TICKETS: SupportTicket[] = [];

// Network Towers & Transmission Points in Al-Zubair
export const INITIAL_TOWERS: TowerPoint[] = [
  { id: 'tow_1', name: 'برج الزبير الرئيسي', location: 'مركز قضاء الزبير', notes: 'البرج الرئيسي وسكترات النانو' },
  { id: 'tow_2', name: 'برج سوق الزبير', location: 'سوق الزبير - شارع الجمهورية', notes: 'تغطية السوق والمحلات التجارية' },
  { id: 'tow_3', name: 'كابينة خطوة الإمام علي', location: 'الخطوة - الزبير', notes: 'كابينة فايبر ونقاط توزيع لاسلكية' },
  { id: 'tow_4', name: 'برج صناعية الزبير', location: 'المنطقة الصناعية - الزبير', notes: 'تغطية الورش والمعامل الصناعية' },
  { id: 'tow_5', name: 'برج حي الشهداء', location: 'حي الشهداء - الزبير', notes: 'سكترات النانوستيشن والراوترات' },
  { id: 'tow_6', name: 'برج محلة الكوت', location: 'محلة الكوت القديمة - الزبير', notes: 'برج التوزيع السكني' },
  { id: 'tow_7', name: 'سكتر حي الضباط', location: 'حي الضباط - الزبير', notes: 'سكتر ميمو فائق السرعة' },
];

// حساب عرض مبدئي فقط (قبل أول تسجيل دخول)؛ الحسابات الحقيقية وكلمات المرور على الخادم
export const INITIAL_STAFF_USERS: StaffUser[] = [
  {
    id: 'user_admin_1',
    name: 'المدير العام (أولاد كشيش)',
    username: 'admin',
    role: 'admin',
    phone: '+964 771 979 7455',
    isActive: true,
    createdAt: '2026-10-07',
    mustChangePassword: false,
  },
];
