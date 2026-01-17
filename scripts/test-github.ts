#!/usr/bin/env bun
/**
 * Test script to verify Octokit migration
 * Run: bun run scripts/test-github.ts
 */

import { getGitHubToken, createOctokit, getCurrentUser, getRateLimit } from '../packages/server/src/services/auth.ts';
import { githubService } from '../packages/server/src/services/github.ts';

async function testAuth() {
  console.log('\n🔐 Testing GitHub Authentication...\n');

  try {
    // Test 1: Extract token
    console.log('1️⃣  Extracting GitHub token...');
    const token = await getGitHubToken();
    console.log(`   ✅ Token extracted: ${token.slice(0, 10)}...${token.slice(-5)}`);

    // Test 2: Create Octokit instance
    console.log('\n2️⃣  Creating Octokit instance...');
    const octokit = await createOctokit();
    console.log('   ✅ Octokit instance created');

    // Test 3: Get authenticated user
    console.log('\n3️⃣  Fetching authenticated user...');
    const user = await getCurrentUser();
    console.log(`   ✅ Authenticated as: ${user.login}`);
    console.log(`   📧 Email: ${user.email || 'N/A'}`);
    console.log(`   👤 Name: ${user.name || 'N/A'}`);

    // Test 4: Get rate limit
    console.log('\n4️⃣  Checking API rate limit...');
    const rateLimit = await getRateLimit();
    console.log(`   ✅ Rate Limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
    console.log(`   🔄 Resets at: ${rateLimit.reset.toLocaleTimeString()}`);

    return true;
  } catch (error) {
    console.error('\n❌ Authentication test failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function testGitHubService() {
  console.log('\n\n🔧 Testing GitHub Service...\n');

  try {
    // Test 1: Check authentication
    console.log('1️⃣  Checking authentication status...');
    const isAuth = await githubService.isAuthenticated();
    console.log(`   ${isAuth ? '✅' : '❌'} Authentication: ${isAuth ? 'success' : 'failed'}`);

    if (!isAuth) {
      console.log('\n⚠️  Not authenticated. Please run: gh auth login');
      return false;
    }

    // Test 2: Get repo info
    console.log('\n2️⃣  Getting repository info...');
    try {
      const repoInfo = await githubService.getRepoInfo();
      console.log(`   ✅ Repository: ${repoInfo.nameWithOwner}`);
      console.log(`   📦 Owner: ${repoInfo.owner}`);
      console.log(`   📁 Repo: ${repoInfo.repo}`);

      // Test 3: List PRs
      console.log('\n3️⃣  Listing pull requests...');
      const prs = await githubService.listPRs('open', 5);
      console.log(`   ✅ Found ${prs.length} open PRs`);

      if (prs.length > 0) {
        console.log('\n   Recent PRs:');
        prs.forEach((pr, i) => {
          console.log(`   ${i + 1}. #${pr.number} - ${pr.title}`);
          console.log(`      Author: ${pr.author.login} | State: ${pr.state} | Draft: ${pr.isDraft}`);
        });

        // Test 4: Get PR details
        const firstPR = prs[0];
        if (firstPR) {
          console.log(`\n4️⃣  Getting details for PR #${firstPR.number}...`);
          const prDetail = await githubService.getPRDetail(firstPR.number);
          console.log(`   ✅ PR Details loaded`);
          console.log(`   📝 Title: ${prDetail.title}`);
          console.log(`   📊 Files: ${prDetail.files?.length || 0}`);
          console.log(`   📦 Commits: ${prDetail.commits?.length || 0}`);
          console.log(`   ➕ Additions: ${prDetail.additions || 0}`);
          console.log(`   ➖ Deletions: ${prDetail.deletions || 0}`);

          // Test 5: Get PR diff
          console.log(`\n5️⃣  Getting diff for PR #${firstPR.number}...`);
          const diff = await githubService.getPRDiff(firstPR.number);
          const diffLines = diff.split('\n').length;
          console.log(`   ✅ Diff loaded (${diffLines} lines)`);

          // Test 6: Get PR comments
          console.log(`\n6️⃣  Getting comments for PR #${firstPR.number}...`);
          const comments = await githubService.getPRComments(firstPR.number);
          console.log(`   ✅ Found ${comments.length} review comments`);
        }
      } else {
        console.log('\n   ℹ️  No open PRs to test with');
      }
    } catch (error: any) {
      if (error.code === 'INVALID_REPO') {
        console.log('\n   ⚠️  Not in a GitHub repository');
        console.log('   💡 Please run this test from within a git repository');
        return false;
      }
      throw error;
    }

    return true;
  } catch (error) {
    console.error('\n❌ GitHub service test failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       GitHub Octokit Migration Test Suite                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const authResult = await testAuth();
  const serviceResult = await testGitHubService();

  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                      Test Results                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log(`   Authentication: ${authResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   GitHub Service: ${serviceResult ? '✅ PASS' : '❌ FAIL'}`);

  if (authResult && serviceResult) {
    console.log('\n🎉 All tests passed! Octokit migration successful.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above.\n');
    process.exit(1);
  }
}

main();
