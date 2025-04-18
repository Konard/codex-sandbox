#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Retrieve command-line arguments: URL and optional output file path
const [,, urlString, outputPath = 'output.html'] = process.argv;

if (!urlString) {
  console.error('Usage: node download.js <URL> [outputFile]');
  process.exit(1);
}

const maxRedirects = 5;

/**
 * Fetches the given URL and saves its response body to the destination file.
 * Follows up to `redirectsLeft` HTTP redirects.
 */
function fetchToFile(urlStr, destPath, redirectsLeft) {
  let urlObj;
  try {
    urlObj = new URL(urlStr);
  } catch (err) {
    return Promise.reject(new Error(`Invalid URL: ${urlStr}`));
  }

  const lib = urlObj.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.get(urlObj, (res) => {
      // Handle HTTP redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirectsLeft > 0) {
          return resolve(fetchToFile(res.headers.location, destPath, redirectsLeft - 1));
        } else {
          return reject(new Error('Too many redirects'));
        }
      }

      // Ensure a successful response
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Request Failed. Status Code: ${res.statusCode}`));
      }

      // Pipe the response body to the file
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      fileStream.on('error', reject);
    });

    req.on('error', reject);
  });
}

// Execute the download
fetchToFile(urlString, outputPath, maxRedirects)
  .then(() => console.log(`✅ Saved ${urlString} → ${outputPath}`))
  .catch(err => {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  });
