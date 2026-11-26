import test from "node:test";
import assert from "node:assert/strict";
import {
  LAB_DEFAULT_ITEMS,
  normalizeLabItems,
  buildLabRequestHtml,
  buildMedicalCertificateHtml,
  buildPrescriptionHtml,
} from "./print-forms-html.ts";

const ORIGIN = "http://forms.test";
const PAGE_A5 = "148mm 210mm";
const PAGE_LAB = "148mm 210mm"; // the lab request is the same A5 sheet as the prescription and the medical certificate

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
  assert.ok(html.includes("LIC-99"), "the license number the doctor filled in prints");
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

test("prescription: A5 page size, table labels, 1 row, fill, 6 meds, escape", () => {
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
  //JJQR - AI (Nov 20, 2026)
  assert.match(html, /slot faint">LUNCH</);
  assert.match(html, /slot faint">BEDTIME</);
  assert.match(html, /slot faint">before\//);
  //JJQR - END
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
  assert.ok(html.includes("LIC-99"), "the license number the doctor filled in prints");
  assert.ok(html.includes("PTR-88"));
  assert.ok(html.includes(`${ORIGIN}/forms/rx.png`));
  assert.equal(countClass(html, "rx-row"), 1);
  assert.match(html, /--pad-l:\s*0\.35in/);
  assert.match(html, /--pad-r:\s*0\.65in/);
  assert.match(html, /width:\s*4\.75in/); //JJQR - AI (2026-11-26) - GAV-14 table widened to the header right edge (was 4.67in) //JJQR - END
  assert.match(html, /width:\s*2\.88in/); //JJQR - AI (2026-11-26) - GAV-14 columns 2.88 / 0.95 / 0.92in (were 2.73 / 1.0 / 0.94in) //JJQR - END
  assert.match(html, /width:\s*0\.95in/);
  assert.match(html, /width:\s*0\.92in/);
  assert.match(html, /height:\s*0\.6in/); //JJQR - AI (2026-11-26) - GAV-14 row min-height (was 0.575in) //JJQR - END
  assert.match(html, /height:\s*0\.28in/); //JJQR - AI (2026-11-26) - GAV-14 table header row (was 0.33in) //JJQR - END
  assert.match(html, /left:\s*0\.43in/);
  assert.match(html, /top:\s*1\.58in/);
  assert.match(html, /top:\s*1\.77in/);
  assert.match(html, /top:\s*1\.98in/);
  assert.match(html, /top:\s*2\.58in/); //JJQR - AI (2026-11-26) - GAV-14 table starts beside the Rx (was 2.87in) //JJQR - END
  assert.match(html, /left:\s*66%/);
  assert.match(html, /left:\s*77%/);
  assert.match(html, /width:\s*0\.6in/);
  assert.match(html, /top:\s*2\.25in/);
  assert.match(html, /top:\s*7\.86in/);
  assert.match(html, /left:\s*0\.41in/);
  assert.match(html, /left:\s*55%/);
  assert.match(html, /font-size:\s*7\.5pt/);
  assert.match(html, /border-radius:\s*999px/);
  assert.equal((html.match(/<span class="slot/g) || []).length, 6);

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
  assert.match(html, /\.sig-long\s*\{[^}]*font-size:\s*8pt/); //JJQR - AI (2026-11-26) - GAV-14 bigger print (was 6.2pt) //JJQR - END
  const tdRule = html.match(/\.rx-row td\s*\{[^}]*\}/);
  assert.ok(tdRule, "rx-row td rule missing");
  assert.match(tdRule[0], /min-height:\s*0\.6in/); //JJQR - AI (2026-11-26) - GAV-14 bigger print (was 0.575in) //JJQR - END
  assert.ok(
    !/(?:^|[^-\w])height:\s*0\.6in/.test(tdRule[0]),
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

//JJQR - AI (Nov 20, 2026)
test("prescription: intelligent sig marks, as needed/directed notes, no padded rows", () => {
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

  function rowByName(html, name) {
    const nameIdx = html.indexOf(`class="rx-med-name">${name}<`);
    assert.ok(nameIdx >= 0, `missing med name: ${name}`);
    const rowStart = html.lastIndexOf('<tr class="rx-row">', nameIdx);
    const rowEnd = html.indexOf("</tr>", nameIdx);
    assert.ok(rowStart >= 0 && rowEnd > rowStart, `row bounds missing for ${name}`);
    return html.slice(rowStart, rowEnd);
  }

  const html = rx([
    {
      generic_name: "LOPERAMIDE 2MG CAP",
      dosage: "2 mg cap",
      quantity: "8",
      instruction: "PO 2 mg after each loose stool; max 8 mg/day x 2 days (avoid if bloody stool/fever)",
      route: "PO",
    },
    {
      generic_name: "ASCORBIC ACID + MULTIVITAMINS 500MG TAB",
      dosage: "500 mg tab",
      quantity: "30",
      instruction: "PO 1 tab once daily x 30 days",
      route: "PO",
    },
    {
      generic_name: "ORAL REHYDRATION SALTS",
      dosage: "",
      quantity: "4",
      instruction: "dissolve in 1 L clean water; sip frequently x 2-3 days",
    },
    {
      generic_name: "AMLODIPINE 5MG TAB",
      dosage: "5 mg tab",
      quantity: "30",
      instruction: "once daily ongoing; take same time each day",
    },
  ]);

  assert.equal(countClass(html, "rx-row"), 4);
  assert.ok(!html.includes('class="rx-med-name"></div>'), "no empty 5th name cell");

  const loperamide = rowByName(html, "LOPERAMIDE 2MG CAP");
  assert.ok(loperamide.includes('class="slot-note">as needed</span>'));
  assert.ok(!loperamide.includes("pill"), "loperamide slots/meals must not be pilled");
  assert.ok(!loperamide.includes("BREAKFAST"));
  const loperamideName = loperamide.match(/<div class="rx-med-name">([^<]*)<\/div>/);
  assert.ok(loperamideName);
  assert.equal(loperamideName[1], "LOPERAMIDE 2MG CAP");
  assert.equal(loperamideName[1].split("2MG CAP").length - 1, 1);
  assert.ok(!loperamideName[1].includes("2 mg cap"));

  const ascorbic = rowByName(html, "ASCORBIC ACID + MULTIVITAMINS 500MG TAB");
  assert.match(ascorbic, /pill">BREAKFAST</);
  assert.ok(!ascorbic.includes('pill">LUNCH'));
  assert.ok(!ascorbic.includes('pill">DINNER'));
  assert.ok(!ascorbic.includes('pill">BEDTIME'));
  assert.match(ascorbic, /slot faint">LUNCH</);

  const ors = rowByName(html, "ORAL REHYDRATION SALTS");
  assert.ok(ors.includes('class="slot-note">as directed</span>'));
  assert.ok(!ors.includes("BREAKFAST"));

  const amlo = rowByName(html, "AMLODIPINE 5MG TAB");
  assert.match(amlo, /pill">BREAKFAST</);
  assert.ok(!amlo.includes('pill">LUNCH'));

  const afterMeals = rx([
    {
      generic_name: "Med After",
      dosage: "1 tab",
      quantity: "10",
      instruction: "1 tab after meals",
    },
  ]);
  const afterRow = rowByName(afterMeals, "Med After 1 tab");
  assert.match(afterRow, /pill">after</);
  assert.match(afterRow, /slot faint">before\//);
  assert.match(afterRow, /pill">BREAKFAST</);

  const beforeMeals = rx([
    {
      generic_name: "Med Before",
      dosage: "1 tab",
      quantity: "10",
      instruction: "1 tab before meals",
    },
  ]);
  const beforeRow = rowByName(beforeMeals, "Med Before 1 tab");
  assert.match(beforeRow, /pill">before\//);
  assert.match(beforeRow, /slot faint">after</);

  const unknown = rx([
    {
      generic_name: "Med Unknown",
      dosage: "1 tab",
      quantity: "10",
    },
  ]);
  const unknownRow = rowByName(unknown, "Med Unknown 1 tab");
  assert.ok(!unknownRow.includes("faint"));
  assert.ok(!unknownRow.includes("pill"));
  assert.ok(unknownRow.includes('class="slot">BREAKFAST</span>'));
  assert.ok(unknownRow.includes('class="slot">before/</span>'));
  assert.ok(unknownRow.includes('class="slot">after</span>'));

  const empty = rx([]);
  assert.equal(countClass(empty, "rx-row"), 0);
  assert.ok(empty.includes("Patient's Name:"));
  assert.ok(empty.includes("DURATION"));
});

test("prescription: saved structured fields win over sig; as_needed notes; legacy still parsed", () => {
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

  function rowByName(html, name) {
    const nameIdx = html.indexOf(`class="rx-med-name">${name}<`);
    assert.ok(nameIdx >= 0, `missing med name: ${name}`);
    const rowStart = html.lastIndexOf('<tr class="rx-row">', nameIdx);
    const rowEnd = html.indexOf("</tr>", nameIdx);
    assert.ok(rowStart >= 0 && rowEnd > rowStart, `row bounds missing for ${name}`);
    return html.slice(rowStart, rowEnd);
  }

  const savedWins = rx([
    {
      generic_name: "Saved Wins",
      dosage: "1 tab",
      quantity: "10",
      instruction: "TID after meals PRN",
      meal_relation: "Before",
      timing: "Bedtime",
      as_needed: false,
    },
  ]);
  const savedRow = rowByName(savedWins, "Saved Wins 1 tab");
  assert.match(savedRow, /pill">before\//);
  assert.match(savedRow, /slot faint">after</);
  assert.match(savedRow, /pill">BEDTIME</);
  assert.ok(!savedRow.includes('pill">BREAKFAST'));
  assert.ok(!savedRow.includes('pill">LUNCH'));
  assert.ok(!savedRow.includes('pill">DINNER'));
  assert.ok(!savedRow.includes("as needed"));
  assert.ok(!savedRow.includes("as directed"));

  const prnNoSlots = rx([
    {
      generic_name: "PRN Saved",
      dosage: "2 mg",
      quantity: "8",
      instruction: "once daily after meals",
      as_needed: true,
    },
  ]);
  const prnRow = rowByName(prnNoSlots, "PRN Saved 2 mg");
  assert.ok(prnRow.includes('class="slot-note">as needed</span>'));
  assert.ok(!prnRow.includes("BREAKFAST"));
  assert.ok(!prnRow.includes("as directed"));

  const explicitOff = rx([
    {
      generic_name: "Plain Saved",
      dosage: "1 tab",
      quantity: "4",
      instruction: "dissolve in 1 L clean water; sip frequently x 2-3 days",
      as_needed: false,
    },
  ]);
  const plainRow = rowByName(explicitOff, "Plain Saved 1 tab");
  assert.ok(!plainRow.includes("as directed"));
  assert.ok(!plainRow.includes("as needed"));
  assert.ok(!plainRow.includes("pill"));
  assert.ok(!plainRow.includes("faint"));
  assert.ok(plainRow.includes('class="slot">BREAKFAST</span>'));
  assert.ok(plainRow.includes('class="slot">before/</span>'));

  const legacy = rx([
    {
      generic_name: "Legacy ORS",
      dosage: "",
      quantity: "4",
      instruction: "dissolve in 1 L clean water; sip frequently x 2-3 days",
    },
  ]);
  const legacyRow = rowByName(legacy, "Legacy ORS");
  assert.ok(legacyRow.includes('class="slot-note">as directed</span>'));
});
//JJQR - END

test("lab request: A5 page size, the clinic's tests in order, ticks, others, blank license, escape", () => {
  const html = buildLabRequestHtml({
    origin: ORIGIN,
    pageSize: PAGE_LAB,
    doctor,
    patient,
    age: "36",
    date: "November 20, 2026",
    tests: ["cbc", "Creatinine", "TSH", "free T4", "HbA1c", "dengue duo", "ECG", "Vitamin D"],
    diagnoses: ["Viral illness"],
    clinicalNotes: "follow up",
  });

  assert.match(html, /@page\s*\{[^}]*size:\s*148mm 210mm/);
  assertHeader(html);
  assert.ok(html.includes("Patient's Name:"));
  assert.ok(html.includes("Date:"));
  assert.ok(html.includes("Address:"));
  assert.ok(html.includes("Age:"));
  assert.ok(html.includes("Sex:"));
  assert.ok(html.includes("License No:"));
  assert.ok(html.includes("PTR No:"));
  assert.ok(html.includes("LIC-99"), "the license number the doctor filled in prints");
  assert.ok(html.includes("PTR-88"));
  assert.ok(html.includes("Juan Dela Cruz"));
  assert.ok(html.includes(`${ORIGIN}/forms/cartoon.png`));
  assert.ok(html.includes("Dx:"));
  assert.ok(html.includes("Viral illness"));

  // the clinic's lab only does these tests, in this order
  const names = [
    "CBC", "URINALYSIS", "LIPID PROFILE", "SGPT", "CREA", "FBS", "BUA",
    "TSH", "FT3", "FT4", "HbA1c", "DENGUE NS1, IgG, IgM", "ECG 12L",
  ];
  let prev = -1;
  for (const name of names) {
    const idx = html.indexOf('<span class="lab-name">' + name + "</span>");
    assert.ok(idx > prev, `lab item out of order: ${name}`);
    prev = idx;
  }
  const ticked = (name) => {
    const at = html.indexOf('<span class="lab-name">' + name + "</span>");
    return html.slice(html.lastIndexOf('<div class="lab-item', at), at).includes("✓");
  };
  for (const name of ["CBC", "CREA", "TSH", "FT4", "HbA1c", "DENGUE NS1, IgG, IgM", "ECG 12L"]) assert.ok(ticked(name), `${name} should be ticked`);
  for (const name of ["URINALYSIS", "LIPID PROFILE", "SGPT", "FBS", "BUA", "FT3"]) assert.ok(!ticked(name), `${name} should not be ticked`);

  // anything the lab does not list goes under "Others:"
  assert.match(html, /class="lab-others"[^>]*>[\s\S]*Vitamin D/);
  assert.match(html, /class="lab-extra"/);
  // same sheet and same signature block as the prescription
  assert.match(html, /\.form-lab \{\s*width: 148mm;\s*height: 210mm;/);
  assert.match(html, /class="rx-sig-block"/);
  assert.match(html, /class="rule-double"/);
  assert.ok(!html.includes("4.3in"));

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
  const uriAt = emptyDx.indexOf('<span class="lab-name">URINALYSIS</span>');
  assert.ok(emptyDx.slice(emptyDx.lastIndexOf('<div class="lab-item', uriAt), uriAt).includes("✓"));

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

test("lab request: the Admin's own list replaces the default, which is the printed pad list", () => {
  const base = { origin: ORIGIN, pageSize: PAGE_LAB, doctor, patient, age: "36", date: "November 20, 2026" };
  // default = what is on the paper
  assert.deepEqual(normalizeLabItems(undefined), LAB_DEFAULT_ITEMS);
  assert.deepEqual(normalizeLabItems([]), LAB_DEFAULT_ITEMS);
  assert.deepEqual(normalizeLabItems(["  ", ""]), LAB_DEFAULT_ITEMS);
  assert.equal(buildLabRequestHtml({ ...base, tests: ["cbc"] }), buildLabRequestHtml({ ...base, tests: ["cbc"], items: LAB_DEFAULT_ITEMS }));

  // add and remove: trimmed, no blanks, no repeats (any case), kept in the Admin's order
  assert.deepEqual(normalizeLabItems(["CBC", " cbc ", "Vitamin D", "", "Ferritin"]), ["CBC", "Vitamin D", "Ferritin"]);
  const html = buildLabRequestHtml({ ...base, tests: ["Vitamin D 25-OH", "cbc with platelets", "TSH"], items: ["CBC", "Vitamin D", "Ferritin"] });
  const at = (name) => html.indexOf('<span class="lab-name">' + name + "</span>");
  assert.ok(at("CBC") > 0 && at("Vitamin D") > at("CBC") && at("Ferritin") > at("Vitamin D"));
  assert.ok(at("TSH") < 0, "a test removed from the list is no longer on the form");
  const ticked = (name) => html.slice(html.lastIndexOf('<div class="lab-item', at(name)), at(name)).includes("✓");
  assert.ok(ticked("CBC") && ticked("Vitamin D") && !ticked("Ferritin"));
  assert.match(html, /class="lab-others"[^>]*>[\s\S]*TSH/, "an ordered test that is not on the list goes under Others");

  // names are escaped, and a long list is squeezed to fit (26 at most)
  assert.ok(!buildLabRequestHtml({ ...base, tests: [], items: ["<script>"] }).includes("<script>"));
  const many = Array.from({ length: 40 }, (_, i) => "Test " + (i + 1));
  assert.equal(normalizeLabItems(many).length, 26);
  const big = buildLabRequestHtml({ ...base, tests: [], items: many });
  assert.equal((big.match(/class="lab-item /g) ?? []).length, 26);
  assert.ok(big.includes("top:2.95in") && big.includes("top:5.35in"), "first and last rows stay in the list area");
});

test("license and PTR numbers print when the doctor filled them in and stay blank when empty (all three forms)", () => {
  const base = { origin: ORIGIN, pageSize: PAGE_A5, patient, age: "36", date: "November 20, 2026" };
  const filled = { ...doctor, license_number: "0125232", ptr_number: "7788" };
  const empty = { ...doctor, license_number: null, ptr_number: "" };
  const forms = (d) => [
    buildPrescriptionHtml({ ...base, doctor: d, items: [{ generic_name: "Paracetamol", dosage: "500 mg", quantity: "10" }] }),
    buildMedicalCertificateHtml({ ...base, doctor: d, issueDate: "November 20, 2026", address: "Cebu", examinedAt: "Clinic", examFrom: "", examTo: "", diagnosis: "x", recommendations: "y", purposeException: "", comeBackOn: "" }),
    buildLabRequestHtml({ ...base, doctor: d, tests: ["cbc"] }),
  ];
  for (const html of forms(filled)) {
    assert.ok(html.includes("0125232") && html.includes("7788"), "both numbers print");
    assert.match(html, /License No:<\/span><span class="u sig-u">0125232</);
  }
  for (const html of forms(empty)) {
    assert.match(html, /License No:<\/span><span class="u sig-u"><\/span>/, "an empty license stays a blank line to write on");
    assert.match(html, /PTR No:<\/span><span class="u sig-u"><\/span>/);
  }
});

//JJQR - AI (2026-11-26) - GAV-14 doctor: bigger, more readable prescription on the same A5 pad; up to six ordinary lines on one page, more flow to a 2nd page at the same size
test("GAV-14: prescription size tiers and one-page fit", () => {
  const line = (n, ins = "1 TAB ONCE A DAY") => ({ generic_name: "MED" + n, dosage: "500MG", quantity: "10", instruction: ins, route: "PO", indication: "HPN" });
  const pad = (items) => buildPrescriptionHtml({ origin: ORIGIN, pageSize: PAGE_A5, doctor, patient, age: "36", date: "November 26, 2026", items });
  const cls = (html) => (html.match(/<div class="(form form-rx[^"]*)">/) || [])[1];
  assert.equal(cls(pad([line(1), line(2), line(3)])), "form form-rx rx-roomy");
  assert.equal(cls(pad([line(1), line(2), line(3), line(4)])), "form form-rx rx-airy");
  assert.equal(cls(pad([1, 2, 3, 4, 5, 6].map((n) => line(n)))), "form form-rx");
  assert.equal(cls(pad([1, 2, 3, 4, 5, 6, 7].map((n) => line(n)))), "form form-rx form-tall");
  const long = "TAKE ONE TABLET EVERY 8 HOURS WITH FOOD FOR COUGH AND WHEEZING, CONTINUE UNTIL THE SYMPTOMS RESOLVE COMPLETELY PLEASE";
  assert.equal(cls(pad([1, 2, 3, 4, 5, 6].map((n) => line(n, long)))), "form form-rx form-tall", "six very long lines flow instead of running into the signature");
  const html = pad([line(1)]);
  assert.match(html, /\.rx-med-name\s*\{[^}]*font-size:\s*10\.5pt;\s*font-weight:\s*700/);
  assert.match(html, /\.rx-roomy \.rx-med-name, \.rx-roomy \.rx-qty \{ font-size: 13pt; \}/);
  assert.match(html, /\.dur-u\s*\{[^}]*font-size:\s*12pt;\s*font-weight:\s*700/);
  assert.match(html, /\.rx-roomy \.dur-u \{ font-size: 15pt;/);
  assert.match(html, /\.form-tall\.form-rx \{ display: flow-root; \}/);
});
//JJQR - END
