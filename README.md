# Вимога

Вимога — український micro-SaaS для попередньої перевірки закупівель Prozorro. Сервіс перетворює номер тендера на доказовий go/no-go звіт, зберігає журнал рішень, приватні документи компанії та відстежує нові редакції закупівель.

## Що реалізовано

- публічний аналіз активних закупівель через офіційний API Prozorro;
- детермінована оцінка строків, статусу, гарантії, критеріїв і документів;
- опціональний поглиблений PDF-аналіз через OpenAI Responses API;
- приватний кабінет із Sign in with ChatGPT;
- профіль компанії, CPV-напрями, сертифікати й можливості;
- журнал аналізів та аналітика go / maybe / no-go;
- R2-бібліотека файлів із перевіркою MIME і сигнатур, завантаженням та видаленням;
- моніторинг редакцій закупівель і email-адаптер через Resend;
- SEO-сторінки, база знань, sitemap, robots, Open Graph та web manifest;
- D1 rate limiting, audit log, CSP, same-origin захист і приватне кешування.

## Стек

- TypeScript, React 19, Next.js 16 API, vinext/Vite;
- Cloudflare Workers, D1, R2;
- Drizzle ORM і SQL-міграції;
- Zod, Lucide, Vitest, ESLint.

## Локальний запуск

Потрібен Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Сайт відкриється на `http://localhost:3000`. Локальні D1 та R2 емулюються Cloudflare Vite plugin.

Скопіюйте `.env.example` у `.env.local` лише якщо потрібні зовнішні інтеграції. Базовий аналіз Prozorro працює без ключів.

## Змінні середовища

| Змінна | Призначення |
| --- | --- |
| `OPENAI_API_KEY` | Поглиблений аналіз PDF; без ключа використовується структурований режим |
| `OPENAI_MODEL` | Модель Responses API, за замовчуванням `gpt-5.6-terra` |
| `RESEND_API_KEY` | Email-повідомлення моніторингу |
| `NOTIFICATION_FROM` | Підтверджений відправник email |
| `APP_BASE_URL` | Канонічна адреса середовища |

Секрети не зберігаються в репозиторії. У production їх потрібно задати як Worker secrets.

## Перевірки

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
node --test tests/rendered-html.test.mjs
npm audit --audit-level=moderate
```

Модульні тести охоплюють scoring, парсинг Prozorro, request/file security та цикл моніторингу. SSR smoke-тести запускають реальне Worker preview і перевіряють сторінки та security headers.

## Структура

```text
app/                 маршрути, сторінки й API handlers
components/          brand, marketing, analyzer, dashboard
db/                  Drizzle schema і runtime ініціалізація D1
src/domain/          чиста тендерна бізнес-логіка
src/infrastructure/  Prozorro, OpenAI, R2/D1, email
src/services/        прикладні фонові процеси
tests/               unit і rendered smoke tests
worker/              Cloudflare entrypoint та security headers
.openai/drizzle/     production SQL-міграції
```

Фоновий monitoring handler закладений у Worker і локально налаштований на запуск кожні 15 хвилин. Під час зовнішнього деплою cron trigger потрібно підтвердити в налаштуваннях Cloudflare.
