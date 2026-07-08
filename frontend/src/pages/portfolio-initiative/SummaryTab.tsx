/**
 * Summary tab of the Portfolio Initiative page — description, status note,
 * details and operating-model links. Extracted verbatim from PortfolioInitiative.tsx.
 */
import { Link } from 'react-router-dom';
import { fmt } from '../../lib/format';
import { useOpenRole } from '../../lib/roleDrawer';
import { Card } from '../../components/ui';
import type { Initiative } from '../../lib/portfolio';

// ── SUMMARY ──────────────────────────────────────────────────────────────
export function SummaryTab({ init }: { init: Initiative }) {
  const openRole = useOpenRole();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card variant="elevated" className="p-5 lg:col-span-2">
        <h3 className="text-sm font-semibold text-[#171717] mb-3">Description</h3>
        <p className="text-sm text-[#525252] whitespace-pre-line">
          {init.description || 'No description provided.'}
        </p>
        {init.statusNote && (
          <div className="mt-4 pt-4 border-t border-[#f5f5f5]">
            <h3 className="text-sm font-semibold text-[#171717] mb-2">Status note</h3>
            <p className="text-sm text-[#666666] italic">{init.statusNote}</p>
          </div>
        )}
      </Card>
      <Card variant="elevated" className="p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-3">Details</h3>
        <dl className="text-sm space-y-2">
          <Field label="Workstream" value={init.workstream.name} />
          <Field label="Start" value={fmt.date(init.startDate)} />
          <Field label="Due" value={fmt.date(init.dueDate)} />
          <Field label="State" value={init.state} />
        </dl>
        <h3 className="text-sm font-semibold text-[#171717] mt-4 mb-3 pt-3 border-t border-[#f5f5f5]">
          Operating model
        </h3>
        <dl className="text-sm space-y-2">
          <Field
            label="Value stream"
            value={init.valueStreamName}
            to={init.valueStreamId ? `/overview?focus=${init.valueStreamId}` : undefined}
          />
          <Field
            label="Division"
            value={init.divisionName}
            to={init.divisionId ? `/divisions/${init.divisionId}` : undefined}
          />
          <Field
            label="Owner role"
            value={init.ownerRoleName}
            onClick={init.ownerRoleId ? () => openRole(init.ownerRoleId!) : undefined}
          />
          <Field
            label="Sponsor role"
            value={init.sponsorRoleName}
            onClick={init.sponsorRoleId ? () => openRole(init.sponsorRoleId!) : undefined}
          />
        </dl>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  to,
  onClick,
}: {
  label: string;
  value: string | null | undefined;
  to?: string;
  /** Opens the role drawer in place instead of navigating (mutually exclusive with `to`). */
  onClick?: () => void;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[#a3a3a3]">{label}</dt>
      <dd className="font-medium text-[#171717] text-right truncate">
        {value ? (
          onClick ? (
            <button type="button" onClick={onClick} className="text-[#4f46e5] hover:underline">
              {value}
            </button>
          ) : to ? (
            <Link to={to} className="text-[#4f46e5] hover:underline">
              {value}
            </Link>
          ) : (
            value
          )
        ) : (
          '—'
        )}
      </dd>
    </div>
  );
}
