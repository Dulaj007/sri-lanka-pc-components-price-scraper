import { USER_AGENT } from "./http";

// Minimal robots.txt parser. We only need to answer one question per
// request: "is this path allowed for our crawler?" - so this covers the
// common subset of the spec that real-world robots.txt files use:
// "User-agent: *" groups with Disallow / Allow lines, where the longest
// matching path wins.

interface RobotsRule {
  path: string;
  allow: boolean;
}

// Cache parsed rules per origin so we don't refetch robots.txt for every
// search - it's the same file for the lifetime of the process.
const robotsCache = new Map<string, RobotsRule[]>();

async function getRules(origin: string): Promise<RobotsRule[]> {
  const cached = robotsCache.get(origin);
  if (cached) return cached;

  const rules: RobotsRule[] = [];

  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (res.ok) {
      const text = await res.text();
      let inWildcardGroup = false;

      for (const rawLine of text.split("\n")) {
        const line = rawLine.split("#")[0].trim();
        if (!line) continue;

        const separator = line.indexOf(":");
        if (separator === -1) continue;

        const key = line.slice(0, separator).trim().toLowerCase();
        const value = line.slice(separator + 1).trim();

        if (key === "user-agent") {
          inWildcardGroup = value === "*";
        } else if (inWildcardGroup && key === "disallow" && value) {
          rules.push({ path: value, allow: false });
        } else if (inWildcardGroup && key === "allow" && value) {
          rules.push({ path: value, allow: true });
        }
      }
    }
  } catch {
    // No robots.txt, or it couldn't be fetched - treat as "no rules",
    // i.e. allowed. Most sites that don't serve one don't restrict
    // crawling either.
  }

  robotsCache.set(origin, rules);
  return rules;
}

// Returns true if `url` is allowed to be fetched according to the site's
// robots.txt "User-agent: *" group. Defaults to true if there is no
// robots.txt or no matching rule.
export async function isAllowedByRobots(url: string): Promise<boolean> {
  const target = new URL(url);
  const rules = await getRules(target.origin);

  let best: RobotsRule | undefined;
  for (const rule of rules) {
    if (target.pathname.startsWith(rule.path)) {
      if (!best || rule.path.length > best.path.length) {
        best = rule;
      }
    }
  }

  return best ? best.allow : true;
}
