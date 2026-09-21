/** Post-login/register redirect target. Only same-site patient-portal paths are honored, so a
 *  crafted `?next=` can never bounce someone to another site or into another role's area. */
export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/patient") || value.startsWith("//") || value.includes("\\") || value.includes("..")) return null;
  return value;
}
