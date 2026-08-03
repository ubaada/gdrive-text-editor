const { createHash } = require("node:crypto");

const DRIVE_URL = /^https:\/\/www\.googleapis\.com\/(upload\/)?drive\/v3\/files/;
const DRIVES_URL = /^https:\/\/www\.googleapis\.com\/drive\/v3\/drives/;
const ABOUT_URL = "https://www.googleapis.com/drive/v3/about";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function checksum(content) {
  return createHash("md5").update(content).digest("hex");
}

function unescapeDriveQueryValue(value) {
  return value.replace(/\\(.)/g, "$1");
}

function publicFile(file) {
  const { content, ...metadata } = file;
  return metadata;
}

function parseMultipart(request) {
  const contentType = request.headers()["content-type"];
  const boundary = contentType.match(/boundary=([^;]+)/)?.[1];
  const raw = request.postDataBuffer().toString("utf8");
  const parts = raw.split(`--${boundary}`);
  const metadata = JSON.parse(parts[1].split("\r\n\r\n")[1].trim());
  const content = parts[2]
    .split("\r\n\r\n")
    .slice(1)
    .join("\r\n\r\n")
    .replace(/\r\n$/, "");
  return { metadata, content };
}

async function installDriveApi(page) {
  const files = new Map();
  const sharedDrives = new Map();
  const revisions = new Map();
  const folderDelays = new Map();
  const folderListFailures = new Set();
  const searchDelays = new Map();
  const searchFailures = new Map();
  const searchQueries = [];
  const fileDelays = new Map();
  const postUploadVersionDrifts = new Set();
  const restrictedRevisionDownloads = new Set();
  const uploadFailures = new Set();
  const trashDelays = new Map();
  const trashFailures = new Set();
  let account = {
    emailAddress: "test@example.com",
    permissionId: "account-1",
  };
  let aboutRequestCount = 0;
  let failNextAbout = false;
  let failNextSearch = false;
  let searchPageSize = null;
  let nextId = 1;
  let nextRevisionId = 1;

  function addRevision(file, { keepForever = false } = {}) {
    const revision = {
      id: `revision-${nextRevisionId++}`,
      content: file.content,
      mimeType: file.mimeType,
      modifiedTime: new Date(Date.now() + nextRevisionId * 1000).toISOString(),
      size: String(Buffer.byteLength(file.content)),
      md5Checksum: checksum(file.content),
      keepForever,
      originalFilename: file.name,
      lastModifyingUser: { displayName: "Test User" },
    };
    const fileRevisions = revisions.get(file.id) || [];
    fileRevisions.push(revision);
    revisions.set(file.id, fileRevisions);
    file.headRevisionId = revision.id;
    return revision;
  }

  function addFolder({ id = `folder-${nextId++}`, name, parentId = "root" }) {
    const folder = {
      id,
      name,
      mimeType: FOLDER_MIME_TYPE,
      parents: [parentId],
      version: "1",
      modifiedTime: new Date().toISOString(),
    };
    files.set(id, folder);
    return folder;
  }

  function addFile({
    id = `file-${nextId++}`,
    name,
    content = "",
    parentId = "root",
    mimeType = "text/plain",
    driveId = null,
  }) {
    const file = {
      id,
      name,
      content,
      mimeType,
      parents: [parentId],
      md5Checksum: checksum(content),
      version: "1",
      modifiedTime: new Date().toISOString(),
      ...(driveId ? { driveId } : {}),
    };
    files.set(id, file);
    addRevision(file);
    return file;
  }

  await page.route(`${ABOUT_URL}*`, async (route) => {
    aboutRequestCount += 1;
    if (failNextAbout) {
      failNextAbout = false;
      return route.fulfill({ status: 500, body: "Account lookup failed" });
    }
    return route.fulfill({ json: { user: account } });
  });

  await page.route(DRIVES_URL, async (route) => {
    const url = new URL(route.request().url());
    const pageSize = Number(url.searchParams.get("pageSize")) || 100;
    const start = Number(url.searchParams.get("pageToken")) || 0;
    const drives = [...sharedDrives.values()];
    const pageDrives = drives.slice(start, start + pageSize);
    const nextPageToken =
      start + pageSize < drives.length
        ? String(start + pageSize)
        : undefined;
    return route.fulfill({ json: { drives: pageDrives, nextPageToken } });
  });

  await page.route(DRIVE_URL, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isUpload = url.pathname.startsWith("/upload/");
    const pathParts = url.pathname.split("/files/")[1]?.split("/") || [];
    const id = pathParts[0];
    const isRevisionRequest = pathParts[1] === "revisions";
    const revisionId = pathParts[2];

    if (request.method() === "GET" && isRevisionRequest && !revisionId) {
      const fileRevisions = revisions.get(id) || [];
      const pageSize = Number(url.searchParams.get("pageSize")) || 200;
      const start = Number(url.searchParams.get("pageToken")) || 0;
      const pageRevisions = fileRevisions.slice(start, start + pageSize).map(
        ({ content, ...metadata }) => metadata
      );
      const nextPageToken =
        start + pageSize < fileRevisions.length
          ? String(start + pageSize)
          : undefined;
      return route.fulfill({
        json: { revisions: pageRevisions, nextPageToken },
      });
    }

    if (
      request.method() === "GET" &&
      isRevisionRequest &&
      revisionId &&
      url.searchParams.get("alt") === "media"
    ) {
      const revision = revisions
        .get(id)
        ?.find((candidate) => candidate.id === revisionId);
      if (!revision) {
        return route.fulfill({
          status: 404,
          json: { error: { message: "Revision not found" } },
        });
      }
      if (
        restrictedRevisionDownloads.has(id) &&
        !revision.keepForever
      ) {
        return route.fulfill({
          status: 403,
          json: {
            error: {
              message: "This revision must be kept forever before download.",
              errors: [{ reason: "download_restricted_for_revision" }],
            },
          },
        });
      }
      return route.fulfill({ body: revision.content, contentType: revision.mimeType });
    }

    if (request.method() === "PATCH" && isRevisionRequest && revisionId) {
      const revision = revisions
        .get(id)
        ?.find((candidate) => candidate.id === revisionId);
      if (!revision) {
        return route.fulfill({ status: 404, body: "Revision not found" });
      }
      revision.keepForever = request.postDataJSON().keepForever;
      return route.fulfill({ json: { id: revision.id, keepForever: true } });
    }

    if (request.method() === "GET" && !id) {
      const query = url.searchParams.get("q") || "";
      const parentId = query.match(/'([^']+)' in parents/)?.[1];
      if (!parentId) {
        searchQueries.push(query);
        if (failNextSearch) {
          failNextSearch = false;
          return route.fulfill({ status: 500, body: "Search failed" });
        }
        const nameTerm = query.match(
          /name contains '((?:\\.|[^'])*)'/
        )?.[1];
        const contentTerms = [...query.matchAll(
          /fullText contains '((?:\\.|[^'])*)'/g
        )].map((match) => unescapeDriveQueryValue(match[1]));
        const normalizedNameTerm = nameTerm
          ? unescapeDriveQueryValue(nameTerm).toLocaleLowerCase()
          : null;
        const matches = [...files.values()]
          .filter((file) => !file.trashed)
          .filter((file) => {
            const corpus = url.searchParams.get("corpora") || "user";
            return corpus === "drive"
              ? file.driveId === url.searchParams.get("driveId")
              : !file.driveId;
          })
          .filter((file) => {
            const name = file.name.toLocaleLowerCase();
            if (normalizedNameTerm !== null) {
              return name.includes(normalizedNameTerm);
            }
            const fullText = `${file.name}\n${file.content || ""}`.toLocaleLowerCase();
            return contentTerms.every((term) => {
              const normalized = term.toLocaleLowerCase();
              return normalized.startsWith('"') && normalized.endsWith('"')
                ? fullText.includes(normalized.slice(1, -1))
                : fullText.includes(normalized);
            });
          })
          .map(publicFile);
        const searchTerm = normalizedNameTerm || contentTerms[0] || "";
        const normalizedSearchTerm = searchTerm.replace(/^"|"$/g, "");
        await delay(searchDelays.get(normalizedSearchTerm) || 0);
        const failureStatus = searchFailures.get(normalizedSearchTerm);
        if (failureStatus) {
          searchFailures.delete(normalizedSearchTerm);
          return route.fulfill({ status: failureStatus, body: "Search failed" });
        }
        const pageSize =
          searchPageSize || Number(url.searchParams.get("pageSize")) || 100;
        const start = Number(url.searchParams.get("pageToken")) || 0;
        const pageFiles = matches.slice(start, start + pageSize);
        const nextPageToken =
          start + pageSize < matches.length
            ? String(start + pageSize)
            : undefined;
        return route.fulfill({ json: { files: pageFiles, nextPageToken } });
      }
      if (folderListFailures.delete(parentId)) {
        return route.fulfill({ status: 500, body: "Folder list failed" });
      }
      const children = [...files.values()]
        .filter((file) => !file.trashed && file.parents?.includes(parentId))
        .map(publicFile);
      const configuredDelay = folderDelays.get(parentId);
      const milliseconds = Array.isArray(configuredDelay)
        ? configuredDelay.shift() || 0
        : configuredDelay || 0;
      await delay(milliseconds);
      return route.fulfill({ json: { files: children } });
    }

    if (request.method() === "GET" && id && url.searchParams.get("alt") === "media") {
      await delay(fileDelays.get(id) || 0);
      const file = files.get(id);
      return file
        ? route.fulfill({ body: file.content, contentType: file.mimeType })
        : route.fulfill({ status: 404, json: { error: { message: "Not found" } } });
    }

    if (request.method() === "GET" && id) {
      const file = files.get(id);
      return file
        ? route.fulfill({ json: publicFile(file) })
        : route.fulfill({ status: 404, json: { error: { message: "Not found" } } });
    }

    if (request.method() === "POST" && isUpload) {
      const { metadata, content } = parseMultipart(request);
      const file = addFile({
        name: metadata.name,
        content,
        parentId: metadata.parents[0],
        mimeType: metadata.mimeType,
      });
      return route.fulfill({ json: publicFile(file) });
    }

    if (request.method() === "POST") {
      const metadata = request.postDataJSON();
      const item = metadata.mimeType === FOLDER_MIME_TYPE
        ? addFolder({ name: metadata.name, parentId: metadata.parents[0] })
        : addFile({
            name: metadata.name,
            parentId: metadata.parents[0],
            mimeType: metadata.mimeType,
          });
      return route.fulfill({ json: publicFile(item) });
    }

    if (request.method() === "PATCH" && isUpload) {
      if (uploadFailures.delete(id)) {
        return route.fulfill({
          status: 500,
          json: { error: { message: "Upload failed" } },
        });
      }
      const file = files.get(id);
      file.content = request.postDataBuffer().toString("utf8");
      file.md5Checksum = checksum(file.content);
      file.version = String(Number(file.version) + 1);
      file.modifiedTime = new Date().toISOString();
      addRevision(file);
      const response = publicFile(file);
      if (postUploadVersionDrifts.has(id)) {
        file.version = String(Number(file.version) + 1);
      }
      return route.fulfill({ json: response });
    }

    if (request.method() === "PATCH" && id) {
      await delay(trashDelays.get(id) || 0);
      if (trashFailures.delete(id)) {
        return route.fulfill({ status: 500, body: "Trash failed" });
      }
      const file = files.get(id);
      if (!file) {
        return route.fulfill({ status: 404, body: "Not found" });
      }
      const metadata = request.postDataJSON();
      if (metadata.trashed === true) {
        file.trashed = true;
      }
      return route.fulfill({ json: publicFile(file) });
    }

    return route.fulfill({ status: 405, body: "Unhandled Drive mock request" });
  });

  return {
    addFile,
    addFolder,
    addSharedDrive: (id, name = id) => {
      const drive = { id, name };
      sharedDrives.set(id, drive);
      return drive;
    },
    get: (id) => files.get(id),
    findByName: (name) => [...files.values()].find((file) => file.name === name),
    setFolderDelay: (id, milliseconds) => folderDelays.set(id, milliseconds),
    setFolderDelaySequence: (id, milliseconds) =>
      folderDelays.set(id, [...milliseconds]),
    setFileDelay: (id, milliseconds) => fileDelays.set(id, milliseconds),
    setPostUploadVersionDrift: (id) => postUploadVersionDrifts.add(id),
    restrictRevisionDownloads: (id) => restrictedRevisionDownloads.add(id),
    failNextUpload: (id) => uploadFailures.add(id),
    failNextTrash: (id) => trashFailures.add(id),
    setTrashDelay: (id, milliseconds) => trashDelays.set(id, milliseconds),
    failNextFolderList: (id) => folderListFailures.add(id),
    failNextSearch: () => {
      failNextSearch = true;
    },
    setSearchDelay: (query, milliseconds) =>
      searchDelays.set(query.toLocaleLowerCase(), milliseconds),
    failSearch: (query, status = 500) =>
      searchFailures.set(query.toLocaleLowerCase(), status),
    searchQueries: () => [...searchQueries],
    setSearchPageSize: (pageSize) => {
      searchPageSize = pageSize;
    },
    failNextAbout: () => {
      failNextAbout = true;
    },
    remove: (id) => files.delete(id),
    setAccount: (emailAddress, permissionId) => {
      account = { emailAddress, permissionId };
    },
    aboutRequestCount: () => aboutRequestCount,
    getRevisions: (id) => revisions.get(id) || [],
    updateFileContent: (id, content) => {
      const file = files.get(id);
      file.content = content;
      file.md5Checksum = checksum(content);
      file.version = String(Number(file.version) + 1);
      file.modifiedTime = new Date().toISOString();
      addRevision(file);
    },
  };
}

module.exports = { FOLDER_MIME_TYPE, installDriveApi };
