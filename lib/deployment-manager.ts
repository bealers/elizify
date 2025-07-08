import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export interface DeploymentTarget {
  name: string;
  composeFile: string;
  port: number;
  description: string;
  projectName: string;
}

export interface SimpleStatus {
  [targetName: string]: {
    name: string;
    port: number;
  };
}

export class DeploymentManager {
  private targets: Record<string, DeploymentTarget> = {
    mattermost: {
      name: 'Mattermost (elizaOS + Mattermost)',
      composeFile: 'docker-compose.mattermost.yaml',
      port: 8065,
      description: 'Complete Mattermost integration with elizaOS',
      projectName: 'elizify'
    },
    slim: {
      name: 'Slim (elizaOS only, BYO database)',
      composeFile: 'docker-compose.slim.yaml',
      port: 8068,
      description: 'Minimal elizaOS setup, bring your own database',
      projectName: 'elizify-slim'
    },
    full: {
      name: 'Standard (elizaOS + Postgres with pgvector)', 
      composeFile: 'docker-compose.yaml',
      port: 8066,
      description: 'Complete elizaOS with PostgreSQL and pgvector for embeddings',
      projectName: 'elizify-standard'
    }
  };

  async checkDockerInstalled(): Promise<void> {
    try {
      await execAsync('docker --version');
      await execAsync('docker-compose --version');
    } catch (error) {
      throw new Error(
        'Docker or docker-compose not found.\n' +
        'Please install Docker Desktop: https://www.docker.com/products/docker-desktop'
      );
    }
  }

  async checkPortAvailable(port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${port}`, { 
        signal: AbortSignal.timeout(1000) 
      });
      return false; // Port is in use
    } catch (error) {
      return true; // Port is available
    }
  }

  async stopAllDockerContainers(): Promise<void> {
    const spinner = ora('Stopping all Docker containers...').start();
    
    try {
      const { stdout } = await execAsync('docker ps -q');
      if (stdout.trim()) {
        await execAsync('docker kill $(docker ps -q)');
        spinner.succeed('All Docker containers stopped');
      } else {
        spinner.succeed('No Docker containers were running');
      }
    } catch (error) {
      spinner.fail('Failed to stop Docker containers');
      throw new Error('Failed to stop Docker containers. You may need to stop them manually.');
    }
  }

  async getSimpleStatus(): Promise<SimpleStatus> {
    const result: SimpleStatus = {};
    
    for (const [targetName, target] of Object.entries(this.targets)) {
      try {
        // Check if any containers from this compose file are actually running
        const { stdout } = await execAsync(
          `docker-compose -p ${target.projectName} -f ${target.composeFile} ps -q`
        );
        
        if (stdout.trim()) {
          // Check if the containers are actually running (not just created)
          const containerIds = stdout.trim().split('\n').filter(id => id.trim());
          if (containerIds.length > 0) {
            // Fix: Check each container individually for running state
            const runningContainers = [];
            
            for (const containerId of containerIds) {
              try {
                // Use docker inspect to get actual container state
                const { stdout: inspectOutput } = await execAsync(
                  `docker inspect --format='{{.State.Status}}' ${containerId.trim()}`
                );
                
                const status = inspectOutput.trim();
                // Only consider containers with "running" status as actually running
                if (status === 'running') {
                  runningContainers.push(containerId);
                }
              } catch (inspectError) {
                // Container might not exist anymore, skip it
                continue;
              }
            }
            
            // Only add to result if we have actually running containers
            if (runningContainers.length > 0) {
              result[targetName] = {
                name: target.name,
                port: target.port
              };
            }
          }
        }
      } catch (error) {
        // Ignore errors, just means not running or compose file doesn't exist
      }
    }
    
    return result;
  }

  async startTarget(targetName: string): Promise<void> {
    const target = this.targets[targetName];
    if (!target) {
      throw new Error(`Unknown target: ${targetName}`);
    }

    const spinner = ora(`Starting ${target.name}...`).start();
    
    try {
      // Check if port is available first
      const portAvailable = await this.checkPortAvailable(target.port);
      if (!portAvailable) {
        spinner.fail(`Port ${target.port} is already in use`);
        throw new Error(`Port ${target.port} is already in use. Please stop other services or choose a different recipe.`);
      }

      spinner.text = `Starting containers for ${target.name}...`;
      
      // Start containers with real-time output
      await this.executeDockerCompose(['up', '-d', '--build'], target.composeFile, target.projectName, true);
      
      spinner.text = `Waiting for ${target.name} services to be healthy...`;
      
      // Wait for containers to be ready
      await this.waitForContainersReady(target.composeFile, target.projectName);
      
      spinner.succeed(`${target.name} containers started successfully`);
      
      // Run Mattermost setup if this is a Mattermost target
      if (targetName === 'mattermost') {
        console.log('\n' + chalk.cyan('Setting up Mattermost demo environment...'));
        
        try {
          // Give services extra time to be fully ready
          console.log(chalk.gray('Waiting for services to initialize completely...'));
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          await this.runMattermostSetup();
          console.log(chalk.green('✓ Mattermost demo setup completed'));
        } catch (setupError) {
          console.log(chalk.yellow('⚠️  Mattermost setup encountered an issue:'));
          console.log(chalk.gray(String(setupError)));
          console.log(chalk.cyan('You can run setup manually later if needed.'));
        }
      }
      
      console.log('\n' + chalk.green('🎉 Deployment ready!'));
      this.showAccessInfo(target);
      
    } catch (error) {
      spinner.fail(`Failed to start ${target.name}`);
      throw error;
    }
  }

  async stopAll(): Promise<void> {
    const spinner = ora('Stopping all recipes...').start();
    
    try {
      for (const targetName of Object.keys(this.targets)) {
        await this.stopTarget(targetName);
      }
      spinner.succeed('All recipes stopped');
    } catch (error) {
      spinner.fail('Failed to stop some recipes');
      throw error;
    }
  }

  private async stopTarget(targetName: string): Promise<void> {
    const target = this.targets[targetName];
    if (!target) {
      return;
    }

    try {
      await this.runDockerCompose(['-p', target.projectName, '-f', target.composeFile, 'down', '--remove-orphans']);
    } catch (error) {
      // Ignore errors for stopping
    }
  }

  async ensureEnvFile(): Promise<void> {
    const envPath = '.env';
    const examplePath = 'dot-env.example';
    
    try {
      // Check if .env exists
      await fs.access(envPath);
    } catch {
      // .env doesn't exist, copy from example
      try {
        await fs.copyFile(examplePath, envPath);
        console.log(chalk.green('✓ Created .env file from dot-env.example'));
        console.log(chalk.yellow('⚠️  Please add your API keys to .env file'));
      } catch (error) {
        console.log(chalk.yellow('⚠️  Could not create .env file automatically'));
        console.log(chalk.gray('Please copy dot-env.example to .env and add your API keys'));
      }
    }
  }

  private async runDockerCompose(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('docker-compose', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let errorOutput = '';

      process.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Docker compose failed: ${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async executeDockerCompose(args: string[], composeFile: string, projectName: string, showOutput: boolean = false): Promise<void> {
    const command = `docker-compose -p ${projectName} -f ${composeFile} ${args.join(' ')}`;
    
    if (showOutput) {
      console.log(chalk.gray(`Running: ${command}`));
      
      return new Promise((resolve, reject) => {
        const child = spawn('docker-compose', ['-p', projectName, '-f', composeFile, ...args], {
          stdio: 'inherit',
          shell: true
        });
        
        child.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Docker Compose exited with code ${code}`));
          }
        });
        
        child.on('error', (error) => {
          reject(error);
        });
      });
    } else {
      try {
        await execAsync(command);
      } catch (error) {
        throw new Error(`Docker Compose failed: ${error}`);
      }
    }
  }

  private async waitForContainersReady(composeFile: string, projectName: string, timeoutMs: number = 120000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const { stdout } = await execAsync(`docker-compose -p ${projectName} -f ${composeFile} ps --format json`);
        const containers = stdout.trim().split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line));
        
        const allHealthy = containers.every(container => 
          container.State === 'running' && 
          (container.Health === undefined || container.Health === 'healthy')
        );
        
        if (allHealthy && containers.length > 0) {
          return;
        }
        
        // Show progress
        const healthyCount = containers.filter(c => 
          c.State === 'running' && (c.Health === undefined || c.Health === 'healthy')
        ).length;
        
        if (containers.length > 0) {
          process.stdout.write(`\r${chalk.gray(`Containers ready: ${healthyCount}/${containers.length}`)}`);
        }
        
      } catch (error) {
        // Containers might not be created yet, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Timeout waiting for containers to be ready');
  }

  private async runMattermostSetup(): Promise<void> {
    const setupScript = 'scripts/mattermost/init-mattermost-demo.ts';
    
    try {
      // Use the full path to bun
      const { stdout, stderr } = await execAsync(`~/.bun/bin/bun run ${setupScript}`, {
        cwd: process.cwd()
      });
      
      if (stderr && !stderr.includes('WARNING')) {
        console.log(chalk.gray('Setup output:'), stderr);
      }
      
      // Show key information from stdout
      const lines = stdout.split('\n');
      const importantLines = lines.filter(line => 
        line.includes('Demo Details:') || 
        line.includes('Server URL:') ||
        line.includes('Demo Team:') ||
        line.includes('Bot Token:') ||
        line.includes('Demo Admin:')
      );
      
      if (importantLines.length > 0) {
        console.log('\n' + chalk.cyan('Demo Setup Results:'));
        importantLines.forEach(line => {
          console.log(chalk.gray('  ' + line.trim()));
        });
      }
      
    } catch (error) {
      // Re-throw with more context
      throw new Error(`Mattermost setup script failed: ${error}`);
    }
  }

  private showAccessInfo(target: DeploymentTarget): void {
    console.log(chalk.cyan('\n📍 Access Information:'));
    console.log(chalk.white(`   ${target.name}: http://localhost:${target.port}`));
    
    if (target.name.toLowerCase().includes('mattermost')) {
      console.log(chalk.gray('   Admin Login: demo-admin / demo123!'));
      console.log(chalk.gray('   Team: elizify'));
      console.log(chalk.gray('   Bot: elliot'));
    }
    
    console.log(chalk.cyan('\n🔧 Management:'));
    console.log(chalk.gray('   View logs: docker-compose logs -f'));
    console.log(chalk.gray('   Stop services: docker-compose down'));
    console.log('');
  }

  // Keep existing methods for backward compatibility if needed
  getTargets(): Record<string, DeploymentTarget> {
    return { ...this.targets };
  }
} 