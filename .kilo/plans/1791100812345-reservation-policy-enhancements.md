# Reservation System Enhancements Plan

## Goal
Implement comprehensive reservation policies including date restrictions, calendar indicators, time duration rules, card/deposit requirements, reminders, check-in logic, and no-show penalties.

## Backend Changes

### 1. Database Migrations
- **Add reservation policy fields to reservations table**:
  - `card_required` (boolean)
  - `deposit_required` (boolean) 
  - `deposit_amount` (decimal)
  - `deposit_paid` (boolean)
  - `card_on_file` (boolean)
  - `reserved_party_size` (integer)
  - `actual_party_size` (integer, nullable)
  - `duration_minutes` (integer)
  - `end_time` (string/time)
  - `reminder_24h_sent` (boolean)
  - `reminder_2h_sent` (boolean)
  - `no_show_counter` (integer, default 0)
  - `partial_show_counter` (integer, default 0)
  - `guest_flag_level` (integer, default 0) // 0=none, 1=card required, 2=50% deposit + card

- **Add restaurant settings for configurable thresholds**:
  - `reservation_card_threshold` (integer, default 6)
  - `reservation_no_show_fee` (decimal, default 15.00)
  - `reservation_no_show_flag_threshold` (integer, default 2)
  - `reservation_deposit_percentage` (decimal, default 50.00)
  - `reservation_cancellation_window_minutes` (integer, default 15)
  - `reservation_regular_duration_minutes` (integer, default 180) // 3 hours for 1-4
  - `reservation_large_duration_minutes` (integer, default 240) // 4 hours for 5+
  - `reservation_weekend_days` (json array, default [5,6]) // Friday=5, Saturday=6

### 2. Reservation Model
- Add new fields to `$fillable`
- Add accessors for `end_time` calculation
- Add methods for policy checks

### 3. ReservationController Updates
- **Store validation**: Check past dates, enforce card/deposit rules based on party size + day of week
- **Calculate duration**: 1-4 people = 3 hours, 5+ = 4 hours (configurable)
- **Set end_time** based on start_time + duration
- **Set card_required/deposit_required** flags based on policy
- **Check table availability** for full duration
- **Return policy info** in response

### 4. New Endpoints
- `POST /reservations/check-availability` - Check if tables available for date/time/party_size
- `GET /reservations/policy` - Get current reservation policy settings
- `POST /reservations/{id}/check-in` - Enhanced check-in with actual party size handling
- `POST /reservations/{id}/no-show` - Process no-show with fees

### 5. Reminder System
- Scheduled job to send 24h and 2h reminders
- Include cancellation/confirmation links

### 6. No-Show Processing
- Background job to check for no-shows 15 min after reservation time
- Charge fees, forfeit deposits, update counters, apply flags

## Frontend Changes

### 1. ReservationForm.tsx
- **Date picker**: Min date = today, disable past dates
- **Time picker**: Show start time, auto-calculate end time based on party size
- **Duration display**: Show "3 hours" or "4 hours" based on party size
- **Card/Deposit notice**: Show when card/deposit required based on policy
- **Policy summary**: Display current rules to user

### 2. CalendarView.tsx
- **Color indicators**:
  - Green: Tables available
  - Yellow: Limited availability
  - Red: Fully booked (no tables available)
- **Click handler**: Show notice when day is full
- **Occupancy data**: Use table_occupancy from calendar endpoint

### 3. New Components
- `ReservationPolicyBanner` - Shows card/deposit requirements
- `TimeDurationSelector` - Start time + auto-calculated end time
- `CalendarDayIndicator` - Visual availability indicator

### 4. Types
- Update Reservation interface with new fields
- Add PolicySettings interface
- Add CheckInData interface

## Implementation Order

1. **Backend: Database migration** for new fields
2. **Backend: Restaurant settings** for configurable thresholds
3. **Backend: Reservation model** updates
4. **Backend: ReservationController** validation & policy logic
5. **Backend: New endpoints** for availability check, policy, check-in, no-show
6. **Frontend: Types** updates
7. **Frontend: ReservationForm** - date restriction, time duration, policy display
8. **Frontend: CalendarView** - color indicators, full-day notice
9. **Frontend: Policy components** - reusable policy display
10. **Backend: Reminder job** (scheduled command)
11. **Backend: No-show job** (scheduled command)
12. **Testing** - Verify all flows work

## Notes
- All thresholds configurable per restaurant via settings table
- Timezone handling for reminders (use restaurant timezone)
- Card/deposit integration placeholder (would connect to payment provider)
- Email/SMS templates for reminders