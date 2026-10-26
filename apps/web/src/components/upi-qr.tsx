"use client";

import { useEffect, useState } from "react";

/**
 * UPI QR — browser me hi banta hai (koi API nahi), isliye GitHub Pages par bhi chalta hai.
 * `qrcode` sirf tab load hota hai jab QR dikhna hota hai (bundle chhota rehta hai).
 */
export function UpiQr({
  uri,
  alt,
  className = "",
  size = 320,
}: {
  uri: string;
  alt: string;
  className?: string;
  size?: number;
}) {
  /**
   * `uri`/`size` badalne par purana QR na dikhe — isliye result ke saath uska "key"
   * bhi rakhte hain aur render me derive karte hain (effect me `setSrc(null)` nahi).
   */
  const [qr, setQr] = useState<{ key: string; src: string } | null>(null);
  const key = `${uri}|${size}`;
  const src = qr?.key === key ? qr.src : null;

  useEffect(() => {
    let active = true;
    import("qrcode")
      .then((mod) =>
        (mod.default ?? mod).toDataURL(uri, {
          margin: 1,
          width: size,
          errorCorrectionLevel: "M",
          color: { dark: "#6f1d2b", light: "#ffffff" },
        }),
      )
      .then((url: string) => {
        if (active) setQr({ key, src: url });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [key, uri, size]);

  if (!src) {
    return (
      <div className={`flex items-center justify-center text-[10px] text-[#a49a90] ${className}`}>
        Loading QR…
      </div>
    );
  }

  return (
     
    <img src={src} alt={alt} className={className} />
  );
}
