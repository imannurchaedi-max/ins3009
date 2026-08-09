const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'module-config.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const MODULES = CONFIG.modules;

console.log("Cleaning up old deployments...");

for (const mod of MODULES) {
  const dir = path.join(ROOT, mod.dir);
  console.log(`\nChecking ${mod.name}...`);
  if (!fs.existsSync(path.join(dir, '.clasp.json'))) {
    console.log(`Skipping ${mod.name}, no .clasp.json`);
    continue;
  }
  
  try {
    const output = execSync('clasp deployments', { cwd: dir, encoding: 'utf8' });
    const lines = output.split('\n');
    let deletedCount = 0;
    for (const line of lines) {
      if (line.startsWith('- ')) {
        const parts = line.split(' ');
        const id = parts[1];
        if (id && id !== mod.deploymentId && id !== '@HEAD') {
          console.log(`Archiving old deployment: ${id}`);
          try {
            execSync(`clasp undeploy ${id}`, { cwd: dir });
            deletedCount++;
          } catch(e) {
            console.log(`Failed to undeploy ${id}`);
          }
        }
      }
    }
    console.log(`Archived ${deletedCount} old deployments for ${mod.name}.`);
  } catch(e) {
    console.log(`Failed to check deployments for ${mod.name}`);
  }
}
console.log("\nCleanup complete!");
