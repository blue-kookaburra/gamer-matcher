import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-5xl font-bold mb-4">🎲 Gamer Matcher</h1>
      <p className="text-gray-400 text-lg max-w-md mb-10">
        Stop arguing about what to play. Let everyone vote on game night — Tinder-style.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/auth/signup"
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold transition-colors"
        >
          Host a Game Night
        </Link>
        <Link
          href="/auth/login"
          className="px-8 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold transition-colors"
        >
          Sign In
        </Link>
      </div>
    </div>
  )
}
