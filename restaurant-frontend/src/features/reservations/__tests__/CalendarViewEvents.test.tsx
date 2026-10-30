import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarView } from "../CalendarView";
import type { Reservation, TableOccupancyByDate } from "@/lib/types";

const selectedDate = new Date(2026, 10, 10);
const dateKey = "2026-11-10";

function eventReservation(scope: "standard" | "half_day" | "whole_day"): Reservation {
  return {
    id: "r-event",
    reservation_number: "RES-1001",
    guest_name: "Ana Cruz",
    reservation_date: dateKey,
    reservation_time: "18:00",
    end_time: "22:00",
    duration_minutes: 240,
    party_size: 6,
    status: "confirmed",
    event_type: "Birthday",
    booking_scope: scope,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
  };
}

function occupancy(allBlocked: boolean): TableOccupancyByDate {
  return {
    [dateKey]: [
      {
        id: "t-1",
        number: "1",
        capacity: 6,
        status: "available",
        has_reservation: true,
        reservations: [
          {
            id: "r-event",
            guest_name: "Ana Cruz",
            party_size: 6,
            reservation_time: "18:00",
            end_time: "22:00",
            duration_minutes: 240,
            status: "confirmed",
            event_type: "Birthday",
            booking_scope: "half_day",
          },
        ],
      },
      {
        id: "t-2",
        number: "2",
        capacity: 4,
        status: "available",
        has_reservation: allBlocked,
        reservations: allBlocked
          ? [
              {
                reservation_time: "18:00",
                end_time: "22:00",
                status: "confirmed",
                guest_name: "Whole-day Event",
                booking_scope: "whole_day",
              },
            ]
          : [],
      },
    ],
  };
}

describe("CalendarView event reservations", () => {
  it("identifies a half-day event without claiming the whole venue is reserved", () => {
    render(
      <CalendarView
        reservations={[eventReservation("half_day")]}
        tableOccupancy={occupancy(false)}
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/Events on this date/)).toBeInTheDocument();
    expect(screen.getAllByText(/Ana Cruz/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Half-day/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Other tables remain available/)).toBeInTheDocument();
    expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Full Venue Reserved/)).not.toBeInTheDocument();
  });

  it("only shows the full-venue notice for a whole-day event when every table is blocked", () => {
    render(
      <CalendarView
        reservations={[eventReservation("whole_day")]}
        tableOccupancy={occupancy(true)}
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/Whole-Day Event — Venue Reserved/)).toBeInTheDocument();
    expect(screen.queryByText(/Events on this date/)).not.toBeInTheDocument();
  });
});
