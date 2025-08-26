const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')
  
  // Create sample user for testing
  const testUser = await prisma.user.upsert({
    where: { ipAddress: '127.0.0.1' },
    update: {},
    create: {
      ipAddress: '127.0.0.1',
      name: 'Test User',
      email: 'test@sourcehound.dev'
    }
  })
  
  console.log('✅ Created test user:', testUser.name)
  
  // Create sample conversation
  const testConversation = await prisma.conversation.upsert({
    where: { id: 'test-conversation-1' },
    update: {},
    create: {
      id: 'test-conversation-1',
      title: 'Sample Fact Check',
      userId: testUser.id,
      ipAddress: '127.0.0.1'
    }
  })
  
  // Create sample messages
  const messages = [
    {
      id: 'msg-1',
      conversationId: testConversation.id,
      role: 'user',
      content: 'Is climate change real?',
      timestamp: new Date('2024-01-01T10:00:00Z')
    },
    {
      id: 'msg-2', 
      conversationId: testConversation.id,
      role: 'assistant',
      content: 'Yes, climate change is real and supported by overwhelming scientific evidence...',
      timestamp: new Date('2024-01-01T10:00:30Z'),
      sources: [
        {
          title: 'IPCC Sixth Assessment Report',
          url: 'https://www.ipcc.ch/report/ar6/wg1/',
          publisher: 'IPCC'
        }
      ]
    }
  ]
  
  for (const message of messages) {
    await prisma.message.upsert({
      where: { id: message.id },
      update: {},
      create: message
    })
  }
  
  console.log('✅ Created sample conversation with messages')
  
  // Add some source credibility data
  const credibilityData = [
    {
      domain: 'ipcc.ch',
      credibilityData: {
        score: 95,
        type: 'government',
        description: 'Intergovernmental Panel on Climate Change',
        verifications: ['scientific', 'government']
      }
    },
    {
      domain: 'snopes.com',
      credibilityData: {
        score: 85,
        type: 'factcheck', 
        description: 'Independent fact-checking organization',
        verifications: ['factcheck', 'independent']
      }
    }
  ]
  
  for (const item of credibilityData) {
    await prisma.sourceCredibility.upsert({
      where: { domain: item.domain },
      update: item,
      create: item
    })
  }
  
  console.log('✅ Added source credibility data')
  
  // Create sample cache entry
  await prisma.factCheckCache.upsert({
    where: { queryHash: 'sample-climate-query' },
    update: {},
    create: {
      queryHash: 'sample-climate-query',
      query: 'is climate change real',
      result: {
        verdict: 'True',
        confidence: 0.95,
        summary: 'Climate change is real and supported by scientific evidence',
        sources: credibilityData
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    }
  })
  
  console.log('✅ Created sample cache entry')
  
  console.log('🎉 Database seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })