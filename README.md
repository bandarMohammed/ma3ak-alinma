# معك (Ma3ak) — AI-Powered Personal Finance Companion
> **Your personal financial advisor, always with you**  
> **مستشارك المالي الشخصي، معك دائماً**  
> Built for the **Amad Hackathon (هاكاثون أَمَدْ)** by **Tuwaiq Academy**, sponsored by **Alinma Bank**.

---

## 🇸🇦 English Version

### Project Overview
**Ma3ak (معك — "With You")** is a production-grade personal finance companion integrated into Alinma Bank's mobile application. Powered by advanced artificial intelligence (OpenAI `gpt-4o-mini`), it acts as a proactive advisor that leverages historical client transaction data to perform retrospective audits, evaluate current habits, and forecast the financial consequences of prospective consumer decisions using dynamic simulations.

---

### Key Technical Architecture Features

#### 1. Bilingual & RTL Directionality (First-Class Arabic Support)
- **Instant Language Swapping:** Dynamic bilingual context switching (عربي / English) with instantaneous document reflowing (`dir="rtl"` vs `dir="ltr"`).
- **Premium Typography:** Integrates Google's `Tajawal` & `IBM Plex Sans Arabic` for a premium Saudi banking font layout, falling back gracefully to system fonts (`Segoe UI`, `Tahoma`) when operating completely offline.

#### 2. Robust Data Abstraction Layer
- Built using a rigorous interface pattern `/src/lib/data/types.ts` that defines a uniform contract `DataProvider`.
- **MockDataProvider:** Uses `localStorage` to handle transactions, user sessions, chat chains, and saved audits. Runs 100% offline with zero dependencies on external connections.
- **SupabaseDataProvider:** Connected using real `@supabase/supabase-js` clients, querying live Postgres tables.
- **Single Config Toggle:** Swap between mock database structures and live Supabase environments by changing `USE_MOCK_DATA = true | false` inside `/src/lib/data/config.ts`.

#### 3. Intelligent AI Chatbot Engine
- Integrated via standard API routes at `/app/api/chat/route.ts`.
- Switched between real OpenAI calls and a simulated engine using `USE_MOCK_AI = true | false` inside `/src/lib/data/config.ts`.
- **Dynamic Seeding & Story-Rich Patterns:** The database seeds 6 months (~200 records) of realistic Saudi transactions (STC Payments, Jarir, Careem, Hungerstation, rent, utility bills, salary deposits of 15,000 SAR) that carry explicit patterns the AI detects:
  1. **Past Reports:** User requests custom date ranges. The system aggregates exact totals, calculates top spending categories, and displays a Recharts PieChart embedded inside the message box.
  2. **Present Habits:** Automatically audits the user's recent cycles, reporting a high food-delivery spike (exceeding 800 SAR/month on Hungerstation & Jahez) and a broken savings trend (the user stopped the usual 2,000 SAR/month savings transfer due to shopping spikes).
  3. **Future Simulation:** Evaluates purchases (e.g. buying a car for 120,000 SAR, an iPhone for 5,000 SAR, or taking a 50,000 SAR loan) across 3 distinct scenarios (Now, Wait 6 Months, Adjusted terms). Computes a 12-month timeline and renders a Recharts LineChart comparing projected balances.

---

### Local Installation & Running Instructions

#### Prerequisites
- Node.js (version 18 or 20)
- npm

#### Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start local development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your web browser.

#### Demo Credentials
- **Email:** `demo@alinma.sa`
- **Password:** `Demo1234`
- *(Use the "Sign In as Demo User" button for automatic submission)*

#### 4. Widescreen Responsive Wrapper & Virtual Phone Frame
- **Mobile Fidelity:** Renders as a full-screen, native-feeling mobile app on all mobile and tablet viewports (< 768px).
- **Desktop Virtual Phone Frame:** On larger desktop screens (>= 768px), the entire mobile app is automatically contained inside an elegant mock physical phone device frame (max-width: 420px, height: 90vh, rounded corners, soft backshadows).
- **Branded Desktop Companion Panel:** Beside the phone frame, a premium branded panel is displayed with Alinma + Ma3ak branding, the tagline ("مستشارك المالي الذكي"), Saudi geometric patterns, and a subtle shimmering gradient background using Alinma corporate colors (Navy `#1B2A4A` and Purple `#7C6FD4`).

---

### Deployment & Live URLs
- **Live Production Application:** [https://ma3ak-alinma.vercel.app](https://ma3ak-alinma.vercel.app)
- **Repository Visibility:** Strictly **PRIVATE** (Only accessible to you) to secure the hackathon intellectual property.

---

## 🇸🇦 النسخة العربية

### نظرة عامة على المشروع
**معك (Ma3ak)** هو نموذج أولى ذو جودة عالية لمساعد مالي شخصي مدمج في تطبيق مصرف الإنماء للهواتف المحمولة. يعمل هذا النظام مدعوماً بالذكاء الاصطناعي (OpenAI `gpt-4o-mini`) ليكون بمثابة مستشار مالي استباقي يحلل سجل العمليات التاريخية للعميل لإعداد تقارير نشاط دقيقة، ومراجعة العادات الاستهلاكية الحالية، والتنبؤ بالعواقب المالية للقرارات المستقبلية باستخدام المحاكاة الديناميكية. تم بناء المشروع لصالح **هاكاثون أَمَدْ** التابع لـ **أكاديمية طويق** برعاية **مصرف الإنماء**.

---

### المميزات التقنية والمعمارية الأساسية

#### ١. دعم ثنائي اللغة والاتجاه (RTL / LTR)
- **تبديل فوري للغة:** نظام تبديل ديناميكي فوري بين العربية والإنجليزية مع إعادة توجيه كامل لاتجاه الصفحة وعناصر واجهة المستخدم.
- **خطوط مخصصة متميزة:** يعتمد على خطوط `Tajawal` و `IBM Plex Sans Arabic` ليعكس الهوية المصرفية السعودية الحديثة، مع دعم كامل للعمل دون اتصال بالإنترنت (Offline Mode) بالاعتماد على الخطوط الافتراضية للنظام مثل `Segoe UI` و `Tahoma`.

#### ٢. طبقة تجريد البيانات المتقدمة (Data Abstraction Layer)
- تم التصميم بالاعتماد على واجهة صارمة (`DataProvider`) معرفة في الملف `/src/lib/data/types.ts`.
- **MockDataProvider:** يعتمد على التخزين المحلي (`localStorage`) لإدارة الجلسات والعمليات وسجلات المحادثة الذكية بشكل كامل ودون اتصال بالإنترنت.
- **SupabaseDataProvider:** يتصل مباشرة بقواعد بيانات Supabase وسيرفرات PostgreSQL الحية.
- **مفتاح تحويل موحد:** يمكنك التبديل بين المحاكي المحلي وقواعد بيانات Supabase الحية عبر تغيير متغير واحد فقط `USE_MOCK_DATA` داخل الملف `/src/lib/data/config.ts`.

#### ٣. محرك المحادثة الذكي لـ «معك»
- يتصل عبر المسار `/app/api/chat/route.ts`.
- يمكن تنشيط OpenAI gpt-4o-mini أو تشغيل المحاكي الذكي عبر تبديل المتغير `USE_MOCK_AI` في ملف الإعدادات.
- **بيانات افتراضية وقصصية غنية:** يتم حقن قاعدة البيانات بـ 6 أشهر من العمليات الممثلة للسوق السعودي (مثل STC pay، جرير، أسواق التميمي والعثيم، هنجرستيشن، جاهز، كريم، سداد الإيجار، الفواتير، وإيداع الراتب في 27 من كل شهر بقيمة 15,000 ريال) مع عادات صرف مدروسة ليتعامل معها المساعد الذكي:
  1. **التقارير السابقة:** يحلل العمليات المالية لأي فترة يحددها العميل ويجمع الرصيد والمصروفات ويعرض رسم بياني دائري (PieChart) مدمج داخل المحادثة.
  2. **العادات الحالية:** يراجع عادات الصرف الحالية وينبه العميل لزيادة صرف التوصيل (أكثر من 800 ريال شهرياً) وتوقف خطته الادخارية (توقف تحويل 2,000 ريال شهرياً بسبب مشتريات جرير والتسوق).
  3. **المحاكاة المستقبلية:** يقارن قرارات الشراء (مثل سيارة بـ 120 ألف، آيفون بـ 5 آلاف، أو قرض بـ 50 ألف) عبر 3 سيناريوهات مختلفة (الآن، الانتظار 6 أشهر، شروط معدلة) ويعرض منحنياً بيانياً (LineChart) متوقعاً للأرصدة لمدة 12 شهراً قادماً.

---

### طريقة التشغيل والتنصيب المحلي

#### المتطلبات
- بيئة تشغيل Node.js (الإصدار 18 أو 20)
- مدير الحزم npm

#### خطوات التشغيل
1. تثبيت الحزم المطلوبة:
   ```bash
   npm install
   ```
2. تشغيل السيرفر المحلي:
   ```bash
   npm run dev
   ```
3. افتح الرابط التالي في المتصفح: [http://localhost:3000](http://localhost:3000).

#### معلومات الدخول الافتراضية للجنة التحكيم
- **البريد الإلكتروني:** `demo@alinma.sa`
- **كلمة المرور:** `Demo1234`
- *(استخدم زر "الدخول كمستخدم تجريبي" لتعبئة البيانات تلقائياً)*

#### ٤. إطار الهاتف الافتراضي المستجيب وتصميم سطح المكتب
- **توافق كامل للهواتف المحمولة:** يظهر كـ تطبيق هاتف أصيل ملء الشاشة على كافة أحجام الهواتف والأجهزة اللوحية (< 768px).
- **إطار هاتف تفاعلي متميز:** على الشاشات الكبيرة وأجهزة الكمبيوتر المحمول (>= 768px)، يتم تلقائياً تغليف واجهات التطبيق بالكامل داخل إطار هاتف افتراضي رائع يحاكي الأجهزة الحقيقية (بعرض 420 بكسل وارتفاع 90% مع زوايا دائرية وظلال ناعمة).
- **لوحة الهوية المصرفية التفاعلية:** بجانب إطار الهاتف، يتم عرض لوحة سطح مكتب مخصصة مفعمة بالهوية البصرية لمصرف الإنماء مع شعار "معك"، والعبارة التحفيزية ("مستشارك المالي الذكي")، وزخارف هندسية مستوحاة من التراث السعودي، وخلفية ديناميكية متدرجة الألوان تجمع بين لوني الإنماء (الكحلي `#1B2A4A` والبنفسجي `#7C6FD4`).

---
### النشر والروابط الحية للمشروع
- **رابط التطبيق المباشر (Vercel):** [https://ma3ak-alinma.vercel.app](https://ma3ak-alinma.vercel.app)
- **خصوصية كود المشروع:** المستودع **خاص وآمن (PRIVATE)** بالكامل (متاح لك فقط) لحماية الفكرة وتفاصيل النموذج قبل المنافسة والتحكيم.
