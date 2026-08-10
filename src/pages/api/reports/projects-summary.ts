import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Fetch all opportunities with company data
    const { data: opportunities, error: oppError } = await supabase
      .from("opportunities")
      .select(`
        id,
        name,
        description,
        stage,
        status,
        expected_fee_value,
        probability_percent,
        tender_due_date,
        tender_received_date,
        submitted_date,
        expected_start_date,
        expected_end_date,
        enquiry_number,
        project_reference,
        created_at,
        archived,
        archived_reason,
        companies:company_id (
          name,
          short_name,
          sector,
          status
        ),
        contacts:contact_id (
          name,
          email,
          phone,
          job_title
        ),
        added_by:added_by_user_id (
          full_name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (oppError) throw oppError;

    // Fetch all projects with company data
    const { data: projects, error: projError } = await supabase
      .from("projects")
      .select(`
        id,
        code,
        name,
        status,
        agreed_fee_value,
        start_date,
        end_date,
        po_number,
        project_reference,
        opportunity_reference,
        created_at,
        archived,
        archived_reason,
        companies:client_company_id (
          name,
          short_name,
          sector,
          status
        ),
        opportunities:opportunity_id (
          enquiry_number,
          stage,
          expected_fee_value
        ),
        added_by:added_by_user_id (
          full_name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (projError) throw projError;

    // Build CSV content
    const csvRows: string[] = [];
    
    // Header row
    csvRows.push([
      "Type",
      "ID",
      "Name",
      "Client",
      "Client Sector",
      "Status/Stage",
      "Expected/Agreed Fee (£)",
      "Probability %",
      "Tender Due Date",
      "Tender Received",
      "Submitted Date",
      "Start Date",
      "End Date",
      "Enquiry Number",
      "Project Reference",
      "PO Number",
      "Contact Name",
      "Contact Email",
      "Added By",
      "Created Date",
      "Archived",
      "Archived Reason"
    ].map(escapeCSV).join(","));

    // Add opportunity rows
    opportunities?.forEach((opp: any) => {
      csvRows.push([
        "Opportunity",
        opp.id,
        opp.name,
        opp.companies?.name || "",
        opp.companies?.sector || "",
        opp.stage,
        opp.expected_fee_value || "",
        opp.probability_percent || "",
        opp.tender_due_date || "",
        opp.tender_received_date || "",
        opp.submitted_date || "",
        opp.expected_start_date || "",
        opp.expected_end_date || "",
        opp.enquiry_number || "",
        opp.project_reference || "",
        "",
        opp.contacts?.name || "",
        opp.contacts?.email || "",
        opp.added_by?.full_name || "",
        opp.created_at ? new Date(opp.created_at).toLocaleDateString() : "",
        opp.archived ? "Yes" : "No",
        opp.archived_reason || ""
      ].map(escapeCSV).join(","));
    });

    // Add project rows
    projects?.forEach((proj: any) => {
      csvRows.push([
        "Project",
        proj.id,
        proj.name,
        proj.companies?.name || "",
        proj.companies?.sector || "",
        proj.status,
        proj.agreed_fee_value || "",
        "",
        "",
        "",
        "",
        proj.start_date || "",
        proj.end_date || "",
        proj.opportunities?.enquiry_number || "",
        proj.project_reference || "",
        proj.po_number || "",
        "",
        "",
        proj.added_by?.full_name || "",
        proj.created_at ? new Date(proj.created_at).toLocaleDateString() : "",
        proj.archived ? "Yes" : "No",
        proj.archived_reason || ""
      ].map(escapeCSV).join(","));
    });

    const csv = csvRows.join("\n");
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `projects-summary-${timestamp}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csv);

  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ 
      error: "Failed to generate report",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}