import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Trash2, Users, Target, CalendarDays, MapPin } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { useRouter } from "next/router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  type: "meeting" | "visit" | "function";
  event_type: "meeting" | "deadline" | "milestone" | "other";
  source: "calendar" | "contact" | "opportunity";
  source_id?: string;
  source_name?: string;
  color?: string;
}

interface NewEventForm {
  title: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
  event_type: "meeting" | "deadline" | "milestone" | "other";
}

function CalendarContent() {
  const { profile } = useAuth();
  const router = useRouter();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);

  const [newEvent, setNewEvent] = useState<NewEventForm>({
    title: "",
    description: "",
    event_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "",
    end_time: "",
    location: "",
    event_type: "meeting"
  });

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showNewEventDialog, setShowNewEventDialog] = useState(false);
  const [showEditEventDialog, setShowEditEventDialog] = useState(false);
  const [newEventForm, setNewEventForm] = useState({
    title: "",
    description: "",
    event_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "",
    end_time: "",
    location: "",
    event_type: "meeting"
  });
  const [editEventForm, setEditEventForm] = useState({
    title: "",
    type: "meeting" as "meeting" | "visit" | "function",
    event_date: "",
    start_time: "",
    end_time: "",
    description: "",
    location: "",
  });

  useEffect(() => {
    fetchAllEvents();
  }, [currentMonth]);

  const fetchAllEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

      const startDateStr = format(calendarStart, "yyyy-MM-dd");
      const endDateStr = format(calendarEnd, "yyyy-MM-dd");

      const { data: calendarEvents, error: calendarError } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("event_date", startDateStr)
        .lte("event_date", endDateStr)
        .order("event_date")
        .order("start_time");

      if (calendarError) throw calendarError;

      const { data: contactEvents, error: contactError } = await supabase
        .from("contact_events")
        .select(`
          id,
          title,
          event_type,
          event_date,
          start_time,
          end_time,
          location,
          contact_id,
          contacts (
            name,
            companies (
              name
            )
          )
        `)
        .gte("event_date", startDateStr)
        .lte("event_date", endDateStr)
        .order("event_date")
        .order("start_time");

      if (contactError) throw contactError;

      const { data: opportunityEvents, error: opportunityError } = await supabase
        .from("opportunity_events")
        .select(`
          id,
          title,
          event_type,
          event_date,
          start_time,
          end_time,
          location,
          opportunity_id,
          opportunities (
            name
          )
        `)
        .gte("event_date", startDateStr)
        .lte("event_date", endDateStr)
        .order("event_date")
        .order("start_time");

      if (opportunityError) throw opportunityError;

      const allEvents: CalendarEvent[] = [
        ...(contactEvents || []).map((event: any) => ({
          id: event.id,
          title: event.title || "Contact Event",
          description: undefined,
          event_date: event.event_date,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
          type: "meeting" as "meeting" | "visit" | "function",
          event_type: "meeting" as const,
          source: "contact" as const,
          source_id: event.contact_id,
          source_name: `${event.contacts?.name || 'Unknown'}${event.contacts?.companies?.name ? ` (${event.contacts.companies.name})` : ""}`,
          color: "bg-blue-500"
        })),
        ...(opportunityEvents || []).map((event: any) => ({
          id: event.id,
          title: event.title || "Opportunity Event",
          description: undefined,
          event_date: event.event_date,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
          type: "meeting" as "meeting" | "visit" | "function",
          event_type: (event.event_type === "submission" ? "deadline" : "meeting") as "meeting" | "deadline" | "milestone" | "other",
          source: "opportunity" as const,
          source_id: event.opportunity_id,
          source_name: event.opportunities?.name,
          color: "bg-orange-500"
        })),
        ...(calendarEvents || []).map((event: any) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          event_date: event.event_date,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
          type: (event.event_type || "meeting") as "meeting" | "visit" | "function",
          event_type: (event.event_type || "other") as "meeting" | "deadline" | "milestone" | "other",
          source: "calendar" as const,
          source_id: event.id,
          source_name: undefined,
          color: "bg-purple-500"
        }))
      ];

      // Sort events: Latest/Newest first (descending)
      allEvents.sort((a, b) => {
        const dateCompare = b.event_date.localeCompare(a.event_date);
        if (dateCompare !== 0) return dateCompare;
        
        const aTime = a.start_time || "00:00";
        const bTime = b.start_time || "00:00";
        return bTime.localeCompare(aTime);
      });

      setEvents(allEvents);
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
      setError("Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.event_date) {
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("calendar_events")
        .insert({
          title: newEvent.title,
          description: newEvent.description || null,
          event_date: newEvent.event_date,
          start_time: newEvent.start_time || null,
          end_time: newEvent.end_time || null,
          location: newEvent.location || null,
          event_type: newEvent.event_type,
          created_by_user_id: profile?.id
        });

      if (error) throw error;

      setIsAddDialogOpen(false);
      setNewEvent({
        title: "",
        description: "",
        event_date: format(new Date(), "yyyy-MM-dd"),
        start_time: "",
        end_time: "",
        location: "",
        event_type: "meeting"
      });
      fetchAllEvents();
    } catch (err) {
      console.error("Failed to add event:", err);
      alert("Failed to add event");
    } finally {
      setSaving(false);
    }
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEditEventForm({
      title: event.title,
      type: event.type,
      event_date: event.event_date,
      start_time: event.start_time || "",
      end_time: event.end_time || "",
      description: event.description || "",
      location: event.location || "",
    });
    setShowEditEventDialog(true);
  };

  const handleSaveEditedEvent = async () => {
    if (!editingEvent) return;

    try {
      const { error } = await supabase
        .from("calendar_events")
        .update({
          title: editEventForm.title,
          type: editEventForm.type,
          event_date: editEventForm.event_date,
          start_time: editEventForm.start_time || null,
          end_time: editEventForm.end_time || null,
          description: editEventForm.description || null,
          location: editEventForm.location || null,
        })
        .eq("id", editingEvent.id);

      if (error) throw error;

      await fetchAllEvents();
      setShowEditEventDialog(false);
      setEditingEvent(null);
    } catch (err) {
      console.error("Error updating event:", err);
      alert("Failed to update event");
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    if (!confirm("Are you sure you want to delete this event?")) return;

    try {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", editingEvent.id);

      if (error) throw error;

      await fetchAllEvents();
      setShowEditEventDialog(false);
      setEditingEvent(null);
    } catch (err) {
      console.error("Error deleting event:", err);
      alert("Failed to delete event");
    }
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsEditDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.source === "contact" && event.source_id) {
      router.push({
        pathname: `/contacts/${event.source_id}`,
        query: { returnTo: '/calendar' }
      });
    } else if (event.source === "opportunity" && event.source_id) {
      router.push({
        pathname: `/opportunities/${event.source_id}`,
        query: { returnTo: '/calendar' }
      });
    } else if (event.source === "calendar") {
      openEditDialog(event);
    }
  };

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const calendarDays = eachDayOfInterval({ 
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }), 
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }) 
  });

  const getEventsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return events.filter((event) => event.event_date === dayStr);
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "contact":
        return <Users className="w-3 h-3" />;
      case "opportunity":
        return <Target className="w-3 h-3" />;
      default:
        return <CalendarDays className="w-3 h-3" />;
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case "meeting":
        return "Meeting";
      case "deadline":
        return "Deadline";
      case "milestone":
        return "Milestone";
      default:
        return "Event";
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Calendar</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
              <p className="text-muted-foreground">Manage your schedule and events</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={goToToday}>Today</Button>
              <div className="flex items-center border rounded-md">
                <Button variant="ghost" size="icon" onClick={previousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="px-4 font-semibold min-w-[140px] text-center">
                  {format(currentMonth, "MMMM yyyy")}
                </div>
                <Button variant="ghost" size="icon" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Add Event
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Event</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Event Title</Label>
                      <Input
                        id="title"
                        value={newEvent.title}
                        onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                        placeholder="Meeting with..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="type">Type</Label>
                        <Select
                          value={newEvent.event_type}
                          onValueChange={(value: any) => setNewEvent({ ...newEvent, event_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="meeting">Meeting</SelectItem>
                            <SelectItem value="deadline">Deadline</SelectItem>
                            <SelectItem value="milestone">Milestone</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date">Date</Label>
                        <Input
                          id="date"
                          type="date"
                          value={newEvent.event_date}
                          onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start_time">Start Time</Label>
                        <Input
                          id="start_time"
                          type="time"
                          value={newEvent.start_time}
                          onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_time">End Time</Label>
                        <Input
                          id="end_time"
                          type="time"
                          value={newEvent.end_time}
                          onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={newEvent.location}
                        onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                        placeholder="Office, Online, etc."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newEvent.description}
                        onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                        placeholder="Additional details..."
                      />
                    </div>
                    <Button onClick={handleAddEvent} className="w-full" disabled={saving}>
                      {saving ? "Saving..." : "Create Event"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-3 border-none shadow-md overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-7 border-b bg-muted/40">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div key={day} className="p-4 text-center font-semibold text-sm text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 auto-rows-fr bg-card">
                {calendarDays.map((day) => {
                  const dayEvents = getEventsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  
                  return (
                    <div
                      key={day.toString()}
                      className={`min-h-[120px] p-2 border-b border-r transition-colors hover:bg-muted/10 ${
                        !isCurrentMonth ? 'bg-muted/20 text-muted-foreground' : ''
                      } ${isToday(day) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                    >
                      <div className={`text-right mb-2 text-sm font-medium ${isToday(day) ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.map((event) => {
                          const eventKey = `${event.type}-${event.id}`;
                          return (
                            <div
                              key={eventKey}
                              onClick={() => handleEditEvent(event)}
                              className={`text-xs p-1 mb-1 rounded cursor-pointer hover:opacity-80 ${
                                event.type === "visit"
                                  ? "bg-blue-500 text-white"
                                  : event.type === "function"
                                  ? "bg-purple-500 text-white"
                                  : "bg-green-500 text-white"
                              }`}
                            >
                              {event.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-muted-foreground pl-1">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Events for {format(currentMonth, "MMMM yyyy")}
            </h3>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {events.filter(e => isSameMonth(parseISO(e.event_date), currentMonth)).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                  No events this month
                </div>
              ) : (
                events
                  .filter(e => isSameMonth(parseISO(e.event_date), currentMonth))
                  .map((event) => (
                    <Card 
                      key={event.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors border-l-4"
                      style={{ borderLeftColor: event.color?.replace('bg-', '').replace('-500', '') === 'blue' ? '#3b82f6' : event.color?.replace('bg-', '').replace('-500', '') === 'orange' ? '#f97316' : '#a855f7' }}
                      onClick={() => handleEventClick(event)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium text-sm line-clamp-1">{event.title}</h4>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase whitespace-nowrap">
                            {getEventTypeLabel(event.event_type)}
                          </span>
                        </div>
                        {event.source_name && (
                          <div className="text-xs text-muted-foreground mb-2 line-clamp-1">
                            {event.source_name}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {format(parseISO(event.event_date), "EEE, MMM d")}
                          </div>
                          {event.start_time && (
                            <div className="flex items-center gap-1">
                              <span>{event.start_time.substring(0, 5)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 ml-auto">
                            {getSourceIcon(event.source)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
          </div>
        </div>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
            </DialogHeader>
            {editingEvent && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Event Title</Label>
                  <Input
                    id="edit-title"
                    value={editingEvent.title}
                    onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-type">Type</Label>
                    <Select
                      value={editingEvent.event_type}
                      onValueChange={(value: any) => setEditingEvent({ ...editingEvent, event_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="deadline">Deadline</SelectItem>
                        <SelectItem value="milestone">Milestone</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-date">Date</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editingEvent.event_date}
                      onChange={(e) => setEditingEvent({ ...editingEvent, event_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-start_time">Start Time</Label>
                    <Input
                      id="edit-start_time"
                      type="time"
                      value={editingEvent.start_time || ""}
                      onChange={(e) => setEditingEvent({ ...editingEvent, start_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-end_time">End Time</Label>
                    <Input
                      id="edit-end_time"
                      type="time"
                      value={editingEvent.end_time || ""}
                      onChange={(e) => setEditingEvent({ ...editingEvent, end_time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-location">Location</Label>
                  <Input
                    id="edit-location"
                    value={editingEvent.location || ""}
                    onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editingEvent.description || ""}
                    onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  />
                </div>
                <div className="flex justify-between gap-4">
                  <Button variant="destructive" onClick={() => handleDeleteEvent()} type="button">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                  <Button onClick={handleSaveEditedEvent} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Event Dialog */}
        <Dialog open={showEditEventDialog} onOpenChange={setShowEditEventDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Event Title</Label>
                <Input
                  id="edit-title"
                  value={editEventForm.title}
                  onChange={(e) => setEditEventForm({ ...editEventForm, title: e.target.value })}
                  placeholder="Enter event title"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Type</Label>
                  <Select
                    value={editEventForm.type}
                    onValueChange={(value: "meeting" | "visit" | "function") =>
                      setEditEventForm({ ...editEventForm, type: value })
                    }
                  >
                    <SelectTrigger id="edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="visit">Visit</SelectItem>
                      <SelectItem value="function">Function</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-date">Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editEventForm.event_date}
                    onChange={(e) => setEditEventForm({ ...editEventForm, event_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start-time">Start Time</Label>
                  <Input
                    id="edit-start-time"
                    type="time"
                    value={editEventForm.start_time}
                    onChange={(e) => setEditEventForm({ ...editEventForm, start_time: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-end-time">End Time</Label>
                  <Input
                    id="edit-end-time"
                    type="time"
                    value={editEventForm.end_time}
                    onChange={(e) => setEditEventForm({ ...editEventForm, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={editEventForm.location}
                  onChange={(e) => setEditEventForm({ ...editEventForm, location: e.target.value })}
                  placeholder="Enter location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editEventForm.description}
                  onChange={(e) => setEditEventForm({ ...editEventForm, description: e.target.value })}
                  placeholder="Enter description"
                  rows={3}
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteEvent}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
                <Button type="button" onClick={handleSaveEditedEvent}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default function CalendarPage() {
  return (
    <RequireAuth>
      <CalendarContent />
    </RequireAuth>
  );
}