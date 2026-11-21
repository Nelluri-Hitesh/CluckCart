export const dynamic = "force-static";

// Lets customers and delivery staff "Add to Home Screen" on Android and iPhone (installable web app).
export function GET() {
  return Response.json(
    {
      name: "Chicken Mart",
      short_name: "Chicken Mart",
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#e23744",
      icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
