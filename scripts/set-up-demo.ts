#!/usr/bin/env tsx

/**
 * Elizify Production Demo Setup Script
 * Handles database initialization and Mattermost bot token creation
 * Usage: npx tsx scripts/set-up-demo.ts [mattermost|basic]
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

type SetupType = 'mattermost' | 'basic';

interface SetupConfig {
  setupType: SetupType;
  appDir: string;
}

class ElizifyDemoSetup {
  private config: SetupConfig;

  constructor() {
    const setupType = (process.argv[2] as SetupType) || 'mattermost';
    const isDryRun = process.argv.includes('--dry-run');
    
    this.config = {
      setupType,
      appDir: '/app'
    };

    console.log(`🚀 Starting Elizify Production Demo Setup (${setupType})`);
    
    if (isDryRun) {
      console.log('🧪 DRY RUN MODE - No actual changes will be made');
      this.testContainerDetection();
      return;
    }
  }

  /**
   * Test container detection without making changes
   */
  private async testContainerDetection(): Promise<void> {
    try {
      console.log('\n🔍 Testing container detection...');
      
      const postgresContainer = this.findPostgresContainer();
      console.log(`✅ Successfully detected postgres container: ${postgresContainer}`);
      
      // Test postgres readiness check
      try {
        execSync(`docker exec ${postgresContainer} pg_isready -U mmuser`, { 
          stdio: 'pipe' 
        });
        console.log('✅ PostgreSQL is ready and accessible');
      } catch {
        console.log('⚠️  PostgreSQL detected but not ready yet');
      }
      
      console.log('\n🎉 Container detection test complete!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Container detection test failed:', error);
      process.exit(1);
    }
  }

  /**
   * Find and verify postgres container
   */
  private findPostgresContainer(): string {
    console.log('🔍 Finding postgres container...');
    
    try {
      const containerNames = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' })
        .split('\n')
        .filter(name => name.includes('postgres'))
        .filter(Boolean);

      if (containerNames.length === 0) {
        throw new Error('No postgres container found');
      }

      const postgresContainer = containerNames[0];
      console.log(`✓ Found postgres container: ${postgresContainer}`);
      
      return postgresContainer;
    } catch (error) {
      console.error('❌ Failed to find postgres container');
      throw error;
    }
  }

  /**
   * Wait for PostgreSQL to be ready
   */
  private async waitForPostgres(): Promise<string> {
    console.log('⏳ Waiting for PostgreSQL to be ready...');
    
    const postgresContainer = this.findPostgresContainer();
    const maxAttempts = 30;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        execSync(`docker exec ${postgresContainer} pg_isready -U mmuser`, { 
          stdio: 'pipe' 
        });
        
        console.log('✅ PostgreSQL is ready');
        return postgresContainer;
      } catch {
        console.log(`   Attempt ${attempt}/${maxAttempts}: Waiting for PostgreSQL...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error('Timeout waiting for PostgreSQL');
  }

  /**
   * Initialize database with provided script
   */
  private async initDatabase(scriptPath: string, description: string): Promise<void> {
    console.log(`📊 ${description}`);
    
    const postgresContainer = this.findPostgresContainer();
    const fullScriptPath = join(this.config.appDir, scriptPath);
    
    if (!existsSync(fullScriptPath)) {
      throw new Error(`Database script not found: ${fullScriptPath}`);
    }
    
    try {
      // Copy script to container and execute
      execSync(`docker cp "${fullScriptPath}" "${postgresContainer}:/tmp/init.sql"`);
      execSync(`docker exec "${postgresContainer}" psql -U mmuser -d postgres -f /tmp/init.sql`);
      
      console.log('✅ Database initialization complete');
    } catch (error) {
      console.error('❌ Database initialization failed');
      throw error;
    }
  }

  /**
   * Setup Mattermost bot using TypeScript script
   */
  private async setupMattermostBot(): Promise<void> {
    console.log('🤖 Setting up Mattermost bot...');
    
    const initScriptPath = join(this.config.appDir, 'scripts/mattermost/init-mattermost-demo.ts');
    
    if (!existsSync(initScriptPath)) {
      throw new Error('Mattermost init script not found');
    }
    
    try {
      // Run the TypeScript script using tsx
      execSync(`cd ${this.config.appDir} && npx tsx scripts/mattermost/init-mattermost-demo.ts`, { 
        stdio: 'inherit' 
      });
      
      console.log('✅ Mattermost bot setup complete');
    } catch (error) {
      console.error('❌ Mattermost bot setup failed');
      throw error;
    }
  }

  /**
   * Main setup execution
   */
  public async run(): Promise<void> {
    try {
      switch (this.config.setupType) {
        case 'mattermost':
          console.log('🔧 Setting up Elizify with Mattermost integration');
          await this.waitForPostgres();
          await this.initDatabase('db/init-mattermost.sql', 'Initializing Mattermost + ElizaOS databases');
          await this.setupMattermostBot();
          break;
          
        case 'basic':
          console.log('🔧 Setting up basic Elizify (ElizaOS only)');
          await this.waitForPostgres();
          await this.initDatabase('db/init-db.sql', 'Initializing ElizaOS database');
          break;
          
        default:
          throw new Error(`Invalid setup type: ${this.config.setupType}. Use 'mattermost' or 'basic'`);
      }

      this.printSuccessMessage();
      
    } catch (error) {
      console.error('\n❌ Setup failed:', error);
      process.exit(1);
    }
  }

  /**
   * Print success message and next steps
   */
  private printSuccessMessage(): void {
    console.log('\n🎉 Elizify Production Demo Setup Complete!');
    console.log(`Setup type: ${this.config.setupType}`);

    if (this.config.setupType === 'mattermost') {
      console.log('\n📋 Next Steps:');
      console.log('1. Check that MATTERMOST_TOKEN was added to .env file');
      console.log('2. Restart ElizaOS container: docker-compose restart elizaos');
      console.log('3. Open http://localhost:8065 in your browser');
      console.log('4. Login as demo-admin / demo123!');
      console.log('5. Chat with Elliot in the Elizify team');
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const setup = new ElizifyDemoSetup();
  setup.run();
}

export default ElizifyDemoSetup; 