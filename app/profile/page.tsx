import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import EditName from '@/app/components/EditName'
import DeleteAccountButton from '@/app/components/DeleteAccountButton'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white transition-colors">
            ← Back to Dashboard
          </Link>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-6">Your Profile</h1>

        {/* Name */}
        <div className="bg-gray-800 rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-lg mb-0.5">Your Name</h2>
          <EditName userId={user.id} initialName={profile?.name ?? ''} />
        </div>

        {/* Game library */}
        <div className="bg-gray-800 rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-lg mb-1">Game Library</h2>
          <p className="text-gray-400 text-sm mb-3">
            Re-import your BoardGameGeek collection or upload a new CSV.
          </p>
          <Link
            href="/bgg/connect"
            className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-semibold transition-colors"
          >
            Manage Collection
          </Link>
        </div>

        {/* Danger zone */}
        <div className="bg-gray-800 rounded-xl p-5 border border-red-900/40">
          <h2 className="font-semibold text-lg mb-1 text-red-400">Danger Zone</h2>
          <p className="text-gray-400 text-sm mb-3">
            Permanently delete your account and all session data. This cannot be undone.
          </p>
          <DeleteAccountButton />
        </div>
      </div>
    </div>
  )
}
