import Link from 'next/link';
import { ArrowRight, Siren, Users, LayoutDashboard } from 'lucide-react';

/**
 * SANKALP — Landing / Role Picker
 *
 * Three doors: Citizen (SOS), Volunteer (missions), Coordinator (dashboard).
 * In production this becomes phone-OTP onboarding; for the MVP demo we
 * surface all three so judges can hop between perspectives in seconds.
 */
export default function Home() {
  const doors = [
    {
      href: '/sos',
      title: 'I need help',
      subtitle: 'Citizen — raise an SOS in your language',
      icon: Siren,
      accent: 'from-severity-medical/30 to-transparent',
      ring: 'ring-severity-medical/30',
    },
    {
      href: '/missions',
      title: 'I can help',
      subtitle: 'Volunteer — accept a matched mission',
      icon: Users,
      accent: 'from-sankalp-500/30 to-transparent',
      ring: 'ring-sankalp-500/30',
    },
    {
      href: '/command',
      title: 'Command center',
      subtitle: 'Coordinator — live operations dashboard',
      icon: LayoutDashboard,
      accent: 'from-severity-resolved/30 to-transparent',
      ring: 'ring-severity-resolved/30',
    },
  ] as const;

  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium tracking-wider text-white/70 backdrop-blur">
          <span className="severity-dot text-severity-resolved" />
          GOOGLE SOLUTION CHALLENGE · 2026
        </div>
        <h1 className="mt-4 text-balance text-5xl font-semibold tracking-tight md:text-7xl">
          SANKALP
        </h1>
        <p className="mt-3 text-base text-white/60 md:text-lg">
          संकल्प · India&apos;s AI Conductor for Crisis Response
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-sm leading-relaxed text-white/50 md:text-base">
          When disaster strikes, chaos becomes choreography. SANKALP routes every voice,
          every photo, every plea — to the right volunteer in the right place at the right time.
        </p>
      </div>

      <div className="mt-14 grid w-full max-w-5xl gap-4 md:grid-cols-3">
        {doors.map(({ href, title, subtitle, icon: Icon, accent, ring }) => (
          <Link
            key={href}
            href={href}
            className={`group glass glass-sheen relative flex flex-col gap-4 p-6 transition-all duration-300 hover:-translate-y-1 hover:ring-1 ${ring}`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />
            <Icon className="relative h-6 w-6 text-white/80" strokeWidth={1.5} />
            <div className="relative">
              <h2 className="text-lg font-medium text-white">{title}</h2>
              <p className="mt-1 text-sm text-white/55">{subtitle}</p>
            </div>
            <div className="relative mt-auto flex items-center gap-2 text-sm text-white/70">
              Enter
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-16 text-xs uppercase tracking-[0.2em] text-white/30">
        Built by Team NexusFlow
      </p>
    </main>
  );
}
