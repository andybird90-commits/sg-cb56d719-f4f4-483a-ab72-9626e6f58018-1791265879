import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InvoicePdfItem = {
  id: string;
  invoice_month_id: string;
  project_id: string;
  project_name: string | null;
  project_code: string | null;
  client_name: string | null;
  po_number: string | null;
  invoice_value: number | null;
  description: string | null;
  accounts_email: string | null;
  client_address: string | null;
  enquiry_number: string | null;
  project_reference: string | null;
  project_owner_name: string | null;
  payment_terms: string | null;
  updated_at: string | null;
};

type GeneratePdfPayload = {
  invoiceMonthId: string;
  year: number;
  month: number;
  items: InvoicePdfItem[];
  totalValue: number;
  options?: {
    bucket?: string;
    revisionLabel?: string;
  };
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { invoiceMonthId, year, month, items, totalValue, options } =
      (await req.json()) as GeneratePdfPayload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = height - 50;

    const title = `Invoice Summary - ${year}-${String(month).padStart(
      2,
      "0"
    )}`;
    page.drawText(title, { x: 50, y, size: 16, font: fontBold });
    y -= 30;

    page.drawText(`Invoice Month ID: ${invoiceMonthId}`, {
      x: 50,
      y,
      size: 10,
      font,
    });
    y -= 20;

    const header = "Project                             Client                             Value";
    page.drawText(header, { x: 50, y, size: 10, font: fontBold });
    y -= 15;

    for (const item of items) {
      if (y < 100) {
        page.drawText("Continued on next page...", {
          x: 50,
          y: 50,
          size: 9,
          font,
        });
        const newPage = pdfDoc.addPage();
        y = height - 50;
        newPage.drawText(header, { x: 50, y, size: 10, font: fontBold });
        y -= 15;
      }

      const projectLabel = `${item.project_code ?? ""} ${
        item.project_name ?? ""
      }`.trim() || "N/A";
      const clientLabel = item.client_name ?? "N/A";
      const valueLabel =
        item.invoice_value !== null && item.invoice_value !== undefined
          ? item.invoice_value.toFixed(2)
          : "0.00";

      page.drawText(projectLabel, { x: 50, y, size: 10, font });
      page.drawText(clientLabel, { x: 220, y, size: 10, font });
      page.drawText(valueLabel, { x: 400, y, size: 10, font });
      y -= 14;

      const detailLines: string[] = [];

      if (item.po_number) {
        detailLines.push(`PO Number: ${item.po_number}`);
      }
      if (item.enquiry_number || item.project_reference) {
        const parts: string[] = [];
        if (item.enquiry_number) parts.push(`Enquiry: ${item.enquiry_number}`);
        if (item.project_reference)
          parts.push(`Project Ref: ${item.project_reference}`);
        detailLines.push(parts.join(" | "));
      }
      if (item.project_owner_name) {
        detailLines.push(`Project Owner: ${item.project_owner_name}`);
      }
      if (item.payment_terms) {
        detailLines.push(`Payment Terms: ${item.payment_terms}`);
      }
      if (item.updated_at) {
        const dateOnly = item.updated_at.split("T")[0];
        detailLines.push(`Last Updated: ${dateOnly}`);
      }
      if (item.description) {
        detailLines.push(`Description: ${item.description}`);
      }
      if (item.accounts_email) {
        detailLines.push(`Accounts Email: ${item.accounts_email}`);
      }
      if (item.client_address) {
        detailLines.push(`Address: ${item.client_address}`);
      }

      for (const line of detailLines) {
        if (y < 80) {
          page.drawText("Continued on next page...", {
            x: 50,
            y: 50,
            size: 9,
            font,
          });
          const newPage = pdfDoc.addPage();
          y = height - 50;
          newPage.drawText(header, { x: 50, y, size: 10, font: fontBold });
          y -= 15;
        }
        page.drawText(line, { x: 60, y, size: 9, font });
        y -= 12;
      }

      y -= 6;
    }

    if (y < 60) {
      const newPage = pdfDoc.addPage();
      y = height - 50;
    }

    const totalText = `Total Invoiced Value: ${totalValue.toFixed(2)}`;
    page.drawText(totalText, { x: 50, y: 40, size: 12, font: fontBold });

    const pdfBytes = await pdfDoc.save();

    const bucket = options?.bucket || "invoices";
    const fileName = options?.revisionLabel
      ? `${invoiceMonthId}-${options.revisionLabel}.pdf`
      : `${invoiceMonthId}.pdf`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError || !uploadData) {
      console.error("PDF upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload invoice PDF" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(uploadData.path);

    return new Response(JSON.stringify({ pdfUrl: publicUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-invoice-pdf error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate invoice PDF" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});