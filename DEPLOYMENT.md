# Deployment Notes

## Backend on Render

- Root directory: `backend`
- Build command: `pip install -r requirements.txt && python manage.py migrate`
- Start command: `gunicorn config.wsgi:application`

Set these Render environment variables:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
DJANGO_SECRET_KEY=generate-a-long-random-secret
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=your-render-service.onrender.com
DJANGO_CORS_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
DJANGO_CSRF_TRUSTED_ORIGINS=https://your-vercel-app.vercel.app
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True
DJANGO_SESSION_COOKIE_SAMESITE=None
DJANGO_CSRF_COOKIE_SAMESITE=None
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SECURE_PROXY_SSL_HEADER=True
DJANGO_SECURE_HSTS_SECONDS=31536000
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=True
DJANGO_SECURE_HSTS_PRELOAD=True
DJANGO_DATABASE_SSL_REQUIRE=True
CHATBOT_REQUIRE_API_TOKEN=True
CHATBOT_API_TOKEN=generate-a-long-random-token
CHATBOT_RATE_LIMIT_REQUESTS=30
CHATBOT_RATE_LIMIT_WINDOW_SECONDS=60
CHATBOT_TRUST_X_FORWARDED_FOR=True
```

Keep `GEMINI_API_KEY`, `GROQ_API_KEY`, and any future provider keys only on Render.

## Frontend on Vercel

- Root directory: `Local Chatbot`
- Build command: `npm run build`
- Output directory: `dist`

Set these Vercel environment variables:

```env
VITE_API_BASE_URL=https://your-render-service.onrender.com/api
VITE_BACKEND_API_TOKEN=the-same-value-as-CHATBOT_API_TOKEN
```

Every `VITE_*` value is public in the browser. `VITE_BACKEND_API_TOKEN` is only a coarse gate, not a secret, so keep the backend rate limit enabled.

If browser cookies fail with direct Vercel-to-Render requests, route `/api/*` through a same-origin Vercel rewrite or proxy and set `VITE_API_BASE_URL=/api`.
