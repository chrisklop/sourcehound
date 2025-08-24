import { NextResponse } from "next/server"

export async function GET() {
  try {
    return NextResponse.json({ status: "ok", message: "Test API working" })
  } catch (error) {
    console.error("Test API Error:", error)
    return NextResponse.json({ error: "Test failed" }, { status: 500 })
  }
}