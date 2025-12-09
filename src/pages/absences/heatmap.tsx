import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface User {
  id: string;
  full_name: string;
  annual_holiday_days: number;
}

interface Absence {
  id: string;
  user_id: string;
  type: string;
  start_date: string;
  end_date: string;
  notes: string | null;
}

function AbsenceHeatmapContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [holidayBalances, setHolidayBalances] = useState<Record<string, { taken: number; remaining: number }>>({});

  const canView = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    if (profile && !canView) {
      router.push("/absences/my");
    } else if (canView) {
      fetchData();
    }
  }, [profile, canView, router, selectedYear, selectedMonth]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("id, full_name, annual_holiday_days")
        .eq("is_active", true)
        .order("full_name");

      if (usersError) throw usersError;

      const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth, 0);

      const { data: absencesData, error: absencesError } = await supabase
        .from("absences")
        .select("*")
        .not("approved_by", "is", null)
        .or(`and(start_date.lte.${endOfMonth.toISOString().split("T")[0]},end_date.gte.${startOfMonth.toISOString().split("T")[0]})`);

      if (absencesError) throw absencesError;

      setUsers((usersData as unknown as User[]) || []);
      setAbsences(absencesData || []);

      if (usersData) {
        const balances: Record<string, { taken: number; remaining: number }> = {};
        
        for (const user of usersData) {
          const { data: holidays, error: holidaysError } = await supabase
            .from("absences")
            .select("start_date, end_date")
            .eq("user_id", user.id)
            .eq("type", "holiday")
            .not("approved_by", "is", null)
            .gte("start_date", `${selectedYear}-01-01`)
            .lte("start_date", `${selectedYear}-12-31`);

          if (!holidaysError && holidays) {
            let taken = 0;
            holidays.forEach((holiday) => {
              const start = new Date(holiday.start_date);
              const end = new Date(holiday.end_date);
              const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              taken += days;
            });

            balances[user.id] = {
              taken,
              remaining: (user.annual_holiday_days || 0) - taken,
            };
          }
        }

        setHolidayBalances(balances);
      }
    } catch (err) {
      console.error("Failed to load absence heatmap data", err);
      setError("Failed to load absence heatmap");
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const isAbsenceOnDate = (userId: string, date: Date): Absence | null => {
    const dateStr = date.toISOString().split("T")[0];
    return absences.find((abs) => {
      return abs.user_id === userId && abs.start_date <= dateStr && abs.end_date >= dateStr;
    }) || null;
  };

  const getCellColor = (type: string) => {
    switch (type) {
      case "holiday":
        return "bg-green-500";
      case "sick":
        return "bg-red-500";
      case "other":
        return "bg-orange-500";
      default:
        return "bg-slate-200";
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const prevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const thisMonth = () => {
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth() + 1);
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

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Team Absence Heatmap</h1>
          <p className="text-slate-600 mt-1">Visual overview of team absences</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {new Date(selectedYear, selectedMonth - 1).toLocaleDateString("en-GB", { 
                  month: "long", 
                  year: "numeric" 
                })}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={prevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={thisMonth}>
                  This Month
                </Button>
                <Button variant="outline" size="sm" onClick={nextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border p-2 bg-slate-50 text-left sticky left-0 z-10 min-w-[200px]">
                      Team Member
                    </th>
                    {days.map((day) => (
                      <th key={day} className="border p-1 bg-slate-50 text-center text-xs min-w-[32px]">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="border p-2 bg-white sticky left-0 z-10">
                        <div className="font-medium text-sm text-slate-900">{user.full_name}</div>
                        <div className="text-xs text-slate-500">
                          Holiday: {holidayBalances[user.id]?.remaining || 0} days remaining
                        </div>
                      </td>
                      {days.map((day) => {
                        const date = new Date(selectedYear, selectedMonth - 1, day);
                        const absence = isAbsenceOnDate(user.id, date);
                        
                        return (
                          <td key={day} className="border p-0">
                            {absence ? (
                              <div
                                className={`w-full h-8 ${getCellColor(absence.type)} cursor-pointer hover:opacity-80`}
                                title={`${absence.type}\n${formatDate(absence.start_date)} → ${formatDate(absence.end_date)}${absence.notes ? `\n${absence.notes}` : ""}`}
                              />
                            ) : (
                              <div className="w-full h-8 bg-white" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t">
              <div className="text-sm font-medium text-slate-600 mb-2">Legend:</div>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>Holiday</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>Sick</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-500 rounded"></div>
                  <span>Other</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function AbsenceHeatmapPage() {
  return (
    <RequireAuth>
      <AbsenceHeatmapContent />
    </RequireAuth>
  );
}