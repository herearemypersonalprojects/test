
# Lozu Heritage Map — Architecture & Installation Guide

> **Version:** 1.0
> **Components:** Frontend (Web + Mobile React), Backend API (FastAPI on Cloud Run), Google Cloud Storage
> **Author:** Team Lozu
> **Purpose:** Nền tảng bản đồ di sản / POIs / heritage với dữ liệu subset public + full protected dataset.

---

# 📌 1. Tổng quan kiến trúc

Hệ thống gồm 3 phần:

```
/web-frontend      → React (Web)
/mobile-frontend   → React (Mobile)
/backend           → Python FastAPI (JWT Auth + GCS Signed URL)
```

File dữ liệu:

* `paris_public.json`  → Public, dung lượng nhỏ
* `paris_full.json`    → Full 60MB, chỉ người login mới tải được

Lưu ý quan trọng:

* Full dataset **không bao giờ lưu vào localStorage / IndexedDB**.
* Chỉ tải *một lần vào RAM* sau login → đóng tab là mất → tăng bảo mật, giảm rủi ro copy.

---

# 📌 2. Sơ đồ kiến trúc

```mermaid
flowchart LR
    subgraph Client[Client Browser]
        UI[React Web/Mobile + MapLibre]
        Mem[Full dataset in RAM]
    end

    subgraph Cloud[GCP]
        Backend[Cloud Run FastAPI]
        GCS[(Google Cloud Storage\nparis_public.json\nparis_full.json)]
        Auth[Custom / Firebase / Identity Platform]
    end

    UI -->|GET /api/public-pois| Backend
    Backend -->|read| GCS

    UI -->|POST /auth/login| Backend
    Backend --> Auth
    Backend -->|JWT| UI

    UI -->|GET /api/full-url (JWT)| Backend
    Backend -->|Signed URL| GCS
    Backend --> UI

    UI -->|Download 60MB file| GCS
    UI -->|Store in RAM| Mem
```

---

# 📌 3. Backend (FastAPI) — `/backend`

## 3.1. Chức năng chính

* `/auth/login` → Sinh JWT
* `/auth/me` → Verify token
* `/api/public-pois` → Trả subset
* `/api/full-url` → Verify JWT + trả GCS Signed URL 5–15 phút

## 3.2. Cấu trúc thư mục

```
backend/
│── main.py
│── auth.py
│── gcs.py
│── requirements.txt
│── Dockerfile
└── .env.example
```

## 3.3. Cài đặt local

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API chạy tại:

```
http://localhost:8000
```

## 3.4. Cấu hình môi trường `.env`

```
JWT_SECRET=supersecretkey
JWT_EXPIRE_MINUTES=60

GCP_BUCKET_NAME=lozu-poi-bucket
GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json
```

## 3.5. Deploy backend lên Cloud Run

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/lozu-backend
gcloud run deploy lozu-backend \
  --image gcr.io/PROJECT_ID/lozu-backend \
  --allow-unauthenticated \
  --platform managed \
  --region europe-west1
```

Sau khi deploy, phục vụ tại:

```
https://lozu-backend-xxxxxx.a.run.app
```

---

# 📌 4. Frontend Web — `/web-frontend`

## 4.1. Công nghệ

* React + Vite
* MapLibre GL JS
* Sử dụng API backend để tải dữ liệu

## 4.2. Cấu trúc thư mục

```
web-frontend/
│── src/
│     ├── App.jsx
│     ├── components/
│     ├── hooks/
│     └── lib/
│── public/
│── index.html
│── vite.config.js
│── package.json
└── README.md
```

## 4.3. Biến môi trường

Tạo file `.env`:

```
VITE_API_BASE_URL=https://lozu-backend-xxxxxx.a.run.app
```

## 4.4. Chạy local

```bash
cd web-frontend
npm install
npm run dev
```

## 4.5. Build production

```bash
npm run build
npm run preview
```

Thư mục build:

```
web-frontend/dist/
```

## 4.6. Deploy lên GitHub Pages

Cách 1 — Manual:

* Build → Copy folder `dist/` → push vào branch `gh-pages`

Cách 2 — GitHub Actions (khuyên dùng):

`.github/workflows/deploy.yml`

```yml
name: Deploy Web

on:
  push:
    branches: [ "main" ]

jobs:
  build-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - run: npm install
        working-directory: web-frontend

      - run: npm run build
        working-directory: web-frontend

      - name: Deploy to GitHub Pages
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          branch: gh-pages
          folder: web-frontend/dist
```

---

# 📌 5. Frontend Mobile — `/mobile-frontend`

> Là version UI dành riêng cho layout mobile, nhưng vẫn dùng React + Vite (không cần React Native).

Cấu trúc tương tự web:

```
mobile-frontend/
│── src/
│── public/
│── package.json
│── vite.config.js
└── ...
```

Build & deploy giống hệt phần web.

Bạn có thể deploy mobile vào thư mục:

```
https://username.github.io/lozu/mobile/
```

và web:

```
https://username.github.io/lozu/web/
```

---

# 📌 6. Cách frontend tải dữ liệu vào RAM (bảo mật content)

## 6.1. Load subset (public)

```js
const res = await fetch(`${API_BASE}/api/public-pois`);
publicPois = await res.json();
```

## 6.2. Login → lấy JWT

```js
const res = await fetch(`${API}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password })
});

const { access_token } = await res.json();
setToken(access_token);          // lưu RAM
```

## 6.3. Lấy Signed URL → tải full data

```js
let fullDataMemory = null; // RAM-only

export async function loadFullData(token) {
  if (fullDataMemory) return fullDataMemory;

  const sUrlRes = await fetch(`${API}/api/full-url`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const { downloadUrl } = await sUrlRes.json();

  const fileRes = await fetch(downloadUrl);
  const json = await fileRes.json();

  fullDataMemory = json.map((p, i) => ({ ...p, _idx: i }));
  return fullDataMemory;
}
```

## 6.4. Không lưu localStorage

```js
// ❌ Không được làm
localStorage.setItem("fullData", JSON.stringify(json));

// ✔ Chỉ lưu RAM
state.fullPois = json;
```

---

# 📌 7. Bảo mật

* Signed URL sống tối đa **10 phút**
* JWT hết hạn **60 phút**
* Không lưu full data xuống disk phía client
* Không cho phép export full dataset qua API public
* Nếu cần: kết hợp Cloud Armor để rate limit

---

# 📌 8. Deployment Flow chuẩn

```
[Dev Local]
   ↓
Git Push → GitHub
   ↓
GitHub Actions build
   ↓
Deploy web-frontend to gh-pages
Deploy mobile-frontend to gh-pages
Deploy backend to Cloud Run
   ↓
User access: /web/ or /mobile/
```

---

# 📌 9. Checklist trước khi chạy Production

### Backend

* [ ] Service account có `storage.objectViewer`
* [ ] Bucket private 100%
* [ ] JWT secret lưu trong Secret Manager
* [ ] CORS chỉ cho domain frontend
* [ ] Signed URL expire < 15 phút

### Frontend

* [ ] Không lưu full data vào localStorage / IndexedDB
* [ ] API_BASE chính xác
* [ ] MapLibre key (nếu cần)
* [ ] Web + Mobile deploy thành 2 thư mục độc lập

### Monitoring

* [ ] Log số lượng gọi `/api/full-url`
* [ ] Log tải xuống Signed URL (GCS usage)
* [ ] Error rate từ Cloud Run

---

# 📌 10. Liên hệ

* **Team Lozu Engineering**
* Email: `support@lozu.fr`
* GitHub: [https://github.com/lozu](https://github.com/lozu)
* Issue tracker: GitHub Issues

---
