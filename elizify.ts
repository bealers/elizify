#!/usr/bin/env bun

/**
 * Elizify Recipe Launcher
 * 
 * Demo tool for Elizify's elizaOS deployment recipes
 * 
 * Usage:
 *   ./elizify.ts           # Run directly
 *   bun run elizify        # Run via package.json script
 *   bun elizify.ts         # Run via bun
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { DeploymentManager } from './lib/deployment-manager';

interface MenuChoice {
  name: string;
  value: string;
  description?: string;
}

class ElizifyRecipeLauncher {
  private deploymentManager: DeploymentManager;

  constructor() {
    this.deploymentManager = new DeploymentManager();
  }

  async start(): Promise<void> {
    console.clear();
    this.printHeader();
    this.showSimpleWarning();
    
    while (true) {
      try {
        const action = await this.showMainMenu();
        
        if (action === 'exit') {
          console.log(chalk.cyan('\nThank you for trying Elizify!'));
          process.exit(0);
        }
        
        await this.handleAction(action);
        
        // Pause before returning to main menu
        await inquirer.prompt([{
          type: 'input',
          name: 'continue',
          message: 'Press Enter to continue...'
        }]);
        
      } catch (error) {
        console.error(chalk.red('Error:'), error);
        await this.pause();
      }
    }
  }

  private showSimpleWarning(): void {
    console.log(chalk.yellow("⚠️  This launcher is for local demonstration of Elizify's recipes."));
    console.log(chalk.gray('   Not intended for production deployments.\n'));
  }

  private async isProductionEnvironment(): Promise<boolean> {
    // Check for production indicators
    const productionIndicators = [
      // Environment variables
      process.env.NODE_ENV === 'production',
      process.env.RAILS_ENV === 'production',
      process.env.DEPLOY_ENV === 'production', 
      process.env.APP_ENV === 'production',
      // Hostname patterns
      process.env.HOSTNAME?.includes('prod'),
      process.env.HOSTNAME?.includes('production'),
      // Check for common production ports in use
      await this.checkProductionPorts(),
    ];
    
    return productionIndicators.some(Boolean);
  }

  private async checkProductionPorts(): Promise<boolean> {
    const productionPorts = [80, 443, 8080];
    
    for (const port of productionPorts) {
      try {
        const response = await fetch(`http://localhost:${port}`, { 
          signal: AbortSignal.timeout(1000) 
        });
        if (response) {
          return true; // Production service detected
        }
      } catch {
        // Port not in use, continue checking
      }
    }
    return false;
  }

  private printHeader(): void {
    console.log(chalk.cyan.bold(`
╔══════════════════════════════════════════════════════════════╗
║                   ELIZIFY RECIPE LAUNCHER                   ║
║                 Try elizaOS Production Recipes              ║
╚══════════════════════════════════════════════════════════════╝
    `));
    console.log(chalk.gray('Demo elizaOS deployment recipes.\n'));
  }

  private async showCurrentStatus(): Promise<void> {
    const statusData = await this.deploymentManager.getSimpleStatus();
    
    if (Object.keys(statusData).length === 0) {
      console.log(chalk.gray('No recipes currently running.\n'));
    } else {
      console.log(chalk.cyan.bold('Current Status:\n'));
      for (const [targetName, info] of Object.entries(statusData)) {
        console.log(chalk.green(`Running: ${info.name}`));
        console.log(chalk.blue(`  URL: http://localhost:${info.port}`));
        if (targetName === 'mattermost') {
          console.log(chalk.blue(`  ElizaOS API: http://localhost:3000`));
          console.log(chalk.gray(`  Login: demo-admin / demo123!`));
        }
        console.log('');
      }
    }
  }

  private async showMainMenu(): Promise<string> {
    // Show current status
    await this.showCurrentStatus();
    
    // Check what's currently running
    const statusData = await this.deploymentManager.getSimpleStatus();
    const runningServices = Object.keys(statusData);
    
    const choices: MenuChoice[] = [];
    
    if (runningServices.length > 0) {
      choices.push({
        name: chalk.red(`Stop All Running Recipes`),
        value: 'stop-all',
        description: 'Stop all currently running recipes'
      });
    } else {
      // Get targets dynamically from deployment manager
      const targets = this.deploymentManager.getTargets();
      const colors = [chalk.green, chalk.blue, chalk.magenta, chalk.cyan, chalk.yellow];
      let colorIndex = 0;
      
      for (const [targetName, target] of Object.entries(targets)) {
        const color = colors[colorIndex % colors.length] || chalk.white;
        choices.push({
          name: color(target.name),
          value: `start-${targetName}`,
          description: target.description
        });
        colorIndex++;
      }
    }
    
    // Always show nuclear option for Docker conflicts
    choices.push({
      name: chalk.yellow('Stop All Docker Containers'),
      value: 'stop-docker-all',
      description: 'Emergency: Stop ALL Docker containers (not just Elizify)'
    });
    
    choices.push({
      name: chalk.dim('Exit'),
      value: 'exit'
    });

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: runningServices.length > 0 ? 'Recipes are running:' : 'Choose a recipe to start:',
      choices,
      pageSize: 10
    }]);

    return action;
  }

  private async handleAction(action: string): Promise<void> {
    if (action === 'stop-all') {
      await this.handleStopAll();
      return;
    }

    if (action === 'stop-docker-all') {
      await this.handleStopAllDocker();
      return;
    }

    if (action === 'manual-commands') {
      await this.showManualCommands();
      return;
    }

    // Handle start actions
    if (action.startsWith('start-')) {
      const targetName = action.replace('start-', '');
      await this.handleStartTarget(targetName);
    }
  }

  private async handleStartTarget(targetName: string): Promise<void> {
    try {
      console.log(''); // Add spacing
      
      // Check Docker is available
      await this.deploymentManager.checkDockerInstalled();
      
      // Create .env if needed
      await this.deploymentManager.ensureEnvFile();
      
      // Start the target with verbose output
      await this.deploymentManager.startTarget(targetName);
      
    } catch (error) {
      const errorMessage = String(error);
      
      if (errorMessage.includes('already in use')) {
        // Extract port number from error message like "Port 8065 is already in use"
        const portMatch = errorMessage.match(/Port (\d+) is already in use/);
        if (portMatch && portMatch[1]) {
          await this.handlePortConflict(parseInt(portMatch[1]));
        } else {
          console.error(chalk.red('\nPort conflict detected but could not determine port number'));
          await this.showManualCommands();
        }
      } else {
        console.error(chalk.red('\nError:'), errorMessage);
        
        if (errorMessage.includes('Docker')) {
          console.log(chalk.yellow('\nTip: Make sure Docker is running and try again.'));
        } else if (errorMessage.includes('Mattermost setup')) {
          console.log(chalk.yellow('\nTip: You can set up Mattermost manually later if needed.'));
          console.log(chalk.gray('The containers are still running and accessible.'));
        }
      }
    }
  }

  private async handleStopAll(): Promise<void> {
    console.log(chalk.cyan.bold(`\nStopping All Recipes...\n`));
    
    try {
      await this.deploymentManager.stopAll();
      console.log(chalk.green('\nAll recipes stopped successfully!'));
    } catch (error) {
      console.log(chalk.red(`Failed to stop recipes: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  private async handleStopAllDocker(): Promise<void> {
    console.log(chalk.yellow.bold('\n⚠️  NUCLEAR OPTION: Stopping ALL Docker Containers ⚠️\n'));
    console.log(chalk.red('This will stop EVERY running Docker container on your system.'));
    console.log(chalk.gray('Use this only if you have port conflicts you can\'t resolve otherwise.\n'));
    
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: 'Are you sure you want to stop ALL Docker containers?',
      default: false
    }]);

    if (!confirmed) {
      console.log(chalk.gray('Operation cancelled.'));
      return;
    }

    try {
      await this.deploymentManager.stopAllDockerContainers();
      console.log(chalk.green('\nAll Docker containers stopped successfully!'));
    } catch (error) {
      console.log(chalk.red(`Failed to stop Docker containers: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  private async showManualCommands(): Promise<void> {
    console.log(chalk.cyan('\nManual resolution commands:'));
    console.log(chalk.blue('Stop Elizify containers:'));
    console.log(chalk.gray('  docker-compose -f docker-compose.mattermost.yaml down'));
    console.log(chalk.gray('  docker-compose -f docker-compose.slim.yaml down'));
    console.log(chalk.gray('  docker-compose -f docker-compose.yaml down\n'));
    console.log(chalk.blue('Stop ALL Docker containers:'));
    console.log(chalk.gray('  docker stop $(docker ps -q)\n'));
  }

  private async handlePortConflict(port: number): Promise<void> {
    console.log(chalk.red('\nPort Conflict!'));
    console.log(chalk.yellow(`Port ${port} is already in use.\n`));
    
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'How would you like to resolve this?',
      choices: [
        {
          name: 'Stop all Elizify recipes',
          value: 'stop-elizify',
          description: 'Stop all Elizify containers using this port'
        },
        {
          name: 'Stop ALL Docker containers',
          value: 'stop-all-docker',
          description: 'Nuclear option: Stop everything running in Docker'
        },
        {
          name: 'Show manual commands',
          value: 'show-commands',
          description: 'Display commands to run manually'
        },
        {
          name: 'Return to menu',
          value: 'return',
          description: 'Go back to main menu'
        }
      ]
    }]);

    if (action === 'stop-elizify') {
      await this.handleStopAll();
      console.log(chalk.green('\nElizify containers stopped. You can now try starting the recipe again.'));
    } else if (action === 'stop-all-docker') {
      await this.handleStopAllDocker();
      console.log(chalk.green('\nAll Docker containers stopped. You can now try starting the recipe again.'));
    } else if (action === 'show-commands') {
      await this.showManualCommands();
    }
  }

  private async pause(): Promise<void> {
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }]);
  }
}

// Start the launcher if run directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const launcher = new ElizifyRecipeLauncher();
  launcher.start().catch(console.error);
} 