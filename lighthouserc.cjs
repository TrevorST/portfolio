/**
 * Lighthouse CI budget. Runs against the static build on every PR; a PR that
 * makes the site slower, heavier or less accessible fails here.
 */
module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: [
        '/index.html',
        '/projects.html',
        '/projects/circleflow.html',
        '/blog/rebuilding-this-site.html',
      ],
      numberOfRuns: 3,
      settings: {
        // Chrome flags CI runners need; harmless locally.
        chromeFlags: '--no-sandbox --headless=new',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        // JavaScript budget: the terminal island (React + engine) is the only script.
        'resource-summary:script:size': ['error', { maxNumericValue: 250_000 }],
        'total-byte-weight': ['warn', { maxNumericValue: 900_000 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
