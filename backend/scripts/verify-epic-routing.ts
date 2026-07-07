/** One-off: live-verify epic auto-routing in the feedback ticket generator. */
import { loadFeedbackConfig } from '../src/lib/feedback/config.js';
import { generateTicket } from '../src/lib/feedback/generateTicket.js';

const cfg = loadFeedbackConfig();
console.log(`config: issueType=${cfg.jira.issueType}, epics=${cfg.jira.epics.length}`);

const base = {
  category: 'FUNCTIONAL_DEFECT',
  name: 'Test',
  commitSha: 'deadbeef',
  userAgent: 'test',
};
const cases = [
  {
    text: 'The AI Automatable column dropdown is cut off at the bottom of the screen',
    route: '/tasks',
  },
  { text: 'This page takes 10+ seconds to load every time I open it', route: '/tasks' },
];
for (const c of cases) {
  const t = await generateTicket({ ...base, ...c }, cfg.jira.epics);
  console.log(`route=${c.route} "${c.text.slice(0, 40)}..." → ${t.epicKey}`);
}
