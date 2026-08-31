import { BRAND } from '@dd/config/brand';

/**
 * LEGAL PLACEHOLDERS.
 *
 * Every document here is a DRAFT written to describe the product accurately,
 * not to constitute legal advice or compliance. Each is marked as requiring
 * legal review before production, and the app shows that marker to the user.
 * Oman's Personal Data Protection Law obligations in particular must be
 * confirmed by counsel before launch.
 */
export type LegalDoc = {
  slug: string;
  title: { ar: string; en: string };
  sections: { heading: { ar: string; en: string }; body: { ar: string; en: string } }[];
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'privacy',
    title: { ar: 'سياسة الخصوصية', en: 'Privacy policy' },
    sections: [
      {
        heading: { ar: 'ما الذي نجمعه', en: 'What we collect' },
        body: {
          ar: 'الاسم ورقم الهاتف أو البريد، المقاسات التي تدخلها أو يوثقها الخيّاط، عناوين التوصيل، وسجل الطلبات والتصاميم المحفوظة. لا نطلب أي بيانات لا يحتاجها إتمام الطلب.',
          en: 'Name and phone or email, the measurements you enter or your tailor verifies, delivery addresses, and your order and saved-design history. We do not ask for data that completing an order does not require.',
        },
      },
      {
        heading: { ar: 'المقاسات والصور', en: 'Measurements and photos' },
        body: {
          ar: 'نعامل المقاسات وصور المستخدم كبيانات شخصية حساسة في تصميم المنتج. الصور اختيارية تماماً، ولا تُحفظ إلا بموافقتك الصريحة، ويمكنك حذفها في أي وقت. يمكنك التصميم والشراء دون رفع أي صورة.',
          en: 'We treat measurements and user photos as sensitive personal data in product design. Photos are entirely optional, are not retained without your explicit consent, and can be deleted at any time. You can design and buy without uploading any photo.',
        },
      },
      {
        heading: { ar: 'مشاركة البيانات', en: 'Sharing' },
        body: {
          ar: 'تُشارَك تفاصيل الطلب مع الخيّاط الذي اخترته فقط، وبالقدر اللازم لتنفيذ الطلب. لا نبيع البيانات لأي طرف.',
          en: 'Order details are shared only with the tailor you chose, and only as needed to fulfil the order. We do not sell data to anyone.',
        },
      },
      {
        heading: { ar: 'حقوقك', en: 'Your rights' },
        body: {
          ar: 'يمكنك تصدير بياناتك أو حذف حسابك من شاشة «الخصوصية والبيانات». هذه المسودة لا تشكل ضماناً للامتثال القانوني وتحتاج مراجعة قانونية قبل الإطلاق، بما يشمل متطلبات قانون حماية البيانات الشخصية في سلطنة عُمان.',
          en: 'You can export your data or delete your account from the Privacy & data screen. This draft is not a guarantee of legal compliance and requires legal review before launch, including obligations under Oman’s Personal Data Protection Law.',
        },
      },
    ],
  },
  {
    slug: 'terms',
    title: { ar: 'الشروط والأحكام', en: 'Terms & conditions' },
    sections: [
      {
        heading: { ar: 'طبيعة الخدمة', en: 'The service' },
        body: {
          ar: 'المنصة تربطك بورش خياطة مستقلة. الخيّاط هو المسؤول عن تنفيذ الطلب وجودته وموعد تسليمه.',
          en: 'The platform connects you with independent tailoring workshops. The tailor is responsible for producing your order, its quality and its delivery date.',
        },
      },
      {
        heading: { ar: 'الأسعار', en: 'Pricing' },
        body: {
          ar: 'الأسعار بالريال العُماني وتشمل ما هو موضح في ملخص السعر. أي ضريبة تُعرض فقط عند تفعيلها في إعدادات التاجر.',
          en: 'Prices are in Omani Rial and include what the price summary lists. Any tax is shown only when enabled in merchant settings.',
        },
      },
      {
        heading: { ar: 'مراجعة قانونية', en: 'Legal review' },
        body: { ar: 'مسودة — تتطلب مراجعة قانونية قبل الإطلاق.', en: 'Draft — legal review required before production.' },
      },
    ],
  },
  {
    slug: 'returns',
    title: { ar: 'سياسة الإرجاع', en: 'Returns policy' },
    sections: [
      {
        heading: { ar: 'المنتجات المُفصّلة', en: 'Made-to-measure items' },
        body: {
          ar: 'الدشداشة تُفصَّل حسب مقاسك واختياراتك، ولذلك لا تخضع للإرجاع العام. في حال وجود عيب في التنفيذ أو اختلاف عن المواصفات المطلوبة، يتم الإصلاح أو إعادة التنفيذ حسب الحالة.',
          en: 'A dishdasha is cut to your measurements and choices, so it is not subject to general returns. Where there is a workmanship defect or a deviation from the specification, it is repaired or remade as appropriate.',
        },
      },
      {
        heading: { ar: 'مراجعة قانونية', en: 'Legal review' },
        body: { ar: 'مسودة — تتطلب مراجعة قانونية قبل الإطلاق.', en: 'Draft — legal review required before production.' },
      },
    ],
  },
  {
    slug: 'alterations',
    title: { ar: 'سياسة التعديلات', en: 'Alterations policy' },
    sections: [
      {
        heading: { ar: 'التعديلات', en: 'Alterations' },
        body: {
          ar: 'يمكن طلب تعديل بعد الاستلام. تُحدَّد التكلفة والمدة من الخيّاط حسب نوع التعديل. عند اكتمال التعديل نسألك إن كنت تريد تحديث مقاسك المحفوظ — ولا نغيّره أبداً دون موافقتك.',
          en: 'An alteration may be requested after delivery. Cost and turnaround are set by the tailor based on the alteration type. When it is complete we ask whether to update your saved measurement — we never change it without your approval.',
        },
      },
      {
        heading: { ar: 'مراجعة قانونية', en: 'Legal review' },
        body: { ar: 'مسودة — تتطلب مراجعة قانونية قبل الإطلاق.', en: 'Draft — legal review required before production.' },
      },
    ],
  },
  {
    slug: 'custom-made',
    title: { ar: 'سياسة المنتجات المُفصّلة', en: 'Custom-made product policy' },
    sections: [
      {
        heading: { ar: 'اللون والقماش', en: 'Colour and fabric' },
        body: {
          ar: 'قد يختلف اللون الفعلي قليلاً حسب الشاشة والإضاءة ودفعة القماش. الصور والمعاينات داخل التطبيق توضيحية لمساعدتك على الاختيار.',
          en: 'The actual colour may differ slightly depending on screen, lighting and fabric batch. In-app images and previews are illustrative aids to your choice.',
        },
      },
      {
        heading: { ar: 'المقاسات', en: 'Measurements' },
        body: {
          ar: 'دقة المقاس تؤثر مباشرة على ضبط الدشداشة. ننصح بتوثيق المقاس لدى الخيّاط؛ المقاسات المُدخلة ذاتياً على مسؤولية العميل.',
          en: 'Measurement accuracy directly affects fit. We recommend having measurements verified by your tailor; self-entered measurements are the customer’s responsibility.',
        },
      },
      {
        heading: { ar: 'مراجعة قانونية', en: 'Legal review' },
        body: { ar: 'مسودة — تتطلب مراجعة قانونية قبل الإطلاق.', en: 'Draft — legal review required before production.' },
      },
    ],
  },
];

export const getLegalDoc = (slug: string): LegalDoc | undefined =>
  LEGAL_DOCS.find((d) => d.slug === slug);

export const LEGAL_CONTACT = BRAND.supportEmail;
