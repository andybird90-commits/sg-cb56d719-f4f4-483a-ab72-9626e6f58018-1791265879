ALTER TABLE accreditations RENAME TO company_documents;
    
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('company_documents', 'company_documents', false)
    ON CONFLICT (id) DO NOTHING;

    CREATE POLICY "Allow read company_documents" ON storage.objects FOR SELECT USING (bucket_id = 'company_documents' AND auth.role() = 'authenticated');
    CREATE POLICY "Allow upload company_documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company_documents' AND auth.role() = 'authenticated');
    CREATE POLICY "Allow update company_documents" ON storage.objects FOR UPDATE USING (bucket_id = 'company_documents' AND auth.role() = 'authenticated');
    CREATE POLICY "Allow delete company_documents" ON storage.objects FOR DELETE USING (bucket_id = 'company_documents' AND auth.role() = 'authenticated');