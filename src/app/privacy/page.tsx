// JJQR - AI (Nov 20, 2026) - PV-11: in-app copy of the privacy notice. The link people without an account use is /api/public/privacy-notice (see Needs Jessie in docs/FINISH-CHECKLIST.md).
import Link from "next/link";
import { NOTICE, noticeLang } from "@/lib/privacy-notice";

export const metadata = { title: "Privacy Notice — Dr. Grace Gavino Medical Clinic" };

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = noticeLang((await searchParams).lang);
  const t = NOTICE[lang];
  const other = lang === "en" ? "fil" : "en";
  return (
    <main lang={lang === "fil" ? "fil" : "en"} className="mx-auto max-w-copy space-y-md px-md py-lg text-body-md text-on-surface">
      <p><Link href={`/privacy?lang=${other}`} className="underline">{t.switchLabel}</Link></p>
      <h1 className="text-headline-lg">{t.title}</h1>
      <p className="rounded-lg bg-surface-container-low p-sm text-label-md">{t.draftNote}</p>
      <p className="text-label-md text-on-surface-variant">{t.updated}</p>
      <p>{t.intro}</p>
      {t.sections.map((s) => (
        <section key={s.heading} className="space-y-xs">
          <h2 className="text-headline-sm">{s.heading}</h2>
          {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
          {s.bullets && <ul className="list-disc space-y-xs pl-lg">{s.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
        </section>
      ))}
    </main>
  );
}
