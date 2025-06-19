#!/usr/bin/env node

const { existsSync, createWriteStream, unlinkSync, chmodSync } = require('fs');
const { join, dirname } = require('path');
const { promisify } = require('util');
const { exec, spawn } = require('child_process');
const { platform, arch, homedir } = require('os');
const https = require('https');

const execAsync = promisify(exec);

// Configuration
const REPO_OWNER = process.env.FLEXBUFFERS_REPO_OWNER || 'bapa-team';
const REPO_NAME = process.env.FLEXBUFFERS_REPO_NAME || 'flexbuffers-js';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.FLEXBUFFERS_GITHUB_TOKEN;
const SKIP_DOWNLOAD = process.env.FLEXBUFFERS_SKIP_DOWNLOAD === 'true';
const FORCE_BUILD = process.env.FLEXBUFFERS_FORCE_BUILD === 'true';
const USE_GH_CLI = process.env.FLEXBUFFERS_USE_GH_CLI !== 'false'; // Default to true
const CACHE_DIR = process.env.FLEXBUFFERS_CACHE_DIR || join(homedir(), '.cache', 'flexbuffers-js');

// Platform mapping with more variants
const PLATFORM_MAP = {
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
  'win32-x64': 'x86_64-pc-windows-msvc',
  'win32-ia32': 'i686-pc-windows-msvc',
  'win32-arm64': 'aarch64-pc-windows-msvc',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'linux-x64-musl': 'x86_64-unknown-linux-musl',
  'linux-arm64-musl': 'aarch64-unknown-linux-musl',
  'freebsd-x64': 'x86_64-unknown-freebsd',
  'linux-riscv64': 'riscv64gc-unknown-linux-gnu',
  'linux-s390x': 's390x-unknown-linux-gnu',
};

// Detect if running on musl
function isMusl() {
  try {
    const { execSync } = require('child_process');
    const lddVersion = execSync('ldd --version 2>&1', { encoding: 'utf8' });
    return lddVersion.includes('musl');
  } catch {
    // Check if /lib/ld-musl-* exists
    const { readdirSync } = require('fs');
    try {
      const files = readdirSync('/lib');
      return files.some(f => f.startsWith('ld-musl'));
    } catch {
      return false;
    }
  }
}

function getPlatformTarget() {
  let platformKey = `${platform()}-${arch()}`;
  
  // Special handling for Linux to detect musl
  if (platform() === 'linux' && isMusl()) {
    platformKey += '-musl';
  }
  
  return PLATFORM_MAP[platformKey] || platformKey;
}

// Progress bar for downloads
class ProgressBar {
  constructor(total) {
    this.total = total;
    this.current = 0;
    this.barLength = 40;
  }

  update(current) {
    this.current = current;
    const progress = Math.min(this.current / this.total, 1);
    const filledLength = Math.round(this.barLength * progress);
    const bar = '█'.repeat(filledLength) + '░'.repeat(this.barLength - filledLength);
    const percent = Math.round(progress * 100);
    const size = this.formatBytes(this.current);
    const totalSize = this.formatBytes(this.total);
    
    process.stdout.write(`\r[${bar}] ${percent}% | ${size} / ${totalSize}`);
    
    if (progress === 1) {
      process.stdout.write('\n');
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Retry logic for network requests
async function retryRequest(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`Request failed, retrying in ${delay}ms... (${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}

async function httpsRequest(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, data }));
    });
    req.on('error', reject);
    req.end();
  });
}

// Get latest release using gh CLI
async function getLatestReleaseGh() {
  try {
    const { stdout } = await execAsync(`gh release view --repo ${REPO_OWNER}/${REPO_NAME} --json tagName,assets`);
    const release = JSON.parse(stdout);
    
    // Transform to match API format
    return {
      tag_name: release.tagName,
      assets: release.assets.map(asset => ({
        name: asset.name,
        url: asset.url,
        size: asset.size || 0,
        browser_download_url: asset.url
      }))
    };
  } catch (error) {
    throw new Error(`Failed to get release using gh CLI: ${error.message}`);
  }
}

// Get latest release using HTTPS API
async function getLatestReleaseHttps() {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
    headers: {
      'User-Agent': 'flexbuffers-js-postinstall',
      'Accept': 'application/vnd.github.v3+json',
    }
  };

  if (GITHUB_TOKEN) {
    options.headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }

  const response = await retryRequest(() => httpsRequest(options));
  
  if (response.statusCode === 200) {
    return JSON.parse(response.data);
  } else if (response.statusCode === 404) {
    throw new Error('No releases found. Is this a private repository? Set GITHUB_TOKEN environment variable.');
  } else {
    throw new Error(`Failed to get latest release: ${response.statusCode} - ${response.data}`);
  }
}

async function getLatestRelease() {
  if (USE_GH_CLI && await hasGhCli()) {
    console.log('🔧 Using gh CLI for release info...');
    return getLatestReleaseGh();
  } else {
    return getLatestReleaseHttps();
  }
}

// Download file using gh CLI
async function downloadFileGh(assetName, dest, releaseTag) {
  const tempDest = `${dest}.tmp`;
  
  try {
    console.log('📥 Downloading with gh CLI...');
    
    // Use gh release download command
    await execAsync(
      `gh release download ${releaseTag} --repo ${REPO_OWNER}/${REPO_NAME} --pattern "${assetName}" --output "${tempDest}"`,
      { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
    );
    
    // Move temp file to final destination
    const fs = require('fs');
    fs.renameSync(tempDest, dest);
    
    console.log('✅ Downloaded successfully with gh CLI');
  } catch (error) {
    try { unlinkSync(tempDest); } catch {}
    throw new Error(`gh CLI download failed: ${error.message}`);
  }
}

// Download file using HTTPS
async function downloadFileHttps(url, dest, progressCallback) {
  return new Promise((resolve, reject) => {
    const tempDest = `${dest}.tmp`;
    const file = createWriteStream(tempDest);
    
    const options = {
      headers: {
        'User-Agent': 'flexbuffers-js-postinstall',
        'Accept': 'application/octet-stream',
      }
    };

    if (GITHUB_TOKEN) {
      options.headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }

    function handleResponse(response) {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, handleResponse).on('error', handleError);
      } else if (response.statusCode === 200) {
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        if (progressCallback && totalSize) {
          response.on('data', (chunk) => {
            downloadedSize += chunk.length;
            progressCallback(downloadedSize, totalSize);
          });
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            // Move temp file to final destination
            const fs = require('fs');
            fs.renameSync(tempDest, dest);
            resolve();
          });
        });
      } else {
        file.close();
        try { unlinkSync(tempDest); } catch {}
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }

    function handleError(err) {
      file.close();
      try { unlinkSync(tempDest); } catch {}
      reject(err);
    }

    https.get(url, options, handleResponse).on('error', handleError);
  });
}

async function downloadFile(asset, dest, releaseTag, progressCallback) {
  if (USE_GH_CLI && await hasGhCli()) {
    try {
      await downloadFileGh(asset.name, dest, releaseTag);
    } catch (error) {
      console.warn(`gh CLI download failed: ${error.message}`);
      console.log('Falling back to HTTPS download...');
      await downloadFileHttps(asset.url, dest, progressCallback);
    }
  } else {
    await downloadFileHttps(asset.url, dest, progressCallback);
  }
}

// Check if gh CLI is available and authenticated
async function hasGhCli() {
  try {
    await execAsync('gh --version');
    
    // Check if authenticated for private repos
    if (GITHUB_TOKEN) {
      // gh CLI will use GITHUB_TOKEN env var automatically
      return true;
    }
    
    // Check if already authenticated
    try {
      await execAsync('gh auth status');
      return true;
    } catch {
      console.warn('⚠️  gh CLI is installed but not authenticated. For private repos, run: gh auth login');
      return true; // Still use gh CLI, it might work for public repos
    }
  } catch {
    return false;
  }
}

// Check if we have necessary build tools
async function checkBuildTools() {
  const tools = {
    rust: { cmd: 'rustc --version', name: 'Rust' },
    cargo: { cmd: 'cargo --version', name: 'Cargo' },
    bun: { cmd: 'bun --version', name: 'Bun' },
  };

  const missing = [];
  
  for (const [key, tool] of Object.entries(tools)) {
    try {
      await execAsync(tool.cmd);
    } catch {
      missing.push(tool.name);
    }
  }

  return missing;
}

// Build from source with better error handling
async function buildFromSource() {
  console.log('\n🔨 Building from source...');
  
  // Check build tools
  const missingTools = await checkBuildTools();
  if (missingTools.length > 0) {
    console.error(`\n❌ Missing required build tools: ${missingTools.join(', ')}`);
    console.error('\nPlease install:');
    if (missingTools.includes('Rust') || missingTools.includes('Cargo')) {
      console.error('  - Rust: curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh');
    }
    if (missingTools.includes('Bun')) {
      console.error('  - Bun: curl -fsSL https://bun.sh/install | bash');
    }
    process.exit(1);
  }

  return new Promise((resolve, reject) => {
    const buildProcess = spawn('bun', ['run', 'build'], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, RUST_BACKTRACE: '1' }
    });

    buildProcess.on('exit', (code) => {
      if (code === 0) {
        console.log('✅ Build completed successfully!');
        resolve();
      } else {
        reject(new Error(`Build failed with code ${code}`));
      }
    });

    buildProcess.on('error', (err) => {
      reject(new Error(`Failed to start build process: ${err.message}`));
    });
  });
}

// Cache management
async function getCachedBinary(binaryName, releaseTag) {
  const fs = require('fs').promises;
  const cacheFile = join(CACHE_DIR, releaseTag, binaryName);
  
  try {
    await fs.access(cacheFile);
    console.log(`📦 Using cached binary from ${cacheFile}`);
    return cacheFile;
  } catch {
    return null;
  }
}

async function saveToCacheAndCopy(sourcePath, binaryName, releaseTag, destPath) {
  const fs = require('fs').promises;
  const cacheFile = join(CACHE_DIR, releaseTag, binaryName);
  const cacheDir = dirname(cacheFile);
  
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.copyFile(sourcePath, cacheFile);
    await fs.copyFile(cacheFile, destPath);
    console.log(`💾 Saved to cache: ${cacheFile}`);
  } catch (error) {
    console.warn(`Failed to cache binary: ${error.message}`);
    // Still copy to destination even if caching fails
    await fs.copyFile(sourcePath, destPath);
  }
}

async function main() {
  console.log('🚀 FlexBuffers.js Post-Install Script');
  console.log(`📍 Platform: ${platform()} ${arch()} (${getPlatformTarget()})`);
  
  if (SKIP_DOWNLOAD) {
    console.log('⏭️  Skipping download (FLEXBUFFERS_SKIP_DOWNLOAD=true)');
    return;
  }

  try {
    const binaryName = `flexbuffers-js.${getPlatformTarget()}.node`;
    const binaryPath = join(__dirname, '..', binaryName);
    
    if (existsSync(binaryPath) && !FORCE_BUILD) {
      console.log(`✅ Binary ${binaryName} already exists.`);
      return;
    }

    if (FORCE_BUILD) {
      console.log('🔧 Forcing local build (FLEXBUFFERS_FORCE_BUILD=true)');
      await buildFromSource();
      return;
    }

    // Try to get release info
    console.log('🔍 Checking for pre-built binaries...');
    const release = await getLatestRelease();
    console.log(`📌 Found release: ${release.tag_name}`);

    // Check cache first
    const cachedBinary = await getCachedBinary(binaryName, release.tag_name);
    if (cachedBinary) {
      const fs = require('fs').promises;
      await fs.copyFile(cachedBinary, binaryPath);
      chmodSync(binaryPath, 0o755);
      console.log('✅ Restored from cache successfully!');
      return;
    }

    // Find matching asset
    const asset = release.assets.find(a => a.name === binaryName);

    if (!asset) {
      console.warn(`\n⚠️  No pre-built binary found for platform: ${getPlatformTarget()}`);
      
      // Show available platforms
      const availablePlatforms = release.assets
        .filter(a => a.name.endsWith('.node'))
        .map(a => a.name.replace('flexbuffers-js.', '').replace('.node', ''));
      
      if (availablePlatforms.length > 0) {
        console.log('\n📋 Available platforms:');
        availablePlatforms.forEach(p => console.log(`   - ${p}`));
      }
      
      await buildFromSource();
      return;
    }

    // Download the asset with progress bar
    console.log(`\n📥 Downloading ${asset.name} (${(asset.size / 1024 / 1024).toFixed(2)} MB)...`);
    
    const progressBar = new ProgressBar(asset.size);
    await downloadFile(asset, binaryPath, release.tag_name, (current, total) => {
      progressBar.update(current);
    });

    // Set executable permissions on Unix-like systems
    if (platform() !== 'win32') {
      chmodSync(binaryPath, 0o755);
    }

    // Save to cache
    await saveToCacheAndCopy(binaryPath, binaryName, release.tag_name, binaryPath);

    console.log('✅ Binary downloaded and installed successfully!');

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    
    if (error.message.includes('private repository') || error.message.includes('404')) {
      console.error('\n🔐 For private repositories:');
      console.error('   export GITHUB_TOKEN=your_personal_access_token');
      console.error('   bun install\n');
    }
    
    console.error('🔄 Attempting local build as fallback...\n');
    
    try {
      await buildFromSource();
    } catch (buildError) {
      console.error(`\n❌ Build failed: ${buildError.message}`);
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Ensure Rust is installed: https://rustup.rs');
      console.error('   2. Ensure Bun is installed: https://bun.sh');
      console.error('   3. Check the error messages above');
      console.error('   4. Report issues at: https://github.com/bapa-team/flexbuffers-js/issues');
      process.exit(1);
    }
  }
}

// Only run if this is the main module
if (require.main === module) {
  main().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
}