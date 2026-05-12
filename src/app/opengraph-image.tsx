import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const runtime = "edge";
export const alt = `${SITE_NAME} - Watch Anime Online`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #06070d 0%, #111527 54%, #2a0c15 100%)",
          color: "white",
          padding: 76,
          fontFamily: "Arial",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 82,
              height: 82,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 22,
              background: "#101322",
              boxShadow: "0 24px 80px rgba(200, 34, 61, 0.28)",
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "18px solid transparent",
                borderBottom: "18px solid transparent",
                borderLeft: "30px solid #c8223d",
                marginLeft: 8,
              }}
            />
          </div>
          <div style={{ fontSize: 54, fontWeight: 900, letterSpacing: 0 }}>
            anime<span style={{ color: "#c8223d" }}>Tv</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ maxWidth: 920, fontSize: 82, fontWeight: 900, lineHeight: 0.95 }}>
            Watch anime online with fast HLS playback
          </div>
          <div style={{ maxWidth: 860, color: "rgba(255,255,255,0.68)", fontSize: 30, lineHeight: 1.35 }}>
            {SITE_DESCRIPTION}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
