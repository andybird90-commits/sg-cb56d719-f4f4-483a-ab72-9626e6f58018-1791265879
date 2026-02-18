-- Create invoice_collections table to track payment collection
CREATE TABLE invoice_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_month_id UUID NOT NULL REFERENCES invoice_months(id) ON DELETE CASCADE,
  invoice_item_id UUID NOT NULL REFERENCES invoice_items(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  collected_date DATE,
  collected_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE invoice_collections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view invoice collections" ON invoice_collections FOR SELECT USING (true);
CREATE POLICY "Admins can insert invoice collections" ON invoice_collections FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director'))
);
CREATE POLICY "Admins can update invoice collections" ON invoice_collections FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director'))
);
CREATE POLICY "Admins can delete invoice collections" ON invoice_collections FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director'))
);

-- Add indexes
CREATE INDEX idx_invoice_collections_invoice_month ON invoice_collections(invoice_month_id);
CREATE INDEX idx_invoice_collections_invoice_item ON invoice_collections(invoice_item_id);
CREATE INDEX idx_invoice_collections_due_date ON invoice_collections(due_date);
CREATE INDEX idx_invoice_collections_collected_date ON invoice_collections(collected_date);

COMMENT ON TABLE invoice_collections IS 'Tracks invoice payment collection and due dates for cash flow forecasting';