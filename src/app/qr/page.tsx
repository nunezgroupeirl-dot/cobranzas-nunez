"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Marca } from "@/components/layout/Marca";

/** Página A4 para imprimir y pegar en la oficina: QR que lleva a /consulta */
export default function PaginaQr() {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    const destino = `${window.location.origin}/consulta`;
    setUrl(destino);
    QRCode.toDataURL(destino, { width: 900, margin: 1, errorCorrectionLevel: "H", color: { dark: "#141414", light: "#ffffff" } })
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
        <header className="flex flex-col items-center gap-5">
          <Marca grande />
          <h1 className="text-6xl leading-tight font-bold">
            Consulta tu deuda
            <br />y tu próximo pago
          </h1>
        </header>

        <div className="flex flex-col items-center gap-4">
          {qr ? <img src={qr} alt={`Código QR para ${url}`} className="size-[110mm]" /> : <div className="size-[110mm] animate-pulse rounded-2xl bg-fondo" />}
          <p className="text-2xl font-bold">Escanea con la cámara de tu celular</p>
        </div>

        <footer className="flex flex-col items-center gap-2">
          <ol className="flex gap-8 text-xl">
            <li>
              <b>1.</b> Escanea el código
            </li>
            <li>
              <b>2.</b> Escribe tu <b>DNI</b>
            </li>
            <li>
              <b>3.</b> Mira cuánto debes
            </li>
          </ol>
          <p className="text-lg text-tenue">{url}</p>
        </footer>
      </article>
    </main>
  );
}
