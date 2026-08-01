export type AuthProvider = "email" | "phone" | "google";

export type AuthUser = {
  userId: string;
  displayName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
};

export type SessionResult = {
  user: AuthUser;
  expiresAt: string;
};
