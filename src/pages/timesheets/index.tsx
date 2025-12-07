import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase, Timesheet, Project, ProjectActivity, Variation, Profile } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, User } from "lucide-react";

export default function TimesheetsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  // View state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"my" | "team">("my");

  // Form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    project_id: "",
    activity_id: "",
    variation_id: "",
    hours: "",
    notes: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    } else if (user) {
      setSelectedUserId(user.id);
      fetchInitialData();
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (selectedUserId) {
      fetchTimesheets();
    }
  }, [selectedUserId, currentDate, viewMode]);

  useEffect(() => {
    if (formData.project_id) {
      fetchProjectDetails(formData.project_id);
    }
  }, [formData.project_id]);

  const fetchInitialData = async () => {
    // Fetch projects
    const { data: projectsData } = await supabase
      .from("projects")
      .select("*")
      .in("status", ["live", "pipeline"])
      .order("name");
    
    if (projectsData) setProjects(projectsData);

    // Fetch profiles for admin view
    if (profile?.role === "admin" || profile?.role === "director") {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .order("full_name");
      
      if (profilesData) setProfiles(profilesData);
    }
  };

  const fetchProjectDetails = async (projectId: string) => {
    const { data: actData } = await supabase
      .from("project_activities")
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "in_progress");
    
    if (actData) setActivities(actData);

    const { data: varData } = await supabase
      .from("variations")
      .select("*")
      .eq("project_id", projectId)
      .neq("status", "rejected");
    
    if (varData) setVariations(varData);
  };

  const fetchTimesheets = async () => {
    setLoading(true);
    
    // Calculate start and end of week
    const curr = new Date(currentDate);
    const first = curr.getDate() - curr.getDay() + 1; // Monday
    const last = first + 6; // Sunday
    
    const startOfWeek = new Date(curr.setDate(first)).toISOString().split('T')[0];
    const endOfWeek = new Date(curr.setDate(last)).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from("timesheets")
      .select(`
        *,
        projects (code, name),
        project_activities (name),
        variations (code)
      `)
      .eq("user_id", selectedUserId)
      .gte("date", startOfWeek)
      .lte("date", endOfWeek)
      .order("date");

    if (!error && data) {
      setTimesheets(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from("timesheets").insert({
      user_id: user.id,
      date: formData.date,
      project_id: formData.project_id,
      activity_id: formData.activity_id || null,
      variation_id: formData.variation_id || null,
      hours: parseFloat(formData.hours),
      notes: formData.notes || null,
    });

    if (!error) {
      setIsDialogOpen(false);
      fetchTimesheets();
      // Reset form but keep date
      setFormData({
        ...formData,
        project_id: "",
        activity_id: "",
        variation_id: "",
        hours: "",
        notes: "",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this timesheet entry?")) return;
    
    const { error } = await supabase
      .from("timesheets")
      .delete()
      .eq("id", id);

    if (!error) {
      fetchTimesheets();
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const getWeekRange = () => {
    const curr = new Date(currentDate);
    const first = curr.getDate() - curr.getDay() + 1;
    const last = first + 6;
    
    const start = new Date(curr.setDate(first));
    const end = new Date(curr.setDate(last));
    
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  };

  const getDayTotal = (dateStr: string) => {
    return timesheets
      .filter(t => t.date === dateStr)
      .reduce((sum, t) => sum + Number(t.hours), 0);
  };

  const getWeekTotal = () => {
    return timesheets.reduce((sum, t) => sum + Number(t.hours), 0);
  };

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const curr = new Date(currentDate);
    const first = curr.getDate() - curr.getDay() + 1;
    const day = new Date(curr.setDate(first + i));
    return {
      date: day,
      dateStr: day.toISOString().split('T')[0],
      dayName: day.toLocaleDateString('en-US', { weekday: 'short' })
    };
  });

  const isAdmin = profile?.role === "admin" || profile?.role === "director";

  if (authLoading) return <Layout>Loading...</Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Timesheets</h1>
            <p className="text-slate-600 mt-1">Track time against projects and activities</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Log Time
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Time Entry</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Select
                      value={formData.project_id}
                      onValueChange={v => setFormData({...formData, project_id: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.project_id && (
                    <>
                      <div className="space-y-2">
                        <Label>Activity (Optional)</Label>
                        <Select
                          value={formData.activity_id}
                          onValueChange={v => setFormData({...formData, activity_id: v})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Activity" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {activities.map(a => (
                              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Variation (Optional)</Label>
                        <Select
                          value={formData.variation_id}
                          onValueChange={v => setFormData({...formData, variation_id: v})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Variation" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {variations.map(v => (
                              <SelectItem key={v.id} value={v.id}>{v.code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>Hours</Label>
                    <Input
                      type="number"
                      step="0.25"
                      value={formData.hours}
                      onChange={e => setFormData({...formData, hours: e.target.value})}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>

                  <Button type="submit" className="w-full">Save Entry</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters and Navigation */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">{getWeekRange()}</span>
                </div>
                <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  <Select
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select User" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md">
                <span className="text-sm text-slate-600">Total Hours:</span>
                <span className="font-bold text-slate-900">{getWeekTotal()}h</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly View */}
        <div className="space-y-6">
          {weekDates.map(({ date, dateStr, dayName }) => {
            const dayEntries = timesheets.filter(t => t.date === dateStr);
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            
            return (
              <Card key={dateStr} className={isToday ? "border-blue-200 bg-blue-50/30" : ""}>
                <CardHeader className="py-3 px-4 border-b bg-slate-50/50 flex flex-row justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center bg-white border rounded p-1 w-12 text-center">
                      <span className="text-xs uppercase text-slate-500 font-bold">{dayName}</span>
                      <span className="text-lg font-bold text-slate-900">{date.getDate()}</span>
                    </div>
                    <span className="text-sm text-slate-500">
                      {date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="font-medium text-slate-600">
                    {getDayTotal(dateStr)}h
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {dayEntries.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-400">
                      No entries logged
                    </div>
                  ) : (
                    <Table>
                      <TableBody>
                        {dayEntries.map((entry: any) => (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium w-[20%]">
                              {entry.projects?.code}
                              <div className="text-xs text-slate-500">{entry.projects?.name}</div>
                            </TableCell>
                            <TableCell className="w-[25%]">
                              {entry.project_activities?.name || "—"}
                              {entry.variations && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  VAR: {entry.variations.code}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="w-[35%] text-slate-600">
                              {entry.notes}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {entry.hours}h
                            </TableCell>
                            <TableCell className="w-[50px]">
                              {entry.user_id === user?.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                                  onClick={() => handleDelete(entry.id)}
                                >
                                  &times;
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}