# Reservation Enhancements Plan

## Goal
Add event type selection to reservations, enforce party size max of 50, and display occupied tables in Calendar View.

## Changes Required

### 1. Backend - Reservation Model & Migration
- **File**: `restaurant-backend/database/migrations/xxx_add_event_type_to_reservations.php` (new)
  - Add `event_type` column (string, nullable) to `reservations` table
- **File**: `restaurant-backend/app/Models/Reservation.php`
  - Add `event_type` to `$fillable` array

### 2. Backend - ReservationController Validation
- **File**: `restaurant-backend/app/Http/Controllers/Api/V1/Table/ReservationController.php`
  - Add `event_type` to validation rules in `store()` and `update()`
  - Add `party_size` max:50 validation rule
  - Include `event_type` in response data

### 3. Backend - Calendar Endpoint Enhancement
- **File**: `restaurant-backend/app/Http/Controllers/Api/V1/Table/ReservationController.php`
  - Modify `calendar()` to include table occupancy info per date
  - Return tables with their status for each date in range

### 4. Frontend - Types
- **File**: `restaurant-frontend/src/lib/types/reservation.ts`
  - Add `event_type` to `Reservation` and `ReservationFormData` interfaces
  - Add `EventType` type with common event types: Birthday, Anniversary, Corporate, Wedding, Holiday Party, Graduation, Baby Shower, Bridal Shower, Rehearsal Dinner, Other

### 5. Frontend - Reservation Form
- **File**: `restaurant-frontend/src/features/reservations/ReservationForm.tsx`
  - Add Event Type select field (optional)
  - Update party size input validation: max 50
  - Include event_type in form submission

### 6. Frontend - Calendar View Enhancement
- **File**: `restaurant-frontend/src/features/reservations/CalendarView.tsx`
  - Add date selection handler to fetch table occupancy
  - Display occupied/available tables for selected date
  - Show table status indicators (available, reserved, occupied)

### 7. Frontend - Hooks
- **File**: `restaurant-frontend/src/lib/hooks/useReservations.ts`
  - Ensure calendar query includes table occupancy data

## Event Types List
Birthday, Anniversary, Corporate, Wedding, Holiday Party, Graduation, Baby Shower, Bridal Shower, Rehearsal Dinner, Other

## Validation Rules
- party_size: required, integer, min:1, max:50
- event_type: optional, string, in: [event types list]

## Implementation Order
1. Backend migration & model
2. Backend controller validation & calendar enhancement
3. Frontend types
4. Frontend form (event type + party size max)
5. Frontend Calendar View table occupancy display
6. Testing

## Notes
- Event type is optional (not all reservations are for events)
- Table occupancy in Calendar View shows which tables have reservations on selected date
- Party size max 50 enforced both frontend and backend