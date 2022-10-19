async function* getTreeFiles(owner, repo, hash, path) {
  const res = await fetch(
    `https://github.com/${owner}/${repo}/file-list/${hash}/${path}`
  );
  if (res.status == 404)
    return yield path;
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const elements = doc.querySelectorAll('.js-navigation-item');
  const pending = [];
  for (const element of elements) {
    const commitLink = element.querySelector('a[href*="/commit/"]');
    if (!commitLink)
      continue;
    const lastCommitHash = commitLink.href.split('/').pop();

    const fileURL = new URL(element.querySelector('.js-navigation-open').href);
    const parts = fileURL.pathname.split('/');
    const owner = parts[1];
    const repo = parts[2];
    const type = parts[3];
    const hash = parts[4];

    if (hash != lastCommitHash)
      continue;

    const path = parts.slice(5).join('/');
    if (type == 'tree')
      pending.push(getTreeFiles(owner, repo, hash, path));
    else if (type == 'blob')
      pending.push([path]);
  }
  for (const p of await Promise.all(pending))
    yield* p;
}

const markups = [
  'markdown', 'mdown', 'mkdn', 'md',
  'textile',
  'rdoc',
  'org',
  'creole',
  'mediawiki', 'wiki',
  'rst',
  'asciidoc', 'adoc', 'asc',
  'pod',
];

const markupRegex = new RegExp(`\\.(${markups.join('|')})$`);

async function getBlob(owner, repo, hash, path) {
  const type = markupRegex.test(path) ? 'blame' : 'blob';
  const html = await (await fetch(
    `https://github.com/${owner}/${repo}/${type}/${hash}/${path}`
  )).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = Array.from(doc.querySelectorAll('.blob-code'))
    .map(c => c.innerText.replace(/^\n$/, '')).join('\n');
  return text;
}

const repoPath = location.pathname.match(/(\/[^/]+){2}/)?.[0];
const commitLinkSelector = repoPath && `p a[href^="${repoPath}/commit/"]`;

function getCommitElement(linkElement) {
  const commit = linkElement.closest('.js-commits-list-item').cloneNode(true);

  const title = commit.querySelector('p');
  title.className = 'commit-title';
  const expander = title.querySelector('.hidden-text-expander');
  if (expander)
    expander.remove();

  const description = commit.querySelector('pre');
  if (description)
    description.className = 'commit-desc';

  const links = title.querySelectorAll(commitLinkSelector);
  for (const link of links) {
    const text = document.createTextNode(link.innerText);
    link.replaceWith(text);
  }
  const hash = new URL(links[0].href).pathname.split('/').pop();

  const meta = document.createElement('div');
  meta.className = 'commit-meta';

  const shaBlock = document.createElement('span');
  shaBlock.className = 'sha-block';
  const sha = document.createElement('span');
  sha.className = 'sha';
  sha.innerText = hash;
  shaBlock.appendChild(document.createTextNode('commit '));
  shaBlock.appendChild(sha);

  meta.appendChild(shaBlock);

  const element = document.createElement('div');
  element.className = 'commit full-commit';
  element.appendChild(title);
  if (description)
    element.appendChild(description);
  element.appendChild(meta);

  return element;
}

function addClickHandler(path, element, prevElement, cache) {
  if (!path || element.classList.contains('github-file-diff-link'))
    return;

  const getHash = element =>
    element && element.href.split('/').pop().split('#')[0];

  const existingContent =
    element.closest('.js-navigation-container').parentNode;
  const existingTitle = document.title;

  const parts = new URL(element.href).pathname.split('/');
  const owner = parts[1];
  const repo = parts[2];
  const message = element.innerText;
  const hash = getHash(element);
  const prevHash = getHash(prevElement);
  const key = `${owner}/repo@${hash}:${path}`

  element.addEventListener('click', async e => {
    e.preventDefault();
    const diffs = cache[key] || {
      element: document.createElement('div'),
      items: getDiffs(owner, repo, hash, prevHash, path)
    };
    cache[key] = diffs;
    let loading = false;
    const loadDiffs = async () => {
      if (loading)
        return;
      loading = true;
      const pending = [];
      // Load 10 diffs at a time
      for (let i = 0; i < 10; i++)
        pending.push(diffs.items.next().then(d => {
          if (d.value)
            diffs.element.appendChild(d.value)
        }));
      await Promise.all(pending);
      loading = false;
    };
    loadDiffs();
    const containerElement = document.createElement('div');
    const breadcrumb = document.querySelector('.breadcrumb').cloneNode(true);
    breadcrumb.firstChild.remove();
    containerElement.className = existingContent.className;
    containerElement.classList.add('github-file-diff');
    containerElement.appendChild(getCommitElement(element));
    containerElement.appendChild(breadcrumb);
    containerElement.appendChild(diffs.element);
    existingContent.after(containerElement);
    existingContent.style.display = 'none';
    const title =
      `${message} · ${owner}/${repo}@${hash.slice(0, 7)}:${path} · GitHub`
    document.title = title;
    history.pushState({ key }, title, element.href);
    const handler = () => {
      containerElement.remove();
      existingContent.style.display = '';
      if (document.title == title)
        document.title = existingTitle;
      window.removeEventListener('popstate', handler);
      window.removeEventListener('scroll', scrollHandler);
    };
    const scrollHandler = () => {
      if (
        (window.innerHeight + window.pageYOffset) >= document.body.offsetHeight
      )
        loadDiffs();
    };
    window.addEventListener('popstate', handler);
    window.addEventListener('scroll', scrollHandler);
  });
  element.classList.add('github-file-diff-link');
}

async function* getDiffs(owner, repo, hash, prevHash, path) {
  for await (const p of getTreeFiles(owner, repo, hash, path)) {
    let curr, prev = '';
    if (prevHash) {
      [curr, prev] = await Promise.all([
        getBlob(owner, repo, hash, p),
        getBlob(owner, repo, prevHash, p).catch(_ => '')
      ]);
    } else
      curr = await getBlob(owner, repo, hash, p);
    const diffElement = document.createElement('div');
    const diff = Diff.createPatch(p, prev, curr);
    const diff2htmlUi = new Diff2HtmlUI(diffElement, diff, {
      drawFileList: false
    });
    diff2htmlUi.draw();
    yield diffElement;
  }
}

async function main() {
  const cache = {};

  const load = () => {
    const parts = location.pathname.split('/');
    if (parts[3] != 'commits')
      return;
    const path = parts.slice(5).join('/') || decodeURIComponent(
      (location.search.slice(1).split('&').filter(
        p => p.startsWith('path%5B%5D=')
      )[0] || '').slice('path%5B%5D='.length)
    );
    if (!path)
      return;
    const elements = document.querySelectorAll('.js-commits-list-item');
    for (const [i, element] of elements.entries()) {
      const prevElement = elements[i + 1];
      if (!prevElement)
        continue;
      // The commit title is broken up by issue/pr links
      // Add the handler to all of them
      const links = element.querySelectorAll(commitLinkSelector);
      const prevLink = prevElement.querySelector(commitLinkSelector);
      for (const link of links)
        addClickHandler(path, link, prevLink, cache);
    }
  };

  load();
  const observer = new MutationObserver(load);
  observer.observe(document.body, {
    attributeFilter: ['class'],
    childList: true
  });
}

main();
