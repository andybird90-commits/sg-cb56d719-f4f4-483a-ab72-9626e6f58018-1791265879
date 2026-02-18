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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, AlertTriangle, Trash2, Edit, Users, Target, Briefcase, CalendarDays } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { useRouter } from "next/router";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  event_type: "meeting" | "deadline" | "milestone" | "other";
  source: "calendar" | "contact" | "opportunity" | "project";
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

  useEffect(() => {
    fetchAllEvents();
  }, [currentMonth]);

  const fetchAllEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      // Fetch standalone calendar events
      const { data: calendarEvents, error: calendarError } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("event_date", format(monthStart, "yyyy-MM-dd"))
        .lte("event_date", format(monthEnd, "yyyy-MM-dd"))
        .order("event_date")
        .order("start_time");

      if (calendarError) throw calendarError;

      // Fetch contact events
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
        .gte("event_date", format(monthStart, "yyyy-MM-dd"))
        .lte("event_date", format(monthEnd, "yyyy-MM-dd"))
        .order("event_date")
        .order("start_time");

      if (contactError) throw contactError;

      // Fetch opportunity events
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
        .gte("event_date", format(monthStart, "yyyy-MM-dd"))
        .lte("event_date", format(monthEnd, "yyyy-MM-dd"))
        .order("event_date")
        .order("start_time");

      if (opportunityError) throw opportunityError;

      // Fetch project milestones (using project dates)
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id, name, start_date, end_date, status")
        .eq("status", "live");

      if (projectsError) throw projectsError;

      // Combine all events
      const allEvents: CalendarEvent[] = [
        ...(calendarEvents || []).map((event: any) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          event_date: event.event_date,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
          event_type: event.event_type,
          source: "calendar" as const,
          color: "bg-purple-500"
        })),
        ...(contactEvents || []).map((event: any) => ({
          id: event.id,
          title: event.title,
          description: undefined,
          event_date: event.event_date,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
          event_type: event.event_type === "visit" ? "meeting" : "other",
          source: "contact" as const,
          source_id: event.contact_id,
          source_name: `${event.contacts?.name}${event.contacts?.companies?.name ? ` (${event.contacts.companies.name})` : ""}`,
          color: "bg-blue-500"
        })),
        ...(opportunityEvents || []).map((event: any) => ({
          id: event.id,
          title: event.title,
          description: undefined,
          event_date: event.event_date,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
          event_type: event.event_type === "client_meeting" ? "meeting" : event.event_type === "submission" ? "deadline" : "other",
          source: "opportunity" as const,
          source_id: event.opportunity_id,
          source_name: event.opportunities?.name,
          color: "bg-orange-500"
        })),
        ...(projects || []).flatMap((project: any) => {
          const projectEvents: CalendarEvent[] = [];
          
          if (project.start_date && 
              parseISO(project.start_date) >= monthStart && 
              parseISO(project.start_date) <= monthEnd) {
            projectEvents.push({
              id: `project-start-${project.id}`,
              title: `${project.name} - Start`,
              event_date: project.start_date,
              event_type: "milestone",
              source: "project" as const,
              source_id: project.id,
              source_name: project.name,
              color: "bg-green-500"
            });
          }
          
          if (project.end_date && 
              parseISO(project.end_date) >= monthStart && 
              parseISO(project.end_date) <= monthEnd) {
            projectEvents.push({
              id: `project-end-${project.id}`,
              title: `${project.name} - End`,
              event_date: project.end_date,
              event_type: "milestone",
              source: "project" as const,
              source_id: project.id,
              source_name: project.name,
              color: "bg-green-500"
            });
          }
          
          return projectEvents;
        })
      ];

      // Sort by date and time
      allEvents.sort((a, b) => {
        const dateCompare = a.event_date.localeCompare(b.event_date);
        if (dateCompare !== 0) return dateCompare;
        
        const aTime = a.start_time || "00:00";
        const bTime = b.start_time || "00:00";
        return aTime.localeCompare(bTime);
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

  const handleEditEvent = async () => {
    if (!editingEvent || editingEvent.source !== "calendar") return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("calendar_events")
        .update({
          title: editingEvent.title,
          description: editingEvent.description || null,
          event_date: editingEvent.event_date,
          start_time: editingEvent.start_time || null,
          end_time: editingEvent.end_time || null,
          location: editingEvent.location || null,
          event_type: editingEvent.event_type
        })
        .eq("id", editingEvent.id);

      if (error) throw error;

      setIsEditDialogOpen(false);
      setEditingEvent(null);
      fetchAllEvents();
    } catch (err) {
      console.error("Failed to update event:", err);
      alert("Failed to update event");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;

    try {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;

      fetchAllEvents();
    } catch (err) {
      console.error("Failed to delete event:", err);
      alert("Failed to delete event");
    }
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsEditDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.source === "contact" && event.source_id) {
      router.push(`/contacts/${event.source_id}`);
    } else if (event.source === "opportunity" && event.source_id) {
      router.push(`/opportunities/${event.source_id}`);
    } else if (event.source === "project" && event.source_id) {
      router.push(`/projects/${event.source_id}`);
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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

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
      case "project":
        return <Briefcase className="w-3 h-3" />;
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

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-5xl font-bold tracking-tight mb-2">Calendar</h1>
            <p className="text-muted-foreground text-lg">
              All events from projects, opportunities, and contacts
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-professional">
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add Calendar Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="Event title"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Event description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event_date">Date *</Label>
                    <Input
                      id="event_date"
                      type="date"
                      value={newEvent.event_date}
                      onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="event_type">Type</Label>
                    <Select
                      value={newEvent.event_type}
                      onValueChange={(value: any) => setNewEvent({ ...newEvent, event_type: value })}>
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={newEvent.start_time}
                      onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_time">End Time</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={newEvent.end_time}
                      onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    placeholder="Event location"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddEvent} disabled={saving || !newEvent.title.trim()}>
                    {saving ? "Adding..." : "Add Event"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Calendar Navigation */}
        <Card className="card-professional">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={previousMonth} className="btn-professional">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <CardTitle className="text-2xl">
                  {format(currentMonth, "MMMM yyyy")}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={nextMonth} className="btn-professional">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={goToToday} className="btn-professional">
                Today
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading calendar...
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {/* Weekday headers */}
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div
                    key={day}
                    className="bg-muted p-3 text-center text-sm font-semibold text-muted-foreground">
                    {day}
                  </div>
                ))}

                {/* Calendar days */}
                {calendarDays.map((day) => {
                  const dayEvents = getEventsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const isCurrentMonth = isSameMonth(day, currentMonth);

                  return (
                    <div
                      key={day.toISOString()}
                      className={`bg-card p-2 min-h-[120px] ${
                        !isCurrentMonth ? "opacity-40" : ""
                      }`}>
                      <div
                        className={`text-sm font-medium mb-2 ${
                          isToday
                            ? "w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                            : ""
                        }`}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            onClick={() => handleEventClick(event)}
                            className={`${event.color} text-white text-xs p-1.5 rounded cursor-pointer hover:opacity-80 transition-professional`}>
                            <div className="flex items-center gap-1 mb-0.5">
                              {getSourceIcon(event.source)}
                              {event.start_time && (
                                <span className="font-medium">
                                  {event.start_time.substring(0, 5)}
                                </span>
                              )}
                            </div>
                            <div className="truncate font-medium">{event.title}</div>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground pl-1.5">
                            +{dayEvents.length - 3} more
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

        {/* Event List */}
        <Card className="card-professional">
          <CardHeader>
            <CardTitle className="text-xl">
              Events for {format(currentMonth, "MMMM yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading events...</div>
            ) : events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No events this month
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 p-4 border border-border rounded-lg hover:bg-muted/30 transition-professional cursor-pointer"
                    onClick={() => handleEventClick(event)}>
                    <div className={`w-1 h-full rounded-full ${event.color} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-base">{event.title}</h3>
                            <Badge variant="outline" className="text-xs">
                              {getEventTypeLabel(event.event_type)}
                            </Badge>
                          </div>
                          {event.source_name && (
                            <p className="text-sm text-muted-foreground mb-1">
                              {event.source_name}
                            </p>
                          )}
                          {event.description && (
                            <p className="text-sm text-muted-foreground">{event.description}</p>
                          )}
                        </div>
                        {event.source === "calendar" && (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(event);
                              }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEvent(event.id);
                              }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          {format(parseISO(event.event_date), "EEE, MMM d, yyyy")}
                        </div>
                        {event.start_time && (
                          <div>
                            {event.start_time.substring(0, 5)}
                            {event.end_time && ` - ${event.end_time.substring(0, 5)}`}
                          </div>
                        )}
                        {event.location && <div>📍 {event.location}</div>}
                        <div className="flex items-center gap-1">
                          {getSourceIcon(event.source)}
                          <span className="capitalize">{event.source}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        {editingEvent && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Edit Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="edit-title">Title *</Label>
                  <Input
                    id="edit-title"
                    value={editingEvent.title}
                    onChange={(e) =>
                      setEditingEvent({ ...editingEvent, title: e.target.value })
                    }
                    placeholder="Event title"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editingEvent.description || ""}
                    onChange={(e) =>
                      setEditingEvent({ ...editingEvent, description: e.target.value })
                    }
                    placeholder="Event description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-event_date">Date *</Label>
                    <Input
                      id="edit-event_date"
                      type="date"
                      value={editingEvent.event_date}
                      onChange={(e) =>
                        setEditingEvent({ ...editingEvent, event_date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-event_type">Type</Label>
                    <Select
                      value={editingEvent.event_type}
                      onValueChange={(value: any) =>
                        setEditingEvent({ ...editingEvent, event_type: value })
                      }>
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-start_time">Start Time</Label>
                    <Input
                      id="edit-start_time"
                      type="time"
                      value={editingEvent.start_time || ""}
                      onChange={(e) =>
                        setEditingEvent({ ...editingEvent, start_time: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-end_time">End Time</Label>
                    <Input
                      id="edit-end_time"
                      type="time"
                      value={editingEvent.end_time || ""}
                      onChange={(e) =>
                        setEditingEvent({ ...editingEvent, end_time: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-location">Location</Label>
                  <Input
                    id="edit-location"
                    value={editingEvent.location || ""}
                    onChange={(e) =>
                      setEditingEvent({ ...editingEvent, location: e.target.value })
                    }
                    placeholder="Event location"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingEvent(null);
                    }}
                    disabled={saving}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleEditEvent}
                    disabled={saving || !editingEvent.title.trim()}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}

export default function Calendar() {
  return (
    <RequireAuth>
      <CalendarContent />
    </RequireAuth>
  );
}