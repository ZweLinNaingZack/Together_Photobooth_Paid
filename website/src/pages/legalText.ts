// ---------------------------------------------------------------------------
// Words for the Terms, Privacy and Refund pages in English, Burmese and Vietnamese.
// Legal.tsx turns this into the pages, so the layout lives in one place.
//
// Small markup used inside the strings (Legal.tsx renders it):
//   **bold**            → bold text
//   [link text](#hash)  → a link to another page of the site
//   {mail}              → the contact email as a link
//   {operator}          → the operator's name
//
// In a section body, a plain string is a paragraph and an array of strings is a bullet list.
// If you change a rule, change it in ALL three languages. English is the version that counts.
// ---------------------------------------------------------------------------

export type LangCode = 'en' | 'my' | 'vi';
export type PageId = 'terms' | 'privacy' | 'refunds';
type Section = { h: string; body: (string | string[])[] };
type Page = { title: string; intro: string; sections: Section[] };
export type LegalLanguage = {
  label: string;     // button text, written in its own language
  locale: string;    // for the date format and the lang="" attribute
  back: string;
  updated: string;   // "Last updated" (the date is added after it)
  notice?: string;   // translation note; English has none
  pickLabel: string; // screen-reader name of the language buttons
  pages: Record<PageId, Page>;
};

const en: LegalLanguage = {
  label: 'English', locale: 'en-GB', back: 'Back home', updated: 'Last updated', pickLabel: 'Language',
  pages: {
    terms: {
      title: 'Terms of Service',
      intro: 'These terms explain how you can use Together, an online photobooth for making photo cards alone or with someone far away. By creating an account or using the booth, you agree to them. Together is run by {operator}, an individual based in Myanmar (“we”, “us”).',
      sections: [
        { h: '1. Who can use Together', body: [
          'Anyone can use Together, with these conditions for younger people:',
          ['**Under 13:** only with a parent’s or guardian’s permission and supervision. The parent or guardian accepts these terms on the child’s behalf.',
           '**Under 18:** buying points needs a parent’s or guardian’s permission.'],
          'If we learn that an account breaks these conditions, we may close it.'] },
        { h: '2. Your account', body: [[
          'Accounts use a Gmail address. You can sign in with Google, or with an email and password after confirming your email address.',
          'One account per person. Keep your password private; you are responsible for activity on your account.',
          'You can ask us to delete your account at any time (see the [Privacy Policy](#privacy)).']] },
        { h: '3. Points and payments', body: [[
          'Booth sessions are paid with points. One session costs **100 points**. Each email address gets **one free session**, used before any points.',
          'Points are charged only when you confirm that you are ready to edit. Retakes and downloads in that session are included. In a duo booth, only the person who created the booth pays; the person who joins is never charged.',
          'You buy points by bank transfer (KBZPay, in MMK) and upload your receipt. We check each transfer by hand and add the points once it is confirmed, so it is not instant.',
          'Points never expire. They have no cash value, cannot be exchanged for money, and cannot be transferred to another account.',
          'Prices are shown on the Buy points page at the time you buy. Refunds are covered by our [Refund Policy](#refunds).']] },
        { h: '4. Using the booth', body: [[
          'The booth uses your camera only after you allow it in your browser. Only invite people who want to join you.',
          'Do not use Together to harass, threaten or exploit anyone, to share sexual content involving minors, or for anything illegal. We may close accounts that do.',
          'Do not try to break, overload or get around the service’s security, limits or payments.']] },
        { h: '5. Your photos', body: [
          'Your photos are yours. They are taken and edited on your device; in a duo booth they travel directly between your two devices. We do not receive, store or use them. Please download your card before you leave; the booth only keeps a temporary copy in your own browser for up to 24 hours to help you recover from a refresh.'] },
        { h: '6. Availability and changes', body: [
          'Together is provided “as is”. We work to keep it running well, but it may sometimes be slow, interrupted or changed, and live video depends on both people’s devices and internet connections. If we ever decide to close Together, we will stop selling points and give at least 30 days’ notice on the website so you can use your remaining points.'] },
        { h: '7. Our responsibility', body: [
          'As far as the law allows, we are not responsible for indirect losses, such as missed moments or lost photos you did not download. If a session fails because of an error on our side, we will put the points back as described in the [Refund Policy](#refunds). Nothing in these terms removes rights you have under the law where you live.'] },
        { h: '8. Ending your use', body: [
          'You can stop using Together at any time. We may suspend or close an account that breaks these terms. Unused points are lost when an account is deleted or closed for breaking these terms.'] },
        { h: '9. Changes to these terms', body: [
          'We may update these terms as Together grows. When we do, we will change the date at the top of this page; for important changes we will also show a notice on the website. Using Together after a change means you accept the updated terms.'] },
        { h: '10. Law and contact', body: [
          'These terms are governed by the laws of Myanmar. Questions about these terms: {mail}.'] },
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      intro: 'This policy explains what information Together collects, why, and what you can ask us to do with it. The short version: **your photos and video never reach our servers.** We only keep what we need to run your account, points and payments. Together is run by {operator} (Myanmar); contact {mail}.',
      sections: [
        { h: '1. What we never collect', body: [[
          '**Photos and live video.** They are captured and edited on your device. In a duo booth they travel directly between the two devices, or, when a direct connection is not possible, through an encrypted relay server that passes them along without storing them.',
          'To help you recover from a refresh, the booth keeps a temporary copy of your session in **your own browser** for up to 24 hours. It never leaves your device, and you can turn it off in the booth.']] },
        { h: '2. What we collect', body: [[
          '**Account:** your email address and, if you sign in with Google, the basic profile Google shares (such as your name).',
          '**Points and sessions:** your points balance and history, when sessions were started and completed, and whether you have used your free session.',
          '**Top-ups:** the amount, the transfer receipt image you upload, any payment reference you enter, and whether it was approved. Receipts are visible only to you and the administrator.',
          '**Duo booths:** a temporary room code, who is in the room and whether you are ready or connected. Rooms end automatically within 45 minutes.',
          '**Security:** IP addresses and sign-in attempt counts to protect accounts from password guessing, and a bot check on sign-in forms.',
          '**Support details:** if you choose to copy and send us the booth’s “support details”, they contain connection measurements only, never photos or account details.']] },
        { h: '3. Why we use it', body: [[
          'To create and secure your account and sign you in.',
          'To run booth sessions, connect duo booths and keep track of points.',
          'To check top-up payments and email you about them.',
          'To prevent abuse, for example giving the free session only once per email address.',
          'To answer your questions and fix problems.'],
          'We do not sell your information or use it for advertising.'] },
        { h: '4. How long we keep it', body: [[
          'Account, points and session information: while your account exists.',
          'Duo room information: until the room ends (within 45 minutes).',
          'After an account is deleted, we keep only what we still need: payment and points records (including receipts) for accounting, fraud prevention and resolving disputes, and a record that the email address has used its free session.']] },
        { h: '5. Your choices', body: [
          'Email {mail} from your account’s email address to:',
          ['get a copy of the information we hold about you,',
           'correct something that is wrong, or',
           '**delete your account.** Unused points are lost when an account is deleted, and the free session is not given again to the same email address.'],
          'We aim to reply within 30 days.'] },
        { h: '6. Children', body: [
          'Children under 13 may use Together only with a parent’s or guardian’s permission and supervision, and under-18s need permission to buy points. A parent or guardian can contact us at any time to review or delete their child’s account.'] },
        { h: '7. Security', body: [
          'Connections to Together are encrypted, each person can only reach their own account data, and administrative access is limited. No system is perfectly secure, but we work to protect your information and will act quickly if something goes wrong.'] },
        { h: '8. Changes', body: [
          'If we change this policy, we will update the date at the top, and show a notice on the website for important changes.'] },
      ],
    },
    refunds: {
      title: 'Refund Policy',
      intro: 'Points are bought in advance and **never expire**, so you can use them whenever you like. This page explains when points can be put back and what we cannot refund.',
      sections: [
        { h: '1. Purchased points', body: [
          '**Points are non-refundable.** Once a top-up is approved, we do not give money back for points, whether they are used or unused. Please choose the amount you need.'] },
        { h: '2. When we put points back', body: [
          'If a session was charged but could not be completed because of a problem on our side, we will add the points back to your account. For example:',
          ['a website error stopped you from editing or downloading a session you paid for,',
           'you were charged twice for the same session, or',
           'points were charged when they should not have been.'],
          'Corrections are made as points, not money.'] },
        { h: '3. What is not covered', body: [[
          'Changing your mind, or not using points you bought.',
          'Leaving a booth or ending a session early, or the other person leaving.',
          'Problems caused by your own device, camera permissions or internet connection.',
          'The free session, which has no cash value.']] },
        { h: '4. Top-up problems', body: [
          'If you transferred money but your points have not appeared, or the amount looks wrong, email us with your account email, the date and the payment reference. We check every transfer by hand and will sort it out with you.'] },
        { h: '5. If Together closes', body: [
          'If we decide to close Together, we will stop selling points and give at least 30 days’ notice on the website so you can use your remaining points.'] },
        { h: '6. How to ask', body: [
          'Email {mail} from your account’s email address, as soon as possible after the problem, with the date and a short description (a screenshot helps). We aim to reply within a few days.'] },
      ],
    },
  },
};

const my: LegalLanguage = {
  label: 'မြန်မာ', locale: 'my', back: 'ပင်မစာမျက်နှာသို့', updated: 'နောက်ဆုံး ပြင်ဆင်သည့်ရက်', pickLabel: 'ဘာသာစကား',
  pages: {
    terms: {
      title: 'ဝန်ဆောင်မှု စည်းမျဉ်းများ',
      intro: 'ဤစည်းမျဉ်းများသည် Together ကို မည်သို့ အသုံးပြုနိုင်သည်ကို ရှင်းပြထားပါသည်။ Together သည် တစ်ယောက်တည်းဖြစ်စေ၊ အဝေးရောက်နေသူ တစ်ဦးနှင့်အတူဖြစ်စေ ဓာတ်ပုံကတ်များ ပြုလုပ်နိုင်သော အွန်လိုင်း photobooth ဖြစ်ပါသည်။ အကောင့်ဖွင့်ခြင်း သို့မဟုတ် booth ကို အသုံးပြုခြင်းဖြင့် ဤစည်းမျဉ်းများကို သင် သဘောတူပါသည်။ Together ကို မြန်မာနိုင်ငံတွင် နေထိုင်သူ {operator} (“ကျွန်ုပ်တို့”) က တစ်ဦးချင်းအနေဖြင့် လုပ်ကိုင်ဆောင်ရွက်ပါသည်။',
      sections: [
        { h: '၁။ Together ကို မည်သူ အသုံးပြုနိုင်သနည်း', body: [
          'မည်သူမဆို Together ကို အသုံးပြုနိုင်ပါသည်။ အသက်ငယ်သူများအတွက် အောက်ပါ အချက်များ သက်ဆိုင်ပါသည် -',
          ['**အသက် ၁၃ နှစ်အောက် -** မိဘ သို့မဟုတ် အုပ်ထိန်းသူ၏ ခွင့်ပြုချက်နှင့် ကြီးကြပ်မှုဖြင့်သာ အသုံးပြုနိုင်ပါသည်။ မိဘ သို့မဟုတ် အုပ်ထိန်းသူက ကလေးကိုယ်စား ဤစည်းမျဉ်းများကို လက်ခံပါသည်။',
           '**အသက် ၁၈ နှစ်အောက် -** points ဝယ်ယူရန် မိဘ သို့မဟုတ် အုပ်ထိန်းသူ၏ ခွင့်ပြုချက် လိုအပ်ပါသည်။'],
          'အကောင့်တစ်ခုသည် ဤအချက်များကို ချိုးဖောက်ကြောင်း သိရှိပါက ထိုအကောင့်ကို ပိတ်နိုင်ပါသည်။'] },
        { h: '၂။ သင့်အကောင့်', body: [[
          'အကောင့်များသည် Gmail လိပ်စာကို အသုံးပြုပါသည်။ Google ဖြင့် ဝင်ရောက်နိုင်သလို email လိပ်စာကို အတည်ပြုပြီးနောက် email နှင့် စကားဝှက်ဖြင့်လည်း ဝင်ရောက်နိုင်ပါသည်။',
          'လူတစ်ဦးလျှင် အကောင့်တစ်ခုသာ ဖွင့်ရပါမည်။ စကားဝှက်ကို လျှို့ဝှက်ထားပါ။ သင့်အကောင့်ပေါ်ရှိ လုပ်ဆောင်ချက်များအတွက် သင် တာဝန်ရှိပါသည်။',
          'သင့်အကောင့်ကို အချိန်မရွေး ဖျက်ပေးရန် တောင်းဆိုနိုင်ပါသည် ([ကိုယ်ရေးအချက်အလက် မူဝါဒ](#privacy) ကို ကြည့်ပါ)။']] },
        { h: '၃။ Points နှင့် ငွေပေးချေမှု', body: [[
          'Booth session များကို points ဖြင့် ပေးချေရပါသည်။ Session တစ်ခုလျှင် **points ၁၀၀** ကျသင့်ပါသည်။ Email လိပ်စာတစ်ခုစီသည် **အခမဲ့ session တစ်ကြိမ်** ရရှိပြီး points မသုံးမီ ၎င်းကို အရင်သုံးပါသည်။',
          'တည်းဖြတ်ရန် အသင့်ဖြစ်ကြောင်း သင် အတည်ပြုမှသာ points ကို နုတ်ယူပါသည်။ ထို session အတွင်း ပြန်ရိုက်ခြင်းနှင့် download ဆွဲခြင်းများ ပါဝင်ပြီး ဖြစ်ပါသည်။ Duo booth တွင် booth ကို ဖန်တီးသူသာ ပေးချေရပြီး ဝင်ရောက်လာသူထံမှ မည်သည့်အခါမျှ မယူပါ။',
          'Points များကို ဘဏ်ငွေလွှဲ (KBZPay၊ ကျပ်ငွေ MMK) ဖြင့် ဝယ်ယူပြီး ငွေလွှဲပြေစာကို upload တင်ရပါသည်။ ငွေလွှဲမှုတိုင်းကို လူကိုယ်တိုင် စစ်ဆေးပြီး အတည်ပြုပြီးမှ points ထည့်ပေးသောကြောင့် ချက်ချင်း မရောက်ပါ။',
          'Points များ သက်တမ်း မကုန်ပါ။ ၎င်းတို့တွင် ငွေသားတန်ဖိုး မရှိဘဲ ငွေအဖြစ် လဲလှယ်၍ မရ၊ အခြားအကောင့်သို့ လွှဲပြောင်း၍လည်း မရပါ။',
          'ဈေးနှုန်းများကို ဝယ်ယူချိန်တွင် Buy points စာမျက်နှာ၌ ပြသထားပါသည်။ ငွေပြန်အမ်းခြင်းကို ကျွန်ုပ်တို့၏ [ငွေပြန်အမ်းခြင်း မူဝါဒ](#refunds) တွင် ဖော်ပြထားပါသည်။']] },
        { h: '၄။ Booth အသုံးပြုခြင်း', body: [[
          'သင့် browser တွင် ခွင့်ပြုပြီးမှသာ booth သည် သင့်ကင်မရာကို အသုံးပြုပါသည်။ ပါဝင်လိုသူများကိုသာ ဖိတ်ခေါ်ပါ။',
          'Together ကို အခြားသူများအား နှောင့်ယှက်ရန်၊ ခြိမ်းခြောက်ရန်၊ အမြတ်ထုတ်ရန်၊ အရွယ်မရောက်သေးသူများ ပါဝင်သော လိင်ပိုင်းဆိုင်ရာ အကြောင်းအရာများ မျှဝေရန် သို့မဟုတ် တရားမဝင်သော ကိစ္စတစ်ခုခုအတွက် အသုံးမပြုရပါ။ ထိုသို့ ပြုလုပ်သော အကောင့်များကို ပိတ်နိုင်ပါသည်။',
          'ဝန်ဆောင်မှု၏ လုံခြုံရေး၊ ကန့်သတ်ချက်များ သို့မဟုတ် ငွေပေးချေမှုစနစ်ကို ဖျက်ဆီးရန်၊ ဝန်ပိစေရန် သို့မဟုတ် ရှောင်ကွင်းရန် မကြိုးစားရပါ။']] },
        { h: '၅။ သင့်ဓာတ်ပုံများ', body: [
          'သင့်ဓာတ်ပုံများသည် သင်ပိုင်ပါသည်။ ၎င်းတို့ကို သင့်စက်ပေါ်တွင်ပင် ရိုက်ကူး တည်းဖြတ်ပြီး duo booth တွင် စက်နှစ်ခုကြား တိုက်ရိုက် ပေးပို့ပါသည်။ ကျွန်ုပ်တို့ ၎င်းတို့ကို လက်ခံရယူခြင်း၊ သိမ်းဆည်းခြင်း သို့မဟုတ် အသုံးပြုခြင်း မပြုပါ။ မထွက်ခွာမီ သင့်ကတ်ကို download ဆွဲထားပါ။ Refresh လုပ်မိပါက ပြန်လည်ရယူနိုင်ရန် booth သည် သင့် browser အတွင်း၌သာ ယာယီမိတ္တူကို အများဆုံး ၂၄ နာရီ သိမ်းထားပါသည်။'] },
        { h: '၆။ ဝန်ဆောင်မှု ရရှိနိုင်မှုနှင့် ပြောင်းလဲမှုများ', body: [
          'Together ကို “ရှိသည့်အတိုင်း” ပေးအပ်ပါသည်။ ကောင်းမွန်စွာ လည်ပတ်စေရန် ကြိုးစားသော်လည်း တစ်ခါတစ်ရံ နှေးခြင်း၊ ရပ်တန့်ခြင်း သို့မဟုတ် ပြောင်းလဲခြင်း ရှိနိုင်ပြီး live video သည် နှစ်ဦးစလုံး၏ စက်နှင့် အင်တာနက်ပေါ် မူတည်ပါသည်။ Together ကို ပိတ်ရန် ဆုံးဖြတ်ပါက points ရောင်းချခြင်းကို ရပ်ပြီး ကျန်ရှိသော points များကို သုံးနိုင်ရန် website ပေါ်တွင် အနည်းဆုံး ရက် ၃၀ ကြိုတင် အသိပေးပါမည်။'] },
        { h: '၇။ ကျွန်ုပ်တို့၏ တာဝန်', body: [
          'ဥပဒေ ခွင့်ပြုသလောက် လွတ်သွားသော အချိန်ကောင်းများ သို့မဟုတ် download မဆွဲထားသဖြင့် ပျောက်သွားသော ဓာတ်ပုံများကဲ့သို့ သွယ်ဝိုက်ဆုံးရှုံးမှုများအတွက် ကျွန်ုပ်တို့ တာဝန်မရှိပါ။ ကျွန်ုပ်တို့ဘက်မှ အမှားကြောင့် session မအောင်မြင်ပါက [ငွေပြန်အမ်းခြင်း မူဝါဒ](#refunds) တွင် ဖော်ပြထားသည့်အတိုင်း points ပြန်ထည့်ပေးပါမည်။ ဤစည်းမျဉ်းများသည် သင်နေထိုင်ရာ ဥပဒေအရ သင်ရရှိသော အခွင့်အရေးများကို ဖယ်ရှားခြင်း မရှိပါ။'] },
        { h: '၈။ အသုံးပြုမှု ရပ်ဆိုင်းခြင်း', body: [
          'Together ကို အချိန်မရွေး အသုံးပြုခြင်း ရပ်နိုင်ပါသည်။ ဤစည်းမျဉ်းများကို ချိုးဖောက်သော အကောင့်ကို ယာယီရပ်ဆိုင်းခြင်း သို့မဟုတ် ပိတ်ခြင်း ပြုလုပ်နိုင်ပါသည်။ အကောင့်ဖျက်လိုက်ပါက သို့မဟုတ် စည်းမျဉ်းချိုးဖောက်မှုကြောင့် ပိတ်ခံရပါက မသုံးရသေးသော points များ ဆုံးရှုံးပါမည်။'] },
        { h: '၉။ ဤစည်းမျဉ်းများ ပြောင်းလဲခြင်း', body: [
          'Together တိုးတက်လာသည်နှင့်အမျှ ဤစည်းမျဉ်းများကို ပြင်ဆင်နိုင်ပါသည်။ ပြင်ဆင်ပါက ဤစာမျက်နှာထိပ်ရှိ ရက်စွဲကို ပြောင်းမည်ဖြစ်ပြီး အရေးကြီးသော ပြောင်းလဲမှုများအတွက် website ပေါ်တွင်လည်း အသိပေးချက် ပြသပါမည်။ ပြောင်းလဲပြီးနောက် Together ကို ဆက်လက် အသုံးပြုခြင်းသည် ပြင်ဆင်ထားသော စည်းမျဉ်းများကို လက်ခံခြင်း ဖြစ်ပါသည်။'] },
        { h: '၁၀။ ဥပဒေနှင့် ဆက်သွယ်ရန်', body: [
          'ဤစည်းမျဉ်းများကို မြန်မာနိုင်ငံ၏ ဥပဒေများဖြင့် အုပ်ချုပ်ပါသည်။ ဤစည်းမျဉ်းများနှင့် ပတ်သက်၍ မေးမြန်းလိုပါက - {mail}'] },
      ],
    },
    privacy: {
      title: 'ကိုယ်ရေးအချက်အလက် မူဝါဒ',
      intro: 'ဤမူဝါဒသည် Together က မည်သည့် အချက်အလက်များကို စုဆောင်းသည်၊ အဘယ်ကြောင့် စုဆောင်းသည်နှင့် ၎င်းတို့နှင့် ပတ်သက်၍ သင် မည်သို့ တောင်းဆိုနိုင်သည်ကို ရှင်းပြထားပါသည်။ အတိုချုပ်ဆိုရလျှင် **သင့်ဓာတ်ပုံနှင့် ဗီဒီယိုများ ကျွန်ုပ်တို့၏ server များသို့ မည်သည့်အခါမျှ မရောက်ပါ။** သင့်အကောင့်၊ points နှင့် ငွေပေးချေမှုများကို လုပ်ဆောင်ရန် လိုအပ်သည်များကိုသာ သိမ်းဆည်းပါသည်။ Together ကို {operator} (မြန်မာနိုင်ငံ) က လုပ်ကိုင်ပါသည်။ ဆက်သွယ်ရန် - {mail}',
      sections: [
        { h: '၁။ ကျွန်ုပ်တို့ မည်သည့်အခါမျှ မစုဆောင်းသည်များ', body: [[
          '**ဓာတ်ပုံများနှင့် live video -** ၎င်းတို့ကို သင့်စက်ပေါ်တွင် ရိုက်ကူး တည်းဖြတ်ပါသည်။ Duo booth တွင် စက်နှစ်ခုကြား တိုက်ရိုက် ပေးပို့ပြီး တိုက်ရိုက် ချိတ်ဆက်၍ မရပါက encrypted relay server မှတစ်ဆင့် သိမ်းဆည်းခြင်း မရှိဘဲ ဖြတ်သန်း ပေးပို့ပါသည်။',
          'Refresh လုပ်မိပါက ပြန်လည်ရယူနိုင်ရန် booth သည် သင့် session ၏ ယာယီမိတ္တူကို **သင့်ကိုယ်ပိုင် browser** အတွင်း အများဆုံး ၂၄ နာရီ သိမ်းထားပါသည်။ ၎င်းသည် သင့်စက်မှ မည်သည့်အခါမျှ ထွက်မသွားဘဲ booth တွင် ပိတ်ထားနိုင်ပါသည်။']] },
        { h: '၂။ ကျွန်ုပ်တို့ စုဆောင်းသည်များ', body: [[
          '**အကောင့် -** သင့် email လိပ်စာနှင့် Google ဖြင့် ဝင်ရောက်ပါက Google က မျှဝေသော အခြေခံ profile (ဥပမာ - သင့်အမည်)။',
          '**Points နှင့် session များ -** သင့် points လက်ကျန်နှင့် မှတ်တမ်း၊ session များ စတင်ချိန်နှင့် ပြီးဆုံးချိန်၊ အခမဲ့ session ကို သုံးပြီး မပြီး။',
          '**ငွေဖြည့်ခြင်း -** ငွေပမာဏ၊ သင် upload တင်သော ငွေလွှဲပြေစာ ပုံ၊ သင်ထည့်သော ငွေပေးချေမှု ရည်ညွှန်းနံပါတ်နှင့် အတည်ပြုခြင်း ရှိ မရှိ။ ပြေစာများကို သင်နှင့် စီမံခန့်ခွဲသူသာ ကြည့်နိုင်ပါသည်။',
          '**Duo booth များ -** ယာယီ room code၊ room ထဲတွင် မည်သူ ရှိသည်နှင့် အသင့်ဖြစ်မဖြစ် သို့မဟုတ် ချိတ်ဆက်ထားမထား။ Room များသည် မိနစ် ၄၅ အတွင်း အလိုအလျောက် ပြီးဆုံးပါသည်။',
          '**လုံခြုံရေး -** စကားဝှက် ခန့်မှန်းဝင်ရောက်ခြင်းမှ အကောင့်များကို ကာကွယ်ရန် IP လိပ်စာများနှင့် ဝင်ရောက်ရန် ကြိုးစားမှု အရေအတွက်များ၊ ဝင်ရောက်သည့် form များတွင် bot စစ်ဆေးမှု။',
          '**အကူအညီ အချက်အလက်များ -** booth ၏ “support details” ကို ကူးယူ၍ ကျွန်ုပ်တို့ထံ ပို့ရန် သင် ရွေးချယ်ပါက ၎င်းတွင် ချိတ်ဆက်မှု တိုင်းတာချက်များသာ ပါဝင်ပြီး ဓာတ်ပုံ သို့မဟုတ် အကောင့်အချက်အလက် မပါဝင်ပါ။']] },
        { h: '၃။ အသုံးပြုရသည့် အကြောင်းရင်း', body: [[
          'သင့်အကောင့်ကို ဖန်တီးရန်၊ လုံခြုံစေရန်နှင့် ဝင်ရောက်နိုင်စေရန်။',
          'Booth session များ လည်ပတ်ရန်၊ duo booth များ ချိတ်ဆက်ရန်နှင့် points များကို မှတ်တမ်းတင်ရန်။',
          'ငွေဖြည့်မှုများကို စစ်ဆေးရန်နှင့် ၎င်းတို့အကြောင်း email ပို့ရန်။',
          'အလွဲသုံးစားမှုကို တားဆီးရန်၊ ဥပမာ - email လိပ်စာတစ်ခုလျှင် အခမဲ့ session တစ်ကြိမ်သာ ပေးရန်။',
          'သင့်မေးခွန်းများကို ဖြေကြားရန်နှင့် ပြဿနာများကို ဖြေရှင်းရန်။'],
          'သင့်အချက်အလက်များကို ကျွန်ုပ်တို့ မရောင်းချပါ၊ ကြော်ငြာအတွက်လည်း အသုံးမပြုပါ။'] },
        { h: '၄။ သိမ်းဆည်းထားမည့် ကာလ', body: [[
          'အကောင့်၊ points နှင့် session အချက်အလက်များ - သင့်အကောင့် ရှိနေသရွေ့။',
          'Duo room အချက်အလက် - room ပြီးဆုံးသည်အထိ (မိနစ် ၄၅ အတွင်း)။',
          'အကောင့်ဖျက်ပြီးနောက် လိုအပ်နေဆဲ အချက်အလက်များကိုသာ သိမ်းထားပါသည် - စာရင်းကိုင်ခြင်း၊ လိမ်လည်မှု တားဆီးခြင်းနှင့် အငြင်းပွားမှုများ ဖြေရှင်းခြင်းအတွက် ငွေပေးချေမှုနှင့် points မှတ်တမ်းများ (ပြေစာများ အပါအဝင်) နှင့် ထို email လိပ်စာက အခမဲ့ session သုံးပြီးကြောင်း မှတ်တမ်း။']] },
        { h: '၅။ သင့်ရွေးချယ်ခွင့်များ', body: [
          'အောက်ပါတို့အတွက် သင့်အကောင့်၏ email လိပ်စာမှ {mail} သို့ email ပို့ပါ -',
          ['ကျွန်ုပ်တို့ သိမ်းထားသော သင့်အချက်အလက်များ၏ မိတ္တူ ရယူရန်၊',
           'မှားယွင်းနေသည်များကို ပြင်ဆင်ရန်၊ သို့မဟုတ်',
           '**သင့်အကောင့်ကို ဖျက်ရန်။** အကောင့်ဖျက်လိုက်ပါက မသုံးရသေးသော points များ ဆုံးရှုံးမည်ဖြစ်ပြီး တူညီသော email လိပ်စာအတွက် အခမဲ့ session ကို ထပ်မံ မပေးပါ။'],
          'ရက် ၃၀ အတွင်း ပြန်ကြားရန် ကြိုးစားပါသည်။'] },
        { h: '၆။ ကလေးများ', body: [
          'အသက် ၁၃ နှစ်အောက် ကလေးများသည် မိဘ သို့မဟုတ် အုပ်ထိန်းသူ၏ ခွင့်ပြုချက်နှင့် ကြီးကြပ်မှုဖြင့်သာ Together ကို အသုံးပြုနိုင်ပြီး အသက် ၁၈ နှစ်အောက်သူများ points ဝယ်ရန် ခွင့်ပြုချက် လိုအပ်ပါသည်။ မိဘ သို့မဟုတ် အုပ်ထိန်းသူသည် ၎င်းတို့ ကလေး၏ အကောင့်ကို ပြန်လည်စစ်ဆေးရန် သို့မဟုတ် ဖျက်ရန် အချိန်မရွေး ဆက်သွယ်နိုင်ပါသည်။'] },
        { h: '၇။ လုံခြုံရေး', body: [
          'Together သို့ ချိတ်ဆက်မှုများကို encrypt လုပ်ထားပြီး လူတစ်ဦးစီသည် မိမိ၏ အကောင့်အချက်အလက်များကိုသာ ဝင်ကြည့်နိုင်ကာ စီမံခန့်ခွဲခွင့်ကို ကန့်သတ်ထားပါသည်။ မည်သည့်စနစ်မျှ အပြည့်အဝ လုံခြုံသည် မဟုတ်သော်လည်း သင့်အချက်အလက်များကို ကာကွယ်ရန် ကြိုးစားပြီး ပြဿနာ တစ်စုံတစ်ရာ ဖြစ်ပေါ်ပါက အမြန်ဆုံး ဆောင်ရွက်ပါမည်။'] },
        { h: '၈။ ပြောင်းလဲမှုများ', body: [
          'ဤမူဝါဒကို ပြောင်းလဲပါက ထိပ်ရှိ ရက်စွဲကို ပြင်ဆင်မည်ဖြစ်ပြီး အရေးကြီးသော ပြောင်းလဲမှုများအတွက် website ပေါ်တွင် အသိပေးချက် ပြသပါမည်။'] },
      ],
    },
    refunds: {
      title: 'ငွေပြန်အမ်းခြင်း မူဝါဒ',
      intro: 'Points များကို ကြိုတင်ဝယ်ယူရပြီး **သက်တမ်း မကုန်ပါ**။ ထို့ကြောင့် သင်ကြိုက်သည့်အချိန်တွင် သုံးနိုင်ပါသည်။ ဤစာမျက်နှာသည် points များကို မည်သည့်အခါ ပြန်ထည့်ပေးနိုင်သည်နှင့် မည်သည့်အရာများကို ပြန်အမ်း၍ မရသည်ကို ရှင်းပြထားပါသည်။',
      sections: [
        { h: '၁။ ဝယ်ယူထားသော points များ', body: [
          '**Points များကို ငွေပြန်မအမ်းပါ။** ငွေဖြည့်မှု အတည်ပြုပြီးနောက် သုံးပြီးသည်ဖြစ်စေ၊ မသုံးရသေးသည်ဖြစ်စေ points များအတွက် ငွေပြန်မပေးပါ။ လိုအပ်သော ပမာဏကိုသာ ရွေးချယ်ပါ။'] },
        { h: '၂။ Points ပြန်ထည့်ပေးမည့် အခြေအနေများ', body: [
          'ကျွန်ုပ်တို့ဘက်မှ ပြဿနာကြောင့် points နုတ်ယူပြီးသော session ကို မပြီးဆုံးနိုင်ပါက သင့်အကောင့်သို့ points ပြန်ထည့်ပေးပါမည်။ ဥပမာ -',
          ['website အမှားကြောင့် ပေးချေပြီးသော session ကို တည်းဖြတ်ခြင်း သို့မဟုတ် download ဆွဲခြင်း မပြုနိုင်ခြင်း၊',
           'session တစ်ခုတည်းအတွက် နှစ်ကြိမ် နုတ်ယူခံရခြင်း၊ သို့မဟုတ်',
           'မနုတ်သင့်ဘဲ points နုတ်ယူခံရခြင်း။'],
          'ပြင်ဆင်ပေးမှုများကို ငွေဖြင့် မဟုတ်ဘဲ points ဖြင့် ပြုလုပ်ပါသည်။'] },
        { h: '၃။ မပါဝင်သည်များ', body: [[
          'စိတ်ပြောင်းသွားခြင်း သို့မဟုတ် ဝယ်ထားသော points များကို မသုံးခြင်း။',
          'Booth မှ ထွက်သွားခြင်း၊ session ကို စောစီးစွာ ရပ်ခြင်း သို့မဟုတ် အခြားသူ ထွက်သွားခြင်း။',
          'သင့်ကိုယ်ပိုင် စက်၊ ကင်မရာ ခွင့်ပြုချက် သို့မဟုတ် အင်တာနက် ချိတ်ဆက်မှုကြောင့် ဖြစ်သော ပြဿနာများ။',
          'ငွေသားတန်ဖိုး မရှိသော အခမဲ့ session။']] },
        { h: '၄။ ငွေဖြည့်ခြင်းဆိုင်ရာ ပြဿနာများ', body: [
          'ငွေလွှဲပြီးသော်လည်း points မရောက်သေးပါက သို့မဟုတ် ပမာဏ မှားနေပုံရပါက သင့်အကောင့် email၊ ရက်စွဲနှင့် ငွေပေးချေမှု ရည်ညွှန်းနံပါတ်တို့ဖြင့် email ပို့ပါ။ ငွေလွှဲမှုတိုင်းကို လူကိုယ်တိုင် စစ်ဆေးပြီး သင်နှင့်အတူ ဖြေရှင်းပေးပါမည်။'] },
        { h: '၅။ Together ပိတ်သိမ်းပါက', body: [
          'Together ကို ပိတ်ရန် ဆုံးဖြတ်ပါက points ရောင်းချခြင်းကို ရပ်ပြီး ကျန်ရှိသော points များကို သုံးနိုင်ရန် website ပေါ်တွင် အနည်းဆုံး ရက် ၃၀ ကြိုတင် အသိပေးပါမည်။'] },
        { h: '၆။ တောင်းဆိုနည်း', body: [
          'ပြဿနာ ဖြစ်ပြီးနောက် အမြန်ဆုံး သင့်အကောင့်၏ email လိပ်စာမှ {mail} သို့ ရက်စွဲနှင့် အကျဉ်းချုပ် ဖော်ပြချက် (screenshot ပါလျှင် ပိုကောင်း) ဖြင့် email ပို့ပါ။ ရက်အနည်းငယ်အတွင်း ပြန်ကြားရန် ကြိုးစားပါသည်။'] },
      ],
    },
  },
};

const vi: LegalLanguage = {
  label: 'Tiếng Việt', locale: 'vi', back: 'Về trang chủ', updated: 'Cập nhật lần cuối', pickLabel: 'Ngôn ngữ',
  pages: {
    terms: {
      title: 'Điều khoản dịch vụ',
      intro: 'Các điều khoản này giải thích cách bạn có thể sử dụng Together, một photobooth trực tuyến để tạo thẻ ảnh một mình hoặc cùng người ở xa. Khi tạo tài khoản hoặc sử dụng booth, bạn đồng ý với các điều khoản này. Together do {operator}, một cá nhân sinh sống tại Myanmar (“chúng tôi”), vận hành.',
      sections: [
        { h: '1. Ai có thể sử dụng Together', body: [
          'Mọi người đều có thể sử dụng Together, với các điều kiện sau cho người nhỏ tuổi:',
          ['**Dưới 13 tuổi:** chỉ khi có sự cho phép và giám sát của cha mẹ hoặc người giám hộ. Cha mẹ hoặc người giám hộ chấp nhận các điều khoản này thay cho trẻ.',
           '**Dưới 18 tuổi:** cần sự cho phép của cha mẹ hoặc người giám hộ để mua điểm (points).'],
          'Nếu biết một tài khoản vi phạm các điều kiện này, chúng tôi có thể đóng tài khoản đó.'] },
        { h: '2. Tài khoản của bạn', body: [[
          'Tài khoản sử dụng địa chỉ Gmail. Bạn có thể đăng nhập bằng Google, hoặc bằng email và mật khẩu sau khi xác nhận địa chỉ email.',
          'Mỗi người một tài khoản. Hãy giữ bí mật mật khẩu; bạn chịu trách nhiệm về mọi hoạt động trên tài khoản của mình.',
          'Bạn có thể yêu cầu xóa tài khoản bất cứ lúc nào (xem [Chính sách quyền riêng tư](#privacy)).']] },
        { h: '3. Điểm và thanh toán', body: [[
          'Các phiên booth được trả bằng điểm. Mỗi phiên tốn **100 điểm**. Mỗi địa chỉ email được **một phiên miễn phí**, được dùng trước khi trừ điểm.',
          'Điểm chỉ bị trừ khi bạn xác nhận đã sẵn sàng chỉnh sửa. Chụp lại và tải xuống trong phiên đó đã được bao gồm. Trong booth đôi (duo), chỉ người tạo booth trả điểm; người tham gia không bao giờ bị tính phí.',
          'Bạn mua điểm bằng chuyển khoản ngân hàng (KBZPay, bằng MMK) và tải lên biên lai. Chúng tôi kiểm tra thủ công từng giao dịch và cộng điểm sau khi xác nhận, nên không diễn ra ngay lập tức.',
          'Điểm không bao giờ hết hạn. Điểm không có giá trị tiền mặt, không thể đổi thành tiền và không thể chuyển sang tài khoản khác.',
          'Giá được hiển thị trên trang Buy points tại thời điểm bạn mua. Việc hoàn tiền được quy định trong [Chính sách hoàn tiền](#refunds).']] },
        { h: '4. Sử dụng booth', body: [[
          'Booth chỉ dùng camera sau khi bạn cho phép trong trình duyệt. Chỉ mời những người muốn tham gia cùng bạn.',
          'Không sử dụng Together để quấy rối, đe dọa hoặc bóc lột bất kỳ ai, để chia sẻ nội dung tình dục liên quan đến trẻ vị thành niên, hoặc cho bất kỳ mục đích bất hợp pháp nào. Chúng tôi có thể đóng các tài khoản vi phạm.',
          'Không cố gắng phá hoại, làm quá tải hoặc vượt qua các biện pháp bảo mật, giới hạn hoặc hệ thống thanh toán của dịch vụ.']] },
        { h: '5. Ảnh của bạn', body: [
          'Ảnh là của bạn. Ảnh được chụp và chỉnh sửa trên thiết bị của bạn; trong booth đôi, ảnh được truyền trực tiếp giữa hai thiết bị. Chúng tôi không nhận, lưu trữ hay sử dụng ảnh của bạn. Hãy tải thẻ ảnh xuống trước khi rời đi; booth chỉ giữ một bản sao tạm thời trong trình duyệt của bạn tối đa 24 giờ để giúp khôi phục khi bạn tải lại trang.'] },
        { h: '6. Tính sẵn có và thay đổi', body: [
          'Together được cung cấp “nguyên trạng”. Chúng tôi cố gắng để dịch vụ hoạt động tốt, nhưng đôi khi dịch vụ có thể chậm, gián đoạn hoặc thay đổi, và video trực tiếp phụ thuộc vào thiết bị và kết nối internet của cả hai người. Nếu quyết định đóng cửa Together, chúng tôi sẽ ngừng bán điểm và thông báo trước ít nhất 30 ngày trên website để bạn dùng hết số điểm còn lại.'] },
        { h: '7. Trách nhiệm của chúng tôi', body: [
          'Trong phạm vi pháp luật cho phép, chúng tôi không chịu trách nhiệm về các thiệt hại gián tiếp, chẳng hạn như lỡ mất khoảnh khắc hoặc mất ảnh mà bạn chưa tải xuống. Nếu một phiên thất bại do lỗi từ phía chúng tôi, chúng tôi sẽ hoàn lại điểm như mô tả trong [Chính sách hoàn tiền](#refunds). Không điều khoản nào ở đây loại bỏ các quyền mà bạn có theo pháp luật nơi bạn sinh sống.'] },
        { h: '8. Ngừng sử dụng', body: [
          'Bạn có thể ngừng sử dụng Together bất cứ lúc nào. Chúng tôi có thể tạm khóa hoặc đóng tài khoản vi phạm các điều khoản này. Điểm chưa dùng sẽ mất khi tài khoản bị xóa hoặc bị đóng do vi phạm.'] },
        { h: '9. Thay đổi điều khoản', body: [
          'Chúng tôi có thể cập nhật các điều khoản này khi Together phát triển. Khi đó, chúng tôi sẽ thay đổi ngày ở đầu trang; với những thay đổi quan trọng, chúng tôi cũng sẽ hiển thị thông báo trên website. Tiếp tục sử dụng Together sau khi có thay đổi nghĩa là bạn chấp nhận các điều khoản đã cập nhật.'] },
        { h: '10. Luật áp dụng và liên hệ', body: [
          'Các điều khoản này được điều chỉnh bởi pháp luật Myanmar. Mọi câu hỏi về các điều khoản này: {mail}.'] },
      ],
    },
    privacy: {
      title: 'Chính sách quyền riêng tư',
      intro: 'Chính sách này giải thích Together thu thập thông tin gì, vì sao, và bạn có thể yêu cầu chúng tôi làm gì với thông tin đó. Tóm lại: **ảnh và video của bạn không bao giờ đến máy chủ của chúng tôi.** Chúng tôi chỉ giữ những gì cần thiết để vận hành tài khoản, điểm và thanh toán của bạn. Together do {operator} (Myanmar) vận hành; liên hệ {mail}.',
      sections: [
        { h: '1. Những gì chúng tôi không bao giờ thu thập', body: [[
          '**Ảnh và video trực tiếp.** Chúng được chụp và chỉnh sửa trên thiết bị của bạn. Trong booth đôi, chúng được truyền trực tiếp giữa hai thiết bị, hoặc khi không thể kết nối trực tiếp, qua một máy chủ chuyển tiếp được mã hóa, chỉ chuyển tiếp mà không lưu trữ.',
          'Để giúp bạn khôi phục khi tải lại trang, booth giữ một bản sao tạm thời của phiên trong **trình duyệt của chính bạn** tối đa 24 giờ. Bản sao này không bao giờ rời khỏi thiết bị và bạn có thể tắt nó trong booth.']] },
        { h: '2. Những gì chúng tôi thu thập', body: [[
          '**Tài khoản:** địa chỉ email của bạn và, nếu bạn đăng nhập bằng Google, hồ sơ cơ bản mà Google chia sẻ (như tên của bạn).',
          '**Điểm và phiên:** số dư và lịch sử điểm, thời điểm bắt đầu và hoàn thành các phiên, và việc bạn đã dùng phiên miễn phí hay chưa.',
          '**Nạp điểm:** số tiền, ảnh biên lai chuyển khoản bạn tải lên, mã tham chiếu thanh toán bạn nhập (nếu có) và trạng thái phê duyệt. Biên lai chỉ bạn và quản trị viên xem được.',
          '**Booth đôi:** mã phòng tạm thời, ai đang ở trong phòng và trạng thái sẵn sàng hoặc kết nối. Phòng tự động kết thúc trong vòng 45 phút.',
          '**Bảo mật:** địa chỉ IP và số lần thử đăng nhập để bảo vệ tài khoản khỏi việc đoán mật khẩu, cùng bước kiểm tra chống bot trên các biểu mẫu đăng nhập.',
          '**Thông tin hỗ trợ:** nếu bạn chọn sao chép và gửi cho chúng tôi “support details” của booth, chúng chỉ chứa các số đo kết nối, không bao giờ có ảnh hay thông tin tài khoản.']] },
        { h: '3. Mục đích sử dụng', body: [[
          'Để tạo, bảo vệ tài khoản và cho bạn đăng nhập.',
          'Để vận hành các phiên booth, kết nối booth đôi và theo dõi điểm.',
          'Để kiểm tra các khoản nạp điểm và gửi email cho bạn về chúng.',
          'Để ngăn chặn lạm dụng, ví dụ chỉ cấp phiên miễn phí một lần cho mỗi địa chỉ email.',
          'Để trả lời câu hỏi và khắc phục sự cố.'],
          'Chúng tôi không bán thông tin của bạn và không dùng nó cho quảng cáo.'] },
        { h: '4. Thời gian lưu trữ', body: [[
          'Thông tin tài khoản, điểm và phiên: trong suốt thời gian tài khoản tồn tại.',
          'Thông tin phòng booth đôi: cho đến khi phòng kết thúc (trong vòng 45 phút).',
          'Sau khi tài khoản bị xóa, chúng tôi chỉ giữ những gì vẫn cần thiết: hồ sơ thanh toán và điểm (bao gồm biên lai) cho mục đích kế toán, phòng chống gian lận và giải quyết tranh chấp, cùng một bản ghi cho biết địa chỉ email đó đã dùng phiên miễn phí.']] },
        { h: '5. Quyền lựa chọn của bạn', body: [
          'Gửi email đến {mail} từ địa chỉ email của tài khoản để:',
          ['nhận bản sao thông tin chúng tôi lưu về bạn,',
           'sửa thông tin không chính xác, hoặc',
           '**xóa tài khoản của bạn.** Điểm chưa dùng sẽ mất khi tài khoản bị xóa, và phiên miễn phí sẽ không được cấp lại cho cùng địa chỉ email.'],
          'Chúng tôi cố gắng phản hồi trong vòng 30 ngày.'] },
        { h: '6. Trẻ em', body: [
          'Trẻ em dưới 13 tuổi chỉ được dùng Together khi có sự cho phép và giám sát của cha mẹ hoặc người giám hộ, và người dưới 18 tuổi cần được cho phép để mua điểm. Cha mẹ hoặc người giám hộ có thể liên hệ với chúng tôi bất cứ lúc nào để xem lại hoặc xóa tài khoản của con.'] },
        { h: '7. Bảo mật', body: [
          'Kết nối đến Together được mã hóa, mỗi người chỉ truy cập được dữ liệu tài khoản của chính mình, và quyền quản trị được giới hạn. Không hệ thống nào an toàn tuyệt đối, nhưng chúng tôi luôn nỗ lực bảo vệ thông tin của bạn và sẽ hành động nhanh chóng nếu có sự cố.'] },
        { h: '8. Thay đổi', body: [
          'Nếu thay đổi chính sách này, chúng tôi sẽ cập nhật ngày ở đầu trang và hiển thị thông báo trên website với những thay đổi quan trọng.'] },
      ],
    },
    refunds: {
      title: 'Chính sách hoàn tiền',
      intro: 'Điểm được mua trước và **không bao giờ hết hạn**, nên bạn có thể dùng bất cứ khi nào. Trang này giải thích khi nào điểm được hoàn lại và những gì chúng tôi không thể hoàn tiền.',
      sections: [
        { h: '1. Điểm đã mua', body: [
          '**Điểm không được hoàn tiền.** Sau khi khoản nạp được phê duyệt, chúng tôi không hoàn lại tiền cho điểm, dù đã dùng hay chưa dùng. Hãy chọn số điểm bạn cần.'] },
        { h: '2. Khi nào chúng tôi hoàn lại điểm', body: [
          'Nếu một phiên đã bị trừ điểm nhưng không thể hoàn thành do lỗi từ phía chúng tôi, chúng tôi sẽ cộng lại điểm vào tài khoản của bạn. Ví dụ:',
          ['lỗi website khiến bạn không thể chỉnh sửa hoặc tải xuống phiên đã thanh toán,',
           'bạn bị trừ điểm hai lần cho cùng một phiên, hoặc',
           'điểm bị trừ khi lẽ ra không nên bị trừ.'],
          'Việc điều chỉnh được thực hiện bằng điểm, không bằng tiền.'] },
        { h: '3. Những trường hợp không áp dụng', body: [[
          'Đổi ý, hoặc không dùng số điểm đã mua.',
          'Rời booth hoặc kết thúc phiên sớm, hoặc người kia rời đi.',
          'Sự cố do thiết bị, quyền truy cập camera hoặc kết nối internet của bạn.',
          'Phiên miễn phí, vốn không có giá trị tiền mặt.']] },
        { h: '4. Sự cố khi nạp điểm', body: [
          'Nếu bạn đã chuyển tiền nhưng điểm chưa xuất hiện, hoặc số điểm có vẻ sai, hãy gửi email cho chúng tôi kèm email tài khoản, ngày chuyển và mã tham chiếu thanh toán. Chúng tôi kiểm tra thủ công từng giao dịch và sẽ cùng bạn giải quyết.'] },
        { h: '5. Nếu Together đóng cửa', body: [
          'Nếu quyết định đóng cửa Together, chúng tôi sẽ ngừng bán điểm và thông báo trước ít nhất 30 ngày trên website để bạn dùng hết số điểm còn lại.'] },
        { h: '6. Cách yêu cầu', body: [
          'Gửi email đến {mail} từ địa chỉ email của tài khoản, càng sớm càng tốt sau khi xảy ra sự cố, kèm ngày và mô tả ngắn (ảnh chụp màn hình sẽ giúp ích). Chúng tôi cố gắng phản hồi trong vài ngày.'] },
      ],
    },
  },
};

export const LEGAL_LANGUAGES: Record<LangCode, LegalLanguage> = { en, my, vi };
export const LANG_ORDER: LangCode[] = ['en', 'my', 'vi'];
