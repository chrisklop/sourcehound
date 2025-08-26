import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function GET() {
  try {
    // Check if API key exists
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "GEMINI_API_KEY not found in environment variables"
      })
    }

    console.log("[Test] Testing Gemini API with key:", process.env.GEMINI_API_KEY.substring(0, 10) + "...")

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    
    // Test with Gemini Flash (lower rate limits)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    
    const result = await model.generateContent("Say 'Hello from Gemini!' in JSON format: {\"message\": \"Hello from Gemini!\"}")
    const response = result.response.text()
    
    console.log("[Test] Gemini response:", response)
    
    return NextResponse.json({
      success: true,
      model: "gemini-1.5-flash",
      response: response,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error("[Test] Gemini API test failed:", error)
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const isRateLimit = errorMessage.includes('429') || errorMessage.includes('quota')
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      isRateLimit,
      timestamp: new Date().toISOString()
    }, { status: isRateLimit ? 429 : 500 })
  }
}