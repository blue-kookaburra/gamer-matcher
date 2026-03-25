'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function EditName({ userId, initialName }: { userId: string; initialName: string }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ name: name.trim() || null })
      .eq('id', userId)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={50}
          autoFocus
          className="flex-1 px-3 py-1 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-indigo-500 text-sm"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => { setName(initialName); setEditing(false) }}
          className="text-sm text-gray-500 hover:text-gray-300"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <p className="text-gray-300 text-sm">
        {name || <span className="text-gray-500 italic">No name set</span>}
      </p>
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-gray-500 hover:text-indigo-400 transition-colors"
      >
        Edit
      </button>
    </div>
  )
}
