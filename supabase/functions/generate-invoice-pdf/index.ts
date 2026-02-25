import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InvoicePdfItem = {
  id: string;
  project_name?: string | null;
  project_code?: string | null;
  client_name?: string | null;
  invoice_value?: number | null;
  description?: string | null;
  po_number?: string | null;
  accounts_email?: string | null;
  client_address?: string | null;
  project_reference?: string | null;
  project_owner_name?: string | null;
  payment_terms?: number | null;
  enquiry_number?: string | null;
  updated_at?: string | null;
};

type GeneratePdfBody = {
  invoiceMonthId: string;
  year: number;
  month: number;
  items: InvoicePdfItem[];
  totalValue: number;
  options?: {
    bucket?: string;
    filenameSuffix?: string;
    revision?: number;
  };
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const json = (await req.json()) as GeneratePdfBody;

    const { invoiceMonthId, year, month, items, totalValue, options } = json;

    if (!invoiceMonthId || !year || !month || !Array.isArray(items)) {
      return new Response(
        JSON.stringify({
          error: "invoiceMonthId, year, month and items are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Supabase environment not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Build PDF with pdf-lib
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = height - 50;

    const title = `Invoice Summary - ${year}-${String(month).padStart(2, "0")}`;
    page.drawText(title, {
      x: 50,
      y,
      size: 18,
      font,
    });

    y -= 30;

    const periodText = `Invoice Month ID: ${invoiceMonthId}`;
    page.drawText(periodText, {
      x: 50,
      y,
      size: 10,
      font,
    });

    y -= 30;

    // Header for the main row columns
    page.drawText("Project", { x: 50, y, size: 10, font });
    page.drawText("Client", { x: 250, y, size: 10, font });
    page.drawText("Value", { x: 430, y, size: 10, font });

    y -= 16;

    const ensureRoomForRow = () => {
      if (y < 80) {
        page = pdfDoc.addPage();
        const pageSize = page.getSize();
        y = pageSize.height - 50;
        page.drawText("Project", { x: 50, y, size: 10, font });
        page.drawText("Client", { x: 250, y, size: 10, font });
        page.drawText("Value", { x: 430, y, size: 10, font });
        y -= 16;
      }
    };

    for (const item of items) {
      ensureRoomForRow();

      const projectLabel = `${item.project_code ?? ""} ${item.project_name ?? ""}`
        .trim()
        .slice(0, 60);
      const clientLabel = (item.client_name ?? "").slice(0, 40);
      const valueLabel =
        typeof item.invoice_value === "number"
          ? `£${item.invoice_value.toFixed(2)}`
          : "";

      // Main row (matches key columns: Project, Client, Value)
      page.drawText(projectLabel, { x: 50, y, size: 9, font });
      page.drawText(clientLabel, { x: 250, y, size: 9, font });
      page.drawText(valueLabel, { x: 430, y, size: 9, font });

      y -= 12;
      ensureRoomForRow();

      // Detail line 1: PO, Project Number, Owner, Terms, Last Updated
      const po = item.po_number ?? "—";
      const projectRef = item.project_reference ?? "—";
      const owner = item.project_owner_name ?? "—";
      const terms =
        typeof item.payment_terms === "number"
          ? `${item.payment_terms} days`
          : "—";
      const updated =
        item.updated_at != null
          ? item.updated_at.slice(0, 10)
          : "—";

      const detailLine1 = `PO: ${po} | Project #: ${projectRef} | Owner: ${owner} | Terms: ${terms} | Last updated: ${updated}`;
      page.drawText(detailLine1.slice(0, 140), { x: 50, y, size: 8, font });

      y -= 10;
      ensureRoomForRow();

      // Detail line 2: Description
      const description = (item.description ?? "").trim();
      if (description) {
        const descLabel = `Description: ${description}`;
        page.drawText(descLabel.slice(0, 160), { x: 50, y, size: 8, font });
        y -= 10;
        ensureRoomForRow();
      }

      // Detail line 3: Email
      if (item.accounts_email) {
        const emailLabel = `Email: ${item.accounts_email}`;
        page.drawText(emailLabel.slice(0, 160), { x: 50, y, size: 8, font });
        y -= 10;
        ensureRoomForRow();
      }

      // Detail line 4: Address
      const address = (item.client_address ?? "").trim();
      if (address) {
        const addressLabel = `Address: ${address}`;
        page.drawText(addressLabel.slice(0, 160), { x: 50, y, size: 8, font });
        y -= 10;
        ensureRoomForRow();
      }

      y -= 6;
    }

    // Total line
    ensureRoomForRow();
    y -= 10;
    const totalNumber = Number(totalValue || 0);
    const totalText = `Total: £${totalNumber.toFixed(2)}`;
    page.drawText(totalText, { x: 50, y, size: 12, font });

    const pdfBytes = await pdfDoc.save();

    // Upload to Supabase Storage
    const bucket = options?.bucket ?? "invoices";

    const baseName = `invoice-${year}-${String(month).padStart(2, "0")}-${invoiceMonthId}`;
    const suffix =
      typeof options?.filenameSuffix === "string"
        ? options.filenameSuffix
        : options && typeof options.revision === "number"
        ? `-rev${options.revision}`
        : "";
    const fileName = `${baseName}${suffix}.pdf`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("PDF upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload PDF" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    const pdfUrl = publicData.publicUrl;

    return new Response(
      JSON.stringify({ pdfUrl }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("generate-invoice-pdf error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});