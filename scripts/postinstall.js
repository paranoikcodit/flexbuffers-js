#!/usr/bin/env node

const { existsSync, mkdirSync, createWriteStream, unlinkSync } = require('fs');
const { join } = require('path');
const https = require('https');
const { spawn } = require('child_process');
const { platform, arch } = require('os');

// Configuration
const REPO_OWNER = process.env.FLEXBUFFERS_REPO_OWNER || 'your-username';
const REPO_NAME = process.env.FLEXBUFFERS_REPO_NAME || 'flexbuffers-js';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.FLEXBUFFERS_GITHUB_TOKEN;

// Platform mapping
const PLATFORM_MAP = {
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
  'win32-x64': 'x86_64-pc-windows-msvc',
  'win32-ia32': 'i686-pc-windows-msvc',
  'win32-arm64': 'aarch64-pc-windows-msvc',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
};

function getPlatformTarget() {
  const platformKey = `${platform()}-${arch()}`;
  return PLATFORM_MAP[platformKey] || platformKey;
}

async function getLatestRelease() {
  return new Promise((resolve, reject) => {
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

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Failed to get latest release: ${res.statusCode} - ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    
    const options = {
      headers: {
        'User-Agent': 'flexbuffers-js-postinstall',
        'Accept': 'application/octet-stream',
      }
    };

    if (GITHUB_TOKEN) {
      options.headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }

    https.get(url, options, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close(resolve);
          });
        }).on('error', (err) => {
          unlinkSync(dest);
          reject(err);
        });
      } else if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      } else {
        file.close();
        unlinkSync(dest);
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      unlinkSync(dest);
      reject(err);
    });
  });
}

async function main() {
  try {
    // Check if binary already exists
    const binaryName = `flexbuffers-js.${getPlatformTarget()}.node`;
    const binaryPath = join(__dirname, '..', binaryName);
    
    if (existsSync(binaryPath)) {
      console.log(`Binary ${binaryName} already exists, skipping download.`);
      return;
    }

    if (!GITHUB_TOKEN) {
      console.warn('Warning: GITHUB_TOKEN not set. This might fail for private repositories.');
      console.warn('Set GITHUB_TOKEN or FLEXBUFFERS_GITHUB_TOKEN environment variable.');
    }

    console.log(`Downloading pre-built binary for ${getPlatformTarget()}...`);

    // Get latest release
    const release = await getLatestRelease();
    console.log(`Found release: ${release.tag_name}`);

    // Find matching asset
    const assetName = `flexbuffers-js.${getPlatformTarget()}.node`;
    const asset = release.assets.find(a => a.name === assetName);

    if (!asset) {
      console.error(`No pre-built binary found for platform: ${getPlatformTarget()}`);
      console.error('Available assets:', release.assets.map(a => a.name).join(', '));
      console.error('Falling back to local build...');
      
      // Try to build locally
      const buildProcess = spawn('bun', ['run', 'build'], {
        stdio: 'inherit',
        shell: true
      });

      buildProcess.on('exit', (code) => {
        if (code !== 0) {
          console.error('Local build failed!');
          process.exit(1);
        }
      });
      
      return;
    }

    // Download the asset
    console.log(`Downloading ${asset.name}...`);
    await downloadFile(asset.url, binaryPath);
    console.log(`Successfully downloaded ${asset.name}`);

  } catch (error) {
    console.error('Error during post-install:', error.message);
    console.error('Attempting local build as fallback...');
    
    // Fallback to local build
    const buildProcess = spawn('bun', ['run', 'build'], {
      stdio: 'inherit',
      shell: true
    });

    buildProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error('Local build failed!');
        process.exit(1);
      }
    });
  }
}

// Only run if this is the main module
if (require.main === module) {
  main();
}