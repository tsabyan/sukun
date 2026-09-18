'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { listTasks } from '@/lib/db/repo'

/**
 * Redirects to the first active task's detail screen, carrying the query
 * string along. Task ids are regenerated on every seed, so tooling that needs
 * a stable detail-screen URL points here instead. Development only.
 */
export default function DevTaskPage() {
  const router = useRouter()

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    void listTasks({ status: 'active', sort: 'recent' }).then((tasks) => {
      const task = tasks[0]
      if (!task) return
      const params = new URLSearchParams(window.location.search)
      const query = params.toString()
      router.replace(`/tasks/${task.id}${query ? `?${query}` : ''}`)
    })
  }, [router])

  return null
}
