import { supabase } from "@/integrations/supabase/client";

export interface Accreditation {
  id: string;
  title: string;
  description: string;
  expiry_date: string;
  file_path?: string | null;
  filename?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const accreditationsService = {
  async getAccreditations() {
    const { data, error } = await supabase
      .from("accreditations")
      .select("*")
      .order("expiry_date", { ascending: true });
      
    if (error) throw error;
    return data as Accreditation[];
  },

  async createAccreditation(accreditation: Partial<Accreditation>, file?: File) {
    let file_path = accreditation.file_path;
    let filename = accreditation.filename;

    if (file) {
      const fileExt = file.name.split('.').pop();
      const randomName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from("accreditations")
        .upload(randomName, file);

      if (uploadError) throw uploadError;
      
      file_path = data.path;
      filename = file.name;
    }

    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("accreditations")
      .insert([{ 
        ...accreditation, 
        file_path,
        filename,
        created_by: userData.user?.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data as Accreditation;
  },

  async deleteAccreditation(id: string, filePath?: string | null) {
    if (filePath) {
      await supabase.storage.from("accreditations").remove([filePath]);
    }
    
    const { error } = await supabase
      .from("accreditations")
      .delete()
      .eq("id", id);
      
    if (error) throw error;
  },

  async downloadFile(filePath: string, fileName: string) {
    const { data, error } = await supabase.storage
      .from("accreditations")
      .download(filePath);
      
    if (error) throw error;
    
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
};