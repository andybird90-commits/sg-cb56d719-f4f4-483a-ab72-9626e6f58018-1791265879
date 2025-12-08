import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Mail, Phone, Building2, User, Briefcase } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  company_id: string;
  companies?: {
    name: string;
  };
}

interface Company {
  id: string;
  name: string;
}

function ContactsContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    job_title: "",
    company_id: "",
  });

  const canEdit = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchTerm]);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: contactsData } = await supabase
      .from("contacts")
      .select(`
        *,
        companies (
          name
        )
      `)
      .order("name");

    const { data: companiesData } = await supabase
      .from("companies")
      .select("id, name")
      .order("name");

    if (contactsData) setContacts(contactsData);
    if (companiesData) setCompanies(companiesData);
    
    setLoading(false);
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
        contact.companies?.name.toLowerCase().includes(searchLower)
      );
    });

    setFilteredContacts(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("contacts").insert({
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      job_title: formData.job_title || null,
      company_id: formData.company_id,
    });

    if (!error) {
      setFormOpen(false);
      setFormData({ name: "", email: "", phone: "", job_title: "", company_id: "" });
      fetchData();
    }
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
                <Button className="w-full sm:w-auto gap-2">
                  <Plus className="w-4 h-4" />
                  <span>New Contact</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
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
                    <Label htmlFor="job_title">Job Title</Label>
                    <Input
                      id="job_title"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button type="submit" className="w-full sm:w-auto">Add Contact</Button>
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
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Contacts List - Mobile: Cards, Desktop: Cards with more details */}
        <div className="space-y-3">
          {filteredContacts.length === 0 ? (
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
                    {/* Header: Name and Job Title */}
                    <div>
                      <div className="flex items-start gap-2">
                        <User className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
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
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Results count - Mobile friendly */}
        {filteredContacts.length > 0 && (
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