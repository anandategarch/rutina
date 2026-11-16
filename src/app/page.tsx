/* Fallback apabila redirect "/" → "/rutina.html" (next.config.ts) tidak
   berjalan: membungkus shell dalam iframe bersyarat INLINE — sengaja
   TIDAK memakai kelas Tailwind karena cangkang ini sudah tidak lagi
   memuat globals.css/Tailwind sejak pembersihan repo v2.32. */
export default function HomePage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#F8FAFC",
        height: "100dvh",
      }}
    >
      <iframe
        id="rutina-frame"
        src="/rutina.html"
        title="Rutina"
        style={{
          height: "100%",
          width: "100%",
          border: 0,
          display: "block",
        }}
      />
    </div>
  );
}
