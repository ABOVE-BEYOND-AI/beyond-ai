'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useGoogleAuth } from '@/components/google-auth-provider-clean'
import { useRouter } from 'next/navigation'
import { FallingPattern } from '@/components/ui/falling-pattern'
import dynamic from 'next/dynamic'

const UnicornScene = dynamic(() => import('unicornstudio-react/next'), { ssr: false })

const GoogleIcon = () => (
  <svg className="w-[15px] h-[15px] shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 01-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
)

export default function SignInPage() {
  const { user, loading, signIn } = useGoogleAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!panelRef.current || !glowRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    glowRef.current.style.opacity = '1'
    glowRef.current.style.background = `radial-gradient(600px circle at ${x}px ${y}px, rgba(255,255,255,0.06), transparent 40%)`
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (!glowRef.current) return
    glowRef.current.style.opacity = '0'
  }, [])

  useEffect(() => {
    if (user && !loading) {
      router.push('/itinerary')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="h-screen bg-[#000000] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
      </div>
    )
  }

  if (user) return null

  return (
    <>
      <style>{`
        @keyframes signin-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes signin-scale-in {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .si-fade-up {
          animation: signin-fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .si-scale-in {
          animation: signin-scale-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .si-d1 { animation-delay: 150ms; }
        .si-d2 { animation-delay: 300ms; }
        .si-d3 { animation-delay: 450ms; }

        .signin-page ::selection {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }

        /* ── 3D Button ── */
        @keyframes btn-glow-loop {
          0%, 100% { box-shadow: 0 0 16px 2px rgba(255,255,255,0.04), 0 0 40px 8px rgba(255,255,255,0.02); }
          50% { box-shadow: 0 0 24px 6px rgba(255,255,255,0.09), 0 0 60px 12px rgba(255,255,255,0.04); }
        }
        @keyframes btn-shimmer {
          0% { transform: translateX(-200%) skewX(-20deg); }
          100% { transform: translateX(300%) skewX(-20deg); }
        }
        @keyframes btn-ring-breathe {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }

        /* Glassy outer shell — floating outline effect */
        .btn-3d-outer {
          position: relative;
          border-radius: 16px;
          padding: 4px;
          background: linear-gradient(180deg,
            rgba(255,255,255,0.18) 0%,
            rgba(255,255,255,0.06) 50%,
            rgba(255,255,255,0.02) 100%
          );
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.08),
            0 1px 3px rgba(0,0,0,0.4),
            0 6px 16px rgba(0,0,0,0.3),
            0 16px 40px rgba(0,0,0,0.2);
          animation: btn-glow-loop 4s ease-in-out infinite;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn-3d-outer:hover {
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.14),
            0 2px 6px rgba(0,0,0,0.35),
            0 10px 24px rgba(0,0,0,0.25),
            0 24px 56px rgba(0,0,0,0.2);
          transform: translateY(-1px);
        }

        .btn-3d-outer:active {
          transform: translateY(1px);
        }

        /* Floating 1px ring — outside the glassy shell */
        .btn-3d-outer::before {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 19px;
          border: 1px solid rgba(255,255,255,0.08);
          pointer-events: none;
          animation: btn-ring-breathe 4s ease-in-out infinite;
        }

        .btn-3d {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 46px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          overflow: hidden;
          background: linear-gradient(180deg, #ffffff 0%, #f5f5f5 40%, #ebebeb 100%);
          box-shadow:
            /* Deep inner light — top shelf */
            inset 0 2px 0 0 rgba(255,255,255,1),
            inset 0 8px 4px -2px rgba(255,255,255,0.25),
            /* Inner depth — bottom shadow */
            inset 0 -2px 0 0 rgba(0,0,0,0.06),
            inset 0 -8px 6px -4px rgba(0,0,0,0.08),
            /* Inner side shadows for curvature */
            inset 2px 0 4px -1px rgba(0,0,0,0.03),
            inset -2px 0 4px -1px rgba(0,0,0,0.03),
            /* External depth stack */
            0 1px 1px rgba(0,0,0,0.35),
            0 2px 4px rgba(0,0,0,0.25),
            0 4px 8px rgba(0,0,0,0.15);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn-3d:hover {
          background: linear-gradient(180deg, #ffffff 0%, #fafafa 40%, #f0f0f0 100%);
          box-shadow:
            inset 0 2px 0 0 rgba(255,255,255,1),
            inset 0 10px 6px -2px rgba(255,255,255,0.3),
            inset 0 -2px 0 0 rgba(0,0,0,0.04),
            inset 0 -6px 4px -4px rgba(0,0,0,0.06),
            inset 2px 0 4px -1px rgba(0,0,0,0.02),
            inset -2px 0 4px -1px rgba(0,0,0,0.02),
            0 1px 1px rgba(0,0,0,0.3),
            0 3px 6px rgba(0,0,0,0.2),
            0 6px 12px rgba(0,0,0,0.1);
        }

        .btn-3d:active {
          background: linear-gradient(180deg, #e8e8e8 0%, #e4e4e4 50%, #e0e0e0 100%);
          box-shadow:
            inset 0 3px 6px rgba(0,0,0,0.12),
            inset 0 1px 2px rgba(0,0,0,0.08),
            0 1px 1px rgba(0,0,0,0.15);
        }

        /* Shimmer — sweeps across the inner button */
        .btn-3d::after {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 40%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
          transform: translateX(-200%) skewX(-20deg);
          animation: btn-shimmer 5s ease-in-out infinite;
          animation-delay: 1.5s;
          pointer-events: none;
        }

        /* Top bevel highlight — gives that curved glass top-edge */
        .btn-3d::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 55%;
          background: linear-gradient(180deg,
            rgba(255,255,255,0.35) 0%,
            rgba(255,255,255,0.08) 40%,
            transparent 100%
          );
          pointer-events: none;
          border-radius: 12px 12px 0 0;
        }

        /* Flip text */
        .btn-flip {
          overflow: hidden;
          height: 18px;
        }
        .btn-flip-track {
          display: flex;
          flex-direction: column;
          transition: transform 0.45s cubic-bezier(0.76, 0, 0.24, 1);
        }
        .btn-3d:hover .btn-flip-track {
          transform: translateY(-18px);
        }
        .btn-flip-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 18px;
          flex-shrink: 0;
        }
        .btn-text {
          font-size: 13px;
          font-weight: 600;
          color: #1a1a1a;
          white-space: nowrap;
          letter-spacing: -0.01em;
          line-height: 18px;
        }
      `}</style>

      <div className="signin-page h-screen bg-[#000000] flex overflow-hidden p-5 gap-5">
        {/* Left Panel */}
        <div
          ref={panelRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={`relative w-full lg:w-1/2 shrink-0 rounded-[24px] bg-[#111111] overflow-hidden flex items-center ${
            mounted ? 'si-scale-in si-d1' : 'opacity-0'
          }`}
        >
          {/* Mouse-follow glow */}
          <div
            ref={glowRef}
            className="absolute inset-0 z-[1] pointer-events-none transition-opacity duration-500"
            style={{ opacity: 0 }}
          />

          {/* Falling pattern background */}
          <div className="absolute inset-0">
            <FallingPattern
              color="rgba(255,255,255,0.5)"
              backgroundColor="#111111"
              duration={120}
              blurIntensity="0.6em"
              density={1}
              className="h-full"
            />
          </div>

          {/* Content */}
          <div className="relative z-10 w-full max-w-[340px] px-10 lg:pl-16 xl:pl-20">
            <h1
              className={`text-[2.5rem] font-[300] text-white tracking-[-0.02em] leading-[1.1] mb-3 whitespace-nowrap ${
                mounted ? 'si-fade-up si-d2' : 'opacity-0'
              }`}
            >
              Welcome back
            </h1>
            <p
              className={`text-white/25 text-[13px] leading-relaxed mb-8 whitespace-nowrap ${
                mounted ? 'si-fade-up si-d2' : 'opacity-0'
              }`}
            >
              Sign into your Above + Beyond Account
            </p>

            <div className={mounted ? 'si-fade-up si-d3' : 'opacity-0'}>
              <div className="btn-3d-outer" onClick={signIn}>
                <button className="btn-3d" type="button">
                  <div className="btn-flip">
                    <div className="btn-flip-track">
                      <div className="btn-flip-row">
                        <GoogleIcon />
                        <span className="btn-text">Sign in with Google</span>
                      </div>
                      <div className="btn-flip-row">
                        <GoogleIcon />
                        <span className="btn-text">Sign in with Google</span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div
          className={`hidden lg:block flex-1 ${
            mounted ? 'si-scale-in si-d2' : 'opacity-0'
          }`}
        >
          <div className="relative w-full h-full rounded-[24px] overflow-hidden bg-[#161616]">
            <UnicornScene
              projectId="rfAtN6LSVvJN9B0thcVW"
              sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js"
              width="100%"
              height="100%"
            />
          </div>
        </div>
      </div>
    </>
  )
}
