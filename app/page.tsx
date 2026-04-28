import Link from 'next/link';
import { ArrowRight, Siren, Users, LayoutDashboard, TestTube } from 'lucide-react';
import { Frame, CornerBrackets, Eyebrow, GoldRule, RomanNumeral } from '@/components/ui/deco';
import { SunburstBackdrop } from '@/components/ui/SunburstBackdrop';

/**
 * SANKALP — Landing / Role Picker
 *
 * The canonical Art Deco reference for the rest of the codebase.
 * - Sunburst-radiated hero with Marcellus all-caps title and gold gradient.
 * - Three doors as framed exhibits (I, II, III) with corner brackets.
 * - Symmetric, centered layout — Art Deco favours bilateral symmetry.
 * - Sharp 0px radii, gold borders that intensify on hover, no soft shadows.
 */
export default function Home() {
  const exhibits = [
    {
      href: '/sos',
      numeral: 1,
      label: 'I need help',
      subtitle: 'Citizen — raise an SOS in your language',
      icon: Siren,
    },
    {
      href: '/missions',
      numeral: 2,
      label: 'I can help',
      subtitle: 'Volunteer — accept a matched mission',
      icon: Users,
    },
    {
      href: '/command',
      numeral: 3,
      label: 'Command center',
      subtitle: 'Coordinator — live operations dashboard',
      icon: LayoutDashboard,
    },
  ] as const;

  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center px-6 py-20">
      {/* ─────────────────────── Sunburst hero backdrop ─────────────────────── */}
      <SunburstBackdrop intensity={0.16} />

      {/* ─────────────────────── Hero ─────────────────────── */}
      <section className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
        <Eyebrow className="flex items-center gap-2">
          <span className="severity-dot text-gold-300" />
          Google Solution Challenge · 2026
        </Eyebrow>

        <GoldRule className="mt-6" width="w-32" />

        <h1 className="mt-6 deco-display text-6xl leading-none text-champagne md:text-8xl">
          <span className="text-gold-metallic">Sankalp</span>
        </h1>
        <div className="mt-2 font-display text-lg tracking-wide text-gold-200/80 md:text-xl">
          संकल्प
        </div>

        <GoldRule className="mt-6" width="w-48" />

        <p className="mt-8 max-w-2xl text-pretty font-sans text-sm leading-relaxed text-champagne/65 md:text-base">
          India&apos;s AI Conductor for Crisis Response. When disaster strikes,
          chaos becomes choreography — every voice, every photo, every plea
          routed to the right volunteer in the right place at the right time.
        </p>
      </section>

      {/* ─────────────────────── Three exhibits ─────────────────────── */}
      <section className="relative z-10 mt-20 grid w-full max-w-5xl gap-5 md:grid-cols-3">
        {exhibits.map(({ href, numeral, label, subtitle, icon: Icon }) => (
          <Link key={href} href={href} className="group block">
            <Frame variant="strong" interactive className="relative h-full p-6">
              <CornerBrackets size="md" />

              {/* Roman numeral exhibit marker */}
              <div className="flex items-start justify-between">
                <div className="text-[10px] uppercase tracking-deco text-gold-300/70">
                  Exhibit
                </div>
                <RomanNumeral
                  value={numeral}
                  className="text-2xl text-gold-300/80"
                />
              </div>

              {/* Icon */}
              <div className="mt-8 flex justify-center">
                <Icon
                  className="h-7 w-7 text-gold-300 transition-transform duration-500 ease-out group-hover:scale-110"
                  strokeWidth={1.4}
                />
              </div>

              {/* Heading */}
              <div className="mt-8 text-center">
                <div className="deco-display text-base text-champagne">{label}</div>
                <div className="mt-3">
                  <GoldRule width="w-12" />
                </div>
                <p className="mt-3 font-sans text-xs leading-relaxed text-champagne/55">
                  {subtitle}
                </p>
              </div>

              {/* CTA */}
              <div className="mt-8 flex items-center justify-center gap-2 text-[10px] uppercase tracking-deco text-gold-300">
                Enter
                <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </Frame>
          </Link>
        ))}
      </section>

      {/* ─────────────────────── Demo control footer link ─────────────────────── */}
      <section className="relative z-10 mt-16 flex flex-col items-center">
        <GoldRule width="w-16" />
        <Link
          href="/demo"
          className="mt-5 inline-flex items-center gap-2 font-sans text-[10px] uppercase tracking-deco text-champagne/45 transition hover:text-gold-300"
        >
          <TestTube className="h-3 w-3" strokeWidth={1.6} />
          Demo control center
          <ArrowRight className="h-3 w-3" />
        </Link>
        <p className="mt-6 font-display text-[10px] uppercase tracking-deco-wide text-champagne/30">
          Built by Team NexusFlow
        </p>
      </section>
    </main>
  );
}
