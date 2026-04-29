"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  User,
  X,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Appointment {
  id: number;
  appointmentId: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string | null;
  appointmentDate: string;
  appointmentType: string;
  topic: string | null;
  notes: string | null;
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
  isNew: boolean;
  bookedVia: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  scheduled: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/50" },
  confirmed: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/50" },
  completed: { bg: "bg-gray-500/20", text: "text-gray-400", border: "border-gray-500/50" },
  cancelled: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/50" },
  no_show: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/50" },
};

const TYPE_LABELS: Record<string, string> = {
  trust_consultation: "Trust Consultation",
  family_office: "Family Office",
  general_consultation: "General Consultation",
  other: "Other",
};

export default function AppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    try {
      const isAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!isAdmin) router.push("/admin");
    } catch {
      router.push("/admin");
    }
  }, [router]);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      
      const res = await fetch(`/api/appointments?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load appointments");
      setAppointments(data.appointments || []);
      
      // Mark all as seen
      const newAppts = (data.appointments || []).filter((a: Appointment) => a.isNew);
      for (const appt of newAppts) {
        await fetch("/api/appointments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId: appt.appointmentId, isNew: false }),
        });
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [filterStatus]);

  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success("Status updated");
      loadAppointments();
      if (selectedAppointment?.appointmentId === appointmentId) {
        setSelectedAppointment({ ...selectedAppointment, status: newStatus as any });
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedAppointment) return;
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: selectedAppointment.appointmentId, notes: editNotes }),
      });
      if (!res.ok) throw new Error("Failed to save notes");
      toast.success("Notes saved");
      setSelectedAppointment({ ...selectedAppointment, notes: editNotes });
      loadAppointments();
    } catch {
      toast.error("Failed to save notes");
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      const res = await fetch("/api/appointments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId }),
      });
      if (!res.ok) throw new Error("Failed to cancel");
      toast.success("Appointment cancelled");
      setShowDetailsDialog(false);
      loadAppointments();
    } catch {
      toast.error("Failed to cancel appointment");
    }
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days: (number | null)[] = [];
    for (let i = 0; i < startingDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const getAppointmentsForDay = (day: number) => {
    const targetDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    return appointments.filter(a => {
      const apptDate = new Date(a.appointmentDate);
      return apptDate.toDateString() === targetDate.toDateString();
    });
  };

  const navigateMonth = (direction: number) => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + direction, 1));
  };

  const openAppointmentDetails = (appt: Appointment) => {
    setSelectedAppointment(appt);
    setEditNotes(appt.notes || "");
    setShowDetailsDialog(true);
  };

  const days = getDaysInMonth(selectedDate);
  const monthYear = selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Admin
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-700" />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Calendar className="h-6 w-6 text-cyan-400" />
                Appointments
              </h1>
              <p className="text-sm text-gray-400">Specialist consultation calendar</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300"
              onClick={loadAppointments}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-3 bg-blue-900/30 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {appointments.filter(a => a.status === "scheduled").length}
                </p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Scheduled</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-3 bg-green-900/30 rounded-lg">
                <Check className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {appointments.filter(a => a.status === "confirmed").length}
                </p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Confirmed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-3 bg-cyan-900/30 rounded-lg">
                <Clock className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {appointments.filter(a => {
                    const apptDate = new Date(a.appointmentDate);
                    const today = new Date();
                    return apptDate.toDateString() === today.toDateString() && a.status !== "cancelled";
                  }).length}
                </p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Today</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-3 bg-purple-900/30 rounded-lg">
                <MessageSquare className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{appointments.length}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-cyan-400" />
                {monthYear}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300"
                  onClick={() => navigateMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300"
                  onClick={() => setSelectedDate(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300"
                  onClick={() => navigateMonth(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardDescription className="text-gray-400">
              Business Hours: Mon-Fri 9AM-9PM, Sat-Sun 10AM-10PM
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-pulse text-gray-500">Loading appointments...</div>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <div key={day} className="p-2 text-center text-xs font-semibold text-gray-500 uppercase">
                    {day}
                  </div>
                ))}
                {days.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="p-2 min-h-[100px]" />;
                  }
                  
                  const dayAppointments = getAppointmentsForDay(day);
                  const isToday = new Date().toDateString() === new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day).toDateString();
                  
                  return (
                    <div
                      key={day}
                      className={`p-2 min-h-[100px] border rounded-lg transition-colors ${
                        isToday
                          ? "border-cyan-500/50 bg-cyan-500/10"
                          : "border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      <div className={`text-sm font-medium mb-1 ${isToday ? "text-cyan-400" : "text-gray-300"}`}>
                        {day}
                      </div>
                      <div className="space-y-1">
                        {dayAppointments.slice(0, 3).map(appt => {
                          const time = new Date(appt.appointmentDate).toLocaleTimeString([], { 
                            hour: "2-digit", 
                            minute: "2-digit" 
                          });
                          const colors = STATUS_COLORS[appt.status] || STATUS_COLORS.scheduled;
                          
                          return (
                            <button
                              key={appt.appointmentId}
                              onClick={() => openAppointmentDetails(appt)}
                              className={`w-full text-left text-xs p-1.5 rounded ${colors.bg} ${colors.text} border ${colors.border} hover:opacity-80 transition-opacity truncate`}
                            >
                              <span className="font-medium">{time}</span>
                              <span className="ml-1 opacity-80">{appt.visitorName.split(" ")[0]}</span>
                            </button>
                          );
                        })}
                        {dayAppointments.length > 3 && (
                          <div className="text-xs text-gray-500 text-center">
                            +{dayAppointments.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Appointments List */}
        <Card className="mt-8 bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Upcoming Appointments</CardTitle>
            <CardDescription className="text-gray-400">
              Next 7 days of scheduled appointments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appointments
                .filter(a => {
                  const apptDate = new Date(a.appointmentDate);
                  const now = new Date();
                  const weekFromNow = new Date();
                  weekFromNow.setDate(weekFromNow.getDate() + 7);
                  return apptDate >= now && apptDate <= weekFromNow && a.status !== "cancelled";
                })
                .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
                .slice(0, 10)
                .map(appt => {
                  const apptDate = new Date(appt.appointmentDate);
                  const colors = STATUS_COLORS[appt.status] || STATUS_COLORS.scheduled;
                  
                  return (
                    <div
                      key={appt.appointmentId}
                      onClick={() => openAppointmentDetails(appt)}
                      className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-700 rounded-lg hover:border-cyan-500/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[60px]">
                          <div className="text-lg font-bold text-white">
                            {apptDate.getDate()}
                          </div>
                          <div className="text-xs text-gray-400">
                            {apptDate.toLocaleDateString("en-US", { weekday: "short" })}
                          </div>
                        </div>
                        <div className="h-12 w-px bg-gray-700" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{appt.visitorName}</span>
                            <Badge variant="outline" className={`${colors.bg} ${colors.text} ${colors.border} text-xs`}>
                              {appt.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {apptDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {TYPE_LABELS[appt.appointmentType] || appt.appointmentType}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    </div>
                  );
                })}
              {appointments.filter(a => {
                const apptDate = new Date(a.appointmentDate);
                const now = new Date();
                const weekFromNow = new Date();
                weekFromNow.setDate(weekFromNow.getDate() + 7);
                return apptDate >= now && apptDate <= weekFromNow && a.status !== "cancelled";
              }).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No upcoming appointments in the next 7 days
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Appointment Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-cyan-400" />
              Appointment Details
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedAppointment?.appointmentId}
            </DialogDescription>
          </DialogHeader>
          
          {selectedAppointment && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase">Date & Time</label>
                  <p className="text-white font-medium">
                    {new Date(selectedAppointment.appointmentDate).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-cyan-400">
                    {new Date(selectedAppointment.appointmentDate).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase">Status</label>
                  <Select
                    value={selectedAppointment.status}
                    onValueChange={(val) => handleStatusChange(selectedAppointment.appointmentId, val)}
                  >
                    <SelectTrigger className="mt-1 bg-gray-700/50 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="no_show">No Show</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="h-px bg-gray-700" />

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-white">{selectedAppointment.visitorName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a href={`mailto:${selectedAppointment.visitorEmail}`} className="text-cyan-400 hover:underline">
                    {selectedAppointment.visitorEmail}
                  </a>
                </div>
                {selectedAppointment.visitorPhone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <a href={`tel:${selectedAppointment.visitorPhone}`} className="text-cyan-400 hover:underline">
                      {selectedAppointment.visitorPhone}
                    </a>
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-700" />

              <div>
                <label className="text-xs text-gray-400 uppercase">Consultation Type</label>
                <p className="text-white">
                  {TYPE_LABELS[selectedAppointment.appointmentType] || selectedAppointment.appointmentType}
                </p>
              </div>

              {selectedAppointment.topic && (
                <div>
                  <label className="text-xs text-gray-400 uppercase">Topic / Message</label>
                  <p className="text-gray-300 text-sm mt-1">{selectedAppointment.topic}</p>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 uppercase">Admin Notes</label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes about this appointment..."
                  className="mt-1 bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                />
                <Button
                  size="sm"
                  className="mt-2 bg-cyan-600 hover:bg-cyan-700"
                  onClick={handleSaveNotes}
                >
                  Save Notes
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="border-red-800 text-red-400 hover:bg-red-900/30"
              onClick={() => selectedAppointment && handleCancelAppointment(selectedAppointment.appointmentId)}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Appointment
            </Button>
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300"
              onClick={() => setShowDetailsDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
