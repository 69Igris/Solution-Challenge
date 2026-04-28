/**
 * Citizen route group layout.
 * Mobile-first PWA shell. Minimal chrome, maximum touch-target.
 */
export default function CitizenLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col">
      {children}
    </div>
  );
}
