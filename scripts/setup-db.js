#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up SourceHound database...\n');

// Check if Docker is available
function checkDocker() {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Update environment file with database URLs
function updateEnvironment() {
  const envPath = path.join(__dirname, '..', '.env.local');
  let envContent = fs.readFileSync(envPath, 'utf-8');
  
  // Update database URLs for local development
  envContent = envContent.replace(
    /DATABASE_URL=".*"/,
    'DATABASE_URL="postgresql://sourcehound:sourcehound_dev_password@localhost:5432/sourcehound?schema=public"'
  );
  
  envContent = envContent.replace(
    /REDIS_URL=".*"/,
    'REDIS_URL="redis://localhost:6379"'
  );
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Updated .env.local with database URLs');
}

// Start database services
function startServices() {
  console.log('🐳 Starting PostgreSQL and Redis with Docker...');
  try {
    execSync('docker-compose up -d postgres redis', { stdio: 'inherit' });
    console.log('✅ Database services started');
    
    // Wait a bit for services to be ready
    console.log('⏳ Waiting for services to be ready...');
    execSync('sleep 10');
  } catch (error) {
    console.error('❌ Failed to start database services');
    process.exit(1);
  }
}

// Run database migrations
function runMigrations() {
  console.log('🔄 Running database migrations...');
  try {
    execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Database migration failed');
    process.exit(1);
  }
}

// Seed database with initial data (optional)
function seedDatabase() {
  console.log('🌱 Seeding database with sample data...');
  try {
    execSync('npx prisma db seed', { stdio: 'ignore' });
    console.log('✅ Database seeded');
  } catch (error) {
    console.log('ℹ️  No seed script found, skipping...');
  }
}

// Main setup function
async function setup() {
  try {
    if (!checkDocker()) {
      console.error('❌ Docker is not available. Please install Docker to continue.');
      console.log('📖 Visit: https://docs.docker.com/get-docker/');
      process.exit(1);
    }

    updateEnvironment();
    startServices();
    runMigrations();
    seedDatabase();
    
    console.log('\n🎉 Database setup complete!');
    console.log('\n📊 Services running:');
    console.log('  • PostgreSQL: localhost:5432');
    console.log('  • Redis: localhost:6379');
    console.log('  • Adminer (DB UI): http://localhost:8080');
    console.log('\n🔑 Database credentials:');
    console.log('  • Database: sourcehound');
    console.log('  • Username: sourcehound');
    console.log('  • Password: sourcehound_dev_password');
    console.log('\n🚀 Run `npm run dev` to start the application');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setup();
}

module.exports = { setup };