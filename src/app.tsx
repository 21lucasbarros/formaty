import "./app.css";
import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { save } from "@tauri-apps/plugin-dialog";

type Format = "PNG" | "JPG" | "WEBP" | "AVIF" | "GIF" | "BMP" | "TIFF" | "ICO";

type PlatformInfo = { os: string; backdrop: boolean };

type Status = "idle" | "loading" | "done" | "error";

type SourceFile = {
  name: string;
  preview: string;
  size: number;
  format: string;
  width?: number;
  height?: number;
};

// Apenas formatos que o backend (crate `image`) consegue codificar
const FORMATS: { value: Format; desc: string }[] = [
  { value: "PNG", desc: "Sem perda" },
  { value: "JPG", desc: "Comprimido" },
  { value: "WEBP", desc: "Moderno" },
  { value: "AVIF", desc: "Nova geração" },
  { value: "GIF", desc: "256 cores" },
  { value: "BMP", desc: "Bitmap" },
  { value: "TIFF", desc: "Sem perda" },
  { value: "ICO", desc: "Ícone" },
];

const formatFromMime = (mime: string) => {
  const sub = mime.split("/")[1]?.toUpperCase() ?? "";
  if (sub === "JPEG") return "JPG";
  if (sub === "X-ICON" || sub === "VND.MICROSOFT.ICON") return "ICO";
  if (sub.startsWith("SVG")) return "SVG";
  return sub;
};

const dataUrlSize = (url: string) => {
  const b64 = url.slice(url.indexOf(",") + 1);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const baseName = (name: string) => name.replace(/\.[^.]+$/, "");

export default function App() {
  const [selectedFormat, setSelectedFormat] = useState<Format>("PNG");
  const [file, setFile] = useState<SourceFile | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [dragging, setDragging] = useState(false);
  const [convertedUrl, setConvertedUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    invoke<PlatformInfo>("platform_info").then(setPlatform).catch(() => {});
  }, []);

  // Esc esconde a janela e ⌘Q encerra o app (só quando ela está em foco)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") getCurrentWindow().hide();
      if (e.metaKey && e.key.toLowerCase() === "q") invoke("quit");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Toasts somem sozinhos
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 2800);
    return () => clearTimeout(t);
  }, [saved]);

  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(null), 4500);
    return () => clearTimeout(t);
  }, [errorMsg]);

  const resetResult = () => {
    setConvertedUrl(null);
    setStatus("idle");
    setSaved(null);
    setErrorMsg(null);
  };

  const processFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      setErrorMsg("Esse arquivo não é uma imagem");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      const base: SourceFile = {
        name: f.name,
        preview,
        size: f.size,
        format: formatFromMime(f.type),
      };
      setFile(base);
      resetResult();

      const img = new Image();
      img.onload = () =>
        setFile((cur) =>
          cur?.preview === preview
            ? { ...cur, width: img.naturalWidth, height: img.naturalHeight }
            : cur,
        );
      img.src = preview;
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
      setSaved(null);
    } catch (e) {
      setErrorMsg(String(e));
      setStatus("error");
    }
  }, [file, selectedFormat]);

  const handleSave = async () => {
    if (!convertedUrl || !file) return;
    const ext = selectedFormat.toLowerCase();

    try {
      const path = await save({
        defaultPath: `${baseName(file.name)}.${ext}`,
        filters: [{ name: selectedFormat, extensions: [ext] }],
      });
      if (!path) return;

      await invoke("save_image", { path, dataUrl: convertedUrl });
      setSaved(path.split(/[\\/]/).pop() ?? path);
    } catch (e) {
      setErrorMsg(String(e));
    }
  };

  const isWindows = platform?.os === "windows";
  // Sem efeito de vidro nativo, a janela transparente precisa de um fundo próprio
  const needsSolidBg = platform !== null && !platform.backdrop;

  const selected = FORMATS.find((f) => f.value === selectedFormat)!;
  const convertedSize = convertedUrl ? dataUrlSize(convertedUrl) : null;
  const sizeDelta =
    file && convertedSize !== null
      ? Math.round(((convertedSize - file.size) / file.size) * 100)
      : null;

  return (
    <div
      className={`relative flex h-[350px] w-[220px] flex-col overflow-hidden text-white ${
        isWindows ? "rounded-lg" : "rounded-[18px]"
      } ${needsSolidBg ? "border border-white/10 bg-[#1e1e22]" : ""}`}
    >
      {/* ── Header / drag region ── */}
      <header
        data-tauri-drag-region
        className="flex h-8 shrink-0 items-center justify-between px-3.5"
      >
        <span
          data-tauri-drag-region
          className="text-[11px] font-semibold tracking-tight text-white/70"
        >
          Formaty
        </span>
        <div className="flex items-center gap-0.5">
          {file && (
            <button
              onClick={() => {
                setFile(null);
                resetResult();
              }}
              className="rounded-md px-1.5 py-0.5 text-[10px] text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
            >
              Limpar
            </button>
          )}
          <button
            onClick={() => invoke("quit")}
            title={isWindows ? "Sair do Formaty" : "Sair do Formaty (⌘Q)"}
            className="flex h-5 w-5 items-center justify-center rounded-md text-white/35 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M5 1v3.5M2.8 2.6a3.5 3.5 0 1 0 4.4 0"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Drop zone ── */}
      <div className="shrink-0 px-3">
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            dragDepth.current++;
            setDragging(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragDepth.current = 0;
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) processFile(f);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`group relative flex h-[140px] cursor-pointer items-center justify-center overflow-hidden rounded-[14px] border transition-all duration-200 ${
            dragging
              ? "scale-[1.02] border-accent/70 bg-accent/15"
              : file
                ? "border-white/10 bg-white/[0.04]"
                : "border-white/10 bg-white/[0.05] hover:border-white/20 hover:bg-white/[0.08]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) processFile(e.target.files[0]);
              e.target.value = "";
            }}
          />

          {file ? (
            <>
              <img
                src={file.preview}
                className="absolute inset-0 h-full w-full scale-110 object-cover blur-[14px] brightness-[0.35] saturate-[1.2]"
              />
              <img
                src={file.preview}
                className="relative max-h-[78px] max-w-[150px] rounded-lg border border-white/20 object-contain shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
              />

              {/* Info do arquivo */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pt-4 pb-2">
                <p className="truncate text-[10.5px] font-medium tracking-tight text-white/85">
                  {file.name}
                </p>
                <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-white/45">
                  <span className="rounded bg-white/15 px-1 font-semibold text-white/75">
                    {file.format}
                  </span>
                  {file.width && (
                    <span>
                      {file.width}×{file.height}
                    </span>
                  )}
                  <span>·</span>
                  {status === "done" && convertedSize !== null ? (
                    <span className="text-white/70">
                      {formatBytes(file.size)} → {formatBytes(convertedSize)}
                      <span
                        className={`ml-1 font-semibold ${
                          sizeDelta! <= 0 ? "text-success" : "text-orange-300"
                        }`}
                      >
                        {sizeDelta! > 0 ? "+" : ""}
                        {sizeDelta}%
                      </span>
                    </span>
                  ) : (
                    <span>{formatBytes(file.size)}</span>
                  )}
                </div>
              </div>

              {/* Overlay de troca */}
              {!dragging && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[10px] font-medium text-white/85">
                    Trocar imagem
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="pointer-events-none flex flex-col items-center gap-2.5">
              <div className="absolute inset-1.5 rounded-[10px] border border-dashed border-white/10" />
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
                  dragging
                    ? "animate-soft-pulse border-accent/50 bg-accent/25"
                    : "border-white/10 bg-white/[0.07]"
                }`}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={dragging ? "opacity-100" : "opacity-50"}
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
              <div className="flex flex-col items-center gap-0.5 text-center">
                <p className="text-xs font-medium tracking-tight text-white/80">
                  {dragging ? "Solte para carregar" : "Arraste uma imagem"}
                </p>
                <p
                  className={`text-[10px] text-white/30 ${dragging ? "invisible" : ""}`}
                >
                  ou <span className="text-white/55">clique para escolher</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Format grid ── */}
      <div className="shrink-0 px-3 pt-3">
        <div className="mb-1.5 flex items-baseline justify-between px-0.5">
          <span className="text-[10px] font-medium tracking-wide text-white/40 uppercase">
            Converter para
          </span>
          <span className="text-[9.5px] text-white/30">{selected.desc}</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {FORMATS.map((f) => {
            const active = f.value === selectedFormat;
            const isSource = file?.format === f.value;
            return (
              <button
                key={f.value}
                title={isSource ? `${f.desc} · formato atual` : f.desc}
                onClick={() => {
                  if (f.value === selectedFormat) return;
                  setSelectedFormat(f.value);
                  resetResult();
                }}
                className={`relative h-7 rounded-lg text-[10.5px] font-semibold tracking-tight transition-all duration-150 active:scale-95 ${
                  active
                    ? "bg-accent text-white shadow-[0_2px_8px_rgba(10,132,255,0.4)]"
                    : "bg-white/[0.06] text-white/65 hover:bg-white/[0.12] hover:text-white/90"
                }`}
              >
                {f.value}
                {isSource && (
                  <span
                    className={`absolute top-1 right-1 h-1 w-1 rounded-full ${
                      active ? "bg-white/80" : "bg-white/40"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Toasts ── */}
      <div className="pointer-events-none absolute inset-x-3 bottom-[56px] z-50">
        {saved && file && (
          <Toast tone="success">
            <p className="text-[11px] font-semibold tracking-tight text-white/90">
              Imagem salva
            </p>
            <p className="truncate text-[9.5px] text-white/40">
              {saved}
            </p>
          </Toast>
        )}
        {!saved && errorMsg && (
          <Toast tone="error">
            <p className="line-clamp-3 text-[10.5px] leading-snug tracking-tight text-[#ff8a80]">
              {errorMsg}
            </p>
          </Toast>
        )}
      </div>

      {/* ── Action ── */}
      <div className="mt-auto shrink-0 px-3 pb-3.5">
        {status === "done" && convertedUrl ? (
          <button
            onClick={handleSave}
            className={`flex h-8 w-full items-center justify-center gap-1.5 rounded-[9px] text-[11.5px] font-semibold tracking-tight transition-all duration-200 active:scale-[0.98] ${
              saved
                ? "bg-success/15 text-success ring-1 ring-success/40"
                : "bg-success text-white shadow-[0_2px_10px_rgba(52,199,89,0.35)] hover:brightness-110"
            }`}
          >
            {saved ? (
              <>
                <CheckIcon className="animate-check-pop" />
                Salvo
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path
                    d="M5.5 1.5v5M3.5 4.5l2 2 2-2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M1.5 9h8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Salvar {selectedFormat}
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleConvert}
            disabled={!file || status === "loading"}
            className={`flex h-8 w-full items-center justify-center gap-2 rounded-[9px] text-[11.5px] font-semibold tracking-tight transition-all duration-200 ${
              !file
                ? "cursor-not-allowed bg-white/[0.04] text-white/20"
                : status === "loading"
                  ? "cursor-wait bg-accent/60 text-white/80"
                  : "bg-accent text-white shadow-[0_2px_10px_rgba(10,132,255,0.35)] hover:brightness-110 active:scale-[0.98]"
            }`}
          >
            {status === "loading" ? (
              <>
                <span className="h-3 w-3 animate-spin-fast rounded-full border-[1.5px] border-white/25 border-t-white" />
                Convertendo…
              </>
            ) : !file ? (
              "Escolha uma imagem"
            ) : status === "error" ? (
              "Tentar novamente"
            ) : (
              <>
                {file.format && (
                  <span className="text-white/60">{file.format} →</span>
                )}
                {selectedFormat}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function Toast({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  const success = tone === "success";
  return (
    <div
      className={`flex animate-fade-up items-center gap-2 rounded-[10px] border bg-[rgba(30,30,34,0.95)] px-3 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl ${
        success ? "border-white/15" : "border-danger/30"
      }`}
    >
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          success
            ? "border-success/40 bg-success/20 text-success"
            : "border-danger/40 bg-danger/20 text-danger"
        }`}
      >
        {success ? (
          <CheckIcon className="animate-check-pop" />
        ) : (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path
              d="M1 1l6 6M7 1L1 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      className={className}
    >
      <path
        d="M1.5 5l2.5 2.5 4.5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
