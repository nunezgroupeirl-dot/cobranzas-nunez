"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Página A4 para imprimir y pegar en la oficina: QR que lleva a /consulta */
export default function PaginaQr() {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    const destino = `${window.location.origin}/consulta`;
    setUrl(destino);
    QRCode.toDataURL(destino, { width: 900, margin: 1, errorCorrectionLevel: "H", color: { dark: "#1d2a2f", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, []);

  return (
    <main className="min-h-dvh bg-neutral-200 py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 0; }`}</style>
      <div className="no-imprimir mx-auto mb-4 flex max-w-[210mm] justify-end px-4">
        <button onClick={() => window.print()} className="min-h-12 rounded-xl bg-marca px-6 font-semibold text-white">
          Imprimir
        </button>
      </div>
      <article className="mx-auto flex h-[297mm] w-[210mm] flex-col items-center justify-between bg-white px-[18mm] py-[20mm] text-center shadow-xl print:shadow-none">
        <header className="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-28 w-auto object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
          <p className="text-sm font-semibold tracking-[0.3em] text-tenue uppercase">Cobranzas Núñez</p>
          <h1 className="text-5xl leading-tight font-extrabold">
            Consulta tu deuda
            <br />y tu cronograma
          </h1>
        </header>

        <div className="flex flex-col items-center gap-4">
          {qr ? <img src={qr} alt={`Código QR para ${url}`} className="size-[110mm]" /> : <div className="size-[110mm] animate-pulse rounded-2xl bg-fondo" />}
          <p className="text-2xl font-bold">Escanea con la cámara de tu celular</p>
        </div>

        <footer className="flex flex-col items-center gap-2">
          <p className="text-xl">
            1. Escanea el código · 2. Escribe tu <b>DNI</b> · 3. Mira cuánto debes
          </p>
          <p className="font-mono text-lg text-tenue">{url}</p>
        </footer>
      </article>
    </main>
  );
}
