// JJQR - AI (Nov 20, 2026) - PV-11: the public privacy notice (RA 10173), English + Filipino. DRAFT: the clinic and its lawyer must review the wording before it is relied on.
export type NoticeLang = "en" | "fil";

export interface NoticeSection { heading: string; paragraphs?: string[]; bullets?: string[] }
export interface NoticeText { title: string; intro: string; updated: string; sections: NoticeSection[]; switchLabel: string; draftNote: string }

export const NOTICE_UPDATED = "November 20, 2026";

export const NOTICE: Record<NoticeLang, NoticeText> = {
  en: {
    title: "Privacy Notice",
    switchLabel: "Basahin sa Filipino",
    draftNote: "Draft — pending review by the clinic.",
    updated: `Last updated: ${NOTICE_UPDATED}`,
    intro:
      "Dr. Grace Gavino Medical Clinic (“the clinic”) respects your privacy. This notice explains what personal information we collect through this patient system, why, who can see it, how long we keep it, and what rights you have under the Data Privacy Act of 2012 (Republic Act No. 10173).",
    sections: [
      {
        heading: "What we collect",
        bullets: [
          "Identity and contact details: name, date of birth, sex, address, phone number, email, emergency contact.",
          "Health information: visit notes, diagnoses, prescriptions, vital signs, lab orders and results, vaccinations, allergies, medical certificates and files you or the clinic upload.",
          "Booking and payment records: appointments, fees, payment method and proof of payment.",
          "Account and security records: your login email, sign-in times, failed sign-in attempts and a record of which clinic staff opened your record.",
        ],
      },
      {
        heading: "Why we collect it",
        bullets: [
          "To give you medical care and keep an accurate medical record.",
          "To schedule appointments, issue receipts and certificates, and handle billing.",
          "To keep the system secure and to show who accessed your record.",
          "To meet legal obligations, such as keeping medical records.",
        ],
        paragraphs: ["We use your information only for these purposes. We do not sell it and we do not use it for advertising."],
      },
      {
        heading: "Who can see it",
        paragraphs: [
          "Only clinic personnel who need it for their work: your doctor, the front-desk staff and the clinic administrator. Each time they open your record the system writes it down, and the administrator can review this list.",
          "We share information with outside parties only when you ask us to (for example, a lab or an HMO), or when the law requires it.",
        ],
      },
      {
        heading: "How long we keep it",
        paragraphs: [
          "Medical records are kept for at least seven (7) years after your last visit. After that they are deleted or anonymised. Account and security logs are kept only as long as needed to protect the system.",
        ],
      },
      {
        heading: "How we protect it",
        bullets: [
          "Connections are encrypted (HTTPS) and sign-in uses protected cookies.",
          "Passwords are stored in scrambled (hashed) form and accounts lock after repeated wrong passwords.",
          "Role-based access: patients see only their own record; staff see only what their role needs.",
          "Uploaded files are not public; they open only for signed-in people who are allowed to see them.",
        ],
      },
      {
        heading: "Your rights",
        bullets: [
          "Be informed — this notice, and any change to it.",
          "Access — you can download a copy of your data from your profile (Privacy tab).",
          "Correct — ask us to fix information that is wrong (Privacy tab → Request a correction).",
          "Erasure or blocking — ask us to delete your data. Medical records must be kept for 7 years after your last visit, so the request is logged and carried out when that period ends.",
          "Object or withdraw consent — you can say no or withdraw at any time from the Privacy tab. Withdrawing does not undo what was lawfully done before; the clinic may be unable to book new visits until you agree again.",
          "Complain — you may file a complaint with the National Privacy Commission (privacy.gov.ph).",
        ],
      },
      {
        heading: "If something goes wrong",
        paragraphs: [
          "If your personal data is breached in a way that could harm you, the clinic will tell the National Privacy Commission and the people affected within 72 hours of knowing about it.",
        ],
      },
      {
        heading: "Contact us",
        paragraphs: ["Data Protection Officer, Dr. Grace Gavino Medical Clinic — [clinic to fill in: email and phone]."],
      },
    ],
  },
  fil: {
    title: "Paunawa sa Privacy",
    switchLabel: "Read in English",
    draftNote: "Draft — hinihintay pa ang pagsusuri ng klinika.",
    updated: `Huling na-update: ${NOTICE_UPDATED}`,
    intro:
      "Iginagalang ng Dr. Grace Gavino Medical Clinic (“ang klinika”) ang iyong privacy. Ipinapaliwanag ng paunawang ito kung anong personal na impormasyon ang kinokolekta namin sa sistemang ito, bakit, sino ang makakakita, gaano katagal namin itong iniingatan, at ang iyong mga karapatan sa ilalim ng Data Privacy Act of 2012 (Republic Act No. 10173).",
    sections: [
      {
        heading: "Ano ang kinokolekta namin",
        bullets: [
          "Pagkakakilanlan at contact: pangalan, petsa ng kapanganakan, kasarian, tirahan, numero ng telepono, email, at kontak sa oras ng emergency.",
          "Impormasyon sa kalusugan: tala ng konsulta, diagnosis, reseta, vital signs, lab orders at resulta, bakuna, allergy, medical certificate, at mga file na ina-upload mo o ng klinika.",
          "Tala ng booking at bayad: mga appointment, singil, paraan ng pagbabayad at patunay ng bayad.",
          "Tala ng account at seguridad: ang iyong login email, oras ng pag-sign in, mga bigong pagtatangkang mag-sign in, at tala kung aling kawani ng klinika ang nagbukas ng iyong rekord.",
        ],
      },
      {
        heading: "Bakit namin ito kinokolekta",
        bullets: [
          "Upang bigyan ka ng medikal na pangangalaga at mapanatiling tama ang iyong medical record.",
          "Upang mag-iskedyul ng appointment, magbigay ng resibo at sertipiko, at mag-asikaso ng bayarin.",
          "Upang mapanatiling ligtas ang sistema at maipakita kung sino ang tumingin sa iyong rekord.",
          "Upang matupad ang mga obligasyon sa batas, tulad ng pag-iingat ng medical records.",
        ],
        paragraphs: ["Ginagamit lang namin ang iyong impormasyon para sa mga layuning ito. Hindi namin ito ibinebenta at hindi ginagamit sa patalastas."],
      },
      {
        heading: "Sino ang makakakita",
        paragraphs: [
          "Mga kawani lang ng klinika na nangangailangan nito sa kanilang trabaho: ang iyong doktor, ang front-desk staff at ang administrator ng klinika. Tuwing bubuksan nila ang iyong rekord, isinusulat ito ng sistema, at maaaring suriin ng administrator ang listahang ito.",
          "Nagbabahagi lang kami sa ibang partido kapag hiniling mo (halimbawa, laboratoryo o HMO), o kapag iniuutos ng batas.",
        ],
      },
      {
        heading: "Gaano katagal namin ito iniingatan",
        paragraphs: [
          "Iniingatan ang medical records nang hindi bababa sa pitong (7) taon mula sa huli mong konsulta. Pagkatapos nito, buburahin o gagawing hindi na matutukoy ang pagkakakilanlan. Ang tala ng account at seguridad ay iniingatan lang hangga't kailangan para protektahan ang sistema.",
        ],
      },
      {
        heading: "Paano namin ito pinoprotektahan",
        bullets: [
          "Naka-encrypt ang koneksyon (HTTPS) at protektado ang cookies sa pag-sign in.",
          "Naka-hash (nakatago ang anyo) ang mga password, at nagla-lock ang account kapag paulit-ulit na mali ang password.",
          "May hangganan ang access ayon sa tungkulin: ang pasyente ay sarili lang ang nakikita; ang kawani ay ang kailangan lang ng kanyang tungkulin.",
          "Hindi pampubliko ang mga na-upload na file; mabubuksan lang ng mga naka-sign in at pinapayagan.",
        ],
      },
      {
        heading: "Ang iyong mga karapatan",
        bullets: [
          "Maabisuhan — ang paunawang ito at anumang pagbabago nito.",
          "Access — maaari kang mag-download ng kopya ng iyong data sa iyong profile (tab na Privacy).",
          "Pagwawasto — hilingin na ayusin ang maling impormasyon (tab na Privacy → Humiling ng pagwawasto).",
          "Pagbura o pag-block — hilingin na burahin ang iyong data. Kailangang itago ang medical records nang 7 taon mula sa huling konsulta, kaya itatala ang hiling at isasagawa kapag tapos na ang panahong iyon.",
          "Tumutol o bawiin ang pahintulot — maaari kang tumanggi o magbawi anumang oras sa tab na Privacy. Hindi nito binabawi ang mga ginawa nang naaayon sa batas bago iyon; maaaring hindi ka muna makapag-book ng bagong konsulta hangga't hindi ka muling pumapayag.",
          "Magreklamo — maaari kang magsampa ng reklamo sa National Privacy Commission (privacy.gov.ph).",
        ],
      },
      {
        heading: "Kung may mangyaring paglabag",
        paragraphs: [
          "Kung may paglabag sa iyong personal na datos na maaaring makasama sa iyo, aabisuhan ng klinika ang National Privacy Commission at ang mga apektado sa loob ng 72 oras mula nang malaman ito.",
        ],
      },
      {
        heading: "Makipag-ugnayan",
        paragraphs: ["Data Protection Officer, Dr. Grace Gavino Medical Clinic — [dapat punan ng klinika: email at telepono]."],
      },
    ],
  },
};

export function noticeLang(v: string | null | undefined): NoticeLang {
  return v === "fil" || v === "tl" ? "fil" : "en";
}
// JJQR - END
