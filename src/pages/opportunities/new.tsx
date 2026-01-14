import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Company {
  id: string;
  name: string;
}

interface Contact {
  id: string;
  name: string;
}

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

type UiStage = "lead" | "bid" | "high_potential" | "secured" | "lost";
type DbStage = "secured" | "high_potential" | "bid";

async function generateNextOpportunityReferenceForCurrentYear(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const yearSuffix = year.toString().slice(-2);

  const { data, error } = await supabase
    .from("opportunities")
    .select("project_reference")
    .ilike("project_reference", `${yearSuffix}-%`) as any;

  if (error || !data) {
    return `${yearSuffix}-001`;
  }

  const usedNumbers = data
    .map((row: any) => row.project_reference)
    .filter((ref: any): ref is string => !!ref)
    .filter((ref) => ref.startsWith(`${yearSuffix}-`))
    .map((ref) => {
      const parts = ref.split("-");
      const num = Number(parts[1]);
      return Number.isFinite(num) ? num : null;
    })
    .filter((num): num is number => num !== null);

  if (usedNumbers.length === 0) {
    return `${yearSuffix}-001`;
  }

  const maxNumber = Math.max(...usedNumbers);
  const nextNumber = String(maxNumber + 1).padStart(3, "0");
  return `${yearSuffix}-${nextNumber}`;
}

function NewOpportunityContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    company_id: "",
    contact_id: "",
    stage: "lead" as UiStage,
    expected_fee_value: "",
    tender_due_date: "",
    tender_received_date: "",
    submitted_date: "",
    expected_start_date: "",
    expected_end_date: "",
    probability_percent: 10,
    project_reference: "",
    description: "",
    key_contacts: [] as string[],
    added_by_user_id: "",
  });

  const mapStageToDb = (s: UiStage): DbStage => {
    if (s === "secured") return "secured";
    if (s === "high_potential") return "high_potential";
    return "bid";
  };

  useEffect(() => {
    if (profile && profile.role !== "admin" && profile.role !== "director") {
      router.push("/opportunities");
    }
    fetchCompanies();
    fetchUsers();
  }, [profile, router]);

  useEffect(() => {
    if (formData.company_id) {
      fetchContacts(formData.company_id);
    } else {
      setContacts([]);
      setFormData((prev) => ({ ...prev, contact_id: "" }));
    }
  }, [formData.company_id]);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .order("name");
    if (data) setCompanies(data);
  };

  const fetchContacts = async (companyId: string) => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name");
    if (data) setContacts(data);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name");
    if (data) setUsers(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const {
      name,
      company_id,
      contact_id,
      stage,
      expected_fee_value,
      tender_due_date,
      tender_received_date,
      submitted_date,
      expected_start_date,
      expected_end_date,
      project_reference,
      description,
      probability_percent,
    } = formData;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in to create an opportunity.");
      return;
    }

    if (!name || !company_id || !stage) {
      setError("Please fill in all required fields (Name, Company, Stage)");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      let finalProjectReference = project_reference.trim();
      if (!finalProjectReference) {
        finalProjectReference = await generateNextOpportunityReferenceForCurrentYear();
      }

      const dbStage = mapStageToDb(stage as UiStage);

      const payload = {
        name,
        company_id,
        contact_id: contact_id || null,
        description: description || null,
        stage: dbStage,
        status: "open" as const,
        expected_fee_value: expected_fee_value ? parseFloat(expected_fee_value) : null,
        tender_due_date: tender_due_date || null,
        tender_received_date: tender_received_date || null,
        submitted_date: submitted_date || null,
        expected_start_date: expected_start_date || null,
        expected_end_date: expected_end_date || null,
        probability_percent,
        project_reference: finalProjectReference || null,
      };

      const { data, error } = await supabase
        .from("opportunities")
        .insert(payload)
        .select()
        .single();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      router.push("/opportunities");
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Link href="/opportunities">
            <Button variant="ghost" size="sm" className="gap-2 self-start">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Add New Opportunity</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">Create a new business opportunity</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Opportunity Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm sm:text-base">Opportunity Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="h-10 sm:h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_id" className="text-sm sm:text-base">Client Company *</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, company_id: value, contact_id: "" })
                  }
                >
                  <SelectTrigger className="h-10 sm:h-11">
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.company_id && contacts.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="contact_id" className="text-sm sm:text-base">Contact (optional)</Label>
                  <Select
                    value={formData.contact_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, contact_id: value })
                    }
                  >
                    <SelectTrigger className="h-10 sm:h-11">
                      <SelectValue placeholder="Select a contact (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    You can leave this blank if there is no main contact yet.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm sm:text-base">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="text-sm sm:text-base"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stage">Stage *</Label>
                  <Select
                    value={formData.stage}
                    onValueChange={(value) => {
                      const stageValue = value as "lead" | "bid" | "high_potential" | "secured" | "lost";
                      const probability = 
                        stageValue === "lead" ? 10 :
                        stageValue === "bid" ? 25 :
                        stageValue === "high_potential" ? 50 :
                        stageValue === "secured" ? 100 :
                        stageValue === "lost" ? 0 : 10;
                      
                      setFormData({ ...formData, stage: stageValue, probability_percent: probability });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="bid">Bid</SelectItem>
                      <SelectItem value="high_potential">High Potential</SelectItem>
                      <SelectItem value="secured">Secured</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected_fee_value" className="text-sm sm:text-base">Expected Fee Value (£)</Label>
                <Input
                  id="expected_fee_value"
                  type="number"
                  step="0.01"
                  value={formData.expected_fee_value}
                  onChange={(e) => setFormData({ ...formData, expected_fee_value: e.target.value })}
                  className="h-10 sm:h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Probability (%)</Label>
                <div className="h-10 sm:h-11 flex items-center px-3 border rounded-md bg-slate-50 text-slate-500">
                  {formData.probability_percent}% (Auto-set by stage)
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="added_by_user_id" className="text-sm sm:text-base">Added by</Label>
                <Select
                  value={formData.added_by_user_id}
                  onValueChange={(value) => setFormData({ ...formData, added_by_user_id: value })}
                >
                  <SelectTrigger className="h-10 sm:h-11">
                    <SelectValue placeholder="Select user (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tender_due_date">Tender Due Date</Label>
                  <Input
                    id="tender_due_date"
                    type="date"
                    value={formData.tender_due_date}
                    onChange={(e) => setFormData({ ...formData, tender_due_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tender_received_date">Tender Received</Label>
                  <Input
                    id="tender_received_date"
                    type="date"
                    value={formData.tender_received_date}
                    onChange={(e) => setFormData({ ...formData, tender_received_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expected_start_date" className="text-sm sm:text-base">Expected Start Date</Label>
                  <Input
                    id="expected_start_date"
                    type="date"
                    value={formData.expected_start_date}
                    onChange={(e) => setFormData({ ...formData, expected_start_date: e.target.value })}
                    className="h-10 sm:h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expected_end_date" className="text-sm sm:text-base">Expected End Date</Label>
                  <Input
                    id="expected_end_date"
                    type="date"
                    value={formData.expected_end_date}
                    onChange={(e) => setFormData({ ...formData, expected_end_date: e.target.value })}
                    className="h-10 sm:h-11"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="submit" disabled={loading} className="h-10 sm:h-11">
                  {loading ? "Creating..." : "Create Opportunity"}
                </Button>
                <Link href="/opportunities" className="w-full sm:w-auto">
                  <Button type="button" variant="outline" className="w-full h-10 sm:h-11">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function NewOpportunityPage() {
  return (
    <RequireAuth>
      <NewOpportunityContent />
    </RequireAuth>
  );
}