import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Timesheet {
  id: string;
  date: string;
  hours: number;
  notes: string | null;
  profiles?: {
    full_name: string;
  };
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

interface User {
  id: string;
  full_name: string;
}

function TeamTimesheetsContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));

  const canView = profile?.role === "admin" || profile?.role === "director";

  function getWeekStart(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  useEffect(() => {
    if (profile && !canView) {
      router.push("/timesheets/my");
    } else if (canView) {
      fetchData();
    }
  }, [profile, canView, router, selectedUser, currentWeekStart]);

  const fetchData = async () => {
    setLoading(true);

    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    let query = supabase
      .from("timesheets")
      .select(`
        *,
        profiles (
          full_name
        ),
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
      .gte("date", currentWeekStart.toISOString().split("T")[0])
      .lt("date", weekEnd.toISOString().split("T")[0])
      .order("date", { ascending: false });

    if (selectedUser !== "all") {
      query = query.eq("user_id", selectedUser);
    }

    const { data: timesheetsData } = await query;

    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name");

    setTimesheets(timesheetsData || []);
    setUsers(usersData || []);
    setLoading(false);
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

  const getTotalHours = () => {
    return timesheets.reduce((sum, t) => sum + t.hours, 0);
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
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Team Timesheets</h1>
          <p className="text-slate-600 mt-1">View team time entries</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Week of {currentWeekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </CardTitle>
              <div className="flex items-center gap-4">
                <div className="w-64">
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
            </div>
          </CardHeader>
          <CardContent>
            {timesheets.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                No time entries for this period.
              </div>
            ) : (
              <div className="space-y-3">
                {timesheets.map((ts) => (
                  <div key={ts.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="font-medium text-slate-900">
                            {ts.profiles?.full_name}
                          </div>
                          <div className="text-sm text-slate-500">
                            {new Date(ts.date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </div>
                        <div className="text-sm text-slate-700">
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
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-slate-900">
                          {ts.hours}h
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="pt-4 border-t">
                  <div className="text-right">
                    <div className="text-sm text-slate-600">Total Hours</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {getTotalHours()}h
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function TeamTimesheetsPage() {
  return (
    <RequireAuth>
      <TeamTimesheetsContent />
    </RequireAuth>
  );
}