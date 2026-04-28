/**
 * Coordinator dashboard route group layout.
 * Desktop-first; widescreen Bloomberg-terminal-grade canvas.
 */
export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex min-h-dvh w-full flex-col">
      {children}
    </div>
  );
}
