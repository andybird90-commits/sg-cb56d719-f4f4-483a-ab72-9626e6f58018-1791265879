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
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Mail, Phone, Building2, User, Briefcase, AlertTriangle, FileText, Edit, Trash2 } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  notes: string | null;
  company_id: string;
  added_by_user_id: string | null;
  companies?: {
    name: string;
  };
  added_by_profile?: {
    full_name: string | null;
    email: string;
  };
}

interface Company {
  id: string;
  name: string;
}

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

function ContactsContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    job_title: "",
    notes: "",
    company_id: "",
    added_by_user_id: "",
  });

  const canEdit = !!profile; // Everyone can edit
  const canDelete = profile?.role === "admin" || profile?.role === "director"; // Only admins/directors can delete

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchTerm]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select(`
          *,
          companies (
            name
          ),
          added_by_profile:profiles!contacts_added_by_user_id_fkey (
            full_name,
            email
          )
        `)
        .order("name");

      if (contactsError) throw contactsError;

      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");

      if (companiesError) throw companiesError;

      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");

      if (usersError) throw usersError;

      setContacts(contactsData || []);
      setCompanies(companiesData || []);
      setUsers(usersData || []);
    } catch (err) {
      console.error("Failed to load contacts data", err);
      setError("Failed to load contacts");
    } finally {
      setIsLoading(false);
    }
  };

  const filterContacts = () => {
    if (!searchTerm) {
      setFilteredContacts(contacts);
      return;
    }

    const filtered = contacts.filter((contact) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        contact.name.toLowerCase().includes(searchLower) ||
        contact.email?.toLowerCase().includes(searchLower) ||
        contact.phone?.toLowerCase().includes(searchLower) ||
        contact.notes?.toLowerCase().includes(searchLower) ||
        contact.companies?.name.toLowerCase().includes(searchLower)
      );
    });

    setFilteredContacts(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        // Update existing contact
        const { error: updateError } = await supabase
          .from("contacts")
          .update({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            job_title: formData.job_title || null,
            notes: formData.notes || null,
            company_id: formData.company_id,
            added_by_user_id: formData.added_by_user_id || null,
          })
          .eq("id", editingId);

        if (updateError) throw updateError;
      } else {
        // Create new contact
        const { error: insertError } = await supabase.from("contacts").insert({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          job_title: formData.job_title || null,
          notes: formData.notes || null,
          company_id: formData.company_id,
          added_by_user_id: formData.added_by_user_id || null,
        });

        if (insertError) throw insertError;
      }

      setFormOpen(false);
      setEditingId(null);
      setFormData({ name: "", email: "", phone: "", job_title: "", notes: "", company_id: "", added_by_user_id: "" });
      fetchData();
    } catch (err) {
      console.error("Failed to save contact", err);
      alert("Failed to save contact");
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setFormData({
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      job_title: contact.job_title || "",
      notes: contact.notes || "",
      company_id: contact.company_id,
      added_by_user_id: contact.added_by_user_id || "",
    });
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    try {
      const { error: deleteError } = await supabase
        .from("contacts")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      fetchData();
    } catch (err) {
      console.error("Failed to delete contact", err);
      alert("Failed to delete contact");
    }
  };

  const openNewContactForm = () => {
    setEditingId(null);
    setFormData({ name: "", email: "", phone: "", job_title: "", notes: "", company_id: "", added_by_user_id: "" });
    setFormOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Contacts</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">All business contacts</p>
          </div>
          {canEdit && (
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto gap-2" onClick={openNewContactForm}>
                  <Plus className="w-4 h-4" />
                  <span>New Contact</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_id">Company *</Label>
                    <Select
                      value={formData.company_id}
                      onValueChange={(value) => setFormData({ ...formData, company_id: value })}
                      required
                    >
                      <SelectTrigger>
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

                  <div className="space-y-2">
                    <Label htmlFor="job_title">Job Title</Label>
                    <Input
                      id="job_title"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="added_by_user_id">Added by</Label>
                    <Select
                      value={formData.added_by_user_id}
                      onValueChange={(value) => setFormData({ ...formData, added_by_user_id: value })}
                    >
                      <SelectTrigger>
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

                  <div className="space-y-2">
                    <Label htmlFor="notes">Comments / Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Add any helpful details about this contact..."
                      rows={4}
                      className="resize-none"
                    />
                    <p className="text-xs text-slate-500">
                      Add CRM notes, conversation history, preferences, or any other relevant information
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button type="submit" className="w-full sm:w-auto">
                      {editingId ? "Save Changes" : "Add Contact"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="w-full sm:w-auto">
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search contacts by name, email, phone, company, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Contacts List - Mobile: Cards, Desktop: Cards with more details */}
        <div className="space-y-3">
          {isLoading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-slate-600">Loading contacts...</div>
              </CardContent>
            </Card>
          ) : filteredContacts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <User className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-600">
                  {searchTerm ? "No contacts found" : "No contacts yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredContacts.map((contact) => (
              <Card key={contact.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-6">
                  {/* Mobile & Desktop Layout */}
                  <div className="space-y-3">
                    {/* Header: Name and Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <User className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                            {contact.name}
                          </h3>
                          {contact.job_title && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-sm text-slate-600">{contact.job_title}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {canEdit && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-500 hover:text-blue-600"
                            onClick={() => handleEdit(contact)}
                            title="Edit contact"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-500 hover:text-red-600"
                            onClick={() => handleDelete(contact.id)}
                            title="Delete contact"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Company */}
                    <div 
                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline cursor-pointer"
                      onClick={() => router.push(`/companies/${contact.company_id}`)}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>{contact.companies?.name}</span>
                    </div>

                    {/* Contact Details */}
                    <div className="space-y-2">
                      {contact.email && (
                        <a 
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors"
                        >
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </a>
                      )}
                      {contact.phone && (
                        <a 
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors"
                        >
                          <Phone className="w-4 h-4 flex-shrink-0" />
                          <span>{contact.phone}</span>
                        </a>
                      )}
                    </div>

                    {/* Notes/Comments Section */}
                    {contact.notes && (
                      <div className="pt-2 border-t">
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-500 mb-1">Notes</div>
                            <div className="text-sm text-slate-700 whitespace-pre-wrap">
                              {contact.notes}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Added by Section */}
                    {contact.added_by_user_id && (
                      <div className="pt-2 border-t">
                        <div className="text-xs text-slate-500">
                          Added by {contact.added_by_profile?.full_name || contact.added_by_profile?.email || "Unknown"}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Results count - Mobile friendly */}
        {!isLoading && filteredContacts.length > 0 && (
          <div className="text-center text-sm text-slate-600">
            Showing {filteredContacts.length} {filteredContacts.length === 1 ? 'contact' : 'contacts'}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default function ContactsPage() {
  return (
    <RequireAuth>
      <ContactsContent />
    </RequireAuth>
  );
}