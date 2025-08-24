/**
 * Domain-specific API integrations for intelligent fact-checking
 * Routes queries to the most authoritative sources based on context
 */

export interface SourceResult {
  title: string
  url: string
  abstract?: string
  authors?: string[]
  publishedAt?: string
  publisher?: string
  type: string
  credibilityScore?: number
  metadata?: any
}

export interface APIResponse {
  sources: SourceResult[]
  totalCount: number
  apiUsed: string
  processingTime: number
}

/**
 * OpenAlex API - Academic literature and research papers
 */
export async function queryOpenAlex(query: string, maxResults = 100): Promise<SourceResult[]> {
  const startTime = Date.now()
  
  try {
    const encodedQuery = encodeURIComponent(query)
    const response = await fetch(
      `https://api.openalex.org/works?filter=search:${encodedQuery}&per_page=${Math.min(maxResults, 200)}&sort=relevance_score:desc`,
      {
        headers: {
          'User-Agent': 'GenuVerity-FactChecker (mailto:support@genuverity.com)',
        },
        signal: AbortSignal.timeout(10000)
      }
    )

    if (!response.ok) {
      throw new Error(`OpenAlex API error: ${response.status}`)
    }

    const data = await response.json()
    const sources: SourceResult[] = []

    for (const work of data.results || []) {
      // Extract abstract from inverted index if available
      let abstract = ''
      if (work.abstract_inverted_index) {
        const words: string[] = []
        for (const [word, positions] of Object.entries(work.abstract_inverted_index)) {
          for (const pos of positions as number[]) {
            words[pos] = word
          }
        }
        abstract = words.filter(w => w).join(' ').substring(0, 500)
      }

      sources.push({
        title: work.title || 'Untitled Research',
        url: work.doi ? `https://doi.org/${work.doi}` : (work.primary_location?.landing_page_url || ''),
        abstract,
        authors: work.authorships?.map((a: any) => a.author?.display_name).filter(Boolean).slice(0, 3) || [],
        publishedAt: work.publication_date,
        publisher: work.primary_location?.source?.display_name || 'Academic Journal',
        type: 'academic',
        credibilityScore: Math.min(90 + (work.cited_by_count || 0) / 100, 100),
        metadata: {
          citedBy: work.cited_by_count || 0,
          openAccess: work.open_access?.is_oa || false,
          venue: work.primary_location?.source?.display_name,
          doi: work.doi
        }
      })
    }

    console.log(`[OpenAlex] Retrieved ${sources.length} academic sources in ${Date.now() - startTime}ms`)
    return sources

  } catch (error) {
    console.error('[OpenAlex] API error:', error)
    return []
  }
}

/**
 * arXiv API - Physics, Mathematics, Computer Science preprints
 */
export async function queryArXiv(query: string, maxResults = 100): Promise<SourceResult[]> {
  const startTime = Date.now()
  
  try {
    const encodedQuery = encodeURIComponent(query)
    const response = await fetch(
      `http://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=${Math.min(maxResults, 100)}&sortBy=relevance&sortOrder=descending`,
      {
        signal: AbortSignal.timeout(10000)
      }
    )

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status}`)
    }

    const xmlText = await response.text()
    const sources: SourceResult[] = []

    // Parse XML response (simplified - in production you'd use a proper XML parser)
    const entries = xmlText.match(/<entry>([\s\S]*?)<\/entry>/g) || []

    for (const entry of entries) {
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || 'Untitled'
      const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() || ''
      const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() || ''
      const arxivId = entry.match(/arxiv.org\/abs\/(.*?)"/)?.[1] || ''
      
      // Extract authors
      const authorMatches = entry.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g) || []
      const authors = authorMatches.map(match => 
        match.match(/<name>([\s\S]*?)<\/name>/)?.[1] || ''
      ).filter(Boolean).slice(0, 3)

      if (title && arxivId) {
        sources.push({
          title: title.replace(/\n/g, ' ').trim(),
          url: `https://arxiv.org/abs/${arxivId}`,
          abstract: summary.replace(/\n/g, ' ').substring(0, 500),
          authors,
          publishedAt: published.split('T')[0],
          publisher: 'arXiv Preprint Server',
          type: 'preprint',
          credibilityScore: 75, // Preprints have lower credibility than peer-reviewed
          metadata: {
            arxivId,
            preprint: true,
            peerReviewed: false
          }
        })
      }
    }

    console.log(`[arXiv] Retrieved ${sources.length} preprint sources in ${Date.now() - startTime}ms`)
    return sources

  } catch (error) {
    console.error('[arXiv] API error:', error)
    return []
  }
}

/**
 * PubMed API - Biomedical literature
 */
export async function queryPubMed(query: string, maxResults = 100): Promise<SourceResult[]> {
  const startTime = Date.now()
  
  try {
    const encodedQuery = encodeURIComponent(query)
    
    // Step 1: Search for PMIDs
    const searchResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodedQuery}&retmode=json&retmax=${Math.min(maxResults, 200)}&sort=relevance`,
      {
        signal: AbortSignal.timeout(10000)
      }
    )

    if (!searchResponse.ok) {
      throw new Error(`PubMed search error: ${searchResponse.status}`)
    }

    const searchData = await searchResponse.json()
    const pmids = searchData.esearchresult?.idlist || []

    if (pmids.length === 0) {
      return []
    }

    // Step 2: Fetch details for PMIDs
    const fetchResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`,
      {
        signal: AbortSignal.timeout(15000)
      }
    )

    if (!fetchResponse.ok) {
      throw new Error(`PubMed fetch error: ${fetchResponse.status}`)
    }

    const fetchData = await fetchResponse.json()
    const articles = fetchData.PubmedArticleSet?.PubmedArticle || []
    const sources: SourceResult[] = []

    for (const article of articles) {
      const medlineData = article.MedlineCitation
      const articleData = medlineData?.Article

      if (!articleData) continue

      const title = articleData.ArticleTitle || 'Untitled'
      const abstract = articleData.Abstract?.AbstractText?.[0] || ''
      const journal = articleData.Journal?.Title || 'Medical Journal'
      const pmid = medlineData.PMID?._ || ''
      
      // Extract authors
      const authorList = articleData.AuthorList?.Author || []
      const authors = authorList.slice(0, 3).map((author: any) => 
        `${author.LastName || ''} ${author.ForeName || ''}`.trim()
      ).filter(Boolean)

      // Extract publication date
      const pubDate = articleData.Journal?.JournalIssue?.PubDate
      const year = pubDate?.Year || ''
      const month = pubDate?.Month || ''
      const publishedAt = year ? `${year}-${month || '01'}-01` : ''

      sources.push({
        title,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        abstract: typeof abstract === 'string' ? abstract.substring(0, 500) : '',
        authors,
        publishedAt,
        publisher: journal,
        type: 'medical',
        credibilityScore: 95, // PubMed articles are highly credible
        metadata: {
          pmid,
          peerReviewed: true,
          medicalJournal: true
        }
      })
    }

    console.log(`[PubMed] Retrieved ${sources.length} medical sources in ${Date.now() - startTime}ms`)
    return sources

  } catch (error) {
    console.error('[PubMed] API error:', error)
    return []
  }
}

/**
 * ClinicalTrials.gov API - Clinical research and trials
 */
export async function queryClinicalTrials(query: string, maxResults = 100): Promise<SourceResult[]> {
  const startTime = Date.now()
  
  try {
    const encodedQuery = encodeURIComponent(query)
    const response = await fetch(
      `https://clinicaltrials.gov/api/v2/studies?query.cond=${encodedQuery}&pageSize=${Math.min(maxResults, 1000)}&format=json&sort=@relevance`,
      {
        signal: AbortSignal.timeout(10000)
      }
    )

    if (!response.ok) {
      throw new Error(`ClinicalTrials API error: ${response.status}`)
    }

    const data = await response.json()
    const studies = data.studies || []
    const sources: SourceResult[] = []

    for (const study of studies) {
      const protocol = study.protocolSection
      if (!protocol) continue

      const identification = protocol.identificationModule
      const description = protocol.descriptionModule
      const design = protocol.designModule
      const status = protocol.statusModule

      sources.push({
        title: identification?.briefTitle || 'Clinical Trial',
        url: `https://clinicaltrials.gov/study/${identification?.nctId}`,
        abstract: description?.briefSummary || '',
        publishedAt: status?.startDateStruct?.date || '',
        publisher: 'ClinicalTrials.gov',
        type: 'clinical_trial',
        credibilityScore: 90, // Clinical trials are highly credible
        metadata: {
          nctId: identification?.nctId,
          phase: design?.phases?.[0] || 'Unknown',
          status: status?.overallStatus,
          participants: design?.enrollmentInfo?.count || 0,
          intervention: protocol.armsInterventionsModule?.interventions?.[0]?.name || ''
        }
      })
    }

    console.log(`[ClinicalTrials] Retrieved ${sources.length} clinical trial sources in ${Date.now() - startTime}ms`)
    return sources

  } catch (error) {
    console.error('[ClinicalTrials] API error:', error)
    return []
  }
}

/**
 * World Bank API - Economic indicators and development data
 */
export async function queryWorldBank(query: string, maxResults = 100): Promise<SourceResult[]> {
  const startTime = Date.now()
  
  try {
    // First, search for relevant indicators
    const indicatorResponse = await fetch(
      `https://api.worldbank.org/v2/indicator?format=json&per_page=${Math.min(maxResults, 500)}&source=2`,
      {
        signal: AbortSignal.timeout(10000)
      }
    )

    if (!indicatorResponse.ok) {
      throw new Error(`World Bank API error: ${indicatorResponse.status}`)
    }

    const indicatorData = await indicatorResponse.json()
    const indicators = indicatorData[1] || []
    const sources: SourceResult[] = []

    // Filter indicators that match the query
    const relevantIndicators = indicators.filter((indicator: any) => 
      indicator.name?.toLowerCase().includes(query.toLowerCase()) ||
      indicator.sourceNote?.toLowerCase().includes(query.toLowerCase())
    )

    for (const indicator of relevantIndicators) {
      sources.push({
        title: indicator.name || 'Economic Indicator',
        url: `https://data.worldbank.org/indicator/${indicator.id}`,
        abstract: indicator.sourceNote || '',
        publishedAt: new Date().toISOString().split('T')[0],
        publisher: 'World Bank',
        type: 'economic_data',
        credibilityScore: 95, // World Bank data is highly credible
        metadata: {
          indicatorId: indicator.id,
          source: indicator.source?.value || 'World Bank',
          topics: indicator.topics || []
        }
      })
    }

    console.log(`[World Bank] Retrieved ${sources.length} economic sources in ${Date.now() - startTime}ms`)
    return sources

  } catch (error) {
    console.error('[World Bank] API error:', error)
    return []
  }
}

/**
 * NASA EONET API - Environmental and natural events
 */
export async function queryNASAEONET(query: string, maxResults = 100): Promise<SourceResult[]> {
  const startTime = Date.now()
  
  try {
    const response = await fetch(
      `https://eonet.gsfc.nasa.gov/api/v3/events?limit=${Math.min(maxResults, 500)}&status=all`,
      {
        signal: AbortSignal.timeout(10000)
      }
    )

    if (!response.ok) {
      throw new Error(`NASA EONET API error: ${response.status}`)
    }

    const data = await response.json()
    const events = data.events || []
    const sources: SourceResult[] = []

    // Filter events that match the query
    const relevantEvents = events.filter((event: any) => 
      event.title?.toLowerCase().includes(query.toLowerCase()) ||
      event.description?.toLowerCase().includes(query.toLowerCase()) ||
      event.categories?.some((cat: any) => cat.title?.toLowerCase().includes(query.toLowerCase()))
    )

    for (const event of relevantEvents) {
      sources.push({
        title: event.title || 'Natural Event',
        url: `https://eonet.gsfc.nasa.gov/api/v3/events/${event.id}`,
        abstract: event.description || '',
        publishedAt: event.geometry?.[0]?.date || '',
        publisher: 'NASA Earth Observatory',
        type: 'environmental_event',
        credibilityScore: 95, // NASA data is highly credible
        metadata: {
          eventId: event.id,
          categories: event.categories?.map((cat: any) => cat.title) || [],
          status: event.closed ? 'closed' : 'open',
          geometry: event.geometry?.[0] || {}
        }
      })
    }

    console.log(`[NASA EONET] Retrieved ${sources.length} environmental sources in ${Date.now() - startTime}ms`)
    return sources

  } catch (error) {
    console.error('[NASA EONET] API error:', error)
    return []
  }
}

/**
 * GBIF API - Biodiversity and species occurrence data
 */
export async function queryGBIF(query: string, maxResults = 100): Promise<SourceResult[]> {
  const startTime = Date.now()
  
  try {
    const encodedQuery = encodeURIComponent(query)
    const response = await fetch(
      `https://api.gbif.org/v1/occurrence/search?scientificName=${encodedQuery}&limit=${Math.min(maxResults, 300)}`,
      {
        signal: AbortSignal.timeout(10000)
      }
    )

    if (!response.ok) {
      throw new Error(`GBIF API error: ${response.status}`)
    }

    const data = await response.json()
    const occurrences = data.results || []
    const sources: SourceResult[] = []

    for (const occurrence of occurrences) {
      sources.push({
        title: occurrence.scientificName || occurrence.species || 'Species Occurrence',
        url: `https://www.gbif.org/occurrence/${occurrence.key}`,
        abstract: `Species occurrence record: ${occurrence.scientificName || 'Unknown species'} observed in ${occurrence.country || 'unknown location'}`,
        publishedAt: occurrence.eventDate || '',
        publisher: 'Global Biodiversity Information Facility',
        type: 'biodiversity',
        credibilityScore: 85, // GBIF data is credible but varies by source
        metadata: {
          gbifId: occurrence.key,
          kingdom: occurrence.kingdom,
          family: occurrence.family,
          genus: occurrence.genus,
          species: occurrence.species,
          country: occurrence.country,
          coordinates: occurrence.decimalLatitude && occurrence.decimalLongitude 
            ? [occurrence.decimalLatitude, occurrence.decimalLongitude] 
            : null
        }
      })
    }

    console.log(`[GBIF] Retrieved ${sources.length} biodiversity sources in ${Date.now() - startTime}ms`)
    return sources

  } catch (error) {
    console.error('[GBIF] API error:', error)
    return []
  }
}

/**
 * Federal Register API - US government and regulatory documents  
 */
export async function queryFederalRegister(query: string, maxResults = 100): Promise<SourceResult[]> {
  const startTime = Date.now()
  
  try {
    const encodedQuery = encodeURIComponent(query)
    const response = await fetch(
      `https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=${encodedQuery}&per_page=${Math.min(maxResults, 1000)}&order=newest`,
      {
        signal: AbortSignal.timeout(10000)
      }
    )

    if (!response.ok) {
      throw new Error(`Federal Register API error: ${response.status}`)
    }

    const data = await response.json()
    const documents = data.results || []
    const sources: SourceResult[] = []

    for (const document of documents) {
      sources.push({
        title: document.title || 'Federal Document',
        url: document.html_url || document.pdf_url || '',
        abstract: document.abstract || '',
        publishedAt: document.publication_date || '',
        publisher: 'Federal Register',
        type: 'government',
        credibilityScore: 98, // Federal government documents are highly credible
        metadata: {
          documentNumber: document.document_number,
          agencies: document.agencies || [],
          type: document.type,
          cfr: document.cfr_references || []
        }
      })
    }

    console.log(`[Federal Register] Retrieved ${sources.length} government sources in ${Date.now() - startTime}ms`)
    return sources

  } catch (error) {
    console.error('[Federal Register] API error:', error)
    return []
  }
}

/**
 * GDELT API - Global news events and media analysis
 */
export async function queryGDELT(query: string, maxResults = 100): Promise<SourceResult[]> {
  const startTime = Date.now()
  
  try {
    const encodedQuery = encodeURIComponent(query)
    const response = await fetch(
      `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodedQuery}&mode=artlist&maxrecords=${Math.min(maxResults, 250)}&format=json&sort=datedesc`,
      {
        signal: AbortSignal.timeout(10000)
      }
    )

    if (!response.ok) {
      throw new Error(`GDELT API error: ${response.status}`)
    }

    const data = await response.json()
    const articles = data.articles || []
    const sources: SourceResult[] = []

    for (const article of articles) {
      sources.push({
        title: article.title || 'News Article',
        url: article.url || '',
        abstract: article.seendate ? `Published: ${article.seendate}` : '',
        publishedAt: article.seendate || '',
        publisher: article.domain || 'News Source',
        type: 'news',
        credibilityScore: 70, // News credibility varies widely
        metadata: {
          domain: article.domain,
          language: article.language,
          tone: article.tone,
          socialsharecount: article.socialsharecount || 0
        }
      })
    }

    console.log(`[GDELT] Retrieved ${sources.length} news sources in ${Date.now() - startTime}ms`)
    return sources

  } catch (error) {
    console.error('[GDELT] API error:', error)
    return []
  }
}