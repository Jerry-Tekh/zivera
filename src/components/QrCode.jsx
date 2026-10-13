import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QrCode({ value }) {
  const [src, setSrc] = useState('');
  useEffect(() => { QRCode.toDataURL(value, { margin: 1, width: 180 }).then(setSrc); }, [value]);
  if (!src) return <span role="status">Preparing ticket QR code…</span>;
  return <img src={src} alt={`ticket ${value}`} width={180} height={180} style={{ display: 'block' }} />;
}
