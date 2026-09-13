# SHUR-SHUR — лендинг агентства

Двуязычный (uk / en) лендинг SMM-агентства SHUR-SHUR на Next.js 16.

- Репозиторий: https://github.com/minyaylo007/shur-shur-landing
- Прод: Vercel (проект `shur-shur`)
- Разработка, CI/CD, откат, работа агентов и экономия токенов: **[docs/OPERATIONS.md](docs/OPERATIONS.md)**

## Быстрый старт

```bash
npm ci
cp .env.example .env.local   # заполнить значения
npm run dev                  # http://localhost:3000 → /uk
```

Проверки перед push: `npm run lint && npm test && npm run build`.
