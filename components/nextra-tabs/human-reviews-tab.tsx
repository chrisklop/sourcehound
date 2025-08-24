"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { ExternalLink } from "lucide-react"

interface HumanReviewsTabProps {
  factCheckData: any
}

export function HumanReviewsTab({ factCheckData }: HumanReviewsTabProps) {
  const reviews = factCheckData?.factCheckReviews || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Human Fact-Check Reviews</h1>
        <p className="text-muted-foreground">
          Professional fact-checkers have previously reviewed similar claims. Here's what they found:
        </p>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                <ExternalLink className="w-8 h-8 text-muted-foreground" />
              </div>
              <p>No professional fact-check reviews found for similar claims.</p>
              <p className="text-sm mt-2">This analysis relies on AI research and source verification.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review: any, index: number) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg leading-tight mb-2">
                      {review.title || "Fact Check Review"}
                    </CardTitle>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {review.publisher || "Unknown Publisher"}
                      </Badge>
                      {review.reviewedAt && (
                        <span>• {new Date(review.reviewedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  {review.rating && (
                    <Badge variant={
                      review.rating.toLowerCase().includes('true') ? 'default' :
                      review.rating.toLowerCase().includes('false') ? 'destructive' :
                      review.rating.toLowerCase().includes('misleading') ? 'destructive' :
                      'secondary'
                    } className="ml-4">
                      {review.rating}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Professional fact-checker review from {review.publisher}
                  </div>
                  <a
                    href={review.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-primary hover:text-primary/80 text-sm font-medium transition-colors"
                  >
                    <span>Read full review</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Human Review Guidelines */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">About Human Reviews</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Human reviews come from professional fact-checking organizations like FactCheck.org, 
            Snopes, PolitiFact, and AFP Fact Check.
          </p>
          <p>
            These organizations follow strict editorial standards and are often certified by 
            the International Fact-Checking Network (IFCN).
          </p>
          <p>
            When available, human reviews provide valuable context and expert analysis to 
            complement our AI-powered fact-checking.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}