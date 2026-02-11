-- Drop the existing restrictive DELETE policy
DROP POLICY IF EXISTS "Admins and directors can delete invoice items" ON invoice_items;

-- Create a new DELETE policy that allows authenticated users to delete
CREATE POLICY "Authenticated users can delete invoice items" 
ON invoice_items
FOR DELETE
TO authenticated
USING (true);