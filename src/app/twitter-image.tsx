import { ImageResponse } from "next/og";

export const alt = "Memo — A Notion-style workspace, built with zero human code.";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 40,
          background: "#1f1f24",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 20,
              background: "#2a2a30",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontWeight: 700,
              color: "#c8c8d0",
            }}
          >
            M
          </div>
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#dededf",
            marginBottom: 16,
            letterSpacing: "-0.02em",
          }}
        >
          Memo
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#8b8b96",
            maxWidth: 600,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          A Notion-style workspace, built with zero human code.
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 40,
            fontSize: 18,
            color: "#5a5a66",
          }}
        >
          software-factory.dev
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
