'use client'

import { useState } from 'react'

export default function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch('/api/profile/delete', { method: 'POST' })
    if (res.ok) {
      window.location.href = '/auth/login'
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to delete account')
      setDeleting(false)
    }
  }

  if (confirming) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-300 font-medium">Are you sure? This is permanent.</p>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors"
          >
            {deleting ? 'Deleting...' : 'Yes, delete my account'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-4 py-2 bg-red-950/60 hover:bg-red-900/60 border border-red-800/50 rounded-lg text-sm text-red-300 font-semibold transition-colors"
    >
      Delete Account
    </button>
  )
}
