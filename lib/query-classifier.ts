/**
 * Intelligent query classifier for domain-specific API routing
 * Determines the most appropriate data sources based on query content
 */

export interface QueryContext {
  domain: string
  confidence: number
  keywords: string[]
  suggestedAPIs: string[]
}

export interface DomainPattern {
  domain: string
  keywords: string[]
  patterns: RegExp[]
  weight: number
}

// Domain classification patterns
const DOMAIN_PATTERNS: DomainPattern[] = [
  {
    domain: 'academic',
    keywords: ['study', 'research', 'paper', 'journal', 'university', 'scholar', 'academic', 'peer-reviewed', 'citation', 'methodology', 'hypothesis', 'analysis', 'meta-analysis', 'systematic review'],
    patterns: [
      /\b(peer.?reviewed|academic|scholarly|research)\b/i,
      /\b(study|studies|research|paper|journal)\b/i,
      /\b(university|college|institution)\b/i,
      /\b(methodology|hypothesis|analysis|findings)\b/i
    ],
    weight: 1.0
  },
  {
    domain: 'biomedical',
    keywords: ['health', 'medical', 'disease', 'treatment', 'drug', 'medicine', 'clinical', 'patient', 'diagnosis', 'therapy', 'vaccine', 'virus', 'bacteria', 'infection', 'symptom', 'pharmaceutical', 'FDA', 'CDC', 'WHO'],
    patterns: [
      /\b(health|medical|medicine|clinical)\b/i,
      /\b(disease|illness|condition|disorder)\b/i,
      /\b(treatment|therapy|drug|medication|vaccine)\b/i,
      /\b(patient|doctor|physician|hospital)\b/i,
      /\b(FDA|CDC|WHO|NIH)\b/i,
      /\b(virus|bacteria|infection|pathogen)\b/i
    ],
    weight: 1.2
  },
  {
    domain: 'physics',
    keywords: ['physics', 'quantum', 'particle', 'energy', 'force', 'gravity', 'electromagnetic', 'relativity', 'thermodynamics', 'mechanics', 'optics', 'nuclear', 'atomic', 'molecular', 'wave', 'frequency'],
    patterns: [
      /\b(physics|quantum|particle|atom)\b/i,
      /\b(energy|force|gravity|electromagnetic)\b/i,
      /\b(relativity|thermodynamics|mechanics)\b/i,
      /\b(nuclear|atomic|molecular)\b/i
    ],
    weight: 1.1
  },
  {
    domain: 'mathematics',
    keywords: ['math', 'mathematics', 'equation', 'theorem', 'proof', 'algorithm', 'calculus', 'algebra', 'geometry', 'statistics', 'probability', 'number theory', 'topology', 'logic'],
    patterns: [
      /\b(math|mathematics|mathematical)\b/i,
      /\b(equation|theorem|proof|algorithm)\b/i,
      /\b(calculus|algebra|geometry|statistics)\b/i,
      /\b(probability|logic|topology)\b/i
    ],
    weight: 1.1
  },
  {
    domain: 'computer_science',
    keywords: ['computer', 'software', 'programming', 'algorithm', 'data', 'artificial intelligence', 'machine learning', 'AI', 'ML', 'neural network', 'database', 'cybersecurity', 'blockchain', 'cryptocurrency'],
    patterns: [
      /\b(computer|software|programming|algorithm)\b/i,
      /\b(AI|ML|artificial.intelligence|machine.learning)\b/i,
      /\b(neural.network|deep.learning|data.science)\b/i,
      /\b(database|cybersecurity|blockchain|crypto)\b/i
    ],
    weight: 1.1
  },
  {
    domain: 'clinical',
    keywords: ['clinical trial', 'trial', 'randomized', 'controlled', 'placebo', 'intervention', 'treatment group', 'control group', 'efficacy', 'safety', 'adverse event', 'protocol', 'IRB', 'consent'],
    patterns: [
      /\b(clinical.trial|trial|study.protocol)\b/i,
      /\b(randomized|controlled|placebo|intervention)\b/i,
      /\b(treatment.group|control.group|efficacy|safety)\b/i,
      /\b(adverse.event|side.effect|IRB|consent)\b/i
    ],
    weight: 1.3
  },
  {
    domain: 'economic',
    keywords: ['economy', 'economic', 'GDP', 'inflation', 'unemployment', 'trade', 'market', 'finance', 'banking', 'currency', 'investment', 'stock', 'recession', 'growth', 'development', 'World Bank', 'IMF'],
    patterns: [
      /\b(economy|economic|GDP|inflation|unemployment)\b/i,
      /\b(trade|market|finance|banking|currency)\b/i,
      /\b(investment|stock|recession|growth|development)\b/i,
      /\b(World.Bank|IMF|Federal.Reserve|central.bank)\b/i
    ],
    weight: 1.2
  },
  {
    domain: 'environmental',
    keywords: ['climate', 'environment', 'weather', 'storm', 'hurricane', 'earthquake', 'flood', 'wildfire', 'tsunami', 'volcano', 'natural disaster', 'global warming', 'carbon', 'emissions', 'pollution'],
    patterns: [
      /\b(climate|environment|weather|global.warming)\b/i,
      /\b(storm|hurricane|earthquake|flood|wildfire)\b/i,
      /\b(tsunami|volcano|natural.disaster|catastrophe)\b/i,
      /\b(carbon|emissions|pollution|greenhouse)\b/i
    ],
    weight: 1.2
  },
  {
    domain: 'biodiversity',
    keywords: ['species', 'animal', 'plant', 'biodiversity', 'ecosystem', 'habitat', 'conservation', 'endangered', 'extinction', 'wildlife', 'fauna', 'flora', 'taxonomy', 'biology'],
    patterns: [
      /\b(species|animal|plant|biodiversity)\b/i,
      /\b(ecosystem|habitat|conservation|endangered)\b/i,
      /\b(extinction|wildlife|fauna|flora)\b/i,
      /\b(taxonomy|biology|organism|genus)\b/i
    ],
    weight: 1.1
  },
  {
    domain: 'legal',
    keywords: ['law', 'legal', 'regulation', 'policy', 'government', 'federal', 'court', 'judge', 'ruling', 'legislation', 'bill', 'act', 'statute', 'constitutional', 'supreme court', 'congress'],
    patterns: [
      /\b(law|legal|regulation|policy|government)\b/i,
      /\b(federal|court|judge|ruling|legislation)\b/i,
      /\b(bill|act|statute|constitutional)\b/i,
      /\b(supreme.court|congress|senate|house)\b/i
    ],
    weight: 1.1
  },
  {
    domain: 'news',
    keywords: ['news', 'current events', 'breaking', 'media', 'journalist', 'reporter', 'press', 'headline', 'story', 'coverage', 'investigation', 'scandal', 'politics', 'election'],
    patterns: [
      /\b(news|current.events|breaking|media)\b/i,
      /\b(journalist|reporter|press|headline)\b/i,
      /\b(story|coverage|investigation|scandal)\b/i,
      /\b(politics|election|campaign|vote)\b/i
    ],
    weight: 0.9
  }
]

/**
 * Classifies a query to determine the most appropriate domain and APIs
 */
export function classifyQuery(query: string): QueryContext {
  const normalizedQuery = query.toLowerCase().trim()
  const domainScores: { [domain: string]: number } = {}
  const matchedKeywords: { [domain: string]: string[] } = {}

  // Score each domain based on keyword and pattern matches
  for (const domainPattern of DOMAIN_PATTERNS) {
    let score = 0
    const keywords: string[] = []

    // Check keyword matches
    for (const keyword of domainPattern.keywords) {
      if (normalizedQuery.includes(keyword.toLowerCase())) {
        score += 1
        keywords.push(keyword)
      }
    }

    // Check regex pattern matches (higher weight)
    for (const pattern of domainPattern.patterns) {
      if (pattern.test(normalizedQuery)) {
        score += 2
      }
    }

    // Apply domain weight
    score *= domainPattern.weight

    if (score > 0) {
      domainScores[domainPattern.domain] = score
      matchedKeywords[domainPattern.domain] = keywords
    }
  }

  // Find the highest scoring domain
  const sortedDomains = Object.entries(domainScores)
    .sort(([,a], [,b]) => b - a)

  if (sortedDomains.length === 0) {
    return {
      domain: 'general',
      confidence: 0.5,
      keywords: [],
      suggestedAPIs: ['perplexity', 'google_factcheck']
    }
  }

  const [topDomain, topScore] = sortedDomains[0]
  const confidence = Math.min(topScore / 10, 1.0) // Normalize to 0-1

  return {
    domain: topDomain,
    confidence,
    keywords: matchedKeywords[topDomain] || [],
    suggestedAPIs: getSuggestedAPIs(topDomain)
  }
}

/**
 * Returns the suggested APIs for a given domain
 */
function getSuggestedAPIs(domain: string): string[] {
  const apiMappings: { [domain: string]: string[] } = {
    'academic': ['openalex', 'perplexity'],
    'biomedical': ['pubmed', 'clinicaltrials', 'perplexity'],
    'physics': ['arxiv', 'openalex', 'perplexity'],
    'mathematics': ['arxiv', 'openalex', 'perplexity'],
    'computer_science': ['arxiv', 'openalex', 'perplexity'],
    'clinical': ['clinicaltrials', 'pubmed', 'perplexity'],
    'economic': ['worldbank', 'perplexity'],
    'environmental': ['nasa_eonet', 'perplexity'],
    'biodiversity': ['gbif', 'perplexity'],
    'legal': ['federalregister', 'perplexity'],
    'news': ['gdelt', 'google_factcheck', 'perplexity'],
    'general': ['perplexity', 'google_factcheck']
  }

  return apiMappings[domain] || ['perplexity', 'google_factcheck']
}

/**
 * Get human-readable description of the domain
 */
export function getDomainDescription(domain: string): string {
  const descriptions: { [domain: string]: string } = {
    'academic': 'Academic Research & Scholarly Literature',
    'biomedical': 'Biomedical & Health Sciences',
    'physics': 'Physics & Physical Sciences',
    'mathematics': 'Mathematics & Mathematical Sciences',
    'computer_science': 'Computer Science & Technology',
    'clinical': 'Clinical Trials & Medical Research',
    'economic': 'Economics & Financial Data',
    'environmental': 'Environmental & Natural Events',
    'biodiversity': 'Biodiversity & Species Data',
    'legal': 'Legal & Regulatory Information',
    'news': 'News & Current Events',
    'general': 'General Knowledge & Web Search'
  }

  return descriptions[domain] || 'General Information'
}