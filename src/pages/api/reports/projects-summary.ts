import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function formatGBP(value: number | null | undefined): string {
  if (!value) return "";
  return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch opportunities
    const { data: opportunities, error: oppError } = await supabase
      .from("opportunities")
      .select("*")
      .order("created_at", { ascending: false });

    if (oppError) {
      console.error("Opportunities fetch error:", oppError);
      throw oppError;
    }

    // Fetch projects
    const { data: projects, error: projError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (projError) {
      console.error("Projects fetch error:", projError);
      throw projError;
    }

    // Fetch companies
    const { data: companies, error: compError } = await supabase
      .from("companies")
      .select("id, name, short_name, sector, status");

    if (compError) {
      console.error("Companies fetch error:", compError);
      throw compError;
    }

    // Fetch contacts
    const { data: contacts, error: contError } = await supabase
      .from("contacts")
      .select("id, name, email, phone, job_title");

    if (contError) {
      console.error("Contacts fetch error:", contError);
      throw contError;
    }

    // Fetch users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, full_name, email");

    if (usersError) {
      console.error("Users fetch error:", usersError);
    }

    // Create lookup maps
    const companyMap = new Map(companies?.map(c => [c.id, c]) || []);
    const contactMap = new Map(contacts?.map(c => [c.id, c]) || []);
    const userMap = new Map(users?.map(u => [u.id, u]) || []);

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
      "Expected/Agreed Fee",
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
      const company = companyMap.get(opp.company_id);
      const contact = contactMap.get(opp.contact_id);
      const addedBy = userMap.get(opp.added_by_user_id);

      csvRows.push([
        "Opportunity",
        opp.id || "",
        opp.name || "",
        company?.name || "",
        company?.sector || "",
        opp.stage || "",
        opp.expected_fee_value ? formatGBP(opp.expected_fee_value) : "",
        opp.probability_percent || "",
        opp.tender_due_date || "",
        opp.tender_received_date || "",
        opp.submitted_date || "",
        opp.expected_start_date || "",
        opp.expected_end_date || "",
        opp.enquiry_number || "",
        opp.project_reference || "",
        "",
        contact?.name || "",
        contact?.email || "",
        addedBy?.full_name || "",
        opp.created_at ? new Date(opp.created_at).toLocaleDateString("en-GB") : "",
        opp.archived ? "Yes" : "No",
        opp.archived_reason || ""
      ].map(escapeCSV).join(","));
    });

    // Add project rows
    projects?.forEach((proj: any) => {
      const company = companyMap.get(proj.client_company_id);
      const addedBy = userMap.get(proj.added_by_user_id);

      csvRows.push([
        "Project",
        proj.id || "",
        proj.name || "",
        company?.name || "",
        company?.sector || "",
        proj.status || "",
        proj.agreed_fee_value ? formatGBP(proj.agreed_fee_value) : "",
        "",
        "",
        "",
        "",
        proj.start_date || "",
        proj.end_date || "",
        proj.opportunity_reference || "",
        proj.project_reference || "",
        proj.po_number || "",
        "",
        "",
        addedBy?.full_name || "",
        proj.created_at ? new Date(proj.created_at).toLocaleDateString("en-GB") : "",
        proj.archived ? "Yes" : "No",
        proj.archived_reason || ""
      ].map(escapeCSV).join(","));
    });

    const csv = csvRows.join("\n");
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `projects-summary-${timestamp}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
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