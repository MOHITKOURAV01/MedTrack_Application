/**
 * Shared empty-state primitive.
 *
 * Six hub pages previously defined their own `EmptyState` component inline, identical except for
 * the icon. This module is the single source of truth.
 *
 * Two calling conventions are supported, because two arrived independently and both are in use:
 *
 *   Hub consoles (13 pages) pass a message and a lucide icon *component*:
 *
 *     <EmptyState message="No cartridges loaded" icon={Thermometer} />
 *
 *   Everything else passes a title, an optional description, an optional icon *node*, and an
 *   optional action:
 *
 *     <EmptyState title="No results" description="Try a wider date range." icon="📦"
 *                 action={<button onClick={reset}>Clear filters</button>} />
 *
 * `icon` distinguishes them by type rather than by a second prop. The test is "is this already
 * renderable?" - a string, a number or a React element is a node and goes in as-is; anything
 * else non-null is a component type and gets instantiated. Deliberately not `typeof icon ===
 * "function"`: a lucide icon is `forwardRef(...)`, which is an object, so a function check
 * would send every hub console's icon down the node branch and React would refuse to render it.
 *
 * That leaves the hub pages untouched while giving everyone else a heading, a body, and
 * somewhere to put the way out - an empty state whose only job is to say "nothing here" is the
 * least useful version of one.
 *
 * The component previously had no default export and no defaults at all, so `<EmptyState />` -
 * the one call an empty-state primitive should certainly survive - threw on `<Icon />` because
 * `icon` was undefined.
 */

import { isValidElement } from "react";

const DEFAULT_TITLE = "No data found";

export function EmptyState({
  title,
  message,
  description,
  icon,
  action,
  className = "",
}) {
  // `message` is the hub pages' name for the heading. `title` wins when both are present.
  const heading = title || message || DEFAULT_TITLE;

  // Already renderable -> node. Otherwise it is a component type: a plain function, or the
  // forwardRef object every lucide icon actually is.
  const iconIsNode =
    typeof icon === "string" || typeof icon === "number" || isValidElement(icon);
  const IconComponent = icon != null && !iconIsNode ? icon : null;

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 py-14 text-center text-slate-500 ${className}`}
    >
      {IconComponent ? <IconComponent size={28} className="mb-2 opacity-40" /> : null}
      {iconIsNode ? <div className="mb-2 text-4xl opacity-60">{icon}</div> : null}

      <p className="text-sm font-medium text-slate-400">{heading}</p>

      {description ? (
        <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>
      ) : null}

      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
