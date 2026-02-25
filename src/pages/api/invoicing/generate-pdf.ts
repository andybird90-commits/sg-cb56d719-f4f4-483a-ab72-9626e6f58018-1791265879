import type { NextApiRequest, NextApiResponse } from "next";
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";

interface InvoiceItemPayload {
  id?: string;
  project_name?: string | null;
  project_code?: string | null;
  client_name?: string | null;
  invoice_value?: number | null;
  description?: string | null;
  po_number?: string | null;
  project_reference?: string | null;
  project_owner_name?: string | null;
  payment_terms?: number | null;
  updated_at?: string | null;
  accounts_email?: string | null;
  client_address?: string | null;
}

interface GeneratePdfRequestBody {
  invoiceMonthId?: string;
  year?: number | string;
  month?: number | string;
  items?: InvoiceItemPayload[];
  totalValue?: number | string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return value;
    }
    return 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `£${safe.toFixed(2)}`;
}

function wrapText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number,
): string[] {
  if (!text) {
    return [];
  }

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);

    if (width <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // If a single word is longer than maxWidth, still add it on its own line
      const wordWidth = font.widthOfTextAtSize(word, fontSize);
      if (wordWidth > maxWidth && word.length > 0) {
        lines.push(word);
        currentLine = "";
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const rawBody = req.body as GeneratePdfRequestBody | undefined;

    const invoiceMonthId =
      typeof rawBody?.invoiceMonthId === "string"
        ? rawBody.invoiceMonthId
        : "Unknown";

    const yearValue = rawBody?.year;
    const monthValue = rawBody?.month;

    const year =
      typeof yearValue === "number"
        ? yearValue
        : typeof yearValue === "string"
        ? Number(yearValue) || 0
        : 0;

    const month =
      typeof monthValue === "number"
        ? monthValue
        : typeof monthValue === "string"
        ? Number(monthValue) || 0
        : 0;

    const monthName =
      month >= 1 && month <= 12 ? MONTHS[month - 1] : "Unknown month";

    const items = Array.isArray(rawBody?.items)
      ? (rawBody?.items as InvoiceItemPayload[])
      : [];

    const totalValue = toNumber(rawBody?.totalValue ?? 0);

    const pdfDoc = await PDFDocument.create();
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage();
    let currentPage = page;

    const { width, height } = currentPage.getSize();

    const marginLeft = 50;
    const marginRight = 50;
    const marginTop = 50;
    const marginBottom = 50;

    const titleFontSize = 18;
    const headerFontSize = 12;
    const bodyFontSize = 10;
    const lineGap = 4;
    const sectionGap = 10;

    const contentWidth = width - marginLeft - marginRight;
    const lineHeight = bodyFontSize + lineGap;

    let y = height - marginTop;

    const title =
      year > 0
        ? `Invoice Summary - ${monthName} ${year}`
        : `Invoice Summary - ${monthName}`;

    const titleWidth = boldFont.widthOfTextAtSize(title, titleFontSize);
    currentPage.drawText(title, {
      x: (width - titleWidth) / 2,
      y,
      size: titleFontSize,
      font: boldFont,
    });
    y -= 30;

    const idLine = `Invoice Month ID: ${invoiceMonthId}`;
    currentPage.drawText(idLine, {
      x: marginLeft,
      y,
      size: bodyFontSize,
      font: regularFont,
    });
    y -= 20;

    const headerLine = "Project / Client / Value";
    currentPage.drawText(headerLine, {
      x: marginLeft,
      y,
      size: headerFontSize,
      font: boldFont,
    });
    y -= 16;

    const ensureSpace = (linesNeeded: number) => {
      const neededHeight = linesNeeded * lineHeight + sectionGap;
      if (y - neededHeight < marginBottom) {
        currentPage = pdfDoc.addPage();
        const size = currentPage.getSize();
        const newWidth = size.width;
        const newHeight = size.height;

        y = newHeight - marginTop;

        const continuedTitle = `${title} (continued)`;
        const continuedWidth = boldFont.widthOfTextAtSize(
          continuedTitle,
          headerFontSize,
        );
        currentPage.drawText(continuedTitle, {
          x: (newWidth - continuedWidth) / 2,
          y,
          size: headerFontSize,
          font: boldFont,
        });
        y -= 24;

        currentPage.drawText(headerLine, {
          x: marginLeft,
          y,
          size: headerFontSize,
          font: boldFont,
        });
        y -= 16;
      }
    };

    for (const rawItem of items) {
      const projectName = (rawItem.project_name ?? "").toString().trim();
      const projectCode = (rawItem.project_code ?? "").toString().trim();
      const clientName = (rawItem.client_name ?? "").toString().trim();

      const projectLabelBase = [projectCode, projectName].filter(Boolean).join(" ");
      const projectLabel =
        projectLabelBase.length > 0 ? projectLabelBase : "Unknown project";

      const clientLabel =
        clientName.length > 0 ? clientName : "Unknown client";

      const numericValue = toNumber(rawItem.invoice_value ?? 0);
      const valueLabel = formatCurrency(numericValue);

      const mainLine = `${projectLabel}  –  ${clientLabel}  –  ${valueLabel}`;
      const mainLines = wrapText(
        mainLine,
        contentWidth,
        regularFont,
        bodyFontSize,
      );

      const detailLinesRaw: string[] = [];

      if (rawItem.description) {
        detailLinesRaw.push(`Description: ${rawItem.description}`);
      }
      if (rawItem.po_number) {
        detailLinesRaw.push(`PO Number: ${rawItem.po_number}`);
      }
      if (rawItem.project_reference) {
        detailLinesRaw.push(`Project Ref: ${rawItem.project_reference}`);
      }
      if (rawItem.project_owner_name) {
        detailLinesRaw.push(`Project Owner: ${rawItem.project_owner_name}`);
      }
      if (rawItem.payment_terms !== null && rawItem.payment_terms !== undefined) {
        detailLinesRaw.push(`Payment Terms: ${rawItem.payment_terms} days`);
      }
      if (rawItem.updated_at) {
        const date = new Date(rawItem.updated_at);
        if (!Number.isNaN(date.getTime())) {
          const iso = date.toISOString().slice(0, 10);
          detailLinesRaw.push(`Last Updated: ${iso}`);
        }
      }
      if (rawItem.accounts_email) {
        detailLinesRaw.push(`Accounts Email: ${rawItem.accounts_email}`);
      }
      if (rawItem.client_address) {
        detailLinesRaw.push(`Address: ${rawItem.client_address}`);
      }

      const wrappedDetailLines = detailLinesRaw.flatMap((line) =>
        wrapText(line, contentWidth - 20, regularFont, bodyFontSize),
      );

      const totalLinesForItem =
        mainLines.length + wrappedDetailLines.length + 1;

      ensureSpace(totalLinesForItem);

      for (const line of mainLines) {
        currentPage.drawText(line, {
          x: marginLeft,
          y,
          size: bodyFontSize,
          font: regularFont,
        });
        y -= lineHeight;
      }

      for (const line of wrappedDetailLines) {
        currentPage.drawText(line, {
          x: marginLeft + 12,
          y,
          size: bodyFontSize,
          font: regularFont,
        });
        y -= lineHeight;
      }

      y -= sectionGap;
    }

    ensureSpace(2);

    const totalText = `Total Invoiced Value: ${formatCurrency(totalValue)}`;
    currentPage.drawText(totalText, {
      x: marginLeft,
      y,
      size: bodyFontSize + 1,
      font: boldFont,
    });

    const pdfBytes = await pdfDoc.save();

    const safeYearLabel = year > 0 ? year.toString() : "unknown-year";
    const safeMonthLabel =
      month >= 1 && month <= 12
        ? month.toString().padStart(2, "0")
        : "unknown-month";

    const fileName = `invoice-summary-${safeYearLabel}-${safeMonthLabel}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`,
    );
    res.status(200).send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Error generating invoice PDF:", error);

    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const responseBody: { error: string; details: string; stack?: string } = {
      error: "Failed to generate invoice PDF",
      details: message,
    };

    if (process.env.NODE_ENV !== "production" && stack) {
      responseBody.stack = stack;
    }

    res.status(500).json(responseBody);
  }
}