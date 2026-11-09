export default function HomePage() {
  return (
    <div
      className="fixed inset-0 z-[100] bg-[#FAF5EC]"
      style={{ height: "100dvh" }}
    >
      <iframe
        id="rutina-frame"
        src="/rutina.html"
        title="Rutina — Konsep Redesain"
        className="h-full w-full border-0"
      />
    </div>
  );
}
