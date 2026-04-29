import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { specialistAppointments } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// Business hours configuration
const BUSINESS_HOURS = {
  weekday: { start: 9, end: 21 }, // 9am - 9pm Mon-Fri
  weekend: { start: 10, end: 22 }, // 10am - 10pm Sat-Sun
};

// Check if a time slot is within business hours
function isWithinBusinessHours(date: Date): boolean {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = date.getHours();
  
  if (day === 0 || day === 6) {
    // Weekend
    return hour >= BUSINESS_HOURS.weekend.start && hour < BUSINESS_HOURS.weekend.end;
  } else {
    // Weekday
    return hour >= BUSINESS_HOURS.weekday.start && hour < BUSINESS_HOURS.weekday.end;
  }
}

// Get available time slots for a given date
function getAvailableSlots(date: Date, bookedSlots: Date[]): string[] {
  const day = date.getDay();
  const hours = day === 0 || day === 6 ? BUSINESS_HOURS.weekend : BUSINESS_HOURS.weekday;
  
  const slots: string[] = [];
  const bookedHours = new Set(bookedSlots.map(d => d.getHours()));
  
  for (let hour = hours.start; hour < hours.end; hour++) {
    if (!bookedHours.has(hour)) {
      const hourStr = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? "12:00 PM" : `${hour}:00 AM`;
      slots.push(hourStr);
    }
  }
  
  return slots;
}

// GET - List appointments or get available slots
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const db = await getDb();
    
    // Get available slots for a specific date
    if (action === "available_slots") {
      const dateStr = searchParams.get("date");
      if (!dateStr) {
        return NextResponse.json({ error: "date is required" }, { status: 400 });
      }
      
      // Parse the date - handle YYYY-MM-DD format properly
      const targetDate = new Date(dateStr + "T12:00:00");
      
      // Validate the date parsed correctly
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json({ 
          error: "Invalid date format",
          availableSlots: [],
          date: dateStr 
        }, { status: 400 });
      }
      
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      let bookedDates: Date[] = [];
      
      // Try to get booked appointments for this day
      try {
        const booked = await db
          .select({ appointmentDate: specialistAppointments.appointmentDate })
          .from(specialistAppointments)
          .where(
            and(
              gte(specialistAppointments.appointmentDate, startOfDay),
              lte(specialistAppointments.appointmentDate, endOfDay),
              eq(specialistAppointments.status, "scheduled")
            )
          );
        
        bookedDates = booked.map(b => new Date(b.appointmentDate));
        console.log("[Appointments API] Booked count:", booked.length);
      } catch (dbError) {
        console.error("[Appointments API] DB query error:", dbError);
        // Continue with empty booked slots - all times available
      }
      
      const availableSlots = getAvailableSlots(targetDate, bookedDates);
      
      // Debug logging
      console.log("[Appointments API] Date requested:", dateStr);
      console.log("[Appointments API] Parsed date:", targetDate.toISOString());
      console.log("[Appointments API] Day of week:", targetDate.getDay(), "(0=Sun, 6=Sat)");
      console.log("[Appointments API] Available slots:", availableSlots.length, availableSlots);
      
      return NextResponse.json({ 
        date: dateStr,
        availableSlots,
        businessHours: targetDate.getDay() === 0 || targetDate.getDay() === 6 
          ? BUSINESS_HOURS.weekend 
          : BUSINESS_HOURS.weekday
      });
    }
    
    // Get count of new appointments (for notification badge)
    if (action === "new_count") {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(specialistAppointments)
        .where(eq(specialistAppointments.isNew, true));
      
      return NextResponse.json({ count: result[0]?.count || 0 });
    }
    
    // List all appointments (admin)
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    
    const conditions = [];
    if (status && status !== "all") {
      conditions.push(eq(specialistAppointments.status, status as any));
    }
    if (startDate) {
      conditions.push(gte(specialistAppointments.appointmentDate, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(specialistAppointments.appointmentDate, new Date(endDate)));
    }
    
    const appointments = await db
      .select()
      .from(specialistAppointments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(specialistAppointments.appointmentDate));
    
    return NextResponse.json({ appointments });
  } catch (error: any) {
    console.error("Error fetching appointments:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch appointments" },
      { status: 500 }
    );
  }
}

// POST - Create a new appointment
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { visitorName, visitorEmail, visitorPhone, appointmentDate, appointmentType, topic } = body;
    
    if (!visitorName || !visitorEmail || !appointmentDate) {
      return NextResponse.json(
        { error: "visitorName, visitorEmail, and appointmentDate are required" },
        { status: 400 }
      );
    }
    
    const apptDate = new Date(appointmentDate);
    const db = await getDb();
    
    // Validate business hours
    if (!isWithinBusinessHours(apptDate)) {
      return NextResponse.json(
        { error: "Appointment time is outside business hours" },
        { status: 400 }
      );
    }
    
    // Check if slot is already booked
    const startOfHour = new Date(apptDate);
    startOfHour.setMinutes(0, 0, 0);
    const endOfHour = new Date(apptDate);
    endOfHour.setMinutes(59, 59, 999);
    
    const existing = await db
      .select({ id: specialistAppointments.id })
      .from(specialistAppointments)
      .where(
        and(
          gte(specialistAppointments.appointmentDate, startOfHour),
          lte(specialistAppointments.appointmentDate, endOfHour),
          eq(specialistAppointments.status, "scheduled")
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "This time slot is already booked. Please choose another time." },
        { status: 409 }
      );
    }
    
    const appointmentId = `APPT-${randomUUID().slice(0, 8).toUpperCase()}`;
    
    await db.insert(specialistAppointments).values({
      appointmentId,
      visitorName,
      visitorEmail,
      visitorPhone: visitorPhone || null,
      appointmentDate: apptDate,
      appointmentType: appointmentType || "general_consultation",
      topic: topic || null,
      status: "scheduled",
      isNew: true,
      bookedVia: "reality_chatbot",
    });
    
    return NextResponse.json({
      success: true,
      appointmentId,
      message: `Appointment scheduled for ${apptDate.toLocaleDateString()} at ${apptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    });
  } catch (error: any) {
    console.error("Error creating appointment:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create appointment" },
      { status: 500 }
    );
  }
}

// PATCH - Update appointment (admin)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { appointmentId, status, notes, isNew } = body;
    
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId is required" }, { status: 400 });
    }
    
    const updateData: Record<string, any> = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (isNew !== undefined) updateData.isNew = isNew;
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    
    const db = await getDb();
    await db
      .update(specialistAppointments)
      .set(updateData)
      .where(eq(specialistAppointments.appointmentId, appointmentId));
    
    return NextResponse.json({ success: true, message: "Appointment updated" });
  } catch (error: any) {
    console.error("Error updating appointment:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update appointment" },
      { status: 500 }
    );
  }
}

// DELETE - Cancel appointment
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { appointmentId } = body;
    
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId is required" }, { status: 400 });
    }
    
    const db = await getDb();
    await db
      .update(specialistAppointments)
      .set({ status: "cancelled" })
      .where(eq(specialistAppointments.appointmentId, appointmentId));
    
    return NextResponse.json({ success: true, message: "Appointment cancelled" });
  } catch (error: any) {
    console.error("Error cancelling appointment:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to cancel appointment" },
      { status: 500 }
    );
  }
}
