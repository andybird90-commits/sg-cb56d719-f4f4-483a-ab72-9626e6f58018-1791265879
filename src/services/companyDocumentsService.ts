import { supabase } from "@/integrations/supabase/client";

export interface CompanyDocument {
  id: string;
  title: string;
  description: string | null;
  file_path: string | null;
  filename: string | null;
  expiry_date: string;
  created_at: string;
  created_by: string | null;
}

export const companyDocumentsService = {
  async getDocuments() {
    const { data, error } = await supabase
      .from("company_documents")
      .select("*")
      .order("expiry_date", { ascending: true });

    if (error) throw error;
    return data as CompanyDocument[];
  },

  async createDocument(doc: { title: string; description: string; expiry_date: string }, file?: File) {
    let file_path: string | null = null;
    let filename: string | null = null;

    if (file) {
      const fileExt = file.name.split(".").pop();
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      const randomName = fileExt ? `${id}.${fileExt}` : id;

      const { error: uploadError, data } = await supabase.storage
        .from("company_documents")
        .upload(randomName, file);

      if (uploadError) throw uploadError;

      file_path = data.path;
      filename = file.name;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    const { data, error } = await supabase
      .from("company_documents")
      .insert([{
        title: doc.title,
        description: doc.description ?? "",
        expiry_date: doc.expiry_date,
        file_path,
        filename,
        created_by: userData.user?.id,
      }])
      .select()
      .single();

    if (error) throw error;
    return data as CompanyDocument;
  },

  async updateDocument(params: {
    id: string;
    updates: { title: string; description: string; expiry_date: string };
    newFile?: File;
    existingFilePath?: string | null;
  }) {
    let nextFilePath: string | null | undefined = undefined;
    let nextFilename: string | null | undefined = undefined;
    let uploadedPathForRollback: string | null = null;

    if (params.newFile) {
      const file = params.newFile;
      const fileExt = file.name.split(".").pop();
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      const randomName = fileExt ? `${id}.${fileExt}` : id;

      const { error: uploadError, data } = await supabase.storage
        .from("company_documents")
        .upload(randomName, file);

      if (uploadError) throw uploadError;

      uploadedPathForRollback = data.path;
      nextFilePath = data.path;
      nextFilename = file.name;
    }

    const { data: updated, error: updateError } = await supabase
      .from("company_documents")
      .update({
        title: params.updates.title,
        description: params.updates.description ?? "",
        expiry_date: params.updates.expiry_date,
        ...(nextFilePath !== undefined ? { file_path: nextFilePath, filename: nextFilename ?? null } : {}),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      if (uploadedPathForRollback) {
        await supabase.storage.from("company_documents").remove([uploadedPathForRollback]);
      }
      throw updateError;
    }

    if (params.newFile && params.existingFilePath && uploadedPathForRollback && params.existingFilePath !== uploadedPathForRollback) {
      const { error: storageError } = await supabase.storage
        .from("company_documents")
        .remove([params.existingFilePath]);

      if (storageError) console.error("Storage deletion error:", storageError);
    }

    return updated as CompanyDocument;
  },

  async deleteDocument(id: string, filePath?: string | null) {
    if (filePath) {
      const { error: storageError } = await supabase.storage
        .from("company_documents")
        .remove([filePath]);
      if (storageError) console.error("Storage deletion error:", storageError);
    }

    const { error } = await supabase
      .from("company_documents")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async downloadDocument(filePath: string, fileName: string) {
    const { data, error } = await supabase.storage
      .from("company_documents")
      .download(filePath);

    if (error) throw error;

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
};