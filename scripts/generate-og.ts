/**
 * Build-time OG image generator using satori + sharp.
 * Run: npx tsx scripts/generate-og.ts
 * Outputs: public/og-image.png, public/og-pricing.png
 */

import satori from "satori";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const WIDTH = 1200;
const HEIGHT = 630;

// Load Inter font for satori (requires a .ttf/.woff file)
// We'll fetch Inter from Google Fonts CDN at build time
async function loadFont(): Promise<ArrayBuffer> {
  const res = await fetch(
    "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.ttf"
  );
  return res.arrayBuffer();
}

async function loadFontBold(): Promise<ArrayBuffer> {
  const res = await fetch(
    "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hjQ.ttf"
  );
  return res.arrayBuffer();
}

interface OGConfig {
  headline1: string;
  headline2: string;
  subtext: string;
  tagline?: string;
  filename: string;
}

async function generateOGImage(
  config: OGConfig,
  fontRegular: ArrayBuffer,
  fontBold: ArrayBuffer
) {
  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          background: "#08090A",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          position: "relative",
        },
        children: [
          // Subtle warm glow
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                top: "20%",
                left: "30%",
                width: "500px",
                height: "300px",
                background:
                  "radial-gradient(ellipse, rgba(249,115,22,0.08), transparent 70%)",
                borderRadius: "50%",
              },
            },
          },
          // Logo
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                fontSize: 28,
                marginBottom: 48,
                alignItems: "center",
              },
              children: [
                {
                  type: "span",
                  props: {
                    style: { color: "#FFFFFF", fontWeight: 700 },
                    children: "Field",
                  },
                },
                {
                  type: "span",
                  props: {
                    style: { color: "#F97316", fontWeight: 700 },
                    children: "Tek",
                  },
                },
                {
                  type: "span",
                  props: {
                    style: {
                      color: "#6B7280",
                      fontSize: 14,
                      marginLeft: 12,
                    },
                    children: "Powered by Sentinel AI",
                  },
                },
              ],
            },
          },
          // Headline 1
          {
            type: "div",
            props: {
              style: {
                fontSize: 64,
                fontWeight: 600,
                color: "#FFFFFF",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              },
              children: config.headline1,
            },
          },
          // Headline 2
          {
            type: "div",
            props: {
              style: {
                fontSize: 64,
                fontWeight: 600,
                color: "#F97316",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                marginTop: 4,
              },
              children: config.headline2,
            },
          },
          // Subtext
          {
            type: "div",
            props: {
              style: {
                fontSize: 22,
                color: "#9CA3AF",
                marginTop: 32,
                maxWidth: 700,
                lineHeight: 1.5,
              },
              children: config.subtext,
            },
          },
          // Domain
          {
            type: "div",
            props: {
              style: {
                fontSize: 16,
                color: "#4B5563",
                marginTop: 48,
              },
              children: "fieldtek.ai",
            },
          },
        ],
      },
    },
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: "Inter", data: fontRegular, weight: 400, style: "normal" },
        { name: "Inter", data: fontBold, weight: 600, style: "normal" },
        { name: "Inter", data: fontBold, weight: 700, style: "normal" },
      ],
    }
  );

  const png = await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
  const outPath = join(
    import.meta.dirname ?? ".",
    "..",
    "public",
    config.filename
  );
  writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${(png.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  console.log("Loading fonts...");
  const [fontRegular, fontBold] = await Promise.all([
    loadFont(),
    loadFontBold(),
  ]);

  // Main OG image
  await generateOGImage(
    {
      headline1: "Guide Every Repair.",
      headline2: "Learn From Every Job.",
      subtext:
        "AI-powered compliance and diagnostic guidance for field technicians. Built for HVAC, electrical, plumbing, and mechanical contractors.",
      filename: "og-image.png",
    },
    fontRegular,
    fontBold
  );

  // Pricing OG image
  await generateOGImage(
    {
      headline1: "Transparent pricing",
      headline2: "for every team size.",
      subtext:
        "Plans for HVAC, electrical, plumbing, and mechanical contractors. Starting at $99/mo.",
      filename: "og-pricing.png",
    },
    fontRegular,
    fontBold
  );

  console.log("Done!");
}

main().catch(console.error);
