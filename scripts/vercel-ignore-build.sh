#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json ignoreCommand).
# ALL direct git-integration builds are skipped — every deployment goes
# through GitHub Actions AFTER the quality gates (and, for develop/master,
# after DB migrations) succeed:
#   - feature branches: ci.yml deploy-preview job
#   - develop/master:   promote.yml quality → migrate → deploy → smoke chain
# Exit 0 = skip build.
echo "Direct Vercel builds are disabled — deployments are gated behind CI (see promote.yml/ci.yml)."
exit 0
