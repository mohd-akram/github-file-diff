/**
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} hash
 * @param {string} path
 */
async function* getTreeFiles(owner, repo, hash, path) {
  const [treeRes, treeCommitInfoRes] = await Promise.all(
    ["tree", "tree-commit-info"].map((t) =>
      fetch(`https://github.com/${owner}/${repo}/${t}/${hash}/${path}`, {
        headers: { Accept: "application/json" },
      })
    )
  );
  if (treeRes.status == 404) {
    yield path;
    return;
  }
  /**
   * @type {{
   *  payload: {
   *    tree: {  items: { contentType: 'file' | 'directory', name: string }[] }
   *  }
   * }}
   */
  const {
    payload: {
      tree: { items },
    },
  } = await treeRes.json();
  /** @type {Record<string, { oid: string }>} */
  const files = await treeCommitInfoRes.json();
  /** @type {(Iterable<string> | AsyncIterable<string>)[]} */
  const pending = [];
  for (const { name, contentType: type } of items) {
    const { oid } = files[name];
    if (oid != hash) continue;
    const p = `${path}/${name}`;
    if (type == "directory") pending.push(getTreeFiles(owner, repo, oid, p));
    else if (type == "file") pending.push([p]);
  }
  for (const p of pending) yield* p;
}

/**
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} hash
 * @param {string} path
 */
async function getBlob(owner, repo, hash, path) {
  const text = await (
    await fetch(
      `https://github.com/${owner}/${repo}/blob/${hash}/${path}?plain=1`,
      { headers: { Accept: "application/json" } }
    )
  ).text();
  try {
    return JSON.parse(text).payload.blob.rawLines.join("\n");
  } catch (e) {
    const doc = new DOMParser().parseFromString(text, "text/html");
    return (
      getData(doc)?.payload.blob.rawLines.join("\n") ??
      Array.from(doc.querySelectorAll(".blob-code"), (l) =>
        l.textContent.replace("\n", "")
      ).join("\n")
    );
  }
}

/**
 *
 * @param {Document} doc
 */
function getData(doc) {
  return /** @type {{ payload: { blob: { rawLines: string[] }, commitGroups: { commits: { oid: string, bodyMessageHtml: string }[] }[] }}} */ (
    JSON.parse(
      doc.querySelector('[data-target="react-app.embeddedData"]')
        ?.textContent ?? null
    )
  );
}

/**
 *
 * @param {ReturnType<typeof getData>} data
 */
function getCommits(data) {
  if (!data) return;
  return data.payload.commitGroups.flatMap((g) => g.commits);
}

/**
 *
 * @param {Element} element
 */
function getCommitLinks(element) {
  const repoPath = location.pathname.match(/(\/[^/]+){2}/)[0];
  const commitLinkSelector = `a[href^="${repoPath}/commit/"]`;
  return /** @type {NodeListOf<HTMLAnchorElement>} */ (
    element.querySelectorAll(commitLinkSelector)
  );
}

/**
 *
 * @param {Element} linkElement
 * @param {ReturnType<typeof getCommits>[0]} info
 */
function getCommitElement(linkElement, info) {
  const commit = /** @type {Element} */ (
    linkElement.closest("[data-testid=commit-row-item]").cloneNode(true)
  );

  const title = commit.querySelector("h4");
  title.className = "commit-title pb-2";
  const expander = title.querySelector(".octicon-ellipsis");
  if (expander) expander.remove();

  const description = info?.bodyMessageHtml;
  let desc;
  if (description) {
    desc = document.createElement("div");
    desc.className = "commit-desc";
    const pre = document.createElement("pre");
    pre.innerHTML = description;
    desc.appendChild(pre);
  }

  const links = getCommitLinks(title);
  for (const link of links) {
    const text = document.createTextNode(link.innerText);
    link.replaceWith(text);
  }
  const hash = getHash(links[0]);

  const meta = document.createElement("div");
  meta.className =
    "commit-meta p-2 d-flex flex-wrap gap-3 flex-column flex-md-row";

  const metaDesc = /** @type {Element} */ (
    commit.querySelector("[data-testid=author-avatar]")?.cloneNode(true)
  );
  if (metaDesc) {
    metaDesc.className = "flex-1";
    meta.appendChild(metaDesc);
  }

  const shaBlock = document.createElement("span");
  shaBlock.className = "sha-block";
  const sha = document.createElement("span");
  sha.className = "sha";
  sha.innerText = hash;
  shaBlock.appendChild(document.createTextNode("commit "));
  shaBlock.appendChild(sha);

  meta.appendChild(shaBlock);

  const element = document.createElement("div");
  element.className = "commit full-commit";
  element.appendChild(title);
  if (desc) element.appendChild(desc);
  element.appendChild(meta);

  return element;
}

/**
 *
 * @param {HTMLAnchorElement} element
 */
function getHash(element) {
  if (!element) return;
  return element.href.split("/").pop().split("#")[0];
}

/**
 *
 * @param {string} path
 * @param {HTMLAnchorElement} element
 * @param {HTMLAnchorElement} prevElement
 * @param {Record<string, { element: HTMLElement, items: ReturnType<typeof getDiffs> }>} cache
 * @param {ReturnType<typeof getCommits>[0]} info
 */
function addClickHandler(path, element, prevElement, cache, info) {
  if (!path || element.classList.contains("github-file-diff-link")) return;

  const existingContent = element.closest("[data-hpc=true]").parentElement;
  const existingTitle = document.title;

  const parts = new URL(element.href).pathname.split("/");
  const owner = parts[1];
  const repo = parts[2];
  const message = element.innerText;
  const hash = getHash(element);
  const prevHash = getHash(prevElement);
  const key = `${owner}/${repo}@${hash}:${path}`;

  element.addEventListener("click", async (e) => {
    e.preventDefault();
    const diffs = cache[key] || {
      element: document.createElement("div"),
      items: getDiffs(owner, repo, hash, prevHash, path),
    };
    cache[key] = diffs;
    let loading = false;
    const loadDiffs = async () => {
      if (loading) return;
      loading = true;
      const pending = [];
      // Load 10 diffs at a time
      for (let i = 0; i < 10; i++)
        pending.push(
          diffs.items.next().then((d) => {
            if (d.value) diffs.element.appendChild(d.value);
          })
        );
      await Promise.all(pending);
      loading = false;
    };
    loadDiffs();
    const containerElement = document.createElement("div");
    const breadcrumb = document
      .querySelector("[aria-label=Breadcrumbs]")
      .cloneNode(true);
    containerElement.className = existingContent.className;
    containerElement.classList.add("github-file-diff");
    containerElement.appendChild(getCommitElement(element, info));
    containerElement.appendChild(breadcrumb);
    containerElement.appendChild(diffs.element);
    existingContent.after(containerElement);
    existingContent.style.display = "none";
    const title = `${message} · ${owner}/${repo}@${hash.slice(
      0,
      7
    )}:${path} · GitHub`;
    document.title = title;
    history.pushState({ key }, title, element.href);
    const handler = () => {
      containerElement.remove();
      existingContent.style.display = "";
      if (document.title == title) document.title = existingTitle;
      window.removeEventListener("popstate", handler);
      window.removeEventListener("scroll", scrollHandler);
    };
    const scrollHandler = () => {
      if (window.innerHeight + window.pageYOffset >= document.body.offsetHeight)
        loadDiffs();
    };
    window.addEventListener("popstate", handler);
    window.addEventListener("scroll", scrollHandler);
  });
  element.classList.add("github-file-diff-link");
}

/**
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} hash
 * @param {string} prevHash
 * @param {string} path
 */
async function* getDiffs(owner, repo, hash, prevHash, path) {
  for await (const p of getTreeFiles(owner, repo, hash, path)) {
    let curr,
      prev = "";
    if (prevHash) {
      [curr, prev] = await Promise.all([
        getBlob(owner, repo, hash, p),
        getBlob(owner, repo, prevHash, p).catch((_) => ""),
      ]);
    } else curr = await getBlob(owner, repo, hash, p);
    const diffElement = document.createElement("div");
    const diff = Diff.createPatch(p, prev, curr);
    const diff2htmlUi = new Diff2HtmlUI(diffElement, diff, {
      drawFileList: false,
    });
    diff2htmlUi.draw();
    yield diffElement;
  }
}

async function main() {
  const load = () => {
    const parts = location.pathname.split("/");
    if (parts[3] != "commits") return;
    /** @type {Record<string, any>} */
    const cache = {};
    const commits = getCommits(getData(document));
    const elements = document.querySelectorAll("[data-testid=commit-row-item]");
    for (const [i, element] of elements.entries()) {
      const prevElement = elements[i + 1];
      if (!prevElement) continue;
      /** @type {HTMLAnchorElement | null} */
      const link = element.querySelector("[data-testid=commit-row-view-code]");
      if (!link) continue;
      const path = new URL(link.href).pathname.split("/").slice(5).join("/");
      // The commit title is broken up by issue/pr links
      // Add the handler to all of them
      const links = getCommitLinks(element);
      const prevLink = getCommitLinks(prevElement)[0];
      const hash = getHash(links[0]);
      const info = commits?.find((c) => c.oid == hash);
      for (const link of links)
        addClickHandler(path, link, prevLink, cache, info);
    }
  };

  load();
  const observer = new MutationObserver(load);
  observer.observe(document.body, {
    attributeFilter: ["class"],
    childList: true,
  });
}

main();
