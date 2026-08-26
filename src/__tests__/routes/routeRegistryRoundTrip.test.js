import { describe, it, expect } from "vitest";
import {
  ROUTES,
  SLUG_TO_PAGE,
  buildPath,
  resolvePath,
  getRoute,
} from "../../routes/routeRegistry";

/**
 * URL round-tripping (#25).
 *
 * App.jsx navigates by setting `currentPage` in state *and* pushing `buildPath(page, data)`. The
 * two are independent: the page renders from state, the URL is only read again on a reload, a
 * bookmark, or Back/Forward. So a `buildPath` that emits a URL `resolvePath` cannot resolve is
 * invisible until the user refreshes, and then the page is simply gone.
 *
 * Parameterised routes used to be excluded from SLUG_TO_PAGE altogether, so all six of them pushed
 * a bare slug that resolved to `not-found`. Two of the six are navbar links.
 */

const PARAMETERISED = ROUTES.filter((route) => route.param);

/** Slugs owned outright by a route that takes no parameter. */
const LIST_PAGE_SLUGS = new Set(
  ROUTES.filter((route) => !route.param).flatMap((route) => route.slugs)
);

/**
 * Every page key whose bare slug it actually owns.
 *
 * `blog-post` is excluded, and only `blog-post`: its slug is `blog`, which belongs to the blog list
 * page. A detail route that shares a list page's slug is the one case where entering it without a
 * parameter legitimately lands somewhere else - on the list you would have picked the record from.
 */
const ALL_PAGES = ROUTES.filter(
  (route) => !(route.param && route.slugs.every((slug) => LIST_PAGE_SLUGS.has(slug)))
).map((route) => route.page);

describe("every route round-trips through the URL", () => {
  it.each(ALL_PAGES)("%s resolves back to itself when entered with no data", (page) => {
    const url = buildPath(page, null).replace(/^\//, "");
    expect(resolvePath(url).page).toBe(page);
  });

  it("sends a detail route sharing a list page's slug to the list page", () => {
    // The exclusion above, stated as a positive assertion rather than left implicit.
    expect(buildPath("blog-post", null)).toBe("/blog");
    expect(resolvePath("blog").page).toBe("blog");
  });

  it.each(PARAMETERISED.map((route) => [route.page, route.param]))(
    "%s round-trips with its %s parameter",
    (page, param) => {
      const url = buildPath(page, "REC-1001").replace(/^\//, "");
      const resolved = resolvePath(url);
      expect(resolved.page).toBe(page);
      expect(resolved.data).toBe("REC-1001");
      expect(param).toBeTruthy();
    }
  );

  it("preserves the case of a parameter while matching the slug case-insensitively", () => {
    const resolved = resolvePath("Edit-Equipment/EQ-1001");
    expect(resolved.page).toBe("edit-equipment");
    expect(resolved.data).toBe("EQ-1001");
  });

  it("decodes an encoded parameter", () => {
    const url = buildPath("blog-post", "a post/with slash").replace(/^\//, "");
    expect(resolvePath(url).data).toBe("a post/with slash");
  });
});

describe("the two navbar links that were dead", () => {
  // Navbar.jsx lists both of these with no data at all, so these are the exact URLs a technician
  // and a supplier put in their address bar by clicking the second item in their own menu.
  it("resolves /update-task to the update-task page", () => {
    expect(resolvePath("update-task").page).toBe("update-task");
    expect(resolvePath("update-task").data).toBeNull();
  });

  it("resolves /orderstatus to the orderstatus page", () => {
    expect(resolvePath("orderstatus").page).toBe("orderstatus");
    expect(resolvePath("orderstatus").data).toBeNull();
  });

  it("still resolves the aliased slug for update-task", () => {
    expect(resolvePath("updatetask").page).toBe("update-task");
  });
});

describe("a list page keeps its own slug", () => {
  // `blog` is the one case the original exclusion was right about: the bare slug belongs to the
  // list page, and the detail route must not be able to take it.
  it("gives /blog to the blog list, not the post detail", () => {
    expect(resolvePath("blog").page).toBe("blog");
    expect(SLUG_TO_PAGE.blog).toBe("blog");
  });

  it("still routes /blog/:slug to the post detail", () => {
    expect(resolvePath("blog/my-first-post")).toEqual({
      page: "blog-post",
      data: "my-first-post",
    });
  });

  it("never lets a parameterised route displace a list page", () => {
    // Stated as an invariant over the whole registry rather than the one case we know about.
    const listPageSlugs = new Set(
      ROUTES.filter((route) => !route.param).flatMap((route) => route.slugs)
    );
    for (const route of PARAMETERISED) {
      for (const slug of route.slugs) {
        if (listPageSlugs.has(slug)) {
          expect(SLUG_TO_PAGE[slug]).not.toBe(route.page);
        }
      }
    }
  });
});

describe("unknown paths still 404", () => {
  it.each(["nope", "equipment/extra/segments", "update-task-ish"])(
    "%s resolves to not-found",
    (path) => {
      expect(resolvePath(path).page).toBe("not-found");
    }
  );

  it("resolves the empty path to the landing page", () => {
    expect(resolvePath("")).toEqual({ page: "landing", data: null });
  });
});

describe("registry integrity", () => {
  it("gives every route a reachable slug", () => {
    for (const route of ROUTES) {
      const claimed = route.slugs.some((slug) => SLUG_TO_PAGE[slug] === route.page);
      // The one legitimate exception is a detail route sharing a list page's slug.
      const sharesAListPageSlug = route.param
        && route.slugs.some((slug) => SLUG_TO_PAGE[slug] && SLUG_TO_PAGE[slug] !== route.page);
      expect(claimed || sharesAListPageSlug).toBe(true);
    }
  });

  it("resolves every slug in the table to a registered route", () => {
    for (const page of Object.values(SLUG_TO_PAGE)) {
      expect(getRoute(page)).toBeTruthy();
    }
  });
});
