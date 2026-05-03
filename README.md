# 💰 FinTrack — Smart Money Management System

A full-stack, feature-rich personal finance web app built with React, Node.js, Express, and MySQL.

---

## 🚀 Features

| Module | Features |
|--------|----------|
| 🔐 Auth | Register, Login, JWT, Forgot/Reset Password |
| 🏠 Dashboard | Balance overview, charts, AI insights, quick actions |
| 💸 Transactions | Add/edit/delete income & expenses, receipt upload, smart tagging, recurring |
| 📊 Analytics | Monthly & yearly charts, category breakdowns, savings trends, AI insights |
| 🧾 Invoices | Create, send, download PDF invoices with GST support |
| 📒 Account Book | Khatabook-style customer ledger, money given/received tracking |
| 📄 Statements | Filtered reports, export PDF & CSV |
| 🔔 Reminders | Bill alerts, due date tracking, overdue detection |
| 👤 Profile | Edit info, change password, photo upload, currency preferences |

---

## 🗂️ Project Structure

```
money-manager/
├── backend/                # Node.js + Express API
│   ├── config/
│   │   └── database.js     # MySQL connection + auto table creation
│   ├── middleware/
│   │   └── auth.js         # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js         # Register, login, forgot/reset password
│   │   ├── transactions.js # CRUD + summary stats
│   │   ├── analytics.js    # Charts data, insights, trends
│   │   ├── invoices.js     # Invoice management
│   │   ├── ledger.js       # Khatabook customers + entries
│   │   ├── categories.js   # Custom categories
│   │   ├── profile.js      # User profile + photo + password
│   │   ├── reminders.js    # Bills & reminders
│   │   ├── statements.js   # Filtered transaction export
│   │   └── ai.js           # AI categorization + budget suggestions
│   ├── uploads/            # Receipt & profile photo storage
│   ├── .env                # Environment config
│   ├── server.js           # Express app entry point
│   └── package.json
│
├── frontend/               # React + Chart.js + jsPDF
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.js
│   │   │   └── transactions/
│   │   │       └── TransactionModal.js
│   │   ├── contexts/
│   │   │   └── AuthContext.js
│   │   ├── pages/
│   │   │   ├── Dashboard.js
│   │   │   ├── Transactions.js
│   │   │   ├── Analytics.js
│   │   │   ├── Invoices.js
│   │   │   ├── Ledger.js
│   │   │   ├── Statements.js
│   │   │   ├── Reminders.js
│   │   │   ├── Profile.js
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   └── ForgotPassword.js
│   │   ├── utils/
│   │   │   ├── api.js      # Axios instance with JWT interceptors
│   │   │   └── format.js   # Currency & date formatters
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css       # Complete design system
│   └── package.json
│
├── database.sql            # MySQL schema (manual setup)
└── README.md
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Chart.js, jsPDF |
| Backend | Node.js, Express.js |
| Database | MySQL (via XAMPP) |
| Auth | JWT + bcryptjs |
| Charts | Chart.js + react-chartjs-2 |
| PDF Export | jsPDF + jsPDF-AutoTable |
| Icons | React Icons (Remix Icons) |
| Notifications | React Hot Toast |

---

## 🛠️ Installation & Setup

### Prerequisites
- Node.js v16+
- XAMPP (MySQL + Apache)
- Git (optional)

---

### Step 1 — Start XAMPP
1. Open XAMPP Control Panel
2. Start **MySQL** and **Apache**

---

### Step 2 — Create Database

**Option A: phpMyAdmin (Easy)**
1. Open `http://localhost/phpmyadmin`
2. Click **"New"** → create database named `money_manager`
3. Click **Import** → upload `database.sql` → click Go

**Option B: MySQL CLI**
```bash
mysql -u root -p < database.sql
```

> ✅ The backend also auto-creates tables on startup if they don't exist.

---

### Step 3 — Backend Setup

```bash
cd backend
npm install
```

Edit `.env` if needed:
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=          # your XAMPP MySQL password (blank by default)
DB_NAME=money_manager
JWT_SECRET=change_this_to_a_very_long_secret
FRONTEND_URL=http://localhost:3000
```

Start backend:
```bash
npm run dev       # development (nodemon)
# OR
npm start         # production
```

Backend runs at: `http://localhost:5000`

---

### Step 4 — Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs at: `http://localhost:3000`

---

### Step 5 — Open App

Go to `http://localhost:3000` → Register a new account → Start tracking!

---

## 🔐 Security

- Passwords hashed with **bcrypt (12 rounds)**
- All protected routes require **JWT Bearer token**
- Rate limiting: **100 requests per 15 minutes**
- Input validation with **express-validator**
- SQL injection protection via **parameterized queries**
- File upload limits (5MB receipts, 2MB photos)

---

## 📊 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/forgot-password` | Request reset token |
| POST | `/api/auth/reset-password` | Reset with token |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List with filters + pagination |
| GET | `/api/transactions/summary` | Monthly income/expense/savings |
| POST | `/api/transactions` | Add transaction (multipart/form-data) |
| PUT | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/monthly-trend` | 12-month trend data |
| GET | `/api/analytics/category-breakdown` | Category-wise totals |
| GET | `/api/analytics/yearly` | Yearly overview by month |
| GET | `/api/analytics/insights` | AI-generated insights |
| GET | `/api/analytics/daily` | Daily spending last 30 days |

### Invoices, Ledger, etc.
All follow standard REST patterns (`GET /`, `POST /`, `PUT /:id`, `DELETE /:id`)

---

## 🎨 UI Design System

The app uses a custom dark-mode design system defined in `src/index.css`:

- **Colors:** `--accent-green`, `--accent-red`, `--accent-blue`, `--accent-amber`
- **Typography:** Sora (UI) + Space Mono (numbers)
- **Spacing:** CSS custom properties for consistent layout
- **Components:** `.card`, `.btn`, `.badge`, `.chip`, `.table`, `.modal`, `.stat-card`

---

## 🧠 AI Features

- **Auto-categorization:** Analyzes transaction description using keyword matching to suggest the right category
- **Financial Insights:** Detects overspending, savings drops, income growth, expense spikes
- **Budget Suggestions:** 50/30/20 rule-based budget planning per income

---

## 📦 Optional Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
# Deploy /build folder to Vercel
```

### Backend (Render/Railway)
1. Push backend to GitHub
2. Connect to Render.com
3. Set environment variables in Render dashboard
4. Use PlanetScale or Railway MySQL for cloud DB

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| DB connection error | Ensure MySQL is running in XAMPP |
| Port 5000 in use | Change `PORT` in `.env` |
| CORS error | Ensure `FRONTEND_URL` matches your React URL |
| npm install fails | Use `npm install --legacy-peer-deps` |
| Tables not created | Run `database.sql` manually in phpMyAdmin |

---

## 📝 License

MIT — Free to use, modify, and distribute.

---

Built with ❤️ using React + Node.js + MySQL
