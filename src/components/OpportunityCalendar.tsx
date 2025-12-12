import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Plus, MapPin, Clock, Edit, Trash2 } from "lucide-react";

interface OpportunityEvent {
  id: string;
  opportunity_id: string;
  title: string;
  event_type: "meeting" | "pitch" | "follow_up" | "demo";
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
}

interface OpportunityCalendarProps {
  opportunityId: string;
  opportunityName: string;
  isDetailView?: boolean;
}

export function OpportunityCalendar({ opportunityId, opportunityName, isDetailView = false }: OpportunityCalendarProps) {
  const { user } = useAuth();
  const [events, setEvents] = useState<OpportunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<OpportunityEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<OpportunityEvent | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    event_type: "meeting",
    event_date: "",
    start_time: "",
    end_time: "",
    location: "",
    notes: "",
  });

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    fetchEvents();
  }, [opportunityId]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from("opportunity_events" as any)
        .select("*")
        .eq("opportunity_id", opportunityId)
        .order("event_date", { ascending: true })) as any;

      if (error) throw error;
      setEvents((data as OpportunityEvent[]) || []);
    } catch (err) {
      console.error("Failed to load events", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingEvent) {
        const { error } = await (supabase
          .from("opportunity_events" as any)
          .update({
            title: formData.title,
            event_type: formData.event_type as "meeting" | "pitch" | "follow_up" | "demo",
            event_date: formData.event_date,
            start_time: formData.start_time || null,
            end_time: formData.end_time || null,
            location: formData.location || null,
            notes: formData.notes || null,
          })
          .eq("id", editingEvent.id)) as any;

        if (error) throw error;
      } else {
        if (!user?.id) {
          alert("You must be logged in to create events");
          return;
        }

        const { data: newEvent, error: insertError } = await (supabase
          .from("opportunity_events" as any)
          .insert({
            opportunity_id: opportunityId,
            title: formData.title,
            event_type: formData.event_type as "meeting" | "pitch" | "follow_up" | "demo",
            event_date: formData.event_date,
            start_time: formData.start_time || null,
            end_time: formData.end_time || null,
            location: formData.location || null,
            notes: formData.notes || null,
            created_by: user.id,
          })
          .select()
          .single()) as any;

        if (insertError) throw insertError;

        if (newEvent) {
          const eventTypeLabels = {
            meeting: "Meeting",
            pitch: "Pitch",
            follow_up: "Follow-up",
            demo: "Demo"
          };
          const eventTypeLabel = eventTypeLabels[formData.event_type as keyof typeof eventTypeLabels];
          const timeInfo = formData.start_time ? ` at ${formData.start_time.substring(0, 5)}` : "";
          const locationInfo = formData.location ? ` at ${formData.location}` : "";
          
          const timelineContent = `Scheduled ${eventTypeLabel.toLowerCase()}: ${formData.title}${timeInfo}${locationInfo}`;

          const { error: timelineError } = await (supabase
            .from("opportunity_timeline" as any)
            .insert({
              opportunity_id: opportunityId,
              post_type: "event",
              content: timelineContent,
              event_id: newEvent.id,
              created_by_user_id: user.id,
            })) as any;

          if (timelineError) {
            console.error("Timeline creation failed:", timelineError);
          }
        }
      }

      await fetchEvents();
      setFormOpen(false);
      setEditingEvent(null);
      setFormData({
        title: "",
        event_type: "meeting",
        event_date: "",
        start_time: "",
        end_time: "",
        location: "",
        notes: "",
      });

      window.dispatchEvent(new CustomEvent("opportunity-timeline-refresh"));
    } catch (err) {
      console.error("Failed to save event", err);
      alert("Failed to save event");
    }
  };

  const handleEdit = (event: OpportunityEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      event_type: event.event_type,
      event_date: event.event_date,
      start_time: event.start_time || "",
      end_time: event.end_time || "",
      location: event.location || "",
      notes: event.notes || "",
    });
    setFormOpen(true);
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("Delete this event?")) return;

    try {
      const { error } = await (supabase
        .from("opportunity_events" as any)
        .delete()
        .eq("id", eventId)) as any;

      if (error) throw error;
      await fetchEvents();
    } catch (err) {
      console.error("Failed to delete event", err);
      alert("Failed to delete event");
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return events.filter((e) => e.event_date === dateStr);
  };

  const formatTime = (time: string | null) => {
    if (!time) return "";
    return time.substring(0, 5);
  };

  const getEventColor = (type: "meeting" | "pitch" | "follow_up" | "demo") => {
    const colors = {
      meeting: "bg-blue-500",
      pitch: "bg-purple-500",
      follow_up: "bg-green-500",
      demo: "bg-orange-500"
    };
    return colors[type];
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);

  const previousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const upcomingEvents = events.filter((e) => new Date(e.event_date) >= today).slice(0, 3);

  if (!isDetailView) {
    if (upcomingEvents.length === 0) return null;

    return (
      <div className="pt-2 border-t mt-3">
        <div className="flex items-center gap-2 mb-2">
          <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Upcoming Events</span>
        </div>
        <div className="space-y-1">
          {upcomingEvents.map((event) => (
            <div key={event.id} className="text-xs text-slate-600 flex items-start gap-2">
              <Badge
                className={`${getEventColor(event.event_type)} text-white text-[10px] px-1.5 py-0 flex-shrink-0`}
              >
                {event.event_type}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{event.title}</div>
                <div className="text-slate-500">
                  {new Date(event.event_date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                  {event.start_time && ` • ${formatTime(event.start_time)}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-slate-600" />
          <CardTitle className="text-lg">Events & Meetings</CardTitle>
        </div>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => {
                setEditingEvent(null);
                setFormData({
                  title: "",
                  event_type: "meeting",
                  event_date: "",
                  start_time: "",
                  end_time: "",
                  location: "",
                  notes: "",
                });
              }}
            >
              <Plus className="w-4 h-4" />
              New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-md">
            <DialogHeader>
              <DialogTitle>{editingEvent ? "Edit Event" : "New Event"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Quarterly review meeting"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event_type">Event Type</Label>
                <Select
                  value={formData.event_type}
                  onValueChange={(value) => setFormData({ ...formData, event_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="pitch">Pitch</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="demo">Demo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event_date">Date *</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Office, venue name, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Agenda, preparation notes, etc."
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit">{editingEvent ? "Update" : "Create"}</Button>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-slate-600">Loading events...</div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="sm" onClick={previousMonth}>
                ←
              </Button>
              <h3 className="font-semibold">
                {currentMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
              </h3>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                →
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-7 bg-slate-50 border-b">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="p-2 text-center text-xs font-medium text-slate-600">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-2 border-b border-r bg-slate-50 min-h-[80px]" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNumber = i + 1;
                  const date = new Date(year, month, dayNumber);
                  const dateEvents = getEventsForDate(date);
                  const isToday = date.toDateString() === today.toDateString();
                  const isPast = date < today;

                  return (
                    <div
                      key={dayNumber}
                      className={`p-2 border-b border-r min-h-[80px] relative group hover:bg-slate-50 transition-colors ${
                        isPast ? "bg-slate-50/50" : ""
                      }`}
                    >
                      <div
                        className={`text-sm font-medium mb-1 ${
                          isToday
                            ? "bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center"
                            : isPast
                              ? "text-slate-400"
                              : "text-slate-700"
                        }`}
                      >
                        {dayNumber}
                      </div>

                      <div className="space-y-1">
                        {dateEvents.map((event) => (
                          <div key={event.id} className="relative">
                            <div className="hidden lg:block">
                              <div
                                className={`${getEventColor(event.event_type)} text-white text-[10px] px-1.5 py-0.5 rounded cursor-pointer truncate`}
                              >
                                {event.title}
                              </div>
                              <div className="absolute left-0 top-full mt-1 w-64 bg-white border shadow-lg rounded-lg p-3 z-50 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all pointer-events-none group-hover:pointer-events-auto">
                                <div className="space-y-2">
                                  <div>
                                    <Badge
                                      className={`${getEventColor(event.event_type)} text-white text-xs mb-2`}
                                    >
                                      {event.event_type}
                                    </Badge>
                                    <div className="font-semibold text-sm text-slate-900">{event.title}</div>
                                  </div>
                                  {(event.start_time || event.end_time) && (
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                      <Clock className="w-3 h-3" />
                                      {formatTime(event.start_time)}
                                      {event.end_time && ` - ${formatTime(event.end_time)}`}
                                    </div>
                                  )}
                                  {event.location && (
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                      <MapPin className="w-3 h-3" />
                                      {event.location}
                                    </div>
                                  )}
                                  {event.notes && (
                                    <div className="text-xs text-slate-600 border-t pt-2">{event.notes}</div>
                                  )}
                                  <div className="flex gap-2 border-t pt-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs flex-1"
                                      onClick={() => handleEdit(event)}
                                    >
                                      <Edit className="w-3 h-3 mr-1" />
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs flex-1 text-red-600 hover:text-red-700"
                                      onClick={() => handleDelete(event.id)}
                                    >
                                      <Trash2 className="w-3 h-3 mr-1" />
                                      Delete
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="lg:hidden">
                              <div
                                className={`${getEventColor(event.event_type)} text-white text-[10px] px-1.5 py-0.5 rounded cursor-pointer truncate`}
                                onClick={() => setSelectedEvent(event)}
                              >
                                {event.title}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs pt-4 border-t flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-slate-600">Meeting</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded"></div>
                <span className="text-slate-600">Pitch</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-slate-600">Follow-up</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span className="text-slate-600">Demo</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <Badge className={`${getEventColor(selectedEvent.event_type)} text-white mb-2`}>
                  {selectedEvent.event_type}
                </Badge>
                <div className="font-semibold text-lg text-slate-900">{selectedEvent.title}</div>
                <div className="text-sm text-slate-600 mt-1">
                  {new Date(selectedEvent.event_date).toLocaleDateString("en-GB", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>

              {(selectedEvent.start_time || selectedEvent.end_time) && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="w-4 h-4" />
                  {formatTime(selectedEvent.start_time)}
                  {selectedEvent.end_time && ` - ${formatTime(selectedEvent.end_time)}`}
                </div>
              )}

              {selectedEvent.location && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4" />
                  {selectedEvent.location}
                </div>
              )}

              {selectedEvent.notes && (
                <div className="border-t pt-4">
                  <div className="text-sm font-medium text-slate-500 mb-1">Notes</div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{selectedEvent.notes}</div>
                </div>
              )}

              <div className="flex gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    handleEdit(selectedEvent);
                    setSelectedEvent(null);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-red-600 hover:text-red-700"
                  onClick={() => {
                    handleDelete(selectedEvent.id);
                    setSelectedEvent(null);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}