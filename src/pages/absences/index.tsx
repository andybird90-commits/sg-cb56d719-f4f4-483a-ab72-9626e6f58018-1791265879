import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase, Absence, Profile } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Check, X, Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface AbsenceWithProfile extends Absence {
  profile?: Profile;
  approver?: Profile;
}

export default function AbsencesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [myAbsences, setMyAbsences] = useState<AbsenceWithProfile[]>([]);
  const [teamAbsences, setTeamAbsences] = useState<AbsenceWithProfile[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [formData, setFormData] = useState({
    type: "holiday" as "holiday" | "sick" | "other",
    start_date: "",
    end_date: "",
    notes: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    } else if (user) {
      fetchData();
    }
  }, [user, authLoading, router]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch my absences
    const { data: myData } = await supabase
      .from("absences")
      .select(`
        *,
        profiles!absences_approved_by_fkey (
          id,
          full_name
        )
      `)
      .eq("user_id", user!.id)
      .order("start_date", { ascending: false });

    if (myData) {
      setMyAbsences(myData.map((a: any) => ({
        ...a,
        approver: a.profiles,
        profiles: undefined,
      })));
    }

    // Fetch all profiles and team absences if admin
    if (profile?.role === "admin" || profile?.role === "director") {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .order("full_name");

      if (profilesData) setProfiles(profilesData);

      const { data: teamData } = await supabase
        .from("absences")
        .select(`
          *,
          profiles!absences_user_id_fkey (
            id,
            full_name
          )
        `)
        .order("start_date", { ascending: false });

      if (teamData) {
        setTeamAbsences(teamData.map((a: any) => ({
          ...a,
          profile: a.profiles,
          profiles: undefined,
        })));
      }
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from("absences").insert({
      user_id: user.id,
      type: formData.type,
      start_date: formData.start_date,
      end_date: formData.end_date,
      notes: formData.notes || null,
    });

    if (!error) {
      setIsDialogOpen(false);
      fetchData();
      setFormData({
        type: "holiday",
        start_date: "",
        end_date: "",
        notes: "",
      });
    }
  };

  const handleApprove = async (absenceId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("absences")
      .update({ approved_by: user.id })
      .eq("id", absenceId);

    if (!error) {
      fetchData();
    }
  };

  const handleReject = async (absenceId: string) => {
    if (!confirm("Are you sure you want to reject this absence request?")) return;

    const { error } = await supabase
      .from("absences")
      .delete()
      .eq("id", absenceId);

    if (!error) {
      fetchData();
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "holiday":
        return "bg-blue-100 text-blue-800";
      case "sick":
        return "bg-red-100 text-red-800";
      case "other":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getStatusBadge = (absence: AbsenceWithProfile) => {
    if (absence.approved_by) {
      return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
  };

  // Calendar functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    setCurrentMonth(newDate);
  };

  const getAbsencesForUserAndDate = (userId: string, date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return teamAbsences.filter(
      (a) =>
        a.user_id === userId &&
        a.start_date <= dateStr &&
        a.end_date >= dateStr &&
        a.approved_by
    );
  };

  const isAdmin = profile?.role === "admin" || profile?.role === "director";

  if (authLoading || loading) {
    return <Layout>Loading...</Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Absences</h1>
            <p className="text-slate-600 mt-1">Manage time off and team availability</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Request Absence
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Time Off</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: "holiday" | "sick" | "other") =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="holiday">Holiday</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, end_date: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Optional notes"
                  />
                </div>

                <Button type="submit" className="w-full">
                  Submit Request
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="my-absences">
          <TabsList>
            <TabsTrigger value="my-absences">My Absences</TabsTrigger>
            {isAdmin && <TabsTrigger value="team-calendar">Team Calendar</TabsTrigger>}
            {isAdmin && <TabsTrigger value="pending">Pending Approvals</TabsTrigger>}
          </TabsList>

          {/* My Absences Tab */}
          <TabsContent value="my-absences">
            <Card>
              <CardHeader>
                <CardTitle>My Time Off</CardTitle>
              </CardHeader>
              <CardContent>
                {myAbsences.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No absences recorded
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myAbsences.map((absence) => (
                        <TableRow key={absence.id}>
                          <TableCell>
                            <Badge className={getTypeColor(absence.type)}>
                              {absence.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(absence.start_date)}</TableCell>
                          <TableCell>{formatDate(absence.end_date)}</TableCell>
                          <TableCell>{getStatusBadge(absence)}</TableCell>
                          <TableCell>{absence.notes || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Calendar Tab */}
          {isAdmin && (
            <TabsContent value="team-calendar">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Team Calendar</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigateMonth("prev")}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2 min-w-[150px] justify-center">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span className="font-medium">
                        {currentMonth.toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigateMonth("next")}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="border p-2 bg-slate-50 text-left w-32">Team Member</th>
                          {Array.from({ length: getDaysInMonth(currentMonth) }, (_, i) => i + 1).map(
                            (day) => (
                              <th
                                key={day}
                                className="border p-1 bg-slate-50 text-center text-xs w-8"
                              >
                                {day}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {profiles.map((prof) => (
                          <tr key={prof.id}>
                            <td className="border p-2 font-medium text-sm">
                              {prof.full_name}
                            </td>
                            {Array.from(
                              { length: getDaysInMonth(currentMonth) },
                              (_, i) => i + 1
                            ).map((day) => {
                              const date = new Date(
                                currentMonth.getFullYear(),
                                currentMonth.getMonth(),
                                day
                              );
                              const absences = getAbsencesForUserAndDate(prof.id, date);
                              const absence = absences[0];

                              return (
                                <td
                                  key={day}
                                  className={`border p-0 text-center ${
                                    absence
                                      ? absence.type === "holiday"
                                        ? "bg-blue-200"
                                        : absence.type === "sick"
                                        ? "bg-red-200"
                                        : "bg-slate-200"
                                      : ""
                                  }`}
                                  title={
                                    absence
                                      ? `${absence.type} - ${formatDate(
                                          absence.start_date
                                        )} to ${formatDate(absence.end_date)}`
                                      : ""
                                  }
                                >
                                  {absence && (
                                    <div className="text-xs">
                                      {absence.type === "holiday"
                                        ? "H"
                                        : absence.type === "sick"
                                        ? "S"
                                        : "O"}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-200 border"></div>
                      <span>Holiday</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-200 border"></div>
                      <span>Sick</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-slate-200 border"></div>
                      <span>Other</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Pending Approvals Tab */}
          {isAdmin && (
            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Approvals</CardTitle>
                </CardHeader>
                <CardContent>
                  {teamAbsences.filter((a) => !a.approved_by).length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      No pending requests
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Team Member</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>End Date</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamAbsences
                          .filter((a) => !a.approved_by)
                          .map((absence) => (
                            <TableRow key={absence.id}>
                              <TableCell className="font-medium">
                                {absence.profile?.full_name || "Unknown"}
                              </TableCell>
                              <TableCell>
                                <Badge className={getTypeColor(absence.type)}>
                                  {absence.type}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDate(absence.start_date)}</TableCell>
                              <TableCell>{formatDate(absence.end_date)}</TableCell>
                              <TableCell>{absence.notes || "—"}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => handleApprove(absence.id)}
                                  >
                                    <Check className="w-4 h-4 text-green-600" />
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => handleReject(absence.id)}
                                  >
                                    <X className="w-4 h-4 text-red-600" />
                                    Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}