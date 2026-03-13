import "./app.css";
import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

type Format =
  | "PNG"
  | "JPG"
  | "JPEG"
  | "WEBP"
  | "GIF"
  | "BMP"
  | "TIFF"
  | "ICO"
  | "SVG"
  | "AVIF";

const FORMATS: { value: Format; desc: string }[] = [
  { value: "PNG", desc: "Lossless" },
  { value: "JPG", desc: "Compressed" },
  { value: "JPEG", desc: "Compressed" },
  { value: "WEBP", desc: "Modern" },
  { value: "AVIF", desc: "Next-gen" },
  { value: "GIF", desc: "Animated" },
  { value: "BMP", desc: "Bitmap" },
  { value: "TIFF", desc: "Lossless" },
  { value: "ICO", desc: "Icon" },
  { value: "SVG", desc: "Vector" },
];

export default function App() {
  const [selectedFormat, setSelectedFormat] = useState<Format>("PNG");
  const [file, setFile] = useState<{ name: string; preview: string } | null>(
    null,
  );
  const [status, setStatus] = useState<
    "idle" | "dragging" | "done" | "loading" | "error"
  >("idle");
  const [convertedUrl, setConvertedUrl] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      )
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  // Injetar CSS global
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      html, body {
        overflow: hidden !important;
        width: 220px; height: 350px;
        margin: 0; padding: 0;
      }
      @keyframes fadeDown {
        from { opacity: 0; transform: translateY(-5px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeOut {
        0%   { opacity: 1; transform: translateY(0); }
        70%  { opacity: 1; }
        100% { opacity: 0; transform: translateY(-4px); }
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse {
        0%, 100% { opacity: 0.5; }
        50%       { opacity: 1; }
      }
      @keyframes checkPop {
        0%   { transform: scale(0.5); opacity: 0; }
        60%  { transform: scale(1.2); opacity: 1; }
        100% { transform: scale(1);   opacity: 1; }
      }
      .toast-enter { animation: fadeUp 0.22s ease forwards; }
      .toast-exit  { animation: fadeOut 0.4s ease 2.4s forwards; }
      .check-pop   { animation: checkPop 0.3s ease forwards; }
      .fmt-scroll::-webkit-scrollbar { width: 3px; }
      .fmt-scroll::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.15); border-radius: 99px;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const processFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setFile({ name: f.name, preview: e.target?.result as string });
      setConvertedUrl(null);
      setStatus("idle");
      setDownloaded(false);
      setErrorMsg(null);
    };
    reader.readAsDataURL(f);
  }, []);

  const handleConvert = useCallback(async () => {
    if (!file) return;
    setStatus("loading");
    setErrorMsg(null);

    try {
      const result = await invoke<string>("convert_image", {
        base64Data: file.preview,
        targetFormat: selectedFormat,
      });
      setConvertedUrl(result);
      setStatus("done");
      setDownloaded(false);
    } catch (e) {
      setErrorMsg(String(e));
      setStatus("error");
    }
  }, [file, selectedFormat]);

  const download = () => {
    if (!convertedUrl || !file) return;
    const a = document.createElement("a");
    a.href = convertedUrl;
    a.download = `${file.name.replace(/\.[^.]+$/, "")}.${selectedFormat.toLowerCase()}`;
    a.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  const selected = FORMATS.find((f) => f.value === selectedFormat)!;

  return (
    <div className="w-[220px] h-[350px] flex flex-col text-white rounded-[18px] overflow-hidden select-none font-system relative bg-gradient-to-br from-neutral-900 via-neutral-900 to-black">
        {/* ── Toast de sucesso ── */}
        {downloaded && (
          <div
            className="toast-enter toast-exit"
            style={{
              position: "absolute",
              bottom: 58,
              left: 12,
              right: 12,
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(30,30,34,0.95)",
              border: "1px solid rgba(255,255,255,0.13)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="check-pop"
              style={{
                width: 20,
                height: 20,
                borderRadius: 99,
                flexShrink: 0,
                background: "rgba(52,199,89,0.2)",
                border: "1px solid rgba(52,199,89,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M1.5 5l2.5 2.5 4.5-5"
                  stroke="#34c759"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.88)",
                  letterSpacing: "-0.01em",
                }}
              >
                Download concluído
              </p>
              <p
                style={{
                  fontSize: 9.5,
                  color: "rgba(255,255,255,0.35)",
                  marginTop: 1,
                }}
              >
                {file?.name.replace(/\.[^.]+$/, "")}.
                {selectedFormat.toLowerCase()}
              </p>
            </div>
          </div>
        )}

        {/* ── Toast de erro ── */}
        {status === "error" && errorMsg && (
          <div
            className="toast-enter"
            style={{
              position: "absolute",
              bottom: 58,
              left: 12,
              right: 12,
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(30,30,34,0.95)",
              border: "1px solid rgba(255,59,48,0.3)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 99,
                flexShrink: 0,
                background: "rgba(255,59,48,0.2)",
                border: "1px solid rgba(255,59,48,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path
                  d="M1 1l6 6M7 1L1 7"
                  stroke="#ff3b30"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p
              style={{
                fontSize: 10.5,
                color: "rgba(255,100,90,0.9)",
                letterSpacing: "-0.01em",
              }}
            >
              {errorMsg}
            </p>
          </div>
        )}

        {/* ── Drag region ── */}
        <div
          data-tauri-drag-region
          style={{ height: 20, flexShrink: 0, cursor: "default" }}
        />

        {/* ── Drop zone ── */}
        <div style={{ padding: "0 12px", flexShrink: 0 }}>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setStatus("dragging");
            }}
            onDragLeave={() => setStatus("idle")}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) processFile(f);
              else setStatus("idle");
            }}
            onClick={() => !file && fileInputRef.current?.click()}
            style={{
              height: 148,
              borderRadius: 14,
              border:
                status === "dragging"
                  ? "1.5px solid rgba(255,255,255,0.5)"
                  : "1px solid rgba(255,255,255,0.12)",
              background:
                status === "dragging"
                  ? "rgba(255,255,255,0.1)"
                  : file
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(255,255,255,0.055)",
              cursor: file ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) =>
                e.target.files?.[0] && processFile(e.target.files[0])
              }
            />

            {!file && status !== "dragging" && (
              <div
                style={{
                  position: "absolute",
                  inset: 6,
                  borderRadius: 10,
                  border: "1px dashed rgba(255,255,255,0.09)",
                  pointerEvents: "none",
                }}
              />
            )}

            {file ? (
              <div
                style={{ width: "100%", height: "100%", position: "relative" }}
              >
                <img
                  src={file.preview}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    filter: "blur(14px) brightness(0.35) saturate(1.2)",
                    transform: "scale(1.12)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <img
                    src={file.preview}
                    style={{
                      maxWidth: 96,
                      maxHeight: 96,
                      borderRadius: 9,
                      border: "1px solid rgba(255,255,255,0.18)",
                      boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
                      objectFit: "contain",
                    }}
                  />
                  <p
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.65)",
                      maxWidth: 155,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {file.name}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setConvertedUrl(null);
                    setStatus("idle");
                    setDownloaded(false);
                    setErrorMsg(null);
                  }}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 20,
                    height: 20,
                    borderRadius: 99,
                    background: "rgba(0,0,0,0.5)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(255,255,255,0.55)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(200,50,50,0.65)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "rgba(0,0,0,0.5)")
                  }
                >
                  <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                    <path
                      d="M1 1l5 5M6 1L1 6"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    animation:
                      status === "dragging"
                        ? "pulse 0.9s ease infinite"
                        : "none",
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{ opacity: status === "dragging" ? 0.95 : 0.45 }}
                  >
                    <path
                      d="M12 4v13M8 9l4-5 4 5"
                      stroke="white"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 20h16"
                      stroke="white"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeOpacity=".4"
                    />
                  </svg>
                </div>
                <div
                  style={{
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.75)",
                      letterSpacing: "-0.01em",
                      fontWeight: 500,
                    }}
                  >
                    {status === "dragging"
                      ? "Solte aqui"
                      : "Arraste uma imagem"}
                  </p>
                  {status !== "dragging" && (
                    <p
                      style={{ fontSize: 10, color: "rgba(255,255,255,0.28)" }}
                    >
                      ou{" "}
                      <span style={{ color: "rgba(255,255,255,0.52)" }}>
                        clique para escolher
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Format selector ── */}
        <div
          ref={dropdownRef}
          style={{ padding: "8px 12px 0", flexShrink: 0, position: "relative" }}
        >
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "7px 10px",
              borderRadius: 9,
              border: dropdownOpen
                ? "1px solid rgba(255,255,255,0.25)"
                : "1px solid rgba(255,255,255,0.11)",
              background: dropdownOpen
                ? "rgba(255,255,255,0.11)"
                : "rgba(255,255,255,0.06)",
              cursor: "pointer",
              outline: "none",
              transition: "all 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.88)",
                  letterSpacing: "-0.01em",
                }}
              >
                {selected.value}
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)" }}>
                — {selected.desc}
              </span>
            </div>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              style={{
                opacity: 0.35,
                transition: "transform 0.2s",
                transform: dropdownOpen ? "rotate(180deg)" : "none",
              }}
            >
              <path
                d="M2 3.5l3 3 3-3"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {dropdownOpen && (
            <div
              className="fmt-scroll"
              style={{
                position: "absolute",
                top: "calc(100% + 3px)",
                left: 12,
                right: 12,
                maxHeight: 120,
                overflowY: "auto",
                zIndex: 50,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.11)",
                background: "rgba(36,36,40,0.98)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                boxShadow:
                  "0 8px 28px rgba(0,0,0,0.55), inset 0 0 0 0.5px rgba(255,255,255,0.06)",
                animation: "fadeDown 0.14s ease",
              }}
            >
              {FORMATS.map((f, i) => {
                const active = f.value === selectedFormat;
                return (
                  <button
                    key={f.value}
                    onClick={() => {
                      setSelectedFormat(f.value);
                      setConvertedUrl(null);
                      if (status === "done" || status === "error")
                        setStatus("idle");
                      setDropdownOpen(false);
                      setErrorMsg(null);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      background: active ? "#0a84ff" : "transparent",
                      borderTop:
                        i !== 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      cursor: "pointer",
                      outline: "none",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      if (!active)
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.07)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <div
                        style={{
                          width: 10,
                          display: "flex",
                          justifyContent: "center",
                        }}
                      >
                        {active && (
                          <svg
                            width="8"
                            height="8"
                            viewBox="0 0 8 8"
                            fill="none"
                          >
                            <path
                              d="M1 4l2.2 2.2L7 1.5"
                              stroke="white"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: active ? 600 : 400,
                          color: active ? "white" : "rgba(255,255,255,0.78)",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {f.value}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 9.5,
                        color: active
                          ? "rgba(255,255,255,0.6)"
                          : "rgba(255,255,255,0.28)",
                      }}
                    >
                      {f.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Action ── */}
        <div
          style={{
            padding: "0 12px",
            marginTop: "auto",
            marginBottom: 14,
            flexShrink: 0,
          }}
        >
          {status === "loading" ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                padding: "8px 0",
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 99,
                  border: "1.5px solid rgba(255,255,255,0.18)",
                  borderTopColor: "rgba(255,255,255,0.8)",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>
                Convertendo…
              </span>
            </div>
          ) : status === "done" && convertedUrl ? (
            <div style={{ display: "flex", gap: 6 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "0 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <path
                    d="M1 4.5l2.5 2.5 4.5-5"
                    stroke="rgba(255,255,255,0.55)"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)" }}
                >
                  OK
                </span>
              </div>
              <button
                onClick={download}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  padding: "8px 0",
                  borderRadius: 9,
                  border: downloaded
                    ? "1px solid rgba(52,199,89,0.35)"
                    : "1px solid rgba(255,255,255,0.16)",
                  background: downloaded
                    ? "rgba(52,199,89,0.12)"
                    : "rgba(255,255,255,0.1)",
                  cursor: "pointer",
                  outline: "none",
                  fontSize: 11,
                  fontWeight: 500,
                  color: downloaded
                    ? "rgba(52,199,89,0.9)"
                    : "rgba(255,255,255,0.82)",
                  letterSpacing: "-0.01em",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  if (!downloaded)
                    e.currentTarget.style.background = "rgba(255,255,255,0.16)";
                }}
                onMouseLeave={(e) => {
                  if (!downloaded)
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                }}
              >
                {downloaded ? (
                  <>
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 10 10"
                      fill="none"
                      className="check-pop"
                    >
                      <path
                        d="M1.5 5l2.5 2.5 4.5-5"
                        stroke="rgba(52,199,89,0.9)"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Baixado!
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path
                        d="M5.5 1.5v5M3.5 4.5l2 2 2-2"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M1.5 9h8"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                    Baixar {selectedFormat}
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConvert}
              disabled={!file}
              style={{
                width: "100%",
                padding: "8.5px 0",
                borderRadius: 9,
                outline: "none",
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                cursor: file ? "pointer" : "not-allowed",
                transition: "all 0.18s",
                border: file
                  ? "1px solid rgba(255,255,255,0.2)"
                  : "1px solid rgba(255,255,255,0.06)",
                background: file
                  ? "rgba(255,255,255,0.14)"
                  : "rgba(255,255,255,0.03)",
                color: file
                  ? "rgba(255,255,255,0.88)"
                  : "rgba(255,255,255,0.16)",
              }}
              onMouseEnter={(e) => {
                if (file)
                  e.currentTarget.style.background = "rgba(255,255,255,0.2)";
              }}
              onMouseLeave={(e) => {
                if (file)
                  e.currentTarget.style.background = "rgba(255,255,255,0.14)";
              }}
            >
              {status === "error"
                ? "Tentar novamente →"
                : `Converter → ${selectedFormat}`}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
