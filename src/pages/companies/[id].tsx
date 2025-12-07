import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase, Company, Contact } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Edit, Plus, Mail, Phone, Trash2, User } from "lucide-react";
import Link from "next/link";

export default function CompanyDetailPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [editFormData, setEditFormData] = useState({
    name: "",
    short_name: "",
    sector: "",
    status: "active" as "active" | "prospect" | "inactive",
    notes: "",
  });

  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactFormData, setContactFormData] = useState({
    name: "",
    email: "",
    phone: "",
    job_title: "",
    notes: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (id && typeof id === 'string' && user) {
      fetchCompanyData(id);
    }
  }, [id, user]);

  const fetchCompanyData = async (companyId: string) => {
    setLoading(true);
    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (companyError || !companyData) {
      setError("Company not found");
      setLoading(false);
      return;
    }

    setCompany(companyData);
    setEditFormData({
      name: companyData.name,
      short_name: companyData.short_name || "",
      sector: companyData.sector || "",
      status: companyData.status,
      notes: companyData.notes || "",
    });

    const { data: contactsData } = await supabase
      .from("contacts")
      .select("*")
      .eq("company_id", companyId)
      .order("name");

    if (contactsData) {
      setContacts(contactsData);
    }

    setLoading(false);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (typeof id !== 'string') return;

    const { error: updateError } = await supabase
      .from("companies")
      .update({
        name: editFormData.name,
        short_name: editFormData.short_name || null,
        sector: editFormData.sector || null,
        status: editFormData.status,
        notes: editFormData.notes || null,
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await fetchCompanyData(id);
    setIsEditing(false);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof id !== 'string') return;

    if (editingContact) {
      const { error } = await supabase
        .from("contacts")
        .update({
          name: contactFormData.name,
          email: contactFormData.email || null,
          phone: contactFormData.phone || null,
          job_title: contactFormData.job_title || null,
          notes: contactFormData.notes || null,
        })
        .eq("id", editingContact.id);

      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("contacts").insert({
        company_id: id,
        name: contactFormData.name,
        email: contactFormData.email || null,
        phone: contactFormData.phone || null,
        job_title: contactFormData.job_title || null,
        notes: contactFormData.notes || null,
      });

      if (error) {
        setError(error.message);
        return;
      }
    }

    await fetchCompanyData(id);
    setContactFormOpen(false);
    setEditingContact(null);
    resetContactForm();
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    if (typeof id !== 'string') return;

    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", contactId);

    if (error) {
      setError(error.message);
      return;
    }

    await fetchCompanyData(id);
  };

  const resetContactForm = () => {
    setContactFormData({
      name: "",
      email: "",
      phone: "",
      job_title: "",
      notes: "",
    });
  };

  const openContactForm = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact);
      setContactFormData({
        name: contact.name,
        email: contact.email || "",
        phone: contact.phone || "",
        job_title: contact.job_title || "",
        notes: contact.notes || "",
      });
    } else {
      setEditingContact(null);
      resetContactForm();
    }
    setContactFormOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "prospect":
        return "bg-blue-100 text-blue-800";
      case "inactive":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (error && !company) {
    return (
      <Layout>
        <div className="space-y-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Link href="/companies">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Companies
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const isAdmin = profile?.role === "admin" || profile?.role === "director";

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/companies">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-2xl">{company?.name}</CardTitle>
              {company && (
                <Badge className={getStatusColor(company.status)}>
                  {company.status}
                </Badge>
              )}
            </div>
            {isAdmin && !isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                <Edit className="w-4 h-4" />
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <form onSubmit={handleUpdateCompany} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="short_name">Short Name</Label>
                  <Input
                    id="short_name"
                    value={editFormData.short_name}
                    onChange={(e) => setEditFormData({ ...editFormData, short_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sector">Sector</Label>
                  <Input
                    id="sector"
                    value={editFormData.sector}
                    onChange={(e) => setEditFormData({ ...editFormData, sector: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={editFormData.status}
                    onValueChange={(value: "active" | "prospect" | "inactive") =>
                      setEditFormData({ ...editFormData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    rows={4}
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit">Save Changes</Button>
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {company?.short_name && (
                    <div>
                      <div className="text-sm font-medium text-slate-500">Short Name</div>
                      <div className="text-slate-900">{company.short_name}</div>
                    </div>
                  )}
                  {company?.sector && (
                    <div>
                      <div className="text-sm font-medium text-slate-500">Sector</div>
                      <div className="text-slate-900">{company.sector}</div>
                    </div>
                  )}
                </div>
                {company?.notes && (
                  <div>
                    <div className="text-sm font-medium text-slate-500 mb-1">Notes</div>
                    <div className="text-slate-900 whitespace-pre-wrap">{company.notes}</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Contacts</CardTitle>
            {isAdmin && (
              <Dialog open={contactFormOpen} onOpenChange={setContactFormOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2" onClick={() => openContactForm()}>
                    <Plus className="w-4 h-4" />
                    Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingContact ? "Edit Contact" : "Add New Contact"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSaveContact} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact_name">Name *</Label>
                      <Input
                        id="contact_name"
                        value={contactFormData.name}
                        onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact_email">Email</Label>
                      <Input
                        id="contact_email"
                        type="email"
                        value={contactFormData.email}
                        onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact_phone">Phone</Label>
                      <Input
                        id="contact_phone"
                        value={contactFormData.phone}
                        onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact_job_title">Job Title</Label>
                      <Input
                        id="contact_job_title"
                        value={contactFormData.job_title}
                        onChange={(e) => setContactFormData({ ...contactFormData, job_title: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact_notes">Notes</Label>
                      <Textarea
                        id="contact_notes"
                        value={contactFormData.notes}
                        onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button type="submit">
                        {editingContact ? "Save Changes" : "Add Contact"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setContactFormOpen(false);
                          setEditingContact(null);
                          resetContactForm();
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                No contacts yet. Add your first contact to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-slate-400" />
                        <h4 className="font-medium text-slate-900">{contact.name}</h4>
                        {contact.job_title && (
                          <span className="text-sm text-slate-500">• {contact.job_title}</span>
                        )}
                      </div>
                      <div className="space-y-1 ml-6">
                        {contact.email && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="w-3 h-3" />
                            <a href={`mailto:${contact.email}`} className="hover:text-blue-600">
                              {contact.email}
                            </a>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="w-3 h-3" />
                            <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                              {contact.phone}
                            </a>
                          </div>
                        )}
                        {contact.notes && (
                          <div className="text-sm text-slate-600 mt-2">{contact.notes}</div>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openContactForm(contact)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteContact(contact.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}