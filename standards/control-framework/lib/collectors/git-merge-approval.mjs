// git-merge-approval.mjs — a LIVE source collector for change-management controls
// (e.g. SOX-ITGC-CM-02 "developers cannot approve or deploy their own changes").
//
// It binds to a REAL source — the local Git history (SCM/Git access method) — and, when a
// GitHub token is available, enriches it with PR review data from the GitHub API. It returns
// metrics shaped exactly like a fixture so the control framework can run unchanged.
//
// Honest boundary: local Git proves WHO merged and authored each change; it cannot prove an
// independent review APPROVED it (that lives in the GitHub review API / MCP). When the review
// source is unavailable, no merge can be EVIDENCED as independently approved, so every merge is
// counted as self-approved (absence of evidence = exception) and the missing review source is
// reported so the framework raises it as technical debt.

import { execFileSync } from 'node:child_process';

const git = (repoDir, args) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim();

/** Collect change-governance facts for a repo's default branch. */
export async function collect({ repoDir, defaultBranch = 'master', githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN, ownerRepo } = {}) {
  const headSha = git(repoDir, ['rev-parse', 'HEAD']);
  let remote = '';
  try { remote = git(repoDir, ['remote', 'get-url', 'origin']); } catch { /* no remote */ }

  // All PR-merge commits on the default branch.
  const SEP = '';
  const raw = git(repoDir, ['log', defaultBranch, '--merges', '--grep=Merge pull request', `--pretty=%H${SEP}%an${SEP}%ae${SEP}%s`]);
  const lines = raw ? raw.split('\n') : [];

  const records = [];
  for (const line of lines) {
    const [sha, mergeAuthorName, mergeAuthorEmail, subject] = line.split(SEP);
    const prMatch = subject.match(/Merge pull request #(\d+) from (\S+)/);
    const pr = prMatch ? Number(prMatch[1]) : null;
    const branch = prMatch ? prMatch[2] : '';
    // Author of the merged branch tip (second parent) = who wrote the change.
    let tipName = '', tipEmail = '';
    try { [tipName, tipEmail] = git(repoDir, ['log', '-1', `--pretty=%an${SEP}%ae`, `${sha}^2`]).split(SEP); } catch { /* shallow */ }
    const selfMerged = !!tipEmail && tipEmail.toLowerCase() === mergeAuthorEmail.toLowerCase();
    records.push({
      pr, branch, merge_sha: sha.slice(0, 12),
      merged_by: `${mergeAuthorName} <${mergeAuthorEmail}>`,
      change_author: tipEmail ? `${tipName} <${tipEmail}>` : '(unknown)',
      self_merged: selfMerged,
      independent_approval: null, // filled from the review API if available
      url: ownerRepo && pr ? `https://github.com/${ownerRepo}/pull/${pr}` : '',
    });
  }

  // Optionally enrich with GitHub review data (proves independent approval).
  let reviewSourceAvailable = false;
  if (githubToken && ownerRepo) {
    reviewSourceAvailable = true;
    const h = { headers: { Authorization: `Bearer ${githubToken}`, 'User-Agent': 'cascade-control-framework', Accept: 'application/vnd.github+json' } };
    for (const r of records) {
      if (!r.pr) continue;
      try {
        const resp = await fetch(`https://api.github.com/repos/${ownerRepo}/pulls/${r.pr}/reviews`, h);
        if (!resp.ok) { reviewSourceAvailable = false; continue; }
        const reviews = await resp.json();
        const authorEmail = (r.change_author.match(/<(.+)>/) || [])[1]?.toLowerCase();
        r.independent_approval = reviews.some((rv) => rv.state === 'APPROVED' && rv.user?.login && authorEmail && !r.change_author.includes(rv.user.login));
      } catch { reviewSourceAvailable = false; }
    }
  }

  const production_merges = records.length;
  const self_deploys = records.filter((r) => r.self_merged).length;
  const merges_with_independent_approval = reviewSourceAvailable ? records.filter((r) => r.independent_approval === true).length : 0;
  const self_approved_merges = production_merges - merges_with_independent_approval;
  const contributors = new Set(records.map((r) => r.change_author));

  return {
    provenance: {
      source: 'local git history',
      repo: remote || repoDir,
      owner_repo: ownerRepo || null,
      default_branch: defaultBranch,
      head_sha: headSha,
      method: 'git log --merges --grep "Merge pull request"; second-parent author vs merge author',
      review_source: reviewSourceAvailable ? 'GitHub review API' : 'UNAVAILABLE (no token / private) — review independence could not be evidenced',
    },
    metrics: {
      production_deploys: production_merges,
      production_merges,
      self_approved_merges,
      self_deploys,
      distinct_contributors: contributors.size,
      merges_with_independent_approval,
    },
    // The control declares two sources; reflect what we could actually reach.
    source_availability: {
      'Source Control (GitHub)': true,
      'Deployment Pipeline': false, // no CI/CD pipeline reachable from a local clone
    },
    // Honest evidence capture: git gives us the merge-actor log; branch protection and deploy
    // actor logs require the GitHub API / pipeline, which were not reachable.
    evidence_present: {
      branch_protection_config: false,
      merge_approver_log: true,
      deploy_actor_log: false,
    },
    review_source_available: reviewSourceAvailable,
    records,
  };
}
