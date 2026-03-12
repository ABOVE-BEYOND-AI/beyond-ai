export default function TVLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden" style={{ cursor: "none" }}>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.classList.add('dark');`,
        }}
      />
      {children}
    </div>
  );
}
