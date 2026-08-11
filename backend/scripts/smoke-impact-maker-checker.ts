// Verifies the maker-checker guard: the author cannot approve their own packet.
const BASE = 'http://localhost:4000';

async function main() {
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'kevin.hicks@capgemini.com', password: 'demo1234' }),
  });
  const { token } = (await login.json()) as { token: string };
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const create = await fetch(`${BASE}/impact/assessments`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      subject: { kind: 'plan', initiativeId: 'x' },
      subjectName: 'Maker-checker probe',
      changeType: 'RESCHEDULE',
      status: 'RECOMMENDED',
    }),
  });
  const packet = (await create.json()) as { id: string };
  console.log('create RECOMMENDED:', create.status, packet.id);

  const approveSelf = await fetch(`${BASE}/impact/assessments/${packet.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ status: 'APPROVED' }),
  });
  console.log('approve by author (expect 403):', approveSelf.status);

  const reject = await fetch(`${BASE}/impact/assessments/${packet.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ status: 'REJECTED', decisionNote: 'probe' }),
  });
  console.log('reject by author (allowed):', reject.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
