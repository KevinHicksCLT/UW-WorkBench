#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json ignoreCommand).
# Gate: Vercel's git integration only auto-builds the protected environments
# (develop, master); feature branches are deployed by CI AFTER the quality
# gates pass (see .github/workflows/ci.yml deploy-preview job), never directly
# on push.
#
# Exit 1 = proceed with build, exit 0 = skip build.
case "$VERCEL_GIT_COMMIT_REF" in
  develop|master) exit 1 ;;
  *) echo "Skipping direct Vercel build for '$VERCEL_GIT_COMMIT_REF' — CI deploys feature branches after quality gates."; exit 0 ;;
esac
