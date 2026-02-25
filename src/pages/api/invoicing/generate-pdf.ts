import type { NextApiRequest, NextApiResponse } from "next";
import { PDFDocument, StandardFonts } from "pdf-lib";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 20;

    const title = "Invoice summary PDF generated successfully.";
    const textWidth = font.widthOfTextAtSize(title, fontSize);
    const x = (width - textWidth) / 2;
    const y = height / 2;

    page.drawText(title, {
      x,
      y,
      size: fontSize,
      font,
    });

    const pdfBytes = await pdfDoc.save();

    const fileName = "invoice-summary.pdf";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
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