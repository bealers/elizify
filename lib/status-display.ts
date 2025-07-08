import chalk from 'chalk';
import Table from 'cli-table3';
import { DeploymentManager } from './deployment-manager';

export class StatusDisplay {
  private deploymentManager: DeploymentManager;

  constructor() {
    this.deploymentManager = new DeploymentManager();
  }

  async showAllDeployments(): Promise<void> {
    const targets = this.deploymentManager.getTargets();
    const statusData = await this.deploymentManager.getAllDeploymentStatus();

    const table = new Table({
      head: [
        chalk.cyan.bold('Deployment'),
        chalk.cyan.bold('Status'),
        chalk.cyan.bold('Health'),
        chalk.cyan.bold('Port'),
        chalk.cyan.bold('Description')
      ],
      colWidths: [20, 12, 12, 8, 40],
      style: {
        border: ['gray']
      }
    });

    for (const [targetName, target] of Object.entries(targets)) {
      const status = statusData[targetName];
      
      const statusText = this.formatStatus(status.status);
      const healthText = status.health ? this.formatHealth(status.health) : chalk.gray('-');
      const portText = status.status === 'running' 
        ? chalk.blue(target.port.toString())
        : chalk.gray(target.port.toString());

      table.push([
        chalk.white.bold(target.name),
        statusText,
        healthText,
        portText,
        chalk.gray(target.description)
      ]);
    }

    console.log(table.toString());
    
    // Show URLs for running services
    this.showRunningServiceUrls(targets, statusData);
  }

  async showSingleDeployment(targetName: string): Promise<void> {
    const targets = this.deploymentManager.getTargets();
    const target = targets[targetName];
    
    if (!target) {
      console.log(chalk.red(`Unknown deployment: ${targetName}`));
      return;
    }

    const status = await this.deploymentManager.getDeploymentStatus(targetName);

    console.log(chalk.cyan.bold(`\n${target.name} Status:\n`));
    
    const table = new Table({
      style: { border: ['gray'] }
    });

    table.push(
      ['Name', chalk.white.bold(target.name)],
      ['Status', this.formatStatus(status.status)],
      ['Health', status.health ? this.formatHealth(status.health) : chalk.gray('Not checked')],
      ['Port', status.status === 'running' ? chalk.blue(target.port.toString()) : chalk.gray(target.port.toString())],
      ['Description', chalk.gray(target.description)],
      ['Compose File', chalk.yellow(target.composeFile)]
    );

    if (status.status === 'running') {
      table.push(['URL', chalk.blue(`http://localhost:${target.port}`)]);
      
      if (targetName === 'mattermost') {
        table.push(['ElizaOS API', chalk.blue('http://localhost:3000')]);
        table.push(['PostgreSQL', chalk.blue('localhost:5432')]);
      }
    }

    console.log(table.toString());
  }

  async showQuickStatus(): Promise<void> {
    const targets = this.deploymentManager.getTargets();
    const statusData = await this.deploymentManager.getAllDeploymentStatus();

    console.log(chalk.cyan.bold('Quick Status:\n'));

    for (const [targetName, target] of Object.entries(targets)) {
      const status = statusData[targetName];
      const statusText = this.formatStatus(status.status);
      const healthText = status.health ? ` (${this.formatHealth(status.health)})` : '';
      
      console.log(`  ${chalk.white.bold(target.name)}: ${statusText}${healthText}`);
    }

    console.log('');
  }

  async showHealthSummary(): Promise<void> {
    const targets = this.deploymentManager.getTargets();
    const statusData = await this.deploymentManager.getAllDeploymentStatus();

    const runningServices = Object.entries(statusData)
      .filter(([_, status]) => status.status === 'running');

    if (runningServices.length === 0) {
      console.log(chalk.yellow('No services are currently running.'));
      return;
    }

    console.log(chalk.cyan.bold('Health Summary:\n'));

    const table = new Table({
      head: [
        chalk.cyan.bold('Service'),
        chalk.cyan.bold('Health'),
        chalk.cyan.bold('URL')
      ],
      colWidths: [25, 15, 35],
      style: {
        border: ['gray']
      }
    });

    for (const [targetName, status] of runningServices) {
      const target = targets[targetName];
      const healthText = status.health ? this.formatHealth(status.health) : chalk.gray('Unknown');
      const url = `http://localhost:${target.port}`;

      table.push([
        chalk.white.bold(target.name),
        healthText,
        chalk.blue(url)
      ]);
    }

    console.log(table.toString());
  }

  private formatStatus(status: string): string {
    switch (status) {
      case 'running':
        return chalk.green('Running');
      case 'stopped':
        return chalk.red('Stopped');
      case 'error':
        return chalk.red('Error');
      default:
        return chalk.yellow(status);
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
        return chalk.gray(health);
    }
  }

  private showRunningServiceUrls(
    targets: Record<string, any>, 
    statusData: Record<string, any>
  ): void {
    const runningServices = Object.entries(statusData)
      .filter(([_, status]) => status.status === 'running')
      .map(([targetName, _]) => ({ name: targetName, ...targets[targetName] }));

    if (runningServices.length === 0) {
      console.log(chalk.yellow('\nNo services are currently running.'));
      return;
    }

    console.log(chalk.cyan.bold('\nRunning Services:'));
    
    runningServices.forEach(service => {
      console.log(chalk.blue(`  ${service.name}: http://localhost:${service.port}`));
      
      if (service.name === 'mattermost') {
        console.log(chalk.blue(`    ElizaOS API: http://localhost:3000`));
        console.log(chalk.gray(`    Credentials: demo-admin / demo123!`));
      }
    });

    console.log('');
  }
} 