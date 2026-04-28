/**
 * Volunteer route group layout.
 * Mobile-first; carries the active-mission persistent banner once a match is accepted.
 */
export default function VolunteerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col">
      {children}
    </div>
  );
}
