declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    DOCUMENTS: R2Bucket;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    APP_BASE_URL?: string;
    RESEND_API_KEY?: string;
    NOTIFICATION_FROM?: string;
  }
}
