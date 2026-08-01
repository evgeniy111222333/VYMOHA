export type AccountRole = "user" | "admin";
export type AccountStatus = "active" | "suspended";

export function isAccountRole(value: unknown): value is AccountRole {
  return value === "user" || value === "admin";
}

export function isAccountStatus(value: unknown): value is AccountStatus {
  return value === "active" || value === "suspended";
}
