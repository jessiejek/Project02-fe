import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLabRequestHtml,
  buildMedicalCertificateHtml,
  buildPrescriptionHtml,
} from "./print-forms-html.ts";

const ORIGIN = "http://forms.test";
const PAGE_A5 = "148mm 210mm";
const PAGE_LAB = "4.3in 6.4in";

const doctor = {
  full_name: "Jane Doe",
  license_number: "LIC-99",
  ptr_number: "PTR-88",
  s2_number: "S2-77",
};

const patient = {
  full_name: "Juan Dela Cruz",
  sex: "Male",
  address: "Buaya, Lapu Lapu City",
};

const headerLabels = [
  "ALLYN GRACE T. ESPAÑA-GAVINO, MD",
  "FAMILY AND COMMUNITY MEDICINE",
  "ADULT AND PEDIA",
  "GRACE MEDICAL CLINIC",
  "3ML Quezon National Highway",
  "Buaya, Lapu Lapu City",
  "Contact # 09285612976",
  "Monday to Friday",
  "10:00am - 5:00pm",
  "7:00pm - 8:00pm",
  "Saturday",
  "10:00pm- 5:00pm",
];

function assertHeader(html) {
  for (const label of headerLabels) {
    assert.ok(html.includes(label), `missing header label: ${label}`);
  }
  assert.ok(html.includes(`${ORIGIN}/forms/logo.png`));
  assert.ok(html.includes(`${ORIGIN}/forms/seal.png`));
}

function countClass(html, cls) {
  return html.split(`class="${cls}"`).length - 1;
}

const oneMed = {
  generic_name: "Paracetamol",
  dosage: "500 mg",
  quantity: "20 tablets",
  instruction: "as needed",
  timing: "Breakfast,Dinner",
  meal_relation: "After",
  duration_kind: "Days",
  duration_value: 5,
  indication: "fever",
  route: "oral",
};

test("medical certificate: A5 page size, stationery, labels, fill, escape", () => {
  const html = buildMedicalCertificateHtml({
    origin: ORIGIN,
    pageSize: PAGE_A5,
    doctor,
    patient,
    issueDate: "November 20, 2026",
    address: "Cebu City",
    examinedAt: "Grace Medical Clinic",
    examFrom: "November 18, 2026",
    examTo: "November 19, 2026",
    diagnosis: "Acute gastritis",
    recommendations: "Rest",
    purposeException: "employment",
    comeBackOn: "November 27, 2026",
  });

  assert.match(html, /@page\s*\{[^}]*size:\s*148mm 210mm/);
  assertHeader(html);
  assert.ok(html.includes("MEDICAL CERTIFICATE"));
  assert.ok(html.includes("Date:"));
  assert.ok(html.includes("To whom it may concern,"));
  assert.ok(html.includes("This is to certify that "));
  assert.ok(html.includes("Mr."));
  assert.ok(html.includes("Ms."));
  assert.ok(html.includes("Mrs."));
  assert.match(html, /t-hit">Mr\./);
  assert.ok(!html.includes('t-hit">Ms.'));
  assert.ok(!html.includes('t-hit">Mrs.'));
  assert.ok(html.includes("residing at"));
  assert.ok(html.includes("has been examined in"));
  assert.ok(html.includes("until"));
  assert.ok(html.includes("Diagnosis/ Impressions:"));
  assert.ok(html.includes("Recommendations:"));
  assert.ok(
    html.includes("This certificate is issued upon the request for whatever purpose it may serve except"),
  );
  assert.ok(html.includes("and may not be used for medico-legal purposes."));
  assert.ok(html.includes("Please come back on:"));
  assert.ok(html.includes("License No:"));
  assert.ok(html.includes("PTR No:"));
  assert.ok(html.includes("S2 No:"));
  assert.ok(html.includes("Juan Dela Cruz"));
  assert.ok(html.includes("Cebu City"));
  assert.ok(html.includes("Grace Medical Clinic"));
  assert.ok(html.includes("November 20, 2026"));
  assert.ok(html.includes("Acute gastritis"));
  assert.ok(html.includes("Rest"));
  assert.ok(html.includes("employment"));
  assert.ok(html.includes("LIC-99"));
  assert.ok(html.includes("PTR-88"));
  assert.ok(html.includes("S2-77"));
  assert.ok(html.includes("JANE DOE, MD"));

  assert.match(html, /--pad-l:\s*0\.50in/);
  assert.match(html, /--pad-r:\s*0\.53in/);
  assert.match(html, /line-height:\s*0\.23in/);
  assert.match(html, /width:\s*1\.45in/);
  assert.match(html, /width:\s*1\.7in/);
  assert.match(html, /border-radius:\s*999px/);
  assert.match(html, /font-size:\s*12\.5pt/);
  assert.match(html, /font-size:\s*9\.4pt/);
  assert.match(html, /font-size:\s*7\.6pt/);
  assert.match(html, /left:\s*0\.32in/);
  assert.match(html, /left:\s*4\.78in/);
  assert.match(html, /left:\s*2\.83in/);
  assert.match(html, /left:\s*0\.96in/);
  assert.match(html, /left:\s*3\.09in/);
  assert.match(html, /left:\s*4\.77in/);
  assert.match(html, /left:\s*2\.76in/);
  assert.match(html, /top:\s*0\.40in/);
  assert.match(html, /top:\s*1\.62in/);
  assert.match(html, /width:\s*0\.40in/);
  assert.match(html, /width:\s*5\.05in/);
  assert.match(html, /padding-right:\s*0\.08in/);
  assert.ok(html.includes('class="h-day"'));
  assert.ok(html.includes('class="h-time"'));
  assert.ok(html.includes('class="t-opt'));
  assert.ok(html.includes('class="t-sep"'));

  const female = buildMedicalCertificateHtml({
    origin: ORIGIN,
    pageSize: PAGE_A5,
    doctor,
    patient: { ...patient, sex: "Female" },
    issueDate: "November 20, 2026",
    address: "Cebu City",
    examinedAt: "Grace Medical Clinic",
    examFrom: "November 18, 2026",
    examTo: "November 19, 2026",
    diagnosis: "Acute gastritis",
    recommendations: "Rest",
    purposeException: "",
    comeBackOn: "",
  });
  assert.match(female, /t-hit">Ms\./);
  assert.ok(!female.includes('t-hit">Mr.'));
  assert.ok(!female.includes('t-hit">Mrs.'));

  const evil = buildMedicalCertificateHtml({
    origin: ORIGIN,
    pageSize: PAGE_A5,
    doctor: { ...doctor, full_name: "<script>" },
    patient: { ...patient, full_name: "<script>alert(1)</script>" },
    issueDate: "",
    address: "<script>",
    examinedAt: "<script>",
    examFrom: "",
    examTo: "",
    diagnosis: "<script>",
    recommendations: "<script>",
    purposeException: "<script>",
    comeBackOn: "",
  });
  assert.ok(!evil.includes("<script>"));
  assert.ok(evil.includes("&lt;script&gt;"));
});

test("medical certificate: long purposeException wraps in-flow without overlapping boiler2", () => {
  const mcOpts = {
    origin: ORIGIN,
    pageSize: PAGE_A5,
    doctor,
    patient,
    issueDate: "November 20, 2026",
    address: "Cebu City",
    examinedAt: "Grace Medical Clinic",
    examFrom: "November 18, 2026",
    examTo: "November 19, 2026",
    diagnosis: "Acute gastritis",
    recommendations: "Rest",
    comeBackOn: "November 27, 2026",
  };
  const exception =
    "Issued for employment / return-to-work purposes and for submission to the employer's HR department as proof of medical consultation.";
  const escaped = exception
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const html = buildMedicalCertificateHtml({
    ...mcOpts,
    purposeException: exception,
  });

  assert.equal(html.split(escaped).length - 1, 1);
  const excIdx = html.indexOf(escaped);
  const boiler2Idx = html.indexOf("and may not be used for medico-legal purposes.");
  assert.ok(excIdx >= 0, "escaped exception text missing");
  assert.ok(boiler2Idx > excIdx, "medico-legal line must appear after the exception");

  const discStart = html.indexOf('<div class="mc-disc">');
  const backStart = html.indexOf('class="mc-back"', discStart);
  assert.ok(discStart >= 0, "disclaimer container missing");
  assert.ok(backStart > discStart, "come-back block should follow the disclaimer");
  const discBlock = html.slice(discStart, backStart);
  assert.ok(discBlock.includes('class="mc-purpose"'), "exception block should be inside the flow container");
  assert.ok(discBlock.includes(escaped), "exception text should be inside the flow container");
  assert.ok(
    discBlock.includes('class="mc-boiler2">and may not be used for medico-legal purposes.'),
    "second disclaimer line should be inside the flow container",
  );
  assert.ok(
    discBlock.indexOf(escaped) < discBlock.indexOf('class="mc-boiler2"'),
    "exception block must precede boiler2 inside the container",
  );
  assert.ok(
    !/\.mc-boiler2\s*\{[^}]*position:\s*absolute/.test(html),
    "mc-boiler2 must stay in flow (not position:absolute) when an exception exists",
  );
  assert.ok(
    !/\.mc-boiler2\s*\{[^}]*top:\s*6\.15in/.test(html),
    "mc-boiler2 must not use a fixed top while an exception exists",
  );

  const empty = buildMedicalCertificateHtml({
    ...mcOpts,
    purposeException: "",
  });
  assert.ok(!empty.includes('class="mc-purpose"'), "empty exception must not emit an exception block");
  assert.match(
    empty,
    /<div class="mc-disc"><div class="mc-boiler">This certificate is issued upon the request for whatever purpose it may serve except<\/div><div class="mc-boiler2">and may not be used for medico-legal purposes\.<\/div><\/div>/,
  );

  const blank = buildMedicalCertificateHtml({
    ...mcOpts,
    purposeException: "   ",
  });
  assert.ok(!blank.includes('class="mc-purpose"'), "whitespace-only exception must not emit an exception block");
});

test("prescription: A5 page size, table labels, 5 rows, fill, 6 meds, escape", () => {
  const html = buildPrescriptionHtml({
    origin: ORIGIN,
    pageSize: PAGE_A5,
    doctor,
    patient,
    age: "36",
    date: "November 20, 2026",
    items: [oneMed],
  });

  assert.match(html, /@page\s*\{[^}]*size:\s*148mm 210mm/);
  assertHeader(html);
  assert.ok(html.includes("Patient's Name:"));
  assert.ok(html.includes("Age:"));
  assert.ok(html.includes("Sex:"));
  assert.ok(html.includes("Address:"));
  assert.ok(html.includes("Date:"));
  assert.ok(html.includes("DURATION"));
  assert.ok(html.includes("INDICATION"));
  assert.ok(html.includes("BREAKFAST"));
  assert.ok(html.includes("LUNCH"));
  assert.ok(html.includes("DINNER"));
  assert.ok(html.includes("BEDTIME"));
  assert.ok(html.includes(" - "));
  assert.ok(html.includes("Sig."));
  assert.ok(html.includes("before/"));
  assert.ok(html.includes("after"));
  assert.match(html, /pill">BREAKFAST</);
  assert.match(html, /pill">DINNER</);
  assert.ok(!html.includes('pill">LUNCH'));
  assert.ok(!html.includes('pill">BEDTIME'));
  assert.match(html, /pill">after</);
  assert.ok(!html.includes('pill">before/'));
  assert.ok(!html.includes("circ-bf"));
  assert.ok(!html.includes("hit-mr"));
  assert.ok(html.includes("Maintain"));
  assert.ok(html.includes("Days"));
  assert.ok(html.includes("Weeks"));
  assert.ok(html.includes("Next appointment:"));
  assert.ok(html.includes("License No:"));
  assert.ok(html.includes("PTR No:"));
  assert.ok(html.includes("S2 No:"));
  assert.ok(html.includes("#"));
  assert.ok(html.includes("Paracetamol"));
  assert.ok(html.includes("500 mg"));
  assert.ok(html.includes("20 tablets"));
  assert.ok(html.includes("Juan Dela Cruz"));
  assert.ok(html.includes("Buaya, Lapu Lapu City"));
  assert.ok(html.includes("LIC-99"));
  assert.ok(html.includes("PTR-88"));
  assert.ok(html.includes(`${ORIGIN}/forms/rx.png`));
  assert.equal(countClass(html, "rx-row"), 5);
  assert.match(html, /--pad-l:\s*0\.35in/);
  assert.match(html, /--pad-r:\s*0\.65in/);
  assert.match(html, /width:\s*4\.67in/);
  assert.match(html, /width:\s*2\.73in/);
  assert.match(html, /width:\s*1\.0in/);
  assert.match(html, /width:\s*0\.94in/);
  assert.match(html, /height:\s*0\.575in/);
  assert.match(html, /height:\s*0\.33in/);
  assert.match(html, /left:\s*0\.43in/);
  assert.match(html, /top:\s*1\.58in/);
  assert.match(html, /top:\s*1\.77in/);
  assert.match(html, /top:\s*1\.98in/);
  assert.match(html, /top:\s*2\.87in/);
  assert.match(html, /left:\s*66%/);
  assert.match(html, /left:\s*77%/);
  assert.match(html, /width:\s*0\.6in/);
  assert.match(html, /top:\s*2\.25in/);
  assert.match(html, /top:\s*7\.86in/);
  assert.match(html, /left:\s*0\.41in/);
  assert.match(html, /left:\s*55%/);
  assert.match(html, /font-size:\s*7\.5pt/);
  assert.match(html, /border-radius:\s*999px/);
  assert.equal((html.match(/<span class="slot/g) || []).length, 30);

  const six = [];
  for (let i = 1; i <= 6; i++) {
    six.push({
      generic_name: `Med${i}`,
      dosage: "1 tab",
      quantity: String(i),
    });
  }
  const html6 = buildPrescriptionHtml({
    origin: ORIGIN,
    pageSize: PAGE_A5,
    doctor,
    patient,
    age: "36",
    date: "November 20, 2026",
    items: six,
  });
  assert.equal(countClass(html6, "rx-row"), 6);
  assert.ok(html6.includes("Med6"));

  const evil = buildPrescriptionHtml({
    origin: ORIGIN,
    pageSize: PAGE_A5,
    doctor: { ...doctor, full_name: "<script>", s2_number: null },
    patient: { ...patient, full_name: "<script>", address: "<script>" },
    age: "<script>",
    date: "<script>",
    items: [
      {
        generic_name: "<script>",
        dosage: "<script>",
        quantity: "<script>",
        instruction: "<script>",
        indication: "<script>",
      },
    ],
  });
  assert.ok(!evil.includes("<script>"));
  assert.ok(evil.includes("&lt;script&gt;"));
  assert.ok(!evil.includes("S2 No:"));
});

test("prescription: sig route dedupe and long-sig wrap layout", () => {
  function rx(items) {
    return buildPrescriptionHtml({
      origin: ORIGIN,
      pageSize: PAGE_A5,
      doctor,
      patient,
      age: "36",
      date: "November 20, 2026",
      items,
    });
  }

  const loperamideInstruction =
    "PO 2 mg after each loose stool; max 8 mg/day x 2 days (avoid if bloody stool/fever)";
  const html = rx([
    {
      generic_name: "Loperamide",
      dosage: "2 mg",
      quantity: "8 caps",
      instruction: loperamideInstruction,
      route: "PO",
      timing: "Breakfast",
      meal_relation: "After",
      duration_kind: "Days",
      duration_value: 2,
      indication: "diarrhea",
    },
  ]);

  const sigMatch = html.match(/<div class="rx-sig">([\s\S]*?)<\/div>/);
  assert.ok(sigMatch, "rx-sig block missing");
  const sigBlock = sigMatch[1];
  assert.ok(!sigBlock.includes("PO PO"), "duplicate route must not appear in sig text");
  assert.equal(sigBlock.split("PO 2 mg after each loose stool").length - 1, 1);
  assert.match(
    sigBlock,
    /Sig\.<\/span><span class="sig-free sig-long">/,
    "long sig text must sit in .sig-free.sig-long after the Sig. label",
  );
  const labelIdx = sigBlock.indexOf("Sig.");
  const freeIdx = sigBlock.indexOf('class="sig-free');
  const mealIdx = sigBlock.indexOf('class="meal"');
  assert.ok(labelIdx >= 0 && labelIdx < freeIdx, "sig text must follow the Sig. label");
  assert.ok(freeIdx < mealIdx, "sig text must come before the .meal element");
  assert.ok(sigBlock.includes(loperamideInstruction));

  assert.match(html, /\.rx-sig\s*\{[^}]*align-items:\s*flex-start/);
  assert.match(html, /\.sig-free\s*\{[^}]*flex:\s*1 1 auto/);
  assert.match(html, /\.sig-free\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(html, /\.sig-long\s*\{[^}]*font-size:\s*6\.2pt/);
  const tdRule = html.match(/\.rx-row td\s*\{[^}]*\}/);
  assert.ok(tdRule, "rx-row td rule missing");
  assert.match(tdRule[0], /min-height:\s*0\.575in/);
  assert.ok(
    !/(?:^|[^-\w])height:\s*0\.575in/.test(tdRule[0]),
    "rx-row td must use min-height, not a fixed height",
  );

  const comma = rx([
    {
      generic_name: "Loperamide",
      dosage: "2 mg",
      quantity: "8",
      route: "PO",
      instruction: "po, 2 mg after meals",
    },
  ]);
  const commaSig = comma.match(/<span class="sig-free[^"]*">([^<]*)<\/span>/);
  assert.ok(commaSig, "comma-route sig-free missing");
  assert.equal(commaSig[1], "po, 2 mg after meals");

  const oral = rx([
    {
      generic_name: "Paracetamol",
      dosage: "500 mg",
      quantity: "10",
      route: "Oral",
      instruction: "Take 1 tab",
    },
  ]);
  const oralSig = oral.match(/<span class="sig-free[^"]*">([^<]*)<\/span>/);
  assert.ok(oralSig, "non-duplicate sig-free missing");
  assert.equal(oralSig[1], "Oral Take 1 tab");
  assert.ok(!oralSig[0].includes("sig-long"), "short sig must keep the 7pt class");

  const dupWord = rx([
    {
      generic_name: "Loperamide",
      dosage: "2 mg",
      quantity: "8",
      route: "PO",
      instruction: "PO PO 2 mg after each loose stool",
    },
  ]);
  const dupSig = dupWord.match(/<span class="sig-free[^"]*">([^<]*)<\/span>/);
  assert.ok(dupSig, "collapsed-repeat sig-free missing");
  assert.equal(dupSig[1], "PO 2 mg after each loose stool");
  assert.ok(!dupSig[1].includes("PO PO"));
});

test("lab request: custom page size, fixed checklist order, ticks, extras, escape", () => {
  const html = buildLabRequestHtml({
    origin: ORIGIN,
    pageSize: PAGE_LAB,
    doctor,
    patient,
    age: "36",
    date: "November 20, 2026",
    tests: ["cbc", "Creatinine", "TSH", "dengue duo", "ECG"],
    diagnoses: ["Viral illness"],
    clinicalNotes: "follow up",
  });

  assert.match(html, /@page\s*\{[^}]*size:\s*4\.3in 6\.4in/);
  assertHeader(html);
  assert.ok(html.includes("Patient Name:"));
  assert.ok(html.includes("Date:"));
  assert.ok(html.includes("Address:"));
  assert.ok(html.includes("Age:"));
  assert.ok(html.includes("Sex:"));
  assert.ok(html.includes("LIC No:"));
  assert.ok(html.includes("PTR No:"));
  assert.ok(html.includes("Juan Dela Cruz"));
  assert.ok(html.includes("LIC-99"));
  assert.ok(html.includes("PTR-88"));
  assert.ok(html.includes(`${ORIGIN}/forms/cartoon.png`));
  assert.ok(html.includes("Dx:"));
  assert.ok(html.includes("Viral illness"));

  const names = [
    "CBC",
    "URINALYSIS",
    "LIPID PROFILE",
    "SGPT",
    "CREA",
    "FBS",
    "BUA",
    "DENGUE NS1, IgG, IgM",
    "ECG 12L",
  ];
  let prev = -1;
  for (const name of names) {
    const idx = html.indexOf(name);
    assert.ok(idx > prev, `lab item out of order: ${name}`);
    prev = idx;
  }

  const cbcBlock = html.slice(html.indexOf("CBC") - 80, html.indexOf("CBC") + 8);
  assert.ok(cbcBlock.includes("✓"), "CBC should be ticked");
  const creaBlock = html.slice(html.indexOf("CREA") - 80, html.indexOf("CREA") + 8);
  assert.ok(creaBlock.includes("✓"), "CREA should be ticked for creatinine");
  const denBlock = html.slice(
    html.indexOf("DENGUE NS1, IgG, IgM") - 80,
    html.indexOf("DENGUE NS1, IgG, IgM") + 12,
  );
  assert.ok(denBlock.includes("✓"), "dengue should tick DENGUE NS1, IgG, IgM");
  const ecgBlock = html.slice(html.indexOf("ECG 12L") - 80, html.indexOf("ECG 12L") + 10);
  assert.ok(ecgBlock.includes("✓"), "ecg should tick ECG 12L");

  assert.match(html, /class="lab-extras"[^>]*>[\s\S]*TSH/);
  assert.match(html, /Bradley Hand/);
  assert.match(html, /rotate\(-20deg\)/);
  assert.match(html, /font-size:\s*11pt/);
  assert.match(html, /line-height:\s*0\.3in/);
  assert.match(html, /--pad-l:\s*0\.27in/);
  assert.match(html, /--pad-r:\s*0\.6in/);
  assert.match(html, /left:\s*1\.07in/);
  assert.match(html, /line-height:\s*0\.185in/);
  assert.match(html, /top:\s*2\.94in/);
  assert.match(html, /top:\s*5\.15in/);
  assert.match(html, /top:\s*1\.15in/);
  assert.match(html, /top:\s*1\.38in/);
  assert.match(html, /top:\s*1\.53in/);
  assert.match(html, /top:\s*0\.38in/);
  assert.match(html, /top:\s*1\.9in/);
  assert.match(html, /width:\s*0\.38in/);
  assert.match(html, /width:\s*0\.42in/);
  assert.match(html, /width:\s*0\.55in/);
  assert.match(html, /width:\s*3\.43in/);
  assert.match(html, /height:\s*1\.3in/);
  assert.match(html, /left:\s*2\.5in/);
  assert.match(html, /top:\s*2\.5in/);
  assert.match(html, /left:\s*0\.28in/);
  assert.match(html, /left:\s*3\.46in/);
  assert.match(html, /left:\s*2\.04in/);
  assert.match(html, /left:\s*0\.76in/);
  assert.match(html, /left:\s*2\.2in/);
  assert.match(html, /left:\s*3\.4in/);
  assert.match(html, /left:\s*1\.95in/);
  assert.match(html, /font-size:\s*8\.8pt/);
  assert.match(html, /font-size:\s*5\.6pt/);
  assert.match(html, /font-size:\s*4\.6pt/);
  assert.match(html, /font-size:\s*6pt/);
  assert.match(html, /class="lab-extra"/);
  assert.ok(html.includes('class="lab-md">MD'));

  const emptyDx = buildLabRequestHtml({
    origin: ORIGIN,
    pageSize: PAGE_LAB,
    doctor,
    patient,
    age: "36",
    date: "November 20, 2026",
    tests: ["urine"],
  });
  assert.ok(!emptyDx.includes("Dx:"));
  const uriBlock = emptyDx.slice(emptyDx.indexOf("URINALYSIS") - 80, emptyDx.indexOf("URINALYSIS") + 12);
  assert.ok(uriBlock.includes("✓"));

  const evil = buildLabRequestHtml({
    origin: ORIGIN,
    pageSize: PAGE_LAB,
    doctor: { ...doctor, full_name: "<script>" },
    patient: { ...patient, full_name: "<script>", address: "<script>" },
    age: "<script>",
    date: "<script>",
    tests: ["<script>", "TSH"],
    diagnoses: ["<script>"],
    clinicalNotes: "<script>",
  });
  assert.ok(!evil.includes("<script>"));
  assert.ok(evil.includes("&lt;script&gt;"));
});
