import type { NextApiRequest, NextApiResponse } from "next";
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";

interface InvoiceItemPayload {
  id?: string;
  project_name?: string | null;
  project_code?: string | null;
  client_name?: string | null;
  invoice_value?: number | string | null;
  description?: string | null;
  po_number?: string | null;
  project_reference?: string | null;
  enquiry_number?: string | null;
  project_owner_name?: string | null;
  payment_terms?: number | string | null;
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
    return Number.isFinite(value) ? value : 0;
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

  const breakLongWord = (word: string): string[] => {
    const segments: string[] = [];
    let segment = "";

    for (const char of word) {
      const candidate = segment + char;
      const candidateWidth = font.widthOfTextAtSize(candidate, fontSize);

      if (candidateWidth <= maxWidth) {
        segment = candidate;
      } else {
        if (segment) {
          segments.push(segment);
        }
        segment = char;
      }
    }

    if (segment) {
      segments.push(segment);
    }

    return segments;
  };

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);

    if (width <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }

      const wordWidth = font.widthOfTextAtSize(word, fontSize);
      if (wordWidth > maxWidth && word.length > 0) {
        const segments = breakLongWord(word);

        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          if (i === segments.length - 1) {
            currentLine = segment;
          } else {
            lines.push(segment);
          }
        }
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
    const raw = req.body as GeneratePdfRequestBody | string | undefined;

    let body: GeneratePdfRequestBody;
    if (typeof raw === "string") {
      try {
        body = JSON.parse(raw) as GeneratePdfRequestBody;
      } catch {
        body = {};
      }
    } else {
      body = raw ?? {};
    }

    const invoiceMonthId =
      typeof body.invoiceMonthId === "string" && body.invoiceMonthId.trim().length > 0
        ? body.invoiceMonthId.trim()
        : "Unknown";

    const yearRaw = body.year;
    const monthRaw = body.month;

    const year = toNumber(yearRaw);
    const month = toNumber(monthRaw);

    const safeYear =
      year > 0 && Number.isFinite(year) ? Math.trunc(year) : 0;
    const safeMonth =
      month >= 1 && month <= 12 && Number.isFinite(month) ? Math.trunc(month) : 0;

    const monthName =
      safeMonth >= 1 && safeMonth <= 12 ? MONTHS[safeMonth - 1] : "Unknown month";

    const items = Array.isArray(body.items) ? body.items : [];

    const totalValue = toNumber(body.totalValue);

    console.log("Invoice PDF generation payload:", {
      invoiceMonthId,
      year: safeYear,
      month: safeMonth,
      itemsCount: items.length,
      totalValue,
    });

    const pdfDoc = await PDFDocument.create();
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage();
    let { width, height } = page.getSize();

    const marginLeft = 50;
    const marginRight = 50;
    const marginTop = 50;
    const marginBottom = 50;

    const titleFontSize = 18;
    const headerFontSize = 12;
    const bodyFontSize = 10;
    const detailFontSize = 9;
    const lineGap = 4;
    const itemGap = 10;

    const contentWidth = width - marginLeft - marginRight;
    const lineHeight = bodyFontSize + lineGap;
    const detailLineHeight = detailFontSize + 2;

    let y = height - marginTop;

    const title =
      safeYear > 0
        ? `Invoice Summary - ${monthName} ${safeYear}`
        : `Invoice Summary - ${monthName}`;

    const titleWidth = boldFont.widthOfTextAtSize(title, titleFontSize);
    page.drawText(title, {
      x: (width - titleWidth) / 2,
      y,
      size: titleFontSize,
      font: boldFont,
    });
    y -= 30;

    const idLine = `Invoice Month ID: ${invoiceMonthId}`;
    page.drawText(idLine, {
      x: marginLeft,
      y,
      size: bodyFontSize,
      font: regularFont,
    });
    y -= 20;

    const headerProjectX = marginLeft;
    const headerClientX = marginLeft + contentWidth * 0.45;
    const headerValueX = width - marginRight - 80;

    page.drawText("Project", {
      x: headerProjectX,
      y,
      size: headerFontSize,
      font: boldFont,
    });
    page.drawText("Client", {
      x: headerClientX,
      y,
      size: headerFontSize,
      font: boldFont,
    });
    page.drawText("Value", {
      x: headerValueX,
      y,
      size: headerFontSize,
      font: boldFont,
    });
    y -= 18;

    const ensureSpace = (linesNeeded: number) => {
      const neededHeight = linesNeeded * detailLineHeight + itemGap;
      if (y - neededHeight < marginBottom) {
        page = pdfDoc.addPage();
        ({ width, height } = page.getSize());
        y = height - marginTop;

        const contTitle = `${title} (continued)`;
        const contWidth = boldFont.widthOfTextAtSize(contTitle, headerFontSize);
        page.drawText(contTitle, {
          x: (width - contWidth) / 2,
          y,
          size: headerFontSize,
          font: boldFont,
        });
        y -= 24;

        page.drawText("Project", {
          x: headerProjectX,
          y,
          size: headerFontSize,
          font: boldFont,
        });
        page.drawText("Client", {
          x: headerClientX,
          y,
          size: headerFontSize,
          font: boldFont,
        });
        page.drawText("Value", {
          x: headerValueX,
          y,
          size: headerFontSize,
          font: boldFont,
        });
        y -= 18;
      }
    };

    for (const item of items) {
      const projectCode = (item.project_code ?? "").toString().trim();
      const projectName = (item.project_name ?? "").toString().trim();
      const clientName = (item.client_name ?? "").toString().trim();

      const projectLabelBase = [projectCode, projectName].filter(Boolean).join(" ");
      const projectLabel = projectLabelBase || "Unknown project";
      const clientLabel = clientName || "Unknown client";

      const valueNumber = toNumber(item.invoice_value ?? 0);
      const valueLabel = formatCurrency(valueNumber);

      const projectLines = wrapText(
        projectLabel,
        contentWidth * 0.45,
        regularFont,
        bodyFontSize,
      );
      const clientLines = wrapText(
        clientLabel,
        contentWidth * 0.35,
        regularFont,
        bodyFontSize,
      );

      const detailLines: string[] = [];

      if (item.project_reference) {
        detailLines.push(`Project Ref: ${item.project_reference}`);
      }
      if (item.enquiry_number) {
        detailLines.push(`Enquiry: ${item.enquiry_number}`);
      }
      if (item.po_number) {
        detailLines.push(`PO Number: ${item.po_number}`);
      }
      if (item.project_owner_name) {
        detailLines.push(`Project Owner: ${item.project_owner_name}`);
      }
      if (item.payment_terms !== null && item.payment_terms !== undefined) {
        const termsNumber = toNumber(item.payment_terms);
        if (termsNumber > 0) {
          detailLines.push(`Payment Terms: ${termsNumber} days`);
        }
      }
      if (item.updated_at) {
        const d = new Date(item.updated_at);
        if (!Number.isNaN(d.getTime())) {
          const iso = d.toISOString().slice(0, 10);
          detailLines.push(`Last Updated: ${iso}`);
        }
      }
      if (item.description) {
        detailLines.push(`Description: ${item.description}`);
      }
      if (item.accounts_email) {
        detailLines.push(`Email Contact: ${item.accounts_email}`);
      }
      if (item.client_address) {
        detailLines.push(`Address: ${item.client_address}`);
      }

      const wrappedDetails = detailLines.flatMap((line) =>
        wrapText(line, contentWidth - 20, regularFont, detailFontSize),
      );

      const totalLinesForItem =
        Math.max(projectLines.length, clientLines.length) + wrappedDetails.length + 1;

      ensureSpace(totalLinesForItem);

      const maxMainLines = Math.max(projectLines.length, clientLines.length);

      for (let i = 0; i < maxMainLines; i++) {
        const projText = projectLines[i] ?? "";
        const clientText = clientLines[i] ?? "";

        if (projText) {
          page.drawText(projText, {
            x: headerProjectX,
            y,
            size: bodyFontSize,
            font: regularFont,
          });
        }
        if (clientText) {
          page.drawText(clientText, {
            x: headerClientX,
            y,
            size: bodyFontSize,
            font: regularFont,
          });
        }

        if (i === 0) {
          const valueWidth = regularFont.widthOfTextAtSize(valueLabel, bodyFontSize);
          page.drawText(valueLabel, {
            x: headerValueX + 80 - valueWidth,
            y,
            size: bodyFontSize,
            font: regularFont,
          });
        }

        y -= lineHeight;
      }

      for (const line of wrappedDetails) {
        page.drawText(line, {
          x: marginLeft + 12,
          y,
          size: detailFontSize,
          font: regularFont,
        });
        y -= detailLineHeight;
      }

      y -= itemGap;
    }

    ensureSpace(2);

    const totalText = `Total Invoiced Value: ${formatCurrency(totalValue)}`;
    page.drawText(totalText, {
      x: marginLeft,
      y,
      size: bodyFontSize + 1,
      font: boldFont,
    });

    const pdfBytes = await pdfDoc.save();

    const safeYearLabel = safeYear > 0 ? safeYear.toString() : "unknown-year";
    const safeMonthLabel =
      safeMonth >= 1 && safeMonth <= 12
        ? safeMonth.toString().padStart(2, "0")
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