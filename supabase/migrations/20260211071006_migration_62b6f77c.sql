-- Create storage bucket for invoices
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Give admin/finance full access, others read-only
CREATE POLICY "Admin/Director can upload invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoices' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'director')
  )
);

CREATE POLICY "Admin/Director can update invoices"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'invoices' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'director')
  )
);

CREATE POLICY "Authenticated users can view invoices"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'invoices');