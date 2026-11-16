const fs = require('fs');
const path = process.env.REPORT_PATH || './reports/jest-e2e.json';

try {
  if (!fs.existsSync(path)) {
    console.log('No report file found at ' + path);
    process.exit(1);
  }

  const raw = fs.readFileSync(path, 'utf8');
  const res = JSON.parse(raw);

  console.log('\n=============================');
  console.log('     E2E TEST SUMMARY');
  console.log('=============================');
  console.log(`Suites: ${res.numPassedTestSuites} passed, ${res.numFailedTestSuites} failed, ${res.numTotalTestSuites} total`);
  console.log(`Tests:  ${res.numPassedTests} passed, ${res.numFailedTests} failed, ${res.numPendingTests} skipped, ${res.numTotalTests} total`);

  let hasFailures = false;
  if (res.testResults && Array.isArray(res.testResults)) {
    res.testResults.forEach((suite) => {
      console.log(`\nSuite: ${suite.name} -> ${suite.status}`);
      if (suite.status === 'failed' || (suite.assertionResults && suite.assertionResults.some((t) => t.status === 'failed'))) {
        hasFailures = true;
        (suite.assertionResults || []).forEach((t) => {
          if (t.status === 'failed') {
            console.log(`  ❌ FAIL: ${t.fullName}`);
            (t.failureMessages || []).forEach((msg) => {
              console.log('    ' + msg.split('\n').join('\n    '));
            });
          }
        });
        if (suite.message) {
          console.log(`  Suite failure message:\n    ${suite.message}`);
        }
      }
    });
  }

  if (hasFailures || res.numFailedTests > 0 || res.numFailedTestSuites > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
} catch (e) {
  console.error('Error reading/parsing test report:', e.message);
  process.exit(1);
}
