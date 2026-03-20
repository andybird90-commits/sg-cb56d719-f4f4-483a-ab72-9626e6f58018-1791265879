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
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Timesheet {
  id: string;
  date: string;
  hours: number;
  notes: string | null;
  profiles?: {
    full_name: string;
  };
  projects?: {
    code: string | null;
    project_reference?: string | null;
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
  const [error, setError] = useState<string | null>(null);
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
    try {
      setLoading(true);
      setError(null);

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
            project_reference,
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

      const { data: timesheetsData, error: timesheetsError } = await query;
      if (timesheetsError) throw timesheetsError;

      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");

      if (usersError) throw usersError;

      setTimesheets(timesheetsData || []);
      setUsers(usersData || []);
    } catch (err) {
      console.error("Failed to load team timesheets data", err);
      setError("Failed to load team timesheets. Please try again.");
    } finally {
      setLoading(false);
    }
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

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Team Timesheets</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">View team time entries</p>
        </div>

        <Card>
          <CardHeader>
            <div className="space-y-3">
              <CardTitle className="text-base sm:text-lg">
                Week of {currentWeekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </CardTitle>
              
              {/* Controls - Stack on mobile */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
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
                  <Button variant="outline" size="sm" onClick={thisWeek} className="text-xs sm:text-sm whitespace-nowrap">
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
            {loading ? (
              <div className="text-center py-8 text-slate-600 text-sm">
                Loading team timesheets...
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button 
                  onClick={fetchData} 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            ) : timesheets.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-sm">
                No time entries for this period.
              </div>
            ) : (
              <div className="space-y-3">
                {timesheets.map((ts) => (
                  <div key={ts.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                          <div className="font-medium text-sm sm:text-base text-slate-900">
                            {ts.profiles?.full_name}
                          </div>
                          <div className="text-xs sm:text-sm text-slate-500">
                            {new Date(ts.date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </div>
                        <div className="text-sm text-slate-700 mb-1">
                          {(() => {
                            const rawRef = (ts.projects?.code ?? ts.projects?.project_reference ?? "").trim();
                            const ref = rawRef && rawRef !== "-" ? rawRef : "";
                            const name = ts.projects?.name || "—";
                            return ref ? `${ref} — ${name}` : name;
                          })()}
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
                          <div className="text-xs text-slate-600 mt-1 line-clamp-2">
                            {ts.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base sm:text-lg font-semibold text-slate-900">
                          {ts.hours}h
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="pt-4 border-t">
                  <div className="text-right">
                    <div className="text-sm text-slate-600">Total Hours</div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
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