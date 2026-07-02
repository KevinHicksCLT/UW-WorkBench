// Cross-platform husky bootstrap for the npm `prepare` script.
// Production/CI installs (Vercel omits devDependencies) don't have husky —
// git hooks are a dev-only concern, so silently skip instead of failing
// `npm install` with exit 127.
try {
  const { default: husky } = await import('husky');
  console.log(husky());
} catch {
  console.log('husky not installed — skipping git hook setup (production/CI install)');
}
