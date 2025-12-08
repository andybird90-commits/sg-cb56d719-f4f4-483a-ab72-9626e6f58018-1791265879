import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

interface Timesheet {
  id: string;
  date: string;
  hours: number;
  notes: string | null;
  projects?: {
    code: string;
    name: string;
  };
  project_activities?: {
    name: string;
  };
  variations?: {
    code: string;
  };
}

interface Project {
  id: string;
  code: string;
  name: string;
}

interface Activity {
  id: string;
  name: string;
}

interface Variation {
  id: string;
  code: string;
}

function MyTimesheetsContent() {
  const { user } = useAuth();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingTimesheet, setEditingTimesheet] = useState<Timesheet | null>(null);
  const [formData, setFormData] = useState({
    date: "",
    project_id: "",
    activity_id: "",
    variation_id: "",
    hours: "",
    notes: "",
  });

  function getWeekStart(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  function getWeekDates(start: Date) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  }

  const weekDates = getWeekDates(currentWeekStart);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, currentWeekStart]);

  useEffect(() => {
    if (formData.project_id) {
      fetchProjectDetails(formData.project_id);
    }
  }, [formData.project_id]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const { data: timesheetsData } = await supabase
      .from("timesheets")
      .select(`
        *,
        projects (
          code,
          name
        ),
        project_activities (
          name
        ),
        variations (
          code
        )
      `)
      .eq("user_id", user.id)
      .gte("date", currentWeekStart.toISOString().split("T")[0])
      .lt("date", weekEnd.toISOString().split("T")[0])
      .order("date", { ascending: true });

    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, code, name")
      .in("status", ["live", "pipeline"])
      .order("code");

    setTimesheets(timesheetsData || []);
    setProjects(projectsData || []);
    setLoading(false);
  };

  const fetchProjectDetails = async (projectId: string) => {
    const { data: activitiesData } = await supabase
      .from("project_activities")
      .select("id, name")
      .eq("project_id", projectId)
      .order("name");

    const { data: variationsData } = await supabase
      .from("variations")
      .select("id, code")
      .eq("project_id", projectId)
      .order("code");

    setActivities(activitiesData || []);
    setVariations(variationsData || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (editingTimesheet) {
      const { error } = await supabase
        .from("timesheets")
        .update({
          date: formData.date,
          project_id: formData.project_id,
          activity_id: formData.activity_id || null,
          variation_id: formData.variation_id || null,
          hours: parseFloat(formData.hours),
          notes: formData.notes || null,
        })
        .eq("id", editingTimesheet.id);

      if (error) {
        alert("Error updating timesheet");
        return;
      }
    } else {
      const { error } = await supabase
        .from("timesheets")
        .insert({
          user_id: user.id,
          date: formData.date,
          project_id: formData.project_id,
          activity_id: formData.activity_id || null,
          variation_id: formData.variation_id || null,
          hours: parseFloat(formData.hours),
          notes: formData.notes || null,
        });

      if (error) {
        alert("Error creating timesheet");
        return;
      }
    }

    await fetchData();
    setFormOpen(false);
    setEditingTimesheet(null);
    setFormData({
      date: "",
      project_id: "",
      activity_id: "",
      variation_id: "",
      hours: "",
      notes: "",
    });
  };

  const handleEdit = (timesheet: Timesheet) => {
    setEditingTimesheet(timesheet);
    setFormData({
      date: timesheet.date,
      project_id: timesheet.projects ? timesheet.projects.code : "",
      activity_id: "",
      variation_id: "",
      hours: timesheet.hours.toString(),
      notes: timesheet.notes || "",
    });
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this timesheet entry?")) return;

    const { error } = await supabase
      .from("timesheets")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Error deleting timesheet");
      return;
    }

    await fetchData();
  };

  const getTimesheetsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return timesheets.filter((t) => t.date === dateStr);
  };

  const getTotalHoursForDate = (date: Date) => {
    return getTimesheetsForDate(date).reduce((sum, t) => sum + t.hours, 0);
  };

  const getTotalHoursForWeek = () => {
    return timesheets.reduce((sum, t) => sum + t.hours, 0);
  };

  const prevWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const nextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const thisWeek = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Timesheets</h1>
            <p className="text-slate-600 mt-1">Track your project time</p>
          </div>
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => {
                setEditingTimesheet(null);
                setFormData({
                  date: new Date().toISOString().split("T")[0],
                  project_id: "",
                  activity_id: "",
                  variation_id: "",
                  hours: "",
                  notes: "",
                });
              }}>
                <Plus className="w-4 h-4" />
                Log Time
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTimesheet ? "Edit Time Entry" : "Log Time"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project_id">Project *</Label>
                  <Select
                    value={formData.project_id}
                    onValueChange={(value) => setFormData({ ...formData, project_id: value, activity_id: "", variation_id: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.project_id && activities.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="activity_id">Activity (Optional)</Label>
                    <Select
                      value={formData.activity_id}
                      onValueChange={(value) => setFormData({ ...formData, activity_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {activities.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.project_id && variations.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="variation_id">Variation (Optional)</Label>
                    <Select
                      value={formData.variation_id}
                      onValueChange={(value) => setFormData({ ...formData, variation_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {variations.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="hours">Hours *</Label>
                  <Input
                    id="hours"
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={formData.hours}
                    onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit">{editingTimesheet ? "Update" : "Log Time"}</Button>
                  <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Week of {currentWeekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={prevWeek}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={thisWeek}>
                  This Week
                </Button>
                <Button variant="outline" size="sm" onClick={nextWeek}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {weekDates.map((date) => {
                const dayTimesheets = getTimesheetsForDate(date);
                const totalHours = getTotalHoursForDate(date);

                return (
                  <div key={date.toISOString()} className="border-b pb-4 last:border-b-0">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium text-slate-900">
                          {date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                        </div>
                        {totalHours > 0 && (
                          <div className="text-sm text-slate-500">
                            Total: {totalHours}h
                          </div>
                        )}
                      </div>
                    </div>

                    {dayTimesheets.length === 0 ? (
                      <div className="text-sm text-slate-400 italic">No time logged</div>
                    ) : (
                      <div className="space-y-2">
                        {dayTimesheets.map((ts) => (
                          <div key={ts.id} className="flex items-start justify-between p-3 bg-slate-50 rounded">
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {ts.projects?.code} - {ts.projects?.name}
                              </div>
                              {ts.project_activities && (
                                <div className="text-xs text-slate-600">
                                  Activity: {ts.project_activities.name}
                                </div>
                              )}
                              {ts.variations && (
                                <div className="text-xs text-slate-600">
                                  Variation: {ts.variations.code}
                                </div>
                              )}
                              {ts.notes && (
                                <div className="text-xs text-slate-600 mt-1">
                                  {ts.notes}
                                </div>
                              )}
                              <div className="text-sm font-semibold text-slate-900 mt-1">
                                {ts.hours}h
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(ts)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(ts.id)}>
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="pt-4 border-t">
                <div className="text-right">
                  <div className="text-sm text-slate-600">Week Total</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {getTotalHoursForWeek()}h
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function MyTimesheetsPage() {
  return (
    <RequireAuth>
      <MyTimesheetsContent />
    </RequireAuth>
  );
}