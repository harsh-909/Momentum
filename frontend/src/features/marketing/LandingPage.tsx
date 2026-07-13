import type { ReactNode } from 'react'
import { Button } from '../../components/Button'
import { ThemeToggle } from '../../components/ThemeToggle'
import {
  BoxArrowIcon,
  CalendarIcon,
  RotateIcon,
  SunIcon,
} from '../today/icons'
import { HeroDial } from './HeroDial'

/**
 * Public marketing page - the front door for anonymous visitors. Explains
 * what Momentum is, its capabilities, and how to use it, then hands off to
 * sign-in via `onGetStarted`. Content is kept truthful to FEATURES.md.
 */

interface IconProps {
  className?: string
}

/* Two icons the Today set doesn't export, drawn in the same thin-stroke style
   as the History / Metrics tabs. */
function NotebookIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.2 3.8A1.8 1.8 0 0 1 5 2h7.8v10.4H5a1.8 1.8 0 0 0-1.8 1.8z" />
      <path d="M3.2 14A1.8 1.8 0 0 1 5 12.4h7.8" />
    </svg>
  )
}

function TrendIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 2.5v11h11" />
      <path d="M4.8 10.5l2.7-3.1 2 1.9 3.4-4.2" />
    </svg>
  )
}

interface Capability {
  icon: ReactNode
  title: string
  body: string
}

const CAPABILITIES: Capability[] = [
  {
    icon: <SunIcon className="h-5 w-5" />,
    title: 'The Day Dial',
    body: 'A chronograph face for today: each goal is its own arc filling with partial credit, with planned vs. logged hours at a glance.',
  },
  {
    icon: <RotateIcon className="h-5 w-5" />,
    title: 'Habits',
    body: 'Define recurring routines once with a weekday schedule; they appear automatically on the days they are due.',
  },
  {
    icon: <BoxArrowIcon className="h-5 w-5" />,
    title: 'Backlog & carry-over',
    body: 'Whatever you do not finish is carried into a backlog automatically - reschedule it to any day when you are ready.',
  },
  {
    icon: <CalendarIcon className="h-5 w-5" />,
    title: 'Plans',
    body: 'One-off, monthly, or yearly commitments that surface on the right day without cluttering your daily score.',
  },
  {
    icon: <NotebookIcon className="h-5 w-5" />,
    title: 'History',
    body: 'Every past day is a frozen record you can revisit and filter - an honest log of what actually happened.',
  },
  {
    icon: <TrendIcon className="h-5 w-5" />,
    title: 'Momentum metrics',
    body: 'Streaks, completion rates, and hours logged, charted over recent days and weeks so you can see the trend.',
  },
]

interface Step {
  n: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    n: '01',
    title: 'Create your account',
    body: 'Sign up with a username, password, and email - it takes a few seconds and your data is private to you.',
  },
  {
    n: '02',
    title: "Plan today's goals",
    body: 'Add each goal with the time you expect it to take, break it into subtasks, and set up any recurring habits.',
  },
  {
    n: '03',
    title: 'Log time & build the streak',
    body: 'Check goals off and record the hours you actually spent. Keep your day above 70% to grow your streak.',
  },
]

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-8 text-center">
      <div className="font-display text-xs label-caps text-accent-text">{eyebrow}</div>
      <h2 className="mt-2 font-display text-section font-semibold text-ink">{title}</h2>
    </div>
  )
}

export function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 sm:px-6">
      {/* Top bar */}
      <header className="flex items-center justify-between py-4">
        <div className="font-display text-sm label-caps text-accent-text">Momentum</div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="secondary" size="md" onClick={onGetStarted}>
            Log in
          </Button>
        </div>
      </header>

      <hr className="tick-rule" />

      {/* Hero */}
      <section className="grid items-center gap-8 py-12 md:grid-cols-2 md:gap-6 md:py-20">
        <div className="text-center md:text-left">
          <h1 className="font-display text-hero font-semibold leading-tight text-ink">
            Plan your day.
            <br />
            Track the hours.
            <br />
            <span className="text-accent-text">Keep the streak.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base text-muted md:mx-0">
            Momentum is a daily-goals and habit tracker built around one question: how did the time
            you planned compare to the time you actually spent?
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
            <Button variant="primary" size="md" onClick={onGetStarted} className="px-6 py-2.5">
              Get started
            </Button>
            <Button variant="secondary" size="md" onClick={onGetStarted} className="px-6 py-2.5">
              I already have an account
            </Button>
          </div>
        </div>
        <div className="flex justify-center">
          <HeroDial className="h-56 w-56 sm:h-64 sm:w-64" />
        </div>
      </section>

      <hr className="tick-rule" />

      {/* Capabilities */}
      <section className="py-14">
        <SectionHeading eyebrow="What you get" title="Everything in one instrument panel" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <div
              key={c.title}
              className="rounded-card border border-line bg-face p-5 transition-colors duration-150 ease-click hover:border-muted"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-btn border border-line text-accent-text">
                {c.icon}
              </div>
              <h3 className="mt-4 font-display text-base font-semibold text-ink">{c.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="tick-rule" />

      {/* How it works */}
      <section className="py-14">
        <SectionHeading eyebrow="How it works" title="Up and running in three steps" />
        <div className="grid gap-3 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-card border border-line bg-face p-5">
              <div className="font-mono-num text-section font-semibold text-accent-text">{s.n}</div>
              <h3 className="mt-2 font-display text-base font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="tick-rule" />

      {/* Closing CTA */}
      <section className="py-16 text-center">
        <h2 className="font-display text-section font-semibold text-ink">
          Start building momentum today.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Free to use. Your goals, habits, and history stay private to your account.
        </p>
        <div className="mt-6 flex justify-center">
          <Button variant="primary" size="md" onClick={onGetStarted} className="px-6 py-2.5">
            Get started
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto flex flex-col items-center justify-between gap-2 border-t border-line py-6 text-xs text-muted sm:flex-row">
        <span className="font-display label-caps">Momentum</span>
        <span>A daily-goals & habit tracker.</span>
      </footer>
    </div>
  )
}
