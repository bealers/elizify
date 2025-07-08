/**
 * Mattermost Demo Environment Setup Script
 * Automatically creates demo admin user, team, and Elliot bot account
 */

import { execSync } from 'child_process';
import process from 'process';

interface DemoConfig {
  mattermostUrl: string;
  adminEmail: string;
  adminPassword: string;
  adminUsername: string;
  teamName: string;
  teamDisplayName: string;
  botUsername: string;
  botDisplayName: string;
}

interface ApiResponse {
  id?: string;
  user_id?: string;
  token?: string;
  error?: string;
}

const config: DemoConfig = {
  mattermostUrl: 'http://localhost:8065',
  adminEmail: 'demo@elizify.local',
  adminPassword: 'demo123!',
  adminUsername: 'demo-admin',
  teamName: 'elizify',
  teamDisplayName: 'Elizify',
  botUsername: 'elliot',
  botDisplayName: 'Elliot - elizaOS Assistant'
};

async function makeApiCall(endpoint: string, method: string = 'GET', data?: any, authToken?: string): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const curlCommand = [
    'curl -s',
    method === 'POST' ? '-X POST' : '',
    ...Object.entries(headers).map(([key, value]) => `-H "${key}: ${value}"`),
    data ? `-d '${JSON.stringify(data)}'` : '',
    `"${config.mattermostUrl}${endpoint}"`
  ].filter(Boolean).join(' ');
  
  try {
    const response = execSync(curlCommand, { encoding: 'utf8' });
    return JSON.parse(response);
  } catch (error) {
    console.error(`API call failed: ${error}`);
    throw error;
  }
}

async function waitForMattermost(): Promise<void> {
  console.log('Waiting for Mattermost to be ready...');
  const maxAttempts = 30;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      await makeApiCall('/api/v4/system/ping');
      console.log('Mattermost is ready');
      return;
    } catch {
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error('Timeout waiting for Mattermost');
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

async function createAdminUser(): Promise<string> {
  console.log('Setting up initial admin user...');
  
  try {
    const response = await makeApiCall('/api/v4/users', 'POST', {
      email: config.adminEmail,
      username: config.adminUsername,
      password: config.adminPassword,
      first_name: 'Demo',
      last_name: 'Admin'
    });
    
    if (response.id) {
      console.log('Admin user created successfully');
      return response.id;
    } else {
      throw new Error(`Failed to create admin user: ${JSON.stringify(response)}`);
    }
  } catch (error) {
    console.log('Info: Admin user might already exist, proceeding with login...');
    return '';
  }
}

async function loginAdmin(): Promise<string> {
  console.log('Logging in as admin...');
  
  // Use curl with -i to get headers
  const curlCommand = [
    'curl -s -i -X POST',
    '-H "Content-Type: application/json"',
    `-d '${JSON.stringify({
      login_id: config.adminUsername,
      password: config.adminPassword
    })}'`,
    `"${config.mattermostUrl}/api/v4/users/login"`
  ].join(' ');
  
  try {
    const response = execSync(curlCommand, { encoding: 'utf8' });
    const tokenMatch = response.match(/token:\s*([^\r\n]+)/i);
    
    if (tokenMatch) {
      const token = tokenMatch[1].trim();
      console.log('Admin login successful');
      return token;
    } else {
      throw new Error('No auth token found in response');
    }
  } catch (error) {
    throw new Error(`Admin login failed: ${error}`);
  }
}

async function createTeam(authToken: string): Promise<string> {
  console.log('Creating demo team...');
  
  try {
    const response = await makeApiCall('/api/v4/teams', 'POST', {
      name: config.teamName,
      display_name: config.teamDisplayName,
      type: 'O'
    }, authToken);
    
    if (response.id && !response.error) {
      console.log('✓ Team created successfully');
      return response.id;
    } else if (response.error && response.error.includes('already exists')) {
      console.log('✓ Team already exists, fetching ID...');
      const existingTeam = await makeApiCall(`/api/v4/teams/name/${config.teamName}`, 'GET', null, authToken);
      if (existingTeam.id) {
        console.log(`✓ Team ID retrieved successfully: ${existingTeam.id}`);
        return existingTeam.id;
      }
    }
    
    throw new Error(`Failed to create/get team: ${JSON.stringify(response)}`);
  } catch (error) {
    throw new Error(`Team creation failed: ${error}`);
  }
}

async function createBot(authToken: string): Promise<{ userId: string; token: string }> {
  console.log('Creating Elliot bot account...');
  
  try {
    const response = await makeApiCall('/api/v4/bots', 'POST', {
      username: config.botUsername,
      display_name: config.botDisplayName,
      description: 'Elliot - Your helpful AI coordinator and analyst'
    }, authToken);
    
    let botUserId: string;
    
    if (response.user_id) {
      console.log('✓ Bot account created successfully');
      botUserId = response.user_id;
    } else if (
      response.id === 'app.user.save.username_exists.app_error' ||
      (response.message && response.message.includes('An account with that username already exists')) ||
      (response.error && (
        response.error.includes('already exists') || 
        response.error.includes('username_exists')
      ))
    ) {
      console.log('✓ Bot already exists, fetching ID...');
      const existingBot = await makeApiCall(`/api/v4/users/username/${config.botUsername}`, 'GET', null, authToken);
      if (existingBot.id) {
        botUserId = existingBot.id;
        console.log(`✓ Bot user ID retrieved successfully: ${botUserId}`);
      } else {
        throw new Error('Failed to get existing bot user ID');
      }
    } else {
      throw new Error(`Failed to create bot: ${JSON.stringify(response)}`);
    }
    
    // Create bot token - let Mattermost generate a real token
    console.log('Creating bot access token...');
    const tokenResponse = await makeApiCall(`/api/v4/users/${botUserId}/tokens`, 'POST', {
      description: 'ElizaOS production token'
    }, authToken);
    
    if (tokenResponse.token) {
      console.log('✓ Bot token created successfully');
      return { userId: botUserId, token: tokenResponse.token };
    } else if (tokenResponse.error?.includes('already exists')) {
      // If token already exists, we need to get it from the database
      console.log('✓ Bot token already exists, extracting from database...');
      const realToken = await extractTokenFromDatabase(botUserId);
      return { userId: botUserId, token: realToken };
    } else {
      throw new Error(`Failed to create bot token: ${JSON.stringify(tokenResponse)}`);
    }
  } catch (error) {
    throw new Error(`Bot creation failed: ${error}`);
  }
}

async function extractTokenFromDatabase(botUserId: string): Promise<string> {
  console.log('Extracting real bot token from database...');
  
  try {
    // Find postgres container dynamically (no hardcoded names)
    let postgresContainer: string | undefined;
    
    try {
      const containerNames = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' })
        .split('\n')
        .filter(name => name.includes('postgres'))
        .filter(Boolean);

      if (containerNames.length === 0) {
        throw new Error('No postgres container found');
      }

      postgresContainer = containerNames[0];
      console.log(`✓ Found postgres container: ${postgresContainer}`);
    } catch (error) {
      throw new Error(`Failed to find postgres container: ${error}`);
    }
    
    if (!postgresContainer) {
      throw new Error('No postgres container found. Ensure postgres is running.');
    }
    
    // Query the database directly to get the real token
    const query = `SELECT token FROM useraccesstokens WHERE userid = '${botUserId}' ORDER BY createat DESC LIMIT 1;`;
    const result = execSync(`docker exec ${postgresContainer} psql -U mmuser -d mattermost -t -c "${query}"`, { encoding: 'utf8' });
    
    const token = result.trim();
    if (token && token.length > 10) {
      console.log('✓ Real bot token extracted from database');
      return token;
    } else {
      throw new Error('No valid token found in database');
    }
  } catch (error) {
    throw new Error(`Failed to extract token from database: ${error}`);
  }
}

async function updateEnvFile(botToken: string): Promise<void> {
  console.log('Updating .env file with real bot token...');
  
  try {
    // Determine the correct .env file path
    // Check if we're running inside a container (has /app/.env) or on host (has ./.env)
    let envPath = '.env'; // Default to host path
    
    try {
      // Check if we're in a container environment
      if (process.env.CONTAINER === 'true' || execSync('test -f /app/.env && echo "container" || echo "host"', { encoding: 'utf8', stdio: 'pipe' }).trim() === 'container') {
        envPath = '/app/.env';
      }
    } catch {
      // If any detection fails, use host path
      envPath = '.env';
    }
    
    console.log(`Using .env path: ${envPath}`);
    
    // Append the real token to the .env file with proper newline formatting
    execSync(`echo "\\nMATTERMOST_TOKEN=${botToken}" >> ${envPath}`);
    console.log('✓ .env file updated with real bot token');
  } catch (error) {
    throw new Error(`Failed to update .env file: ${error}`);
  }
}

async function addBotToTeam(teamId: string, botUserId: string, authToken: string): Promise<void> {
  console.log('Adding Elliot to demo team...');
  
  try {
    const response = await makeApiCall(`/api/v4/teams/${teamId}/members`, 'POST', {
      team_id: teamId,
      user_id: botUserId
    }, authToken);
    
    if (response.team_id || response.error?.includes('already a member')) {
      console.log('✓ Bot added to team successfully');
    } else {
      throw new Error(`Failed to add bot to team: ${JSON.stringify(response)}`);
    }
  } catch (error) {
    console.warn(`Team membership warning: ${error}`);
  }
}

async function createDemoChannels(teamId: string, botUserId: string, authToken: string): Promise<void> {
  console.log('Creating demo channels...');
  
  const channels = ['general', 'demo-chat', 'elizify-showcase'];
  
  for (const channelName of channels) {
    try {
      const response = await makeApiCall('/api/v4/channels', 'POST', {
        team_id: teamId,
        name: channelName,
        display_name: channelName.split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        type: 'O'
      }, authToken);
      
      let channelId: string;
      
      if (response.id) {
        channelId = response.id;
        console.log(`  Created channel: ${channelName}`);
      } else if (response.error?.includes('already exists')) {
        console.log(`  Info: Channel already exists: ${channelName}`);
        const existingChannel = await makeApiCall(`/api/v4/teams/${teamId}/channels/name/${channelName}`, 'GET', null, authToken);
        channelId = existingChannel.id;
      } else {
        console.warn(`  Warning: Failed to create channel ${channelName}: ${JSON.stringify(response)}`);
        continue;
      }
      
      // Add bot to channel
      if (channelId) {
        await makeApiCall(`/api/v4/channels/${channelId}/members`, 'POST', {
          user_id: botUserId
        }, authToken);
        console.log(`    Elliot added to ${channelName}`);
      }
    } catch (error) {
      console.warn(`  Warning: Failed to create/setup channel ${channelName}: ${error}`);
    }
  }
}

async function main(): Promise<void> {
  try {
    console.log('Setting up Mattermost demo environment...\n');
    
    await waitForMattermost();
    await createAdminUser();
    const authToken = await loginAdmin();
    const teamId = await createTeam(authToken);
    const { userId: botUserId, token: botToken } = await createBot(authToken);
    await addBotToTeam(teamId, botUserId, authToken);
    await createDemoChannels(teamId, botUserId, authToken);
    
    await updateEnvFile(botToken);
    
    console.log('\n=== Demo Setup Complete ===');
    console.log('Demo Details:');
    console.log(`Server URL: ${config.mattermostUrl}`);
    console.log(`Demo Team: ${config.teamName}`);
    console.log(`Bot Token: ${botToken}`);
    console.log(`Demo Admin: ${config.adminUsername} / ${config.adminPassword}`);
    console.log('\nConfiguration reference available in dot-env.example');
    console.log('Copy dot-env.example to .env and update with your API keys');
    
  } catch (error) {
    console.error('Demo setup failed:', error);
    process.exit(1);
  }
}

// Run main function if this file is executed directly
main(); 