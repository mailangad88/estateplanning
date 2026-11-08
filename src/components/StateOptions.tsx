import { DROPDOWN_STATES, OTHER_STATE } from "@/config/firm";
import { stateNames } from "@/lib/served-state-names";

/**
 * The <option> list for every state dropdown on the site: the states in DROPDOWN_STATES (Illinois and
 * New Jersey right now), plus "Another state" where the form should send everyone else to the out-of-state message.
 *
 * `current` keeps a value that came from elsewhere (a link, an earlier visit) visible instead of silently
 * showing the first option.
 */
export default function StateOptions({
  current,
  other = false,
  placeholder,
}: {
  current?: string;
  other?: boolean;
  placeholder?: string;
}) {
  const list: string[] = [...DROPDOWN_STATES];
  const cur = current?.toUpperCase();
  const extra = cur && cur !== OTHER_STATE && !list.includes(cur) ? cur : null;
  return (
    <>
      {placeholder !== undefined && <option value="" disabled>{placeholder}</option>}
      {list.map((s) => <option key={s} value={s}>{stateNames([s])[0] ?? s}</option>)}
      {extra && <option value={extra}>{stateNames([extra])[0] ?? extra}</option>}
      {other && <option value={OTHER_STATE}>Another state</option>}
    </>
  );
}
