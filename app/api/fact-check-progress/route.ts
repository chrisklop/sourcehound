export const runtime = "nodejs"

import { getProgress } from "../fact-check/progress"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("sessionId")

  if (!sessionId) {
    return new Response("Session ID required", { status: 400 })
  }

  const updates = getProgress(sessionId)

  return Response.json({
    sessionId,
    updates,
    latestUpdate: updates[updates.length - 1] || null,
    isComplete: updates.some((u) => u.status === "completed" && u.progress === 100),
  })
}

