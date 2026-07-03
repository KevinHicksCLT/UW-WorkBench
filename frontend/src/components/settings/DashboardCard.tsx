import { useNavigate } from 'react-router-dom';
import { useDialogs } from '../../lib/dialogs';
import { usePreferences } from '../../lib/preferences';
import { Button, Card } from '../ui';

// Personal dashboard layout — the arrangement itself is edited in place on the
// Home page ("Customize"); this card explains that and offers the reset.
export default function DashboardCard() {
  const { prefs, update } = usePreferences();
  const { confirm } = useDialogs();
  const navigate = useNavigate();
  const hasPersonal = prefs.dashboard != null;

  return (
    <Card variant="elevated" className="p-4">
      <h2 className="text-sm font-semibold text-[#171717]">Dashboard layout</h2>
      <p className="text-[11px] text-[#666666] mt-0.5 mb-3">
        {hasPersonal
          ? 'You have a personal card arrangement. It overrides the company default on your Home page.'
          : 'You are using the company default. Rearrange or hide cards from the Home page.'}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => navigate('/?customize=1')}>
          Customize on Home
        </Button>
        {hasPersonal && (
          <Button
            variant="ghost"
            onClick={async () => {
              const ok = await confirm({
                title: 'Reset dashboard?',
                message:
                  'Your personal card arrangement will be removed and the company default restored.',
                confirmLabel: 'Reset',
              });
              if (ok) update({ dashboard: null });
            }}
          >
            Reset to company default
          </Button>
        )}
      </div>
    </Card>
  );
}
