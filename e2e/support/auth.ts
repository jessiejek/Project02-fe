import { join } from "node:path";
import type { Role } from "./api";

export const AUTH_DIR = join(__dirname, "..", ".auth");
export const authFile = (role: Role) => join(AUTH_DIR, `${role}.json`);

export const EMAIL: Record<Role, string> = {
  admin: "admin@clinic.test",
  staff: "staff@clinic.test",
  doctor: "doctor@clinic.test",
  patient: "patient@clinic.test",
};

export const ROLES: Role[] = ["admin", "staff", "doctor", "patient"];
