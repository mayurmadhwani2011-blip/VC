# Clinic Management System

A lightweight, single-page clinic management web app built with Node.js + Express and a JSON file database.

## Features

- **Dashboard** — daily stats, appointment overview, revenue summary
- **Patients** — register, search, view history, duplicate detection (civil ID / phone)
- **Appointments** — calendar view, list view, drag-and-drop scheduler, status tracking
- **Prescriptions** — create and manage prescriptions per appointment
- **Billing** — itemised bills, multi-payment splits, print, mark paid
- **Services** — manage clinic services with categories and pricing
- **Packages** — create bundled service packages with discount pricing
- **Patient Packages** — assign packages to patients, track session consumption
- **Users** — manage staff accounts (admin / doctor / receptionist)
- **Reports** — daily revenue, top patients
- **RBAC** — role-based permissions configurable per role
- **Themes** — light / dark mode toggle
- **Grid / List views** — toggle on every list page, preference saved per page

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express 4 |
| Auth | express-session, bcryptjs |
| Database | JSON file (`data/clinic-data.json`) |
| Frontend | Vanilla JS SPA, HTML5, CSS3 |

## Getting Started

### Prerequisites
- Node.js 18+

### Install & Run

```bash
cd clinic
npm install
npm start
```

App runs at **http://localhost:4000**

### Default Logins

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Doctor | `doctor1` | `doctor123` |
| Receptionist | `receptionist1` | `recep123` |

## Project Structure

```
clinic/
├── server.js          # Express server + all API routes
├── data/
│   └── clinic-data.json   # JSON file database (auto-created)
├── package.json
└── public/
    ├── index.html     # SPA shell
    ├── app.js         # All frontend logic (~3600 lines)
    └── style.css      # Design system + component styles
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/login` | Login |
| POST | `/api/logout` | Logout |
| GET | `/api/me` | Current session user |
| GET/POST/PUT/DELETE | `/api/patients` | Patient CRUD |
| GET/POST/PUT/DELETE | `/api/appointments` | Appointment CRUD |
| GET/POST/PUT | `/api/prescriptions` | Prescription CRUD |
| GET/POST/PUT | `/api/bills` | Billing CRUD |
| GET/POST/PUT/DELETE | `/api/services` | Service CRUD |
| GET/POST/PUT/DELETE | `/api/packages` | Package CRUD |
| GET/DELETE | `/api/patient-packages` | Patient package subscriptions |
| GET/POST/PUT/DELETE | `/api/users` | User management (admin only) |
| GET/PUT | `/api/role-permissions` | RBAC config (admin only) |
| GET | `/api/reports/daily` | Daily report |
| GET | `/api/reports/revenue` | Revenue report |

## Currency

All amounts are in **Kuwaiti Dinar (KD)** with 3 decimal places (fils).
