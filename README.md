# RMS — Restaurant Management System (Monorepo)

Full-stack restaurant management platform.

## Structure

| Path | Stack | Notes |
|---|---|---|
| `restaurant-frontend/` | Next.js · React · TypeScript · Tailwind | POS, Orders, Kitchen, Reservations, Reports & Analytics, AI Demand Forecast UI |
| `restaurant-backend/` | Laravel 12 · PostgreSQL/SQLite · Sanctum | REST API, TimechoAI + Gemini integrations, RBAC |

## Quick start

**Backend**
```bash
cd restaurant-backend
composer install
cp .env.example .env   # then fill in credentials
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

**Frontend**
```bash
cd restaurant-frontend
npm install
npm run dev
```

## AI services
- **TimechoAI** — demand forecasting (`TIMECHO_*` in backend `.env`)
- **Gemini 3.x Flash** — insights/recommendations (`GEMINI_*` in backend `.env`)

Keys live only in `restaurant-backend/.env` (gitignored).

---

## Today's Changes (Oct 6, 2026)

### 🎯 Reservation System Enhancements
- **Table Auto-Fill Hint**: Amber warning appears when party size entered but date/time missing, guiding users to select date/time first for auto-table assignment
- **Smart Table Assignment**: Auto-fills best-fit table when date+time+party size filled (exact match priority → larger tables)
- **Odd Party Sizes Handled**: 3→4-seater, 5→6-seater, 7→8-seater, 9→10-seater automatically

### 🍽️ POS Improvements
- **Time Slot Visualization**: Green=Available, Red=Fully Booked per 30-min slot (11AM-11PM) with table occupancy details
- **Cashier Notes Visibility**: Order-level and item-level notes now visible in CartPanel at checkout
- **Table Grouping in "Pay Existing"**: Orders grouped by table with collapsible sections, showing order count & total per table
- **"No Table Assigned" Section**: Orders without table assignment grouped separately
- **Clean Code**: Extracted `renderOrderButton`, `renderTableOrders`, `renderNoTableOrders`, `renderContent` helper functions

### 📅 Calendar View
- **Timer Countdown**: Per reservation (e.g., "2h 15m", "Now")
- **Professional Cards**: Capacity, status badges, event indicators
- **Next Reservation Highlight**: "Next" badge with primary accent
- **Event Day Highlighting**: Violet color coding, "Reserved for Event" badge, event names displayed
- **Grid Layout**: Fixed CSS Grid layout (CSS Grid, weekends visible, no overlapping)
- **Color Coding**: 🟣 Event, 🔴 Full, 🟡 Limited, 🟢 Available

### 📊 Dashboard
- **Date Range Selector**: Presets (7 days default, today, 30 days, 90 days)
- Backend accepts `date_from`/`date_to` params (defaults to last 7 days)
- All queries respect date range

### 🎨 Theme System
- **Theme Toggle Fixed**: Light/Dark/System toggle in top nav now works in production mode
- Uses custom `ThemeContext` consistently across all modes

### 🖼️ Menu Images
- **Base64 Storage**: Cross-device compatibility (images stored in DB)
- File upload converts to base64 + preview
- Fallback to preset images

### 🗄️ Database & Data
- **7-Year Historical Data**: 64,500 records seeded in PostgreSQL
  - 3,000 customers
  - 10,000 reservations
  - 30,000 orders
  - 50 tables (varying capacities 2-12 seats)
- All migrations applied, seeders updated for 7-year range

### Backend API
- **New Endpoint**: `GET /api/v1/reservations/time-slots` with table occupancy per slot
- Time slots at 30-min increments (11AM-11PM) with duration-based availability
- Table grouping in "Pay Existing" dialog with collapsible sections
- All 396 backend tests pass (1993 assertions)

### Technical Fixes
- Frontend builds successfully (Next.js 16.3.5, TypeScript strict)
- Calendar grid layout fixed (CSS Grid, weekends visible, no overlapping)
- Theme toggle fixed (uses custom ThemeContext in all modes)
- CalendarView syntax errors fixed (JSX structure, fragment/ternary closures)
- Table grouping in POS "Pay Existing" dialog with collapsible sections

---

## Testing
- **Backend**: 396 tests pass (1993 assertions)
- **Frontend**: TypeScript strict check passes, Next.js build successful

---

## Quick Start (with 7-year data)
```bash
cd restaurant-backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed --class=ProductionDataSeeder  # Generates 7-year data

cd ../restaurant-frontend
npm install
npm run dev
```

---

## AI services
- **TimechoAI** — demand forecasting (`TIMECHO_*` in backend `.env`)
- **Gemini 3.x Flash** — insights/recommendations (`GEMINI_*` in backend `.env`)

Keys live only in `restaurant-backend/.env` (gitignored).