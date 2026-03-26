CREATE TABLE accreditations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    expiry_date DATE NOT NULL,
    file_path TEXT,
    filename TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE accreditations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view accreditations" ON accreditations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert accreditations" ON accreditations FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update accreditations" ON accreditations FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete accreditations" ON accreditations FOR DELETE USING (auth.role() = 'authenticated');

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('accreditations', 'accreditations', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read accreditations bucket" ON storage.objects FOR SELECT USING (bucket_id = 'accreditations' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can upload to accreditations bucket" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'accreditations' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update accreditations bucket" ON storage.objects FOR UPDATE USING (bucket_id = 'accreditations' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete from accreditations bucket" ON storage.objects FOR DELETE USING (bucket_id = 'accreditations' AND auth.role() = 'authenticated');