-- Drop and recreate the view with all the necessary columns
DROP VIEW IF EXISTS me_contractor_radar_view;

CREATE VIEW me_contractor_radar_view AS
SELECT 
  c.id,
  c.name,
  c.region,
  c.postcode,
  c.sic_code,
  c.employees,
  c.turnover_gbp,
  c.status,
  c.notes,
  c.enhancement_confidence,
  c.last_enhanced_at,
  c.created_at,
  c.updated_at,
  s.radar_score,
  s.fit_geo,
  s.fit_size,
  s.fit_specialism,
  s.relationship_heat,
  s.performance,
  s.data_completeness
FROM me_contractors c
LEFT JOIN me_contractor_radar_scores s ON c.id = s.contractor_id;