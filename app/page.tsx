import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="hero-bg min-h-screen text-white flex flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-xs font-semibold uppercase tracking-widest text-gray-500 mb-6">
        Tabletop Tally
      </p>
      <h1 className="font-display text-6xl sm:text-7xl font-black tracking-tight leading-none mb-6">
        <span className="text-brand">Game Night,</span>
        <br />Decided.
      </h1>
      <p className="text-gray-400 text-lg max-w-sm mb-10 leading-relaxed">
        Stop arguing about what to play. Upload your collection, host a session, and swipe to vote!
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-12">
        <Link
          href="/auth/signup"
          className="px-8 py-3 rounded-xl font-semibold btn-gradient"
        >
          Host a Game Night
        </Link>
        <Link
          href="/auth/login"
          className="px-8 py-3 border border-white/20 hover:border-white/40 rounded-xl font-semibold transition-colors"
        >
          Sign In
        </Link>
      </div>

      <p className="text-gray-600 text-xs max-w-xs leading-relaxed">
        Tabletop Tally — Alpha. We make no guarantees about data security or availability. Use at your own risk.
      </p>
    </div>
  )
}
