import chalk from 'chalk';
import inquirer from 'inquirer';
import { DeploymentManager } from './deployment-manager';

export class HealthMonitor {
  private deploymentManager: DeploymentManager;
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.deploymentManager = new DeploymentManager();
  }

  async startMonitoring(): Promise<void> {
    const runningServices = await this.getRunningServices();
    
    if (runningServices.length === 0) {
      console.log(chalk.yellow('No services are currently running to monitor.'));
      console.log(chalk.gray('Start a deployment first, then return to health monitoring.'));
      return;
    }

    console.log(chalk.cyan('Services to monitor:'));
    runningServices.forEach(service => {
      console.log(chalk.blue(`  ${service.name} (port ${service.port})`));
    });

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Start real-time health monitoring?',
      default: true
    }]);

    if (!confirm) return;

    await this.runMonitoring();
  }

  private async runMonitoring(): Promise<void> {
    this.isMonitoring = true;
    
    console.log(chalk.cyan('\nStarting real-time health monitoring...'));
    console.log(chalk.gray('Press Ctrl+C to stop monitoring\n'));

    // Set up graceful shutdown
    process.on('SIGINT', () => {
      this.stopMonitoring();
      process.exit(0);
    });

    // Initial display
    await this.updateHealthDisplay();

    // Start monitoring loop
    this.monitoringInterval = setInterval(async () => {
      if (this.isMonitoring) {
        await this.updateHealthDisplay();
      }
    }, 5000); // Update every 5 seconds

    // Keep the process running
    while (this.isMonitoring) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private async updateHealthDisplay(): Promise<void> {
    const timestamp = new Date().toLocaleTimeString();
    
    // Clear previous output (move cursor up and clear)
    if (this.monitoringInterval) {
      process.stdout.write('\x1b[2J\x1b[0f'); // Clear screen
    }

    console.log(chalk.cyan.bold('Health Monitor Dashboard'));
    console.log(chalk.gray(`Last updated: ${timestamp}\n`));

    const targets = this.deploymentManager.getTargets();
    const statusData = await this.deploymentManager.getAllDeploymentStatus();

    // Filter to only running services
    const runningServices = Object.entries(statusData)
      .filter(([_, status]) => status.status === 'running');

    if (runningServices.length === 0) {
      console.log(chalk.yellow('No services are currently running.'));
      this.stopMonitoring();
      return;
    }

    // Display each service
    for (const [targetName, status] of runningServices) {
      const target = targets[targetName];
      await this.displayServiceHealth(target, status);
    }

    console.log(chalk.gray('\nPress Ctrl+C to stop monitoring'));
  }

  private async displayServiceHealth(target: any, status: any): Promise<void> {
    const healthIndicator = this.getHealthIndicator(status.health);
    const responseTime = await this.measureResponseTime(target.port, target.healthPath);
    
    console.log(`${healthIndicator} ${chalk.white.bold(target.name)}`);
    console.log(chalk.gray(`   URL: http://localhost:${target.port}`));
    console.log(chalk.gray(`   Health: ${this.formatHealth(status.health)}`));
    console.log(chalk.gray(`   Response Time: ${responseTime}ms`));
    
    if (target.name === 'mattermost') {
      // Additional checks for Mattermost deployment
      const elizaHealth = await this.checkElizaOSHealth();
      const dbHealth = await this.checkDatabaseHealth();
      
      console.log(chalk.gray(`   ElizaOS API: ${this.formatHealth(elizaHealth)}`));
      console.log(chalk.gray(`   Database: ${this.formatHealth(dbHealth)}`));
    }
    
    console.log('');
  }

  private getHealthIndicator(health: string): string {
    switch (health) {
      case 'healthy':
        return chalk.green('●');
      case 'unhealthy':
        return chalk.yellow('●');
      case 'unreachable':
        return chalk.red('●');
      default:
        return chalk.gray('●');
    }
  }

  private formatHealth(health: string): string {
    switch (health) {
      case 'healthy':
        return chalk.green('Healthy');
      case 'unhealthy':
        return chalk.yellow('Unhealthy');
      case 'unreachable':
        return chalk.red('Unreachable');
      default:
        return chalk.gray('Unknown');
    }
  }

  private async measureResponseTime(port: number, healthPath?: string): Promise<number> {
    const url = healthPath ? `http://localhost:${port}${healthPath}` : `http://localhost:${port}`;
    
    try {
      const startTime = Date.now();
      const response = await fetch(url);
      const endTime = Date.now();
      
      return endTime - startTime;
    } catch {
      return -1; // Unreachable
    }
  }

  private async checkElizaOSHealth(): Promise<string> {
    try {
      const response = await fetch('http://localhost:3000/api/agents');
      return response.ok ? 'healthy' : 'unhealthy';
    } catch {
      return 'unreachable';
    }
  }

  private async checkDatabaseHealth(): Promise<string> {
    try {
      // Simple connection test - in production you might want a dedicated health endpoint
      const response = await fetch('http://localhost:8065/api/v4/system/ping');
      return response.ok ? 'healthy' : 'unhealthy';
    } catch {
      return 'unreachable';
    }
  }

  private async getRunningServices(): Promise<Array<{ name: string; port: number }>> {
    const targets = this.deploymentManager.getTargets();
    const statusData = await this.deploymentManager.getAllDeploymentStatus();

    return Object.entries(statusData)
      .filter(([_, status]) => status.status === 'running')
      .map(([targetName, _]) => ({
        name: targets[targetName].name,
        port: targets[targetName].port
      }));
  }

  private stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    console.log(chalk.cyan('\nHealth monitoring stopped.'));
  }
} 