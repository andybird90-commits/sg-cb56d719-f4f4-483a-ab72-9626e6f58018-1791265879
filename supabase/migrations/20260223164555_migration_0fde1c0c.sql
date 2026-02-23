-- Allow authenticated users to read objects in subcontractor_costs bucket
CREATE POLICY "subcontractor_costs_select_20260223"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'subcontractor_costs');

-- Allow authenticated users to insert objects into subcontractor_costs bucket
CREATE POLICY "subcontractor_costs_insert_20260223"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'subcontractor_costs');

-- Allow authenticated users to update their objects in subcontractor_costs bucket
CREATE POLICY "subcontractor_costs_update_20260223"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'subcontractor_costs' AND owner = auth.uid())
WITH CHECK (bucket_id = 'subcontractor_costs' AND owner = auth.uid());

-- Allow authenticated users to delete their objects in subcontractor_costs bucket
CREATE POLICY "subcontractor_costs_delete_20260223"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'subcontractor_costs' AND owner = auth.uid());