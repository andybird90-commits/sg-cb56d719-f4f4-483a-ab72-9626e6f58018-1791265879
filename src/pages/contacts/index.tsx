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
import { Plus, Search, Mail, Phone } from "lucide-react";

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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Contacts</h1>
            <p className="text-slate-600 mt-1">All business contacts</p>
          </div>
          {canEdit && (
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  New Contact
                </Button>
              </DialogTrigger>
              <DialogContent>
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

                  <div className="flex gap-3">
                    <Button type="submit">Add Contact</Button>
                    <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid gap-4">
          {filteredContacts.map((contact) => (
            <Card key={contact.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {contact.name}
                      </h3>
                      {contact.job_title && (
                        <span className="text-sm text-slate-500">• {contact.job_title}</span>
                      )}
                    </div>

                    <div 
                      className="text-sm text-blue-600 hover:underline cursor-pointer mb-2"
                      onClick={() => router.push(`/companies/${contact.company_id}`)}
                    >
                      {contact.companies?.name}
                    </div>

                    <div className="space-y-1">
                      {contact.email && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail className="w-4 h-4" />
                          <a href={`mailto:${contact.email}`} className="hover:text-blue-600">
                            {contact.email}
                          </a>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Phone className="w-4 h-4" />
                          <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                            {contact.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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