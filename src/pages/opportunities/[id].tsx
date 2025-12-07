import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase, Opportunity, Company, Contact, Project } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Edit, Calendar, DollarSign, Building2, User, Briefcase, ArrowRight } from "lucide-react";
import Link from "next/link";

interface OpportunityWithRelations extends Opportunity {
  company?: Company;
  contact?: Contact;
  linked_project?: Project;
}

export default function OpportunityDetailPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [opportunity, setOpportunity] = useState<OpportunityWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  const [editFormData, setEditFormData] = useState({
    company_id: "",
    contact_id: "",
    name: "",
    description: "",
    stage: "bid" as "secured" | "high_potential" | "bid",
    status: "open" as "open" | "closed_won" | "closed_lost",
    tender_due_date: "",
    expected_start_date: "",
    expected_end_date: "",
    expected_fee_value: "",
    probability_percent: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (id && typeof id === "string" && user) {
      fetchOpportunityData(id);
      fetchCompanies();
    }
  }, [id, user]);

  useEffect(() => {
    if (editFormData.company_id) {
      fetchContacts(editFormData.company_id);
    }
  }, [editFormData.company_id]);

  const fetchOpportunityData = async (oppId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("opportunities")
      .select(`
        *,
        companies!opportunities_company_id_fkey (
          id,
          name,
          short_name,
          status
        ),
        contacts!opportunities_contact_id_fkey (
          id,
          name,
          email,
          phone
        ),
        projects!opportunities_linked_project_id_fkey (
          id,
          code,
          name,
          status
        )
      `)
      .eq("id", oppId)
      .single();

    if (error || !data) {
      setError("Opportunity not found");
      setLoading(false);
      return;
    }

    const formatted = {
      ...data,
      company: data.companies,
      contact: data.contacts,
      linked_project: data.projects,
      companies: undefined,
      contacts: undefined,
      projects: undefined,
    };

    setOpportunity(formatted);
    setEditFormData({
      company_id: data.company_id,
      contact_id: data.contact_id || "",
      name: data.name,
      description: data.description || "",
      stage: data.stage,
      status: data.status,
      tender_due_date: data.tender_due_date || "",
      expected_start_date: data.expected_start_date || "",
      expected_end_date: data.expected_end_date || "",
      expected_fee_value: data.expected_fee_value?.toString() || "",
      probability_percent: data.probability_percent?.toString() || "",
    });

    setLoading(false);
  };

  const fetchCompanies = async () => {
    const { data } = await supabase.from("companies").select("*").order("name");
    if (data) setCompanies(data);
  };

  const fetchContacts = async (companyId: string) => {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("company_id", companyId)
      .order("name");
    if (data) setContacts(data);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof id !== "string") return;
    
    setError("");

    const { error: updateError } = await supabase
      .from("opportunities")
      .update({
        company_id: editFormData.company_id,
        contact_id: editFormData.contact_id || null,
        name: editFormData.name,
        description: editFormData.description || null,
        stage: editFormData.stage,
        status: editFormData.status,
        tender_due_date: editFormData.tender_due_date || null,
        expected_start_date: editFormData.expected_start_date || null,
        expected_end_date: editFormData.expected_end_date || null,
        expected_fee_value: editFormData.expected_fee_value ? parseFloat(editFormData.expected_fee_value) : null,
        probability_percent: editFormData.probability_percent ? parseInt(editFormData.probability_percent) : null,
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await fetchOpportunityData(id);
    setIsEditing(false);
  };

  const handleCreateProject = () => {
    if (!opportunity) return;
    
    // Redirect to project creation with pre-filled data
    router.push({
      pathname: "/projects/new",
      query: {
        opportunity_id: opportunity.id,
        client_company_id: opportunity.company_id,
        name: opportunity.name,
        fee: opportunity.expected_fee_value?.toString(),
      },
    });
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "secured": return "bg-green-100 text-green-800";
      case "high_potential": return "bg-blue-100 text-blue-800";
      case "bid": return "bg-yellow-100 text-yellow-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-100 text-blue-800";
      case "closed_won": return "bg-green-100 text-green-800";
      case "closed_lost": return "bg-red-100 text-red-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (authLoading || loading) {
    return <Layout><div className="flex justify-center py-12">Loading...</div></Layout>;
  }

  if (error && !opportunity) {
    return (
      <Layout>
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
        <Link href="/opportunities" className="mt-4 inline-block">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
        </Link>
      </Layout>
    );
  }

  const isAdmin = profile?.role === "admin" || profile?.role === "director";

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/opportunities">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
        </div>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-2xl">{opportunity?.name}</CardTitle>
              {opportunity && (
                <>
                  <Badge className={getStageColor(opportunity.stage)}>
                    {opportunity.stage.replace("_", " ")}
                  </Badge>
                  <Badge className={getStatusColor(opportunity.status)}>
                    {opportunity.status.replace("_", " ")}
                  </Badge>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {isAdmin && !isEditing && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                    <Edit className="w-4 h-4" />
                    Edit
                  </Button>
                  {!opportunity?.linked_project_id && opportunity?.status !== "closed_lost" && (
                    <Button size="sm" onClick={handleCreateProject} className="gap-2">
                      <Briefcase className="w-4 h-4" />
                      Create Project
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input 
                    value={editFormData.name} 
                    onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select 
                    value={editFormData.company_id} 
                    onValueChange={v => setEditFormData({...editFormData, company_id: v, contact_id: ""})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {editFormData.company_id && (
                  <div className="space-y-2">
                    <Label>Contact</Label>
                    <Select 
                      value={editFormData.contact_id} 
                      onValueChange={v => setEditFormData({...editFormData, contact_id: v})}
                    >
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    value={editFormData.description} 
                    onChange={e => setEditFormData({...editFormData, description: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Stage</Label>
                    <Select 
                      value={editFormData.stage} 
                      onValueChange={(v: any) => setEditFormData({...editFormData, stage: v})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bid">Bid</SelectItem>
                        <SelectItem value="high_potential">High Potential</SelectItem>
                        <SelectItem value="secured">Secured</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select 
                      value={editFormData.status} 
                      onValueChange={(v: any) => setEditFormData({...editFormData, status: v})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed_won">Closed Won</SelectItem>
                        <SelectItem value="closed_lost">Closed Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Expected Fee (£)</Label>
                    <Input 
                      type="number" 
                      value={editFormData.expected_fee_value} 
                      onChange={e => setEditFormData({...editFormData, expected_fee_value: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Probability (%)</Label>
                    <Input 
                      type="number" 
                      min="0" max="100"
                      value={editFormData.probability_percent} 
                      onChange={e => setEditFormData({...editFormData, probability_percent: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tender Due</Label>
                    <Input 
                      type="date" 
                      value={editFormData.tender_due_date} 
                      onChange={e => setEditFormData({...editFormData, tender_due_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Exp. Start</Label>
                    <Input 
                      type="date" 
                      value={editFormData.expected_start_date} 
                      onChange={e => setEditFormData({...editFormData, expected_start_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Exp. End</Label>
                    <Input 
                      type="date" 
                      value={editFormData.expected_end_date} 
                      onChange={e => setEditFormData({...editFormData, expected_end_date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="submit">Save Changes</Button>
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    {opportunity?.company && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="text-sm font-medium text-slate-500">Client</div>
                          <Link href={`/companies/${opportunity.company.id}`} className="text-blue-600 hover:underline font-medium">
                            {opportunity.company.name}
                          </Link>
                        </div>
                      </div>
                    )}
                    
                    {opportunity?.contact && (
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="text-sm font-medium text-slate-500">Contact</div>
                          <div className="text-slate-900">{opportunity.contact.name}</div>
                        </div>
                      </div>
                    )}

                    {opportunity?.linked_project && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="text-sm font-medium text-slate-500">Converted to Project</div>
                          <Link href={`/projects/${opportunity.linked_project.id}`} className="text-blue-600 hover:underline font-medium flex items-center gap-1">
                            {opportunity.linked_project.code} - {opportunity.linked_project.name}
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-slate-400" />
                      <div>
                        <div className="text-sm font-medium text-slate-500">Expected Fee</div>
                        <div className="text-slate-900 font-medium">{formatCurrency(opportunity?.expected_fee_value || null)}</div>
                        {opportunity?.probability_percent && (
                          <div className="text-xs text-slate-500">{opportunity.probability_percent}% probability</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-slate-400" />
                      <div>
                        <div className="text-sm font-medium text-slate-500">Dates</div>
                        <div className="text-sm text-slate-900">
                          Due: {formatDate(opportunity?.tender_due_date || null)}
                        </div>
                        {opportunity?.expected_start_date && (
                          <div className="text-sm text-slate-900">
                            Schedule: {formatDate(opportunity.expected_start_date)} - {formatDate(opportunity.expected_end_date)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {opportunity?.description && (
                  <div>
                    <div className="text-sm font-medium text-slate-500 mb-2">Description</div>
                    <div className="p-4 bg-slate-50 rounded-lg text-slate-700 whitespace-pre-wrap">
                      {opportunity.description}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}