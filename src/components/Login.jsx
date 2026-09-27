import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Wordmark from '@/components/Wordmark'
import logoMark from '@/assets/miu-logo-badge.svg'
import heroPhoto from '@/assets/heroic-brevities.jpg'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState('signin')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) setError(error.message)
    // On success, App.jsx's onAuthStateChange listener picks up the new session.
  }

  return (
    <section className="flex min-h-screen items-center justify-center bg-[#dfcba8] p-4 sm:p-6">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-[24px] bg-white shadow-[0px_12px_40px_0px_rgba(28,38,30,0.04)] md:h-[600px] md:max-w-[986px] md:flex-row">
        <div className="relative hidden shrink-0 flex-col justify-between overflow-hidden md:flex md:w-[40%] md:p-6 lg:w-[472px] lg:p-12">
          <img src={heroPhoto} alt="" className="absolute inset-0 size-full object-cover" />
          <div aria-hidden className="absolute inset-0 bg-[rgba(63,94,61,0.2)]" />
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,37,24,0.48),transparent_45%,rgba(24,37,24,0.54))]" />

          <div className="relative z-10 flex flex-col items-center gap-2">
            <img src={logoMark} alt="" className="w-40 lg:w-64" />
            <Wordmark size="lg" tone="light" className="text-center" />
          </div>

          <div className="relative z-10 flex flex-col gap-2">
            <p className="font-['Instrument_Serif'] text-5xl leading-none text-white">MIU matcha cafe</p>
            <p className="font-['Instrument_Sans_Variable'] text-sm font-medium uppercase text-white/[0.94]">
              Inventory system
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col justify-between p-8 sm:p-12 md:min-w-0 md:flex-1 md:p-8 lg:p-16">
          <div className="mb-8 flex items-center gap-3 md:mb-10">
            <img src={logoMark} alt="MIU In-Venti-ry" className="h-12 w-12 object-contain" />
            <Wordmark size="sm" tone="dark" />
          </div>

          {mode === 'signin' ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-8 text-left">
              <p className="font-['Instrument_Sans_Variable'] text-sm text-[#526055]">
                Sign in to manage stock levels and logs
              </p>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email" className="font-['Instrument_Sans_Variable'] text-[13px] font-semibold text-[#526055]">
                    Username or Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@miumatcha.jp"
                    autoComplete="email"
                    required
                    className="h-auto rounded-lg border-[#e4e3db] p-3 font-['Instrument_Sans_Variable'] text-sm text-[#1e261f] placeholder:text-[#87968b] focus-visible:border-primary focus-visible:ring-primary/25"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="font-['Instrument_Sans_Variable'] text-[13px] font-semibold text-[#526055]">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => setMode('reset')}
                      className="font-['Instrument_Sans_Variable'] text-xs font-semibold text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className="h-auto rounded-lg border-[#e4e3db] p-3 pr-10 font-['Instrument_Sans_Variable'] text-sm text-[#1e261f] focus-visible:border-primary focus-visible:ring-primary/25"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#87968b] hover:text-[#526055] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {error && <p className="font-['Instrument_Sans_Variable'] text-sm text-destructive">{error}</p>}

              <div className="flex flex-col gap-4">
                <Button type="submit" disabled={loading} className="h-auto rounded-lg p-3.5 font-['Instrument_Sans_Variable'] text-[15px] font-semibold">
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
                <p className="text-center font-['Instrument_Sans_Variable'] text-[13px] text-[#87968b]">
                  Need access? Contact Admin
                </p>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-8 text-left">
              <p className="font-['Instrument_Sans_Variable'] text-sm text-[#526055]">
                Password resets aren&apos;t self-service yet — email your cafe admin and ask them to reset it for you from the Supabase dashboard.
              </p>
              {/* A real reset flow can replace this message once an update-password page exists. */}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="self-start font-['Instrument_Sans_Variable'] text-[13px] font-semibold text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                ← Back to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
