import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ImportRawRow = Database["public"]["Tables"]["me_contractors_import_raw"]["Row"];

export interface ImportPreviewRow {
  company_name: string | null;
  company_number: string | null;
  sic_code: string | null;
  status: string | null;
  postcode: string | null;
  region: string | null;
  employees: number | null;
  turnover_gbp: number | null;
}

export interface ImportResult {
  success: boolean;
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  error: string | null;
}

export const contractorImportService = {
  async uploadCSV(file: File): Promise<{ success: boolean; rowCount: number; error: string | null }> {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        return { success: false, rowCount: 0, error: "CSV file is empty or has no data rows" };
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const rows = lines.slice(1);

      const records = rows.map(line => {
        const values = this.parseCSVLine(line);
        const record: any = { processed: false };

        headers.forEach((header, index) => {
          const value = values[index]?.trim().replace(/"/g, '') || null;
          
          // Map CSV headers to table columns
          switch (header) {
            case 'company_name':
            case 'name':
              record.company_name = value;
              break;
            case 'company_number':
            case 'number':
              record.company_number = value;
              break;
            case 'sic_code':
            case 'sic':
              record.sic_code = value;
              break;
            case 'status':
              record.status = value;
              break;
            case 'postcode':
            case 'post_code':
              record.postcode = value;
              break;
            case 'address_line_1':
            case 'address1':
              record.address_line_1 = value;
              break;
            case 'address_line_2':
            case 'address2':
              record.address_line_2 = value;
              break;
            case 'town_city':
            case 'town':
            case 'city':
              record.town_city = value;
              break;
            case 'region':
            case 'county':
              record.region = value;
              break;
            case 'website':
            case 'web':
              record.website = value;
              break;
            case 'phone':
            case 'telephone':
              record.phone = value;
              break;
            case 'email':
            case 'e-mail':
              record.email = value;
              break;
            case 'employees':
            case 'employee_count':
              record.employees = value ? parseInt(value) : null;
              break;
            case 'turnover_gbp':
            case 'turnover':
            case 'revenue':
              record.turnover_gbp = value ? parseFloat(value.replace(/[£,]/g, '')) : null;
              break;
          }
        });

        return record;
      });

      // Insert into raw table
      const { error } = await supabase
        .from('me_contractors_import_raw')
        .insert(records);

      if (error) throw error;

      return { success: true, rowCount: records.length, error: null };
    } catch (err: any) {
      console.error("Error uploading CSV:", err);
      return { success: false, rowCount: 0, error: err.message };
    }
  },

  parseCSVLine(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  },

  async getPreviewRows(limit: number = 20): Promise<{ data: ImportRawRow[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('me_contractors_import_raw')
        .select('*')
        .eq('processed', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (err: any) {
      console.error("Error fetching preview rows:", err);
      return { data: [], error: err.message };
    }
  },

  async processImport(): Promise<ImportResult> {
    try {
      const { data, error } = await supabase.functions.invoke('process-contractor-import');

      if (error) throw error;

      return {
        success: true,
        processed: data.processed || 0,
        inserted: data.inserted || 0,
        updated: data.updated || 0,
        skipped: data.skipped || 0,
        error: null
      };
    } catch (err: any) {
      console.error("Error processing import:", err);
      return {
        success: false,
        processed: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        error: err.message
      };
    }
  },

  async clearProcessedRows(): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('me_contractors_import_raw')
        .delete()
        .eq('processed', true);

      if (error) throw error;

      return { success: true, error: null };
    } catch (err: any) {
      console.error("Error clearing processed rows:", err);
      return { success: false, error: err.message };
    }
  },

  async deleteAllRows(): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('me_contractors_import_raw')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;

      return { success: true, error: null };
    } catch (err: any) {
      console.error("Error deleting all rows:", err);
      return { success: false, error: err.message };
    }
  }
};